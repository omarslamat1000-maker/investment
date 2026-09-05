// اختبارات تحليل التغطية والفجوات الجغرافية
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverageAnalysis, districtCenter, inferDistrict } from '../../js/domain/coverage.js';

const districts = ['أ', 'ب', 'ج', 'د'];
const categories = [{ id: 'c1', label: 'ت1' }, { id: 'c2', label: 'ت2' }];
const initiatives = [
  { id: '1', district: 'أ', category: 'c1', status: 'execution', budget: 100, beneficiaries: 10 },
  { id: '2', district: 'أ', category: 'c1', status: 'closed', budget: 50, beneficiaries: 5 },
  { id: '3', district: 'ب', category: 'c1', status: 'closed', budget: 20 },
  { id: '4', district: 'ب', category: 'c2', status: 'rejected' }, // لا يُحسب
  { id: '5', district: 'ج', category: 'c2', status: 'draft' }     // لا يُحسب
];
const needs = [
  { district: 'ب', category: 'c2', status: 'published' },
  { district: 'د', category: 'c2', status: 'published' },
  { district: 'أ', category: 'c1', status: 'matched' }
];

test('يعدّ المبادرات لكل حي دون المسودات والمعتذر عنها', () => {
  const a = coverageAnalysis({ initiatives, needs, districts, categories });
  const rowA = a.rows.find((r) => r.district === 'أ');
  assert.equal(rowA.total, 2);
  assert.equal(rowA.active, 1);
  assert.equal(rowA.closed, 1);
  assert.equal(rowA.budget, 150);
  assert.equal(rowA.byCategory.c1, 2);
  assert.equal(a.totals.initiatives, 3);
});

test('يكتشف الأحياء بلا مبادرات والاحتياجات بلا استجابة والتصنيفات المهملة', () => {
  const a = coverageAnalysis({ initiatives, needs, districts, categories });
  assert.deepEqual(a.gaps.noInitiatives, ['ج', 'د']);
  // ب: مبادرة مغلقة فقط + احتياج مطروح → لا مبادرة نشطة
  assert.deepEqual(a.gaps.needsWithoutResponse.map((g) => g.district), ['ب', 'د']);
  assert.deepEqual(a.gaps.neglectedCategories, ['ت2']);
  assert.equal(a.rows.find((r) => r.district === 'د').gap, 'critical');
  assert.equal(a.rows.find((r) => r.district === 'ج').gap, 'high');
  assert.equal(a.rows.find((r) => r.district === 'أ').gap, 'covered');
});

test('تركّز التغطية يُحسب من نصيب أعلى 3 أحياء', () => {
  const a = coverageAnalysis({ initiatives, needs, districts, categories });
  assert.equal(a.concentration, 100);
});

test('مركز الحي من مواقع مبادراته وإلا من المرجع', () => {
  const inis = [{ district: 'أ', sites: [{ geometry: { coords: [[24, 39], [26, 41]] } }] }];
  const c = districtCenter('أ', { initiatives: inis, needs: [] });
  assert.equal(c.lat, 25);
  assert.equal(c.lng, 40);
  assert.equal(c.source, 'sites');
  const f = districtCenter('ب', { initiatives: inis, needs: [], fallback: { 'ب': [1, 2] } });
  assert.equal(f.source, 'reference');
  assert.equal(districtCenter('ج', { fallback: {} }), null);
});

test('المنطقة تُستنتج من أقرب مركز حي عند غياب الحي أو كونه عامًا', () => {
  const centroids = { 'أ': [24.40, 39.60], 'ب': [24.50, 39.70] };
  assert.equal(inferDistrict({ district: '', sites: [{ geometry: { coords: [[24.41, 39.61]] } }] }, centroids), 'أ');
  assert.equal(inferDistrict({ district: 'غير محدد', lat: 24.49, lng: 39.69 }, centroids), 'ب');
  assert.equal(inferDistrict({ district: 'ج', lat: 24.49, lng: 39.69 }, centroids), 'ج');
  assert.equal(inferDistrict({ district: '' }, centroids), 'غير محدد');
});
