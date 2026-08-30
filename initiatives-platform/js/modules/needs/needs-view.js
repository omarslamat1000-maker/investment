// سجل الاحتياجات — فرص البنية التحتية المطروحة للشراكة وإدارتها
import { repos } from '../../data/repositories.js';
import { html, raw } from '../../core/sanitizer.js';
import { sectionHeader } from '../../ui/components.js';
import { renderTable } from '../../ui/table.js';
import { needStatusLabel, PRIORITY_LABELS, newNeed, validateNeed, sanitizeNeed } from '../../domain/infrastructure-need-model.js';
import { categoryLabel } from '../../domain/initiative-model.js';
import { CATEGORIES, DISTRICTS } from '../../core/constants.js';
import { fmtMoney } from '../../core/utils.js';
import { getRole } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { openModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';

export async function renderNeeds(container) {
  const needs = await repos.needs.getAll();
  const role = getRole();

  container.innerHTML = html`
    ${raw(sectionHeader('احتياجات البنية التحتية', 'الفرص التي تطرحها الأمانة لتتبناها جهات القطاع الخاص والمجتمع',
    can(role, 'needs.create') ? '<button class="mi-btn mi-btn--primary" data-act="new">طرح احتياج جديد</button>' : ''))}
    <div class="mi-table-host"></div>`;

  const host = container.querySelector('.mi-table-host');
  renderTable(host, needs, [
    { key: 'id', label: 'المعرّف', width: '10rem' },
    { key: 'title', label: 'الاحتياج' },
    { key: 'category', label: 'التصنيف', map: (r) => categoryLabel(r.category) },
    { key: 'district', label: 'الحي' },
    { key: 'priority', label: 'الأولوية', map: (r) => PRIORITY_LABELS[r.priority] || r.priority },
    { key: 'estimatedCost', label: 'التكلفة التقديرية', map: (r) => fmtMoney(r.estimatedCost), sortValue: (r) => Number(r.estimatedCost) || 0 },
    { key: 'status', label: 'الحالة', map: (r) => needStatusLabel(r.status) }
  ], {
    searchable: true, initialSort: 'id',
    onRowClick: (r) => openNeedModal(r),
    emptyText: 'لا توجد احتياجات مسجلة'
  });

  container.querySelector('[data-act="new"]')?.addEventListener('click', () => openNeedModal(null));

  function openNeedModal(existing) {
    const need = existing || newNeed();
    const editable = can(role, existing ? 'needs.edit' : 'needs.create');
    const { dialog, close } = openModal({
      title: existing ? `احتياج ${existing.id}` : 'طرح احتياج جديد',
      wide: true,
      bodyHtml: html`
        <form class="mi-form" id="mi-need-form">
          <div class="mi-form-field"><label>عنوان الاحتياج</label><input class="mi-input" name="title" value="${need.title}" ${editable ? '' : raw('readonly')}></div>
          <div class="mi-form-field"><label>الوصف</label><textarea class="mi-input" name="description" rows="3" ${editable ? '' : raw('readonly')}>${need.description}</textarea></div>
          <div class="mi-form-row">
            <div class="mi-form-field"><label>التصنيف</label>
              <select class="mi-input" name="category" ${editable ? '' : raw('disabled')}>${raw(CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === need.category ? 'selected' : ''}>${c.label}</option>`).join(''))}</select></div>
            <div class="mi-form-field"><label>الحي</label>
              <select class="mi-input" name="district" ${editable ? '' : raw('disabled')}>${raw(DISTRICTS.map((d) => `<option ${d === need.district ? 'selected' : ''}>${d}</option>`).join(''))}</select></div>
            <div class="mi-form-field"><label>الأولوية</label>
              <select class="mi-input" name="priority" ${editable ? '' : raw('disabled')}>
                ${raw(Object.entries(PRIORITY_LABELS).map(([k, v]) => `<option value="${k}" ${k === need.priority ? 'selected' : ''}>${v}</option>`).join(''))}
              </select></div>
          </div>
          <div class="mi-form-row">
            <div class="mi-form-field"><label>التكلفة التقديرية (ريال)</label><input class="mi-input" name="estimatedCost" type="number" min="0" value="${need.estimatedCost ?? ''}" ${editable ? '' : raw('readonly')}></div>
            <div class="mi-form-field"><label>المستفيدون</label><input class="mi-input" name="beneficiaries" type="number" min="0" value="${need.beneficiaries ?? ''}" ${editable ? '' : raw('readonly')}></div>
          </div>
          <div class="mi-form-field"><label>الأثر المتوقع</label><textarea class="mi-input" name="expectedImpact" rows="2" ${editable ? '' : raw('readonly')}>${need.expectedImpact}</textarea></div>
        </form>`,
      footerHtml: html`
        <button class="mi-btn mi-btn--ghost" data-act="cancel">إغلاق</button>
        ${editable ? raw('<button class="mi-btn mi-btn--primary" data-act="save">حفظ</button>') : ''}
        ${existing && existing.status === 'draft' && can(role, 'needs.publish') ? raw('<button class="mi-btn mi-btn--gold" data-act="publish">نشر للشراكة</button>') : ''}`
    });

    dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
    dialog.querySelector('[data-act="save"]')?.addEventListener('click', async () => {
      const form = dialog.querySelector('#mi-need-form');
      const record = sanitizeNeed({
        ...need,
        title: form.title.value, description: form.description.value,
        category: form.category.value, district: form.district.value,
        priority: form.priority.value,
        estimatedCost: form.estimatedCost.value ? Number(form.estimatedCost.value) : null,
        beneficiaries: form.beneficiaries.value ? Number(form.beneficiaries.value) : null,
        expectedImpact: form.expectedImpact.value
      });
      const check = validateNeed(record);
      if (!check.valid) { toastError(Object.values(check.errors)[0]); return; }
      if (existing) await repos.needs.update(existing.id, record);
      else await repos.needs.create(record);
      close();
      toastSuccess(existing ? 'حُدّث الاحتياج' : 'أُنشئ الاحتياج كمسودة');
      renderNeeds(container);
    });
    dialog.querySelector('[data-act="publish"]')?.addEventListener('click', async () => {
      await repos.needs.update(existing.id, { status: 'published', publishedAt: new Date().toISOString() });
      close();
      toastSuccess('نُشر الاحتياج وأصبح ظاهرًا في البوابة العامة');
      renderNeeds(container);
    });
  }
}
