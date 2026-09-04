// خريطة المبادرات — خريطة فعلية (Leaflet/OpenStreetMap) لمواقع المبادرات والاحتياجات
// النقاط والخطوط والمساحات المرسومة في المنصة تظهر بمواقعها الحقيقية بألوان الحالة،
// مع شريط فلاتر (الحالة، المجال، الجهة المقدمة، الحي، الطبقات، التكلفة، الجاهزية، المدة) وبحث نصي
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader, statusBadge } from '../../ui/components.js';
import { statusLabel } from '../../domain/workflow.js';
import { categoryLabel, getSites, firstLatLng } from '../../domain/initiative-model.js';
import { measureLabel, sitesSummaryLabel } from '../../core/geo.js';
import { loadLeaflet, openLocationPicker } from '../../ui/location-picker.js';
import { fmtNumber, debounce } from '../../core/utils.js';
import { navigate } from '../../router.js';
import { getRole } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { toastSuccess } from '../../ui/toast.js';
import { STATUSES, CATEGORIES, DISTRICTS, COST_BANDS, DURATION_BANDS, READINESS_LEVELS, STORAGE_PREFIX } from '../../core/constants.js';

const MADINAH_CENTER = [24.468, 39.612];

// لون كل حالة على الخريطة (متوافق مع شارات المنصة)
const STATUS_COLOR = {
  execution: '#1E7A5F', benefits: '#C9A227', closed: '#4E8F7B',
  readiness: '#8A6D1F', approval: '#8A6D1F', study: '#5B6E66',
  screening: '#5B6E66', submitted: '#5B6E66', draft: '#B8B29A', onHold: '#B8B29A'
};
const NEED_COLOR = '#C9A227';
const FILTERS_KEY = STORAGE_PREFIX + 'mapFilters';
const EMPTY_FILTERS = { q: '', status: '', category: '', entity: '', district: '', cost: '', readiness: '', duration: '', showInitiatives: true, showNeeds: true };

let currentMap = null; // خريطة الشاشة الحالية — تُزال قبل إعادة الإنشاء

function loadFilters() {
  try { return { ...EMPTY_FILTERS, ...(JSON.parse(localStorage.getItem(FILTERS_KEY) || '{}')) }; } catch { return { ...EMPTY_FILTERS }; }
}
function saveFilters(f) {
  try { localStorage.setItem(FILTERS_KEY, JSON.stringify(f)); } catch { /* تخزين محظور */ }
}

