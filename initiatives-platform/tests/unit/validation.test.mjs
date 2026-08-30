// اختبارات قواعد التحقق والنماذج
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { required, isEmail, isSaudiPhone, isDateYmd, validate } from '../../js/core/validation.js';
import { newInitiative, validateInitiative } from '../../js/domain/initiative-model.js';
import { newNeed, validateNeed } from '../../js/domain/infrastructure-need-model.js';
import { newPartner, validatePartner } from '../../js/domain/partner-model.js';

test('required يرفض الفراغ والمسافات', () => {
  assert.ok(required('', 'الاسم'));
  assert.ok(required('   ', 'الاسم'));
  assert.equal(required('نص', 'الاسم'), null);
});

test('البريد الإلكتروني', () => {
  assert.equal(isEmail('user@example.com'), null);
  assert.ok(isEmail('غير-بريد'));
  assert.equal(isEmail(''), null); // اختياري ما لم يُطلب
});

test('جوال سعودي: 05 أو +9665', () => {
  assert.equal(isSaudiPhone('0551234567'), null);
  assert.equal(isSaudiPhone('+966551234567'), null);
  assert.ok(isSaudiPhone('12345'));
});

test('تاريخ YYYY-MM-DD', () => {
  assert.equal(isDateYmd('2026-08-30'), null);
  assert.ok(isDateYmd('30/08/2026'));
});

test('مبادرة جديدة صالحة تجتاز التحقق', () => {
  const ini = newInitiative({
    title: 'تشجير شارع الأمير عبدالمجيد',
    summary: 'زراعة مئتي شجرة ظل مع شبكة ري بالتنقيط على امتداد الشارع الرئيس.',
    category: 'greening', district: 'قباء',
    submitterName: 'اختبار', submitterEmail: 'a@b.co', submitterPhone: '0550000000'
  });
  const r = validateInitiative(ini);
  assert.equal(r.valid, true, JSON.stringify(r.errors));
});

test('مبادرة بعنوان قصير أو تصنيف خاطئ تُرفض', () => {
  const ini = newInitiative({ title: 'قصير', summary: 'و'.repeat(40), category: 'غير-موجود', district: 'قباء', submitterName: 'س' });
  const r = validateInitiative(ini);
  assert.equal(r.valid, false);
  assert.ok(r.errors.title);
  assert.ok(r.errors.category);
});

test('احتياج صالح واحتياج ناقص', () => {
  const okNeed = newNeed({ title: 'إنارة ممرات الحي', description: 'استبدال وحدات الإنارة القديمة بأخرى موفرة.', category: 'lighting', district: 'العوالي' });
  assert.equal(validateNeed(okNeed).valid, true);
  const bad = newNeed({ title: 'قصير' });
  assert.equal(validateNeed(bad).valid, false);
});

test('شريك بلا نوع يُرفض', () => {
  const p = newPartner({ name: 'شركة اختبار', contactName: 'ممثل' });
  const r = validatePartner(p);
  assert.equal(r.valid, false);
  assert.ok(r.errors.type);
});

test('validate يعيد أول خطأ لكل حقل فقط', () => {
  const r = validate({ x: '' }, { x: [(v) => required(v, 'س'), (v) => isEmail(v, 'س')] });
  assert.equal(r.valid, false);
  assert.match(r.errors.x, /إلزامي/);
});
