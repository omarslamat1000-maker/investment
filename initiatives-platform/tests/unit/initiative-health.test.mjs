// اختبارات مؤشر صحة المبادرة
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initiativeHealth, scheduleHealth, budgetHealth } from '../../js/domain/initiative-health.js';

function iso(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

test('مبادرة بلا مخاطر ولا تأخر = سليمة', () => {
  const h = initiativeHealth(
    { status: 'execution', startDate: iso(-10), endDate: iso(90), budget: 100, spent: 5 },
    { milestones: [{ done: true }, { done: false }], risks: [], benefits: [] }
  );
  assert.equal(h.id, 'green');
});

test('خطر حرج مفتوح يجعلها متعثرة', () => {
  const h = initiativeHealth(
    { status: 'execution' },
    { risks: [{ probability: 4, impact: 4, status: 'open' }] }
  );
  assert.equal(h.id, 'red');
  assert.ok(h.reasons.some((r) => r.includes('حرج')));
});

test('خطر مرتفع مفتوح يجعلها تحتاج متابعة', () => {
  const h = initiativeHealth(
    { status: 'execution' },
    { risks: [{ probability: 2, impact: 4, status: 'open' }] }
  );
  assert.equal(h.id, 'amber');
});

test('تأخر جدولي كبير (كل الزمن مضى بلا إنجاز) = متعثرة', () => {
  const h = initiativeHealth(
    { status: 'execution', startDate: iso(-100), endDate: iso(-1) },
    { milestones: [{ done: false }, { done: false }], risks: [], benefits: [] }
  );
  assert.equal(h.id, 'red');
});

test('scheduleHealth يعيد null بلا تواريخ أو معالم', () => {
  assert.equal(scheduleHealth({}, []), null);
  assert.equal(scheduleHealth({ startDate: iso(-1), endDate: iso(1) }, []), null);
});

test('budgetHealth يحسب نسبة الصرف', () => {
  assert.equal(budgetHealth({ budget: 200, spent: 50 }).usedPercent, 25);
  assert.equal(budgetHealth({ budget: 0 }), null);
});
