// فحوص الجودة — نتائج الفحص الفني للمخرجات
import { repos } from '../../data/repositories.js';
import { html, raw } from '../../core/sanitizer.js';
import { sectionHeader } from '../../ui/components.js';
import { renderTable } from '../../ui/table.js';
import { fmtDate } from '../../core/date-time.js';
import { getRole } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { openModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';

export async function renderQuality(container) {
  const [checks, initiatives] = await Promise.all([repos.qualityChecks.getAll(), repos.initiatives.getAll()]);
  const role = getRole();
  const titleOf = (id) => initiatives.find((i) => i.id === id)?.title || id;

  container.innerHTML = html`
    ${raw(sectionHeader('فحوص الجودة', 'نتائج الفحص الفني للمخرجات قبل الاستلام',
    can(role, 'quality.edit') ? '<button class="mi-btn mi-btn--primary" data-act="new">تسجيل فحص</button>' : ''))}
    <div class="mi-table-host"></div>`;

  renderTable(container.querySelector('.mi-table-host'), checks, [
    { key: 'at', label: 'التاريخ', map: (r) => fmtDate(r.at), sortValue: (r) => r.at },
    { key: 'title', label: 'الفحص' },
    { key: 'initiativeId', label: 'المبادرة', map: (r) => titleOf(r.initiativeId) },
    { key: 'result', label: 'النتيجة', map: (r) => r.result === 'pass' ? 'مطابق' : 'غير مطابق' },
    { key: 'inspector', label: 'جهة الفحص' },
    { key: 'notes', label: 'الملاحظات' }
  ], { searchable: true, initialSort: 'at', emptyText: 'لا فحوص مسجلة' });

  container.querySelector('[data-act="new"]')?.addEventListener('click', () => {
    const candidates = initiatives.filter((i) => ['execution', 'benefits'].includes(i.status));
    const { dialog, close } = openModal({
      title: 'تسجيل فحص جودة',
      bodyHtml: html`
        <form class="mi-form" id="mi-q-form">
          <div class="mi-form-field"><label>عنوان الفحص</label><input class="mi-input" name="title"></div>
          <div class="mi-form-field"><label>المبادرة</label>
            <select class="mi-input" name="initiativeId">${raw(candidates.map((i) => `<option value="${i.id}">${i.title}</option>`).join(''))}</select></div>
          <div class="mi-form-row">
            <div class="mi-form-field"><label>النتيجة</label>
              <select class="mi-input" name="result"><option value="pass">مطابق</option><option value="fail">غير مطابق</option></select></div>
            <div class="mi-form-field"><label>جهة الفحص</label><input class="mi-input" name="inspector"></div>
          </div>
          <div class="mi-form-field"><label>الملاحظات</label><textarea class="mi-input" name="notes" rows="2"></textarea></div>
        </form>`,
      footerHtml: html`
        <button class="mi-btn mi-btn--ghost" data-act="cancel">إلغاء</button>
        <button class="mi-btn mi-btn--primary" data-act="save">تسجيل</button>`
    });
    dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
    dialog.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const form = dialog.querySelector('#mi-q-form');
      if (form.title.value.trim().length < 5) { toastError('عنوان الفحص مطلوب'); return; }
      if (!form.initiativeId.value) { toastError('لا مبادرات قيد التنفيذ لتسجيل فحص عليها'); return; }
      await repos.qualityChecks.create({
        title: form.title.value.trim(),
        initiativeId: form.initiativeId.value,
        result: form.result.value,
        inspector: form.inspector.value.trim(),
        notes: form.notes.value.trim(),
        at: new Date().toISOString()
      });
      close();
      toastSuccess('سُجّل الفحص');
      renderQuality(container);
    });
  });
}
