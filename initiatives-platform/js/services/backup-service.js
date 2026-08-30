// النسخ الاحتياطي والاستعادة — بيانات هذه المنصة فقط، بمخطط موثّق ومجموع تحقق
import { dataProvider } from '../data/data-provider.js';
import { OBJECT_STORES } from '../core/constants.js';
import { checksum } from '../core/utils.js';
import { nowIso, todayYmd } from '../core/date-time.js';
import { getUserName } from '../core/state.js';
import { importRecords } from './import-service.js';

export const BACKUP_APP_NAME = 'منصة مبادرات البنية التحتية والشراكات المجتمعية';
export const BACKUP_SCHEMA_VERSION = 1;

export async function buildBackup() {
  const records = {};
  for (const store of OBJECT_STORES) {
    records[store] = await dataProvider.getAll(store);
  }
  const payload = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    applicationName: BACKUP_APP_NAME,
    exportedAt: nowIso(),
    exportedBy: getUserName(),
    records
  };
  payload.checksum = checksum(JSON.stringify(records));
  return payload;
}

export function backupFileName() {
  return `madinah-initiatives-backup-${todayYmd()}.json`;
}

export async function downloadBackup() {
  const payload = await buildBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName();
  a.click();
  URL.revokeObjectURL(url);
  return payload;
}

// التحقق قبل الاستعادة: اسم التطبيق وإصدار المخطط والمجموع
export function validateBackup(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') errors.push('الملف فارغ أو غير مقروء');
  else {
    if (payload.applicationName !== BACKUP_APP_NAME) {
      errors.push('النسخة لا تخص هذه المنصة — اسم التطبيق غير مطابق');
    }
    if (payload.schemaVersion !== BACKUP_SCHEMA_VERSION) {
      errors.push(`إصدار المخطط ${payload.schemaVersion} غير مدعوم (المتوقع ${BACKUP_SCHEMA_VERSION})`);
    }
    if (!payload.records || typeof payload.records !== 'object') {
      errors.push('النسخة لا تحتوي على سجلات');
    } else if (payload.checksum) {
      const actual = checksum(JSON.stringify(payload.records));
      if (actual !== payload.checksum) errors.push('مجموع التحقق غير مطابق — الملف قد يكون تالفًا');
    }
    const unknown = Object.keys(payload.records || {}).filter((s) => !OBJECT_STORES.includes(s));
    if (unknown.length) errors.push(`مخازن غير معروفة في النسخة: ${unknown.join('، ')}`);
  }
  return { valid: errors.length === 0, errors };
}

export async function restoreBackup(payload, { replace = false } = {}) {
  const check = validateBackup(payload);
  if (!check.valid) throw new Error(check.errors.join(' — '));
  if (replace) {
    for (const store of OBJECT_STORES) await dataProvider.clear(store);
  }
  const total = await importRecords(payload.records);
  return { restored: total };
}
