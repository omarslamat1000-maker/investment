// التكلفة التقديرية للمبادرة — وحدات قياس ثابتة لكل مجال (م²، م.ط، عدد…) بسعر وحدة بالريال
// ومعدل زمني لكل وحدة، تُضرب في الكميات لاحتساب التكلفة والمدة التقديريتين ونطاقيهما.
// الأسعار الافتراضية استرشادية وتُعدَّل من صفحة «التكلفة التقديرية» (تُحفظ في الإعدادات).
import { COST_BANDS, DURATION_BANDS } from '../core/constants.js';
import { sitesSummary } from '../core/geo.js';

// وحدة قياس: { id, category ('general' لكل المجالات), label, unit, rate (ريال/وحدة),
//              daysPerUnit (يوم/وحدة), baseDays (أيام تجهيز ثابتة), note }
export const DEFAULT_COST_UNITS = [
  // حدائق وساحات
  { id: 'park_area', category: 'parks', label: 'حديقة حي متكاملة (مسطحات، مسارات، جلسات، إنارة، ري)', unit: 'م²', rate: 650, daysPerUnit: 0.02, baseDays: 30 },
  { id: 'park_playground', category: 'parks', label: 'منطقة ألعاب أطفال مجهزة', unit: 'عدد', rate: 250000, daysPerUnit: 20, baseDays: 0 },
  { id: 'park_sports', category: 'parks', label: 'ملعب رياضي متعدد الأغراض', unit: 'عدد', rate: 420000, daysPerUnit: 30, baseDays: 0 },
  { id: 'park_toilets', category: 'parks', label: 'دورات مياه عامة', unit: 'عدد', rate: 350000, daysPerUnit: 45, baseDays: 0 },
  { id: 'park_parking', category: 'parks', label: 'مواقف سيارات', unit: 'م²', rate: 350, daysPerUnit: 0.01, baseDays: 0 },
  // تشجير وتجميل
  { id: 'trees', category: 'greening', label: 'زراعة شجرة ظل مع الري', unit: 'شجرة', rate: 1200, daysPerUnit: 0.05, baseDays: 5 },
  { id: 'lawn', category: 'greening', label: 'مسطح أخضر مع شبكة ري', unit: 'م²', rate: 180, daysPerUnit: 0.01, baseDays: 10 },
  { id: 'irrigation', category: 'greening', label: 'شبكة ري ذكية', unit: 'م²', rate: 90, daysPerUnit: 0.005, baseDays: 5 },
  // أنسنة
  { id: 'sidewalk', category: 'humanization', label: 'أرصفة وممرات مشاة (الجانبان)', unit: 'م.ط', rate: 2500, daysPerUnit: 0.08, baseDays: 20 },
  { id: 'bike_lane', category: 'humanization', label: 'مسار دراجات', unit: 'م.ط', rate: 900, daysPerUnit: 0.03, baseDays: 10 },
  { id: 'street_furniture', category: 'humanization', label: 'عناصر حضرية (جلسات، مظلات، سلال)', unit: 'عدد', rate: 15000, daysPerUnit: 0.5, baseDays: 0 },
  { id: 'decorative_lighting', category: 'humanization', label: 'إنارة جمالية', unit: 'عمود', rate: 18000, daysPerUnit: 0.3, baseDays: 10 },
  { id: 'intersection_landscape', category: 'humanization', label: 'تنسيق موقع تقاطع (لوبات)', unit: 'م²', rate: 420, daysPerUnit: 0.01, baseDays: 20 },
  // طرق وجسور
  { id: 'asphalt', category: 'roads', label: 'كشط وإعادة سفلتة', unit: 'م²', rate: 95, daysPerUnit: 0.002, baseDays: 10 },
  { id: 'new_road', category: 'roads', label: 'إنشاء طريق جديد (مزدوج)', unit: 'م.ط', rate: 12000, daysPerUnit: 0.15, baseDays: 30 },
  { id: 'curbs', category: 'roads', label: 'بردورات وأرصفة جانبية', unit: 'م.ط', rate: 220, daysPerUnit: 0.01, baseDays: 5 },
  { id: 'ped_bridge', category: 'roads', label: 'جسر مشاة', unit: 'عدد', rate: 12000000, daysPerUnit: 270, baseDays: 30 },
  { id: 'interchange_bridge', category: 'roads', label: 'جسر تقاطع (علوي)', unit: 'عدد', rate: 120000000, daysPerUnit: 720, baseDays: 60 },
  { id: 'tunnel', category: 'roads', label: 'نفق تقاطع', unit: 'عدد', rate: 180000000, daysPerUnit: 900, baseDays: 60 },
  { id: 'road_markings', category: 'roads', label: 'دهانات ولوحات إرشادية', unit: 'م.ط', rate: 60, daysPerUnit: 0.002, baseDays: 3 },
  // إنارة وطاقة
  { id: 'pole', category: 'lighting', label: 'عمود إنارة جديد مع الكابلات', unit: 'عمود', rate: 22000, daysPerUnit: 0.5, baseDays: 10 },
  { id: 'pole_paint', category: 'lighting', label: 'دهان عمود إنارة', unit: 'عمود', rate: 900, daysPerUnit: 0.1, baseDays: 3 },
  { id: 'led_retrofit', category: 'lighting', label: 'استبدال وحدة إنارة LED', unit: 'وحدة', rate: 3500, daysPerUnit: 0.1, baseDays: 3 },
  // تصريف أمطار
  { id: 'storm_pipe', category: 'drainage', label: 'خط تصريف مياه أمطار', unit: 'م.ط', rate: 6500, daysPerUnit: 0.12, baseDays: 20 },
  { id: 'culvert', category: 'drainage', label: 'عبّارة صندوقية', unit: 'عدد', rate: 1500000, daysPerUnit: 60, baseDays: 15 },
  // أرصفة وممرات / سلامة / تأهيل / مرافق / تقنية
  { id: 'sidewalk_only', category: 'sidewalks', label: 'رصيف مع بلاط متشابك', unit: 'م²', rate: 260, daysPerUnit: 0.005, baseDays: 5 },
  { id: 'crossing', category: 'safety', label: 'معبر مشاة مرتفع مع علامات', unit: 'عدد', rate: 45000, daysPerUnit: 2, baseDays: 3 },
  { id: 'barrier', category: 'safety', label: 'حواجز خرسانية/معدنية', unit: 'م.ط', rate: 800, daysPerUnit: 0.02, baseDays: 3 },
  { id: 'shade', category: 'shading', label: 'مظلة تظليل', unit: 'م²', rate: 950, daysPerUnit: 0.02, baseDays: 10 },
  { id: 'building', category: 'facilities', label: 'مبنى خدمات', unit: 'م²', rate: 4500, daysPerUnit: 0.3, baseDays: 30 },
  { id: 'smart_pole', category: 'technology', label: 'عمود ذكي (كاميرا، واي فاي، حساسات)', unit: 'عمود', rate: 85000, daysPerUnit: 1, baseDays: 15 },
  { id: 'rehab_general', category: 'rehab', label: 'تأهيل بنية تحتية عامة', unit: 'م²', rate: 380, daysPerUnit: 0.01, baseDays: 15 },
  // عام لكل المجالات
  { id: 'study', category: 'general', label: 'دراسة وتصميم هندسي', unit: 'مقطوع', rate: 250000, daysPerUnit: 60, baseDays: 0 },
  { id: 'mobilization', category: 'general', label: 'تجهيز الموقع والتحويلات', unit: 'مقطوع', rate: 150000, daysPerUnit: 15, baseDays: 0 }
];

