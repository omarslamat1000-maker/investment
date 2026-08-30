// آلة حالات دورة حياة المبادرة — الانتقالات المسموحة ومن يملك تنفيذها
import { STATUSES } from '../core/constants.js';
import { can } from '../core/permissions.js';

// كل انتقال: من → إلى، الفعل المطلوب، وهل يتطلب قرار بوابة
export const TRANSITIONS = [
  { from: 'draft',     to: 'submitted', label: 'تقديم المبادرة',      action: 'initiatives.create' },
  { from: 'submitted', to: 'screening', label: 'بدء الفرز',           action: 'initiatives.transition' },
  { from: 'screening', to: 'study',     label: 'اجتياز بوابة الفرز',  action: 'decisions.create', gate: 'G0' },
  { from: 'screening', to: 'rejected',  label: 'اعتذار عند الفرز',    action: 'decisions.create', gate: 'G0' },
  { from: 'study',     to: 'approval',  label: 'اجتياز بوابة الجدوى', action: 'decisions.create', gate: 'G1' },
  { from: 'study',     to: 'rejected',  label: 'اعتذار بعد الدراسة',  action: 'decisions.create', gate: 'G1' },
  { from: 'approval',  to: 'readiness', label: 'اعتماد وتوقيع الشراكة', action: 'decisions.create', gate: 'G2' },
  { from: 'approval',  to: 'onHold',    label: 'تعليق لحين استكمال',  action: 'decisions.create', gate: 'G2' },
  { from: 'readiness', to: 'execution', label: 'إطلاق التنفيذ',       action: 'decisions.create', gate: 'G3' },
  { from: 'execution', to: 'benefits',  label: 'اكتمال التنفيذ',      action: 'initiatives.transition' },
  { from: 'benefits',  to: 'closed',    label: 'إقفال وتحقق المنافع', action: 'decisions.create', gate: 'G4' },
  { from: 'onHold',    to: 'approval',  label: 'إعادة التفعيل',       action: 'initiatives.transition' }
];

export function allowedTransitions(status, role) {
  return TRANSITIONS.filter((t) => t.from === status && can(role, t.action));
}

export function canTransition(fromStatus, toStatus, role) {
  return allowedTransitions(fromStatus, role).some((t) => t.to === toStatus);
}

export function transitionMeta(fromStatus, toStatus) {
  return TRANSITIONS.find((t) => t.from === fromStatus && t.to === toStatus) || null;
}

export function statusLabel(status) {
  return STATUSES[status]?.label || status;
}

export function statusColor(status) {
  return STATUSES[status]?.color || 'muted';
}

// ترتيب الحالة في مسار دورة الحياة (للفرز والعرض)
const ORDER = ['draft', 'submitted', 'screening', 'study', 'approval', 'readiness', 'execution', 'benefits', 'closed'];
export function statusOrder(status) {
  const i = ORDER.indexOf(status);
  return i === -1 ? ORDER.length : i;
}

export function isActive(status) {
  return !['closed', 'rejected'].includes(status);
}