export async function renderMap(container) {
  const [initiatives, needs] = await Promise.all([repos.initiatives.getAll(), repos.needs.getAll()]);
  const role = getRole();
  const canEdit = can(role, 'initiatives.edit');

  const located = initiatives.filter((i) => i.status !== 'rejected' && getSites(i).length);
  const totalSites = located.reduce((a, i) => a + getSites(i).length, 0);
  const locatedNeeds = needs.filter((n) =>
    n.status === 'published' && (n.geometry?.coords?.length || (n.lat && n.lng)));
  const entities = [...new Set(initiatives.map((i) => i.submitterEntity).filter(Boolean))].sort();
  const filters = loadFilters();

  const opt = (list, selected, labelOf = (x) => x.label, valueOf = (x) => x.id) =>
    list.map((x) => `<option value="${escapeHtml(valueOf(x))}" ${valueOf(x) === selected ? 'selected' : ''}>${escapeHtml(labelOf(x))}</option>`).join('');

  container.innerHTML = html`
    ${raw(sectionHeader('خريطة المبادرات',
    `خريطة فعلية لـ ${fmtNumber(totalSites)} موقعًا تتبع ${fmtNumber(located.length)} مبادرة، و${fmtNumber(locatedNeeds.length)} احتياجًا مطروحًا — انقر أي موقع لفتح المبادرة${canEdit ? ' أو تعديل موقعها' : ''}`))}
    <div class="mi-card mi-map-card">
      <form class="mi-map-filters" data-map-filters aria-label="تصفية الخريطة">
        <div class="mi-map-filters__row">
          <input class="mi-input mi-map-filters__search" type="search" name="q" placeholder="بحث بالاسم أو المعرّف أو الطريق…" value="${filters.q}" aria-label="بحث">
          <select class="mi-input" name="status" aria-label="الحالة"><option value="">كل الحالات</option>${raw(opt(Object.values(STATUSES).filter((s) => s.id !== 'rejected'), filters.status))}</select>
          <select class="mi-input" name="category" aria-label="المجال"><option value="">كل المجالات</option>${raw(opt(CATEGORIES, filters.category))}</select>
          <select class="mi-input" name="entity" aria-label="الجهة المقدمة"><option value="">كل الجهات المقدمة</option>${raw(opt(entities, filters.entity, (x) => x, (x) => x))}</select>
          <select class="mi-input" name="district" aria-label="الحي"><option value="">كل الأحياء</option>${raw(opt(DISTRICTS, filters.district, (x) => x, (x) => x))}</select>
        </div>
        <div class="mi-map-filters__row">
          <select class="mi-input" name="cost" aria-label="التكلفة التقديرية"><option value="">كل التكاليف</option>${raw(opt(COST_BANDS, filters.cost))}</select>
          <select class="mi-input" name="readiness" aria-label="مستوى الجاهزية"><option value="">كل مستويات الجاهزية</option>${raw(opt(READINESS_LEVELS, filters.readiness))}</select>
          <select class="mi-input" name="duration" aria-label="المدة التقديرية"><option value="">كل المدد</option>${raw(opt(DURATION_BANDS, filters.duration))}</select>
          <label class="mi-check-item mi-map-filters__toggle"><input type="checkbox" name="showInitiatives" ${filters.showInitiatives ? raw('checked') : ''}><span>المبادرات</span></label>
          <label class="mi-check-item mi-map-filters__toggle"><input type="checkbox" name="showNeeds" ${filters.showNeeds ? raw('checked') : ''}><span>الاحتياجات المطروحة</span></label>
          <span class="mi-map-filters__count" data-count aria-live="polite"></span>
          <button type="button" class="mi-btn mi-btn--ghost mi-btn--sm" data-act="clear">مسح الفلاتر</button>
        </div>
      </form>
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
  const form = container.querySelector('[data-map-filters]');
  const countEl = container.querySelector('[data-count]');

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

  // كل عنصر على الخريطة مع بياناته الوصفية للتصفية
  const entries = []; // { kind: 'initiative'|'need', record, layer, text }

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
    const text = [ini.id, ini.title, ini.location, ini.district, ini.summary].join(' ').toLowerCase();
    for (const site of getSites(ini)) {
      const layer = layerFor(L, site.geometry, [ini.lat, ini.lng], color);
      layer.bindPopup(() => buildSitePopup(ini, site), { closeButton: true, maxWidth: 300 });
      layer.on('click', () => showInitiative(ini, site));
      layer.on('dblclick', () => navigate(`initiatives/${ini.id}`));
      entries.push({ kind: 'initiative', record: ini, layer, text: text + ' ' + (site.name || '').toLowerCase() });
    }
  }

  for (const need of locatedNeeds) {
    const layer = layerFor(L, need.geometry, [need.lat, need.lng], NEED_COLOR, true);
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
    entries.push({ kind: 'need', record: need, layer, text: [need.id, need.title, need.location, need.district, need.description].join(' ').toLowerCase() });
  }

  // ————— التصفية —————
  function readForm() {
    const f = { ...EMPTY_FILTERS };
    for (const k of ['q', 'status', 'category', 'entity', 'district', 'cost', 'readiness', 'duration']) f[k] = form.elements[k].value.trim();
    f.showInitiatives = form.elements.showInitiatives.checked;
    f.showNeeds = form.elements.showNeeds.checked;
    return f;
  }

  function matches(entry, f) {
    const r = entry.record;
    if (entry.kind === 'need') {
      if (!f.showNeeds) return false;
      // الاحتياجات تخضع لفلاتر المجال والحي والبحث فقط (بقية الحقول خاصة بالمبادرات)
      if (f.category && r.category !== f.category) return false;
      if (f.district && r.district !== f.district) return false;
      if (f.status || f.entity || f.cost || f.readiness || f.duration) return false;
    } else {
      if (!f.showInitiatives) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.category && r.category !== f.category) return false;
      if (f.entity && r.submitterEntity !== f.entity) return false;
      if (f.district && r.district !== f.district) return false;
      if (f.cost && (r.costBand || '') !== f.cost) return false;
      if (f.readiness && (r.readinessLevel || '') !== f.readiness) return false;
      if (f.duration && (r.durationBand || '') !== f.duration) return false;
    }
    if (f.q && !entry.text.includes(f.q.toLowerCase())) return false;
    return true;
  }

  function applyFilters({ fit = true } = {}) {
    const f = readForm();
    saveFilters(f);
    const visible = [];
    for (const e of entries) {
      const on = matches(e, f);
      if (on && !map.hasLayer(e.layer)) e.layer.addTo(map);
      if (!on && map.hasLayer(e.layer)) map.removeLayer(e.layer);
      if (on) visible.push(e);
    }
    const inis = new Set(visible.filter((e) => e.kind === 'initiative').map((e) => e.record.id)).size;
    const needsCount = visible.filter((e) => e.kind === 'need').length;
    const active = Object.entries(f).filter(([k, v]) => (typeof v === 'boolean' ? !v : Boolean(v))).length;
    countEl.textContent = `${fmtNumber(visible.length)} من ${fmtNumber(entries.length)} موقعًا — ${fmtNumber(inis)} مبادرة و${fmtNumber(needsCount)} احتياج${active ? ` (${fmtNumber(active)} فلتر نشط)` : ''}`;
    countEl.dataset.empty = visible.length ? 'no' : 'yes';
    if (fit && visible.length) {
      map.fitBounds(L.featureGroup(visible.map((e) => e.layer)).getBounds(), { padding: [30, 30], maxZoom: 14 });
    }
    if (!visible.length) info.innerHTML = '<span class="mi-muted">لا مواقع مطابقة للتصفية الحالية — عدّل الفلاتر أو امسحها</span>';
  }

  const debouncedApply = debounce(() => applyFilters(), 250);
  form.elements.q.addEventListener('input', debouncedApply);
  form.addEventListener('change', () => applyFilters());
  form.addEventListener('submit', (e) => { e.preventDefault(); applyFilters(); });
  form.querySelector('[data-act="clear"]').addEventListener('click', () => {
    form.reset();
    form.elements.q.value = '';
    for (const k of ['status', 'category', 'entity', 'district', 'cost', 'readiness', 'duration']) form.elements[k].value = '';
    form.elements.showInitiatives.checked = true;
    form.elements.showNeeds.checked = true;
    applyFilters();
  });

  // ملاءمة العرض لكل المواقع المطابقة عند التحميل
  setTimeout(() => {
    map.invalidateSize();
    applyFilters({ fit: true });
  }, 120);
}
