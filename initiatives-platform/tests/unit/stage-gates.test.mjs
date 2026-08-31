// اختبارات البوابات المرحلية وقوائم التحقق
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GATE_CHECKLIST_TEMPLATES, buildChecklist, gateReadiness, nextGateForStatus, gateTrack } from '../../js/domain/stage-gates.js';

test('لكل بوابة قائمة تحقق معيارية غير فارغة', () => {
  for (const gate of ['G0', 'G1', 'G2', 'G3', 'G4']) {
    assert.ok(GATE_CHECKLIST_TEMPLATES[gate].length >= 4, `بوابة ${gate}`);
  }
});

test('بناء قائمة تحقق يولّد بنودًا غير منجزة بمفاتيح فريدة', () => {
  const c = buildChecklist('G1', 'MDN-INIT-2026-0001');
  assert.equal(c.gateId, 'G1');
  assert.equal(c.items.every((i) => i.done === false), true);
  assert.equal(new Set(c.items.map((i) => i.key)).size, c.items.length);
});

test('الجاهزية 100٪ فقط عند اكتمال كل البنود', () => {
  const c = buildChecklist('G0', 'x');
  assert.equal(gateReadiness(c).ready, false);
  c.items.forEach((i) => { i.done = true; });
  const r = gateReadiness(c);
  assert.equal(r.ready, true);
  assert.equal(r.percent, 100);
});

test('البوابة القادمة لكل حالة صحيحة', () => {
  assert.equal(nextGateForStatus('screening').id, 'G0');
  assert.equal(nextGateForStatus('study').id, 'G1');
  assert.equal(nextGateForStatus('benefits').id, 'G4');
  assert.equal(nextGateForStatus('execution'), null);
});

test('مسار البوابات: التنفيذ يعني اجتياز G0..G3 وG4 حالية', () => {
  const track = gateTrack('execution');
  assert.deepEqual(track.map((g) => g.state), ['passed', 'passed', 'passed', 'passed', 'current']);
});

test('المغلقة تجتاز كل البوابات', () => {
  assert.ok(gateTrack('closed').every((g) => g.state === 'passed'));
});
