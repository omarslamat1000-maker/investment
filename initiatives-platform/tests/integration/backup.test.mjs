// اختبارات تكامل النسخ الاحتياطي: التحقق من المخطط والاسم والمجموع
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBackup, BACKUP_APP_NAME, BACKUP_SCHEMA_VERSION, BACKUP_MIN_SCHEMA_VERSION } from '../../js/services/backup-service.js';
import { checksum } from '../../js/core/utils.js';

function goodPayload() {
  const records = { initiatives: [{ id: 'MDN-INIT-2026-0001' }], partners: [] };
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    applicationName: BACKUP_APP_NAME,
    exportedAt: '2026-08-30T00:00:00Z',
    exportedBy: 'اختبار',
    records,
    checksum: checksum(JSON.stringify(records))
  };
}

test('نسخة سليمة تجتاز التحقق', () => {
  assert.equal(validateBackup(goodPayload()).valid, true);
});

test('اسم تطبيق مختلف (نسخة من منصة أخرى) تُرفض', () => {
  const p = goodPayload();
  p.applicationName = 'منصة المواقع الاستثمارية بالمدينة المنورة';
  const r = validateBackup(p);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('اسم التطبيق')));
});

test('إصدار مخطط غير مدعوم يُرفض', () => {
  const p = goodPayload();
  p.schemaVersion = 99;
  assert.equal(validateBackup(p).valid, false);
});

test('نسخة بإصدار أقدم مدعوم (v1) تُقبل للاستعادة', () => {
  const p = goodPayload();
  p.schemaVersion = BACKUP_MIN_SCHEMA_VERSION;
  assert.equal(validateBackup(p).valid, true);
});

test('عبث بالسجلات يكسر مجموع التحقق', () => {
  const p = goodPayload();
  p.records.initiatives.push({ id: 'دخيل' });
  const r = validateBackup(p);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('مجموع التحقق')));
});

test('مخازن غير معروفة (مثل بيانات الأراضي) تُرفض', () => {
  const records = { lands: [{ id: 1 }] };
  const p = { ...goodPayload(), records, checksum: checksum(JSON.stringify(records)) };
  const r = validateBackup(p);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('مخازن غير معروفة')));
});

test('ملف فارغ يُرفض بوضوح', () => {
  assert.equal(validateBackup(null).valid, false);
  assert.equal(validateBackup('نص').valid, false);
});
