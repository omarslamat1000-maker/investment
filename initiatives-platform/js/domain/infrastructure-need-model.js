// نموذج الاحتياج (الفرصة) — احتياجات بنية تحتية تطرحها الأمانة للشراكة المجتمعية
import { required, minLength, oneOf, isPositiveNumber, validate } from '../core/validation.js';
import { CATEGORIES, DISTRICTS } from '../core/constants.js';
import { sanitizeRecord } from '../core/sanitizer.js';

export const NEED_STATUSES = {
  draft:     { id: 'draft',     label: 'مسودة' },
  published: { id: 'published', label: 'مطروحة للشراكة' },
  matched:   { id: 'matched',   label: 'جرى تبنّيها' },
  closed:    { id: 'closed',    label: 'مغلقة' }
};

export function newNeed(overrides = {}) {
  return {
    id: null, // MDN-NEED-YYYY-NNNN
    title: '',
    description: '',
    category: '',
    district: '',
    location: '',
    lat: null, lng: null,
    status: 'draft',
    priority: 'medium', // low | medium | high
    estimatedCost: null,
    expectedImpact: '',
    beneficiaries: null,
    preferredModels: [], // نماذج الشراكة المفضلة
    publishedAt: null,
    matchedInitiativeId: null,
    ...overrides
  };
}

export function validateNeed(record) {
  return validate(record, {
    title: [(v) => required(v, 'عنوان الاحتياج'), (v) => minLength(v, 8, 'عنوان الاحتياج')],
    description: [(v) => required(v, 'وصف الاحتياج'), (v) => minLength(v, 20, 'وصف الاحتياج')],
    category: [(v) => required(v, 'التصنيف'), (v) => oneOf(v, CATEGORIES.map((c) => c.id), 'التصنيف')],
    district: [(v) => oneOf(v, DISTRICTS, 'المنطقة')],
    priority: [(v) => oneOf(v, ['low', 'medium', 'high'], 'الأولوية')],
    estimatedCost: [(v) => isPositiveNumber(v, 'التكلفة التقديرية')],
    beneficiaries: [(v) => isPositiveNumber(v, 'عدد المستفيدين')],
    status: [(v) => oneOf(v, Object.keys(NEED_STATUSES), 'الحالة')]
  });
}

export function sanitizeNeed(record) {
  return sanitizeRecord(record, ['title', 'description', 'location', 'expectedImpact']);
}

export function needStatusLabel(status) {
  return NEED_STATUSES[status]?.label || status;
}

export const PRIORITY_LABELS = { low: 'عادية', medium: 'مهمة', high: 'عاجلة' };
