// الاستيراد وتهيئة البيانات التجريبية — زرع كامل عند أول تشغيل،
// وزرع تكميلي (top-up) عند رفع SEED_VERSION كي تصل الإضافات للمستخدمين القدامى دون مساس ببياناتهم
import { dataProvider } from '../data/data-provider.js';
import { DEMO_INITIATIVES, DEMO_PROPOSED_INITIATIVES, DEMO_PORTFOLIOS, DEMO_INITIATIVE_PARTNERS, DEMO_MILESTONES, DEMO_BENEFITS, DEMO_RISKS, DEMO_KPIS, DEMO_REVIEWS, DEMO_DECISIONS, DEMO_QUALITY_CHECKS } from '../../data/demo-initiatives.js';
import { DEMO_NEEDS } from '../../data/demo-needs.js';
import { DEMO_PARTNERS } from '../../data/demo-partners.js';
import { ORG_UNITS, DEMO_USERS, DEMO_CAMPAIGNS, DEMO_GALLERY, DEMO_NEED_APPLICATIONS, DEMO_PROGRESS_REPORTS, DEMO_AGREEMENTS, DEMO_EXTRA_LINKS_V7 } from '../../data/reference-data.js';
import { nowIso } from '../core/date-time.js';
import { hashPassword, DEFAULT_PASSWORD } from './auth-service.js';

const SEED_FLAG_ID = 'seed-status';
export const SEED_VERSION = 8; // v8: البيانات التفصيلية لطلبات التقديم التجريبية

const stamp = (r) => ({ createdAt: nowIso(), updatedAt: nowIso(), ...r });

export async function seedDemoDataIfEmpty() {
  // وضع السحابة: البيانات حقيقية في Supabase — لا زرع تجريبيًا إطلاقًا
  const { isCloudMode } = await import('../config.js');
  if (isCloudMode()) return false;
  const flag = await dataProvider.get('settings', SEED_FLAG_ID);
  const version = flag?.version || (flag?.seeded ? 1 : 0);
  if (version >= SEED_VERSION) return false;

  if (version === 0) {
    const count = await dataProvider.count('initiatives');
    if (count === 0) await fullSeed();
  } else {
    if (version < 2) await topUpToV2();
    if (version < 3) await topUpToV3();
    if (version < 4) await topUpToV4();
    if (version < 5) await topUpToV5();
    if (version < 6) await topUpToV6();
    if (version < 7) await topUpToV7();
    if (version < 8) await topUpToV8();
  }
  await dataProvider.put('settings', { id: SEED_FLAG_ID, seeded: true, version: SEED_VERSION, at: nowIso() });
  return true;
}

async function fullSeed() {
  const defaultHash = await hashPassword(DEFAULT_PASSWORD);
  await dataProvider.bulkPut('organizationalUnits', ORG_UNITS.map(stamp));
  await dataProvider.bulkPut('users', DEMO_USERS.map((u) => stamp({ ...u, passwordHash: defaultHash })));
  await dataProvider.bulkPut('campaigns', DEMO_CAMPAIGNS.map(stamp));
  await dataProvider.bulkPut('partners', DEMO_PARTNERS.map(stamp));
  await dataProvider.bulkPut('infrastructureNeeds', DEMO_NEEDS.map(stamp));
  await dataProvider.bulkPut('portfolios', DEMO_PORTFOLIOS.map(stamp));
  await dataProvider.bulkPut('initiatives', [...DEMO_INITIATIVES, ...DEMO_PROPOSED_INITIATIVES].map(stamp));
  await dataProvider.bulkPut('initiativePartners', [...DEMO_INITIATIVE_PARTNERS, ...DEMO_EXTRA_LINKS_V7].map(stamp));
  await dataProvider.bulkPut('milestones', DEMO_MILESTONES.map(stamp));
  await dataProvider.bulkPut('benefits', DEMO_BENEFITS.map(stamp));
  await dataProvider.bulkPut('risks', DEMO_RISKS.map(stamp));
  await dataProvider.bulkPut('kpis', DEMO_KPIS.map(stamp));
  await dataProvider.bulkPut('reviews', DEMO_REVIEWS.map(stamp));
  await dataProvider.bulkPut('decisions', DEMO_DECISIONS.map(stamp));
  await dataProvider.bulkPut('qualityChecks', DEMO_QUALITY_CHECKS.map(stamp));
  await dataProvider.bulkPut('gallery', DEMO_GALLERY.map(stamp));
  await dataProvider.bulkPut('needApplications', DEMO_NEED_APPLICATIONS.map(stamp));
  await dataProvider.bulkPut('progressReports', DEMO_PROGRESS_REPORTS.map(stamp));
  await dataProvider.bulkPut('agreements', DEMO_AGREEMENTS.map(stamp));
}

// v7 → v8: إضافة البيانات التفصيلية لطلبات التقديم التجريبية التي لا تملكها
async function topUpToV8() {
  const apps = await dataProvider.getAll('needApplications');
  for (const demo of DEMO_NEED_APPLICATIONS) {
    const current = apps.find((a) => a.id === demo.id);
    if (current && !current.details && demo.details) {
      await dataProvider.put('needApplications', { ...current, details: demo.details, updatedAt: nowIso() });
    }
  }
}

