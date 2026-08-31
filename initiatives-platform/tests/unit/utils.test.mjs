// اختبارات الأدوات المساعدة والتعقيم
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { officialId, clamp, round, sum, groupBy, sortBy, percent, checksum, pick } from '../../js/core/utils.js';
import { escapeHtml, stripTags, html, raw, sanitizeRecord } from '../../js/core/sanitizer.js';
import { daysBetween, addDays, isOverdue } from '../../js/core/date-time.js';

test('المعرف الرسمي بأربع خانات مبطنة', () => {
  assert.equal(officialId('MDN-INIT', 2026, 7), 'MDN-INIT-2026-0007');
  assert.equal(officialId('MDN-NEED', 2026, 1234), 'MDN-NEED-2026-1234');
});

test('clamp وround وsum وpercent', () => {
  assert.equal(clamp(9, 1, 5), 5);
  assert.equal(round(1.256, 1), 1.3);
  assert.equal(sum([{ v: 2 }, { v: 3 }], (x) => x.v), 5);
  assert.equal(percent(1, 4), 25);
  assert.equal(percent(1, 0), 0);
});

test('groupBy وsortBy مع null في النهاية', () => {
  const g = groupBy([{ s: 'a' }, { s: 'b' }, { s: 'a' }], (x) => x.s);
  assert.equal(g.a.length, 2);
  const sorted = sortBy([{ v: null }, { v: 1 }, { v: 3 }], (x) => x.v);
  assert.equal(sorted[0].v, 1);
  assert.equal(sorted[2].v, null);
});

test('checksum ثابت للنص نفسه ومختلف لنص آخر', () => {
  assert.equal(checksum('نص'), checksum('نص'));
  assert.notEqual(checksum('نص'), checksum('نص آخر'));
});

test('escapeHtml يعقّم الوسوم والاقتباسات', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(escapeHtml(`"و'`), '&quot;و&#39;');
});

test('قالب html`` يعقّم القيم ويحترم raw', () => {
  const out = html`<p>${'<b>خطر</b>'}</p>${raw('<i>موثوق</i>')}`;
  assert.equal(out, '<p>&lt;b&gt;خطر&lt;/b&gt;</p><i>موثوق</i>');
});

test('sanitizeRecord يزيل الوسوم من الحقول النصية المحددة فقط', () => {
  const r = sanitizeRecord({ title: '<script>x</script>عنوان', keep: '<b>t</b>' }, ['title']);
  assert.equal(r.title, 'xعنوان');
  assert.equal(r.keep, '<b>t</b>');
});

test('حسابات التواريخ', () => {
  assert.equal(daysBetween('2026-01-01', '2026-01-11'), 10);
  assert.equal(addDays('2026-01-01T00:00:00.000Z', 5).slice(0, 10), '2026-01-06');
  assert.equal(isOverdue('2000-01-01', null), true);
  assert.equal(isOverdue('2000-01-01', '2000-01-02'), false);
  assert.equal(isOverdue('2999-01-01', null), false);
});

test('pick يلتقط المفاتيح الموجودة فقط', () => {
  assert.deepEqual(pick({ a: 1, b: 2 }, ['a', 'c']), { a: 1 });
});
