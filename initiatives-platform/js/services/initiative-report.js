// تقرير المبادرة المحددة — يُبنى من كل بيانات المبادرة بأقسام قابلة للتخصيص، بأيقونات
// وتخطيط فاخر للطباعة A4 عبر عارض التقارير الداخلي (طباعة / PDF / ملف مستقل)
import { repos } from '../data/repositories.js';
import { escapeHtml } from '../core/sanitizer.js';
import { statusLabel } from '../domain/workflow.js';
import { categoryLabel, costBandLabel, durationBandLabel, readinessLabel, getSites } from '../domain/initiative-model.js';
import { gateTrack } from '../domain/stage-gates.js';
import { weightedScore, scoreBand, criteriaWithScores } from '../domain/scoring.js';
import { benefitStatus, realizationPercent } from '../domain/benefits.js';
import { exposureLevel } from '../domain/risks.js';
import { modelLabel, partnerTypeLabel } from '../domain/partner-model.js';
import { measureLabel, sitesSummaryLabel } from '../core/geo.js';
import { fmtMoney, fmtNumber, percent, sortBy } from '../core/utils.js';
import { fmtDate, fmtDateTime } from '../core/date-time.js';
import { slaStatus } from '../domain/sla.js';
import { getSlaConfig } from './sla-service.js';
import { agreementForInitiative, agreementStatusLabel, computeAgreementStatus } from './agreement-service.js';
import { REPORT_STATUS } from './progress-report-service.js';

