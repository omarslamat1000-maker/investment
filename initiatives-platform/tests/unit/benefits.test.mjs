// اختبارات إدارة المنافع
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { realizationPercent, benefitStatus, benefitsSummary } from '../../js/domain/benefits.js';

test('نسبة التحقق من خط الأساس إلى المستهدف', () => {
  assert.equal(realizationPercent({ baseline: 0, target: 100, actual: 50 }), 50);
  assert.equal(realizationPercent({ baseline: 50, target: 100, actual: 75 }), 50);
});

test('المؤشرات الهابطة (المستهدف أقل من الأساس) تُحسب صحيحًا', () => {
  // خفض شكاوى من 200 إلى 100، الواقع 150 → تحقق 50٪
  assert.equal(realizationPercent({ baseline: 200, target: 100, actual: 150 }), 50);
});

test('بلا قياس تعود null وتُعرض «لم تُقس بعد»', () => {
  assert.equal(realizationPercent({ baseline: 0, target: 10, actual: null }), null);
  assert.equal(benefitStatus({ baseline: 0, target: 10, actual: null }).id, 'pending');
});

test('حالات المنفعة: متحققة، على المسار، دون المستهدف', () => {
  assert.equal(benefitStatus({ baseline: 0, target: 10, actual: 12 }).id, 'achieved');
  assert.equal(benefitStatus({ baseline: 0, target: 10, actual: 7 }).id, 'onTrack');
  assert.equal(benefitStatus({ baseline: 0, target: 10, actual: 2 }).id, 'atRisk');
});

test('ملخص المحفظة يحسب المقاس والمتحقق والمتوسط', () => {
  const s = benefitsSummary([
    { baseline: 0, target: 10, actual: 10 },
    { baseline: 0, target: 10, actual: 5 },
    { baseline: 0, target: 10, actual: null }
  ]);
  assert.equal(s.total, 3);
  assert.equal(s.measured, 2);
  assert.equal(s.achieved, 1);
  assert.equal(s.avgRealization, 75);
});

test('التحقق فوق 100٪ لا يضخم المتوسط', () => {
  const s = benefitsSummary([{ baseline: 0, target: 10, actual: 30 }]);
  assert.equal(s.avgRealization, 100);
});
