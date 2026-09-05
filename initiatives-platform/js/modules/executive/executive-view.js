// لوحة القرار التنفيذي — صفحة واحدة لمتخذ القرار: ما ينتظر توقيعي، المتجاوز للمدة،
// القيمة المعلقة عند كل بوابة، الأولويات، واعتماد مباشر من اللوحة
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader, kpiCard, statusBadge, slaChip } from '../../ui/components.js';
import { hbarChart } from '../../ui/charts.js';
import { statusLabel, statusOrder, isActive } from '../../domain/workflow.js';
import { categoryLabel, costBandLabel } from '../../domain/initiative-model.js';
import { agingSummary } from '../../domain/sla.js';
import { getSlaConfig } from '../../services/sla-service.js';
import { pendingForRole, nextStep, roleLabel, chainProgress } from '../../domain/approval-chain.js';
import { signGateDecision } from '../../services/decision-service.js';
import { prioritizeInitiatives, estimatedCost } from '../../domain/priorities.js';
import { fmtMoney, fmtNumber, sum, sortBy } from '../../core/utils.js';
import { fmtDate } from '../../core/date-time.js';
import { getRole, getSession } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { confirmModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { navigate } from '../../router.js';
import { openCommitteeDeck } from '../../ui/slides-viewer.js';

export async function renderExecutive(container) {
  const [initiatives, decisions, slaConfig, agreements, reports, needs, apps] = await Promise.all([
    repos.initiatives.getAll(), repos.decisions.getAll(), getSlaConfig(),
    repos.agreements.getAll().catch(() => []), repos.progressReports.getAll().catch(() => []),
    repos.needs.getAll(), repos.needApplications.getAll().catch(() => [])
  ]);
  const role = getRole();
  const session = getSession();
  const titleOf = (id) => initiatives.find((i) => i.id === id);
  const aging = agingSummary(initiatives, slaConfig);
  const mine = pendingForRole(decisions, role);
  const allPending = decisions.filter((d) => d.status === 'pending');
  const active = initiatives.filter((i) => isActive(i.status) && i.status !== 'draft');

  // القيمة المعلقة عند كل مرحلة (الميزانية أو منتصف نطاق التكلفة)
  const byStage = {};
  for (const i of active) {
    const s = (byStage[i.status] = byStage[i.status] || { status: i.status, count: 0, value: 0 });
    s.count += 1; s.value += estimatedCost(i);
  }
  const stageRows = sortBy(Object.values(byStage), (s) => statusOrder(s.status));
  const totalPending = sum(stageRows, (s) => s.value);
  const priorities = prioritizeInitiatives(initiatives).slice(0, 5);
  const readyToTender = initiatives.filter((i) => ['designed', 'ready'].includes(i.readinessLevel) && isActive(i.status));
  const awaitingAmanah = agreements.filter((a) => a.status !== 'cancelled' && a.status !== 'signed' && !a.amanah?.approvedAt);
  const pendingReports = reports.filter((r) => r.status === 'pending');
  const pendingApps = apps.filter((a) => a.status === 'applied');

  container.innerHTML = html`
    ${raw(sectionHeader('لوحة القرار التنفيذي', 'ما ينتظر قرارك الآن، وما تجاوز مدته، والقيمة المعلقة عند كل بوابة — بصفحة واحدة',
    `<button class="mi-btn mi-btn--gold" data-act="deck">عرض للجنة (شرائح)</button>`))}

    <div class="mi-kpi-grid">
      ${raw(kpiCard('قرارات تنتظر توقيعي', String(mine.length), mine.length ? 'يمكن التوقيع من هذه اللوحة' : 'لا شيء معلق عليك', mine.length ? 'gold' : 'ok'))}
      ${raw(kpiCard('قرارات قيد السلسلة', String(allPending.length), 'بانتظار أدوار أخرى', ''))}
      ${raw(kpiCard('متجاوزة SLA البوابات', String(aging.counts.overdue), aging.counts.warn ? `${fmtNumber(aging.counts.warn)} تقترب من الحد` : '', aging.counts.overdue ? 'warn' : 'ok'))}
      ${raw(kpiCard('القيمة المعلقة في المسار', fmtMoney(totalPending), `${fmtNumber(active.length)} مبادرة نشطة`, 'primary'))}
      ${raw(kpiCard('جاهزة للطرح', String(readyToTender.length), 'تصميم متوفر أو جاهزة للتنفيذ', readyToTender.length ? 'exec' : ''))}
      ${raw(kpiCard('اتفاقيات تنتظر الأمانة', String(awaitingAmanah.length), '', awaitingAmanah.length ? 'gold' : ''))}
    </div>

    <div class="mi-dash-grid">
      <section class="mi-card mi-card--span">
        <h3>قرارات معلقة عليّ ${mine.length ? raw(`<span class="mi-tag" data-benefit="onTrack">${escapeHtml(fmtNumber(mine.length))}</span>`) : ''}</h3>
        ${mine.length ? raw(mine.map((d) => {
          const ini = titleOf(d.initiativeId); const step = nextStep(d); const p = chainProgress(d);
          return html`
            <div class="mi-exec-decision" data-decision="${d.id}">
              <div class="mi-exec-decision__main">
                <b>${ini?.title || d.initiativeId}</b>
                <small class="mi-muted">${d.id} • ${d.gateId ? 'بوابة ' + d.gateId + ' — ' : ''}الانتقال إلى «${statusLabel(d.to)}» • أنشأه ${d.by} ${fmtDate(d.at)}</small>
                <p class="mi-chain-rationale">${d.rationale}</p>
                <small>السلسلة: ${raw(d.approvals.map((a) => `<span class="mi-tag" data-benefit="${a.signedBy ? 'achieved' : ''}">${escapeHtml(roleLabel(a.role))}${a.signedBy ? ' ✔' : ''}</span>`).join(' ← '))} — ${fmtNumber(p.done)}/${fmtNumber(p.total)}</small>
              </div>
              <div class="mi-exec-decision__actions">
                <button class="mi-btn mi-btn--gold" data-sign="${d.id}">${step && step.role !== role ? 'توقيع بالنيابة' : 'توقيع واعتماد'}</button>
                <a class="mi-btn mi-btn--ghost mi-btn--sm" href="#/initiatives/${d.initiativeId}">فتح المبادرة</a>
              </div>
            </div>`;
        }).join('')) : raw('<p class="mi-muted">لا قرارات تنتظر توقيعك حاليًا ✔</p>')}
        ${allPending.length > mine.length ? raw(`<p class="mi-muted">${escapeHtml(fmtNumber(allPending.length - mine.length))} قرار آخر بانتظار أدوار أخرى في السلسلة.</p>`) : ''}
      </section>

      <section class="mi-card">
        <h3>القيمة المعلقة عند كل بوابة</h3>
        ${raw(hbarChart(stageRows.map((s) => ({ label: `${statusLabel(s.status)} (${s.count})`, value: Math.round(s.value / 1e6), max: Math.round(Math.max(...stageRows.map((x) => x.value), 1) / 1e6) })), { valueSuffix: ' م.ر' }))}
        <small class="mi-muted">بالمليون ريال — من الميزانية المسجلة أو منتصف نطاق التكلفة التقديرية</small>
      </section>

      <section class="mi-card">
        <h3>تجاوزات المدد تحتاج تصعيدًا</h3>
        ${aging.overdue.length ? raw(aging.overdue.slice(0, 6).map(({ initiative, sla }) => html`
          <div class="mi-health-row" data-id="${initiative.id}" tabindex="0" role="button">
            <div class="mi-health-row__main"><b>${initiative.title}</b><span class="mi-health-row__meta">${initiative.id} • ${statusLabel(initiative.status)}</span></div>
            ${raw(slaChip(sla))}
          </div>`).join('')) : raw('<p class="mi-muted">لا تجاوزات ✔</p>')}
      </section>

      <section class="mi-card mi-card--span">
        <h3>أعلى الأولويات للطرح <a class="mi-btn mi-btn--ghost mi-btn--sm" href="#/priorities">مصفوفة الأولويات الكاملة</a></h3>
        <div class="mi-table-wrap"><table class="mi-table">
          <thead><tr><th>#</th><th>المبادرة</th><th>المجال</th><th>الحالة</th><th>الجاهزية</th><th>التكلفة</th><th>درجة الأولوية</th></tr></thead>
          <tbody>${raw(priorities.map((p, i) => html`<tr data-id="${p.initiative.id}" class="mi-row-link">
            <td>${String(i + 1)}</td><td><b>${p.initiative.title}</b></td><td>${categoryLabel(p.initiative.category)}</td>
            <td>${raw(statusBadge(p.initiative.status))}</td><td>${p.readinessLabel}</td><td>${p.initiative.costBand ? costBandLabel(p.initiative.costBand) : fmtMoney(p.initiative.budget)}</td>
            <td><b>${fmtNumber(p.score)}</b>/100</td></tr>`).join(''))}</tbody>
        </table></div>
      </section>

      <section class="mi-card">
        <h3>طوابير العمل الأخرى</h3>
        <div class="mi-ms"><span class="mi-ms__dot" style="background:var(--mi-gold-500)"></span><span>طلبات تقديم بانتظار الفرز</span><small><a href="#/screening">${fmtNumber(pendingApps.length)}</a></small></div>
        <div class="mi-ms"><span class="mi-ms__dot" style="background:var(--mi-gold-500)"></span><span>تقارير ميدانية بانتظار الاعتماد</span><small><a href="#/execution">${fmtNumber(pendingReports.length)}</a></small></div>
        <div class="mi-ms"><span class="mi-ms__dot" style="background:var(--mi-gold-500)"></span><span>اتفاقيات تنتظر اعتماد الأمانة</span><small>${fmtNumber(awaitingAmanah.length)}</small></div>
        <div class="mi-ms"><span class="mi-ms__dot" style="background:var(--mi-green-500)"></span><span>احتياجات مطروحة للشراكة</span><small><a href="#/needs">${fmtNumber(needs.filter((n) => n.status === 'published').length)}</a></small></div>
      </section>
    </div>`;

  container.querySelectorAll('[data-sign]').forEach((btn) => btn.addEventListener('click', async () => {
    const d = decisions.find((x) => x.id === btn.dataset.sign);
    const step = nextStep(d);
    const sure = await confirmModal('توقيع قرار بوابة',
      `سيُسجَّل توقيعك باسم «${session?.name || ''}» على القرار ${d.id}${step && step.role !== role ? ` بالنيابة عن ${roleLabel(step.role)}` : ''}. عند اكتمال السلسلة تنتقل المبادرة إلى «${statusLabel(d.to)}».`,
      { confirmLabel: 'توقيع واعتماد' });
    if (!sure) return;
    try {
      const r = await signGateDecision(d.id, session);
      toastSuccess(r.transitioned ? 'اكتملت السلسلة ونُفّذ الانتقال' : 'سُجّل توقيعك — بانتظار الخطوة التالية');
      renderExecutive(container);
    } catch (err) { toastError(err.message); }
  }));
  container.querySelectorAll('.mi-health-row, .mi-row-link').forEach((row) => {
    const go = () => navigate(`initiatives/${row.dataset.id}`);
    row.addEventListener('click', go);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
  container.querySelector('[data-act="deck"]')?.addEventListener('click', () =>
    openCommitteeDeck(prioritizeInitiatives(initiatives).map((p) => p.initiative), { title: 'المبادرات المستقبلية — عرض لجنة المبادرات' }));
  if (!can(role, 'decisions.view')) container.querySelector('[data-act="deck"]')?.remove();
}
