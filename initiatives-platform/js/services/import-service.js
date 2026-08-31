// الاستيراد وتهيئة البيانات التجريبية — يزرع البيانات عند أول تشغيل فقط
import { dataProvider } from '../data/data-provider.js';
import { DEMO_INITIATIVES, DEMO_INITIATIVE_PARTNERS, DEMO_MILESTONES, DEMO_BENEFITS, DEMO_RISKS, DEMO_KPIS, DEMO_REVIEWS, DEMO_DECISIONS, DEMO_QUALITY_CHECKS } from '../../data/demo-initiatives.js';
import { DEMO_NEEDS } from '../../data/demo-needs.js';
import { DEMO_PARTNERS } from '../../data/demo-partners.js';
import { ORG_UNITS, DEMO_USERS, DEMO_CAMPAIGNS } from '../../data/reference-data.js';
import { nowIso } from '../core/date-time.js';
import { hashPassword, DEFAULT_PASSWORD } from './auth-service.js';

const SEED_FLAG_ID = 'seed-status';

export async function seedDemoDataIfEmpty() {
  const flag = await dataProvider.get('settings', SEED_FLAG_ID);
  if (flag?.seeded) return false;
  const count = await dataProvider.count('initiatives');
  if (count > 0) return false;

  const stamp = (r) => ({ createdAt: nowIso(), updatedAt: nowIso(), ...r });
  const defaultHash = await hashPassword(DEFAULT_PASSWORD);
  await dataProvider.bulkPut('organizationalUnits', ORG_UNITS.map(stamp));
  await dataProvider.bulkPut('users', DEMO_USERS.map((u) => stamp({ ...u, passwordHash: defaultHash })));
  await dataProvider.bulkPut('campaigns', DEMO_CAMPAIGNS.map(stamp));
  await dataProvider.bulkPut('partners', DEMO_PARTNERS.map(stamp));
  await dataProvider.bulkPut('infrastructureNeeds', DEMO_NEEDS.map(stamp));
  await dataProvider.bulkPut('initiatives', DEMO_INITIATIVES.map(stamp));
  await dataProvider.bulkPut('initiativePartners', DEMO_INITIATIVE_PARTNERS.map(stamp));
  await dataProvider.bulkPut('milestones', DEMO_MILESTONES.map(stamp));
  await dataProvider.bulkPut('benefits', DEMO_BENEFITS.map(stamp));
  await dataProvider.bulkPut('risks', DEMO_RISKS.map(stamp));
  await dataProvider.bulkPut('kpis', DEMO_KPIS.map(stamp));
  await dataProvider.bulkPut('reviews', DEMO_REVIEWS.map(stamp));
  await dataProvider.bulkPut('decisions', DEMO_DECISIONS.map(stamp));
  await dataProvider.bulkPut('qualityChecks', DEMO_QUALITY_CHECKS.map(stamp));
  await dataProvider.put('settings', { id: SEED_FLAG_ID, seeded: true, at: nowIso() });
  return true;
}

// استيراد نسخة احتياطية (كائن مفكوك مسبقًا) — يتحقق منها backup-service قبل الوصول هنا
export async function importRecords(records) {
  let total = 0;
  for (const [store, rows] of Object.entries(records || {})) {
    if (!Array.isArray(rows) || !rows.length) continue;
    await dataProvider.bulkPut(store, rows);
    total += rows.length;
  }
  return total;
}

// قراءة ملف JSON من input[type=file]
export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result)); }
      catch { reject(new Error('الملف ليس JSON صالحًا')); }
    };
    reader.onerror = () => reject(new Error('تعذرت قراءة الملف'));
    reader.readAsText(file);
  });
}
