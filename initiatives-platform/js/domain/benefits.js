// إدارة المنافع Benefits Realization — قياس المتحقق مقابل المستهدف
import { percent, round, sum } from '../core/utils.js';

// المنفعة: { id, initiativeId, title, unit, baseline, target, actual, measuredAt, owner }
export function realizationPercent(benefit) {
  const target = Number(benefit.target) || 0;
  const baseline = Number(benefit.baseline) || 0;
  const actual = benefit.actual === null || benefit.actual === undefined ? null : Number(benefit.actual);
  if (actual === null || target === baseline) return null;
  // نسبة التقدم من خط الأساس نحو المستهدف (تصلح للمؤشرات الصاعدة والهابطة)
  const p = ((actual - baseline) / (target - baseline)) * 100;
  return round(Math.max(0, p), 1);
}

export function benefitStatus(benefit) {
  const p = realizationPercent(benefit);
  if (p === null) return { id: 'pending', label: 'لم تُقس بعد' };
  if (p >= 100) return { id: 'achieved', label: 'متحققة' };
  if (p >= 60) return { id: 'onTrack', label: 'على المسار' };
  return { id: 'atRisk', label: 'دون المستهدف' };
}

// ملخص محفظة المنافع لمبادرة أو للمنصة كلها
export function benefitsSummary(benefits = []) {
  const measured = benefits.filter((b) => realizationPercent(b) !== null);
  const achieved = measured.filter((b) => realizationPercent(b) >= 100);
  const avg = measured.length
    ? round(sum(measured, (b) => Math.min(realizationPercent(b), 100)) / measured.length, 1)
    : null;
  return {
    total: benefits.length,
    measured: measured.length,
    achieved: achieved.length,
    avgRealization: avg,
    measuredPercent: percent(measured.length, benefits.length)
  };
}
