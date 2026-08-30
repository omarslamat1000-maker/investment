// اختبارات تكامل: اتساق البيانات التجريبية مع النماذج والمراجع
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_INITIATIVES, DEMO_INITIATIVE_PARTNERS, DEMO_MILESTONES, DEMO_BENEFITS, DEMO_RISKS, DEMO_DECISIONS, DEMO_REVIEWS, DEMO_QUALITY_CHECKS } from '../../data/demo-initiatives.js';
import { DEMO_NEEDS } from '../../data/demo-needs.js';
import { DEMO_PARTNERS } from '../../data/demo-partners.js';
import { validateInitiative } from '../../js/domain/initiative-model.js';
import { validateNeed } from '../../js/domain/infrastructure-need-model.js';
import { validatePartner } from '../../js/domain/partner-model.js';
import { STATUSES, GATES } from '../../js/core/constants.js';

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
