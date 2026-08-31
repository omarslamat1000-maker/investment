// خريطة المبادرات — خريطة فعلية (Leaflet/OpenStreetMap) لمواقع المبادرات والاحتياجات
// النقاط والخطوط والمساحات المرسومة في المنصة تظهر بمواقعها الحقيقية بألوان الحالة
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader, statusBadge } from '../../ui/components.js';
import { statusLabel } from '../../domain/workflow.js';
import { categoryLabel } from '../../domain/initiative-model.js';
import { measureLabel } from '../../core/geo.js';
import { loadLeaflet } from '../../ui/location-picker.js';
import { fmtNumber } from '../../core/utils.js';
import { navigate } from '../../router.js';

const MADINAH_CENTER = [24.468, 39.612];

// لون كل حالة على الخريطة (متوافق مع شارات المنصة)
const STATUS_COLOR = {
  execution: '#1E7A5F', benefits: '#C9A227', closed: '#4E8F7B',
  readiness: '#8A6D1F', approval: '#8A6D1F', study: '#5B6E66',
  screening: '#5B6E66', submitted: '#5B6E66', draft: '#B8B29A', onHold: '#B8B29A'
};
const NEED_COLOR = '#C9A227';

let currentMap = null; // خريطة الشاشة الحالية — تُزال قبل إعادة الإنشاء

export async function renderMap(container) {
  const [initiatives, needs] = await Promise.all([repos.initiatives.getAll(), repos.needs.getAll()]);

  const located = initiatives.filter((i) =>
    i.status !== 'rejected' && (i.geometry?.coords?.length || (i.lat && i.lng)));
  const locatedNeeds = needs.filter((n) =>
    n.status === 'published' && (n.geometry?.coords?.length || (n.lat && n.lng)));

  container.innerHTML = html`
    ${raw(sectionHeader('خريطة المبادرات',
    `خريطة فعلية لمواقع ${fmtNumber(located.length)} مبادرة و${fmtNumber(locatedNeeds.length)} احتياج مطروح داخل نطاق الأمانة — انقر أي موقع للتفاصيل`))}
    <div class="mi-card mi-map-card">
      <div class="mi-map-real" aria-label="خريطة مواقع المبادرات"></div>
      <div class="mi-map-legend">
        <span><i class="mi-legend-dot" style="background:#1E7A5F"></i> قيد التنفيذ</span>
        <span><i class="mi-legend-dot" style="background:#C9A227"></i> تحقق المنافع</span>
        <span><i class="mi-legend-dot" style="background:#4E8F7B"></i> مغلقة</span>
        <span><i class="mi-legend-dot" style="background:#5B6E66"></i> قبل التنفيذ</span>
        <span><i class="mi-legend-dot mi-legend-dot--need"></i> احتياج مطروح</span>
      </div>
      <div class="mi-map-info" aria-live="polite"><span class="mi-muted">انقر موقعًا على الخريطة لعرض بطاقته</span></div>
    </div>`;

  const mapEl = container.querySelector('.mi-map-real');
  const info = container.querySelector('.mi-map-info');

  let L;
  try { L = await loadLeaflet(); }
  catch {
    mapEl.classList.add('mi-geo-host--empty');
    mapEl.textContent = 'تعذر تحميل الخريطة — تحقق من اتصال الشبكة ثم أعد فتح الصفحة';
    return;
  }
  // الشاشة قد تتغير قبل اكتمال التحميل
  if (!document.body.contains(mapEl)) return;

  if (currentMap) { try { currentMap.remove(); } catch { /* أزيلت مسبقًا */ } }
  const map = L.map(mapEl).setView(MADINAH_CENTER, 12);
  currentMap = map;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  const allLayers = [];

  function showInitiative(ini) {
    info.innerHTML = html`
      <b>${ini.title}</b> ${raw(statusBadge(ini.status))}<br>
      <small class="mi-muted">${ini.id} • ${categoryLabel(ini.category)} • حي ${ini.district}${ini.geometry ? raw(' • ' + escapeHtml(measureLabel(ini.geometry))) : ''}</small>
      <a class="mi-btn mi-btn--ghost mi-btn--sm" href="#/initiatives/${ini.id}">فتح التفاصيل</a>`;
  }

  function showNeed(need) {
    info.innerHTML = html`
      <b>${need.title}</b> <span class="mi-tag mi-tag--gold">احتياج مطروح للشراكة</span><br>
      <small class="mi-muted">${need.id} • ${categoryLabel(need.category)} • حي ${need.district}${need.geometry ? raw(' • ' + escapeHtml(measureLabel(need.geometry))) : ''}</small>
      <a class="mi-btn mi-btn--ghost mi-btn--sm" href="./opportunity.html?id=${encodeURIComponent(need.id)}" target="_blank" rel="noopener">صفحة الفرصة</a>`;
  }

  // طبقة لكل مبادرة حسب هندستها: نقطة/خط/مساحة — أو نقطة من lat/lng القديمة
  function layerFor(L2, record, color, dashed = false) {
    const geometry = record.geometry;
    const base = { color, weight: dashed ? 3 : 4, dashArray: dashed ? '6 5' : null };
    if (geometry?.type === 'line' && geometry.coords.length >= 2) {
      return L2.polyline(geometry.coords, base);
    }
    if (geometry?.type === 'polygon' && geometry.coords.length >= 3) {
      return L2.polygon(geometry.coords, { ...base, fillColor: color, fillOpacity: 0.28 });
    }
    const latlng = geometry?.coords?.[0] || [record.lat, record.lng];
    return L2.circleMarker(latlng, {
      radius: 9, color: '#F6F8F5', weight: 2.5,
      fillColor: color, fillOpacity: dashed ? 0.55 : 1,
      dashArray: dashed ? '4 3' : null
    });
  }

  for (const ini of located) {
    const layer = layerFor(L, ini, STATUS_COLOR[ini.status] || '#5B6E66');
    layer.addTo(map);
    layer.on('click', () => showInitiative(ini));
    layer.on('dblclick', () => navigate(`initiatives/${ini.id}`));
    allLayers.push(layer);
  }

  for (const need of locatedNeeds) {
    const layer = layerFor(L, need, NEED_COLOR, true);
    layer.addTo(map);
    layer.on('click', () => showNeed(need));
    allLayers.push(layer);
  }

  // ملاءمة العرض لكل المواقع
  setTimeout(() => {
    map.invalidateSize();
    if (allLayers.length) {
      const group = L.featureGroup(allLayers);
      map.fitBounds(group.getBounds(), { padding: [30, 30], maxZoom: 14 });
    }
  }, 120);
}
