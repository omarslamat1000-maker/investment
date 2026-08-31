// نموذج الشريك — جهات القطاع الخاص وغير الربحي والمجموعات المجتمعية
import { required, minLength, oneOf, isEmail, isSaudiPhone, validate } from '../core/validation.js';
import { PARTNER_TYPES, PARTNERSHIP_MODELS } from '../core/constants.js';
import { sanitizeRecord } from '../core/sanitizer.js';

export function newPartner(overrides = {}) {
  return {
    id: null, // MDN-PRT-YYYY-NNNN
    name: '',
    type: '', // private | nonprofit | gov | community
    crNumber: '',       // السجل التجاري أو الترخيص
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    interests: [],      // تصنيفات المبادرات محل الاهتمام
    models: [],         // نماذج الشراكة المتاحة لديه
    rating: null,       // تقييم الأداء 1..5 بعد التنفيذ
    active: true,
    notes: '',
    ...overrides
  };
}

export function validatePartner(record) {
  return validate(record, {
    name: [(v) => required(v, 'اسم الجهة'), (v) => minLength(v, 3, 'اسم الجهة')],
    type: [(v) => required(v, 'نوع الجهة'), (v) => oneOf(v, PARTNER_TYPES.map((t) => t.id), 'نوع الجهة')],
    contactName: [(v) => required(v, 'اسم ممثل الجهة')],
    contactEmail: [(v) => isEmail(v)],
    contactPhone: [(v) => isSaudiPhone(v)]
  });
}

export function sanitizePartner(record) {
  return sanitizeRecord(record, ['name', 'contactName', 'notes', 'crNumber']);
}

export function partnerTypeLabel(typeId) {
  return PARTNER_TYPES.find((t) => t.id === typeId)?.label || typeId || '—';
}

export function modelLabel(modelId) {
  return PARTNERSHIP_MODELS.find((m) => m.id === modelId)?.label || modelId || '—';
}

// ربط شريك بمبادرة: { id, initiativeId, partnerId, model, contribution, signedAt }
export function newLink(initiativeId, partnerId, model, contribution = '') {
  return { id: null, initiativeId, partnerId, model, contribution, signedAt: null };
}
