// لوحة اتفاقية الشراكة في تفاصيل المبادرة — الإصدار عند مرحلة الاعتماد، متابعة اعتمادات الأطراف،
// اعتماد الأمانة إلكترونيًا، والعرض/الطباعة
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { fmtDate } from '../../core/date-time.js';
import { agreementForInitiative, issueAgreement, amanahApprove, cancelAgreement, openAgreementViewer, computeAgreementStatus, agreementStatusLabel } from '../../services/agreement-service.js';
import { confirmModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { getUserName } from '../../core/state.js';

const AGREEMENT_STAGES = ['approval', 'readiness', 'execution', 'benefits', 'closed', 'onHold'];

export function agreementStatusTone(status) {
  return status === 'signed' ? 'achieved' : status === 'cancelled' ? 'atRisk' : 'onTrack';
}

export async function renderAgreementPanel(host, { initiative, links, canIssue, canApprove, onChange }) {
  if (!AGREEMENT_STAGES.includes(initiative.status)) { host.hidden = true; return null; }
  host.hidden = false;
  const agreement = await agreementForInitiative(initiative.id);
  const status = agreement ? computeAgreementStatus(agreement) : null;

  host.innerHTML = html`
    <h3>اتفاقية الشراكة الرقمية</h3>
    ${agreement ? raw(html`
      <p><b>${agreement.id}</b> <span class="mi-tag" data-benefit="${agreementStatusTone(status)}">${agreementStatusLabel(status)}</span>
        <small class="mi-muted">— صدرت ${fmtDate(agreement.issuedAt)} عن ${agreement.issuedBy || '—'}${agreement.signedAt ? raw(` — وُقعت ${escapeHtml(fmtDate(agreement.signedAt))}`) : ''}</small></p>
      <div class="mi-agr-parties">
        <div class="mi-ms" data-done="${agreement.amanah?.approvedAt ? 'yes' : 'no'}"><span class="mi-ms__dot"></span><span>أمانة منطقة المدينة المنورة</span><small>${agreement.amanah?.approvedAt ? raw('✔ ' + escapeHtml(fmtDate(agreement.amanah.approvedAt)) + ' — ' + escapeHtml(agreement.amanah.approvedBy || '')) : 'بانتظار اعتماد الأمانة'}</small></div>
        ${raw(agreement.parties.map((p) => html`<div class="mi-ms" data-done="${p.approvedAt ? 'yes' : 'no'}"><span class="mi-ms__dot"></span><span>${p.name} <span class="mi-tag">${p.modelLabel}</span></span><small>${p.approvedAt ? raw('✔ ' + escapeHtml(fmtDate(p.approvedAt)) + ' — ' + escapeHtml(p.approvedBy || '')) : 'بانتظار اعتماد الشريك من بوابته'}</small></div>`).join(''))}
      </div>
      <div class="mi-detail-media__tools">
        <button class="mi-btn mi-btn--ghost mi-btn--sm" data-agr="view">عرض / طباعة الاتفاقية</button>
        ${canApprove && !agreement.amanah?.approvedAt && status !== 'cancelled' ? raw('<button class="mi-btn mi-btn--gold mi-btn--sm" data-agr="approve">اعتماد الأمانة إلكترونيًا</button>') : ''}
        ${canIssue && status !== 'signed' ? raw('<button class="mi-btn mi-btn--danger mi-btn--sm" data-agr="cancel">إلغاء الاتفاقية</button>') : ''}
      </div>`)
    : raw(html`
      <p class="mi-muted">${links.length
        ? 'لم تصدر اتفاقية بعد — تُولَّد من نموذج الشراكة لكل شريك مرتبط، ثم يعتمدها الشركاء من بوابتهم وتعتمدها الأمانة هنا.'
        : 'اربط شريكًا بالمبادرة أولًا لإصدار اتفاقية الشراكة.'}</p>
      ${canIssue && links.length ? raw(`
        <div class="mi-agr-issue">
          <label>مدة الاتفاقية (شهرًا) <input type="number" min="1" max="120" value="12" class="mi-input mi-input--sm" data-agr-months></label>
          <button class="mi-btn mi-btn--primary mi-btn--sm" data-agr="issue">إصدار اتفاقية الشراكة</button>
        </div>`) : ''}`)}`;

  host.querySelector('[data-agr="issue"]')?.addEventListener('click', async () => {
    const months = Number(host.querySelector('[data-agr-months]')?.value) || 12;
    try {
      const saved = await issueAgreement({ initiative, issuedBy: getUserName(), durationMonths: months });
      toastSuccess(`صدرت الاتفاقية ${saved.id} — بانتظار اعتماد الأطراف`);
      onChange?.();
    } catch (err) { toastError(err.message); }
  });
  host.querySelector('[data-agr="view"]')?.addEventListener('click', () => openAgreementViewer(agreement, initiative));
  host.querySelector('[data-agr="approve"]')?.addEventListener('click', async () => {
    const sure = await confirmModal('اعتماد الأمانة للاتفاقية',
      `سيُسجَّل اعتمادك الإلكتروني باسم «${getUserName()}» على الاتفاقية ${agreement.id}. يُعد هذا الاعتماد بمثابة التوقيع.`,
      { confirmLabel: 'اعتماد وتوقيع' });
    if (!sure) return;
    try {
      const saved = await amanahApprove(agreement.id, getUserName());
      toastSuccess(computeAgreementStatus(saved) === 'signed' ? 'اكتمل توقيع الاتفاقية من الطرفين وحُفظت نسختها في المرفقات' : 'سُجّل اعتماد الأمانة — بانتظار الشركاء');
      onChange?.();
    } catch (err) { toastError(err.message); }
  });
  host.querySelector('[data-agr="cancel"]')?.addEventListener('click', async () => {
    const sure = await confirmModal('إلغاء الاتفاقية', 'ستُلغى هذه النسخة ويمكن إصدار اتفاقية جديدة. متابعة؟', { confirmLabel: 'إلغاء الاتفاقية', danger: true });
    if (!sure) return;
    await cancelAgreement(agreement.id, getUserName());
    toastSuccess('أُلغيت الاتفاقية');
    onChange?.();
  });
  return agreement;
}
