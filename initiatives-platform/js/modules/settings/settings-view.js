// الإعدادات — الدور، السمة، النسخ الاحتياطي والاستعادة، سجل التدقيق
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader } from '../../ui/components.js';
import { ROLES } from '../../core/constants.js';
import { getRole, setRole, getTheme, setTheme, getUserName, setUserName } from '../../core/state.js';
import { can, grantsFor } from '../../core/permissions.js';
import { downloadBackup, restoreBackup, validateBackup } from '../../services/backup-service.js';
import { readJsonFile } from '../../services/import-service.js';
import { getAuditLogs, pruneAuditLogs } from '../../services/audit-service.js';
import { fmtDateTime } from '../../core/date-time.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { confirmModal } from '../../ui/modal.js';
import { providerName } from '../../data/data-provider.js';

export async function renderSettings(container) {
  const role = getRole();
  const logs = await getAuditLogs({ limit: 25 });

  container.innerHTML = html`
    ${raw(sectionHeader('الإعدادات', 'الدور التجريبي، المظهر، النسخ الاحتياطي، وسجل التدقيق'))}
    <div class="mi-settings-grid">
      <section class="mi-card">
        <h3>الجلسة التجريبية</h3>
        <div class="mi-form-field">
          <label for="mi-set-name">اسم المستخدم</label>
          <input id="mi-set-name" class="mi-input" value="${getUserName()}">
        </div>
        <div class="mi-form-field">
          <label for="mi-set-role">الدور الحالي</label>
          <select id="mi-set-role" class="mi-input">
            ${raw(Object.values(ROLES).map((r) => `<option value="${r.id}" ${r.id === role ? 'selected' : ''}>${r.label}</option>`).join(''))}
          </select>
          <small class="mi-muted">تغيير الدور يعيد ضبط الصلاحيات الظاهرة في كامل المنصة — منصة عرض بلا مصادقة فعلية</small>
        </div>
        <h4 class="mi-subhead">صلاحيات الدور</h4>
        <div class="mi-grants">${raw(grantsFor(role).map((g) => `<span class="mi-tag">${escapeHtml(g)}</span>`).join(' '))}</div>
      </section>

      <section class="mi-card">
        <h3>المظهر</h3>
        <div class="mi-form-field">
          <label for="mi-set-theme">السمة</label>
          <select id="mi-set-theme" class="mi-input">
            <option value="light" ${getTheme() === 'light' ? raw('selected') : ''}>فاتحة</option>
            <option value="dark" ${getTheme() === 'dark' ? raw('selected') : ''}>داكنة</option>
          </select>
        </div>
        <h3 class="mi-subhead">مصدر البيانات</h3>
        <p class="mi-muted">المزوّد الحالي: <b>${providerName() === 'indexeddb' ? 'قاعدة محلية IndexedDB' : 'Supabase'}</b> — قاعدة مستقلة باسم <code>madinah-initiatives-platform-db</code></p>
      </section>

      ${can(role, 'backup.run') ? raw(html`
      <section class="mi-card">
        <h3>النسخ الاحتياطي والاستعادة</h3>
        <p class="mi-muted">النسخة تشمل بيانات هذه المنصة فقط، بمخطط موثّق ومجموع تحقق.</p>
        <div class="mi-settings-actions">
          <button class="mi-btn mi-btn--primary" data-act="backup">تنزيل نسخة احتياطية</button>
          <label class="mi-btn mi-btn--ghost mi-file-btn">استعادة من ملف<input type="file" accept="application/json" data-act="restore" hidden></label>
        </div>
      </section>`) : ''}

      <section class="mi-card mi-card--span">
        <h3>سجل التدقيق (آخر 25 حركة)</h3>
        ${logs.length ? raw(`<div class="mi-table-wrap"><table class="mi-table"><thead><tr><th>الوقت</th><th>المستخدم</th><th>الفعل</th><th>الكيان</th><th>السجل</th></tr></thead><tbody>` +
      logs.map((l) => `<tr><td>${escapeHtml(fmtDateTime(l.at))}</td><td>${escapeHtml(l.actor)}</td><td>${escapeHtml(l.action)}</td><td>${escapeHtml(l.store)}</td><td dir="ltr">${escapeHtml(l.recordId || '')}</td></tr>`).join('') +
      '</tbody></table></div>') : raw('<p class="mi-muted">لا حركات مسجلة بعد</p>')}
        ${can(role, 'backup.run') ? raw('<button class="mi-btn mi-btn--ghost" data-act="prune">تنقية السجل (إبقاء آخر 500)</button>') : ''}
      </section>
    </div>`;

  container.querySelector('#mi-set-name').addEventListener('change', (e) => {
    setUserName(e.target.value.trim() || 'مستخدم تجريبي');
    toastSuccess('حُدّث اسم المستخدم');
  });
  container.querySelector('#mi-set-role').addEventListener('change', (e) => {
    setRole(e.target.value);
    toastSuccess(`تغيّر الدور إلى: ${ROLES[e.target.value].label}`);
    renderSettings(container);
  });
  container.querySelector('#mi-set-theme').addEventListener('change', (e) => {
    setTheme(e.target.value);
  });

  container.querySelector('[data-act="backup"]')?.addEventListener('click', async () => {
    await downloadBackup();
    toastSuccess('نُزّلت النسخة الاحتياطية');
  });

  container.querySelector('[data-act="restore"]')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const payload = await readJsonFile(file);
      const check = validateBackup(payload);
      if (!check.valid) { toastError(check.errors[0]); return; }
      const replace = await confirmModal('استعادة نسخة احتياطية',
        'هل تريد استبدال جميع البيانات الحالية بمحتوى النسخة؟ اختر «إلغاء» للدمج بدون حذف.',
        { confirmLabel: 'استبدال كامل', danger: true });
      const result = await restoreBackup(payload, { replace });
      toastSuccess(`استُعيد ${result.restored} سجلًا`);
      renderSettings(container);
    } catch (err) {
      toastError(err.message);
    } finally {
      e.target.value = '';
    }
  });

  container.querySelector('[data-act="prune"]')?.addEventListener('click', async () => {
    const removed = await pruneAuditLogs(500);
    toastSuccess(removed ? `حُذف ${removed} سجل تدقيق قديم` : 'السجل ضمن الحد ولا حاجة للتنقية');
    renderSettings(container);
  });
}
