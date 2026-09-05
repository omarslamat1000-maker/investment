// خدمة اتفاقيات الشراكة — الإصدار عند G2، الاعتماد الإلكتروني من الطرفين،
// وحفظ نسخة الوثيقة ضمن مرفقات المبادرة عند اكتمال التوقيع
import { repos } from '../data/repositories.js';
import { uid, officialId, fmtMoney } from '../core/utils.js';
import { nowIso, fmtDate, fmtHijri, currentYear } from '../core/date-time.js';
import { escapeHtml } from '../core/sanitizer.js';
import { buildAgreement, approveByPartner, approveByAmanah, computeAgreementStatus, agreementStatusLabel, clausesForModels } from '../domain/agreement.js';
import { notify } from './notification-service.js';

const AGR_PREFIX = 'MDN-AGR';

async function nextAgreementId() {
  const all = await repos.agreements.getAll().catch(() => []);
  const year = currentYear();
  const re = new RegExp(`^${AGR_PREFIX}-${year}-(\\d{4})$`);
  let max = 0;
  for (const a of all) { const m = re.exec(a.id || ''); if (m) max = Math.max(max, Number(m[1])); }
  return officialId(AGR_PREFIX, year, max + 1);
}

export async function agreementForInitiative(initiativeId) {
  const list = await repos.agreements.byInitiative(initiativeId).catch(() => []);
  return list.filter((a) => a.status !== 'cancelled').sort((a, b) => (b.version || 0) - (a.version || 0))[0] || null;
}

export async function agreementsForPartner(partnerId) {
  const all = await repos.agreements.getAll().catch(() => []);
  return all.filter((a) => a.status !== 'cancelled' && (a.parties || []).some((p) => p.partnerId === partnerId));
}

// إصدار الاتفاقية (مكتب المبادرات) — من روابط الشركاء الحالية للمبادرة
export async function issueAgreement({ initiative, issuedBy, durationMonths = 12 }) {
  const existing = await agreementForInitiative(initiative.id);
  if (existing) throw new Error(`توجد اتفاقية قائمة ${existing.id} — ألغها أولًا لإصدار نسخة جديدة`);
  const [links, partners] = await Promise.all([repos.initiativePartners.byInitiative(initiative.id), repos.partners.getAll()]);
  const draft = buildAgreement({ initiative, links, partners, issuedBy, durationMonths, now: nowIso() });
  draft.id = await nextAgreementId();
  const saved = await repos.agreements.create(draft);
  await notify('صدرت اتفاقية شراكة', `${saved.id} — «${initiative.title}» بانتظار اعتماد ${saved.parties.map((p) => p.name).join(' و ')}`, 'info');
  return saved;
}

export async function cancelAgreement(agreementId, by = '') {
  return repos.agreements.update(agreementId, { status: 'cancelled', cancelledAt: nowIso(), cancelledBy: by });
}

export async function partnerApprove(agreementId, session) {
  const agreement = await repos.agreements.get(agreementId);
  if (!agreement) throw new Error('الاتفاقية غير موجودة');
  const next = approveByPartner(agreement, session.partnerId, { by: session.name, now: nowIso() });
  const saved = await repos.agreements.update(agreementId, next);
  await afterApproval(saved, `اعتمدت ${session.name} الاتفاقية ${saved.id}`);
  return saved;
}

export async function amanahApprove(agreementId, by) {
  const agreement = await repos.agreements.get(agreementId);
  if (!agreement) throw new Error('الاتفاقية غير موجودة');
  const next = approveByAmanah(agreement, { by, now: nowIso() });
  const saved = await repos.agreements.update(agreementId, next);
  await afterApproval(saved, `اعتمدت الأمانة (${by}) الاتفاقية ${saved.id}`);
  return saved;
}