// أيقونات خطية أحادية اللون (تُطبع بوضوح) — currentColor
const svg = (d, vb = '0 0 24 24') => `<svg class="mi-rpt-ico" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const REPORT_ICONS = {
  card: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h6M7 13h10M7 17h4"/>'),
  pin: svg('<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>'),
  gate: svg('<path d="M5 21V11a7 7 0 0 1 14 0v10"/><path d="M3 21h18"/><path d="M9 21v-6h6v6"/>'),
  partners: svg('<path d="M8 12l3 3 5-5"/><path d="M3 15l4-4a3 3 0 0 1 4 0l1 1"/><path d="M21 15l-4-4a3 3 0 0 0-4 0"/><path d="M7 20l-3-3M17 20l3-3"/>'),
  flag: svg('<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>'),
  star: svg('<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>'),
  risk: svg('<path d="M12 3l10 18H2z"/><path d="M12 10v5"/><circle cx="12" cy="18" r=".6"/>'),
  check: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'),
  camera: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l2-3h4l2 3"/><circle cx="12" cy="13.5" r="3.5"/>'),
  scale: svg('<path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0z"/><path d="M19 7l-3 7a3 3 0 0 0 6 0z"/><path d="M8 21h8"/>'),
  note: svg('<path d="M6 3h9l5 5v13H6z"/><path d="M15 3v5h5"/><path d="M9 13h6M9 17h6"/>'),
  agreement: svg('<path d="M6 3h9l5 5v13H6z"/><path d="M15 3v5h5"/><path d="M9 15l2 2 4-4"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  money: svg('<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9h.01M18 15h.01"/>'),
  people: svg('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 20a5 5 0 0 1 5.5-5"/>')
};

// الأقسام القابلة للتخصيص (بالترتيب المطبوع)
export const INITIATIVE_REPORT_SECTIONS = [
  { id: 'card', label: 'بطاقة التعريف', icon: 'card', hint: 'المشكلة، الحل، الفئات، الأثر، التقديرات', default: true },
  { id: 'site', label: 'الموقع والصورة', icon: 'pin', hint: 'صورة المبادرة ومواقعها الجغرافية', default: true },
  { id: 'gates', label: 'مسار البوابات وتاريخ الحالة', icon: 'gate', hint: 'الحالة الحالية، المدة في المرحلة، الانتقالات والقرارات', default: true },
  { id: 'scoring', label: 'درجة المفاضلة', icon: 'scale', hint: 'معايير المفاضلة الموزونة', default: true },
  { id: 'partners', label: 'الشركاء والاتفاقية', icon: 'partners', hint: 'الجهات الشريكة وأدوارها وحالة الاتفاقية', default: true },
  { id: 'milestones', label: 'معالم التنفيذ', icon: 'flag', hint: 'المعالم وإنجازها والمنصرف', default: true },
  { id: 'benefits', label: 'المنافع', icon: 'star', hint: 'المستهدف مقابل المتحقق', default: true },
  { id: 'risks', label: 'المخاطر', icon: 'risk', hint: 'سجل المخاطر بالتعرض والاستجابة', default: true },
  { id: 'quality', label: 'فحوص الجودة', icon: 'check', hint: 'نتائج الفحوص والمفتشون', default: false },
  { id: 'field', label: 'التقارير الميدانية', icon: 'camera', hint: 'تقارير الشركاء المعتمدة بصورها', default: false },
  { id: 'notes', label: 'الملاحظات والمراجعات', icon: 'note', hint: 'ملاحظات المبادرة وتوصيات المراجعين', default: false }
];

const e = escapeHtml;
const dl = (pairs) => `<dl class="mi-rpt-dl">${pairs.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `<div><dt>${e(k)}</dt><dd>${e(String(v))}</dd></div>`).join('')}</dl>`;
const table = (heads, rows) => rows.length
  ? `<table class="mi-table mi-rpt-table"><thead><tr>${heads.map((h) => `<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  : '<p class="mi-rpt-empty">لا سجلات</p>';
const chip = (text, tone = '') => `<span class="mi-rpt-chip" data-tone="${tone}">${e(text)}</span>`;

// يبني حمولة عارض التقارير — sections: معرفات الأقسام المطلوبة (افتراضيًا كلها)
export async function buildInitiativeReport(initiativeId, { sections = null } = {}) {
  const initiative = await repos.initiatives.get(initiativeId);
  if (!initiative) throw new Error('المبادرة غير موجودة');
  const wanted = new Set(sections || INITIATIVE_REPORT_SECTIONS.map((s) => s.id));
  const [links, partners, milestones, benefits, risks, decisions, reviews, quality, reports, slaConfig, agreement, portfolios] = await Promise.all([
    repos.initiativePartners.byInitiative(initiativeId), repos.partners.getAll(),
    repos.milestones.byInitiative(initiativeId), repos.benefits.byInitiative(initiativeId),
    repos.risks.byInitiative(initiativeId), repos.decisions.byInitiative(initiativeId),
    repos.reviews.byInitiative(initiativeId), repos.qualityChecks.byInitiative(initiativeId),
    repos.progressReports.byInitiative(initiativeId).catch(() => []), getSlaConfig(),
    agreementForInitiative(initiativeId).catch(() => null), repos.portfolios.getAll()
  ]);
  const sla = slaStatus(initiative, slaConfig);
  const sites = getSites(initiative);
  const score = weightedScore(initiative.scores);
  const doneMs = milestones.filter((m) => m.done).length;
  const portfolio = portfolios.find((p) => p.id === initiative.portfolioId);
  const partnerOf = (pid) => partners.find((p) => p.id === pid);

  const out = [];

  if (wanted.has('card')) {
    out.push({
      icon: 'card', heading: 'بطاقة التعريف (قالب تعريف المبادرة المعتمد)',
      html: `
        ${initiative.problem ? `<h4>المشكلة أو الاحتياج</h4><p>${e(initiative.problem)}</p>` : ''}
        <h4>وصف المبادرة والحل المقترح</h4><p>${e(initiative.summary)}</p>
        ${initiative.scope ? `<h4>نطاق العمل</h4><p>${e(initiative.scope)}</p>` : ''}
        ${initiative.beneficiaryGroups ? `<h4>الفئات المستفيدة</h4><p>${e(initiative.beneficiaryGroups)}</p>` : ''}
        ${initiative.expectedImpact ? `<h4>الأثر المتوقع</h4><p>${e(initiative.expectedImpact)}</p>` : ''}
        ${dl([
          ['الجهة المقدمة', initiative.submitterEntity], ['مقدّم المبادرة', initiative.submitterName],
          ['المجال', categoryLabel(initiative.category)], ['المحفظة', portfolio?.title],
          ['التكلفة التقديرية', initiative.costBand ? costBandLabel(initiative.costBand) : 'غير مؤشَّرة'],
          ['المدة التقديرية', initiative.durationBand ? durationBandLabel(initiative.durationBand) : 'غير مؤشَّرة'],
          ['مستوى الجاهزية', initiative.readinessLevel ? readinessLabel(initiative.readinessLevel) : 'غير مؤشَّرة'],
          ['الميزانية', initiative.budget ? fmtMoney(initiative.budget) : null], ['المنصرف', initiative.spent ? fmtMoney(initiative.spent) : null],
          ['المستفيدون المقدَّرون', initiative.beneficiaries ? fmtNumber(initiative.beneficiaries) : null],
          ['نموذج الشراكة', initiative.fundingModel ? modelLabel(initiative.fundingModel) : null],
          ['تاريخ البداية', initiative.startDate ? fmtDate(initiative.startDate) : null], ['تاريخ النهاية', initiative.endDate ? fmtDate(initiative.endDate) : null],
          ['الوحدة المشرفة', initiative.ownerName]
        ])}`
    });
  }

  if (wanted.has('site')) {
    out.push({
      icon: 'pin', heading: 'الموقع والصورة',
      html: `
        <div class="mi-rpt-site">
          ${initiative.imageDataUrl ? `<figure class="mi-rpt-figure"><img src="${e(initiative.imageDataUrl)}" alt="صورة موقع المبادرة"><figcaption>صورة الموقع</figcaption></figure>` : ''}
          <div>
            ${dl([['الموقع', initiative.location || '—'], ['المواقع المسجلة', sites.length ? sitesSummaryLabel(sites) : 'لم تُحدد مواقع على الخريطة']])}
            ${sites.length ? table(['الموقع', 'النوع/القياس', 'الإحداثيات'], sites.map((s) => [e(s.name || 'موقع'), e(measureLabel(s.geometry)), `<span dir="ltr">${e(s.geometry.coords.map((c) => `${Number(c[0]).toFixed(5)}, ${Number(c[1]).toFixed(5)}`).join(' | '))}</span>`])) : ''}
          </div>
        </div>`
    });
  }

  if (wanted.has('gates')) {
    const track = gateTrack(initiative.status);
    const history = sortBy([...(initiative.statusHistory || [])], (h) => h.at, 'desc');
    out.push({
      icon: 'gate', heading: 'مسار البوابات وتاريخ الحالة',
      html: `
        <ol class="mi-rpt-gates">${track.map((g) => `<li data-state="${g.state}"><span class="mi-rpt-gates__arch"></span><b>${e(g.id)}</b><small>${e(g.name.replace('بوابة ', ''))}</small></li>`).join('')}</ol>
        ${dl([['الحالة الحالية', statusLabel(initiative.status)], ['المدة في المرحلة', sla ? `${fmtNumber(sla.days)} يومًا من حد ${fmtNumber(sla.limit)} — ${sla.level === 'overdue' ? `متجاوز بـ ${fmtNumber(sla.overdueDays)} يومًا` : sla.level === 'warn' ? `متبقٍ ${fmtNumber(sla.remaining)} يومًا` : 'ضمن المدة'}` : 'لا مؤقت لهذه المرحلة']])}
        ${table(['التاريخ', 'الانتقال', 'بواسطة', 'القرار ومسوّغاته'], history.map((h) => { const d = decisions.find((x) => x.id === h.decisionId); return [e(fmtDate(h.at)), `${e(statusLabel(h.from))} ← <b>${e(statusLabel(h.to))}</b>`, e(h.by || '—'), d ? `${e(d.id)}: ${e(d.rationale || '')}` : (h.reason ? e(h.reason) : '—')]; }))}`
    });
  }

  if (wanted.has('scoring')) {
    out.push({
      icon: 'scale', heading: 'درجة المفاضلة',
      html: score === null ? '<p class="mi-rpt-empty">لم تُقيَّم بعد — تُستكمل الدرجات في مرحلة الدراسة</p>' : `
        <div class="mi-rpt-score"><b>${e(String(score))}</b><span>/100 — ${e(scoreBand(score).label)}</span></div>
        ${table(['المعيار', 'الوزن', 'الدرجة'], criteriaWithScores(initiative.scores).map((c) => [e(c.label), e(String(c.weight)), `${e(String(c.score))}/5`]))}`
    });
  }

  if (wanted.has('partners')) {
    const st = agreement ? computeAgreementStatus(agreement) : null;
    out.push({
      icon: 'partners', heading: 'الشركاء والاتفاقية',
      html: `
        ${table(['الجهة', 'النوع', 'نموذج الشراكة', 'المساهمة', 'التوقيع'], links.map((l) => { const p = partnerOf(l.partnerId); return [`<b>${e(p?.name || l.partnerId)}</b>`, e(partnerTypeLabel(p?.type)), e(modelLabel(l.model)), e(l.contribution || '—'), l.signedAt ? e(fmtDate(l.signedAt)) : 'لم تُوقَّع بعد']; }))}
        ${agreement ? `<p class="mi-rpt-line">${REPORT_ICONS.agreement} <b>اتفاقية الشراكة ${e(agreement.id)}</b> — ${chip(agreementStatusLabel(st), st === 'signed' ? 'ok' : 'warn')} صدرت ${e(fmtDate(agreement.issuedAt))}${agreement.signedAt ? ` ووُقعت ${e(fmtDate(agreement.signedAt))}` : ''}</p>` : (links.length ? '<p class="mi-rpt-empty">لم تصدر اتفاقية شراكة بعد</p>' : '')}`
    });
  }

  if (wanted.has('milestones')) {
    const p = milestones.length ? percent(doneMs, milestones.length) : null;
    out.push({
      icon: 'flag', heading: 'معالم التنفيذ',
      html: `
        ${p !== null ? `<div class="mi-rpt-bar"><div style="width:${p}%"></div><span>${e(fmtNumber(p))}٪ — ${e(fmtNumber(doneMs))} من ${e(fmtNumber(milestones.length))} معلمًا</span></div>` : ''}
        ${initiative.progressPercentage ? `<p class="mi-rpt-line">${REPORT_ICONS.camera} الإنجاز المعلن من التقارير الميدانية المعتمدة: <b>${e(fmtNumber(initiative.progressPercentage))}٪</b>${initiative.lastFieldUpdateAt ? ` — آخر تحديث ${e(fmtDate(initiative.lastFieldUpdateAt))}` : ''}</p>` : ''}
        ${table(['المَعلم', 'الاستحقاق', 'الحالة'], sortBy(milestones, (m) => m.due).map((m) => [e(m.title), e(fmtDate(m.due)), m.done ? chip(`منجز ${m.doneAt ? fmtDate(m.doneAt) : ''}`, 'ok') : (m.due && new Date(m.due) < new Date() ? chip('متأخر', 'bad') : chip('قيد العمل', ''))]))}
        ${initiative.budget ? dl([['الميزانية', fmtMoney(initiative.budget)], ['المنصرف', fmtMoney(initiative.spent)], ['نسبة الصرف', `${fmtNumber(percent(initiative.spent, initiative.budget))}٪`]]) : ''}`
    });
  }

  if (wanted.has('benefits')) {
    out.push({
      icon: 'star', heading: 'المنافع المستهدفة والمتحققة',
      html: table(['المنفعة', 'المستهدف', 'المتحقق', 'نسبة التحقق', 'الحالة'], benefits.map((b) => { const r = realizationPercent(b); return [e(b.title), `${e(fmtNumber(b.target))} ${e(b.unit)}`, b.actual === null || b.actual === undefined ? 'لم يُقس' : `${e(fmtNumber(b.actual))} ${e(b.unit)}`, r === null ? '—' : `${e(fmtNumber(Math.min(r, 100)))}٪`, chip(benefitStatus(b).label, benefitStatus(b).id === 'achieved' ? 'ok' : benefitStatus(b).id === 'atRisk' ? 'bad' : '')]; }))
    });
  }

  if (wanted.has('risks')) {
    out.push({
      icon: 'risk', heading: 'سجل المخاطر',
      html: table(['الخطر', 'التعرض', 'الاستجابة', 'المسؤول', 'الحالة'], sortBy(risks, (r) => -(r.probability * r.impact)).map((r) => { const lv = exposureLevel(r); return [e(r.title), chip(lv.label, lv.id === 'critical' || lv.id === 'high' ? 'bad' : lv.id === 'medium' ? 'warn' : 'ok'), e(r.response || '—'), e(r.owner || '—'), e(r.status === 'open' ? 'مفتوح' : r.status === 'mitigated' ? 'مُعالج' : 'مغلق')]; }))
    });
  }

  if (wanted.has('quality')) {
    out.push({
      icon: 'check', heading: 'فحوص الجودة',
      html: table(['الفحص', 'التاريخ', 'النتيجة', 'المفتش', 'ملاحظات'], quality.map((q) => [e(q.title), e(fmtDate(q.at)), chip(q.result === 'pass' ? 'مطابق' : 'غير مطابق', q.result === 'pass' ? 'ok' : 'bad'), e(q.inspector || '—'), e(q.notes || '—')]))
    });
  }

  if (wanted.has('field')) {
    const approved = sortBy(reports.filter((r) => r.status === 'approved'), (r) => r.at, 'desc');
    out.push({
      icon: 'camera', heading: 'التقارير الميدانية المعتمدة',
      html: approved.length ? approved.map((r) => `
        <div class="mi-rpt-field">
          <div class="mi-rpt-field__head"><b>${e(r.partnerName)}</b> — <b>${e(fmtNumber(r.percent))}٪</b> <small>${e(fmtDateTime(r.at))}</small> ${chip(REPORT_STATUS[r.status]?.label || r.status, 'ok')}</div>
          <p>${e(r.note)}</p>
          ${(r.photos || []).length ? `<div class="mi-rpt-photos">${r.photos.map((p) => `<img src="${e(p)}" alt="">`).join('')}</div>` : ''}
        </div>`).join('') : '<p class="mi-rpt-empty">لا تقارير ميدانية معتمدة</p>'
    });
  }

  if (wanted.has('notes')) {
    out.push({
      icon: 'note', heading: 'الملاحظات وتوصيات المراجعين',
      html: `
        ${initiative.notes ? `<p>${e(initiative.notes)}</p>` : '<p class="mi-rpt-empty">لا ملاحظات على المبادرة</p>'}
        ${reviews.length ? table(['المراجع', 'البوابة', 'التوصية', 'ملاحظات'], reviews.map((r) => [e(r.reviewer), e(r.gateId), e(r.recommendation), e(r.notes || '—')])) : ''}`
    });
  }

  const heroHtml = `
    <div class="mi-rpt-hero">
      <div class="mi-rpt-hero__text">
        <span class="mi-rpt-hero__id">${e(initiative.id)}</span>
        <h2>${e(initiative.title)}</h2>
        <p>${e(categoryLabel(initiative.category))}${initiative.location ? ` • ${e(initiative.location)}` : ''}</p>
        <p>${chip(statusLabel(initiative.status), 'primary')} ${sla ? chip(sla.level === 'overdue' ? `متجاوز ${fmtNumber(sla.overdueDays)} يومًا` : `${fmtNumber(sla.days)} / ${fmtNumber(sla.limit)} يومًا في المرحلة`, sla.level === 'overdue' ? 'bad' : sla.level === 'warn' ? 'warn' : 'ok') : ''}</p>
      </div>
      ${initiative.imageDataUrl && !wanted.has('site') ? `<img class="mi-rpt-hero__img" src="${e(initiative.imageDataUrl)}" alt="">` : ''}
    </div>`;

  const kpis = [
    { label: 'الحالة', value: statusLabel(initiative.status), icon: 'gate' },
    { label: 'التكلفة التقديرية', value: initiative.budget ? fmtMoney(initiative.budget) : (initiative.costBand ? costBandLabel(initiative.costBand) : '—'), icon: 'money' },
    { label: 'المستفيدون', value: initiative.beneficiaries ? fmtNumber(initiative.beneficiaries) : (initiative.beneficiaryGroups ? 'مبيّنون' : '—'), icon: 'people' },
    { label: 'الشركاء', value: fmtNumber(links.length), icon: 'partners' },
    { label: 'الجاهزية', value: initiative.readinessLevel ? readinessLabel(initiative.readinessLevel) : '—', icon: 'clock' },
    { label: 'المواقع', value: fmtNumber(sites.length), icon: 'pin' }
  ].map((k) => ({ ...k, iconHtml: REPORT_ICONS[k.icon] || '' }));

  return {
    kpis,
    title: 'تقرير مبادرة',
    subtitle: `${initiative.title} — ${initiative.submitterEntity || ''}${portfolio ? ` • ${portfolio.title}` : ''}`,
    heroHtml,
    generatedAt: new Date().toISOString(),
    sections: out.map((s) => ({ ...s, iconHtml: REPORT_ICONS[s.icon] || '' })),
    fileName: `تقرير-${initiative.id}`
  };
}
