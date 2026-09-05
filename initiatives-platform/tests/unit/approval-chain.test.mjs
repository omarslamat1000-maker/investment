// اختبارات سلسلة الاعتماد المتسلسل
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDecision, signDecision, canSign, isFinal, nextStep, pendingForRole, sanitizeChains, chainKeyFor, DEFAULT_CHAINS } from '../../js/domain/approval-chain.js';

test('قرار G2 يتطلب ثلاث خطوات مرتبة ويوقع المنشئ خطوته', () => {
  const d = buildDecision({ initiativeId: 'X', gateId: 'G2', to: 'readiness', by: 'ريم', byRole: 'pmo', now: '2026-09-01T00:00:00Z' });
  assert.equal(d.approvals.length, 3);
  assert.equal(d.approvals[0].signedBy, 'ريم');
  assert.equal(d.status, 'pending');
  assert.equal(nextStep(d).role, 'supervisor');
});

test('التوقيع بالترتيب فقط، والمدير يوقّع بالنيابة، واكتمال السلسلة يجعل القرار نهائيًا', () => {
  let d = buildDecision({ initiativeId: 'X', gateId: 'G1', to: 'approval', by: 'ريم', byRole: 'pmo' });
  assert.equal(canSign(d, 'reviewer'), false);
  assert.equal(canSign(d, 'supervisor'), true);
  assert.equal(canSign(d, 'admin'), true);
  assert.throws(() => signDecision(d, { role: 'reviewer', name: 'س' }), /بانتظار توقيع/);
  d = signDecision(d, { role: 'admin', name: 'المدير' });
  assert.equal(d.approvals[1].onBehalf, true);
  assert.ok(isFinal(d));
  assert.throws(() => signDecision(d, { role: 'admin' }), /مكتمل/);
});

test('قرار G0 من مكتب المبادرات يكتمل فورًا', () => {
  const d = buildDecision({ initiativeId: 'X', gateId: 'G0', to: 'study', by: 'ريم', byRole: 'pmo' });
  assert.ok(isFinal(d));
});

test('المنشئ من خارج السلسلة لا يوقّع، ومفتاح السلسلة للإعادة والتعليق', () => {
  const d = buildDecision({ initiativeId: 'X', gateId: 'G1', to: 'approval', by: 'مراجع', byRole: 'reviewer' });
  assert.equal(d.approvals.every((a) => !a.signedBy), true);
  assert.equal(chainKeyFor({ gateId: null, outcome: 'return' }), 'return');
  assert.equal(chainKeyFor({ gateId: null, outcome: 'hold' }), 'hold');
  assert.equal(chainKeyFor({ gateId: 'G3' }), 'G3');
});

test('المعلق لكل دور، وتنظيف السلاسل يرفض الأدوار غير الصالحة', () => {
  const a = buildDecision({ initiativeId: 'A', gateId: 'G2', to: 'readiness', by: 'ريم', byRole: 'pmo' });
  const b = buildDecision({ initiativeId: 'B', gateId: 'G0', to: 'study', by: 'ريم', byRole: 'pmo' });
  assert.equal(pendingForRole([a, b], 'supervisor').length, 1);
  assert.equal(pendingForRole([a, b], 'pmo').length, 0);
  assert.equal(pendingForRole([a, b], 'admin').length, 1);
  const c = sanitizeChains({ G2: ['pmo', 'partner', 'admin'], G9: ['x'], G0: [] });
  assert.deepEqual(c.G2, ['pmo', 'admin']);
  assert.deepEqual(c.G0, DEFAULT_CHAINS.G0);
});
