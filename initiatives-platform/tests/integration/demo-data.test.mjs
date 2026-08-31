// اختبارات تكامل: اتساق البيانات التجريبية مع النماذج والمراجع
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_INITIATIVES, DEMO_PROPOSED_INITIATIVES, DEMO_PORTFOLIOS, DEMO_INITIATIVE_PARTNERS, DEMO_MILESTONES, DEMO_BENEFITS, DEMO_RISKS, DEMO_DECISIONS, DEMO_REVIEWS, DEMO_QUALITY_CHECKS } from '../../data/demo-initiatives.js';
import { DEMO_NEEDS } from '../../data/demo-needs.js';
import { DEMO_PARTNERS } from '../../data/demo-partners.js';
import { validateInitiative } from '../../js/domain/initiative-model.js';
import { validateNeed } from '../../js/domain/infrastructure-need-model.js';
import { validatePartner } from '../../js/domain/partner-model.js';
import { STATUSES, GATES } from '../../js/core/constants.js';
import { DEMO_CAMPAIGNS } from '../../data/reference-data.js';

const iniIds = new Set(DEMO_INITIATIVES.map((i) => i.id));
const partnerIds = new Set(DEMO_PARTNERS.map((p) => p.id));

test('كل مبادرة تجريبية تجتاز تحقق النموذج', () => {
  for (const ini of DEMO_INITIATIVES) {
    const r = validateInitiative(ini);
    assert.equal(r.valid, true, `${ini.id}: ${JSON.stringify(r.errors)}`);
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
});

test('كل السجلات المرتبطة تشير إلى مبادرات موجودة', () => {
  const linked = [
    ...DEMO_INITIATIVE_PARTNERS, ...DEMO_MILESTONES, ...DEMO_BENEFITS,
    ...DEMO_RISKS, ...DEMO_DECISIONS, ...DEMO_REVIEWS, ...DEMO_QUALITY_CHECKS
  ];
  for (const rec of linked) {
    assert.ok(iniIds.has(rec.initiativeId), `${rec.id} يشير لمبادرة غير موجودة: ${rec.initiativeId}`);
  }
});

test('روابط الشركاء تشير إلى شركاء موجودين', () => {
  for (const l of DEMO_INITIATIVE_PARTNERS) {
    assert.ok(partnerIds.has(l.partnerId), `${l.id}: شريك غير موجود`);
  }
});

test('حالات المبادرات وبوابات القرارات ضمن القيم المعرفة', () => {
  for (const ini of DEMO_INITIATIVES) assert.ok(STATUSES[ini.status], ini.id);
  const gateIds = new Set(GATES.map((g) => g.id));
  for (const d of DEMO_DECISIONS) assert.ok(gateIds.has(d.gateId), d.id);
});

test('الاحتياج المتبنى يشير إلى مبادرة موجودة', () => {
  for (const n of DEMO_NEEDS.filter((n) => n.matchedInitiativeId)) {
    assert.ok(iniIds.has(n.matchedInitiativeId), n.id);
  }
});

test('تغطية دورة الحياة: توجد مبادرات في التنفيذ والمنافع والإغلاق والاعتذار', () => {
  const statuses = new Set(DEMO_INITIATIVES.map((i) => i.status));
  for (const s of ['execution', 'benefits', 'closed', 'rejected', 'submitted']) {
    assert.ok(statuses.has(s), `لا مبادرة بحالة ${s}`);
  }
});

test('محفظة المبادرات المقترحة: 14 مبادرة صالحة كلها مرتبطة بمحفظة موجودة', () => {
  assert.equal(DEMO_PROPOSED_INITIATIVES.length, 14);
  const pfIds = new Set(DEMO_PORTFOLIOS.map((p) => p.id));
  const ids = new Set();
  for (const ini of DEMO_PROPOSED_INITIATIVES) {
    const r = validateInitiative(ini);
    assert.equal(r.valid, true, `${ini.id}: ${JSON.stringify(r.errors)}`);
    assert.ok(pfIds.has(ini.portfolioId), `${ini.id}: محفظة غير موجودة`);
    assert.ok(!iniIds.has(ini.id), `${ini.id}: يتعارض مع مبادرة أساسية`);
    ids.add(ini.id);
  }
  assert.equal(ids.size, 14);
});

test('مواقع المبادرات التجريبية سليمة البنية ومنها متعددة المواقع', () => {
  const withSites = DEMO_INITIATIVES.filter((i) => i.sites?.length);
  assert.ok(withSites.length >= 3, 'يلزم ثلاثة أمثلة على الأقل بمواقع');
  assert.ok(withSites.some((i) => i.sites.length >= 2), 'يلزم مثال بمواقع متعددة');
  for (const i of withSites) {
    const ids = new Set(i.sites.map((s) => s.id));
    assert.equal(ids.size, i.sites.length, `${i.id}: معرفات مواقع مكررة`);
    for (const s of i.sites) {
      assert.ok(s.name, `${i.id}/${s.id}: موقع بلا اسم`);
      assert.ok(['point', 'line', 'polygon'].includes(s.geometry.type), `${i.id}/${s.id}`);
      assert.ok(s.geometry.coords.every((c) => Array.isArray(c) && c.length === 2), `${i.id}/${s.id}`);
      if (s.geometry.type === 'polygon') assert.ok(s.geometry.coords.length >= 3, `${i.id}/${s.id}`);
      if (s.geometry.type === 'line') assert.ok(s.geometry.coords.length >= 2, `${i.id}/${s.id}`);
    }
  }
});

test('التدرج الهرمي: كل مبادرة في حملة تتبع محفظة الحملة نفسها', () => {
  const all = [...DEMO_INITIATIVES, ...DEMO_PROPOSED_INITIATIVES];
  const campaignById = new Map(DEMO_CAMPAIGNS.map((c) => [c.id, c]));
  const withCampaign = all.filter((i) => i.campaignId);
  assert.ok(withCampaign.length >= 6, 'يلزم أمثلة كافية لمبادرات داخل حملات');
  for (const i of withCampaign) {
    const c = campaignById.get(i.campaignId);
    assert.ok(c, `${i.id}: حملة غير موجودة ${i.campaignId}`);
    assert.equal(i.portfolioId, c.portfolioId, `${i.id}: محفظة المبادرة لا تطابق محفظة حملتها`);
  }
  // كل حملة تضم أكثر من مبادرة (شرط التدرج)
  for (const c of DEMO_CAMPAIGNS) {
    const members = all.filter((i) => i.campaignId === c.id);
    assert.ok(members.length >= 2, `الحملة ${c.id} تضم أقل من مبادرتين`);
  }
});
