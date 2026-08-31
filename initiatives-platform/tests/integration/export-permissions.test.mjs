// اختبارات تكامل: التصدير CSV ومصفوفة الصلاحيات وترحيلات القاعدة
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, toHtmlTable } from '../../js/services/export-service.js';
import { can, grantsFor } from '../../js/core/permissions.js';
import { MIGRATIONS, runMigrations } from '../../js/data/migrations.js';
import { OBJECT_STORES, DB_VERSION } from '../../js/core/constants.js';

test('CSV يحاط بعلامات اقتباس عند الفواصل ويبدأ بـ BOM', () => {
  const csv = toCsv([{ a: 'value, with comma', b: 'سطر"باقتباس' }], [
    { key: 'a', label: 'أ' }, { key: 'b', label: 'ب' }
  ]);
  assert.ok(csv.startsWith('﻿'));
  assert.ok(csv.includes('"value, with comma"'));
  assert.ok(csv.includes('"سطر""باقتباس"'));
});

test('toHtmlTable يعقّم المحتوى', () => {
  const out = toHtmlTable([{ x: '<script>1</script>' }], [{ key: 'x', label: 'س' }]);
  assert.ok(!out.includes('<script>'));
  assert.ok(out.includes('&lt;script&gt;'));
});

test('مدير النظام يملك كل شيء، والمطَّلع للعرض فقط', () => {
  assert.equal(can('admin', 'backup.run'), true);
  assert.equal(can('viewer', 'initiatives.view'), true);
  assert.equal(can('viewer', 'initiatives.edit'), false);
  assert.equal(can('viewer', 'backup.run'), false);
});

test('الشريك لا يدير الاحتياجات ولا القرارات', () => {
  assert.equal(can('partner', 'needs.publish'), false);
  assert.equal(can('partner', 'decisions.create'), false);
  assert.equal(can('partner', 'benefits.view'), true);
});

test('دور غير معروف بلا صلاحيات', () => {
  assert.equal(can('غريب', 'initiatives.view'), false);
  assert.deepEqual(grantsFor('غريب'), []);
});

test('الترحيلات تغطي حتى الإصدار الحالي وتنشئ كل المخازن', () => {
  assert.equal(Math.max(...MIGRATIONS.map((m) => m.version)), DB_VERSION);
  // قاعدة وهمية تلتقط المخازن المنشأة
  const created = new Set();
  const fakeDb = {
    objectStoreNames: { contains: (n) => created.has(n) },
    createObjectStore(name) {
      created.add(name);
      return { createIndex() { } };
    }
  };
  runMigrations(fakeDb, 0);
  for (const store of OBJECT_STORES) {
    assert.ok(created.has(store), `المخزن ${store} لم يُنشأ`);
  }
  assert.equal(created.size, OBJECT_STORES.length);
});

test('إعادة تشغيل الترحيل لا يكرر المخازن', () => {
  const created = [];
  const fakeDb = {
    objectStoreNames: { contains: (n) => created.includes(n) },
    createObjectStore(name) { created.push(name); return { createIndex() { } }; }
  };
  runMigrations(fakeDb, 0);
  runMigrations(fakeDb, 0);
  assert.equal(created.length, OBJECT_STORES.length);
});
