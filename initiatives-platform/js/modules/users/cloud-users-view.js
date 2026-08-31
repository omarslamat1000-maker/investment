// إدارة المستخدمين والجهات في وضع السحابة — القراءة عبر RLS والكتابة عبر Edge Function آمنة
// (لا service_role في الواجهة إطلاقًا؛ العمليات الإدارية تمر بدالة admin-users على الخادم)
import { getSupabase } from '../../data/supabase-client.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader, emptyState } from '../../ui/components.js';
import { renderTable } from '../../ui/table.js';
import { ROLES } from '../../core/constants.js';
import { getRole, getSession } from '../../core/state.js';
import { openModal, confirmModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { fmtDate } from '../../core/date-time.js';

const CLOUD_ROLES = [
  { id: 'admin', label: 'مدير النظام' },
  { id: 'supervisor', label: 'المشرف على المبادرات' },
  { id: 'agency_user', label: 'ممثل جهة' }
];

async function callAdminFn(payload) {
  const client = await getSupabase();
  const { data, error } = await client.functions.invoke('admin-users', { body: payload });
  if (error) throw new Error(error.message || 'فشل الاتصال بخدمة الإدارة');
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function renderCloudUsers(container) {
  const role = getRole();
  const session = getSession();
  if (role !== 'admin') {
    container.innerHTML = emptyState('لا تملك صلاحية الوصول',
      'إدارة المستخدمين والجهات في وضع السحابة لمدير النظام فقط');
    return;
  }

  const client = await getSupabase();
  const [{ data: profiles }, { data: orgs }] = await Promise.all([
    client.from('profiles').select('*, organizations(name_ar, code)').order('created_at'),
    client.from('organizations').select('*').order('created_at')
  ]);
  const roleLabel = (r) => CLOUD_ROLES.find((x) => x.id === r)?.label || r;

  container.innerHTML = html`
    ${raw(sectionHeader('المستخدمون والجهات (Supabase)',
    'الحسابات الفعلية في قاعدة البيانات — الإنشاء وإعادة التعيين عبر خدمة خادمية آمنة',
    `<button class="mi-btn mi-btn--primary" data-act="new-user">مستخدم جديد</button>
     <button class="mi-btn mi-btn--ghost" data-act="new-org">جهة جديدة</button>`))}

    <div class="mi-card mi-users-note">
      <h3>الجهات</h3>
      <div class="mi-grants">
        ${raw((orgs || []).map((o) => `<span class="mi-tag ${o.is_active ? 'mi-tag--gold' : ''}">${escapeHtml(o.name_ar)} — ${escapeHtml(o.code)}${o.is_active ? '' : ' (موقوفة)'}</span>`).join(' '))}
      </div>
    </div>
    <div class="mi-table-host"></div>`;

  renderTable(container.querySelector('.mi-table-host'), profiles || [], [
    { key: 'full_name', label: 'الاسم', map: (r) => r.full_name || '—' },
    { key: 'role', label: 'الدور', map: (r) => roleLabel(r.role) },
    { key: 'org', label: 'الجهة', map: (r) => r.organizations?.name_ar || '—' },
    { key: 'must', label: 'أول دخول', map: (r) => r.must_change_password ? 'بانتظار تغيير كلمة المرور' : 'مكتمل' },
    { key: 'is_active', label: 'الحالة', map: (r) => r.is_active ? 'نشط' : 'موقوف' },
    { key: 'created_at', label: 'أُنشئ', map: (r) => fmtDate(r.created_at), sortValue: (r) => r.created_at }
  ], {
    searchable: true,
    onRowClick: (r) => openUserModal(r),
    emptyText: 'لا مستخدمون'
  });

  container.querySelector('[data-act="new-user"]').addEventListener('click', () => openUserModal(null));
  container.querySelector('[data-act="new-org"]').addEventListener('click', openOrgModal);

  function openUserModal(existing) {
    const isNew = !existing;
    const { dialog, close } = openModal({
      title: isNew ? 'إنشاء حساب جديد' : `حساب: ${existing.full_name || existing.id.slice(0, 8)}`,
      bodyHtml: html`
        <form class="mi-form" id="mi-cu-form">
          ${isNew ? raw(`
          <div class="mi-form-field"><label>البريد الإلكتروني (اسم الدخول)</label>
            <input class="mi-input" name="email" type="email" dir="ltr" required></div>`) : ''}
          <div class="mi-form-field"><label>الاسم الكامل</label>
            <input class="mi-input" name="full_name" value="${existing?.full_name || ''}"></div>
          <div class="mi-form-row">
            <div class="mi-form-field"><label>الدور</label>
              <select class="mi-input" name="role">
                ${raw(CLOUD_ROLES.map((r) => `<option value="${r.id}" ${existing?.role === r.id ? 'selected' : ''}>${r.label}</option>`).join(''))}
              </select></div>
            <div class="mi-form-field"><label>الجهة (لممثلي الجهات)</label>
              <select class="mi-input" name="organization">
                <option value="">—</option>
                ${raw((orgs || []).map((o) => `<option value="${escapeHtml(isNew ? o.code : o.id)}" ${existing?.organization_id === o.id ? 'selected' : ''}>${escapeHtml(o.name_ar)}</option>`).join(''))}
              </select></div>
          </div>
          ${isNew ? raw('<p class="mi-muted">سيُنشأ الحساب بكلمة مرور مؤقتة تُعرض لك مرة واحدة، ويُلزَم صاحبه بتغييرها عند أول دخول.</p>') : ''}
        </form>
        <div class="mi-cu-result" aria-live="polite"></div>`,
      footerHtml: html`
        <button class="mi-btn mi-btn--ghost" data-act="cancel">إغلاق</button>
        ${!isNew ? raw(`
          <button class="mi-btn mi-btn--ghost" data-act="reset-pw">إعادة تعيين كلمة المرور</button>
          <button class="mi-btn ${existing.is_active ? 'mi-btn--danger' : 'mi-btn--gold'}" data-act="toggle-active">${existing.is_active ? 'إيقاف الحساب' : 'تفعيل الحساب'}</button>`) : ''}
        <button class="mi-btn mi-btn--primary" data-act="save">${isNew ? 'إنشاء الحساب' : 'حفظ'}</button>`
    });

    const resultBox = dialog.querySelector('.mi-cu-result');
    dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);

    dialog.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const form = dialog.querySelector('#mi-cu-form');
      try {
        if (isNew) {
          const data = await callAdminFn({
            action: 'create_user',
            email: form.email.value,
            full_name: form.full_name.value.trim(),
            role: form.role.value,
            organization_code: form.organization.value || null
          });
          resultBox.innerHTML = html`
            <div class="mi-alert" style="background:var(--mi-gold-100);color:var(--mi-gold-700)">
              أُنشئ الحساب ✔ — كلمة المرور المؤقتة (تظهر مرة واحدة، سلّمها للمستخدم بأمان):
              <code dir="ltr" style="user-select:all">${data.temp_password}</code>
            </div>`;
          toastSuccess('أُنشئ الحساب');
        } else {
          await callAdminFn({
            action: 'update_profile',
            user_id: existing.id,
            full_name: form.full_name.value.trim(),
            role: form.role.value,
            organization_id: form.organization.value || null
          });
          toastSuccess('حُدّث الحساب');
          close();
          renderCloudUsers(container);
        }
      } catch (err) { toastError(err.message); }
    });

    dialog.querySelector('[data-act="reset-pw"]')?.addEventListener('click', async () => {
      try {
        const data = await callAdminFn({ action: 'reset_password', user_id: existing.id });
        resultBox.innerHTML = html`
          <div class="mi-alert" style="background:var(--mi-gold-100);color:var(--mi-gold-700)">
            أُعيد التعيين ✔ — كلمة المرور المؤقتة: <code dir="ltr" style="user-select:all">${data.temp_password}</code>
            <br><small>سيُلزَم المستخدم بتغييرها عند أول دخول.</small>
          </div>`;
      } catch (err) { toastError(err.message); }
    });

    dialog.querySelector('[data-act="toggle-active"]')?.addEventListener('click', async () => {
      if (existing.id === session.userId && existing.is_active) {
        toastError('لا يمكنك إيقاف حسابك أنت'); return;
      }
      const sure = await confirmModal(existing.is_active ? 'إيقاف الحساب' : 'تفعيل الحساب',
        existing.is_active
          ? 'إيقاف الحساب يمنع صاحبه من الدخول والوصول لأي بيانات فورًا. متابعة؟'
          : 'سيتمكن صاحب الحساب من الدخول مجددًا. متابعة؟',
        { confirmLabel: existing.is_active ? 'إيقاف' : 'تفعيل', danger: existing.is_active });
      if (!sure) return;
      try {
        await callAdminFn({ action: 'set_active', user_id: existing.id, is_active: !existing.is_active });
        toastSuccess(existing.is_active ? 'أُوقف الحساب' : 'فُعّل الحساب');
        close();
        renderCloudUsers(container);
      } catch (err) { toastError(err.message); }
    });
  }

  function openOrgModal() {
    const { dialog, close } = openModal({
      title: 'إضافة جهة جديدة',
      bodyHtml: html`
        <form class="mi-form" id="mi-org-form">
          <div class="mi-form-field"><label>اسم الجهة</label>
            <input class="mi-input" name="name_ar" placeholder="مثال: الوكالة المساعدة للمياه"></div>
          <div class="mi-form-field"><label>الرمز (أحرف إنجليزية كبيرة)</label>
            <input class="mi-input" name="code" dir="ltr" placeholder="WATER"></div>
        </form>`,
      footerHtml: html`
        <button class="mi-btn mi-btn--ghost" data-act="cancel">إلغاء</button>
        <button class="mi-btn mi-btn--primary" data-act="save">إضافة</button>`
    });
    dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
    dialog.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const form = dialog.querySelector('#mi-org-form');
      const name = form.name_ar.value.trim();
      const code = form.code.value.trim().toUpperCase();
      if (name.length < 5 || !/^[A-Z_]{3,20}$/.test(code)) {
        toastError('أدخل اسمًا صحيحًا ورمزًا من أحرف إنجليزية كبيرة (3–20)'); return;
      }
      const { error } = await client.from('organizations').insert({ name_ar: name, code });
      if (error) { toastError(error.message); return; }
      toastSuccess('أُضيفت الجهة');
      close();
      renderCloudUsers(container);
    });
  }
}
