// صحة المبادرة RAG — تجميع الجدول الزمني والميزانية والمخاطر والمنافع في مؤشر واحد
import { daysBetween } from '../core/date-time.js';
import { maxOpenExposure } from './risks.js';
import { benefitsSummary } from './benefits.js';
import { percent } from '../core/utils.js';

export const HEALTH = {
  green: { id: 'green', label: 'سليمة' },
  amber: { id: 'amber', label: 'تحتاج متابعة' },
  red: { id: 'red', label: 'متعثرة' }
};

// تقدّم الجدول: نسبة المعالم المنجزة مقابل نسبة الزمن المنقضي
export function scheduleHealth(initiative, milestones = []) {
  if (!initiative.startDate || !initiative.endDate || !milestones.length) return null;
  const now = new Date().toISOString();
  const totalDays = daysBetween(initiative.startDate, initiative.endDate);
  const elapsed = daysBetween(initiative.startDate, now);
  if (!totalDays || totalDays <= 0) return null;
  const timePercent = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
  const donePercent = percent(milestones.filter((m) => m.done).length, milestones.length);
  return { timePercent: Math.round(timePercent), donePercent, lag: Math.round(timePercent - donePercent) };
}

export function budgetHealth(initiative) {
  const budget = Number(initiative.budget) || 0;
  const spent = Number(initiative.spent) || 0;
  if (!budget) return null;
  return { budget, spent, usedPercent: percent(spent, budget) };
}

// التقييم المجمّع
export function initiativeHealth(initiative, { milestones = [], risks = [], benefits = [] } = {}) {
  const reasons = [];
  let level = 'green';

  const sched = scheduleHealth(initiative, milestones);
  if (sched && sched.lag > 25) { level = 'red'; reasons.push(`تأخر الجدول ${sched.lag} نقطة عن الزمن المنقضي`); }
  else if (sched && sched.lag > 10) { level = worst(level, 'amber'); reasons.push('تقدّم أبطأ من الجدول'); }

  const budget = budgetHealth(initiative);
  if (budget && sched && budget.usedPercent > sched.donePercent + 25) {
    level = worst(level, 'red'); reasons.push('الصرف يسبق الإنجاز بفارق كبير');
  } else if (budget && budget.usedPercent > 90 && initiative.status === 'execution') {
    level = worst(level, 'amber'); reasons.push('الميزانية شارفت على النفاد');
  }

  const exp = maxOpenExposure(risks);
  if (exp >= 12) { level = worst(level, 'red'); reasons.push('خطر حرج مفتوح'); }
  else if (exp >= 8) { level = worst(level, 'amber'); reasons.push('خطر مرتفع مفتوح'); }

  const ben = benefitsSummary(benefits);
  if (['benefits', 'closed'].includes(initiative.status) && ben.total && ben.avgRealization !== null && ben.avgRealization < 60) {
    level = worst(level, 'amber'); reasons.push('تحقق المنافع دون المستهدف');
  }

  if (!reasons.length) reasons.push('لا توجد ملاحظات جوهرية');
  return { ...HEALTH[level], reasons, schedule: sched, budget, maxExposure: exp, benefits: ben };
}

function worst(a, b) {
  const order = { green: 0, amber: 1, red: 2 };
  return order[b] > order[a] ? b : a;
}
