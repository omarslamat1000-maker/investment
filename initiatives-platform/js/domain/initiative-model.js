// نموذج المبادرة — الهيكل المعياري، الإنشاء، وقواعد التحقق
import { required, minLength, maxLength, isPositiveNumber, isDateYmd, oneOf, validate, isEmail, isSaudiPhone } from '../core/validation.js';
import { CATEGORIES, DISTRICTS, STATUSES, COST_BANDS, DURATION_BANDS, READINESS_LEVELS } from '../core/constants.js';
import { sanitizeRecord } from '../core/sanitizer.js';

export const INITIATIVE_TEXT_FIELDS = ['title', 'summary', 'scope', 'location', 'submitterName', 'submitterEntity', 'notes', 'problem', 'beneficiaryGroups', 'expectedImpact'];

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
    // حقول قالب تعريف المبادرة المعتمد
    problem: '',            // المشكلة أو الاحتياج
    beneficiaryGroups: '',  // الفئات المستفيدة
    expectedImpact: '',     // الأثر المتوقع ومؤشر قياسه
    costBand: '',           // نطاق التكلفة التقديرية
    durationBand: '',       // المدة التقديرية
    readinessLevel: '',     // مستوى الجاهزية
    // مواقع المبادرة المتعددة: [{ id, name, geometry: {type, coords} }]
    // (الحقل القديم geometry يُقرأ كموقع أول للتوافق الخلفي عبر getSites)
    sites: [],
    geometry: null,
    imageDataUrl: null,     // صورة المبادرة (مضغوطة)
    portfolioId: null,      // المحفظة الأم إن وجدت
    campaignId: null,       // الحملة الموسمية داخل المحفظة إن وجدت
    ...overrides
  };
}

// مواقع المبادرة مع التوافق الخلفي: geometry القديمة أو lat/lng تصبح موقعًا أول
export function getSites(initiative) {
  if (Array.isArray(initiative.sites) && initiative.sites.length) return initiative.sites;
  if (initiative.geometry?.coords?.length) {
    return [{ id: 'site-legacy', name: 'الموقع الرئيس', geometry: initiative.geometry }];
  }
  if (initiative.lat && initiative.lng) {
    return [{ id: 'site-legacy', name: 'الموقع الرئيس', geometry: { type: 'point', coords: [[initiative.lat, initiative.lng]] } }];
  }
  return [];
}

// أول إحداثية (لترتيب الخرائط القديمة lat/lng)
export function firstLatLng(sites) {
  const c = sites?.[0]?.geometry?.coords?.[0];
  return c ? { lat: c[0], lng: c[1] } : { lat: null, lng: null };
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
    status: [(v) => oneOf(v, Object.keys(STATUSES), 'الحالة')],
    costBand: [(v) => oneOf(v, COST_BANDS.map((b) => b.id), 'نطاق التكلفة')],
    durationBand: [(v) => oneOf(v, DURATION_BANDS.map((b) => b.id), 'المدة التقديرية')],
    readinessLevel: [(v) => oneOf(v, READINESS_LEVELS.map((b) => b.id), 'مستوى الجاهزية')]
  });
}

export function costBandLabel(id) { return COST_BANDS.find((b) => b.id === id)?.label || '—'; }
export function durationBandLabel(id) { return DURATION_BANDS.find((b) => b.id === id)?.label || '—'; }
export function readinessLabel(id) { return READINESS_LEVELS.find((b) => b.id === id)?.label || '—'; }

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
