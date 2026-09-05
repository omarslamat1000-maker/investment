// اختبارات تكامل: اتساق بيانات المبادرات الحقيقية (نموذج احتياج المبادرات المستقبلية) مع النماذج والمراجع
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_INITIATIVES, DEMO_PROPOSED_INITIATIVES, DEMO_PORTFOLIOS, DEMO_INITIATIVE_PARTNERS, DEMO_MILESTONES, DEMO_BENEFITS, DEMO_RISKS, DEMO_DECISIONS, DEMO_REVIEWS, DEMO_QUALITY_CHECKS } from '../../data/demo-initiatives.js';
import { DEMO_NEEDS } from '../../data/demo-needs.js';
import { DEMO_PARTNERS } from '../../data/demo-partners.js';
import { validateInitiative } from '../../js/domain/initiative-model.js';
import { validateNeed } from '../../js/domain/infrastructure-need-model.js';
import { validatePartner } from '../../js/domain/partner-model.js';
import { STATUSES, GATES, DISTRICTS, DISTRICT_CENTROIDS, CATEGORIES } from '../../js/core/constants.js';
import { DEMO_CAMPAIGNS, DEMO_GALLERY, DEMO_PROGRESS_REPORTS, DEMO_AGREEMENTS, DEMO_NEED_APPLICATIONS } from '../../data/reference-data.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const iniIds = new Set(DEMO_INITIATIVES.map((i) => i.id));
const partnerIds = new Set(DEMO_PARTNERS.map((p) => p.id));

test('المبادرات الحقيقية: 19 مبادرة كلها تجتاز تحقق النموذج', () => {
  assert.equal(DEMO_INITIATIVES.length, 19);
  for (const ini of DEMO_INITIATIVES) {
    const r = validateInitiative(ini);
    assert.equal(r.valid, true, `${ini.id}: ${JSON.stringify(r.errors)}`);
  }
});

test('كل مبادرة تحمل حقول قالب التعريف: المشكلة والحل والفئات والأثر والجهة المقدمة', () => {
  for (const ini of DEMO_INITIATIVES) {
    for (const f of ['problem', 'summary', 'beneficiaryGroups', 'expectedImpact', 'submitterEntity', 'location']) {
      assert.ok(String(ini[f] || '').trim().length >= 3, `${ini.id}: الحقل ${f} فارغ`);
    }
    assert.ok(/وكالة البنية التحتية/.test(ini.submitterEntity), `${ini.id}: الجهة المقدمة`);
    assert.equal(ini.status, 'submitted', `${ini.id}: المبادرات المستقبلية تُزرع بحالة مقدَّمة`);
    assert.ok(ini.statusHistory.length >= 1);
  }
});

test('كل احتياج وشريك تجريبي صالح', () => {
  for (const n of DEMO_NEEDS) assert.equal(validateNeed(n).valid, true, n.id);
  for (const p of DEMO_PARTNERS) assert.equal(validatePartner(p).valid, true, p.id);
});

test('المعرفات فريدة عبر كل مجموعة', () => {
  assert.equal(iniIds.size, DEMO_INITIATIVES.length);
  assert.equal(partnerIds.size, DEMO_PARTNERS.length);
  assert.equal(new Set(DEMO_NEEDS.map((n) => n.id)).size, DEMO_NEEDS.length);
  assert.equal(new Set(DEMO_GALLERY.map((g) => g.id)).size, DEMO_GALLERY.length);
});

test('لا سجلات تنفيذ تجريبية مرتبطة بالمبادرات الحقيقية (دقة البيانات)', () => {
  for (const list of [DEMO_PROPOSED_INITIATIVES, DEMO_INITIATIVE_PARTNERS, DEMO_MILESTONES, DEMO_BENEFITS,
    DEMO_RISKS, DEMO_DECISIONS, DEMO_REVIEWS, DEMO_QUALITY_CHECKS, DEMO_PROGRESS_REPORTS, DEMO_AGREEMENTS]) {
    assert.equal(list.length, 0);
  }
  for (const n of DEMO_NEEDS) assert.equal(n.matchedInitiativeId, null, `${n.id}: يشير لمبادرة تجريبية محذوفة`);
  for (const a of DEMO_NEED_APPLICATIONS) assert.ok(!a.resultInitiativeId, a.id);
});

