// سلسلة الاعتماد الإلكتروني المتسلسل لقرارات البوابات — كل بوابة تتطلب توقيعات أدوار مرتبة
// (مثل: مكتب المبادرات ← المشرف ← مدير النظام)، ولا ينتقل حال المبادرة إلا باكتمال السلسلة
import { ROLES } from '../core/constants.js';

// السلاسل الافتراضية لكل بوابة/نوع قرار (قابلة للتعديل من الإعدادات)
export const DEFAULT_CHAINS = {
  G0: ['pmo'],
  G1: ['pmo', 'supervisor'],
  G2: ['pmo', 'supervisor', 'admin'],
  G3: ['pmo', 'supervisor', 'admin'],
  G4: ['pmo', 'supervisor', 'admin'],
  return: ['pmo'],
  hold: ['pmo', 'supervisor']
};

export const SIGNABLE_ROLES = ['pmo', 'supervisor', 'admin', 'reviewer'];

export function roleLabel(role) {
  return ROLES[role]?.label || role;
}

export function sanitizeChains(saved = {}) {
  const out = {};
  for (const key of Object.keys(DEFAULT_CHAINS)) {
    const list = Array.isArray(saved?.[key]) ? saved[key].filter((r) => SIGNABLE_ROLES.includes(r)) : null;
    out[key] = list && list.length ? [...new Set(list)] : [...DEFAULT_CHAINS[key]];
  }
  return out;
}

// مفتاح السلسلة لقرار: البوابة إن وجدت، وإلا نوع القرار (إعادة/تعليق)
export function chainKeyFor({ gateId = null, outcome = 'pass' } = {}) {
  if (gateId) return gateId;
  if (outcome === 'return') return 'return';
  if (outcome === 'hold') return 'hold';
  return 'G0';
}

// بناء قرار بسلسلة اعتماد — المُنشئ يوقّع خطوته إن كانت في السلسلة (أو بالنيابة إن كان مديرًا)
export function buildDecision({ initiativeId, gateId = null, outcome = 'pass', rationale = '', to, by = '', byRole = '', chains = DEFAULT_CHAINS, now = new Date().toISOString() }) {
  const key = chainKeyFor({ gateId, outcome });
  const chain = chains[key] || DEFAULT_CHAINS[key] || ['pmo'];
  const decision = {
    id: null,
    initiativeId, gateId, outcome, rationale, to,
    by, at: now,
    chainKey: key,
    approvals: chain.map((role) => ({ role, signedBy: null, at: null, onBehalf: false })),
    status: 'pending',
    finalizedAt: null
  };
  // المنشئ يوقّع تلقائيًا فقط إن كان دوره هو الخطوة الأولى — التوقيع بالنيابة قرار صريح لاحق
  return byRole && chain[0] === byRole ? signDecision(decision, { role: byRole, name: by, now }) : decision;
}

// الخطوة التالية غير الموقعة (السلسلة مرتبة)
export function nextStep(decision) {
  return (decision.approvals || []).find((a) => !a.signedBy) || null;
}

export function isFinal(decision) {
  return decision.status === 'final' || (decision.approvals || []).every((a) => a.signedBy);
}

// هل يستطيع هذا الدور التوقيع الآن؟ الدور المطابق للخطوة التالية، أو المدير بالنيابة عن أي خطوة
export function canSign(decision, role) {
  if (isFinal(decision) || decision.status === 'cancelled') return false;
  const step = nextStep(decision);
  if (!step) return false;
  return step.role === role || role === 'admin';
}

// توقيع خطوة — يعيد نسخة جديدة؛ يكتمل القرار عند توقيع كل الخطوات
export function signDecision(decision, { role, name = '', now = new Date().toISOString() }) {
  if (isFinal(decision)) throw new Error('القرار مكتمل الاعتماد');
  if (decision.status === 'cancelled') throw new Error('القرار ملغى');
  const step = nextStep(decision);
  if (!step) throw new Error('لا خطوات متبقية');
  const onBehalf = step.role !== role;
  if (onBehalf && role !== 'admin') throw new Error(`الخطوة الحالية بانتظار توقيع ${roleLabel(step.role)}`);
  const approvals = decision.approvals.map((a) => a === step ? { ...a, signedBy: name, at: now, onBehalf } : a);
  const complete = approvals.every((a) => a.signedBy);
  return { ...decision, approvals, status: complete ? 'final' : 'pending', finalizedAt: complete ? now : null };
}

// القرارات المعلقة التي تنتظر توقيع دور معين (المدير يرى كل المعلق)
export function pendingForRole(decisions = [], role) {
  return decisions.filter((d) => d.status === 'pending' && canSign(d, role));
}

export function chainProgress(decision) {
  const total = (decision.approvals || []).length;
  const done = (decision.approvals || []).filter((a) => a.signedBy).length;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}
