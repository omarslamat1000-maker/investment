// اختبارات اتفاقية الشراكة الرقمية — البناء من القالب واعتمادات الطرفين
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAgreement, approveByPartner, approveByAmanah, computeAgreementStatus, isSigned, clausesForModels } from '../../js/domain/agreement.js';

const initiative = { id: 'MDN-INIT-2026-0099', title: 'مبادرة اختبار', district: 'قباء', budget: 1000000, startDate: '2026-10-01' };
const partners = [{ id: 'P1', name: 'جهة أ', contactName: 'ممثل أ' }, { id: 'P2', name: 'جهة ب', contactName: 'ممثل ب' }];
const links = [
  { partnerId: 'P1', model: 'execution', contribution: 'تنفيذ' },
  { partnerId: 'P2', model: 'fullFunding', contribution: 'تمويل' }
];

test('تُبنى الاتفاقية بأطراف من الروابط وبنود حسب النماذج ثم البنود العامة', () => {
  const a = buildAgreement({ initiative, links, partners, issuedBy: 'PMO', now: '2026-09-01T00:00:00Z' });
  assert.equal(a.parties.length, 2);
  assert.equal(a.joint, true);
  assert.deepEqual(a.models, ['execution', 'fullFunding']);
  assert.equal(a.parties[0].name, 'جهة أ');
  assert.equal(a.parties[0].modelLabel, 'تنفيذ مباشر');
  assert.ok(a.clauses.length >= clausesForModels(['execution', 'fullFunding']).length);
  assert.equal(a.status, 'issued');
  assert.equal(a.startDate, '2026-10-01');
});

test('لا اتفاقية بلا شركاء', () => {
  assert.throws(() => buildAgreement({ initiative, links: [], partners }), /دون شريك/);
});

test('التوقيع يكتمل فقط باعتماد كل الشركاء والأمانة', () => {
  let a = buildAgreement({ initiative, links, partners });
  assert.equal(computeAgreementStatus(a), 'issued');
  a = approveByPartner(a, 'P1', { by: 'ممثل أ', now: '2026-09-02T00:00:00Z' });
  assert.equal(computeAgreementStatus(a), 'issued'); // شريك واحد من اثنين
  a = approveByAmanah(a, { by: 'الأمين', now: '2026-09-03T00:00:00Z' });
  assert.equal(computeAgreementStatus(a), 'amanahApproved');
  assert.equal(isSigned(a), false);
  a = approveByPartner(a, 'P2', { by: 'ممثل ب', now: '2026-09-04T00:00:00Z' });
  assert.equal(computeAgreementStatus(a), 'signed');
  assert.equal(a.signedAt, '2026-09-04T00:00:00Z');
  assert.ok(isSigned(a));
});

test('لا اعتماد مكرر ولا اعتماد من غير طرف', () => {
  let a = buildAgreement({ initiative, links, partners });
  a = approveByPartner(a, 'P1', { by: 'x' });
  assert.throws(() => approveByPartner(a, 'P1'), /سبق/);
  assert.throws(() => approveByPartner(a, 'P9'), /ليست طرفًا/);
  a = approveByAmanah(a, { by: 'y' });
  assert.throws(() => approveByAmanah(a), /سبق/);
});

test('الاعتماد لا يغيّر النسخة الأصلية (دوال نقية)', () => {
  const a = buildAgreement({ initiative, links, partners });
  approveByPartner(a, 'P1', { by: 'x' });
  assert.equal(a.parties[0].approvedAt, null);
});
