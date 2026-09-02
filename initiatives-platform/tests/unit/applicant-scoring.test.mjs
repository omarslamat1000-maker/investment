// اختبارات مفاضلة المتقدمين — النسبة المرجحة والترتيب والدرجات المقترحة
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applicantPercent, rankApplicants, suggestedScores, isFullyScored, percentBand, SCREENING_TOTAL_WEIGHT } from '../../js/domain/applicant-scoring.js';

test('مجموع أوزان المعايير 100', () => {
  assert.equal(SCREENING_TOTAL_WEIGHT, 100);
});

test('النسبة المرجحة: كل المعايير 5 → 100، وكلها 1 → 20', () => {
  const full = { readiness: 5, financial: 5, technical: 5, track: 5, modelFit: 5 };
  assert.equal(applicantPercent(full), 100);
  const low = { readiness: 1, financial: 1, technical: 1, track: 1, modelFit: 1 };
  assert.equal(applicantPercent(low), 20);
});

test('المعايير غير المقيَّمة تُحسب صفرًا وتُعلَّم كغير مكتملة', () => {
  const partial = { readiness: 5 };
  assert.equal(applicantPercent(partial), 30);
  assert.equal(isFullyScored(partial), false);
  assert.equal(applicantPercent({}), null);
});

test('الترتيب: الأعلى نسبة أولًا ثم الأقدم تقديمًا عند التساوي', () => {
  const ranked = rankApplicants([
    { id: 'a', at: '2026-08-10', scores: { readiness: 3, financial: 3, technical: 3, track: 3, modelFit: 3 } },
    { id: 'b', at: '2026-08-01', scores: { readiness: 5, financial: 4, technical: 4, track: 4, modelFit: 5 } },
    { id: 'c', at: '2026-08-05', scores: { readiness: 3, financial: 3, technical: 3, track: 3, modelFit: 3 } },
    { id: 'd', at: '2026-08-02', scores: {} }
  ]);
  assert.deepEqual(ranked.map((r) => r.id), ['b', 'c', 'a', 'd']);
  assert.equal(ranked[0].percent, 89);
});

test('الدرجات المقترحة: سجل الأداء من البطاقة وملاءمة النموذج من تفضيلات الفرصة', () => {
  const need = { preferredModels: ['execution', 'coFunding'] };
  assert.deepEqual(suggestedScores({ application: { model: 'execution' }, need, scorecard: { rating: 4 } }), { track: 4, modelFit: 5 });
  assert.deepEqual(suggestedScores({ application: { model: 'coFunding' }, need, scorecard: null }), { track: 3, modelFit: 4 });
  assert.equal(suggestedScores({ application: { model: 'sponsorship' }, need }).modelFit, 2);
  assert.equal(suggestedScores({ application: { model: 'sponsorship' }, need: { preferredModels: [] } }).modelFit, 4);
});

test('نطاقات النسبة', () => {
  assert.equal(percentBand(85).id, 'strong');
  assert.equal(percentBand(65).id, 'good');
  assert.equal(percentBand(45).id, 'fair');
  assert.equal(percentBand(10).id, 'weak');
  assert.equal(percentBand(null).id, 'none');
});
