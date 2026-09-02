// اختبارات البيانات التفصيلية لطلبات التقديم — التنظيف والمقارنة والاقتراح الآلي
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeDetails, bestApplicantsByField, suggestFromDetails, detailsCompleteness, comparableValue, fieldById } from '../../js/domain/application-details.js';
import { effectiveCriteria, applicantPercent, sanitizeCriteria, suggestedScores } from '../../js/domain/applicant-scoring.js';

test('التنظيف: أرقام موجبة ونسبة بسقف 100 وخيارات صالحة ونصوص مقصوصة', () => {
  const d = sanitizeDetails({ contributionAmount: '500000', contributionPercent: 140, durationMonths: -3, readinessLevel: 'bogus', startReadyDate: '2026-10-01', addedValue: '  قيمة  ', teamSize: '' });
  assert.equal(d.contributionAmount, 500000);
  assert.equal(d.contributionPercent, 100);
  assert.equal(d.durationMonths, undefined);
  assert.equal(d.readinessLevel, undefined);
  assert.equal(d.startReadyDate, '2026-10-01');
  assert.equal(d.addedValue, 'قيمة');
  assert.equal('teamSize' in d, false);
});

test('الأفضل في كل حقل: الأعلى للمساهمة والأقل للمدة مع التعادل', () => {
  const apps = [
    { id: 'a', details: { contributionAmount: 100, durationMonths: 6, warrantyMonths: 12 } },
    { id: 'b', details: { contributionAmount: 300, durationMonths: 4, warrantyMonths: 12 } },
    { id: 'c', details: { contributionAmount: 300, durationMonths: 9 } }
  ];
  const best = bestApplicantsByField(apps);
  assert.deepEqual(best.contributionAmount, ['b', 'c']);
  assert.deepEqual(best.durationMonths, ['b']);
  assert.deepEqual(best.warrantyMonths, ['a', 'b']);
  assert.deepEqual(best.teamSize, []); // لا قيم
});

test('الاقتراح الآلي من التفاصيل: المساهمة والجاهزية والخبرة', () => {
  const s = suggestFromDetails({ contributionPercent: 100, readinessLevel: 'ready', durationMonths: 3, similarProjectsCount: 6, teamSize: 20 }, {});
  assert.deepEqual(s, { financial: 5, readiness: 5, technical: 5 });
  const w = suggestFromDetails({ contributionAmount: 100000, readinessLevel: 'idea', durationMonths: 18, similarProjectsCount: 0 }, { estimatedCost: 1000000 });
  assert.equal(w.financial, 2); // 10٪
  assert.equal(w.readiness, 2); // (1 + 2) / 2 → 2
  assert.equal(w.technical, 2);
  assert.deepEqual(suggestFromDetails({}, {}), {});
});

test('الاكتمال وقيمة المقارنة', () => {
  assert.equal(detailsCompleteness({}).percent, 0);
  assert.equal(detailsCompleteness({ contributionAmount: 1, durationMonths: 2 }).filled, 2);
  assert.equal(comparableValue(fieldById('readinessLevel'), 'ready'), 4);
  assert.equal(comparableValue(fieldById('startReadyDate'), 'x'), null);
});

test('المعايير الفعلية = العامة + الإضافية للفرصة، والنسبة تُطبَّع على مجموع الأوزان', () => {
  const need = { extraCriteria: [{ id: 'local', label: 'توظيف محلي', weight: 20 }, { id: 'readiness', label: 'مكرر', weight: 10 }] };
  const crit = effectiveCriteria(undefined, need);
  assert.equal(crit.length, 6);
  assert.equal(crit.find((c) => c.id === 'local').scope, 'need');
  assert.equal(crit.find((c) => c.id === 'readiness').weight, 30); // لا يُستبدل العام
  const full = Object.fromEntries(crit.map((c) => [c.id, 5]));
  assert.equal(applicantPercent(full, crit), 100);
  assert.equal(applicantPercent({ local: 5 }, crit), Math.round((20 / 120) * 100));
});

test('تنظيف المعايير يرفض الأوزان غير الموجبة والتكرار', () => {
  const clean = sanitizeCriteria([{ id: 'x', label: 'أ', weight: 0 }, { id: 'y', label: 'ب', weight: 10 }, { id: 'y', label: 'ج', weight: 5 }, { label: '', weight: 5 }]);
  assert.equal(clean.length, 1);
  assert.equal(clean[0].id, 'y');
});

test('الدرجات المقترحة الكاملة تدمج التفاصيل مع البطاقة والنموذج', () => {
  const s = suggestedScores({ application: { model: 'execution', details: { contributionPercent: 60 } }, need: { preferredModels: ['execution'] }, scorecard: { rating: 4 } });
  assert.equal(s.financial, 4);
  assert.equal(s.track, 4);
  assert.equal(s.modelFit, 5);
});
