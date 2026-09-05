// متابعة التنفيذ — معالم المبادرات قيد التنفيذ وتحديث الإنجاز والمنصرف
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader, statusBadge, progressBar, emptyState } from '../../ui/components.js';
import { fmtDate, isOverdue } from '../../core/date-time.js';
import { fmtMoney, percent, sortBy } from '../../core/utils.js';
import { getRole } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { toastSuccess } from '../../ui/toast.js';
import { navigate } from '../../router.js';
import { progressReportsHtml, bindProgressReportActions } from './progress-reports-panel.js';
import { fmtNumber } from '../../core/utils.js';

export async function renderExecution(container) {
  const [initiatives, milestones, allReports] = await Promise.all([
    repos.initiatives.getAll(), repos.milestones.getAll(), repos.progressReports.getAll().catch(() => [])
  ]);
  const role = getRole();
  const editable = can(role, 'execution.edit');
  const running = initiatives.filter((i) => ['execution', 'benefits'].includes(i.status));
  const pending = sortBy(allReports.filter((r) => r.status === 'pending'), (r) => r.at, 'desc');

  container.innerHTML = html`
    ${raw(sectionHeader('متابعة التنفيذ', 'معالم الإنجاز والمنصرف للمبادرات الجارية، واعتماد تقارير الشركاء الميدانية'))}
    <section class="mi-card mi-field-queue" data-field-queue>
      <h3>تقارير ميدانية بانتظار الاعتماد ${pending.length ? raw(`<span class="mi-tag" data-benefit="onTrack">${escapeHtml(fmtNumber(pending.length))}</span>`) : ''}</h3>
      ${pending.length
        ? raw(progressReportsHtml(pending, { milestones, initiatives, canReview: editable, showInitiative: true }))
        : raw('<p class="mi-muted">لا تقارير معلقة — ما يرفعه الشركاء من بوابتهم يظهر هنا للاعتماد قبل نشره</p>')}
    </section>
    <div class="mi-exec-list"></div>`;

  bindProgressReportActions(container.querySelector('[data-field-queue]'), () => renderExecution(container));

  const list = container.querySelector('.mi-exec-list');
  if (!running.length) {
    list.innerHTML = emptyState('لا مبادرات قيد التنفيذ', 'تظهر هنا المبادرات بعد اجتياز بوابة جاهزية التنفيذ');
    return;
  }

  list.innerHTML = running.map((ini) => {
    const ms = sortBy(milestones.filter((m) => m.initiativeId === ini.id), (m) => m.due);
    const done = ms.filter((m) => m.done).length;
    const p = percent(done, ms.length);
    return html`
      <section class="mi-card mi-exec-card" data-id="${ini.id}">
        <header class="mi-exec-card__head">
          <div>
            <h3><a href="#/initiatives/${ini.id}">${ini.title}</a></h3>
            <small class="mi-muted">${ini.id}${ini.location ? raw(' • ' + escapeHtml(ini.location)) : ''} • الميزانية ${fmtMoney(ini.budget)} — المنصرف ${fmtMoney(ini.spent)}</small>
          </div>
          ${raw(statusBadge(ini.status))}
        </header>
        ${ms.length ? raw(progressBar(p, `إنجاز ${ini.title}`)) : ''}
        ${ini.progressPercentage ? raw(`<small class="mi-muted">الإنجاز المعلن من التقارير الميدانية المعتمدة: <b>${escapeHtml(fmtNumber(ini.progressPercentage))}٪</b>${ini.lastFieldUpdateAt ? ' — آخر تحديث ' + escapeHtml(fmtDate(ini.lastFieldUpdateAt)) : ''}</small>`) : ''}
        <div class="mi-ms-list">
          ${ms.length ? raw(ms.map((m) => html`
            <label class="mi-ms" data-done="${m.done ? 'yes' : 'no'}" data-overdue="${isOverdue(m.due, m.doneAt) ? 'yes' : 'no'}">
              <input type="checkbox" data-ms="${m.id}" ${m.done ? raw('checked') : ''} ${editable ? '' : raw('disabled')}>
              <span>${m.title}</span>
              <small>${fmtDate(m.due)}${isOverdue(m.due, m.doneAt) ? ' — متأخر' : ''}</small>
            </label>`).join('')) : raw('<p class="mi-muted">لا معالم معتمدة لهذه المبادرة</p>')}
        </div>
        ${editable ? raw(`<div class="mi-exec-tools">
          <label>تحديث المنصرف (ريال): <input type="number" min="0" class="mi-input mi-input--sm" data-spent value="${Number(ini.spent) || 0}"></label>
          <button class="mi-btn mi-btn--ghost" data-save-spent>حفظ</button>
        </div>`) : ''}
      </section>`;
  }).join('');

  list.querySelectorAll('input[data-ms]').forEach((cb) => {
    cb.addEventListener('change', async () => {
      await repos.milestones.update(cb.dataset.ms, {
        done: cb.checked,
        doneAt: cb.checked ? new Date().toISOString() : null
      });
      toastSuccess(cb.checked ? 'سُجّل إنجاز المَعلم' : 'أُلغي إنجاز المَعلم');
      renderExecution(container);
    });
  });

  list.querySelectorAll('[data-save-spent]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.mi-exec-card');
      const value = Number(card.querySelector('[data-spent]').value) || 0;
      await repos.initiatives.update(card.dataset.id, { spent: value });
      toastSuccess('حُدّث المنصرف');
      renderExecution(container);
    });
  });

  list.querySelectorAll('a[href^="#/initiatives/"]').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); navigate(a.getAttribute('href').slice(2)); });
  });
}
