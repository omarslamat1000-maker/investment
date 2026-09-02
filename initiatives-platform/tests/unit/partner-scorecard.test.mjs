// اختبارات بطاقة أداء الشريك المحسوبة
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partnerScorecard, ratingStars, scoreBandOf } from '../../js/domain/partner-scorecard.js';

const NOW = new Date('2026-09-01T00:00:00Z').getTime();
const links = [{ partnerId: 'P1', initiativeId: 'I1' }, { partnerId: 'P1', initiativeId: 'I2' }, { partnerId: 'P2', initiativeId: 'I3' }];
const initiatives = [
  { id: 'I1', status: 'closed' }, { id: 'I2', status: 'execution' }, { id: 'I3', status: 'study' }
];
const milestones = [
  { id: 'm1', initiativeId: 'I1', due: '2026-01-10', done: true, doneAt: '2026-01-09' },
  { id: 'm2', initiativeId: 'I1', due: '2026-02-10', done: true, doneAt: '2026-02-20' },
  { id: 'm3', initiativeId: 'I2', due: '2026-08-01', done: false, doneAt: null },
  { id: 'm4', initiativeId: 'I2', due: '2026-12-01', done: false, doneAt: null }
];
const benefits = [{ initiativeId: 'I1', baseline: 0, target: 100, actual: 90 }];
const qualityChecks = [{ initiativeId: 'I1', result: 'pass' }, { initiativeId: 'I2', result: 'fail' }];
const progressReports = [
  { partnerId: 'P1', status: 'approved' }, { partnerId: 'P1', status: 'approved' }, { partnerId: 'P1', status: 'rejected' }, { partnerId: 'P1', status: 'pending' }
];

test('يحسب المكونات من السجل الفعلي', () => {
  const c = partnerScorecard({ partnerId: 'P1', links, initiatives, milestones, benefits, qualityChecks, progressReports, now: NOW });
  const v = Object.fromEntries(c.components.map((x) => [x.id, x.value]));
  assert.equal(v.timeliness, 33);   // 1 في الوقت من (2 منجزة + 1 متأخرة مفتوحة)
  assert.equal(v.quality, 50);      // 1 من 2
  assert.equal(v.benefits, 90);
  assert.equal(v.reporting, 67);    // 2 معتمد من 3 مبتوت فيها (المعلق لا يُحسب)
  assert.equal(c.sample.initiatives, 2);
  assert.ok(c.overall > 0 && c.overall <= 100);
  assert.ok(c.rating >= 1 && c.rating <= 5);
});

test('المبادرات قبل التنفيذ لا تدخل في التقييم', () => {
  const c = partnerScorecard({ partnerId: 'P2', links, initiatives, milestones, benefits, qualityChecks, progressReports, now: NOW });
  assert.equal(c.overall, null);
  assert.equal(c.rating, null);
  assert.equal(c.band.id, 'new');
});

test('الوزن يُعاد توزيعه على المكونات المتاحة فقط', () => {
  const c = partnerScorecard({ partnerId: 'P1', links, initiatives: [{ id: 'I1', status: 'closed' }], milestones: [], benefits, qualityChecks: [], progressReports: [], now: NOW });
  assert.equal(c.overall, 90); // المنافع وحدها متاحة
  assert.equal(c.rating, 5);
});

test('النطاقات والنجوم', () => {
  assert.equal(scoreBandOf(90).id, 'excellent');
  assert.equal(scoreBandOf(72).id, 'good');
  assert.equal(scoreBandOf(55).id, 'fair');
  assert.equal(scoreBandOf(20).id, 'weak');
  assert.equal(ratingStars(3), '★★★☆☆');
  assert.equal(ratingStars(null), '—');
});
