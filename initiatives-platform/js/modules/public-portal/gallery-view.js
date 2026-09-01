// معرض صور المبادرات — عرض عام احترافي بصندوق ضوئي (Lightbox)،
// وإدارة كاملة (إضافة/تعديل/حذف) لمن يملك صلاحية gallery.manage (مدير النظام)
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { STATUSES } from '../../core/constants.js';
import { statusLabel, statusColor } from '../../domain/workflow.js';
import { getSession, getRole } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { openModal, confirmModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { pickInitiativeImage } from '../../services/image-service.js';
import { sortBy, uid } from '../../core/utils.js';
import { fmtDate } from '../../core/date-time.js';

// الحالات المتاحة في المعرض (المعروضة للجمهور)
const GALLERY_STATUSES = ['execution', 'benefits', 'closed', 'readiness', 'approval'];

export async function renderGallery(container) {
  const items = sortBy(await repos.gallery.getAll(), (g) => g.order ?? 99);
  const session = getSession();
  const manage = Boolean(session) && can(getRole(), 'gallery.manage');

  if (!items.length && !manage) {
    container.closest('section')?.setAttribute('hidden', '');
    return;
  }
  container.closest('section')?.removeAttribute('hidden');

  container.innerHTML = html`
    ${manage ? raw(`
      <div class="mi-gallery-admin-bar">
        <span class="mi-tag mi-tag--gold">وضع الإدارة — ${escapeHtml(session.name)}</span>
        <button class="mi-btn mi-btn--primary mi-btn--sm" data-gal="add">إضافة صورة للمعرض</button>
      </div>`) : ''}
    <div class="mi-gallery-grid">
      ${items.length ? raw(items.map((g, i) => html`
        <figure class="mi-gallery-card" data-idx="${String(i)}" tabindex="0" role="button"
                aria-label="عرض صورة ${g.title}">
          <img src="${g.imageDataUrl}" alt="${g.title}" loading="lazy">
          <span class="mi-status-badge mi-gallery-card__status" data-tone="${statusColor(g.status)}">${statusLabel(g.status)}</span>
          <figcaption>
            <b>${g.title}</b>
            ${g.caption ? raw(`<small>${escapeHtml(g.caption)}</small>`) : ''}
          </figcaption>
          ${manage ? raw(`
            <div class="mi-gallery-card__tools">
              <button class="mi-btn mi-btn--ghost mi-btn--sm" data-gal-edit="${escapeHtml(g.id)}" aria-label="تعديل">✎</button>
              <button class="mi-btn mi-btn--ghost mi-btn--sm" data-gal-del="${escapeHtml(g.id)}" aria-label="حذف">🗑</button>
            </div>`) : ''}
        </figure>`).join('')) : raw('<p class="mi-muted">المعرض فارغ — أضف أول صورة من زر الإدارة</p>')}
    </div>`;

  // ————— الصندوق الضوئي —————
  function openLightbox(startIdx) {
    let idx = startIdx;
    const overlay = document.createElement('div');
    overlay.className = 'mi-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'معرض الصور');
    document.body.appendChild(overlay);

    function drawSlide() {
      const g = items[idx];
      overlay.innerHTML = html`
        <button class="mi-lightbox__close" aria-label="إغلاق">✕</button>
        <button class="mi-lightbox__nav mi-lightbox__nav--prev" aria-label="السابق">‹</button>
        <figure class="mi-lightbox__figure">
          <img src="${g.imageDataUrl}" alt="${g.title}">
          <figcaption>
            <span class="mi-status-badge" data-tone="${statusColor(g.status)}">${statusLabel(g.status)}</span>
            <b>${g.title}</b>
            ${g.caption ? raw(`<small>${escapeHtml(g.caption)}</small>`) : ''}
            <small class="mi-lightbox__count">${String(idx + 1)} / ${String(items.length)}</small>
          </figcaption>
        </figure>
        <button class="mi-lightbox__nav mi-lightbox__nav--next" aria-label="التالي">›</button>`;
      overlay.querySelector('.mi-lightbox__close').addEventListener('click', close);
      overlay.querySelector('.mi-lightbox__nav--prev').addEventListener('click', () => step(-1));
      overlay.querySelector('.mi-lightbox__nav--next').addEventListener('click', () => step(1));
      overlay.querySelector('.mi-lightbox__close').focus();
    }
    function step(d) { idx = (idx + d + items.length) % items.length; drawSlide(); }
    function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') step(1);   // RTL: يسار = التالي
      if (e.key === 'ArrowRight') step(-1);
    }
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    drawSlide();
  }

  container.querySelectorAll('.mi-gallery-card').forEach((card) => {
    const open = (e) => {
      if (e.target.closest('[data-gal-edit],[data-gal-del]')) return;
      openLightbox(Number(card.dataset.idx));
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(e); });
  });

  if (!manage) return;

  // ————— إدارة المدير: إضافة / تعديل / حذف —————
  async function openGalleryModal(existing) {
    const initiatives = await repos.initiatives.getAll();
    const item = existing || { id: uid('gal'), title: '', status: 'execution', caption: '', imageDataUrl: null, initiativeId: '', order: items.length + 1 };
    let imageDataUrl = item.imageDataUrl;

    const { dialog, close } = openModal({
      title: existing ? 'تعديل صورة المعرض' : 'إضافة صورة للمعرض',
      wide: true,
      bodyHtml: html`
        <form class="mi-form" id="mi-gal-form">
          <div class="mi-image-field">
            <img class="mi-image-thumb mi-gal-preview" src="${imageDataUrl || ''}" alt="" ${imageDataUrl ? '' : raw('hidden')}>
            <span class="mi-image-empty mi-gal-empty" aria-hidden="true" ${imageDataUrl ? raw('hidden') : ''}>🖼</span>
            <div class="mi-image-field__actions">
              <button type="button" class="mi-btn mi-btn--primary mi-btn--sm" data-gal="pick">${imageDataUrl ? 'تغيير الصورة' : 'اختيار الصورة'}</button>
              <small class="mi-muted">PNG / JPEG / WebP — تُضغط تلقائيًا</small>
            </div>
          </div>
          <div class="mi-form-field"><label>ربط بمبادرة (اختياري — يعبئ الاسم والحالة تلقائيًا)</label>
            <select class="mi-input" name="initiativeId">
              <option value="">— بدون ربط —</option>
              ${raw(initiatives.map((i) => `<option value="${escapeHtml(i.id)}" ${i.id === item.initiativeId ? 'selected' : ''}>${escapeHtml(i.title)}</option>`).join(''))}
            </select></div>
          <div class="mi-form-row">
            <div class="mi-form-field"><label>اسم المبادرة</label>
              <input class="mi-input" name="title" value="${item.title}"></div>
            <div class="mi-form-field"><label>الحالة</label>
              <select class="mi-input" name="status">
                ${raw(GALLERY_STATUSES.map((s) => `<option value="${s}" ${s === item.status ? 'selected' : ''}>${STATUSES[s].label}</option>`).join(''))}
              </select></div>
            <div class="mi-form-field"><label>ترتيب العرض</label>
              <input class="mi-input" name="order" type="number" min="1" value="${String(item.order ?? 1)}"></div>
          </div>
          <div class="mi-form-field"><label>وصف قصير يظهر تحت الصورة (اختياري)</label>
            <input class="mi-input" name="caption" value="${item.caption || ''}" maxlength="140"></div>
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
      }
    });

    dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
    dialog.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const title = form.title.value.trim();
      if (!imageDataUrl) { toastError('اختر صورة أولًا'); return; }
      if (title.length < 5) { toastError('اسم المبادرة مطلوب (5 أحرف على الأقل)'); return; }
      const record = {
        ...item,
        title,
        status: form.status.value,
        caption: form.caption.value.trim(),
        initiativeId: form.initiativeId.value || null,
        order: Math.max(1, Number(form.order.value) || 1),
        imageDataUrl
      };
      if (existing) await repos.gallery.update(item.id, record);
      else await repos.gallery.create(record);
      close();
      toastSuccess(existing ? 'حُدّثت صورة المعرض' : 'أُضيفت الصورة للمعرض');
      renderGallery(container);
    });
  }

  container.querySelector('[data-gal="add"]').addEventListener('click', () => openGalleryModal(null));
  container.querySelectorAll('[data-gal-edit]').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openGalleryModal(items.find((g) => g.id === btn.dataset.galEdit));
    }));
  container.querySelectorAll('[data-gal-del]').forEach((btn) =>
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const g = items.find((x) => x.id === btn.dataset.galDel);
      const sure = await confirmModal('حذف صورة من المعرض',
        `ستُحذف صورة «${g.title}» (أضيفت ${fmtDate(g.createdAt)}) من المعرض نهائيًا. متابعة؟`,
        { confirmLabel: 'حذف', danger: true });
      if (!sure) return;
      await repos.gallery.remove(g.id);
      toastSuccess('حُذفت الصورة');
      renderGallery(container);
    }));
}
