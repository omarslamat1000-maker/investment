// نموذج المفاضلة — درجات 1..5 لكل معيار موزون، الناتج من 100
import { SCORING_CRITERIA } from '../core/constants.js';
import { clamp, round } from '../core/utils.js';

// scores: { strategic: 1..5, impact: 1..5, ... }
export function weightedScore(scores = {}) {
  let total = 0;
  let anyScored = false;
  for (const c of SCORING_CRITERIA) {
    const raw = Number(scores[c.id]);
    if (!Number.isFinite(raw) || raw <= 0) continue;
    anyScored = true;
    const normalized = clamp(raw, 1, 5) / 5; // 0.2..1
    total += normalized * c.weight;
  }
  return anyScored ? round(total, 1) : null;
}

export function scoreBand(score) {
  if (score === null || score === undefined) return { id: 'none', label: 'غير مُقيَّمة' };
  if (score >= 80) return { id: 'priority', label: 'أولوية قصوى' };
  if (score >= 65) return { id: 'strong', label: 'مرشحة بقوة' };
  if (score >= 50) return { id: 'conditional', label: 'مقبولة بشروط' };
  return { id: 'weak', label: 'دون الحد الأدنى' };
}

// التوصية الافتراضية عند بوابة الجدوى بناء على الدرجة
export function gateRecommendation(score) {
  const band = scoreBand(score);
  switch (band.id) {
    case 'priority':
    case 'strong': return 'التوصية بالمضي للاعتماد';
    case 'conditional': return 'استكمال المتطلبات قبل الاعتماد';
    case 'weak': return 'الاعتذار أو إعادة الصياغة';
    default: return 'إكمال التقييم أولًا';
  }
}

export function criteriaWithScores(scores = {}) {
  return SCORING_CRITERIA.map((c) => ({
    ...c,
    score: Number(scores[c.id]) || 0,
    weighted: round((clamp(Number(scores[c.id]) || 0, 0, 5) / 5) * c.weight, 1)
  }));
}