export const UNIT_KINDS = ['م²', 'م.ط', 'كم', 'عدد', 'شجرة', 'عمود', 'وحدة', 'مقطوع'];
export const DEFAULT_CONTINGENCY_PCT = 10;

const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : d; };

// تنقية وحدة واحدة (من الإعدادات أو من النموذج)
export function sanitizeUnit(u) {
  if (!u || !String(u.label || '').trim()) return null;
  return {
    id: String(u.id || '').trim() || 'u-' + Math.random().toString(36).slice(2, 8),
    category: String(u.category || 'general'),
    label: String(u.label).trim().slice(0, 120),
    unit: UNIT_KINDS.includes(u.unit) ? u.unit : (String(u.unit || '').trim() || 'عدد'),
    rate: num(u.rate),
    daysPerUnit: num(u.daysPerUnit),
    baseDays: num(u.baseDays),
    note: String(u.note || '').slice(0, 200)
  };
}

// دمج الوحدات المحفوظة مع الافتراضية: المحفوظة تحل محل الافتراضية بنفس المعرّف، والمحذوفة تُستبعد
export function mergeUnits(saved) {
  if (!saved || !Array.isArray(saved.units)) return DEFAULT_COST_UNITS.map((u) => ({ ...u }));
  const removed = new Set(saved.removed || []);
  const byId = new Map(DEFAULT_COST_UNITS.filter((u) => !removed.has(u.id)).map((u) => [u.id, { ...u }]));
  for (const raw of saved.units) {
    const u = sanitizeUnit(raw);
    if (u && !removed.has(u.id)) byId.set(u.id, u);
  }
  return [...byId.values()];
}

export function unitsForCategory(units, category) {
  return units.filter((u) => u.category === category || u.category === 'general');
}

export function costBandFor(total) {
  if (!(total > 0)) return 'tbd';
  if (total < 1_000_000) return 'lt1m';
  if (total < 5_000_000) return '1to5m';
  if (total < 20_000_000) return '5to20m';
  return 'gt20m';
}

export function durationBandFor(days) {
  if (!(days > 0)) return null;
  if (days < 90) return 'lt3m';
  if (days < 180) return '3to6m';
  if (days < 365) return '6to12m';
  return 'gt1y';
}

export const bandLabel = (list, id) => list.find((b) => b.id === id)?.label || '—';
export const costBandText = (id) => bandLabel(COST_BANDS, id);
export const durationBandText = (id) => bandLabel(DURATION_BANDS, id);

