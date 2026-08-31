// خريطة المبادرات — خريطة فعلية (Leaflet/OpenStreetMap) لمواقع المبادرات والاحتياجات
// النقاط والخطوط والمساحات المرسومة في المنصة تظهر بمواقعها الحقيقية بألوان الحالة
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader, statusBadge } from '../../ui/components.js';
import { statusLabel } from '../../domain/workflow.js';
import { categoryLabel, getSites, firstLatLng } from '../../domain/initiative-model.js';
import { measureLabel, sitesSummaryLabel } from '../../core/geo.js';
import { loadLeaflet, openLocationPicker } from '../../ui/location-picker.js';
import { fmtNumber } from '../../core/utils.js';
import { navigate } from '../../router.js';
import { getRole } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { toastSuccess } from '../../ui/toast.js';

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
  const role = getRole();
  const canEdit = can(role, 'initiatives.edit');

  const located = initiatives.filter((i) => i.status !== 'rejected' && getSites(i).length);
  const totalSites = located.reduce((a, i) => a + getSites(i).length, 0);
  const locatedNeeds = needs.filter((n) =>
    n.status === 'published' && (n.geometry?.coords?.length || (n.lat && n.lng)));

  container.innerHTML = html`
    ${raw(sectionHeader('خريطة المبادرات',
    `خريطة فعلية لـ ${fmtNumber(totalSites)} موقعًا تتبع ${fmtNumber(located.length)} مبادرة، و${fmtNumber(locatedNeeds.length)} احتياجًا مطروحًا — انقر أي موقع لفتح المبادرة${canEdit ? ' أو تعديل موقعها' : ''}`))}
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

  function showInitiative(ini, site) {
    const sites = getSites(ini);
    info.innerHTML = html`
      <b>${ini.title}</b> ${raw(statusBadge(ini.status))}${site?.name && sites.length > 1 ? raw(` <span class="mi-tag">${escapeHtml(site.name)}</span>`) : ''}<br>
      <small class="mi-muted">${ini.id} • ${categoryLabel(ini.category)} • حي ${ini.district} • ${sitesSummaryLabel(sites)}</small>
      <a class="mi-btn mi-btn--ghost mi-btn--sm" href="#/initiatives/${ini.id}">فتح التفاصيل</a>`;
  }

  function showNeed(need) {
    info.innerHTML = html`
      <b>${need.title}</b> <span class="mi-tag mi-tag--gold">احتياج مطروح للشراكة</span><br>
      <small class="mi-muted">${need.id} • ${categoryLabel(need.category)} • حي ${need.district}${need.geometry ? raw(' • ' + escapeHtml(measureLabel(need.geometry))) : ''}</small>
      <a class="mi-btn mi-btn--ghost mi-btn--sm" href="./opportunity.html?id=${encodeURIComponent(need.id)}" target="_blank" rel="noopener">صفحة الفرصة</a>`;
  }

  // طبقة لكل هندسة: نقطة/خط/مساحة
  function layerFor(L2, geometry, fallbackLatLng, color, dashed = false) {
    const base = { color, weight: dashed ? 3 : 4, dashArray: dashed ? '6 5' : null };
    if (geometry?.type === 'line' && geometry.coords.length >= 2) {
      return L2.polyline(geometry.coords, base);
    }
    if (geometry?.type === 'polygon' && geometry.coords.length >= 3) {
      return L2.polygon(geometry.coords, { ...base, fillColor: color, fillOpacity: 0.28 });
    }
    const latlng = geometry?.coords?.[0] || fallbackLatLng;
    return L2.circleMarker(latlng, {
      radius: 9, color: '#F6F8F5', weight: 2.5,
      fillColor: color, fillOpacity: dashed ? 0.55 : 1,
      dashArray: dashed ? '4 3' : null
    });
  }

  // نافذة منبثقة على الموقع نفسه: فتح المبادرة أو تعديل موقعها الجغرافي مباشرة
  function buildSitePopup(ini, site) {
    const sites = getSites(ini);
    const el = document.createElement('div');
    el.className = 'mi-map-popup';
    el.dir = 'rtl';
    el.innerHTML = html`
      <b class="mi-map-popup__title">${ini.title}</b>
      ${raw(statusBadge(ini.status))}
      <small class="mi-map-popup__meta">${sites.length > 1 && site.name ? raw(escapeHtml(site.name) + ' — ') : ''}${measureLabel(site.geometry)}</small>
      <div class="mi-map-popup__actions">
        <button class="mi-btn mi-btn--primary mi-btn--sm" data-act="open">فتح المبادرة</button>
        ${canEdit ? raw('<button class="mi-btn mi-btn--ghost mi-btn--sm" data-act="edit-geo">تعديل الموقع</button>') : ''}
      </div>`;

    el.querySelector('[data-act="open"]').addEventListener('click', () => {
      map.closePopup();
      navigate(`initiatives/${ini.id}`);
    });

    el.querySelector('[data-act="edit-geo"]')?.addEventListener('click', () => {
      map.closePopup();
      openLocationPicker({
        initial: site.geometry,
        async onConfirm(geometry) {
          // استبدال هندسة هذا الموقع وحده مع الحفاظ على بقية المواقع
          const updated = sites.map((s) => s.id === site.id ? { ...s, geometry } : { ...s });
          const { lat, lng } = firstLatLng(updated);
          await repos.initiatives.update(ini.id, { sites: updated, geometry: null, lat, lng });
          toastSuccess(`حُدّث موقع «${ini.title}» — ${measureLabel(geometry)}`);
          renderMap(container); // إعادة رسم الخريطة بالموقع الجديد
        }
      });
    });
    return el;
  }

  // كل مواقع كل مبادرة — الموقع الواحد طبقة مستقلة قابلة للنقر
  for (const ini of located) {
    const color = STATUS_COLOR[ini.status] || '#5B6E66';
    for (const site of getSites(ini)) {
      const layer = layerFor(L, site.geometry, [ini.lat, ini.lng], color);
      layer.addTo(map);
      layer.bindPopup(() => buildSitePopup(ini, site), { closeButton: true, maxWidth: 300 });
      layer.on('click', () => showInitiative(ini, site));
      layer.on('dblclick', () => navigate(`initiatives/${ini.id}`));
      allLayers.push(layer);
    }
  }

  for (const need of locatedNeeds) {
    const layer = layerFor(L, need.geometry, [need.lat, need.lng], NEED_COLOR, true);
    layer.addTo(map);
    layer.bindPopup(() => {
      const el = document.createElement('div');
      el.className = 'mi-map-popup';
      el.dir = 'rtl';
      el.innerHTML = html`
        <b class="mi-map-popup__title">${need.title}</b>
        <span class="mi-tag mi-tag--gold">احتياج مطروح</span>
        <div class="mi-map-popup__actions">
          <a class="mi-btn mi-btn--primary mi-btn--sm" href="./opportunity.html?id=${encodeURIComponent(need.id)}" target="_blank" rel="noopener">صفحة الفرصة</a>
        </div>`;
      return el;
    }, { closeButton: true, maxWidth: 280 });
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
