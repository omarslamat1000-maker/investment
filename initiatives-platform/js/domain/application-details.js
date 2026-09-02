// البيانات التفصيلية لطلب التقديم على فرصة — تُقدَّم مع الطلب وتُقارن جنبًا إلى جنب في الفرز،
// وتُشتق منها درجات مقترحة للمعايير. البيانات الأساسية للجهة تأتي من حساب الشريك تلقائيًا.
import { READINESS_LEVELS } from '../core/constants.js';

// better: 'max' الأعلى أفضل، 'min' الأقل أفضل، null نصي بلا مقارنة رقمية
export const APPLICATION_FIELDS = [
  { id: 'contributionAmount', label: 'قيمة المساهمة المالية', unit: 'ريال', type: 'money', better: 'max', group: 'المساهمة' },
  { id: 'contributionPercent', label: 'نسبة المساهمة من التكلفة التقديرية', unit: '٪', type: 'percent', better: 'max', group: 'المساهمة' },
  { id: 'durationMonths', label: 'المدة المقترحة للتنفيذ', unit: 'شهرًا', type: 'number', better: 'min', group: 'الجدول الزمني' },
  { id: 'startReadyDate', label: 'موعد الجاهزية للانطلاق', unit: '', type: 'date', better: 'min', group: 'الجدول الزمني' },
  { id: 'readinessLevel', label: 'مستوى الجاهزية', unit: '', type: 'select', better: 'max', group: 'الجدول الزمني', options: READINESS_LEVELS },
  { id: 'teamSize', label: 'حجم الفريق المخصص', unit: 'فردًا', type: 'number', better: 'max', group: 'الفريق والخبرة' },
  { id: 'teamExperience', label: 'خبرات الفريق ومؤهلاته', unit: '', type: 'text', better: null, group: 'الفريق والخبرة' },
  { id: 'similarProjectsCount', label: 'عدد المشاريع المماثلة السابقة', unit: 'مشروعًا', type: 'number', better: 'max', group: 'الفريق والخبرة' },
  { id: 'similarProjectsDesc', label: 'وصف المشاريع المماثلة', unit: '', type: 'text', better: null, group: 'الفريق والخبرة' },
  { id: 'warrantyMonths', label: 'فترة الضمان أو الصيانة', unit: 'شهرًا', type: 'number', better: 'max', group: 'ما بعد التسليم' },
  { id: 'addedValue', label: 'قيمة مضافة (توعية، تشغيل، تطوع…)', unit: '', type: 'text', better: null, group: 'ما بعد التسليم' }
];

export function fieldById(id) {
  return APPLICATION_FIELDS.find((f) => f.id === id) || null;
}

// قيمة رقمية قابلة للمقارنة لحقل (null إذا لا قيمة)
export function comparableValue(field, value) {
  if (value === null || value === undefined || value === '') return null;
  switch (field.type) {
    case 'money': case 'percent': case 'number': {
      const n = Number(value); return Number.isFinite(n) ? n : null;
    }
    case 'date': {
      const t = new Date(value).getTime(); return Number.isFinite(t) ? t : null;
    }
    case 'select': {
      const i = (field.options || []).findIndex((o) => o.id === value); return i >= 0 ? i : null;
    }
    default: return null;
  }
}

// تنظيف البيانات التفصيلية المدخلة (أرقام موجبة، نصوص مقصوصة، خيارات صالحة)
export function sanitizeDetails(input = {}) {
  const out = {};
  for (const f of APPLICATION_FIELDS) {
    const v = input[f.id];
    if (v === null || v === undefined || v === '') continue;
    if (['money', 'percent', 'number'].includes(f.type)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) out[f.id] = f.type === 'percent' ? Math.min(100, n) : n;
    } else if (f.type === 'date') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) out[f.id] = String(v);
    } else if (f.type === 'select') {
      if ((f.options || []).some((o) => o.id === v)) out[f.id] = v;
    } else {
      out[f.id] = String(v).trim().slice(0, 600);
    }
  }
  return out;
}

export function detailsCompleteness(details = {}) {
  const filled = APPLICATION_FIELDS.filter((f) => details[f.id] !== undefined && details[f.id] !== '').length;
  return { filled, total: APPLICATION_FIELDS.length, percent: Math.round((filled / APPLICATION_FIELDS.length) * 100) };
}

// لكل حقل رقمي: معرّفات المتقدمين الأفضل فيه (قد يتعادل أكثر من واحد)
export function bestApplicantsByField(applications = []) {
  const out = {};
  for (const f of APPLICATION_FIELDS) {
    if (!f.better) continue;
    const vals = applications.map((a) => ({ id: a.id, v: comparableValue(f, a.details?.[f.id]) })).filter((x) => x.v !== null);
    if (vals.length < 2) { out[f.id] = []; continue; }
    const target = f.better === 'max' ? Math.max(...vals.map((x) => x.v)) : Math.min(...vals.map((x) => x.v));
    out[f.id] = vals.filter((x) => x.v === target).map((x) => x.id);
  }
  return out;
}

// درجة مقترحة (1..5) من البيانات التفصيلية لكل معيار افتراضي مرتبط بحقول
export function suggestFromDetails(details = {}, need = {}) {
  const out = {};
  const cost = Number(need.estimatedCost) || 0;
  let pct = Number(details.contributionPercent);
  if (!Number.isFinite(pct) && cost && Number(details.contributionAmount)) pct = (Number(details.contributionAmount) / cost) * 100;
  if (Number.isFinite(pct)) out.financial = pct >= 75 ? 5 : pct >= 50 ? 4 : pct >= 25 ? 3 : pct > 0 ? 2 : 1;

  const readinessIdx = READINESS_LEVELS.findIndex((r) => r.id === details.readinessLevel);
  const months = Number(details.durationMonths);
  if (readinessIdx >= 0 || Number.isFinite(months)) {
    let s = readinessIdx >= 0 ? 1 + readinessIdx : 3; // فكرة=1 … جاهزة=5
    if (Number.isFinite(months)) s = Math.round((s + (months <= 3 ? 5 : months <= 6 ? 4 : months <= 12 ? 3 : 2)) / 2);
    out.readiness = Math.max(1, Math.min(5, s));
  }

  const similar = Number(details.similarProjectsCount);
  const team = Number(details.teamSize);
  if (Number.isFinite(similar) || Number.isFinite(team)) {
    let s = Number.isFinite(similar) ? (similar >= 5 ? 5 : similar >= 3 ? 4 : similar >= 1 ? 3 : 2) : 3;
    if (Number.isFinite(team) && team >= 10) s = Math.min(5, s + 1);
    out.technical = s;
  }
  return out;
}

// تنسيق قيمة حقل للعرض
export function formatDetail(field, value, { fmtMoney, fmtNumber, fmtDate } = {}) {
  if (value === null || value === undefined || value === '') return '—';
  switch (field.type) {
    case 'money': return fmtMoney ? fmtMoney(value) : String(value);
    case 'percent': return `${fmtNumber ? fmtNumber(value) : value}٪`;
    case 'number': return `${fmtNumber ? fmtNumber(value) : value}${field.unit ? ' ' + field.unit : ''}`;
    case 'date': return fmtDate ? fmtDate(value) : String(value);
    case 'select': return (field.options || []).find((o) => o.id === value)?.label || String(value);
    default: return String(value);
  }
}