// حساب التقدير: items = [{ unitId, qty, rate? (تجاوز السعر) }]
// المدة الإجمالية = أطول بند (تنفيذ متوازٍ) أو مجموع البنود (متسلسل) حسب mode
export function computeEstimate(items = [], units = DEFAULT_COST_UNITS, { contingencyPct = DEFAULT_CONTINGENCY_PCT, durationMode = 'parallel' } = {}) {
  const lines = [];
  for (const it of items) {
    const u = units.find((x) => x.id === it.unitId);
    const qty = num(it.qty);
    if (!u || qty <= 0) continue;
    const rate = it.rate === undefined || it.rate === null || it.rate === '' ? u.rate : num(it.rate, u.rate);
    const cost = Math.round(qty * rate);
    const days = Math.ceil(u.baseDays + qty * u.daysPerUnit);
    lines.push({ unitId: u.id, label: u.label, unit: u.unit, category: u.category, qty, rate, cost, days, customRate: rate !== u.rate });
  }
  const subtotal = lines.reduce((a, l) => a + l.cost, 0);
  const pct = num(contingencyPct);
  const contingency = Math.round(subtotal * pct / 100);
  const total = subtotal + contingency;
  const days = durationMode === 'sequential'
    ? lines.reduce((a, l) => a + l.days, 0)
    : lines.reduce((a, l) => Math.max(a, l.days), 0);
  return {
    lines, subtotal, contingencyPct: pct, contingency, total, days,
    months: days ? Math.round(days / 30 * 10) / 10 : 0,
    costBand: costBandFor(total), durationBand: durationBandFor(days), durationMode
  };
}

// استخراج الكميات من نص النموذج: «5,156 م²» أو «4.2 كم» أو «120 شجرة»
export function quantitiesFromText(text = '') {
  const t = String(text).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const out = [];
  const grab = (re, unit, factor = 1) => {
    for (const m of t.matchAll(re)) {
      const v = Number(m[1].replace(/,/g, '')) * factor;
      if (v > 0) out.push({ unit, qty: v, source: m[0].trim() });
    }
  };
  grab(/([\d,]+(?:\.\d+)?)\s*م\s*²/g, 'م²');
  grab(/([\d,]+(?:\.\d+)?)\s*متر\s*مربع/g, 'م²');
  grab(/([\d,]+(?:\.\d+)?)\s*كم(?![\u0600-\u06FF])/g, 'م.ط', 1000);
  grab(/([\d,]+(?:\.\d+)?)\s*م\.?\s*ط(?![\u0600-\u06FF])/g, 'م.ط');
  grab(/([\d,]+(?:\.\d+)?)\s*شجرة/g, 'شجرة');
  grab(/([\d,]+(?:\.\d+)?)\s*عمود/g, 'عمود');
  return out;
}

// اقتراح بنود أولية لمبادرة: من هندسة المواقع (مساحة/طول) ومن أرقام النص، ثم بنود المجال الأساسية
export function suggestItems(initiative, units = DEFAULT_COST_UNITS) {
  if (!initiative) return [];
  const cat = initiative.category;
  const available = unitsForCategory(units, cat).filter((u) => u.category !== 'general');
  const sites = Array.isArray(initiative.sites) ? initiative.sites : [];
  const geo = sitesSummary(sites);
  const text = quantitiesFromText([initiative.title, initiative.problem, initiative.summary, initiative.scope].join(' '));
  const items = [];
  const push = (unitId, qty, source) => {
    const u = units.find((x) => x.id === unitId);
    if (u && qty > 0 && !items.some((i) => i.unitId === unitId)) items.push({ unitId, qty: Math.round(qty), source });
  };
  const firstOf = (unitKind) => available.find((u) => u.unit === unitKind);
  const area = geo.totalAreaM2 || text.find((q) => q.unit === 'م²')?.qty || 0;
  const length = geo.totalLengthM || text.find((q) => q.unit === 'م.ط')?.qty || 0;
  if (area) { const u = firstOf('م²'); if (u) push(u.id, area, geo.totalAreaM2 ? 'من مساحة الموقع المرسوم' : 'من نص النموذج'); }
  if (length) { const u = firstOf('م.ط'); if (u) push(u.id, length, geo.totalLengthM ? 'من طول المسار المرسوم' : 'من نص النموذج'); }
  for (const q of text) {
    if (q.unit === 'شجرة' || q.unit === 'عمود') { const u = firstOf(q.unit); if (u) push(u.id, q.qty, 'من نص النموذج'); }
  }
  // مبادرات الجسور والأنفاق: بند واحد حسب العنوان
  const title = String(initiative.title || '');
  if (cat === 'roads') {
    if (/جسر مشاة/.test(title)) push('ped_bridge', 1, 'من عنوان المبادرة');
    else if (/نفق/.test(title)) push('tunnel', 1, 'من عنوان المبادرة');
    else if (/جسر/.test(title)) push('interchange_bridge', 1, 'من عنوان المبادرة');
  }
  if (cat === 'lighting' && /دهان/.test(title)) push('pole_paint', 0, '');
  // بند المجال الأول ببند فارغ الكمية إن لم يُقترح شيء
  if (!items.length && available[0]) items.push({ unitId: available[0].id, qty: 0, source: '' });
  return items;
}
