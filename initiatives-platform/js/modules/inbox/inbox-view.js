// مهامي — كل ما ينتظر المستخدم الحالي في صفحة واحدة حسب دوره وصلاحياته،
// مع ملخص بريدي يومي (mailto) وإشعارات داخلية
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader, kpiCard, slaChip } from '../../ui/components.js';
import { statusLabel } from '../../domain/workflow.js';
import { agingSummary } from '../../domain/sla.js';
import { getSlaConfig } from '../../services/sla-service.js';
import { pendingForRole, nextStep, roleLabel } from '../../domain/approval-chain.js';
import { signGateDecision } from '../../services/decision-service.js';
import { getNotifications } from '../../services/notification-service.js';
import { fmtNumber } from '../../core/utils.js';
import { fmtDate, fmtDateTime, todayYmd } from '../../core/date-time.js';
import { getRole, getSession } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { confirmModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { navigate } from '../../router.js';

export async function renderInbox(container) {
  const role = getRole();
  const session = getSession();
  const [initiatives, decisions, slaConfig, reports, agreements, users, apps, needs, notifications] = await Promise.all([
    repos.initiatives.getAll(), repos.decisions.getAll(), getSlaConfig(),
    repos.progressReports.getAll().catch(() => []), repos.agreements.getAll().catch(() => []),
    repos.users.getAll().catch(() => []), repos.needApplications.getAll().catch(() => []),
    repos.needs.getAll(), getNotifications(10)
  ]);
  const ini = (id) => initiatives.find((i) => i.id === id);

  // بناء المهام حسب الصلاحيات
  const tasks = [];
  for (const d of pendingForRole(decisions, role)) {
    const step = nextStep(d);
    tasks.push({ group: 'قرارات تنتظر توقيعي', priority: 1, title: ini(d.initiativeId)?.title || d.initiativeId, meta: `${d.id} • ${d.gateId ? 'بوابة ' + d.gateId + ' — ' : ''}إلى «${statusLabel(d.to)}»${step && step.role !== role ? ' — بالنيابة عن ' + roleLabel(step.role) : ''}`, href: `initiatives/${d.initiativeId}`, action: { label: 'توقيع', decisionId: d.id }, at: d.at });
  }
  if (can(role, 'execution.edit')) {
    for (const r of reports.filter((x) => x.status === 'pending')) tasks.push({ group: 'تقارير ميدانية بانتظار الاعتماد', priority: 2, title: ini(r.initiativeId)?.title || r.initiativeId, meta: `${r.partnerName} — ${fmtNumber(r.percent)}٪ — ${fmtDateTime(r.at)}`, href: 'execution', at: r.at });
  }
  if (can(role, 'decisions.create')) {
    for (const a of agreements.filter((x) => x.status !== 'cancelled' && x.status !== 'signed' && !x.amanah?.approvedAt)) tasks.push({ group: 'اتفاقيات تنتظر اعتماد الأمانة', priority: 2, title: a.initiativeTitle, meta: `${a.id} — صدرت ${fmtDate(a.issuedAt)}`, href: `initiatives/${a.initiativeId}`, at: a.issuedAt });
    const byNeed = {};
    for (const a of apps.filter((x) => x.status === 'applied')) (byNeed[a.needId] = byNeed[a.needId] || []).push(a);
    for (const [needId, list] of Object.entries(byNeed)) { const n = needs.find((x) => x.id === needId); if (n?.status === 'published') tasks.push({ group: 'طلبات بانتظار الفرز', priority: 3, title: n.title, meta: `${fmtNumber(list.length)} متقدم${list.length > 1 ? ' — مفاضلة' : ''}`, href: `screening/${needId}`, at: list[0].at }); }
  }
  if (can(role, 'initiatives.transition') || can(role, 'decisions.create')) {
    const aging = agingSummary(initiatives, slaConfig);
    for (const { initiative, sla } of aging.overdue) tasks.push({ group: 'تجاوزات مدد البوابات', priority: 2, title: initiative.title, meta: `${initiative.id} • ${statusLabel(initiative.status)}`, href: `initiatives/${initiative.id}`, sla, at: sla.enteredAt });
  }
  if (can(role, 'users.manage')) {
    for (const u of users.filter((x) => x.approvalStatus === 'pending')) tasks.push({ group: 'حسابات شركاء بانتظار الاعتماد', priority: 3, title: u.name, meta: `${u.username} — ${u.email || ''}`, href: 'users', at: u.createdAt });
  }
  if (can(role, 'initiatives.transition')) {
    for (const i of initiatives.filter((x) => x.status === 'submitted' && !decisions.some((d) => d.initiativeId === x.id && d.status === 'pending'))) tasks.push({ group: 'مبادرات مقدَّمة تنتظر بدء المراجعة', priority: 4, title: i.title, meta: `${i.id} — ${i.submitterEntity || ''}`, href: `initiatives/${i.id}`, at: i.updatedAt });
  }
  tasks.sort((a, b) => a.priority - b.priority || String(a.at).localeCompare(String(b.at)));
  const groups = [...new Set(tasks.map((t) => t.group))];

  container.innerHTML = html`
    ${raw(sectionHeader('مهامي', `كل ما ينتظر «${session?.name || ''}» (${roleLabel(role)}) في صفحة واحدة — مرتب بالأولوية`,
    '<button class="mi-btn mi-btn--ghost" data-act="digest">ملخص يومي بالبريد</button>'))}
    <div class="mi-kpi-grid">
      ${raw(kpiCard('إجمالي المهام', String(tasks.length), tasks.length ? 'مرتبة بالأولوية' : 'لا مهام معلقة', tasks.length ? 'gold' : 'ok'))}
      ${raw(groups.slice(0, 4).map((g) => kpiCard(g, String(tasks.filter((t) => t.group === g).length), '', '')).join(''))}
    </div>
    ${groups.length ? raw(groups.map((g) => html`
      <section class="mi-card mi-inbox-group">
        <h3>${g} <span class="mi-tag">${fmtNumber(tasks.filter((t) => t.group === g).length)}</span></h3>
        ${raw(tasks.filter((t) => t.group === g).map((t) => html`
          <div class="mi-inbox-task" data-href="${t.href}">
            <div class="mi-inbox-task__main"><b>${t.title}</b><small class="mi-muted">${t.meta}</small></div>
            <div class="mi-inbox-task__side">
              ${t.sla ? raw(slaChip(t.sla)) : ''}
              ${t.action ? raw(`<button class="mi-btn mi-btn--gold mi-btn--sm" data-sign="${escapeHtml(t.action.decisionId)}">${escapeHtml(t.action.label)}</button>`) : ''}
              <a class="mi-btn mi-btn--ghost mi-btn--sm" href="#/${t.href}">فتح</a>
            </div>
          </div>`).join(''))}
      </section>`).join('')) : raw('<div class="mi-card mi-empty"><div class="mi-empty__mark">◈</div><h3>لا مهام معلقة عليك</h3><p class="mi-muted">كل ما يخص دورك مكتمل حاليًا.</p></div>')}
    <section class="mi-card">
      <h3>آخر الإشعارات</h3>
      ${notifications.length ? raw(notifications.map((n) => html`<div class="mi-ms" data-done="${n.read ? 'yes' : 'no'}"><span class="mi-ms__dot"></span><span><b>${n.title}</b>${n.body ? raw(' — ' + escapeHtml(n.body)) : ''}</span><small>${fmtDateTime(n.at)}</small></div>`).join('')) : raw('<p class="mi-muted">لا إشعارات</p>')}
    </section>`;

  container.querySelectorAll('[data-sign]').forEach((btn) => btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const sure = await confirmModal('توقيع قرار بوابة', `سيُسجَّل توقيعك باسم «${session?.name || ''}». متابعة؟`, { confirmLabel: 'توقيع' });
    if (!sure) return;
    try {
      const r = await signGateDecision(btn.dataset.sign, session);
      toastSuccess(r.transitioned ? 'اكتملت السلسلة ونُفّذ الانتقال' : 'سُجّل توقيعك');
      renderInbox(container);
    } catch (err) { toastError(err.message); }
  }));
  container.querySelectorAll('.mi-inbox-task').forEach((row) => row.addEventListener('click', (e) => {
    if (e.target.closest('button, a')) return;
    navigate(row.dataset.href);
  }));
  // ملخص بريدي: يفتح عميل البريد برسالة جاهزة (لا خادم بريد في الوضع المحلي)
  container.querySelector('[data-act="digest"]')?.addEventListener('click', () => {
    const lines = [`ملخص مهام منصة المبادرات — ${todayYmd()}`, `المستخدم: ${session?.name || ''} (${roleLabel(role)})`, ''];
    for (const g of groups) {
      lines.push(`■ ${g} (${tasks.filter((t) => t.group === g).length})`);
      for (const t of tasks.filter((x) => x.group === g)) lines.push(`  - ${t.title} — ${t.meta}`);
      lines.push('');
    }
    if (!groups.length) lines.push('لا مهام معلقة.');
    lines.push(`الرابط: ${location.origin}${location.pathname}#/inbox`);
    const href = `mailto:${encodeURIComponent(session?.email || '')}?subject=${encodeURIComponent('ملخص مهامي — منصة المبادرات')}&body=${encodeURIComponent(lines.join('\n'))}`;
    window.location.href = href;
  });
}
