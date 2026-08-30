// اختبارات نموذج المفاضلة
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weightedScore, scoreBand, gateRecommendation, criteriaWithScores } from '../../js/domain/scoring.js';

test('الدرجة الكاملة (5 في كل معيار) تساوي 100', () => {
  assert.equal(weightedScore({ strategic: 5, impact: 5, feasibility: 5, readiness: 5, risk: 5 }), 100);
});

test('الدرجة الدنيا (1 في كل معيار) تساوي 20', () => {
  assert.equal(weightedScore({ strategic: 1, impact: 1, feasibility: 1, readiness: 1, risk: 1 }), 20);
});

test('درجات مبادرة التشجير التجريبية = 92', () => {
  // 5*25 + 5*25 + 4/5*20 + 5/5*15 + 4/5*15 = 25+25+16+15+12 = 93؟ لنحسب: 1*25 + 1*25 + 0.8*20 + 1*15 + 0.8*15
  const s = weightedScore({ strategic: 5, impact: 5, feasibility: 4, readiness: 5, risk: 4 });
  assert.equal(s, 25 + 25 + 16 + 15 + 12);
});

test('بلا درجات تعود null وتُعرض «غير مُقيَّمة»', () => {
  assert.equal(weightedScore({}), null);
  assert.equal(scoreBand(null).id, 'none');
});

test('النطاقات: 80+ أولوية قصوى، 65+ مرشحة بقوة، 50+ بشروط، أقل ضعيفة', () => {
  assert.equal(scoreBand(85).id, 'priority');
  assert.equal(scoreBand(70).id, 'strong');
  assert.equal(scoreBand(55).id, 'conditional');
  assert.equal(scoreBand(40).id, 'weak');
});

test('التوصية تتبع النطاق', () => {
  assert.match(gateRecommendation(90), /اعتماد/);
  assert.match(gateRecommendation(30), /الاعتذار|إعادة/);
});

test('القيم خارج النطاق تُقصّ إلى 1..5', () => {
  const over = weightedScore({ strategic: 9, impact: 5, feasibility: 5, readiness: 5, risk: 5 });
  assert.equal(over, 100);
});

test('criteriaWithScores يعيد الوزن المحسوب لكل معيار', () => {
  const rows = criteriaWithScores({ strategic: 5 });
  const strategic = rows.find((r) => r.id === 'strategic');
  assert.equal(strategic.weighted, 25);
  assert.equal(rows.length, 5);
});
