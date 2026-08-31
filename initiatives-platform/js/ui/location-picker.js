// منتقي الموقع الجغرافي — خريطة تفاعلية (Leaflet/OSM) لرسم نقطة أو خط أو مساحة
// مع حساب الطول/المساحة تلقائيًا وزرّي تأكيد وتعديل. يعمل عبر CDN ويحتاج اتصالًا بالشبكة.
import { openModal } from './modal.js';
import { html, raw } from '../core/sanitizer.js';
import { measureGeometry, measureLabel } from '../core/geo.js';
import { toastError } from './toast.js';

const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const MADINAH_CENTER = [24.468, 39.612];

let leafletPromise = null;
export function loadLeaflet() {
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (window.L?.map) { resolve(window.L); return; }
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = LEAFLET_CSS;
    document.head.appendChild(css);
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.onload = () => resolve(window.L);
    script.onerror = () => { leafletPromise = null; reject(new Error('تعذر تحميل مكتبة الخرائط — تحقق من اتصال الشبكة')); };
    document.head.appendChild(script);
  });
  return leafletPromise;
}

function baseLayer(L) {
  return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  });
}

const STYLES = {
  line: { color: '#0E5A44', weight: 4 },
  polygon: { color: '#C9A227', weight: 3, fillColor: '#C9A227', fillOpacity: 0.25 }
};

// فتح منتقي الموقع — onConfirm(geometry) حيث geometry:
// { type: 'point'|'line'|'polygon', coords: [[lat,lng],...], lengthM, areaM2 }
export async function openLocationPicker({ initial = null, onConfirm }) {
  let L;
  try { L = await loadLeaflet(); }
  catch (err) { toastError(err.message); return; }

  const MODES = [
    { id: 'point', label: 'نقطة 📍' },
    { id: 'line', label: 'خط ─' },
    { id: 'polygon', label: 'مساحة ⬠' }
  ];

  const { dialog, close } = openModal({
    title: 'تحديد الموقع الجغرافي',
    wide: true,
    bodyHtml: html`
      <div class="mi-picker-toolbar" role="group" aria-label="نمط الرسم">
        ${raw(MODES.map((m) => `<button type="button" class="mi-chip" data-mode="${m.id}" aria-pressed="false">${m.label}</button>`).join(''))}
        <span class="mi-picker-sep"></span>
        <button type="button" class="mi-btn mi-btn--ghost mi-btn--sm" data-act="undo">تراجع عن آخر نقطة</button>
        <button type="button" class="mi-btn mi-btn--ghost mi-btn--sm" data-act="clear">مسح</button>
      </div>
      <div class="mi-picker-map" id="mi-picker-map" aria-label="خريطة تحديد الموقع"></div>
      <div class="mi-picker-measure" aria-live="polite">
        <span class="mi-picker-hint">اختر نمط الرسم ثم انقر على الخريطة — للنقطة نقرة واحدة، وللخط والمساحة عدة نقرات</span>
      </div>`,
    footerHtml: html`
      <button class="mi-btn mi-btn--ghost" data-act="cancel">إلغاء</button>
      <button class="mi-btn mi-btn--primary" data-act="confirm" disabled>تأكيد الموقع</button>`
  });

  const mapEl = dialog.querySelector('#mi-picker-map');
  const measureEl = dialog.querySelector('.mi-picker-measure');
  const confirmBtn = dialog.querySelector('[data-act="confirm"]');

  const map = L.map(mapEl, { zoomControl: true }).setView(
    initial?.coords?.length ? initial.coords[0] : MADINAH_CENTER,
    initial?.coords?.length ? 15 : 12
  );
  baseLayer(L).addTo(map);
  setTimeout(() => map.invalidateSize(), 120);

  let mode = initial?.type || 'point';
  let coords = initial?.coords ? initial.coords.map((c) => [...c]) : [];
  let shapeLayer = null;

  function setMode(newMode) {
    mode = newMode;
    coords = [];
    dialog.querySelectorAll('[data-mode]').forEach((b) =>
      b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false'));
    redraw();
  }

  function redraw() {
    if (shapeLayer) { shapeLayer.remove(); shapeLayer = null; }
    if (coords.length) {
      if (mode === 'point') shapeLayer = L.marker(coords[0]);
      else if (mode === 'line') shapeLayer = L.polyline(coords, STYLES.line);
      else shapeLayer = coords.length >= 3 ? L.polygon(coords, STYLES.polygon) : L.polyline(coords, STYLES.polygon);
      shapeLayer.addTo(map);
    }
    const valid = mode === 'point' ? coords.length === 1
      : mode === 'line' ? coords.length >= 2
        : coords.length >= 3;
    confirmBtn.disabled = !valid;
    const geometry = { type: mode, coords };
    if (coords.length && valid) {
      measureEl.innerHTML = html`<b>${measureLabel(geometry)}</b> <span class="mi-muted">— ${String(coords.length)} نقطة</span>`;
    } else if (coords.length) {
      measureEl.innerHTML = html`<span class="mi-muted">${String(coords.length)} نقطة — ${mode === 'line' ? 'أضف نقطة أخرى على الأقل' : 'أضف 3 نقاط على الأقل للمساحة'}</span>`;
    } else {
      measureEl.innerHTML = '<span class="mi-picker-hint">اختر نمط الرسم ثم انقر على الخريطة — للنقطة نقرة واحدة، وللخط والمساحة عدة نقرات</span>';
    }
  }

  map.on('click', (e) => {
    const pt = [Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))];
    if (mode === 'point') coords = [pt];
    else coords.push(pt);
    redraw();
  });

  dialog.querySelectorAll('[data-mode]').forEach((btn) =>
    btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  dialog.querySelector('[data-act="undo"]').addEventListener('click', () => { coords.pop(); redraw(); });
  dialog.querySelector('[data-act="clear"]').addEventListener('click', () => { coords = []; redraw(); });
  dialog.querySelector('[data-act="cancel"]').addEventListener('click', () => { map.remove(); close(); });

  confirmBtn.addEventListener('click', () => {
    const geometry = { type: mode, coords };
    const m = measureGeometry(geometry);
    map.remove();
    close();
    onConfirm({ ...geometry, lengthM: m?.lengthM ?? null, areaM2: m?.areaM2 ?? null });
  });

  // تهيئة العرض الأولي
  setMode(mode);
  if (initial?.coords?.length) { coords = initial.coords.map((c) => [...c]); redraw(); }
}

// معاينة ثابتة لهندسة محفوظة (خريطة صغيرة غير قابلة للتحرير)
export async function renderGeometryPreview(container, geometry) {
  if (!geometry?.coords?.length) return;
  let L;
  try { L = await loadLeaflet(); }
  catch { container.innerHTML = '<p class="mi-muted">تعذر تحميل الخريطة — الموقع محفوظ ويُعرض عند توفر الاتصال</p>'; return; }
  container.classList.add('mi-geo-preview');
  const map = L.map(container, {
    zoomControl: false, dragging: false, scrollWheelZoom: false,
    doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false
  });
  baseLayer(L).addTo(map);
  let layer;
  if (geometry.type === 'point') layer = L.marker(geometry.coords[0]);
  else if (geometry.type === 'line') layer = L.polyline(geometry.coords, STYLES.line);
  else layer = L.polygon(geometry.coords, STYLES.polygon);
  layer.addTo(map);
  setTimeout(() => {
    map.invalidateSize();
    if (geometry.type === 'point') map.setView(geometry.coords[0], 15);
    else map.fitBounds(layer.getBounds(), { padding: [18, 18] });
  }, 120);
}
