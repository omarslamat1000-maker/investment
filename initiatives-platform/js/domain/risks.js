// سجل المخاطر — احتمالية × أثر (1..4 لكل بعد) ومستويات التعرض
import { RISK_LEVELS } from '../core/constants.js';
import { clamp } from '../core/utils.js';

// الخطر: { id, initiativeId, title, probability:1..4, impact:1..4, response, owner, status:'open'|'mitigated'|'closed' }
export function exposure(risk) {
  return clamp(Number(risk.probability) || 1, 1, 4) * clamp(Number(risk.impact) || 1, 1, 4);
}

export function exposureLevel(risk) {
  const e = exposure(risk);
  if (e >= 12) return RISK_LEVELS[3]; // حرج
  if (e >= 8) return RISK_LEVELS[2];  // مرتفع
  if (e >= 4) return RISK_LEVELS[1];  // متوسط
  return RISK_LEVELS[0];              // منخفض
}

export function openRisks(risks = []) {
  return risks.filter((r) => r.status === 'open');
}

// أعلى تعرض مفتوح لمبادرة — يغذي مؤشر الصحة
export function maxOpenExposure(risks = []) {
  const open = openRisks(risks);
  if (!open.length) return 0;
  return Math.max(...open.map(exposure));
}

// مصفوفة 4×4 للوحة المخاطر: rows=الأثر (4→1) cols=الاحتمالية (1→4)
export function riskMatrix(risks = []) {
  const cells = [];
  for (let impact = 4; impact >= 1; impact--) {
    for (let probability = 1; probability <= 4; probability++) {
      cells.push({
        impact, probability,
        exposure: impact * probability,
        risks: risks.filter((r) =>
          clamp(Number(r.impact) || 1, 1, 4) === impact &&
          clamp(Number(r.probability) || 1, 1, 4) === probability)
      });
    }
  }
  return cells;
}
