// لوحة تقارير التقدم الميدانية — عرض تقارير الشركاء (صور + نسبة + ملاحظة) واعتمادها أو رفضها
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { fmtDate, fmtDateTime } from '../../core/date-time.js';
import { fmtNumber } from '../../core/utils.js';
import { REPORT_STATUS, reviewProgressReport } from '../../services/progress-report-service.js';
import { openModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { getUserName } from '../../core/state.js';

export function reportStatusChip(status) {
  const st = REPORT_STATUS[status] || REPORT_STATUS.pending;
  const tone = status === 'approved' ? 'achieved' : status === 'rejected' ? 'atRisk' : 'onTrack';
  return `<span class="mi-tag" data-benefit="${tone}">${escapeHtml(st.label)}</span>`;
}

// reports: تقارير مبادرة واحدة أو أكثر؛ milestones للربط بالمعلم؛ initiatives (اختياري) لعرض عنوان المبادرة
export function progressReportsHtml(reports, { milestones = [], initiatives = [], canReview = false, showInitiative = false } = {}) {
  if (!reports.length) return '<p class="mi-muted">لا تقارير ميدانية بعد — يرفعها الشريك من بوابته أثناء التنفيذ</p>';
  return reports.map((r) => {
    const ms = milestones.find((m) => m.id === r.milestoneId);
    const ini = initiatives.find((i) => i.id === r.initiativeId);
    return html`
      <article class="mi-field-report" data-status="${r.status}" data-report="${r.id}">
        <header class="mi-field-report__head">
          <div>
            <b>${r.partnerName}</b> — <span class="mi-field-report__pct">${fmtNumber(r.percent)}٪</span>
            ${ms ? raw(` <span class="mi-tag">${escapeHtml(ms.title)}</span>`) : ''}
            ${showInitiative && ini ? raw(`<br><a href="#/initiatives/${escapeHtml(ini.id)}" class="mi-field-report__ini">${escapeHtml(ini.title)}</a>`) : ''}
          </div>
          <div class="mi-field-report__meta">${raw(reportStatusChip(r.status))}<small class="mi-muted">${fmtDateTime(r.at)}</small></div>
        </header>
        <p class="mi-field-report__note">${r.note}</p>
        ${(r.photos || []).length ? raw(`<div class="mi-field-report__photos">${r.photos.map((p, i) => `<img src="${p}" alt="صورة ميدانية ${i + 1}" loading="lazy" data-photo>`).join('')}</div>`) : ''}
        ${r.status !== 'pending' ? raw(`<small class="mi-muted">${r.status === 'approved' ? 'اعتمده' : 'رفضه'} ${escapeHtml(r.reviewedBy || '—')} في ${escapeHtml(fmtDate(r.reviewedAt))}${r.reviewNote ? ' — ' + escapeHtml(r.reviewNote) : ''}</small>`) : ''}
        ${canReview && r.status === 'pending' ? raw(`
          <div class="mi-field-report__actions">
            <button class="mi-btn mi-btn--primary mi-btn--sm" data-review="approve" data-id="${escapeHtml(r.id)}">اعتماد ونشر الإنجاز</button>
            <button class="mi-btn mi-btn--danger mi-btn--sm" data-review="reject" data-id="${escapeHtml(r.id)}">رفض</button>
          </div>`) : ''}
      </article>`;
  }).join('');
}

// ربط الأزرار داخل حاوية: الاعتماد/الرفض بملاحظة، وتكبير الصور
export function bindProgressReportActions(host, onChange) {
  host.querySelectorAll('[data-review]').forEach((btn) => btn.addEventListener('click', () => {
    const approve = btn.dataset.review === 'approve';
    const { dialog, close } = openModal({
      title: approve ? 'اعتماد التقرير الميداني' : 'رفض التقرير الميداني',
      bodyHtml: html`
        <p class="mi-muted">${approve ? 'سيُحدَّث الإنجاز المعلن للمبادرة بنسبة التقرير، ويُنجز المَعلم المرتبط إن بلغت 100٪.' : 'اكتب سبب الرفض ليصل للشريك في بوابته.'}</p>
        <div class="mi-form-field"><label for="mi-rv-note">ملاحظة المراجعة${approve ? ' (اختيارية)' : ''}</label>
          <textarea id="mi-rv-note" class="mi-input" rows="3"></textarea></div>`,
      footerHtml: html`
        <button class="mi-btn mi-btn--ghost" data-act="cancel">إلغاء</button>
        <button class="mi-btn ${approve ? 'mi-btn--primary' : 'mi-btn--danger'}" data-act="ok">${approve ? 'اعتماد' : 'رفض'}</button>`
    });
    dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
    dialog.querySelector('[data-act="ok"]').addEventListener('click', async () => {
      const note = dialog.querySelector('#mi-rv-note').value.trim();
      if (!approve && note.length < 5) { toastError('سبب الرفض مطلوب'); return; }
      try {
        await reviewProgressReport(btn.dataset.id, { approve, note, by: getUserName() });
        close();
        toastSuccess(approve ? 'اعتُمد التقرير وحُدّث الإنجاز المعلن' : 'رُفض التقرير');
        onChange?.();
      } catch (err) { toastError(err.message); }
    });
  }));
  host.querySelectorAll('img[data-photo]').forEach((img) => img.addEventListener('click', () => {
    const { dialog, close } = openModal({ title: 'صورة ميدانية', wide: true, bodyHtml: html`<img class="mi-field-photo-full" src="${img.src}" alt="">`, footerHtml: html`<button class="mi-btn mi-btn--ghost" data-act="x">إغلاق</button>` });
    dialog.querySelector('[data-act="x"]').addEventListener('click', close);
  }));
}