// v6 → v7: تقارير التقدم والاتفاقيات التجريبية + ربط شريك مبادرة الاعتماد (للمتصفحات القائمة)
async function topUpToV7() {
  const users = await dataProvider.getAll('users');
  if (!users.length) return; // منصة مُفرغة عمدًا
  const [reports, agreements, links] = await Promise.all([
    dataProvider.getAll('progressReports'), dataProvider.getAll('agreements'), dataProvider.getAll('initiativePartners')
  ]);
  if (!reports.length) await dataProvider.bulkPut('progressReports', DEMO_PROGRESS_REPORTS.map(stamp));
  if (!agreements.length) await dataProvider.bulkPut('agreements', DEMO_AGREEMENTS.map(stamp));
  const ids = new Set(links.map((l) => l.id));
  const fresh = DEMO_EXTRA_LINKS_V7.filter((l) => !ids.has(l.id));
  if (fresh.length) await dataProvider.bulkPut('initiativePartners', fresh.map(stamp));
}

// v5 → v6: طلبات التقديم التجريبية للمتصفحات القائمة
async function topUpToV6() {
  const existing = await dataProvider.getAll('needApplications');
  const users = await dataProvider.getAll('users');
  if (existing.length || !users.length) return;
  await dataProvider.bulkPut('needApplications', DEMO_NEED_APPLICATIONS.map(stamp));
}

// v4 → v5: معرض الصور للمتصفحات القائمة (إن لم يُفرغ المستخدم بياناته)
async function topUpToV5() {
  const existing = await dataProvider.getAll('gallery');
  const users = await dataProvider.getAll('users');
  if (existing.length || !users.length) return;
  await dataProvider.bulkPut('gallery', DEMO_GALLERY.map(stamp));
}

// v1 → v2: يضيف الجديد فقط ولا يلمس تعديلات المستخدم على السجلات القائمة
async function topUpToV2() {
  const existingPortfolios = await dataProvider.getAll('portfolios');
  if (!existingPortfolios.length) {
    await dataProvider.bulkPut('portfolios', DEMO_PORTFOLIOS.map(stamp));
  }
  const initiatives = await dataProvider.getAll('initiatives');
  const existingIds = new Set(initiatives.map((i) => i.id));
  const fresh = DEMO_PROPOSED_INITIATIVES.filter((p) => !existingIds.has(p.id));
  if (fresh.length) await dataProvider.bulkPut('initiatives', fresh.map(stamp));

  // ربط الحملات القائمة بالمحفظة وإضافة الهندسة للمبادرات المرجعية إن لم تُعدل
  const campaigns = await dataProvider.getAll('campaigns');
  for (const c of campaigns) {
    const seedCampaign = DEMO_CAMPAIGNS.find((d) => d.id === c.id);
    if (seedCampaign?.portfolioId && !c.portfolioId) {
      await dataProvider.put('campaigns', { ...c, portfolioId: seedCampaign.portfolioId, updatedAt: nowIso() });
    }
  }
  for (const seedIni of DEMO_INITIATIVES.filter((i) => i.geometry)) {
    const current = initiatives.find((i) => i.id === seedIni.id);
    if (current && !current.geometry) {
      await dataProvider.put('initiatives', { ...current, geometry: seedIni.geometry, updatedAt: nowIso() });
    }
  }
}

// v2 → v3: التدرج الهرمي — مواقع متعددة وربط الحملات، دون مساس بتعديلات المستخدم
async function topUpToV3() {
  const initiatives = await dataProvider.getAll('initiatives');
  const seedById = new Map(
    [...DEMO_INITIATIVES, ...DEMO_PROPOSED_INITIATIVES].map((i) => [i.id, i])
  );
  for (const current of initiatives) {
    const seed = seedById.get(current.id);
    if (!seed) continue;
    const patch = {};
    // تحويل الهندسة المفردة إلى مواقع متعددة (فقط إن لم يعدّل المستخدم المواقع)
    if (seed.sites?.length && !(current.sites?.length)) {
      patch.sites = seed.sites;
      patch.geometry = null;
    }
    if (seed.campaignId && !current.campaignId) patch.campaignId = seed.campaignId;
    if (seed.portfolioId && !current.portfolioId) patch.portfolioId = seed.portfolioId;
    if (Object.keys(patch).length) {
      await dataProvider.put('initiatives', { ...current, ...patch, updatedAt: nowIso() });
    }
  }
}

// حذف جميع البيانات (الوضع المحلي) — تُمسح المخازن ويُثبَّت علم الزرع كي لا تعود البيانات التجريبية
export async function wipeAllLocalData() {
  const { OBJECT_STORES } = await import('../core/constants.js');
  for (const store of OBJECT_STORES) {
    await dataProvider.clear(store);
  }
  await dataProvider.put('settings', { id: SEED_FLAG_ID, seeded: true, version: SEED_VERSION, wiped: true, at: nowIso() });
}

// استعادة البيانات التجريبية من الصفر (الوضع المحلي)
export async function resetDemoData() {
  const { OBJECT_STORES } = await import('../core/constants.js');
  for (const store of OBJECT_STORES) {
    await dataProvider.clear(store);
  }
  await fullSeed();
  await dataProvider.put('settings', { id: SEED_FLAG_ID, seeded: true, version: SEED_VERSION, at: nowIso() });
}

// v3 → v4: إضافة حسابات الجهات الشريكة للمتصفحات القائمة (إن لم يحذف المستخدم بياناته)
async function topUpToV4() {
  const existing = await dataProvider.getAll('users');
  if (!existing.length) return; // منصة مُفرغة عمدًا — لا نعيد الزرع
  const ids = new Set(existing.map((u) => u.id));
  const defaultHash = await hashPassword(DEFAULT_PASSWORD);
  const fresh = DEMO_USERS.filter((u) => u.partnerId && !ids.has(u.id));
  if (fresh.length) {
    await dataProvider.bulkPut('users', fresh.map((u) => stamp({ ...u, passwordHash: defaultHash })));
  }
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
