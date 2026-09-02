// بطاقة أداء الشريك — تقييم محسوب من السجل الفعلي لا من نص المقترح:
// الالتزام بالمواعيد (المعالم المنجزة في وقتها)، جودة التسليم (فحوص الجودة)،
// تحقق المنافع (نسبة التحقق عند القياس)، والانضباط في الإبلاغ (تقارير التقدم المعتمدة)
import { realizationPercent } from './benefits.js';

export const SCORECARD_COMPONENTS = [
  { id: 'timeliness', label: 'الالتزام بالمواعيد', weight: 35 },
  { id: 'quality',    label: 'جودة التسليم',       weight: 25 },
  { id: 'benefits',   label: 'تحقق المنافع',       weight: 30 },
  { id: 'reporting',  label: 'انضباط الإبلاغ',     weight: 10 }
];

const DELIVERY_STATUSES = ['execution', 'benefits', 'closed'];
const DAY = 86_400_000;

function avg(nums) {
  const arr = nums.filter((n) => Number.isFinite(n));
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

// المبادرات التي شارك فيها الشريك ووصلت مرحلة تنفيذ فعلية (ما قبلها لا يقيس أداءه)
export function partnerDeliveryInitiatives(partnerId, links = [], initiatives = []) {
  const ids = new Set((links || []).filter((l) => l.partnerId === partnerId).map((l) => l.initiativeId));
  return (initiatives || []).filter((i) => ids.has(i.id) && DELIVERY_STATUSES.includes(i.status));
}

export function partnerScorecard({ partnerId, links = [], initiatives = [], milestones = [], benefits = [], qualityChecks = [], progressReports = [], now = Date.now() }) {
  const mine = partnerDeliveryInitiatives(partnerId, links, initiatives);
  const ids = new Set(mine.map((i) => i.id));

  // الالتزام بالمواعيد: من المعالم المنجزة، ما أُنجز في موعده أو قبله (بتسامح يوم)
  const doneMs = milestones.filter((m) => ids.has(m.initiativeId) && m.done);
  const onTime = doneMs.filter((m) => !m.due || !m.doneAt || new Date(m.doneAt).getTime() <= new Date(m.due).getTime() + DAY).length;
  // المعالم المتأخرة غير المنجزة تُحسب ضد الشريك أيضًا
  const lateOpen = milestones.filter((m) => ids.has(m.initiativeId) && !m.done && m.due && new Date(m.due).getTime() < now).length;
  const msTotal = doneMs.length + lateOpen;
  const timeliness = msTotal ? Math.round((onTime / msTotal) * 100) : null;

  // جودة التسليم: نسبة الفحوص المطابقة
  const qc = qualityChecks.filter((q) => ids.has(q.initiativeId));
  const quality = qc.length ? Math.round((qc.filter((q) => q.result === 'pass').length / qc.length) * 100) : null;

  // تحقق المنافع: متوسط نسبة التحقق (بسقف 100) للمنافع المقيسة
  const measured = benefits.filter((b) => ids.has(b.initiativeId)).map((b) => realizationPercent(b)).filter((p) => p !== null);
  const benefitsScore = measured.length ? Math.round(avg(measured.map((p) => Math.min(p, 100)))) : null;

  // انضباط الإبلاغ: نسبة التقارير الميدانية المعتمدة من المبتوت فيها (المرفوض يخصم)
  const reports = progressReports.filter((r) => r.partnerId === partnerId && r.status !== 'pending');
  const reporting = reports.length ? Math.round((reports.filter((r) => r.status === 'approved').length / reports.length) * 100) : null;

  const values = { timeliness, quality, benefits: benefitsScore, reporting };
  const components = SCORECARD_COMPONENTS.map((c) => ({ ...c, value: values[c.id], available: values[c.id] !== null }));
  const avail = components.filter((c) => c.available);
  const weightSum = avail.reduce((a, c) => a + c.weight, 0);
  const overall = weightSum ? Math.round(avail.reduce((a, c) => a + c.value * c.weight, 0) / weightSum) : null;
  const rating = overall === null ? null : Math.max(1, Math.min(5, Math.round(overall / 20)));

  return {
    partnerId,
    overall,
    rating,
    components,
    sample: {
      initiatives: mine.length,
      closed: mine.filter((i) => i.status === 'closed').length,
      milestones: msTotal, qualityChecks: qc.length, benefits: measured.length, reports: reports.length
    },
    band: scoreBandOf(overall)
  };
}

export function scoreBandOf(overall) {
  if (overall === null || overall === undefined) return { id: 'new', label: 'شريك جديد — لا سجل تنفيذي بعد' };
  if (overall >= 85) return { id: 'excellent', label: 'أداء متميز' };
  if (overall >= 70) return { id: 'good', label: 'أداء جيد' };
  if (overall >= 50) return { id: 'fair', label: 'أداء مقبول' };
  return { id: 'weak', label: 'أداء دون المستوى' };
}

export function ratingStars(rating) {
  if (!rating) return '—';
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

// بطاقات كل الشركاء دفعة واحدة (للجداول والمفاضلة)
export function scorecardsByPartner(partners, data) {
  const out = {};
  for (const p of partners || []) out[p.id] = partnerScorecard({ partnerId: p.id, ...data });
  return out;
}
