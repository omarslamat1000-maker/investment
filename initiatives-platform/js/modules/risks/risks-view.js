// سجل المخاطر — مصفوفة 4×4 وقائمة قابلة للتحرير
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader } from '../../ui/components.js';
import { renderTable } from '../../ui/table.js';
import { exposure, exposureLevel, riskMatrix } from '../../domain/risks.js';
import { getRole } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { openModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { isActive } from '../../domain/workflow.js';

const RISK_STATUS = { open: 'مفتوح', mitigated: 'مُعالج', closed: 'مغلق' };

export async function renderRisks(container) {
  const [risks, initiatives] = await Promise.all([repos.risks.getAll(), repos.initiatives.getAll()]);
  const role = getRole();
  const titleOf = (id) => initiatives.find((i) => i.id === id)?.title || id;
  const open = risks.filter((r) => r.status === 'open');
  const matrix = riskMatrix(open);

  container.innerHTML = html`
    ${raw(sectionHeader('سجل المخاطر', 'مصفوفة الاحتمالية والأثر للمخاطر المفتوحة عبر المحفظة',
    can(role, 'risks.edit') ? '<button class="mi-btn mi-btn--primary" data-act="new">تسجيل خطر</button>' : ''))}

    <div class="mi-card">
      <h3>مصفوفة المخاطر المفتوحة (الأثر × الاحتمالية)</h3>
      <div class="mi-risk-matrix" role="img" aria-label="مصفوفة المخاطر ٤ في ٤">
        ${raw(matrix.map((cell) => `
          <div class="mi-risk-cell" data-exposure="${cell.exposure >= 12 ? 'critical' : cell.exposure >= 8 ? 'high' : cell.exposure >= 4 ? 'medium' : 'low'}"
               title="أثر ${cell.impact} × احتمالية ${cell.probability}${cell.risks.length ? ' — ' + cell.risks.map((r) => escapeHtml(r.title)).join('، ') : ''}">
            ${cell.risks.length || ''}
          </div>`).join(''))}
      </div>
      <p class="mi-muted mi-matrix-caption">الصفوف: الأثر من الأعلى (4) إلى الأدنى (1) — الأعمدة: الاحتمالية من (1) إلى (4)</p>
    </div>

    <div class="mi-table-host"></div>`;

  renderTable(container.querySelector('.mi-table-host'), risks, [
    { key: 'title', label: 'الخطر' },
    { key: 'initiativeId', label: 'المبادرة', map: (r) => titleOf(r.initiativeId) },
    { key: 'probability', label: 'الاحتمالية', map: (r) => `${r.probability}/4` },
    { key: 'impact', label: 'الأثر', map: (r) => `${r.impact}/4` },
    { key: 'exposure', label: 'التعرض', map: (r) => `${exposure(r)} — ${exposureLevel(r).label}`, sortValue: (r) => exposure(r) },
    { key: 'response', label: 'خطة الاستجابة' },
    { key: 'status', label: 'الحالة', map: (r) => RISK_STATUS[r.status] || r.status }
  ], {
    searchable: true, initialSort: 'exposure',
    onRowClick: can(role, 'risks.edit') ? (r) => openRiskModal(r) : null,
    emptyText: 'لا مخاطر مسجلة'
  });

  container.querySelector('[data-act="new"]')?.addEventListener('click', () => openRiskModal(null));

  function openRiskModal(existing) {
    const risk = existing || { title: '', probability: 2, impact: 2, response: '', owner: '', status: 'open', initiativeId: '' };
    const candidates = initiatives.filter((i) => isActive(i.status));
    const { dialog, close } = openModal({
      title: existing ? 'تحرير خطر' : 'تسجيل خطر جديد',
      bodyHtml: html`
        <form class="mi-form" id="mi-risk-form">
          <div class="mi-form-field"><label>وصف الخطر</label><input class="mi-input" name="title" value="${risk.title}"></div>
          <div class="mi-form-field"><label>المبادرة</label>
            <select class="mi-input" name="initiativeId">
              ${raw(candidates.map((i) => `<option value="${i.id}" ${i.id === risk.initiativeId ? 'selected' : ''}>${i.title}</option>`).join(''))}
            </select></div>
          <div class="mi-form-row">
            <div class="mi-form-field"><label>الاحتمالية (1–4)</label><input class="mi-input" name="probability" type="number" min="1" max="4" value="${String(risk.probability)}"></div>
            <div class="mi-form-field"><label>الأثر (1–4)</label><input class="mi-input" name="impact" type="number" min="1" max="4" value="${String(risk.impact)}"></div>
            <div class="mi-form-field"><label>الحالة</label>
              <select class="mi-input" name="status">
                ${raw(Object.entries(RISK_STATUS).map(([k, v]) => `<option value="${k}" ${k === risk.status ? 'selected' : ''}>${v}</option>`).join(''))}
              </select></div>
          </div>
          <div class="mi-form-field"><label>خطة الاستجابة</label><textarea class="mi-input" name="response" rows="2">${risk.response}</textarea></div>
          <div class="mi-form-field"><label>مالك الخطر</label><input class="mi-input" name="owner" value="${risk.owner}"></div>
        </form>`,
      footerHtml: html`
        <button class="mi-btn mi-btn--ghost" data-act="cancel">إلغاء</button>
        <button class="mi-btn mi-btn--primary" data-act="save">حفظ</button>`
    });
    dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
    dialog.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const form = dialog.querySelector('#mi-risk-form');
      if (form.title.value.trim().length < 5) { toastError('وصف الخطر مطلوب (5 أحرف على الأقل)'); return; }
      const record = {
        ...risk,
        title: form.title.value.trim(),
        initiativeId: form.initiativeId.value,
        probability: Math.min(4, Math.max(1, Number(form.probability.value) || 1)),
        impact: Math.min(4, Math.max(1, Number(form.impact.value) || 1)),
        status: form.status.value,
        response: form.response.value.trim(),
        owner: form.owner.value.trim()
      };
      if (existing) await repos.risks.update(existing.id, record);
      else await repos.risks.create(record);
      close();
      toastSuccess('حُفظ الخطر');
      renderRisks(container);
    });
  }
}
