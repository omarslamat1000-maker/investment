// اختبارات التكلفة التقديرية: الوحدات، الحساب، النطاقات، الاستخراج من النص والهندسة
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_COST_UNITS, computeEstimate, costBandFor, durationBandFor, quantitiesFromText, suggestItems, mergeUnits, sanitizeUnit, unitsForCategory } from '../../js/domain/cost-estimate.js';
import { CATEGORIES } from '../../js/core/constants.js';

test('الوحدات الافتراضية فريدة المعرّف وبمجالات معرفة وأسعار موجبة', () => {
  const ids = new Set(DEFAULT_COST_UNITS.map((u) => u.id));
  assert.equal(ids.size, DEFAULT_COST_UNITS.length);
  const cats = new Set([...CATEGORIES.map((c) => c.id), 'general']);
  for (const u of DEFAULT_COST_UNITS) {
    assert.ok(cats.has(u.category), u.id);
    assert.ok(u.rate > 0 && u.daysPerUnit >= 0 && u.baseDays >= 0, u.id);
  }
});

test('حديقة 5,156 م² × 650 ريال + احتياطي 10% → نطاق 1–5 ملايين ومدة 3–6 أشهر', () => {
  const e = computeEstimate([{ unitId: 'park_area', qty: 5156 }], DEFAULT_COST_UNITS, { contingencyPct: 10 });
  assert.equal(e.subtotal, 5156 * 650);
  assert.equal(e.contingency, Math.round(5156 * 650 * 0.1));
  assert.equal(e.total, e.subtotal + e.contingency);
  assert.equal(e.costBand, '1to5m');
  assert.equal(e.days, Math.ceil(30 + 5156 * 0.02)); // 134 يومًا
  assert.equal(e.durationBand, '3to6m');
});

test('تجاوز سعر الوحدة يدويًا يُعلَّم ويُحتسب، والكميات الصفرية تُهمل', () => {
  const e = computeEstimate([{ unitId: 'trees', qty: 100, rate: 2000 }, { unitId: 'lawn', qty: 0 }], DEFAULT_COST_UNITS, { contingencyPct: 0 });
  assert.equal(e.lines.length, 1);
  assert.equal(e.lines[0].customRate, true);
  assert.equal(e.total, 200000);
});

test('المدة: متوازٍ = أطول بند، متسلسل = المجموع', () => {
  const items = [{ unitId: 'park_playground', qty: 1 }, { unitId: 'park_toilets', qty: 1 }];
  assert.equal(computeEstimate(items, DEFAULT_COST_UNITS).days, 45);
  assert.equal(computeEstimate(items, DEFAULT_COST_UNITS, { durationMode: 'sequential' }).days, 65);
});

test('نطاقات التكلفة والمدة تطابق نطاقات قالب التعريف', () => {
  assert.equal(costBandFor(0), 'tbd');
  assert.equal(costBandFor(999_999), 'lt1m');
  assert.equal(costBandFor(1_000_000), '1to5m');
  assert.equal(costBandFor(19_999_999), '5to20m');
  assert.equal(costBandFor(20_000_000), 'gt20m');
  assert.equal(durationBandFor(0), null);
  assert.equal(durationBandFor(89), 'lt3m');
  assert.equal(durationBandFor(180), '6to12m');
  assert.equal(durationBandFor(400), 'gt1y');
});

test('استخراج الكميات من نص النموذج بالوحدات العربية', () => {
  const q = quantitiesFromText('تنفيذ حديقة على مساحة 5,156 م² ومسار بطول 4.2 كم وزراعة 120 شجرة');
  assert.deepEqual(q.map((x) => [x.unit, x.qty]), [['م²', 5156], ['م.ط', 4200], ['شجرة', 120]]);
});

test('الاقتراح: من مساحة الموقع المرسوم أولًا ثم من النص، والجسور بند واحد', () => {
  const poly = { id: 's1', geometry: { type: 'polygon', coords: [[24.46, 39.61], [24.46, 39.612], [24.462, 39.612], [24.462, 39.61]] } };
  const park = suggestItems({ category: 'parks', title: 'حديقة', summary: 'مساحة 5,000 م²', sites: [poly] }, DEFAULT_COST_UNITS);
  assert.equal(park[0].unitId, 'park_area');
  assert.ok(park[0].qty > 20000, 'المساحة من الهندسة لا من النص');
  const fromText = suggestItems({ category: 'parks', summary: 'مساحة 5,000 م²', sites: [] }, DEFAULT_COST_UNITS);
  assert.deepEqual([fromText[0].unitId, fromText[0].qty], ['park_area', 5000]);
  const bridge = suggestItems({ category: 'roads', title: 'تنفيذ جسر مشاة لربط الجامعتين' }, DEFAULT_COST_UNITS);
  assert.deepEqual(bridge.map((i) => [i.unitId, i.qty]), [['ped_bridge', 1]]);
});

test('دمج الوحدات المحفوظة: تعديل سعر افتراضي، إضافة وحدة، وحذف افتراضية', () => {
  const units = mergeUnits({ units: [{ id: 'trees', category: 'greening', label: 'شجرة', unit: 'شجرة', rate: 1500 }, { id: 'custom1', category: 'parks', label: 'نافورة', unit: 'عدد', rate: 90000 }], removed: ['lawn'] });
  assert.equal(units.find((u) => u.id === 'trees').rate, 1500);
  assert.ok(units.some((u) => u.id === 'custom1'));
  assert.ok(!units.some((u) => u.id === 'lawn'));
  assert.equal(sanitizeUnit({ label: '' }), null);
  assert.ok(unitsForCategory(units, 'parks').some((u) => u.category === 'general'));
});
