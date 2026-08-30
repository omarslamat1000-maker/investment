// مراجعات اللجنة — توصيات الأعضاء عند البوابات
import { repos } from '../../data/repositories.js';
import { html, raw } from '../../core/sanitizer.js';
import { sectionHeader } from '../../ui/components.js';
import { renderTable } from '../../ui/table.js';
import { fmtDate } from '../../core/date-time.js';
import { getRole, getUserName } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { GATES } from '../../core/constants.js';
import { openModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { isActive } from '../../domain/workflow.js';

export async function renderReviews(container) {
  const [reviews, initiatives] = await Promise.all([repos.reviews.getAll(), repos.initiatives.getAll()]);
  const role = getRole();
  const titleOf = (id) => initiatives.find((i) => i.id === id)?.title || id;

  container.innerHTML = html`
    ${raw(sectionHeader('مراجعات اللجنة', 'توصيات أعضاء لجنة المبادرات عند كل بوابة مرحلية',
    can(role, 'reviews.create') ? '<button class="mi-btn mi-btn--primary" data-act="new">تسجيل توصية</button>' : ''))}
    <div class="mi-table-host"></div>`;

  renderTable(container.querySelector('.mi-table-host'), reviews, [
    { key: 'at', label: 'التاريخ', map: (r) => fmtDate(r.at), sortValue: (r) => r.at },
    { key: 'initiativeId', label: 'المبادرة', map: (r) => titleOf(r.initiativeId) },
    { key: 'gateId', label: 'البوابة' },
    { key: 'reviewer', label: 'المراجع' },
    { key: 'recommendation', label: 'التوصية' },
    { key: 'notes', label: 'الملاحظات' }
  ], { searchable: true, initialSort: 'at', emptyText: 'لا توجد مراجعات مسجلة' });

  container.querySelector('[data-act="new"]')?.addEventListener('click', () => {
    const candidates = initiatives.filter((i) => isActive(i.status) && !['draft'].includes(i.status));
    const { dialog, close } = openModal({
      title: 'تسجيل توصية مراجعة',
      bodyHtml: html`
        <form class="mi-form" id="mi-review-form">
          <div class="mi-form-field"><label>المبادرة</label>
            <select class="mi-input" name="initiativeId">${raw(candidates.map((i) => `<option value="${i.id}">${i.title}</option>`).join(''))}</select></div>
          <div class="mi-form-field"><label>البوابة</label>
            <select class="mi-input" name="gateId">${raw(GATES.map((g) => `<option value="${g.id}">${g.id} — ${g.name}</option>`).join(''))}</select></div>
          <div class="mi-form-field"><label>التوصية</label>
            <select class="mi-input" name="recommendation">
              <option>المضي للمرحلة التالية</option>
              <option>استكمال المتطلبات</option>
              <option>الاعتذار عن المبادرة</option>
              <option>التعليق المؤقت</option>
            </select></div>
          <div class="mi-form-field"><label>الملاحظات</label><textarea class="mi-input" name="notes" rows="3"></textarea></div>
        </form>`,
      footerHtml: html`
        <button class="mi-btn mi-btn--ghost" data-act="cancel">إلغاء</button>
        <button class="mi-btn mi-btn--primary" data-act="save">تسجيل</button>`
    });
    dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
    dialog.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const form = dialog.querySelector('#mi-review-form');
      if (!form.initiativeId.value) { toastError('اختر المبادرة'); return; }
      await repos.reviews.create({
        initiativeId: form.initiativeId.value,
        gateId: form.gateId.value,
        reviewer: getUserName(),
        recommendation: form.recommendation.value,
        notes: form.notes.value.trim(),
        at: new Date().toISOString()
      });
      close();
      toastSuccess('سُجّلت التوصية');
      renderReviews(container);
    });
  });
}
