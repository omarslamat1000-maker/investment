// خدمة SLA البوابات — إعدادات المدد (قابلة للتعديل من الإعدادات) وتصعيد آلي عبر الإشعارات
// عند تجاوز أي مبادرة الحد المعلن لمرحلتها (مرة واحدة لكل مبادرة/مرحلة)
import { dataProvider } from '../data/data-provider.js';
import { repos } from '../data/repositories.js';
import { DEFAULT_SLA, mergeSlaConfig, agingSummary, stageEnteredAt } from '../domain/sla.js';
import { statusLabel } from '../domain/workflow.js';
import { notify } from './notification-service.js';
import { nowIso } from '../core/date-time.js';

const CONFIG_ID = 'sla-config';
const ESCALATION_ID = 'sla-escalations';

export async function getSlaConfig() {
  try {
    const saved = await dataProvider.get('settings', CONFIG_ID);
    return mergeSlaConfig(saved?.stages || {});
  } catch { return mergeSlaConfig({}); }
}

export async function saveSlaConfig(stages) {
  const merged = mergeSlaConfig(stages);
  await dataProvider.put('settings', { id: CONFIG_ID, stages: merged, updatedAt: nowIso() });
  return merged;
}

export function defaultSlaConfig() { return mergeSlaConfig({}); }

// فحص التصعيد: إشعار لكل مبادرة تجاوزت الحد (مرة واحدة لكل دخول مرحلة)
export async function runSlaEscalations() {
  const [initiatives, config] = await Promise.all([repos.initiatives.getAll(), getSlaConfig()]);
  const summary = agingSummary(initiatives, config);
  let record;
  try { record = await dataProvider.get('settings', ESCALATION_ID); } catch { record = null; }
  const notified = new Set(record?.keys || []);
  let created = 0;
  for (const { initiative, sla } of summary.overdue) {
    const key = `${initiative.id}|${initiative.status}|${stageEnteredAt(initiative)}`;
    if (notified.has(key)) continue;
    await notify('تصعيد SLA — تجاوز مدة البوابة',
      `«${initiative.title}» في «${statusLabel(initiative.status)}» منذ ${sla.days} يومًا (الحد ${sla.limit}) — متجاوزة بـ ${sla.overdueDays} يومًا`, 'warn');
    notified.add(key);
    created += 1;
  }
  if (created) {
    // إبقاء المفاتيح الحديثة فقط (حد 500)
    const keys = [...notified].slice(-500);
    await dataProvider.put('settings', { id: ESCALATION_ID, keys, at: nowIso() });
  }
  return { ...summary.counts, escalated: created };
}