// عند اكتمال التوقيع: نسخة الوثيقة في المرفقات + تأشير بند G2 + تواريخ توقيع الروابط
async function afterApproval(agreement, message) {
  const signed = computeAgreementStatus(agreement) === 'signed';
  await notify(signed ? 'اكتمل توقيع اتفاقية الشراكة' : 'اعتماد على اتفاقية شراكة',
    signed ? `${agreement.id} — «${agreement.initiativeTitle}» موقعة من الطرفين` : message, 'info');
  if (!signed) return;
  const initiative = await repos.initiatives.get(agreement.initiativeId).catch(() => null);
  const html = agreementDocumentHtml(agreement, initiative);
  const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent('﻿' + standaloneDocument(html, agreement));
  await repos.attachments.create({
    id: uid('att'), initiativeId: agreement.initiativeId,
    name: `اتفاقية-الشراكة-${agreement.id}.html`, type: 'text/html', size: dataUrl.length,
    note: 'نسخة الاتفاقية الموقعة إلكترونيًا — تُفتح في المتصفح وتُحفظ PDF عبر الطباعة',
    dataUrl, uploadedAt: nowIso(), agreementId: agreement.id
  });
  // روابط الشركاء: تاريخ التوقيع
  const links = await repos.initiativePartners.byInitiative(agreement.initiativeId);
  for (const l of links) {
    if (!l.signedAt && agreement.parties.some((p) => p.partnerId === l.partnerId)) {
      await repos.initiativePartners.update(l.id, { signedAt: agreement.signedAt });
    }
  }
  // بند «توقيع اتفاقية أو مذكرة تفاهم» في قائمة تحقق G2
  const checklists = await repos.gateChecklists.byInitiative(agreement.initiativeId);
  const g2 = checklists.find((c) => c.gateId === 'G2');
  if (g2) {
    const items = g2.items.map((it) => it.text.includes('اتفاقية') ? { ...it, done: true, note: agreement.id } : it);
    await repos.gateChecklists.update(g2.id, { items });
  }
}

// نص الوثيقة (HTML معقّم) — يُعرض في عارض التقارير ويُحفظ كنسخة
export function agreementDocumentHtml(agreement, initiative = null) {
  const status = computeAgreementStatus(agreement);
  const partyRows = (agreement.parties || []).map((p, i) => `
    <tr><td>${escapeHtml(String(i + 1))}</td><td><b>${escapeHtml(p.name)}</b>${p.representative ? `<br><small>يمثلها: ${escapeHtml(p.representative)}</small>` : ''}</td>
    <td>${escapeHtml(p.modelLabel || p.model)}</td><td>${escapeHtml(p.contribution || '—')}</td>
    <td>${p.approvedAt ? `✔ ${escapeHtml(fmtDate(p.approvedAt))}<br><small>${escapeHtml(p.approvedBy || '')}</small>` : 'بانتظار الاعتماد'}</td></tr>`).join('');
  const clauses = (agreement.clauses || []).length ? agreement.clauses : clausesForModels(agreement.models || (agreement.parties || []).map((p) => p.model));
  return `
    <p class="mi-agr-intro">بعون الله تعالى، وفي يوم ${escapeHtml(fmtHijri(agreement.issuedAt))} الموافق ${escapeHtml(fmtDate(agreement.issuedAt))}، أُبرمت هذه الاتفاقية بين:</p>
    <p><b>الطرف الأول:</b> أمانة منطقة المدينة المنورة — ممثلةً بمنصة مبادرات البنية التحتية والشراكات المجتمعية.</p>
    <p><b>الطرف الثاني:</b> ${agreement.joint ? 'الجهات الشريكة المبينة أدناه (شراكة مشتركة)' : 'الجهة الشريكة المبينة أدناه'}.</p>
    <table class="mi-table"><thead><tr><th>#</th><th>الجهة</th><th>نموذج الشراكة</th><th>المساهمة</th><th>الاعتماد الإلكتروني</th></tr></thead><tbody>${partyRows}</tbody></table>
    <h3>موضوع الاتفاقية</h3>
    <p>تنفيذ مبادرة <b>«${escapeHtml(agreement.initiativeTitle)}»</b> (${escapeHtml(agreement.initiativeId)})${agreement.location ? ' — ' + escapeHtml(agreement.location) : ''}،
    بميزانية تقديرية ${escapeHtml(fmtMoney(agreement.budget))}${initiative?.summary ? `، وملخصها: ${escapeHtml(initiative.summary)}` : ''}.</p>
    <p><b>مدة الاتفاقية:</b> ${escapeHtml(String(agreement.durationMonths || 12))} شهرًا${agreement.startDate ? ` اعتبارًا من ${escapeHtml(fmtDate(agreement.startDate))}` : ' من تاريخ توقيعها'}.</p>
    <h3>البنود</h3>
    <ol class="mi-agr-clauses">${clauses.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ol>
    <h3>الاعتماد</h3>
    <table class="mi-table"><thead><tr><th>الطرف</th><th>الحالة</th><th>التاريخ</th><th>المعتمِد</th></tr></thead><tbody>
      <tr><td>أمانة منطقة المدينة المنورة</td><td>${agreement.amanah?.approvedAt ? '✔ معتمدة' : 'بانتظار الاعتماد'}</td><td>${escapeHtml(agreement.amanah?.approvedAt ? fmtDate(agreement.amanah.approvedAt) : '—')}</td><td>${escapeHtml(agreement.amanah?.approvedBy || '—')}</td></tr>
      ${(agreement.parties || []).map((p) => `<tr><td>${escapeHtml(p.name)}</td><td>${p.approvedAt ? '✔ معتمدة' : 'بانتظار الاعتماد'}</td><td>${escapeHtml(p.approvedAt ? fmtDate(p.approvedAt) : '—')}</td><td>${escapeHtml(p.approvedBy || '—')}</td></tr>`).join('')}
    </tbody></table>
    <p class="mi-agr-status"><b>حالة الاتفاقية:</b> ${escapeHtml(agreementStatusLabel(status))}${agreement.signedAt ? ` — تاريخ التوقيع ${escapeHtml(fmtDate(agreement.signedAt))}` : ''}</p>`;
}

