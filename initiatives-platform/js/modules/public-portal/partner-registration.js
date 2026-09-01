// تسجيل حساب جهة شريكة جديدة — الطلب يُنشأ معلقًا ولا يُفعَّل إلا بعد
// تدقيق البيانات واعتماد مدير النظام من شاشة «المستخدمون»
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { PARTNER_TYPES } from '../../core/constants.js';
import { validate, required, minLength, isEmail, isSaudiPhone } from '../../core/validation.js';
import { newPartner, sanitizePartner } from '../../domain/partner-model.js';
import { hashPassword, normalizeUsername, isValidUsername, findUserByUsername } from '../../services/auth-service.js';
import { notify } from '../../services/notification-service.js';
import { uid } from '../../core/utils.js';
import { toastError } from '../../ui/toast.js';
import { isCloudMode } from '../../config.js';

export function renderPartnerRegistration(container) {
  container.innerHTML = html`
    <div class="mi-card mi-empty" id="mi-reg-intro">
      <div class="mi-empty__mark" aria-hidden="true">◈</div>
      <h2>بوابة خاصة بحسابات الشركاء</h2>
      <p class="mi-muted">لكل جهة شريكة حساب باسم ممثلها تتابع به مبادراتها وتقدمها — سجّل الدخول، أو أنشئ حسابًا جديدًا لجهتك.</p>
      <p>
        <a class="mi-btn mi-btn--primary" href="./login.html">تسجيل الدخول</a>
        <button class="mi-btn mi-btn--gold" id="mi-reg-open">إنشاء حساب جديد للشركاء</button>
      </p>
    </div>

    <div class="mi-card" id="mi-reg-card" hidden>
      <h2>طلب حساب جهة شريكة</h2>
      <p class="mi-muted">عبّئ بيانات جهتك وممثلها — يُفعَّل الحساب بعد تدقيق البيانات واعتمادها من مدير النظام،
        وبعدها تتابعون مبادراتكم (المرتبطة بجهتكم أو المقدمة ببريدكم) وتُحدّثون بيانات جهتكم.</p>
      <form class="mi-form" id="mi-reg-form" novalidate>
        <h4 class="mi-subhead">بيانات الجهة</h4>
        <div class="mi-form-row">
          <div class="mi-form-field"><label>اسم الجهة</label>
            <input class="mi-input" name="entityName" placeholder="مثال: شركة البناء الحديث للمقاولات"></div>
          <div class="mi-form-field"><label>نوع الجهة</label>
            <select class="mi-input" name="entityType">
              ${raw(PARTNER_TYPES.map((t) => `<option value="${t.id}">${t.label}</option>`).join(''))}
            </select></div>
        </div>

        <h4 class="mi-subhead">ممثل الجهة (شخص واحد — صاحب الحساب)</h4>
        <div class="mi-form-row">
          <div class="mi-form-field"><label>الاسم الكامل</label>
            <input class="mi-input" name="repName"></div>
          <div class="mi-form-field"><label>البريد الإلكتروني</label>
            <input class="mi-input" name="repEmail" type="email" dir="ltr" placeholder="name@company.com"></div>
          <div class="mi-form-field"><label>رقم الجوال</label>
            <input class="mi-input" name="repPhone" dir="ltr" placeholder="05xxxxxxxx"></div>
        </div>
        <p class="mi-muted">ملاحظة: المبادرات التي قدمتموها سابقًا عبر المنصة بهذا البريد ستظهر تلقائيًا في حسابكم بعد الاعتماد.</p>

        <h4 class="mi-subhead">بيانات الدخول</h4>
        <div class="mi-form-row">
          <div class="mi-form-field"><label>اسم المستخدم (أحرف إنجليزية وأرقام 3–32)</label>
            <input class="mi-input" name="username" dir="ltr" autocomplete="username"></div>
          <div class="mi-form-field"><label>كلمة المرور (8 أحرف على الأقل)</label>
            <input class="mi-input" name="password" type="password" dir="ltr" autocomplete="new-password"></div>
          <div class="mi-form-field"><label>تأكيد كلمة المرور</label>
            <input class="mi-input" name="confirm" type="password" dir="ltr" autocomplete="new-password"></div>
        </div>

        <label class="mi-check-item mi-consent">
          <input type="checkbox" name="consent">
          <span>أقرّ بصحة البيانات المدخلة وبأنني الممثل المفوض عن الجهة، وأعلم أن الحساب لا يُفعَّل
            إلا بعد تدقيق البيانات واعتمادها من مدير النظام.</span>
        </label>

        <div class="mi-wiz-errors" aria-live="assertive"></div>
        <div class="mi-settings-actions">
          <button class="mi-btn mi-btn--primary" type="submit">إرسال طلب التسجيل</button>
          <button class="mi-btn mi-btn--ghost" type="button" id="mi-reg-cancel">إلغاء</button>
        </div>
      </form>
    </div>

    <div id="mi-reg-success" hidden></div>`;

  const introCard = container.querySelector('#mi-reg-intro');
  const regCard = container.querySelector('#mi-reg-card');
  const form = container.querySelector('#mi-reg-form');
  const errBox = form.querySelector('.mi-wiz-errors');

  container.querySelector('#mi-reg-open').addEventListener('click', () => {
    if (isCloudMode()) {
      toastError('في النسخة السحابية تُنشأ الحسابات عبر مكتب إدارة المبادرات — تواصلوا معنا');
      return;
    }
    introCard.hidden = true;
    regCard.hidden = false;
    form.entityName.focus();
  });
  container.querySelector('#mi-reg-cancel').addEventListener('click', () => {
    regCard.hidden = true;
    introCard.hidden = false;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.innerHTML = '';

    const data = {
      entityName: form.entityName.value.trim(),
      entityType: form.entityType.value,
      repName: form.repName.value.trim(),
      repEmail: form.repEmail.value.trim(),
      repPhone: form.repPhone.value.trim(),
      username: normalizeUsername(form.username.value),
      password: form.password.value,
      confirm: form.confirm.value
    };

    const check = validate(data, {
      entityName: [(v) => required(v, 'اسم الجهة'), (v) => minLength(v, 5, 'اسم الجهة')],
      repName: [(v) => required(v, 'اسم الممثل'), (v) => minLength(v, 3, 'اسم الممثل')],
      repEmail: [(v) => required(v, 'البريد الإلكتروني'), (v) => isEmail(v)],
      repPhone: [(v) => required(v, 'رقم الجوال'), (v) => isSaudiPhone(v)]
    });
    const problems = Object.values(check.errors);
    if (!isValidUsername(data.username)) problems.push('اسم المستخدم: أحرف إنجليزية صغيرة وأرقام و.-_ بطول 3–32');
    if (data.password.length < 8) problems.push('كلمة المرور 8 أحرف على الأقل');
    if (data.password !== data.confirm) problems.push('كلمتا المرور غير متطابقتين');
    if (!form.consent.checked) problems.push('الإقرار بصحة البيانات مطلوب');
    if (!problems.length && await findUserByUsername(data.username)) {
      problems.push('اسم المستخدم محجوز — اختر اسمًا آخر');
    }
    if (problems.length) {
      errBox.innerHTML = html`<div class="mi-alert mi-alert--error">${problems[0]}</div>`;
      return;
    }

    // سجل الجهة (غير مفعّلة حتى الاعتماد) + حساب الممثل (معلق)
    const partner = await repos.partners.create(sanitizePartner(newPartner({
      name: data.entityName,
      type: data.entityType,
      
      contactName: data.repName,
      contactEmail: data.repEmail,
      contactPhone: data.repPhone,
      active: false,
      notes: 'سجلت ذاتيًا عبر بوابة الشركاء — بانتظار تدقيق مدير النظام'
    })));

    await repos.users.create({
      id: uid('usr'),
      username: data.username,
      name: data.repName,
      email: data.repEmail,
      role: 'partner',
      partnerId: partner.id,
      passwordHash: await hashPassword(data.password),
      active: false,
      approvalStatus: 'pending',
      grants: [], denies: []
    });

    await notify('طلب حساب شريك جديد بانتظار الاعتماد',
      `${data.entityName} — الممثل: ${data.repName} (${data.username})`, 'info');

    regCard.hidden = true;
    const success = container.querySelector('#mi-reg-success');
    success.hidden = false;
    success.innerHTML = html`
      <div class="mi-card mi-empty">
        <div class="mi-empty__mark" aria-hidden="true">✓</div>
        <h2>استلمنا طلب التسجيل</h2>
        <p>رقم جهتكم: <b dir="ltr">${partner.id}</b></p>
        <p class="mi-muted">سيُدقق مدير النظام بيانات الجهة والممثل، وعند الاعتماد يمكنكم الدخول
          باسم المستخدم <code dir="ltr">${data.username}</code> لمتابعة مبادراتكم وتعبئة بيانات جهتكم.</p>
        <a class="mi-btn mi-btn--ghost" href="./index.html">العودة للبوابة العامة</a>
      </div>`;
    success.scrollIntoView({ behavior: 'smooth' });
  });
}
