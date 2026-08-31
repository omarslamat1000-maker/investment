// محافظ المبادرات — تدرج هرمي: محفظة ← حملات موسمية (كل حملة تضم مبادرات) ← مبادرات مباشرة
// وكل مبادرة بدورها تضم موقعًا أو أكثر (تُدار من صفحة المبادرة)
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader, statusBadge, emptyState, progressBar } from '../../ui/components.js';
import { statusLabel, statusOrder } from '../../domain/workflow.js';
import { categoryLabel, getSites } from '../../domain/initiative-model.js';
import { fmtMoney, fmtNumber, sum, sortBy, percent, uid } from '../../core/utils.js';
import { fmtDate } from '../../core/date-time.js';
import { getRole } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { openModal, confirmModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { navigate } from '../../router.js';

export async function renderPortfolios(container) {
  const role = getRole();
  if (!can(role, 'portfolios.view')) {
    container.innerHTML = emptyState('لا تملك صلاحية الوصول', 'شاشة المحافظ تتطلب صلاحية عرض المحافظ');
    return;
  }
  const [portfolios, initiatives, campaigns] = await Promise.all([
    repos.portfolios.getAll(), repos.initiatives.getAll(), repos.campaigns.getAll()
  ]);
  const manage = can(role, 'portfolios.manage');

  container.innerHTML = html`
    ${raw(sectionHeader('محافظ المبادرات',
    'التدرج الهرمي: المحفظة تضم حملات موسمية ومبادرات، والحملة تضم أكثر من مبادرة، والمبادرة تضم أكثر من موقع',
    manage ? '<button class="mi-btn mi-btn--primary" data-act="new">محفظة جديدة</button>' : ''))}
    <div class="mi-portfolio-list"></div>`;

  const list = container.querySelector('.mi-portfolio-list');

  // صف مبادرة داخل الشجرة
  const memberRow = (i, depth) => html`
    <div class="mi-portfolio-member" data-id="${i.id}" data-depth="${String(depth)}" tabindex="0" role="button" aria-label="فتح ${i.title}">
      <span class="mi-tree-branch" aria-hidden="true">${depth === 2 ? '└' : '◈'}</span>
      <span class="mi-portfolio-member__title">${i.title}</span>
      <small class="mi-muted">${categoryLabel(i.category)}${getSites(i).length ? raw(` • ${escapeHtml(fmtNumber(getSites(i).length))} ${getSites(i).length === 1 ? 'موقع' : 'مواقع'}`) : ''}</small>
      ${raw(statusBadge(i.status))}
      ${manage ? raw(`<button class="mi-btn mi-btn--ghost mi-btn--sm" data-unlink="${escapeHtml(i.id)}" title="إخراج من المحفظة/الحملة">✕</button>`) : ''}
    </div>`;

  if (!portfolios.length) {
    list.innerHTML = emptyState('لا محافظ بعد', 'أنشئ محفظة لتجميع الحملات والمبادرات ذات الهدف المشترك',
      manage ? '<button class="mi-btn mi-btn--primary" data-act="new-empty">إنشاء محفظة</button>' : '');
    list.querySelector('[data-act="new-empty"]')?.addEventListener('click', () => openPortfolioModal(null));
  } else {
    list.innerHTML = sortBy(portfolios, (p) => p.createdAt).map((p) => {
      const members = initiatives.filter((i) => i.portfolioId === p.id);
      const pCampaigns = campaigns.filter((c) => c.portfolioId === p.id);
      const direct = sortBy(members.filter((i) => !i.campaignId), (i) => statusOrder(i.status));
      const closed = members.filter((i) => i.status === 'closed').length;
      const running = members.filter((i) => i.status === 'execution').length;
      const value = sum(members.filter((i) => i.status !== 'rejected'), (i) => i.budget);
      const donePct = members.length ? percent(closed, members.length) : 0;

      const campaignBlocks = pCampaigns.map((c) => {
        const cMembers = sortBy(members.filter((i) => i.campaignId === c.id), (i) => statusOrder(i.status));
        return html`
          <details class="mi-campaign-node" open>
            <summary>
              <span class="mi-campaign-node__flag" aria-hidden="true">⚑</span>
              <b>${c.title}</b>
              <span class="mi-tag mi-tag--gold">${c.status === 'active' ? 'حملة نشطة' : 'حملة منتهية'}</span>
              <small class="mi-muted">${fmtNumber(cMembers.length)} مبادرة${c.startDate ? raw(` • ${escapeHtml(fmtDate(c.startDate))} ← ${escapeHtml(fmtDate(c.endDate))}`) : ''}</small>
              ${manage ? raw(`<span class="mi-campaign-node__tools">
                <button class="mi-btn mi-btn--ghost mi-btn--sm" data-edit-campaign="${escapeHtml(c.id)}">تعديل</button>
                <button class="mi-btn mi-btn--ghost mi-btn--sm" data-del-campaign="${escapeHtml(c.id)}">حذف</button>
              </span>`) : ''}
            </summary>
            ${cMembers.length ? raw(cMembers.map((i) => memberRow(i, 2)).join('')) : raw('<p class="mi-muted mi-tree-empty">لا مبادرات في الحملة بعد — أضفها من زر «إضافة مبادرات»</p>')}
          </details>`;
      }).join('');

      return html`
        <section class="mi-card mi-portfolio-card" data-portfolio="${p.id}">
          <header class="mi-portfolio-card__head">
            <div>
              <h3>${p.title}</h3>
              <p class="mi-portfolio-goal">${p.goal || ''}</p>
            </div>
            <div class="mi-portfolio-card__stats">
              <span><b>${fmtNumber(pCampaigns.length)}</b> حملة</span>
              <span><b>${fmtNumber(members.length)}</b> مبادرة</span>
              <span><b>${fmtNumber(running)}</b> قيد التنفيذ</span>
              <span><b>${fmtNumber(closed)}</b> مغلقة</span>
              <span><b>${fmtMoney(value)}</b></span>
            </div>
          </header>
          ${members.length ? raw(progressBar(donePct, `نسبة الإقفال في ${p.title}`)) : ''}

          <div class="mi-portfolio-tree">
            ${raw(campaignBlocks)}
            <details class="mi-campaign-node mi-campaign-node--direct" ${direct.length ? raw('open') : ''}>
              <summary>
                <span class="mi-campaign-node__flag" aria-hidden="true">▤</span>
                <b>مبادرات مباشرة في المحفظة</b>
                <small class="mi-muted">${fmtNumber(direct.length)} مبادرة خارج الحملات</small>
              </summary>
              ${direct.length ? raw(direct.map((i) => memberRow(i, 2)).join('')) : raw('<p class="mi-muted mi-tree-empty">لا مبادرات مباشرة</p>')}
            </details>
          </div>

          ${manage ? raw(`
            <div class="mi-portfolio-actions">
              <button class="mi-btn mi-btn--primary mi-btn--sm" data-add="${escapeHtml(p.id)}">إضافة مبادرات</button>
              <button class="mi-btn mi-btn--ghost mi-btn--sm" data-new-campaign="${escapeHtml(p.id)}">حملة جديدة</button>
              <button class="mi-btn mi-btn--ghost mi-btn--sm" data-edit="${escapeHtml(p.id)}">تعديل المحفظة</button>
              <button class="mi-btn mi-btn--ghost mi-btn--sm" data-remove="${escapeHtml(p.id)}">حذف</button>
            </div>`) : ''}
        </section>`;
    }).join('');
  }

  container.querySelector('[data-act="new"]')?.addEventListener('click', () => openPortfolioModal(null));

  list.querySelectorAll('.mi-portfolio-member').forEach((row) => {
    const go = () => navigate(`initiatives/${row.dataset.id}`);
    row.addEventListener('click', (e) => { if (!e.target.closest('[data-unlink]')) go(); });
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });

  list.querySelectorAll('[data-unlink]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await repos.initiatives.update(btn.dataset.unlink, { portfolioId: null, campaignId: null });
      toastSuccess('أُخرجت المبادرة من المحفظة');
      renderPortfolios(container);
    });
  });

  list.querySelectorAll('[data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => openPortfolioModal(portfolios.find((p) => p.id === btn.dataset.edit))));

  list.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const p = portfolios.find((x) => x.id === btn.dataset.remove);
      const members = initiatives.filter((i) => i.portfolioId === p.id);
      const pCampaigns = campaigns.filter((c) => c.portfolioId === p.id);
      const sure = await confirmModal('حذف المحفظة',
        `ستُحذف محفظة «${p.title}» وتبقى مبادراتها (${members.length}) وحملاتها (${pCampaigns.length}) دون محفظة. متابعة؟`,
        { confirmLabel: 'حذف', danger: true });
      if (!sure) return;
      for (const i of members) await repos.initiatives.update(i.id, { portfolioId: null, campaignId: null });
      for (const c of pCampaigns) await repos.campaigns.update(c.id, { portfolioId: null });
      await repos.portfolios.remove(p.id);
      toastSuccess('حُذفت المحفظة');
      renderPortfolios(container);
    });
  });

  // إدارة الحملات
  list.querySelectorAll('[data-new-campaign]').forEach((btn) =>
    btn.addEventListener('click', (e) => { e.preventDefault(); openCampaignModal(null, btn.dataset.newCampaign); }));
  list.querySelectorAll('[data-edit-campaign]').forEach((btn) =>
    btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); const c = campaigns.find((x) => x.id === btn.dataset.editCampaign); openCampaignModal(c, c.portfolioId); }));
  list.querySelectorAll('[data-del-campaign]').forEach((btn) =>
    btn.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation();
      const c = campaigns.find((x) => x.id === btn.dataset.delCampaign);
      const cMembers = initiatives.filter((i) => i.campaignId === c.id);
      const sure = await confirmModal('حذف الحملة',
        `ستُحذف حملة «${c.title}» وتبقى مبادراتها (${cMembers.length}) داخل المحفظة كمبادرات مباشرة. متابعة؟`,
        { confirmLabel: 'حذف', danger: true });
      if (!sure) return;
      for (const i of cMembers) await repos.initiatives.update(i.id, { campaignId: null });
      await repos.campaigns.remove(c.id);
      toastSuccess('حُذفت الحملة');
      renderPortfolios(container);
    }));

  // إضافة مبادرات إلى المحفظة مباشرة أو إلى حملة داخلها
  list.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = portfolios.find((x) => x.id === btn.dataset.add);
      const pCampaigns = campaigns.filter((c) => c.portfolioId === p.id);
      const candidates = initiatives.filter((i) => i.status !== 'rejected' && (!i.portfolioId || (i.portfolioId === p.id && !i.campaignId)));
      if (!candidates.length) { toastError('لا مبادرات متاحة للإضافة'); return; }
      const { dialog, close } = openModal({
        title: `إضافة مبادرات إلى: ${p.title}`,
        bodyHtml: html`
          <div class="mi-form-field">
            <label>الوجهة داخل المحفظة</label>
            <select class="mi-input" id="mi-add-dest">
              <option value="">المحفظة مباشرة (خارج الحملات)</option>
              ${raw(pCampaigns.map((c) => `<option value="${escapeHtml(c.id)}">حملة: ${escapeHtml(c.title)}</option>`).join(''))}
            </select>
          </div>
          <div class="mi-checklist">
            ${raw(candidates.map((i) => `
              <label class="mi-check-item">
                <input type="checkbox" value="${escapeHtml(i.id)}">
                <span>${escapeHtml(i.title)} <small class="mi-muted">(${escapeHtml(statusLabel(i.status))}${i.portfolioId === p.id ? ' — في المحفظة حاليًا' : ''})</small></span>
              </label>`).join(''))}
          </div>`,
        footerHtml: html`
          <button class="mi-btn mi-btn--ghost" data-act="cancel">إلغاء</button>
          <button class="mi-btn mi-btn--primary" data-act="save">إضافة المحدد</button>`
      });
      dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
      dialog.querySelector('[data-act="save"]').addEventListener('click', async () => {
        const ids = [...dialog.querySelectorAll('.mi-checklist input:checked')].map((c) => c.value);
        if (!ids.length) { toastError('حدد مبادرة واحدة على الأقل'); return; }
        const campaignId = dialog.querySelector('#mi-add-dest').value || null;
        for (const id of ids) await repos.initiatives.update(id, { portfolioId: p.id, campaignId });
        close();
        toastSuccess(`أُضيفت ${fmtNumber(ids.length)} مبادرة ${campaignId ? 'إلى الحملة' : 'إلى المحفظة'}`);
        renderPortfolios(container);
      });
    });
  });

  function openPortfolioModal(existing) {
    const p = existing || { id: uid('pf'), title: '', goal: '', description: '' };
    const { dialog, close } = openModal({
      title: existing ? 'تعديل المحفظة' : 'محفظة جديدة',
      bodyHtml: html`
        <form class="mi-form" id="mi-pf-form">
          <div class="mi-form-field"><label>اسم المحفظة</label>
            <input class="mi-input" name="title" value="${p.title}" placeholder="مثال: محفظة المبادرات المقترحة لأمانة منطقة المدينة المنورة"></div>
          <div class="mi-form-field"><label>الهدف الجامع</label>
            <input class="mi-input" name="goal" value="${p.goal}" placeholder="الهدف الواحد الذي تجتمع تحته الحملات والمبادرات"></div>
          <div class="mi-form-field"><label>الوصف</label>
            <textarea class="mi-input" name="description" rows="3">${p.description}</textarea></div>
        </form>`,
      footerHtml: html`
        <button class="mi-btn mi-btn--ghost" data-act="cancel">إلغاء</button>
        <button class="mi-btn mi-btn--primary" data-act="save">حفظ</button>`
    });
    dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
    dialog.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const form = dialog.querySelector('#mi-pf-form');
      const title = form.title.value.trim();
      if (title.length < 8) { toastError('اسم المحفظة مطلوب (8 أحرف على الأقل)'); return; }
      const record = { ...p, title, goal: form.goal.value.trim(), description: form.description.value.trim() };
      if (existing) await repos.portfolios.update(p.id, record);
      else await repos.portfolios.create(record);
      close();
      toastSuccess('حُفظت المحفظة');
      renderPortfolios(container);
    });
  }

  function openCampaignModal(existing, portfolioId) {
    const c = existing || {
      id: uid('cmp'), title: '', summary: '', startDate: '', endDate: '',
      targetInitiatives: null, categoryFocus: [], status: 'active', portfolioId
    };
    const { dialog, close } = openModal({
      title: existing ? 'تعديل الحملة' : 'حملة موسمية جديدة',
      bodyHtml: html`
        <form class="mi-form" id="mi-cmp-form">
          <div class="mi-form-field"><label>اسم الحملة</label>
            <input class="mi-input" name="title" value="${c.title}" placeholder="مثال: حملة «المدينة تُزهر» للتشجير المجتمعي"></div>
          <div class="mi-form-field"><label>الوصف</label>
            <textarea class="mi-input" name="summary" rows="2">${c.summary || ''}</textarea></div>
          <div class="mi-form-row">
            <div class="mi-form-field"><label>تاريخ البداية</label>
              <input class="mi-input" name="startDate" type="date" value="${c.startDate || ''}"></div>
            <div class="mi-form-field"><label>تاريخ النهاية</label>
              <input class="mi-input" name="endDate" type="date" value="${c.endDate || ''}"></div>
            <div class="mi-form-field"><label>الحالة</label>
              <select class="mi-input" name="status">
                <option value="active" ${c.status === 'active' ? raw('selected') : ''}>نشطة</option>
                <option value="done" ${c.status === 'done' ? raw('selected') : ''}>منتهية</option>
              </select></div>
          </div>
        </form>`,
      footerHtml: html`
        <button class="mi-btn mi-btn--ghost" data-act="cancel">إلغاء</button>
        <button class="mi-btn mi-btn--primary" data-act="save">حفظ الحملة</button>`
    });
    dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
    dialog.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const form = dialog.querySelector('#mi-cmp-form');
      const title = form.title.value.trim();
      if (title.length < 8) { toastError('اسم الحملة مطلوب (8 أحرف على الأقل)'); return; }
      const record = {
        ...c, title,
        summary: form.summary.value.trim(),
        startDate: form.startDate.value || null,
        endDate: form.endDate.value || null,
        status: form.status.value,
        portfolioId
      };
      if (existing) await repos.campaigns.update(c.id, record);
      else await repos.campaigns.create(record);
      close();
      toastSuccess('حُفظت الحملة');
      renderPortfolios(container);
    });
  }
}
