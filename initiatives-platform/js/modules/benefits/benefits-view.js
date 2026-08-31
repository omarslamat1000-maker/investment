// إدارة المنافع — المستهدف والمتحقق عبر المحفظة مع تحديث القياسات
import { repos } from '../../data/repositories.js';
import { html, raw } from '../../core/sanitizer.js';
import { sectionHeader, progressBar } from '../../ui/components.js';
import { renderTable } from '../../ui/table.js';
import { realizationPercent, benefitStatus, benefitsSummary } from '../../domain/benefits.js';
import { fmtNumber } from '../../core/utils.js';
import { getRole } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { openModal } from '../../ui/modal.js';
import { toastSuccess } from '../../ui/toast.js';

export async function renderBenefits(container) {
  const [benefits, initiatives] = await Promise.all([repos.benefits.getAll(), repos.initiatives.getAll()]);
  const role = getRole();
  const titleOf = (id) => initiatives.find((i) => i.id === id)?.title || id || '—';
  const summary = benefitsSummary(benefits);

  container.innerHTML = html`
    ${raw(sectionHeader('إدارة المنافع', 'قياس المنافع المتحققة مقابل المستهدفة — جوهر مساءلة الشراكات'))}
    <div class="mi-card mi-benefits-summary">
      ${raw(progressBar(summary.avgRealization ?? 0, 'متوسط تحقق المنافع المقاسة'))}
      <p class="mi-muted">${String(summary.measured)} من ${String(summary.total)} منفعة جرى قياسها — ${String(summary.achieved)} متحققة بالكامل</p>
    </div>
    <div class="mi-table-host"></div>`;

  renderTable(container.querySelector('.mi-table-host'), benefits, [
    { key: 'title', label: 'المنفعة' },
    { key: 'initiativeId', label: 'المبادرة', map: (b) => titleOf(b.initiativeId) },
    { key: 'target', label: 'المستهدف', map: (b) => `${fmtNumber(b.target)} ${b.unit}` },
    { key: 'actual', label: 'المتحقق', map: (b) => b.actual === null || b.actual === undefined ? 'لم يُقس' : `${fmtNumber(b.actual)} ${b.unit}` },
    { key: 'realization', label: 'نسبة التحقق', map: (b) => { const p = realizationPercent(b); return p === null ? '—' : `${p}٪`; }, sortValue: (b) => realizationPercent(b) ?? -1 },
    { key: 'status', label: 'الحالة', map: (b) => benefitStatus(b).label },
    { key: 'owner', label: 'مالك المنفعة' }
  ], {
    searchable: true,
    onRowClick: can(role, 'benefits.edit') ? (b) => openMeasureModal(b) : null,
    emptyText: 'لا منافع مسجلة'
  });

  function openMeasureModal(benefit) {
    const { dialog, close } = openModal({
      title: `قياس: ${benefit.title}`,
      bodyHtml: html`
        <p class="mi-muted">خط الأساس: ${fmtNumber(benefit.baseline)} ${benefit.unit} — المستهدف: ${fmtNumber(benefit.target)} ${benefit.unit}</p>
        <div class="mi-form-field">
          <label for="mi-actual">القيمة المقاسة الآن</label>
          <input id="mi-actual" class="mi-input" type="number" step="any" value="${benefit.actual ?? ''}">
        </div>`,
      footerHtml: html`
        <button class="mi-btn mi-btn--ghost" data-act="cancel">إلغاء</button>
        <button class="mi-btn mi-btn--primary" data-act="save">حفظ القياس</button>`
    });
    dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
    dialog.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const v = dialog.querySelector('#mi-actual').value;
      await repos.benefits.update(benefit.id, {
        actual: v === '' ? null : Number(v),
        measuredAt: v === '' ? null : new Date().toISOString()
      });
      close();
      toastSuccess('سُجّل القياس');
      renderBenefits(container);
    });
  }
}
