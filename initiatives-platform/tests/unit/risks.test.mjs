// اختبارات سجل المخاطر
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exposure, exposureLevel, maxOpenExposure, riskMatrix } from '../../js/domain/risks.js';

test('التعرض = الاحتمالية × الأثر', () => {
  assert.equal(exposure({ probability: 3, impact: 4 }), 12);
  assert.equal(exposure({ probability: 1, impact: 1 }), 1);
});

test('المستويات: 12+ حرج، 8+ مرتفع، 4+ متوسط، أقل منخفض', () => {
  assert.equal(exposureLevel({ probability: 3, impact: 4 }).id, 'critical');
  assert.equal(exposureLevel({ probability: 2, impact: 4 }).id, 'high');
  assert.equal(exposureLevel({ probability: 2, impact: 2 }).id, 'medium');
  assert.equal(exposureLevel({ probability: 1, impact: 2 }).id, 'low');
});

test('أعلى تعرض مفتوح يتجاهل المُعالج والمغلق', () => {
  const risks = [
    { probability: 4, impact: 4, status: 'mitigated' },
    { probability: 2, impact: 3, status: 'open' },
    { probability: 1, impact: 1, status: 'closed' }
  ];
  assert.equal(maxOpenExposure(risks), 6);
  assert.equal(maxOpenExposure([]), 0);
});

test('مصفوفة 4×4 تضم 16 خلية وتوزع المخاطر صحيحًا', () => {
  const cells = riskMatrix([{ probability: 2, impact: 3, status: 'open' }]);
  assert.equal(cells.length, 16);
  const cell = cells.find((c) => c.probability === 2 && c.impact === 3);
  assert.equal(cell.risks.length, 1);
  assert.equal(cells.filter((c) => c.risks.length).length, 1);
});

test('القيم خارج 1..4 تُقص داخل المصفوفة', () => {
  const cells = riskMatrix([{ probability: 9, impact: 0, status: 'open' }]);
  const cell = cells.find((c) => c.probability === 4 && c.impact === 1);
  assert.equal(cell.risks.length, 1);
});
