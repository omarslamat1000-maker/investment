// مفاضلة المتقدمين على فرصة — معايير موزونة تعطي كل متقدم نسبة من 100،
// وترتيبًا يحدد «الأقرب للتنفيذ». الدرجات من 1 إلى 5 لكل معيار.
// المعايير: افتراضية عامة (قابلة للتعديل من الإعدادات) + معايير إضافية خاصة بكل فرصة.
import { suggestFromDetails } from './application-details.js';

export const DEFAULT_SCREENING_CRITERIA = [
  { id: 'readiness', label: 'جاهزية التنفيذ', weight: 30, hint: 'خطة واضحة، فريق جاهز، مدة قصيرة للانطلاق', source: 'details' },
  { id: 'financial', label: 'القدرة المالية والمساهمة', weight: 20, hint: 'حجم المساهمة وضمان استمرار التمويل', source: 'details' },
  { id: 'technical', label: 'الكفاءة الفنية والخبرة', weight: 20, hint: 'خبرات مماثلة ومؤهلات الفريق', source: 'details' },
  { id: 'track', label: 'سجل الأداء السابق', weight: 15, hint: 'يُقترح آليًا من بطاقة أداء الشريك', source: 'scorecard' },
  { id: 'modelFit', label: 'ملاءمة نموذج الشراكة', weight: 15, hint: 'يُقترح آليًا من نماذج الشراكة المفضلة للفرصة', source: 'need' }
];

// للتوافق مع الاستخدامات السابقة
export const SCREENING_CRITERIA = DEFAULT_SCREENING_CRITERIA;
export const SCREENING_TOTAL_WEIGHT = DEFAULT_SCREENING_CRITERIA.reduce((a, c) => a + c.weight, 0);

// تنظيف قائمة معايير (اسم ووزن موجب ومعرّف فريد)
export function sanitizeCriteria(list = []) {
  const seen = new Set();
  const out = [];
  for (const c of list || []) {
    const id = String(c?.id || '').trim() || `crit-${Math.random().toString(36).slice(2, 7)}`;
    const label = String(c?.label || '').trim();
    const weight = Number(c?.weight);
    if (!label || !Number.isFinite(weight) || weight <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label, weight: Math.round(weight), hint: String(c?.hint || '').trim(), source: c?.source || 'manual', scope: c?.scope || 'global' });
  }
  return out;
}

// المعايير الفعلية لفرصة: العامة + الإضافية الخاصة بها (بدون تكرار معرفات)
export function effectiveCriteria(globalCriteria = DEFAULT_SCREENING_CRITERIA, need = null) {
  const base = sanitizeCriteria(globalCriteria.length ? globalCriteria : DEFAULT_SCREENING_CRITERIA).map((c) => ({ ...c, scope: 'global' }));
  const ids = new Set(base.map((c) => c.id));
  const extra = sanitizeCriteria(need?.extraCriteria || []).filter((c) => !ids.has(c.id)).map((c) => ({ ...c, scope: 'need' }));
  return [...base, ...extra];
}

export function totalWeight(criteria) {
  return (criteria || []).reduce((a, c) => a + (Number(c.weight) || 0), 0);
}

// نسبة المتقدم 0..100 بأوزان معيارية (المجموع يُطبَّع إلى 100) — null إذا لم تُقيَّم أي درجة
export function applicantPercent(scores = {}, criteria = DEFAULT_SCREENING_CRITERIA) {
  const total = totalWeight(criteria);
  if (!total) return null;
  let sum = 0; let used = 0;
  for (const c of criteria) {
    const v = Number(scores?.[c.id]);
    if (!Number.isFinite(v) || v < 1) continue;
    sum += (Math.min(5, v) / 5) * c.weight;
    used += c.weight;
  }
  if (!used) return null;
  // المعايير غير المقيَّمة تُحسب صفرًا (تحفيزًا لاستكمال التقييم)
  return Math.round((sum / total) * 100);
}

export function isFullyScored(scores = {}, criteria = DEFAULT_SCREENING_CRITERIA) {
  return (criteria || []).every((c) => Number(scores?.[c.id]) >= 1);
}

// درجات مقترحة آليًا: من البيانات التفصيلية للطلب، وسجل الأداء من بطاقة الشريك،
// وملاءمة النموذج من تفضيلات الفرصة
export function suggestedScores({ application, need, scorecard = null }) {
  const out = { ...suggestFromDetails(application?.details || {}, need || {}) };
  out.track = scorecard?.rating || 3; // شريك جديد بلا سجل: متوسط
  const preferred = need?.preferredModels || [];
  if (!preferred.length) out.modelFit = 4;
  else if (preferred[0] === application.model) out.modelFit = 5;
  else if (preferred.includes(application.model)) out.modelFit = 4;
  else out.modelFit = 2;
  return out;
}

// ترتيب المتقدمين: المستبعدون آخرًا، ثم الأعلى نسبة، ثم الأكمل تقييمًا، ثم الأقدم تقديمًا
export function rankApplicants(applications = [], criteria = DEFAULT_SCREENING_CRITERIA) {
  return [...applications]
    .map((a) => ({ ...a, percent: applicantPercent(a.scores, criteria), fullyScored: isFullyScored(a.scores, criteria) }))
    .sort((a, b) => {
      const ra = a.status === 'rejected' ? 1 : 0; const rb = b.status === 'rejected' ? 1 : 0;
      if (ra !== rb) return ra - rb;
      const pa = a.percent ?? -1; const pb = b.percent ?? -1;
      if (pb !== pa) return pb - pa;
      if (a.fullyScored !== b.fullyScored) return a.fullyScored ? -1 : 1;
      return String(a.at).localeCompare(String(b.at));
    });
}

export function percentBand(p) {
  if (p === null || p === undefined) return { id: 'none', label: 'لم يُقيَّم' };
  if (p >= 80) return { id: 'strong', label: 'الأقرب للتنفيذ' };
  if (p >= 60) return { id: 'good', label: 'مؤهل' };
  if (p >= 40) return { id: 'fair', label: 'يحتاج تعزيزًا' };
  return { id: 'weak', label: 'غير مؤهل حاليًا' };
}
