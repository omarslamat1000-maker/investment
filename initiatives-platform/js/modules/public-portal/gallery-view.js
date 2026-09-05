// معرض صور المبادرات — عرض عام احترافي بصندوق ضوئي (Lightbox)،
// وإدارة كاملة (إضافة/تعديل/حذف) لمن يملك صلاحية gallery.manage (مدير النظام)
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { STATUSES } from '../../core/constants.js';
import { statusLabel, statusColor } from '../../domain/workflow.js';
import { getSession, getRole } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { confirmModal } from '../../ui/modal.js';
import { toastSuccess } from '../../ui/toast.js';
import { sortBy } from '../../core/utils.js';
import { fmtDate } from '../../core/date-time.js';
import { openGalleryEditor } from '../gallery/gallery-editor.js';

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
        <a class="mi-btn mi-btn--ghost mi-btn--sm" href="./app.html#/gallery">صفحة إدارة المعرض الكاملة ↗</a>
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
            ${g.initiativeId ? raw(`<a class="mi-gallery-card__link" href="./initiative.html?id=${encodeURIComponent(g.initiativeId)}">صفحة المبادرة ↗</a>`) : ''}
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

  // ————— إدارة المدير: إضافة / تعديل / حذف (المحرر المشترك) —————
  const rerender = () => renderGallery(container);

  container.querySelector('[data-gal="add"]').addEventListener('click', () =>
    openGalleryEditor({ defaultOrder: items.length + 1, onSaved: rerender }));
  container.querySelectorAll('[data-gal-edit]').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openGalleryEditor({ item: items.find((g) => g.id === btn.dataset.galEdit), onSaved: rerender });
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
      rerender();
    }));
}

