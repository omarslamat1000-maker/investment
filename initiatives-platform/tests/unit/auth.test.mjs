// اختبارات المصادقة وتجاوزات الصلاحيات
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, normalizeUsername, isValidUsername, DEFAULT_USERNAMES } from '../../js/services/auth-service.js';
import { can, setOverridesProvider, ALL_ACTIONS, ACTION_CATALOG, grantsFor } from '../../js/core/permissions.js';
import { DEMO_USERS } from '../../data/reference-data.js';
import { ROLES } from '../../js/core/constants.js';

test('تجزئة كلمة المرور: SHA-256 ست عشرية ثابتة (64 خانة)', async () => {
  const h1 = await hashPassword('Admin@123');
  const h2 = await hashPassword('Admin@123');
  const h3 = await hashPassword('Admin@124');
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
  assert.match(h1, /^[0-9a-f]{64}$/);
});

test('تطبيع اسم المستخدم وصحته', () => {
  assert.equal(normalizeUsername('  Admin '), 'admin');
  assert.equal(isValidUsername('admin'), true);
  assert.equal(isValidUsername('user.name-1_x'), true);
  assert.equal(isValidUsername('ab'), false);            // قصير
  assert.equal(isValidUsername('مستخدم'), false);        // عربي غير مسموح للدخول
  assert.equal(isValidUsername('has space'), false);
});

test('تجاوز المنع يحجب صلاحية يمنحها الدور — حتى للمدير', () => {
  try {
    setOverridesProvider(() => ({ grants: [], denies: ['needs.publish'] }));
    assert.equal(can('pmo', 'needs.publish'), false);
    assert.equal(can('admin', 'needs.publish'), false);
    assert.equal(can('pmo', 'needs.edit'), true); // غير المحجوب يبقى
  } finally { setOverridesProvider(null); }
});

test('تجاوز السماح يضيف صلاحية فوق الدور', () => {
  try {
    setOverridesProvider(() => ({ grants: ['decisions.create'], denies: [] }));
    assert.equal(can('viewer', 'decisions.create'), true);
    assert.equal(can('viewer', 'initiatives.edit'), false); // ما لم يُمنح يبقى ممنوعًا
  } finally { setOverridesProvider(null); }
});

test('المنع مقدَّم على السماح عند التعارض', () => {
  try {
    setOverridesProvider(() => ({ grants: ['backup.run'], denies: ['backup.run'] }));
    assert.equal(can('admin', 'backup.run'), false);
  } finally { setOverridesProvider(null); }
});

test('بلا مزوّد تجاوزات: السلوك الأصلي للمصفوفة كما هو', () => {
  setOverridesProvider(null);
  assert.equal(can('admin', 'users.manage'), true);
  assert.equal(can('pmo', 'users.view'), true);
  assert.equal(can('pmo', 'users.manage'), false);
  assert.equal(can('viewer', 'users.view'), false);
});

test('دليل الأفعال يغطي كل صلاحيات الأدوار المعرفة', () => {
  const known = new Set(ALL_ACTIONS);
  for (const role of Object.keys(ROLES)) {
    for (const g of grantsFor(role)) {
      if (g === '*') continue;
      assert.ok(known.has(g), `الفعل ${g} في دور ${role} غير موجود في ACTION_CATALOG`);
    }
  }
  // لا تكرار في الدليل
  assert.equal(known.size, ALL_ACTIONS.length);
  assert.ok(ACTION_CATALOG.every((g) => g.actions.every((a) => a.label)));
});

test('حسابات العرض: أسماء دخول فريدة صالحة وأدوار معرفة', () => {
  const names = DEMO_USERS.map((u) => u.username);
  assert.equal(new Set(names).size, names.length);
  for (const u of DEMO_USERS) {
    assert.ok(isValidUsername(u.username), u.username);
    assert.ok(ROLES[u.role], `${u.id}: دور غير معرف`);
    assert.equal(u.active, true);
  }
  // خريطة الترقية تغطي كل حسابات العرض
  for (const u of DEMO_USERS) assert.equal(DEFAULT_USERNAMES[u.id], u.username);
});

test('حسابات الشركاء: كل حساب مرتبط بجهة شريكة موجودة ودوره partner', async () => {
  const { DEMO_PARTNERS } = await import('../../data/demo-partners.js');
  const partnerIds = new Set(DEMO_PARTNERS.map((p) => p.id));
  const partnerAccounts = DEMO_USERS.filter((u) => u.partnerId);
  assert.ok(partnerAccounts.length >= 8, 'يلزم حساب لكل جهة شريكة');
  for (const u of partnerAccounts) {
    assert.equal(u.role, 'partner', u.id);
    assert.ok(partnerIds.has(u.partnerId), `${u.id}: جهة غير موجودة ${u.partnerId}`);
  }
  // كل جهة شريكة لها حساب واحد بالضبط (شخص واحد لكل جهة)
  const byPartner = new Set(partnerAccounts.map((u) => u.partnerId));
  assert.equal(byPartner.size, partnerAccounts.length, 'جهة مرتبطة بأكثر من حساب');
  assert.equal(byPartner.size, DEMO_PARTNERS.length, 'جهات بلا حسابات');
});