test('حالات المبادرات والتصنيفات والأحياء ضمن القيم المعرفة', () => {
  const catIds = new Set(CATEGORIES.map((c) => c.id));
  for (const ini of DEMO_INITIATIVES) {
    assert.ok(STATUSES[ini.status], ini.id);
    assert.ok(catIds.has(ini.category), `${ini.id}: تصنيف ${ini.category}`);
    if (ini.district) assert.ok(DISTRICTS.includes(ini.district), `${ini.id}: منطقة ${ini.district}`);
  }
  const gateIds = new Set(GATES.map((g) => g.id));
  for (const d of DEMO_DECISIONS) assert.ok(gateIds.has(d.gateId), d.id);
});

test('كل حي له مركز مرجعي للخريطة إلا التصنيفات العامة', () => {
  for (const d of DISTRICTS) {
    if (['عموم المدينة', 'غير محدد'].includes(d)) continue;
    assert.ok(Array.isArray(DISTRICT_CENTROIDS[d]) && DISTRICT_CENTROIDS[d].length === 2, `لا مركز للحي ${d}`);
  }
});

test('المحفظة: كل المبادرات تتبع محفظة موجودة والحملات تشير إلى المحفظة نفسها', () => {
  const pfIds = new Set(DEMO_PORTFOLIOS.map((p) => p.id));
  for (const ini of DEMO_INITIATIVES) assert.ok(pfIds.has(ini.portfolioId), `${ini.id}: محفظة غير موجودة`);
  for (const c of DEMO_CAMPAIGNS) assert.ok(pfIds.has(c.portfolioId), `الحملة ${c.id}: محفظة غير موجودة`);
  const campaignIds = new Set(DEMO_CAMPAIGNS.map((c) => c.id));
  for (const ini of DEMO_INITIATIVES.filter((i) => i.campaignId)) assert.ok(campaignIds.has(ini.campaignId), ini.id);
});

test('المواقع الجغرافية: إحداثيات المدينة المنورة من روابط الخرائط المرفقة', () => {
  const withSites = DEMO_INITIATIVES.filter((i) => i.sites?.length);
  assert.ok(withSites.length >= 14, 'الغالبية لها موقع محدد');
  for (const i of withSites) {
    const ids = new Set(i.sites.map((s) => s.id));
    assert.equal(ids.size, i.sites.length, `${i.id}: معرفات مواقع مكررة`);
    for (const s of i.sites) {
      assert.ok(s.name, `${i.id}/${s.id}: موقع بلا اسم`);
      assert.equal(s.geometry.type, 'point');
      for (const [lat, lng] of s.geometry.coords) {
        assert.ok(lat > 24.3 && lat < 24.7 && lng > 39.4 && lng < 39.8, `${i.id}: إحداثيات خارج المدينة المنورة`);
      }
    }
    assert.equal(i.lat, i.sites[0].geometry.coords[0][0]);
  }
  // المبادرات بلا موقع محدد هي ذات النطاق العام أو التي لم يُصحَّح رابطها
  for (const i of DEMO_INITIATIVES.filter((x) => !x.sites?.length)) assert.equal(i.lat, null, i.id);
});

test('صور المبادرات موجودة فعليًا في مجلد الأصول ومعرض الصور يغطي كل مبادرة', () => {
  for (const ini of DEMO_INITIATIVES) {
    assert.ok(ini.imageDataUrl?.startsWith('./assets/initiatives/'), `${ini.id}: لا صورة`);
    assert.ok(existsSync(join(ROOT, ini.imageDataUrl)), `${ini.id}: ملف الصورة مفقود ${ini.imageDataUrl}`);
  }
  assert.equal(DEMO_GALLERY.length, DEMO_INITIATIVES.length);
  for (const g of DEMO_GALLERY) {
    assert.ok(iniIds.has(g.initiativeId), `${g.id}: مبادرة غير موجودة`);
    assert.ok(existsSync(join(ROOT, g.imageDataUrl)), `${g.id}: صورة مفقودة`);
  }
});
