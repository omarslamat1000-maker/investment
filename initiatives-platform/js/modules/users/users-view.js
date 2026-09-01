// إدارة المستخدمين والصلاحيات — إنشاء الحسابات، الأدوار، والتجاوزات لكل مستخدم
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader, emptyState } from '../../ui/components.js';
import { renderTable } from '../../ui/table.js';
import { ROLES } from '../../core/constants.js';
import { can, grantsFor, ACTION_CATALOG } from '../../core/permissions.js';
import { getRole, getSession } from '../../core/state.js';
import { openModal, confirmModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { hashPassword, normalizeUsername, isValidUsername, refreshSessionFromUser } from '../../services/auth-service.js';
import { isEmail } from '../../core/validation.js';
import { uid } from '../../core/utils.js';

const roleLabel = (r) => ROLES[r]?.label || r;

// هل الدور يمنح الفعل أصلًا (قبل التجاوزات)؟
function roleHas(role, action) {
  const grants = grantsFor(role);
  return grants.includes('*') || grants.includes(action);
}

export async function renderUsers(container) {
  // وضع السحابة: إدارة الحسابات الفعلية عبر Supabase وEdge Function
  const { isCloudMode } = await import('../../config.js');
  if (isCloudMode()) {
    const { renderCloudUsers } = await import('./cloud-users-view.js');
    return renderCloudUsers(container);
  }
  const myRole = getRole();
  if (!can(myRole, 'users.view')) {
    container.innerHTML = emptyState('لا تملك صلاحية الوصول',
      'شاشة المستخدمين متاحة لمدير النظام ولمن مُنح صلاحية عرض المستخدمين',
      '<a class="mi-btn mi-btn--primary" href="#/dashboard">العودة للوحة المتابعة</a>');
    return;
  }

  const [users, orgUnits, partners] = await Promise.all([
    repos.users.getAll(), repos.organizationalUnits.getAll(), repos.partners.getAll()
  ]);
  const partnerName = (id) => partners.find((p) => p.id === id)?.name || null;
  const manage = can(myRole, 'users.manage');
  const session = getSession();
  const unitName = (id) => orgUnits.find((u) => u.id === id)?.name || '—';
  const overridesCount = (u) => (u.grants?.length || 0) + (u.denies?.length || 0);

  container.innerHTML = html`
    ${raw(sectionHeader('المستخدمون والصلاحيات',
    'حسابات الدخول وأدوارها، مع تجاوزات سماح/منع لكل مستخدم فوق صلاحيات دوره',
    manage ? '<button class="mi-btn mi-btn--primary" data-act="new">مستخدم جديد</button>' : ''))}
    <div class="mi-pending-host"></div>
    <div class="mi-card mi-users-note">
      <p class="mi-muted">الدور يحدد الصلاحيات الأساسية (انظر مصفوفة الصلاحيات في الوثائق)،
      و«التجاوزات» تخصص حسابًا بعينه: <b>سماح</b> يضيف صلاحية فوق الدور، و<b>منع</b> يحجبها حتى لو كان الدور يمنحها.
      التعديلات تسري على المستخدم عند تسجيل دخوله التالي — وعلى حسابك أنت فورًا.</p>
    </div>
    <div class="mi-table-host"></div>`;

  // ————— طلبات حسابات الشركاء بانتظار الاعتماد (تسجيل ذاتي من بوابة الشركاء) —————
  const pending = users.filter((u) => u.approvalStatus === 'pending');
  const pendingHost = container.querySelector('.mi-pending-host');
  if (pending.length && can(myRole, 'users.manage')) {
    pendingHost.innerHTML = html`
      <section class="mi-card mi-pending-card">
        <h3>طلبات حسابات شركاء بانتظار الاعتماد (${String(pending.length)})</h3>
        <p class="mi-muted">دقق بيانات الجهة والممثل قبل الاعتماد — الاعتماد يفعّل الحساب وسجل الجهة معًا.</p>
        ${raw(pending.map((u) => {
      const p = partners.find((x) => x.id === u.partnerId);
      return html`
          <div class="mi-pending-row" data-user="${u.id}">
            <div class="mi-pending-row__info">
              <b>${p?.name || 'جهة غير مسجلة'}</b>
              <small class="mi-muted">${p?.id || ''} • الممثل: ${u.name} • دخول: <span dir="ltr">${u.username}</span>
                • ${u.email || '—'} • ${p?.contactPhone || '—'}${p?.crNumber ? raw(' • سجل: ' + escapeHtml(p.crNumber)) : ''}</small>
            </div>
            <div class="mi-pending-row__actions">
              <button class="mi-btn mi-btn--primary mi-btn--sm" data-approve="${u.id}">اعتماد</button>
              <button class="mi-btn mi-btn--danger mi-btn--sm" data-reject="${u.id}">رفض</button>
            </div>
          </div>`;
    }).join(''))}
      </section>`;

    pendingHost.querySelectorAll('[data-approve]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const u = pending.find((x) => x.id === btn.dataset.approve);
        const sure = await confirmModal('اعتماد حساب الشريك',
          `تأكيد اعتماد حساب «${u.name}» — سيتفعل الحساب وسجل الجهة ويستطيع الدخول فورًا. هل دققت البيانات؟`,
          { confirmLabel: 'اعتماد وتفعيل' });
        if (!sure) return;
        await repos.users.update(u.id, { active: true, approvalStatus: 'approved' });
        if (u.partnerId) await repos.partners.update(u.partnerId, { active: true });
        toastSuccess('اعتُمد الحساب وفُعّلت الجهة');
        renderUsers(container);
      }));

    pendingHost.querySelectorAll('[data-reject]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const u = pending.find((x) => x.id === btn.dataset.reject);
        const sure = await confirmModal('رفض طلب التسجيل',
          `سيُرفض طلب «${u.name}» ولن يستطيع الدخول (يبقى السجل للمراجعة ويمكن حذفه من الجدول). متابعة؟`,
          { confirmLabel: 'رفض الطلب', danger: true });
        if (!sure) return;
        await repos.users.update(u.id, { active: false, approvalStatus: 'rejected' });
        toastSuccess('رُفض الطلب');
        renderUsers(container);
      }));
  }

  renderTable(container.querySelector('.mi-table-host'), users, [
    { key: 'name', label: 'الاسم' },
    { key: 'username', label: 'اسم المستخدم', map: (u) => u.username || '—' },
    { key: 'role', label: 'الدور', map: (u) => roleLabel(u.role) },
    { key: 'orgUnitId', label: 'الوحدة / الجهة', map: (u) => u.partnerId ? (partnerName(u.partnerId) || '—') : unitName(u.orgUnitId) },
    { key: 'overrides', label: 'تجاوزات', map: (u) => overridesCount(u) ? String(overridesCount(u)) : '—', sortValue: overridesCount },
    { key: 'active', label: 'الحالة', map: (u) => u.approvalStatus === 'pending' ? 'بانتظار الاعتماد' : u.approvalStatus === 'rejected' ? 'مرفوض' : u.active === false ? 'موقوف' : 'نشط' }
  ], {
    searchable: true,
    onRowClick: (u) => openUserModal(u),
    emptyText: 'لا مستخدمون مسجلون'
  });

  container.querySelector('[data-act="new"]')?.addEventListener('click', () => openUserModal(null));

  function permissionsEditorHtml(user) {
    const role = user.role;
    const groups = ACTION_CATALOG.map((g) => {
      const rows = g.actions.map((a) => {
        const byRole = roleHas(role, a.id);
        const state = (user.denies || []).includes(a.id) ? 'deny'
          : (user.grants || []).includes(a.id) ? 'grant' : 'role';
        return `
          <div class="mi-perm-row" data-action="${escapeHtml(a.id)}">
            <span class="mi-perm-row__label">${escapeHtml(a.label)}
              <small class="mi-muted" dir="ltr">${escapeHtml(a.id)}</small>
            </span>
            <span class="mi-perm-row__role" data-byrole="${byRole ? 'yes' : 'no'}">${byRole ? 'يمنحها الدور' : 'لا يمنحها الدور'}</span>
            <select class="mi-input mi-perm-select" data-perm="${escapeHtml(a.id)}">
              <option value="role" ${state === 'role' ? 'selected' : ''}>حسب الدور</option>
              <option value="grant" ${state === 'grant' ? 'selected' : ''}>سماح</option>
              <option value="deny" ${state === 'deny' ? 'selected' : ''}>منع</option>
            </select>
          </div>`;
      }).join('');
      return `<fieldset class="mi-perm-group"><legend>${escapeHtml(g.group)}</legend>${rows}</fieldset>`;
    }).join('');
    return `<div class="mi-perm-grid">${groups}</div>`;
  }

  function openUserModal(existing) {
    if (!manage && existing) {
      // عرض فقط لمن يملك users.view دون users.manage
    }
    const isNew = !existing;
    const user = existing || {
      id: uid('usr'), name: '', username: '', email: '', role: 'viewer',
      orgUnitId: null, active: true, grants: [], denies: []
    };
    const isSelf = session && user.id === session.userId;

    const { dialog, close } = openModal({
      title: isNew ? 'مستخدم جديد' : `حساب: ${user.name}`,
      wide: true,
      bodyHtml: html`
        <form class="mi-form" id="mi-user-form">
          <div class="mi-form-row">
            <div class="mi-form-field"><label>الاسم الكامل</label>
              <input class="mi-input" name="name" value="${user.name}" ${manage ? '' : raw('readonly')}></div>
            <div class="mi-form-field"><label>اسم المستخدم (للدخول)</label>
              <input class="mi-input" name="username" dir="ltr" value="${user.username || ''}" ${manage ? '' : raw('readonly')} placeholder="أحرف إنجليزية وأرقام 3–32">
            </div>
          </div>
          <div class="mi-form-row">
            <div class="mi-form-field"><label>البريد الإلكتروني</label>
              <input class="mi-input" name="email" type="email" dir="ltr" value="${user.email || ''}" ${manage ? '' : raw('readonly')}></div>
            <div class="mi-form-field"><label>الوحدة التنظيمية</label>
              <select class="mi-input" name="orgUnitId" ${manage ? '' : raw('disabled')}>
                <option value="">—</option>
                ${raw(orgUnits.map((o) => `<option value="${escapeHtml(o.id)}" ${o.id === user.orgUnitId ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join(''))}
              </select></div>
          </div>
          <div class="mi-form-row">
            <div class="mi-form-field"><label>الدور</label>
              <select class="mi-input" name="role" ${manage ? '' : raw('disabled')}>
                ${raw(Object.values(ROLES).map((r) => `<option value="${r.id}" ${r.id === user.role ? 'selected' : ''}>${r.label}</option>`).join(''))}
              </select></div>
            <div class="mi-form-field" data-partner-field ${user.role === 'partner' ? '' : raw('hidden')}>
              <label>الجهة الشريكة المرتبطة (لحسابات الشركاء)</label>
              <select class="mi-input" name="partnerId" ${manage ? '' : raw('disabled')}>
                <option value="">—</option>
                ${raw(partners.map((p) => `<option value="${escapeHtml(p.id)}" ${p.id === user.partnerId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join(''))}
              </select>
              <small class="mi-muted">حساب الشريك يدخل بوابة الشركاء فقط ويرى بيانات جهته حصرًا</small>
            </div>
            <div class="mi-form-field"><label>${isNew ? 'كلمة المرور' : 'كلمة مرور جديدة (اتركها فارغة للإبقاء)'}</label>
              <input class="mi-input" name="password" type="password" dir="ltr" autocomplete="new-password" ${manage ? '' : raw('disabled')} minlength="8" placeholder="8 أحرف على الأقل"></div>
          </div>
          <label class="mi-check-item">
            <input type="checkbox" name="active" ${user.active !== false ? raw('checked') : ''} ${manage ? '' : raw('disabled')}>
            <span>حساب نشط (إلغاء التفعيل يمنع تسجيل الدخول)</span>
          </label>

          <h4 class="mi-subhead">تجاوزات الصلاحيات لهذا الحساب</h4>
          ${raw(permissionsEditorHtml(user))}
        </form>`,
      footerHtml: html`
        <button class="mi-btn mi-btn--ghost" data-act="cancel">إغلاق</button>
        ${manage && !isNew && !isSelf ? raw('<button class="mi-btn mi-btn--danger" data-act="delete">حذف الحساب</button>') : ''}
        ${manage ? raw('<button class="mi-btn mi-btn--primary" data-act="save">حفظ</button>') : ''}`
    });

    const form = dialog.querySelector('#mi-user-form');

    // عند تغيير الدور: أظهر ربط الجهة الشريكة لدور «شريك» وحدّث عمود «يمنحها الدور»
    form.role?.addEventListener('change', () => {
      const newRole = form.role.value;
      const partnerField = dialog.querySelector('[data-partner-field]');
      if (partnerField) partnerField.hidden = newRole !== 'partner';
      dialog.querySelectorAll('.mi-perm-row').forEach((row) => {
        const byRole = roleHas(newRole, row.dataset.action);
        const cell = row.querySelector('.mi-perm-row__role');
        cell.dataset.byrole = byRole ? 'yes' : 'no';
        cell.textContent = byRole ? 'يمنحها الدور' : 'لا يمنحها الدور';
      });
    });

    // القراءة فقط: عطّل محددات التجاوز
    if (!manage) dialog.querySelectorAll('.mi-perm-select').forEach((s) => { s.disabled = true; });

    dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);

    dialog.querySelector('[data-act="delete"]')?.addEventListener('click', async () => {
      const sure = await confirmModal('حذف الحساب',
        `سيُحذف حساب «${user.name}» نهائيًا ولن يتمكن من الدخول. هل أنت متأكد؟`,
        { confirmLabel: 'حذف نهائي', danger: true });
      if (!sure) return;
      await repos.users.remove(user.id);
      close();
      toastSuccess('حُذف الحساب');
      renderUsers(container);
    });

    dialog.querySelector('[data-act="save"]')?.addEventListener('click', async () => {
      const name = form.name.value.trim();
      const username = normalizeUsername(form.username.value);
      const email = form.email.value.trim();
      const role = form.role.value;
      const password = form.password.value;
      const active = form.active.checked;

      if (name.length < 3) { toastError('الاسم الكامل مطلوب (3 أحرف على الأقل)'); return; }
      if (!isValidUsername(username)) { toastError('اسم المستخدم: أحرف إنجليزية صغيرة وأرقام و.-_ بطول 3–32'); return; }
      const emailErr = isEmail(email);
      if (email && emailErr) { toastError(emailErr); return; }
      if (isNew && password.length < 8) { toastError('كلمة المرور مطلوبة للحساب الجديد (8 أحرف على الأقل)'); return; }
      if (password && password.length < 8) { toastError('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف'); return; }
      if (!ROLES[role]) { toastError('اختر دورًا صحيحًا'); return; }

      // تفرد اسم المستخدم
      const clash = users.find((u) => u.id !== user.id && normalizeUsername(u.username) === username);
      if (clash) { toastError(`اسم المستخدم مستخدم بالفعل لحساب «${clash.name}»`); return; }

      // جمع التجاوزات
      const grants = []; const denies = [];
      dialog.querySelectorAll('.mi-perm-select').forEach((sel) => {
        if (sel.value === 'grant') grants.push(sel.dataset.perm);
        if (sel.value === 'deny') denies.push(sel.dataset.perm);
      });

      // حماية: لا يقفل المدير على نفسه الباب
      if (isSelf) {
        if (!active) { toastError('لا يمكنك إيقاف حسابك أنت'); return; }
        const stillManages = role === 'admin'
          ? !denies.includes('users.manage')
          : (grants.includes('users.manage') && !denies.includes('users.manage'));
        if (!stillManages) { toastError('لا يمكنك سحب صلاحية إدارة المستخدمين من حسابك أنت'); return; }
      }

      const partnerId = role === 'partner' ? (form.partnerId.value || null) : null;
      const record = {
        ...user, name, username, email, role, active, grants, denies,
        orgUnitId: form.orgUnitId.value || null,
        partnerId
      };
      if (password) record.passwordHash = await hashPassword(password);

      if (isNew) await repos.users.create(record);
      else await repos.users.update(user.id, record);

      // إن كان الحساب المعدل هو المسجل حاليًا: حدّث الجلسة فورًا
      refreshSessionFromUser(record);

      close();
      toastSuccess(isNew ? 'أُنشئ الحساب' : 'حُفظ الحساب');
      renderUsers(container);
    });
  }
}
