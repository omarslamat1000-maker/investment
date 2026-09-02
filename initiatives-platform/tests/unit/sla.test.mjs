// اختبارات SLA البوابات — العدادات ومستويات التصعيد وملخص التقادم
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slaStatus, agingSummary, stageEnteredAt, mergeSlaConfig, DEFAULT_SLA } from '../../js/domain/sla.js';

const NOW = '2026-09-01T00:00:00Z';
const ini = (status, enteredAt, extra = {}) => ({
  id: 'X', title: 'x', status,
  statusHistory: [{ from: 'draft', to: 'submitted', at: '2026-01-01T00:00:00Z' }, { from: 'submitted', to: status, at: enteredAt }],
  ...extra
});

test('تاريخ دخول المرحلة هو آخر انتقال إليها في السجل', () => {
  const i = ini('screening', '2026-08-20T00:00:00Z');
  assert.equal(stageEnteredAt(i), '2026-08-20T00:00:00Z');
});

test('يعود إلى تاريخ الإنشاء إن لم يوجد انتقال للحالة الحالية', () => {
  const i = { status: 'submitted', statusHistory: [], createdAt: '2026-08-25T00:00:00Z' };
  assert.equal(stageEnteredAt(i), '2026-08-25T00:00:00Z');
});

test('الفرز: 5 أيام من 14 → ضمن المدة', () => {
  const s = slaStatus(ini('screening', '2026-08-27T00:00:00Z'), DEFAULT_SLA, NOW);
  assert.equal(s.days, 5);
  assert.equal(s.limit, 14);
  assert.equal(s.level, 'ok');
  assert.equal(s.remaining, 9);
});

test('يقترب من الحد عندما يتبقى 20٪ أو 3 أيام', () => {
  const s = slaStatus(ini('screening', '2026-08-19T00:00:00Z'), DEFAULT_SLA, NOW); // 13 يومًا
  assert.equal(s.level, 'warn');
});

test('متجاوز بعد الحد مع عدد أيام التجاوز', () => {
  const s = slaStatus(ini('study', '2026-06-01T00:00:00Z'), DEFAULT_SLA, NOW);
  assert.equal(s.level, 'overdue');
  assert.ok(s.overdueDays > 50);
  assert.equal(s.percent, 100);
});

test('مرحلة التنفيذ لا تخضع لمؤقت بوابة', () => {
  assert.equal(slaStatus(ini('execution', '2026-01-01T00:00:00Z'), DEFAULT_SLA, NOW), null);
  assert.equal(slaStatus(ini('closed', '2026-01-01T00:00:00Z'), DEFAULT_SLA, NOW), null);
});

test('ملخص التقادم يعدّ المتجاوزة والمقتربة لكل مرحلة ويرتب الأشد تأخرًا أولًا', () => {
  const list = [
    ini('screening', '2026-08-27T00:00:00Z'),
    ini('screening', '2026-07-01T00:00:00Z'),
    ini('study', '2026-05-01T00:00:00Z'),
    ini('execution', '2026-01-01T00:00:00Z')
  ];
  const s = agingSummary(list, DEFAULT_SLA, NOW);
  assert.equal(s.counts.tracked, 3);
  assert.equal(s.counts.overdue, 2);
  assert.equal(s.overdue[0].initiative.status, 'study');
  const scr = s.stages.find((x) => x.status === 'screening');
  assert.equal(scr.total, 2);
  assert.equal(scr.overdue, 1);
});

test('دمج الإعدادات يحترم الأيام المحفوظة ويتجاهل القيم غير الصالحة', () => {
  const c = mergeSlaConfig({ screening: { days: 10 }, study: 'abc', approval: -5 });
  assert.equal(c.screening.days, 10);
  assert.equal(c.study.days, DEFAULT_SLA.study.days);
  assert.equal(c.approval.days, DEFAULT_SLA.approval.days);
  assert.equal(c.screening.label, DEFAULT_SLA.screening.label);
});
