// محافظ المبادرات — تجميع أكثر من مبادرة (وحملات موسمية) تحت هدف واحد
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader, statusBadge, emptyState, progressBar } from '../../ui/components.js';
import { statusLabel, statusOrder, isActive } from '../../domain/workflow.js';
import { categoryLabel } from '../../domain/initiative-model.js';
import { fmtMoney, fmtNumber, sum, sortBy, percent } from '../../core/utils.js';
import { getRole } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { openModal, confirmModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { navigate } from '../../router.js';
import { uid } from '../../core/utils.js';

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
    ${raw(sectionHeader('محافظ المبادرات', 'تجميع المبادرات والحملات الموسمية تحت هدف واحد قابل للمتابعة',
    manage ? '<button class="mi-btn mi-btn--primary" data-act="new">محفظة جديدة</button>' : ''))}
    <div class="mi-portfolio-list"></div>`;

  const list = container.querySelector('.mi-portfolio-list');
  if (!portfolios.length) {
    list.innerHTML = emptyState('لا محافظ بعد', 'أنشئ محفظة لتجميع المبادرات ذات الهدف المشترك',
      manage ? '<button class="mi-btn mi-btn--primary" data-act="new-empty">إنشاء محفظة</button>' : '');
    list.querySelector('[data-act="new-empty"]')?.addEventListener('click', () => openPortfolioModal(null));
  } else {
    list.innerHTML = sortBy(portfolios, (p) => p.createdAt).map((p) => {
      const members = initiatives.filter((i) => i.portfolioId === p.id);
      const memberCampaigns = campaigns.filter((c) => c.portfolioId === p.id);
      const closed = members.filter((i) => i.status === 'closed').length;
      const running = members.filter((i) => i.status === 'execution').length;
      const value = sum(members.filter((i) => i.status !== 'rejected'), (i) => i.budget);
      const donePct = members.length ? percent(closed, members.length) : 0;
      const memberRows = sortBy(members, (i) => statusOrder(i.status)).map((i) => html`
        <div class="mi-portfolio-member" data-id="${i.id}" tabindex="0" role="button" aria-label="فتح ${i.title}">
          <span class="mi-portfolio-member__title">${i.title}</span>
          <small class="mi-muted">${categoryLabel(i.category)} • ${i.district}</small>
          ${raw(statusBadge(i.status))}
          ${manage ? raw(`<button class="mi-btn mi-btn--ghost mi-btn--sm" data-unlink="${escapeHtml(i.id)}" title="إخراج من المحفظة">✕</button>`) : ''}
        </div>`).join('');

      return html`
        <section class="mi-card mi-portfolio-card" data-portfolio="${p.id}">
          <header class="mi-portfolio-card__head">
            <div>
              <h3>${p.title}</h3>
              <p class="mi-portfolio-goal">${p.goal || ''}</p>
            </div>
            <div class="mi-portfolio-card__stats">
              <span><b>${fmtNumber(members.length)}</b> مبادرة</span>
              <span><b>${fmtNumber(running)}</b> قيد التنفيذ</span>
              <span><b>${fmtNumber(closed)}</b> مغلقة</span>
              <span><b>${fmtMoney(value)}</b></span>
            </div>
          </header>
          ${members.length ? raw(progressBar(donePct, `نسبة الإقفال في ${p.title}`)) : ''}
          ${memberCampaigns.length ? raw(`<div class="mi-portfolio-campaigns">حملات موسمية تابعة: ${memberCampaigns.map((c) => `<span class="mi-tag mi-tag--gold">${escapeHtml(c.title)}</span>`).join(' ')}</div>`) : ''}
          <div class="mi-portfolio-members">${raw(memberRows || '<p class="mi-muted">لا مبادرات في المحفظة بعد</p>')}</div>
          ${manage ? raw(`
            <div class="mi-portfolio-actions">
              <button class="mi-btn mi-btn--ghost mi-btn--sm" data-add="${escapeHtml(p.id)}">إضافة مبادرات</button>
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
      await repos.initiatives.update(btn.dataset.unlink, { portfolioId: null });
      toastSuccess('أُخرجت المبادرة من المحفظة');
      renderPortfolios(container);
    });
  });

  list.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openPortfolioModal(portfolios.find((p) => p.id === btn.dataset.edit)));
  });

  list.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const p = portfolios.find((x) => x.id === btn.dataset.remove);
      const members = initiatives.filter((i) => i.portfolioId === p.id);
      const sure = await confirmModal('حذف المحفظة',
        `ستُحذف محفظة «${p.title}» وتبقى مبادراتها (${members.length}) دون محفظة. متابعة؟`,
        { confirmLabel: 'حذف', danger: true });
      if (!sure) return;
      for (const i of members) await repos.initiatives.update(i.id, { portfolioId: null });
      const linked = campaigns.filter((c) => c.portfolioId === p.id);
      for (const c of linked) await repos.campaigns.update(c.id, { portfolioId: null });
      await repos.portfolios.remove(p.id);
      toastSuccess('حُذفت المحفظة');
      renderPortfolios(container);
    });
  });

  list.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = portfolios.find((x) => x.id === btn.dataset.add);
      const candidates = initiatives.filter((i) => !i.portfolioId && i.status !== 'rejected');
      if (!candidates.length) { toastError('لا مبادرات متاحة خارج المحافظ'); return; }
      const { dialog, close } = openModal({
        title: `إضافة مبادرات إلى: ${p.title}`,
        bodyHtml: html`
          <div class="mi-checklist">
            ${raw(candidates.map((i) => `
              <label class="mi-check-item">
                <input type="checkbox" value="${escapeHtml(i.id)}">
                <span>${escapeHtml(i.title)} <small class="mi-muted">(${escapeHtml(statusLabel(i.status))})</small></span>
              </label>`).join(''))}
          </div>`,
        footerHtml: html`
          <button class="mi-btn mi-btn--ghost" data-act="cancel">إلغاء</button>
          <button class="mi-btn mi-btn--primary" data-act="save">إضافة المحدد</button>`
      });
      dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
      dialog.querySelector('[data-act="save"]').addEventListener('click', async () => {
        const ids = [...dialog.querySelectorAll('input:checked')].map((c) => c.value);
        if (!ids.length) { toastError('حدد مبادرة واحدة على الأقل'); return; }
        for (const id of ids) await repos.initiatives.update(id, { portfolioId: p.id });
        close();
        toastSuccess(`أُضيفت ${fmtNumber(ids.length)} مبادرة إلى المحفظة`);
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
            <input class="mi-input" name="goal" value="${p.goal}" placeholder="الهدف الواحد الذي تجتمع تحته المبادرات"></div>
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
}