function standaloneDocument(bodyHtml, agreement) {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>اتفاقية شراكة ${escapeHtml(agreement.id)}</title>
<style>body{font-family:"IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;max-width:52rem;margin:2rem auto;padding:0 1.5rem;color:#1E3B33;line-height:1.9}
h1{color:#073B2E;text-align:center;border-bottom:3px double #C9A227;padding-bottom:.6rem}h3{color:#073B2E;margin-top:1.4rem}
table{width:100%;border-collapse:collapse;margin:.6rem 0;font-size:.92rem}th,td{border:1px solid #CBD5CF;padding:.4rem .6rem;text-align:right;vertical-align:top}th{background:#E4EFE8}
ol{padding-inline-start:1.4rem}li{margin:.35rem 0}.head{text-align:center;color:#5B6E66;font-size:.9rem}.foot{margin-top:2rem;font-size:.8rem;color:#8AA096;text-align:center}
@media print{body{margin:0}}</style></head><body>
<p class="head">أمانة منطقة المدينة المنورة — منصة مبادرات البنية التحتية والشراكات المجتمعية</p>
<h1>اتفاقية شراكة رقم ${escapeHtml(agreement.id)}</h1>${bodyHtml}
<p class="foot">وثيقة مولّدة آليًا من منصة المبادرات — الاعتماد الإلكتروني موثق في سجل تدقيق المنصة</p></body></html>`;
}

// عرض الاتفاقية في عارض التقارير الداخلي (طباعة / PDF / تنزيل)
export async function openAgreementViewer(agreement, initiative = null) {
  const { openReportViewer } = await import('../ui/report-viewer.js');
  openReportViewer({
    title: `اتفاقية شراكة ${agreement.id}`,
    subtitle: `${agreement.initiativeTitle} — ${agreementStatusLabel(computeAgreementStatus(agreement))}`,
    kpis: [
      { label: 'الأطراف الشريكة', value: String((agreement.parties || []).length) },
      { label: 'نموذج الشراكة', value: (agreement.parties || []).map((p) => p.modelLabel).filter((v, i, a) => a.indexOf(v) === i).join('، ') },
      { label: 'المدة', value: `${agreement.durationMonths || 12} شهرًا` },
      { label: 'الميزانية', value: fmtMoney(agreement.budget) }
    ],
    generatedAt: nowIso(),
    sections: [{ heading: 'نص الاتفاقية', html: agreementDocumentHtml(agreement, initiative) }]
  });
}

export { computeAgreementStatus, agreementStatusLabel };
