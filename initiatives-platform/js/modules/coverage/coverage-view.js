// تحليل التغطية والفجوات الجغرافية — أين تتركز المبادرات وأين تغيب،
// بخريطة كثافة بالأحياء ومصفوفة حي × تصنيف وقوائم الفجوات القابلة للتنفيذ
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader, kpiCard } from '../../ui/components.js';
import { hbarChart } from '../../ui/charts.js';
import { coverageAnalysis, districtCenter, GAP_LABELS } from '../../domain/coverage.js';
import { CATEGORIES, DISTRICT_CENTROIDS } from '../../core/constants.js';
import { fmtNumber, fmtMoney, sortBy } from '../../core/utils.js';
import { loadLeaflet } from '../../ui/location-picker.js';
import { navigate } from '../../router.js';
import { getRole } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { openReportViewer } from '../../ui/report-viewer.js';

const GAP_COLOR = { critical: '#A83A3A', high: '#C9A227', medium: '#8A6D1F', covered: '#1E7A5F' };
let currentMap = null;

export async function renderCoverage(container) {
  const [initiatives, needs] = await Promise.all([repos.initiatives.getAll(), repos.needs.getAll()]);
  const a = coverageAnalysis({ initiatives, needs });
  const role = getRole();
  const rowsSorted = sortBy(a.rows, (r) => r.total, 'desc');

  container.innerHTML = html`
    ${raw(sectionHeader('تحليل التغطية والفجوات الجغرافية',
    'توزيع المبادرات والاحتياجات على أحياء المدينة والتصنيفات — لتوجيه طرح الفرص الجديدة بالبيانات',
    can(role, 'reports.view') ? '<button class="mi-btn mi-btn--ghost" data-act="report">تقرير الفجوات</button>' : ''))}

    <div class="mi-kpi-grid">
      ${raw(kpiCard('أحياء مغطاة', `${fmtNumber(a.totals.coveredDistricts)} / ${fmtNumber(a.totals.districts)}`, 'حي فيه مبادرة واحدة على الأقل', 'primary'))}
      ${raw(kpiCard('أحياء بلا مبادرات', String(a.gaps.noInitiatives.length), a.gaps.noInitiatives.length ? 'تحتاج طرح فرص' : 'تغطية كاملة', a.gaps.noInitiatives.length ? 'warn' : 'ok'))}
      ${raw(kpiCard('احتياجات بلا استجابة', String(a.gaps.needsWithoutResponse.reduce((s, r) => s + r.openNeeds, 0)), 'مطروحة في أحياء بلا مبادرة نشطة', ''))}
      ${raw(kpiCard('تصنيفات مهملة', String(a.gaps.neglectedCategories.length), 'بلا أي مبادرة نشطة', ''))}
      ${raw(kpiCard('تركّز التغطية', `${fmtNumber(a.concentration)}٪`, 'نصيب أعلى 3 أحياء من المبادرات', a.concentration > 60 ? 'warn' : 'ok'))}
    </div>

    <div class="mi-dash-grid">
      <section class="mi-card mi-card--span mi-map-card">
        <h3>خريطة كثافة المبادرات بالأحياء</h3>
        <p class="mi-muted">حجم الدائرة = عدد المبادرات، ولونها = مستوى الفجوة. مراكز الأحياء تقريبية من مواقع المبادرات المسجلة أو المرجع الجغرافي.</p>
        <div class="mi-map-real mi-map-real--coverage" aria-label="خريطة التغطية"></div>
        <div class="mi-map-legend">
          <span><i class="mi-legend-dot" style="background:#1E7A5F"></i> مغطى</span>
          <span><i class="mi-legend-dot" style="background:#8A6D1F"></i> تغطية محدودة</span>
          <span><i class="mi-legend-dot" style="background:#C9A227"></i> فجوة عالية</span>
          <span><i class="mi-legend-dot" style="background:#A83A3A"></i> فجوة حرجة</span>
        </div>
      </section>

      <section class="mi-card">
        <h3>المبادرات حسب الحي</h3>
        ${raw(hbarChart(rowsSorted.map((r) => ({ label: r.district, value: r.total, max: a.maxPerDistrict }))))}
      </section>

      <section class="mi-card">
        <h3>الفجوات القابلة للتنفيذ</h3>
        <h4 class="mi-subhead">أحياء بلا مبادرات</h4>
        ${a.gaps.noInitiatives.length ? raw(a.gaps.noInitiatives.map((d) => `<span class="mi-tag" data-benefit="atRisk">${escapeHtml(d)}</span> `).join('')) : raw('<p class="mi-muted">لا يوجد — كل الأحياء فيها مبادرة</p>')}
        <h4 class="mi-subhead">احتياجات مطروحة بلا مبادرة نشطة</h4>
        ${a.gaps.needsWithoutResponse.length ? raw(a.gaps.needsWithoutResponse.map((g) => `<div class="mi-ms"><span class="mi-ms__dot" style="background:var(--mi-gold-500)"></span><span>${escapeHtml(g.district)}</span><small>${escapeHtml(fmtNumber(g.openNeeds))} احتياج</small></div>`).join('')) : raw('<p class="mi-muted">كل الاحتياجات المطروحة في أحياء بها مبادرات نشطة</p>')}
        <h4 class="mi-subhead">تصنيفات بلا مبادرة نشطة</h4>
        ${a.gaps.neglectedCategories.length ? raw(a.gaps.neglectedCategories.map((c) => `<span class="mi-tag" data-benefit="onTrack">${escapeHtml(c)}</span> `).join('')) : raw('<p class="mi-muted">كل التصنيفات ممثلة بمبادرة نشطة</p>')}
        <h4 class="mi-subhead">أحياء ضعيفة التغطية</h4>
        ${a.gaps.underserved.length ? raw(a.gaps.underserved.map((d) => `<span class="mi-tag">${escapeHtml(d)}</span> `).join('')) : raw('<p class="mi-muted">—</p>')}
      </section>

      <section class="mi-card mi-card--span">
        <h3>مصفوفة الحي × التصنيف</h3>
        <p class="mi-muted">كثافة اللون تعكس عدد المبادرات — الخلايا الفارغة فجوات محتملة، والعمود الأخير الاحتياجات المطروحة حاليًا.</p>
        <div class="mi-table-wrap">
          <table class="mi-table mi-heat">
            <thead><tr><th>الحي</th>${raw(CATEGORIES.map((c) => `<th title="${escapeHtml(c.label)}">${escapeHtml(c.label)}</th>`).join(''))}<th>الإجمالي</th><th>احتياجات مطروحة</th><th>الفجوة</th></tr></thead>
            <tbody>
              ${raw(rowsSorted.map((r) => `
                <tr>
                  <th>${escapeHtml(r.district)}</th>
                  ${CATEGORIES.map((c) => { const v = r.byCategory[c.id] || 0; return `<td class="mi-heat__cell" data-level="${heatLevel(v, a.maxPerDistrict)}">${v ? escapeHtml(fmtNumber(v)) : ''}</td>`; }).join('')}
                  <td><b>${escapeHtml(fmtNumber(r.total))}</b></td>
                  <td>${escapeHtml(fmtNumber(r.openNeeds))}</td>
                  <td><span class="mi-gap-tag" data-gap="${r.gap}">${escapeHtml(GAP_LABELS[r.gap].split(' — ')[0])}</span></td>
                </tr>`).join(''))}
            </tbody>
          </table>
        </div>
      </section>

      <section class="mi-card mi-card--span">
        <h3>التصنيفات: مبادرات نشطة مقابل احتياجات مطروحة</h3>
        <div class="mi-table-wrap"><table class="mi-table">
          <thead><tr><th>التصنيف</th><th>مبادرات (كل الحالات)</th><th>نشطة</th><th>احتياجات مطروحة</th><th>القراءة</th></tr></thead>
          <tbody>${raw(a.categoryRows.map((c) => `<tr><td>${escapeHtml(c.label)}</td><td>${escapeHtml(fmtNumber(c.total))}</td><td>${escapeHtml(fmtNumber(c.active))}</td><td>${escapeHtml(fmtNumber(c.openNeeds))}</td>
            <td>${c.active === 0 ? '<span class="mi-gap-tag" data-gap="high">تصنيف مهمل</span>' : c.openNeeds > c.active ? '<span class="mi-gap-tag" data-gap="medium">طلب يفوق العرض</span>' : '<span class="mi-gap-tag" data-gap="covered">متوازن</span>'}</td></tr>`).join(''))}</tbody>
        </table></div>
      </section>
    </div>`;

  container.querySelector('[data-act="report"]')?.addEventListener('click', () => {
    openReportViewer({
      title: 'تقرير الفجوات الجغرافية',
      subtitle: 'توزيع المبادرات والاحتياجات على الأحياء والتصنيفات',
      kpis: [
        { label: 'أحياء مغطاة', value: `${a.totals.coveredDistricts}/${a.totals.districts}` },
        { label: 'أحياء بلا مبادرات', value: String(a.gaps.noInitiatives.length) },
        { label: 'تصنيفات مهملة', value: String(a.gaps.neglectedCategories.length) },
        { label: 'تركّز أعلى 3 أحياء', value: `${a.concentration}٪` }
      ],
      generatedAt: new Date().toISOString(),
      sections: [
        { heading: 'التغطية حسب الحي', html: `<table class="mi-table"><thead><tr><th>الحي</th><th>مبادرات</th><th>نشطة</th><th>مغلقة</th><th>احتياجات مطروحة</th><th>الميزانية</th><th>الفجوة</th></tr></thead><tbody>${rowsSorted.map((r) => `<tr><td>${escapeHtml(r.district)}</td><td>${r.total}</td><td>${r.active}</td><td>${r.closed}</td><td>${r.openNeeds}</td><td>${escapeHtml(fmtMoney(r.budget))}</td><td>${escapeHtml(GAP_LABELS[r.gap])}</td></tr>`).join('')}</tbody></table>` },
        { heading: 'الفجوات', html: `<ul>${[
          ...a.gaps.noInitiatives.map((d) => `<li>حي ${escapeHtml(d)}: لا مبادرات — يُوصى بطرح احتياج</li>`),
          ...a.gaps.needsWithoutResponse.map((g) => `<li>حي ${escapeHtml(g.district)}: ${g.openNeeds} احتياج مطروح بلا مبادرة نشطة — يُوصى بحملة استقطاب شركاء</li>`),
          ...a.gaps.neglectedCategories.map((c) => `<li>تصنيف «${escapeHtml(c)}» بلا مبادرة نشطة</li>`)
        ].join('') || '<li>لا فجوات جوهرية</li>'}</ul>` }
      ]
    });
  });

  // خريطة الكثافة
  const mapEl = container.querySelector('.mi-map-real--coverage');
  let L;
  try { L = await loadLeaflet(); } catch { mapEl.textContent = 'تعذر تحميل الخريطة'; return; }
  if (!document.body.contains(mapEl)) return;
  if (currentMap) { try { currentMap.remove(); } catch { /* أزيلت */ } }
  const map = L.map(mapEl).setView([24.468, 39.612], 12);
  currentMap = map;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  const layers = [];
  for (const r of a.rows) {
    const c = districtCenter(r.district, { initiatives, needs, fallback: DISTRICT_CENTROIDS });
    if (!c) continue;
    const radius = 14 + Math.min(40, r.total * 6);
    const layer = L.circleMarker([c.lat, c.lng], {
      radius, color: '#F6F8F5', weight: 2, fillColor: GAP_COLOR[r.gap], fillOpacity: r.total ? 0.72 : 0.45,
      dashArray: r.total ? null : '4 3'
    }).addTo(map);
    layer.bindPopup(() => {
      const el = document.createElement('div');
      el.className = 'mi-map-popup'; el.dir = 'rtl';
      el.innerHTML = html`
        <b class="mi-map-popup__title">حي ${r.district}</b>
        <span class="mi-gap-tag" data-gap="${r.gap}">${GAP_LABELS[r.gap]}</span>
        <small class="mi-map-popup__meta">${fmtNumber(r.total)} مبادرة (${fmtNumber(r.active)} نشطة، ${fmtNumber(r.closed)} مغلقة) • ${fmtNumber(r.openNeeds)} احتياج مطروح • ${fmtMoney(r.budget)}${c.source === 'reference' ? ' • موقع مرجعي تقريبي' : ''}</small>
        <div class="mi-map-popup__actions">
          <button class="mi-btn mi-btn--primary mi-btn--sm" data-act="needs">${r.total ? 'الاحتياجات' : 'طرح احتياج للحي'}</button>
        </div>`;
      el.querySelector('[data-act="needs"]').addEventListener('click', () => { map.closePopup(); navigate('needs'); });
      return el;
    }, { maxWidth: 300 });
    layer.bindTooltip(`${r.district} — ${fmtNumber(r.total)}`, { direction: 'top', className: 'mi-cov-tip' });
    layers.push(layer);
  }
  setTimeout(() => {
    map.invalidateSize();
    if (layers.length) map.fitBounds(L.featureGroup(layers).getBounds(), { padding: [30, 30], maxZoom: 13 });
  }, 120);
}

function heatLevel(v, max) {
  if (!v) return '0';
  const p = v / Math.max(1, max);
  return p >= 0.75 ? '4' : p >= 0.5 ? '3' : p >= 0.25 ? '2' : '1';
}
