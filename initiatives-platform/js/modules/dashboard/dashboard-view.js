// لوحة المتابعة — نظرة قيادية على المحفظة: أعداد، صحة، بوابات، مخاطر، منافع
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { kpiCard, statusBadge, healthBadge, gateTrackHtml, sectionHeader } from '../../ui/components.js';
import { donutChart, barChart, hbarChart } from '../../ui/charts.js';
import { STATUSES, CATEGORIES } from '../../core/constants.js';
import { groupBy, sum, fmtMoney, sortBy } from '../../core/utils.js';
import { initiativeHealth } from '../../domain/initiative-health.js';
import { isActive, statusOrder } from '../../domain/workflow.js';
import { benefitsSummary } from '../../domain/benefits.js';
import { openRisks, exposureLevel, exposure } from '../../domain/risks.js';
import { categoryLabel } from '../../domain/initiative-model.js';
import { navigate } from '../../router.js';
import { agingSummary } from '../../domain/sla.js';
import { getSlaConfig } from '../../services/sla-service.js';
import { slaChip } from '../../ui/components.js';
import { fmtNumber } from '../../core/utils.js';
import { statusLabel } from '../../domain/workflow.js';
import { pendingReports } from '../../services/progress-report-service.js';

export async function renderDashboard(container) {
  const [initiatives, partners, needs, benefits, risks, milestones, slaConfig, pendingField] = await Promise.all([
    repos.initiatives.getAll(), repos.partners.getAll(), repos.needs.getAll(),
    repos.benefits.getAll(), repos.risks.getAll(), repos.milestones.getAll(),
    getSlaConfig(), pendingReports()
  ]);
  const aging = agingSummary(initiatives, slaConfig);

  const active = initiatives.filter((i) => isActive(i.status) && i.status !== 'draft');
  const inExecution = initiatives.filter((i) => i.status === 'execution');
  const closed = initiatives.filter((i) => i.status === 'closed');
  const partnerBudget = sum(initiatives.filter((i) => !['rejected', 'draft'].includes(i.status)), (i) => i.budget);
  const benSummary = benefitsSummary(benefits);
  const openR = openRisks(risks);

  const byStatus = groupBy(active, (i) => i.status);
  const statusData = Object.entries(byStatus)
    .sort((a, b) => statusOrder(a[0]) - statusOrder(b[0]))
    .map(([s, list]) => ({ label: STATUSES[s]?.label || s, value: list.length }));

  const byCategory = groupBy(initiatives.filter((i) => i.status !== 'rejected'), (i) => i.category);
  const categoryData = sortBy(
    Object.entries(byCategory).map(([c, list]) => ({ label: categoryLabel(c), value: list.length })),
    (d) => d.value, 'desc').slice(0, 6);

  const healthRows = inExecution.map((i) => {
    const h = initiativeHealth(i, {
      milestones: milestones.filter((m) => m.initiativeId === i.id),
      risks: risks.filter((r) => r.initiativeId === i.id),
      benefits: benefits.filter((b) => b.initiativeId === i.id)
    });
    return { initiative: i, health: h };
  });

  const topRisks = sortBy(openR, (r) => exposure(r), 'desc').slice(0, 5);

  container.innerHTML = html`
    ${raw(sectionHeader('لوحة المتابعة', 'نظرة مجمعة على محفظة مبادرات البنية التحتية والشراكات المجتمعية'))}

    <div class="mi-kpi-grid">
      ${raw(kpiCard('مبادرة نشطة', String(active.length), 'عبر جميع البوابات', 'primary'))}
      ${raw(kpiCard('قيد التنفيذ', String(inExecution.length), '', 'exec'))}
      ${raw(kpiCard('قيمة المحفظة', fmtMoney(partnerBudget), 'مساهمات ومصروفات الشركاء', 'gold'))}
      ${raw(kpiCard('مغلقة بمنافع محققة', String(closed.length), benSummary.avgRealization !== null ? `متوسط التحقق ${benSummary.avgRealization}٪` : '', 'ok'))}
      ${raw(kpiCard('احتياجات مطروحة', String(needs.filter((n) => n.status === 'published').length), 'بانتظار شركاء', ''))}
      ${raw(kpiCard('شركاء فاعلون', String(partners.filter((p) => p.active).length), '', ''))}
      ${raw(kpiCard('متجاوزة SLA البوابات', String(aging.counts.overdue), aging.counts.warn ? `${fmtNumber(aging.counts.warn)} تقترب من الحد` : 'ضمن المدد المعلنة', aging.counts.overdue ? 'warn' : 'ok'))}
      ${raw(kpiCard('تقارير ميدانية بانتظار الاعتماد', String(pendingField.length), 'من الشركاء', pendingField.length ? 'gold' : ''))}
    </div>

    <div class="mi-dash-grid">
      <section class="mi-card mi-card--span mi-sla-card">
        <h3>تقادم البوابات (SLA) <small class="mi-muted">— ${fmtNumber(aging.counts.tracked)} مبادرة في مراحل مؤقتة</small></h3>
        <div class="mi-sla-stages">
          ${raw(aging.stages.map((s) => html`
            <div class="mi-sla-stage" data-level="${s.overdue ? 'overdue' : s.warn ? 'warn' : 'ok'}">
              <b>${statusLabel(s.status)}</b>
              <span class="mi-sla-stage__count">${fmtNumber(s.total)}</span>
              <small>الحد ${fmtNumber(s.limit)} يومًا • متوسط ${fmtNumber(s.avgDays)} يومًا</small>
              <small>${s.overdue ? raw(`<span class="mi-sla" data-level="overdue">${escapeHtml(fmtNumber(s.overdue))} متجاوزة</span>`) : ''} ${s.warn ? raw(`<span class="mi-sla" data-level="warn">${escapeHtml(fmtNumber(s.warn))} تقترب</span>`) : ''}</small>
            </div>`).join('') || '<p class="mi-muted">لا مبادرات في مراحل مؤقتة حاليًا</p>')}
        </div>
        ${aging.overdue.length || aging.warn.length ? raw(html`
          <h4 class="mi-subhead">تحتاج تصعيدًا الآن</h4>
          ${raw([...aging.overdue, ...aging.warn].slice(0, 6).map(({ initiative, sla }) => html`
            <div class="mi-health-row" data-id="${initiative.id}" tabindex="0" role="button" aria-label="فتح ${initiative.title}">
              <div class="mi-health-row__main">
                <b>${initiative.title}</b>
                <span class="mi-health-row__meta">${initiative.id} • ${statusLabel(initiative.status)}</span>
              </div>
              ${raw(slaChip(sla))}
            </div>`).join(''))}`) : raw('<p class="mi-muted">كل المبادرات ضمن مددها المعلنة ✔</p>')}
      </section>
      <section class="mi-card">
        <h3>توزيع المبادرات على مراحل الحوكمة</h3>
        ${raw(donutChart(statusData, { centerLabel: 'مبادرة نشطة' }))}
      </section>
      <section class="mi-card">
        <h3>المبادرات حسب التصنيف</h3>
        ${raw(barChart(categoryData))}
      </section>
      <section class="mi-card mi-card--span">
        <h3>صحة المبادرات قيد التنفيذ</h3>
        ${healthRows.length ? raw(healthRows.map(({ initiative, health }) => html`
          <div class="mi-health-row" data-id="${initiative.id}" tabindex="0" role="button" aria-label="فتح ${initiative.title}">
            <div class="mi-health-row__main">
              <b>${initiative.title}</b>
              <span class="mi-health-row__meta">${initiative.id} • ${escapeHtml(initiative.district)}</span>
            </div>
            ${raw(gateTrackHtml(initiative.status, { compact: true }))}
            ${raw(statusBadge(initiative.status))}
            ${raw(healthBadge(health))}
          </div>`).join('')) : raw('<p class="mi-muted">لا توجد مبادرات قيد التنفيذ حاليًا</p>')}
      </section>
      <section class="mi-card">
        <h3>أعلى المخاطر المفتوحة</h3>
        ${topRisks.length ? raw(topRisks.map((r) => html`
          <div class="mi-risk-line">
            <span class="mi-risk-line__badge" data-level="${exposureLevel(r).id}">${exposureLevel(r).label}</span>
            <span>${r.title}</span>
          </div>`).join('')) : raw('<p class="mi-muted">لا مخاطر مفتوحة</p>')}
      </section>
      <section class="mi-card">
        <h3>تحقق المنافع</h3>
        ${raw(hbarChart([
          { label: 'منافع مستهدفة', value: benSummary.total, max: benSummary.total },
          { label: 'جرى قياسها', value: benSummary.measured, max: benSummary.total },
          { label: 'متحققة بالكامل', value: benSummary.achieved, max: benSummary.total }
        ]))}
      </section>
    </div>`;

  container.querySelectorAll('.mi-health-row').forEach((row) => {
    const go = () => navigate(`initiatives/${row.dataset.id}`);
    row.addEventListener('click', go);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
}
