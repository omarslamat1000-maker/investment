// صفحة إدارة معرض الصور — شاشة كاملة لمدير النظام داخل التطبيق:
// رفع وتنزيل وتعديل وتخصيص وحذف الصور، وربطها بالمبادرات، مع تصفية ومعاينة
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader, emptyState, kpiCard } from '../../ui/components.js';
import { statusLabel, statusColor } from '../../domain/workflow.js';
import { getRole } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { openModal, confirmModal } from '../../ui/modal.js';
import { toastSuccess } from '../../ui/toast.js';
import { sortBy, fmtNumber } from '../../core/utils.js';
import { fmtDate } from '../../core/date-time.js';
import { navigate } from '../../router.js';
import { openGalleryEditor, downloadGalleryImage, GALLERY_STATUSES } from './gallery-editor.js';

export async function renderGalleryAdmin(container) {
  const role = getRole();
  if (!can(role, 'gallery.manage')) {
    container.innerHTML = emptyState('لا تملك صلاحية الوصول',
      'إدارة معرض الصور من صلاحيات مدير النظام (gallery.manage)');
    return;
  }

  const [items, initiatives] = await Promise.all([
    repos.gallery.getAll(), repos.initiatives.getAll()
  ]);
  const sorted = sortBy(items, (g) => g.order ?? 99);
  const linked = sorted.filter((g) => g.initiativeId);
  const iniTitle = (id) => initiatives.find((i) => i.id === id)?.title || id;

  let statusFilter = '';
  let query = '';

  container.innerHTML = html`
    ${raw(sectionHeader('إدارة معرض الصور',
    'الصور الظاهرة في معرض الصفحة الرئيسية — رفع وتنزيل وتعديل وتخصيص وحذف وربط بالمبادرات',
    `<a class="mi-btn mi-btn--ghost" href="./index.html#mi-gallery" target="_blank" rel="noopener">عرض المعرض العام ↗</a>
     <button class="mi-btn mi-btn--primary" data-ga="add">رفع صورة جديدة</button>`))}

    <div class="mi-kpi-grid">
      ${raw(kpiCard('صور المعرض', fmtNumber(sorted.length), '', 'primary'))}
      ${raw(kpiCard('مرتبطة بمبادرات', fmtNumber(linked.length), '', 'gold'))}
      ${raw(kpiCard('قيد التنفيذ', fmtNumber(sorted.filter((g) => g.status === 'execution').length), '', 'exec'))}
      ${raw(kpiCard('منجزة', fmtNumber(sorted.filter((g) => ['closed', 'benefits'].includes(g.status)).length), '', 'ok'))}
    </div>

    <div class="mi-filters" role="group" aria-label="تصفية المعرض">
      <button class="mi-chip" data-status="" aria-pressed="true">الكل (${String(sorted.length)})</button>
      ${raw(GALLERY_STATUSES.map((s) => {
    const n = sorted.filter((g) => g.status === s).length;
    return n ? `<button class="mi-chip" data-status="${s}" aria-pressed="false">${STATUS_LABEL(s)} (${n})</button>` : '';
  }).join(''))}
      <input type="search" class="mi-input mi-gallery-search" placeholder="بحث بالاسم أو الوصف…" aria-label="بحث في المعرض">
    </div>

    <div class="mi-gallery-grid" data-ga-grid></div>`;

  function STATUS_LABEL(s) { return statusLabel(s); }

  const grid = container.querySelector('[data-ga-grid]');

  function visibleItems() {
    let out = sorted;
    if (statusFilter) out = out.filter((g) => g.status === statusFilter);
    if (query) {
      const q = query.toLowerCase();
      out = out.filter((g) => (g.title + ' ' + (g.caption || '') + ' ' + (g.initiativeId || '')).toLowerCase().includes(q));
    }
    return out;
  }

  function drawGrid() {
    const list = visibleItems();
    if (!list.length) {
      grid.innerHTML = emptyState('لا صور مطابقة',
        sorted.length ? 'عدّل التصفية أو البحث' : 'ارفع أول صورة للمعرض من الزر أعلاه');
      return;
    }
    grid.innerHTML = list.map((g) => html`
      <figure class="mi-gallery-card mi-gallery-card--admin" data-id="${g.id}">
        <img src="${g.imageDataUrl}" alt="${g.title}" loading="lazy">
        <span class="mi-status-badge mi-gallery-card__status" data-tone="${statusColor(g.status)}">${statusLabel(g.status)}</span>
        <span class="mi-gallery-card__order" title="ترتيب العرض">#${String(g.order ?? 1)}</span>
        <figcaption>
          <b>${g.title}</b>
          ${g.caption ? raw(`<small>${escapeHtml(g.caption)}</small>`) : ''}
          ${g.initiativeId ? raw(`<button class="mi-tag mi-tag--gold mi-gallery-card__link" data-ga-open-ini="${escapeHtml(g.initiativeId)}" title="${escapeHtml(iniTitle(g.initiativeId))}">↗ ${escapeHtml(g.initiativeId)}</button>`) : raw('<small class="mi-muted">غير مرتبطة بمبادرة</small>')}
        </figcaption>
        <div class="mi-gallery-card__tools">
          <button class="mi-btn mi-btn--ghost mi-btn--sm" data-ga-view="${g.id}" title="معاينة">🔍</button>
          <button class="mi-btn mi-btn--ghost mi-btn--sm" data-ga-dl="${g.id}" title="تنزيل الصورة">⬇</button>
          <button class="mi-btn mi-btn--ghost mi-btn--sm" data-ga-edit="${g.id}" title="تعديل">✎</button>
          <button class="mi-btn mi-btn--ghost mi-btn--sm" data-ga-del="${g.id}" title="حذف">🗑</button>
        </div>
      </figure>`).join('');

    wireCards();
  }

  const rerender = () => renderGalleryAdmin(container);

  function wireCards() {
    grid.querySelectorAll('[data-ga-view]').forEach((b) => b.addEventListener('click', () => {
      const g = sorted.find((x) => x.id === b.dataset.gaView);
      const { dialog, close } = openModal({
        title: g.title,
        wide: true,
        bodyHtml: html`
          <img src="${g.imageDataUrl}" alt="${g.title}" style="width:100%;border-radius:10px">
          <p class="mi-muted" style="margin-top:.5rem">${statusLabel(g.status)}${g.caption ? raw(' — ' + escapeHtml(g.caption)) : ''}
            ${g.initiativeId ? raw(' • ' + escapeHtml(g.initiativeId)) : ''} • أُضيفت ${fmtDate(g.createdAt)}</p>`,
        footerHtml: html`<button class="mi-btn mi-btn--ghost" data-act="x">إغلاق</button>`
      });
      dialog.querySelector('[data-act="x"]').addEventListener('click', close);
    }));

    grid.querySelectorAll('[data-ga-dl]').forEach((b) => b.addEventListener('click', () => {
      downloadGalleryImage(sorted.find((x) => x.id === b.dataset.gaDl));
      toastSuccess('نُزّلت الصورة');
    }));

    grid.querySelectorAll('[data-ga-edit]').forEach((b) => b.addEventListener('click', () =>
      openGalleryEditor({ item: sorted.find((x) => x.id === b.dataset.gaEdit), onSaved: rerender })));

    grid.querySelectorAll('[data-ga-del]').forEach((b) => b.addEventListener('click', async () => {
      const g = sorted.find((x) => x.id === b.dataset.gaDel);
      const sure = await confirmModal('حذف صورة من المعرض',
        `ستُحذف «${g.title}» من المعرض نهائيًا (لا يؤثر على المبادرة نفسها). متابعة؟`,
        { confirmLabel: 'حذف', danger: true });
      if (!sure) return;
      await repos.gallery.remove(g.id);
      toastSuccess('حُذفت الصورة');
      rerender();
    }));

    grid.querySelectorAll('[data-ga-open-ini]').forEach((b) => b.addEventListener('click', () =>
      navigate(`initiatives/${b.dataset.gaOpenIni}`)));
  }

  container.querySelector('[data-ga="add"]').addEventListener('click', () =>
    openGalleryEditor({ defaultOrder: sorted.length + 1, onSaved: rerender }));

  container.querySelectorAll('.mi-chip').forEach((chip) => chip.addEventListener('click', () => {
    container.querySelectorAll('.mi-chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
    chip.setAttribute('aria-pressed', 'true');
    statusFilter = chip.dataset.status;
    drawGrid();
  }));

  container.querySelector('.mi-gallery-search').addEventListener('input', (e) => {
    query = e.target.value.trim();
    drawGrid();
  });

  drawGrid();
}
