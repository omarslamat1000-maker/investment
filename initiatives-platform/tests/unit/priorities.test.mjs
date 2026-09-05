// اختبارات أولويات المحفظة وسيناريو الميزانية
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priorityScore, prioritizeInitiatives, budgetScenario, estimatedCost } from '../../js/domain/priorities.js';

test('التكلفة التقديرية من الميزانية وإلا من منتصف النطاق', () => {
  assert.equal(estimatedCost({ budget: 2_000_000, costBand: 'gt20m' }), 2_000_000);
  assert.equal(estimatedCost({ costBand: '5to20m' }), 12_500_000);
  assert.equal(estimatedCost({ costBand: 'tbd' }), 0);
});

test('الدرجة تكافئ الأثر والإلحاح والجاهزية وتخصم للتكلفة', () => {
  const cheapReady = { priorityInputs: { impact: 5, urgency: 5 }, readinessLevel: 'ready', costBand: 'lt1m' };
  const costlyIdea = { priorityInputs: { impact: 5, urgency: 5 }, readinessLevel: 'idea', costBand: 'gt20m' };
  assert.ok(priorityScore(cheapReady) > priorityScore(costlyIdea));
  assert.ok(priorityScore(cheapReady) >= 95);
  assert.equal(priorityScore({}), priorityScore({ priorityInputs: { impact: 3, urgency: 3 }, readinessLevel: '' }));
});

test('الترتيب يستبعد المسودات والمعتذر عنها ويرتب تنازليًا', () => {
  const list = prioritizeInitiatives([
    { id: 'a', status: 'submitted', readinessLevel: 'idea', costBand: 'gt20m', priorityInputs: { impact: 2, urgency: 2 } },
    { id: 'b', status: 'submitted', readinessLevel: 'ready', costBand: 'lt1m', priorityInputs: { impact: 5, urgency: 4 } },
    { id: 'c', status: 'draft', readinessLevel: 'ready', costBand: 'lt1m' },
    { id: 'd', status: 'rejected', readinessLevel: 'ready', costBand: 'lt1m' }
  ]);
  assert.deepEqual(list.map((r) => r.initiative.id), ['b', 'a']);
  assert.equal(list[0].manual, true);
});

test('سيناريو الميزانية يختار بالترتيب حتى نفاد السقف', () => {
  const ranked = prioritizeInitiatives([
    { id: 'a', status: 'submitted', readinessLevel: 'ready', budget: 3_000_000, priorityInputs: { impact: 5, urgency: 5 } },
    { id: 'b', status: 'submitted', readinessLevel: 'sited', budget: 5_000_000, priorityInputs: { impact: 4, urgency: 4 } },
    { id: 'c', status: 'submitted', readinessLevel: 'idea', budget: 1_000_000, priorityInputs: { impact: 2, urgency: 2 } }
  ]);
  const sc = budgetScenario(ranked, 4_500_000);
  assert.deepEqual(sc.selected.map((r) => r.initiative.id), ['a', 'c']);
  assert.equal(sc.deferred.length, 1);
  assert.equal(sc.remaining, 500_000);
});
