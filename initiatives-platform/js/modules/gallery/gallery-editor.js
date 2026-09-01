// محرر صورة المعرض المشترك — تستخدمه صفحة الإدارة ومعرض الصفحة الرئيسية
// اختيار الصورة (بضغط تلقائي)، الربط بمبادرة يعبئ الاسم والحالة، الحالة والترتيب والوصف
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { STATUSES } from '../../core/constants.js';
import { openModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { pickInitiativeImage } from '../../services/image-service.js';
import { uid } from '../../core/utils.js';

// الحالات المتاحة للعرض في المعرض العام
export const GALLERY_STATUSES = ['execution', 'benefits', 'closed', 'readiness', 'approval'];

// فتح محرر إضافة/تعديل — onSaved(record) بعد الحفظ
export async function openGalleryEditor({ item = null, defaultOrder = 1, onSaved }) {
  const initiatives = await repos.initiatives.getAll();
  const existing = item;
  const record = existing || {
    id: uid('gal'), title: '', status: 'execution', caption: '',
    imageDataUrl: null, initiativeId: '', order: defaultOrder
  };
  let imageDataUrl = record.imageDataUrl;

  const { dialog, close } = openModal({
    title: existing ? 'تعديل صورة المعرض' : 'إضافة صورة للمعرض',
    wide: true,
    bodyHtml: html`
      <form class="mi-form" id="mi-gal-form">
        <div class="mi-image-field">
          <img class="mi-image-thumb mi-gal-preview" src="${imageDataUrl || ''}" alt="" ${imageDataUrl ? '' : raw('hidden')}>
          <span class="mi-image-empty mi-gal-empty" aria-hidden="true" ${imageDataUrl ? raw('hidden') : ''}>🖼</span>
          <div class="mi-image-field__actions">
            <button type="button" class="mi-btn mi-btn--primary mi-btn--sm" data-gal="pick">${imageDataUrl ? 'تغيير الصورة' : 'رفع الصورة'}</button>
            <small class="mi-muted">PNG / JPEG / WebP — تُضغط تلقائيًا حتى 1280px</small>
          </div>
        </div>
        <div class="mi-form-field"><label>ربط بمبادرة (يعبئ الاسم والحالة تلقائيًا)</label>
          <select class="mi-input" name="initiativeId">
            <option value="">— بدون ربط —</option>
            ${raw(initiatives.map((i) => `<option value="${escapeHtml(i.id)}" ${i.id === record.initiativeId ? 'selected' : ''}>${escapeHtml(i.id)} — ${escapeHtml(i.title)}</option>`).join(''))}
          </select></div>
        <div class="mi-form-row">
          <div class="mi-form-field"><label>اسم المبادرة الظاهر في المعرض</label>
            <input class="mi-input" name="title" value="${record.title}"></div>
          <div class="mi-form-field"><label>الحالة</label>
            <select class="mi-input" name="status">
              ${raw(GALLERY_STATUSES.map((s) => `<option value="${s}" ${s === record.status ? 'selected' : ''}>${STATUSES[s].label}</option>`).join(''))}
            </select></div>
          <div class="mi-form-field"><label>ترتيب العرض</label>
            <input class="mi-input" name="order" type="number" min="1" value="${String(record.order ?? 1)}"></div>
        </div>
        <div class="mi-form-field"><label>وصف قصير يظهر تحت الصورة (اختياري — حتى 140 حرفًا)</label>
          <input class="mi-input" name="caption" value="${record.caption || ''}" maxlength="140"></div>
      </form>`,
    footerHtml: html`
      <button class="mi-btn mi-btn--ghost" data-act="cancel">إلغاء</button>
      <button class="mi-btn mi-btn--primary" data-act="save">${existing ? 'حفظ التعديلات' : 'إضافة للمعرض'}</button>`
  });

  const form = dialog.querySelector('#mi-gal-form');

  dialog.querySelector('[data-gal="pick"]').addEventListener('click', async () => {
    try {
      const picked = await pickInitiativeImage();
      if (!picked) return;
      imageDataUrl = picked;
      const preview = dialog.querySelector('.mi-gal-preview');
      preview.src = picked; preview.hidden = false;
      dialog.querySelector('.mi-gal-empty').hidden = true;
      dialog.querySelector('[data-gal="pick"]').textContent = 'تغيير الصورة';
    } catch (err) { toastError(err.message); }
  });

  form.initiativeId.addEventListener('change', () => {
    const ini = initiatives.find((i) => i.id === form.initiativeId.value);
    if (ini) {
      form.title.value = ini.title;
      if (GALLERY_STATUSES.includes(ini.status)) form.status.value = ini.status;
      // إن كانت للمبادرة صورة ولم تُختر صورة بعد، استخدمها تلقائيًا
      if (!imageDataUrl && ini.imageDataUrl) {
        imageDataUrl = ini.imageDataUrl;
        const preview = dialog.querySelector('.mi-gal-preview');
        preview.src = imageDataUrl; preview.hidden = false;
        dialog.querySelector('.mi-gal-empty').hidden = true;
      }
    }
  });

  dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
  dialog.querySelector('[data-act="save"]').addEventListener('click', async () => {
    const title = form.title.value.trim();
    if (!imageDataUrl) { toastError('ارفع صورة أولًا'); return; }
    if (title.length < 5) { toastError('اسم المبادرة مطلوب (5 أحرف على الأقل)'); return; }
    const saved = {
      ...record,
      title,
      status: form.status.value,
      caption: form.caption.value.trim(),
      initiativeId: form.initiativeId.value || null,
      order: Math.max(1, Number(form.order.value) || 1),
      imageDataUrl
    };
    if (existing) await repos.gallery.update(record.id, saved);
    else await repos.gallery.create(saved);
    close();
    toastSuccess(existing ? 'حُدّثت صورة المعرض' : 'أُضيفت الصورة للمعرض');
    onSaved?.(saved);
  });
}

// تنزيل صورة معرض كملف
export function downloadGalleryImage(item) {
  const ext = /^data:image\/png/.test(item.imageDataUrl) ? 'png'
    : /^data:image\/svg/.test(item.imageDataUrl) ? 'svg' : 'jpg';
  const a = document.createElement('a');
  a.href = item.imageDataUrl;
  a.download = `${item.title.replace(/[\\/:*?"<>|]/g, ' ').trim()}.${ext}`;
  a.click();
}
