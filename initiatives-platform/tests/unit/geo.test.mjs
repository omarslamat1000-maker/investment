// اختبارات الحسابات الجغرافية — أطوال ومساحات مقابل قيم مرجعية معلومة
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineMeters, pathLengthMeters, polygonAreaM2, measureGeometry, measureLabel, geometryCenter } from '../../js/core/geo.js';
import { fmtNumber } from '../../js/core/utils.js';

// درجة عرض واحدة ≈ 111.2 كم — ودرجة طول عند خط عرض المدينة (24.47°) ≈ 101.2 كم
test('هافرساين: درجة عرض كاملة ≈ 111.2 كم', () => {
  const d = haversineMeters([24, 39.6], [25, 39.6]);
  assert.ok(Math.abs(d - 111_195) < 300, `الناتج ${d}`);
});

test('هافرساين: نقطتان متطابقتان = صفر', () => {
  assert.equal(haversineMeters([24.47, 39.61], [24.47, 39.61]), 0);
});

test('طول مسار متعدد النقاط = مجموع القطع', () => {
  const a = [24.47, 39.61]; const b = [24.48, 39.61]; const c = [24.49, 39.61];
  const total = pathLengthMeters([a, b, c]);
  const parts = haversineMeters(a, b) + haversineMeters(b, c);
  assert.ok(Math.abs(total - parts) < 0.5);
  assert.equal(pathLengthMeters([a]), 0);
});

// مربع 0.001° عرض × 0.001° طول عند خط عرض المدينة:
// الارتفاع ≈ 111.2م، العرض ≈ 101.2م → المساحة المتوقعة ≈ 11253 م² (±2%)
test('مساحة مضلع مربّع صغير قرب المدينة المنورة ضمن 2% من القيمة المرجعية', () => {
  const area = polygonAreaM2([
    [24.470, 39.610], [24.471, 39.610], [24.471, 39.611], [24.470, 39.611]
  ]);
  const expected = 111_195 * 0.001 * 111_195 * Math.cos((24.4705 * Math.PI) / 180) * 0.001;
  assert.ok(Math.abs(area - expected) / expected < 0.02, `الناتج ${area} والمتوقع ${expected}`);
});

test('مساحة مضلع بأقل من 3 نقاط = صفر', () => {
  assert.equal(polygonAreaM2([[24, 39], [25, 39]]), 0);
});

test('measureGeometry: خط له طول بلا مساحة، ومضلع له كلاهما، ونقطة بلا قياسات', () => {
  const line = measureGeometry({ type: 'line', coords: [[24.47, 39.61], [24.48, 39.61]] });
  assert.ok(line.lengthM > 1000 && line.areaM2 === null);
  const poly = measureGeometry({ type: 'polygon', coords: [[24.470, 39.610], [24.471, 39.610], [24.471, 39.611]] });
  assert.ok(poly.areaM2 > 0 && poly.lengthM > 0);
  const pt = measureGeometry({ type: 'point', coords: [[24.47, 39.61]] });
  assert.equal(pt.lengthM, null);
  assert.equal(measureGeometry(null), null);
});

test('measureLabel: نصوص عربية بأرقام لاتينية موحدة', () => {
  const label = measureLabel({ type: 'line', coords: [[24.47, 39.61], [24.48, 39.61]] });
  assert.match(label, /كم|م/);
  assert.doesNotMatch(label, /[٠-٩]/); // لا أرقام هندية
});

test('توحيد الأرقام: fmtNumber يخرج أرقامًا لاتينية دائمًا', () => {
  const out = fmtNumber(12345.6);
  assert.doesNotMatch(out, /[٠-٩]/);
  assert.match(out, /12/);
});

test('مركز الهندسة هو متوسط النقاط', () => {
  const c = geometryCenter({ type: 'line', coords: [[24, 39], [26, 41]] });
  assert.deepEqual(c, { lat: 25, lng: 40 });
  assert.equal(geometryCenter(null), null);
});
