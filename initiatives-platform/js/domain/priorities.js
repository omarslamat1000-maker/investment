// ترتيب أولويات المحفظة — أثر × إلحاح × جاهزية مقابل التكلفة، مع سيناريوهات ميزانية
// الأثر والإلحاح يدخلهما متخذ القرار (1–5) ويُحفظان على المبادرة (priorityInputs)،
// والجاهزية من قالب التعريف، والتكلفة من الميزانية أو منتصف نطاق التكلفة التقديرية
import { READINESS_LEVELS } from '../core/constants.js';
import { isActive } from './workflow.js';

export const COST_MIDPOINTS = { lt1m: 500_000, '1to5m': 3_000_000, '5to20m': 12_500_000, gt20m: 30_000_000, tbd: 0 };

export function estimatedCost(initiative) {
  if (Number(initiative.budget) > 0) return Number(initiative.budget);
  return COST_MIDPOINTS[initiative.costBand] || 0;
}

export function readinessScore(initiative) {
  const idx = READINESS_LEVELS.findIndex((r) => r.id === initiative.readinessLevel);
  return idx >= 0 ? idx + 1 : 1; // فكرة=1 … جاهزة=5
}

// درجة الأولوية 0..100: 40٪ أثر، 25٪ إلحاح، 20٪ جاهزية، 15٪ كفاءة التكلفة (الأرخص أعلى)
export function priorityScore(initiative, { maxCost = 30_000_000 } = {}) {
  const inputs = initiative.priorityInputs || {};
  const impact = clamp(Number(inputs.impact) || 3);
  const urgency = clamp(Number(inputs.urgency) || 3);
  const readiness = readinessScore(initiative);
  const cost = estimatedCost(initiative);
  const costEff = cost > 0 ? 5 - 4 * Math.min(1, cost / Math.max(maxCost, 1)) : 3; // 1 (الأغلى) … 5 (الأرخص)
  const score = ((impact / 5) * 40) + ((urgency / 5) * 25) + ((readiness / 5) * 20) + ((costEff / 5) * 15);
  return Math.round(score);
}

function clamp(n) { return Math.max(1, Math.min(5, n)); }

export function prioritizeInitiatives(initiatives = [], { includeInactive = false } = {}) {
  const list = initiatives.filter((i) => includeInactive || (isActive(i.status) && i.status !== 'draft'));
  const maxCost = Math.max(1, ...list.map(estimatedCost));
  return list.map((i) => ({
    initiative: i,
    score: priorityScore(i, { maxCost }),
    impact: clamp(Number(i.priorityInputs?.impact) || 3),
    urgency: clamp(Number(i.priorityInputs?.urgency) || 3),
    readiness: readinessScore(i),
    readinessLabel: READINESS_LEVELS.find((r) => r.id === i.readinessLevel)?.label || 'غير مؤشَّرة',
    cost: estimatedCost(i),
    manual: Boolean(i.priorityInputs && (i.priorityInputs.impact || i.priorityInputs.urgency))
  })).sort((a, b) => b.score - a.score || a.cost - b.cost);
}

// سيناريو ميزانية: أي المبادرات تدخل ضمن سقف مالي بترتيب الأولوية
export function budgetScenario(ranked = [], budget = 0) {
  let remaining = budget;
  const selected = []; const deferred = [];
  for (const r of ranked) {
    if (r.cost <= remaining) { selected.push(r); remaining -= r.cost; }
    else deferred.push(r);
  }
  return { selected, deferred, remaining, used: budget - remaining };
}
