// مفاضلة المتقدمين على فرصة — معايير موزونة (المجموع 100) تعطي كل متقدم نسبة،
// وترتيبًا يحدد «الأقرب للتنفيذ». الدرجات من 1 إلى 5 لكل معيار.
export const SCREENING_CRITERIA = [
  { id: 'readiness', label: 'جاهزية التنفيذ', weight: 30, hint: 'خطة واضحة، فريق جاهز، مدة قصيرة للانطلاق' },
  { id: 'financial', label: 'القدرة المالية والمساهمة', weight: 20, hint: 'حجم المساهمة وضمان استمرار التمويل' },
  { id: 'technical', label: 'الكفاءة الفنية والخبرة', weight: 20, hint: 'خبرات مماثلة ومؤهلات الفريق' },
  { id: 'track', label: 'سجل الأداء السابق', weight: 15, hint: 'يُقترح آليًا من بطاقة أداء الشريك' },
  { id: 'modelFit', label: 'ملاءمة نموذج الشراكة', weight: 15, hint: 'يُقترح آليًا من نماذج الشراكة المفضلة للفرصة' }
];

export const SCREENING_TOTAL_WEIGHT = SCREENING_CRITERIA.reduce((a, c) => a + c.weight, 0);

// نسبة المتقدم 0..100 — null إذا لم تُقيَّم أي درجة
export function applicantPercent(scores = {}) {
  let sum = 0; let used = 0;
  for (const c of SCREENING_CRITERIA) {
    const v = Number(scores?.[c.id]);
    if (!Number.isFinite(v) || v < 1) continue;
    sum += (Math.min(5, v) / 5) * c.weight;
    used += c.weight;
  }
  if (!used) return null;
  // المعايير غير المقيَّمة تُحسب صفرًا (تحفيزًا لاستكمال التقييم)
  return Math.round(sum);
}

export function isFullyScored(scores = {}) {
  return SCREENING_CRITERIA.every((c) => Number(scores?.[c.id]) >= 1);
}

// درجات مقترحة آليًا: سجل الأداء من بطاقة الشريك، وملاءمة النموذج من تفضيلات الفرصة
export function suggestedScores({ application, need, scorecard = null }) {
  const out = {};
  if (scorecard?.rating) out.track = scorecard.rating;
  else out.track = 3; // شريك جديد بلا سجل: متوسط
  const preferred = need?.preferredModels || [];
  if (!preferred.length) out.modelFit = 4;
  else if (preferred[0] === application.model) out.modelFit = 5;
  else if (preferred.includes(application.model)) out.modelFit = 4;
  else out.modelFit = 2;
  return out;
}

// ترتيب المتقدمين: المستبعدون آخرًا، ثم الأعلى نسبة، ثم الأكمل تقييمًا، ثم الأقدم تقديمًا
export function rankApplicants(applications = []) {
  return [...applications]
    .map((a) => ({ ...a, percent: applicantPercent(a.scores), fullyScored: isFullyScored(a.scores) }))
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
