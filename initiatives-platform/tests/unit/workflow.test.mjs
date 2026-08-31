// اختبارات آلة حالات دورة الحياة
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedTransitions, canTransition, transitionMeta, statusOrder, isActive } from '../../js/domain/workflow.js';

test('مدير المكتب يملك انتقال المقدَّمة إلى الفرز', () => {
  assert.ok(canTransition('submitted', 'screening', 'pmo'));
});

test('المطَّلع لا يملك أي انتقال', () => {
  assert.equal(allowedTransitions('submitted', 'viewer').length, 0);
  assert.equal(allowedTransitions('screening', 'viewer').length, 0);
});

test('لا انتقال مباشر من الفرز إلى التنفيذ', () => {
  assert.equal(canTransition('screening', 'execution', 'admin'), false);
});

test('اجتياز بوابة الفرز يتطلب قرارًا (gate=G0)', () => {
  const meta = transitionMeta('screening', 'study');
  assert.equal(meta.gate, 'G0');
  assert.equal(meta.action, 'decisions.create');
});

test('الإقفال يمر ببوابة G4 فقط من مرحلة المنافع', () => {
  assert.equal(transitionMeta('benefits', 'closed').gate, 'G4');
  assert.equal(canTransition('execution', 'closed', 'admin'), false);
});

test('المعلقة تعود إلى الاعتماد عند إعادة التفعيل', () => {
  assert.ok(canTransition('onHold', 'approval', 'pmo'));
});

test('ترتيب الحالات يتصاعد عبر دورة الحياة', () => {
  assert.ok(statusOrder('submitted') < statusOrder('study'));
  assert.ok(statusOrder('study') < statusOrder('execution'));
  assert.ok(statusOrder('execution') < statusOrder('closed'));
});

test('المغلقة والمعتذر عنها ليستا نشطتين', () => {
  assert.equal(isActive('closed'), false);
  assert.equal(isActive('rejected'), false);
  assert.equal(isActive('execution'), true);
});
