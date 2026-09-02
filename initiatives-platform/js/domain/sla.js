// اتفاقيات مستوى الخدمة للبوابات (SLA) — مدة قصوى معلنة لكل مرحلة انتظار،
// وحساب عمر المبادرة في مرحلتها الحالية ومستوى التصعيد (سليم / يقترب / متجاوز)
import { daysBetween } from '../core/date-time.js';

// المدد الافتراضية بالأيام لكل مرحلة تنتظر قرارًا أو إجراءً
export const DEFAULT_SLA = {
  submitted: { days: 7,  label: 'بدء المراجعة بعد التقديم' },
  screening: { days: 14, label: 'بوابة الفرز G0' },
  returned:  { days: 14, label: 'استكمال الجهة بعد الإعادة' },
  study:     { days: 30, label: 'بوابة الجدوى G1' },
  approval:  { days: 21, label: 'بوابة الاعتماد والشراكة G2' },
  readiness: { days: 30, label: 'بوابة جاهزية التنفيذ G3' },
  benefits:  { days: 60, label: 'قياس المنافع والإقفال G4' },
  onHold:    { days: 45, label: 'إعادة تفعيل المعلقة' }
};

// المراحل التي تخضع للمؤقت (التنفيذ له جدول زمني خاص وليس SLA بوابة)
export const SLA_STAGES = Object.keys(DEFAULT_SLA);

export function slaLimit(status, config = DEFAULT_SLA) {
  const entry = config?.[status];
  if (!entry) return null;
  const days = Number(typeof entry === 'object' ? entry.days : entry);
  return Number.isFinite(days) && days > 0 ? days : null;
}

// تاريخ دخول المبادرة مرحلتها الحالية: آخر انتقال إليها في السجل، وإلا تاريخ الإنشاء
export function stageEnteredAt(initiative) {
  const history = initiative.statusHistory || [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].to === initiative.status && history[i].at) return history[i].at;
  }
  return initiative.updatedAt || initiative.createdAt || null;
}

// حالة المؤقت لمبادرة واحدة — null إذا كانت مرحلتها لا تخضع لـ SLA
export function slaStatus(initiative, config = DEFAULT_SLA, nowIso = new Date().toISOString()) {
  const limit = slaLimit(initiative.status, config);
  if (!limit) return null;
  const enteredAt = stageEnteredAt(initiative);
  const days = enteredAt ? Math.max(0, daysBetween(enteredAt, nowIso) ?? 0) : 0;
  const remaining = limit - days;
  const percent = Math.min(100, Math.round((days / limit) * 100));
  let level = 'ok';
  if (remaining < 0) level = 'overdue';
  else if (remaining <= Math.max(3, Math.ceil(limit * 0.2))) level = 'warn';
  return { status: initiative.status, enteredAt, days, limit, remaining, percent, level, overdueDays: remaining < 0 ? -remaining : 0 };
}

export const SLA_LEVELS = {
  ok: { id: 'ok', label: 'ضمن المدة' },
  warn: { id: 'warn', label: 'يقترب من الحد' },
  overdue: { id: 'overdue', label: 'متجاوز' }
};

// ملخص التقادم عبر المحفظة: لكل مرحلة (الإجمالي / يقترب / متجاوز) + قائمة المتجاوزة الأشد تأخرًا
export function agingSummary(initiatives, config = DEFAULT_SLA, nowIso = new Date().toISOString()) {
  const byStage = {};
  const overdue = [];
  const warn = [];
  for (const ini of initiatives || []) {
    const s = slaStatus(ini, config, nowIso);
    if (!s) continue;
    const bucket = (byStage[ini.status] = byStage[ini.status] || { status: ini.status, total: 0, warn: 0, overdue: 0, limit: s.limit, avgDays: 0, _sum: 0 });
    bucket.total += 1;
    bucket._sum += s.days;
    if (s.level === 'overdue') { bucket.overdue += 1; overdue.push({ initiative: ini, sla: s }); }
    else if (s.level === 'warn') { bucket.warn += 1; warn.push({ initiative: ini, sla: s }); }
  }
  const stages = Object.values(byStage).map((b) => {
    const { _sum, ...rest } = b;
    return { ...rest, avgDays: b.total ? Math.round(_sum / b.total) : 0 };
  });
  overdue.sort((a, b) => b.sla.overdueDays - a.sla.overdueDays);
  warn.sort((a, b) => a.sla.remaining - b.sla.remaining);
  return {
    stages,
    overdue,
    warn,
    counts: { tracked: stages.reduce((a, s) => a + s.total, 0), overdue: overdue.length, warn: warn.length }
  };
}

// دمج إعدادات محفوظة (أيام فقط) فوق الافتراضي مع الحفاظ على التسميات
export function mergeSlaConfig(saved = {}) {
  const out = {};
  for (const [k, v] of Object.entries(DEFAULT_SLA)) {
    const days = Number(saved?.[k]?.days ?? saved?.[k]);
    out[k] = { ...v, days: Number.isFinite(days) && days > 0 ? Math.round(days) : v.days };
  }
  return out;
}
