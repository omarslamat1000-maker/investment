// نموذج المبادرة — الهيكل المعياري، الإنشاء، وقواعد التحقق
import { required, minLength, maxLength, isPositiveNumber, isDateYmd, oneOf, validate, isEmail, isSaudiPhone } from '../core/validation.js';
import { CATEGORIES, DISTRICTS, STATUSES } from '../core/constants.js';
import { sanitizeRecord } from '../core/sanitizer.js';

export const INITIATIVE_TEXT_FIELDS = ['title', 'summary', 'scope', 'location', 'submitterName', 'submitterEntity', 'notes'];

export function newInitiative(overrides = {}) {
  return {
    id: null, // يولَّد رسميًا عند الحفظ MDN-INIT-YYYY-NNNN
    title: '',
    summary: '',
    scope: '',
    category: '',
    district: '',
    location: '',
    lat: null, lng: null,
    status: 'draft',
    submitterName: '',
    submitterEntity: '',
    submitterEmail: '',
    submitterPhone: '',
    channel: 'internal', // internal | public | partner
    budget: null,
    spent: 0,
    fundingModel: '',
    startDate: null,
    endDate: null,
    orgUnitId: null,
    ownerName: '',
    scores: {},          // معايير المفاضلة
    beneficiaries: null, // عدد المستفيدين المقدَّر
    notes: '',
    statusHistory: [],   // [{from,to,at,by,decisionId}]
    ...overrides
  };
}

export function validateInitiative(record) {
  return validate(record, {
    title: [
      (v) => required(v, 'اسم المبادرة'),
      (v) => minLength(v, 8, 'اسم المبادرة'),
      (v) => maxLength(v, 160, 'اسم المبادرة')
    ],
    summary: [
      (v) => required(v, 'وصف المبادرة'),
      (v) => minLength(v, 30, 'وصف المبادرة')
    ],
    category: [
      (v) => required(v, 'التصنيف'),
      (v) => oneOf(v, CATEGORIES.map((c) => c.id), 'التصنيف')
    ],
    district: [
      (v) => required(v, 'الحي'),
      (v) => oneOf(v, DISTRICTS, 'الحي')
    ],
    submitterName: [(v) => required(v, 'اسم مقدّم المبادرة')],
    submitterEmail: [(v) => isEmail(v)],
    submitterPhone: [(v) => isSaudiPhone(v)],
    budget: [(v) => isPositiveNumber(v, 'الميزانية التقديرية')],
    beneficiaries: [(v) => isPositiveNumber(v, 'عدد المستفيدين')],
    startDate: [(v) => isDateYmd(v, 'تاريخ البداية')],
    endDate: [(v) => isDateYmd(v, 'تاريخ النهاية')],
    status: [(v) => oneOf(v, Object.keys(STATUSES), 'الحالة')]
  });
}

export function sanitizeInitiative(record) {
  return sanitizeRecord(record, INITIATIVE_TEXT_FIELDS);
}

export function categoryLabel(categoryId) {
  return CATEGORIES.find((c) => c.id === categoryId)?.label || categoryId || '—';
}

// سطر تاريخ الحالة عند كل انتقال
export function historyEntry(from, to, by, decisionId = null) {
  return { from, to, by, decisionId, at: new Date().toISOString() };
}
