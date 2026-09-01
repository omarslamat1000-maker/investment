// سجل الاحتياجات — فرص البنية التحتية المطروحة للشراكة وإدارتها
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { sectionHeader } from '../../ui/components.js';
import { renderTable } from '../../ui/table.js';
import { needStatusLabel, PRIORITY_LABELS, newNeed, validateNeed, sanitizeNeed } from '../../domain/infrastructure-need-model.js';
import { categoryLabel } from '../../domain/initiative-model.js';
import { modelLabel } from '../../domain/partner-model.js';
import { CATEGORIES, DISTRICTS } from '../../core/constants.js';
import { fmtMoney, fmtNumber } from '../../core/utils.js';
import { fmtDate } from '../../core/date-time.js';
import { getRole, getSession } from '../../core/state.js';
import { can } from '../../core/permissions.js';
import { openModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { openLocationPicker } from '../../ui/location-picker.js';
import { measureLabel } from '../../core/geo.js';
import { APPLICATION_STATUS, adoptNeed } from '../../services/application-service.js';

export async function renderNeeds(container) {
  const [needs, allApplications] = await Promise.all([
    repos.needs.getAll(),
    // جدول الطلبات غير مهيأ بعد في وضع السحابة — تجاهل بأمان
    repos.needApplications.getAll().catch(() => [])
  ]);
  const role = getRole();

  container.innerHTML = html`
    ${raw(sectionHeader('احتياجات البنية التحتية', 'الفرص التي تطرحها الأمانة لتتبناها جهات القطاع الخاص والمجتمع',
    can(role, 'needs.create') ? '<button class="mi-btn mi-btn--primary" data-act="new">طرح احتياج جديد</button>' : ''))}
    <div class="mi-table-host"></div>`;

  const host = container.querySelector('.mi-table-host');
  renderTable(host, needs, [
    { key: 'id', label: 'المعرّف', width: '10rem' },
    { key: 'title', label: 'الاحتياج' },
    { key: 'category', label: 'التصنيف', map: (r) => categoryLabel(r.category) },
    { key: 'district', label: 'الحي' },
    { key: 'priority', label: 'الأولوية', map: (r) => PRIORITY_LABELS[r.priority] || r.priority },
    { key: 'estimatedCost', label: 'التكلفة التقديرية', map: (r) => fmtMoney(r.estimatedCost), sortValue: (r) => Number(r.estimatedCost) || 0 },
    { key: 'applicants', label: 'المتقدمون', map: (r) => fmtNumber(allApplications.filter((a) => a.needId === r.id).length), sortValue: (r) => allApplications.filter((a) => a.needId === r.id).length },
    { key: 'status', label: 'الحالة', map: (r) => needStatusLabel(r.status) }
  ], {
    searchable: true, initialSort: 'id',
    onRowClick: (r) => openNeedModal(r),
    emptyText: 'لا توجد احتياجات مسجلة'
  });

  container.querySelector('[data-act="new"]')?.addEventListener('click', () => openNeedModal(null));

  function openNeedModal(existing) {
    const need = existing || newNeed();
    const editable = can(role, existing ? 'needs.edit' : 'needs.create');
    const applications = existing ? allApplications.filter((a) => a.needId === existing.id) : [];
    const canDecide = can(role, 'decisions.create');
    const decidable = canDecide && existing?.status === 'published' && applications.length > 0;

    // لوحة المفاضلة: مقارنة المتقدمين واعتماد واحد أو شراكة مشتركة
    const comparisonHtml = !existing ? '' : html`
      <div class="mi-card" style="margin-top:1rem" id="mi-need-apps">
        <h3>المتقدمون على الفرصة ${applications.length ? raw(`<small class="mi-muted">(${escapeHtml(fmtNumber(applications.length))})</small>`) : ''}</h3>
        ${applications.length ? raw(applications.map((a) => {
          const st = APPLICATION_STATUS[a.status] || APPLICATION_STATUS.applied;
          const badge = a.status === 'accepted' ? 'achieved' : a.status === 'rejected' ? 'atRisk' : 'onTrack';
          return html`
            <label class="mi-ms" data-done="${a.status === 'accepted' ? 'yes' : 'no'}" style="align-items:flex-start">
              ${decidable && a.status === 'applied'
              ? raw(`<input type="checkbox" data-app-select value="${escapeHtml(a.id)}" style="margin-top:0.3rem">`)
              : raw('<span class="mi-ms__dot" aria-hidden="true" style="margin-top:0.45rem"></span>')}
              <span>
                <b>${a.partnerName}</b> — ${modelLabel(a.model)}
                <span class="mi-tag" data-benefit="${badge}">${st.label}</span><br>
                <small class="mi-muted">${a.proposal}</small>
              </span>
              <small>${fmtDate(a.at)}</small>
            </label>`;
        }).join('')) : raw('<p class="mi-muted">لا طلبات تقديم على هذه الفرصة بعد — تصل الطلبات من بوابة الشركاء.</p>')}
        ${decidable ? raw(`
          <p class="mi-muted" style="margin-top:0.75rem">حدد جهة واحدة لاعتمادها منفردة، أو أكثر من جهة لاعتماد شراكة مشتركة — تُنشأ مبادرة واحدة يرتبط بها كل المعتمدين وتُرفض بقية الطلبات.</p>
          <button type="button" class="mi-btn mi-btn--gold" data-act="adopt" disabled>اعتماد المحدد وإنشاء المبادرة</button>`) : ''}
        ${existing.status === 'matched' && existing.matchedInitiativeId
        ? raw(`<p class="mi-muted" style="margin-top:0.75rem">اكتملت المفاضلة — المبادرة الناتجة: <a href="#/initiatives/${escapeHtml(existing.matchedInitiativeId)}" data-close-modal>${escapeHtml(existing.matchedInitiativeId)}</a></p>`)
        : ''}
      </div>`;

    const { dialog, close } = openModal({
      title: existing ? `احتياج ${existing.id}` : 'طرح احتياج جديد',
      wide: true,
      bodyHtml: html`
        <form class="mi-form" id="mi-need-form">
          <div class="mi-form-field"><label>عنوان الاحتياج</label><input class="mi-input" name="title" value="${need.title}" ${editable ? '' : raw('readonly')}></div>
          <div class="mi-form-field"><label>الوصف</label><textarea class="mi-input" name="description" rows="3" ${editable ? '' : raw('readonly')}>${need.description}</textarea></div>
          <div class="mi-form-row">
            <div class="mi-form-field"><label>التصنيف</label>
              <select class="mi-input" name="category" ${editable ? '' : raw('disabled')}>${raw(CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === need.category ? 'selected' : ''}>${c.label}</option>`).join(''))}</select></div>
            <div class="mi-form-field"><label>الحي</label>
              <select class="mi-input" name="district" ${editable ? '' : raw('disabled')}>${raw(DISTRICTS.map((d) => `<option ${d === need.district ? 'selected' : ''}>${d}</option>`).join(''))}</select></div>
            <div class="mi-form-field"><label>الأولوية</label>
              <select class="mi-input" name="priority" ${editable ? '' : raw('disabled')}>
                ${raw(Object.entries(PRIORITY_LABELS).map(([k, v]) => `<option value="${k}" ${k === need.priority ? 'selected' : ''}>${v}</option>`).join(''))}
              </select></div>
          </div>
          <div class="mi-form-row">
            <div class="mi-form-field"><label>التكلفة التقديرية (ريال)</label><input class="mi-input" name="estimatedCost" type="number" min="0" value="${need.estimatedCost ?? ''}" ${editable ? '' : raw('readonly')}></div>
            <div class="mi-form-field"><label>المستفيدون</label><input class="mi-input" name="beneficiaries" type="number" min="0" value="${need.beneficiaries ?? ''}" ${editable ? '' : raw('readonly')}></div>
          </div>
          <div class="mi-form-field"><label>الأثر المتوقع</label><textarea class="mi-input" name="expectedImpact" rows="2" ${editable ? '' : raw('readonly')}>${need.expectedImpact}</textarea></div>
          <div class="mi-form-field">
            <label>الموقع على الخريطة</label>
            <div class="mi-geo-field" data-has="${need.geometry ? 'yes' : 'no'}">
              <span class="mi-geo-field__label" data-geo-label>${need.geometry ? raw(escapeHtml(measureLabel(need.geometry))) : 'لم يُحدد بعد'}</span>
              ${editable ? raw('<button type="button" class="mi-btn mi-btn--primary mi-btn--sm" data-act="pick-geo">تحديد / تعديل الموقع</button>') : ''}
            </div>
          </div>
        </form>
        ${raw(comparisonHtml)}`,
      footerHtml: html`
        <button class="mi-btn mi-btn--ghost" data-act="cancel">إغلاق</button>
        ${editable ? raw('<button class="mi-btn mi-btn--primary" data-act="save">حفظ</button>') : ''}
        ${existing && existing.status === 'draft' && can(role, 'needs.publish') ? raw('<button class="mi-btn mi-btn--gold" data-act="publish">نشر للشراكة</button>') : ''}`
    });

    // هندسة الموقع تُحفظ في متغير محلي حتى الضغط على حفظ
    let pendingGeometry = need.geometry || null;
    dialog.querySelector('[data-act="pick-geo"]')?.addEventListener('click', () => {
      openLocationPicker({
        initial: pendingGeometry,
        onConfirm(geometry) {
          pendingGeometry = geometry;
          const label = dialog.querySelector('[data-geo-label]');
          if (label) label.textContent = measureLabel(geometry);
        }
      });
    });

    // المفاضلة: تفعيل زر الاعتماد وتحديث نصه حسب عدد المحدد (واحد أو شراكة مشتركة)
    const adoptBtn = dialog.querySelector('[data-act="adopt"]');
    if (adoptBtn) {
      const boxes = [...dialog.querySelectorAll('[data-app-select]')];
      const refresh = () => {
        const n = boxes.filter((b) => b.checked).length;
        adoptBtn.disabled = n === 0;
        adoptBtn.textContent = n > 1
          ? `اعتماد شراكة مشتركة (${fmtNumber(n)} جهات) وإنشاء المبادرة`
          : 'اعتماد المحدد وإنشاء المبادرة';
      };
      boxes.forEach((b) => b.addEventListener('change', refresh));
      adoptBtn.addEventListener('click', async () => {
        const selectedIds = boxes.filter((b) => b.checked).map((b) => b.value);
        if (!selectedIds.length) return;
        adoptBtn.disabled = true;
        try {
          const initiative = await adoptNeed({
            need: existing, applications, selectedIds,
            byName: getSession()?.name || 'لجنة الفرز'
          });
          close();
          toastSuccess(selectedIds.length > 1
            ? `اعتُمدت شراكة مشتركة وأُنشئت المبادرة ${initiative.id}`
            : `اعتُمد المتقدم وأُنشئت المبادرة ${initiative.id}`);
          renderNeeds(container);
        } catch (err) {
          adoptBtn.disabled = false;
          toastError(err.message || 'تعذر اعتماد المفاضلة');
        }
      });
    }

    dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
    dialog.querySelector('[data-act="save"]')?.addEventListener('click', async () => {
      const form = dialog.querySelector('#mi-need-form');
      const record = sanitizeNeed({
        ...need,
        geometry: pendingGeometry,
        lat: pendingGeometry?.coords?.[0]?.[0] ?? need.lat,
        lng: pendingGeometry?.coords?.[0]?.[1] ?? need.lng,
        title: form.title.value, description: form.description.value,
        category: form.category.value, district: form.district.value,
        priority: form.priority.value,
        estimatedCost: form.estimatedCost.value ? Number(form.estimatedCost.value) : null,
        beneficiaries: form.beneficiaries.value ? Number(form.beneficiaries.value) : null,
        expectedImpact: form.expectedImpact.value
      });
      const check = validateNeed(record);
      if (!check.valid) { toastError(Object.values(check.errors)[0]); return; }
      if (existing) await repos.needs.update(existing.id, record);
      else await repos.needs.create(record);
      close();
      toastSuccess(existing ? 'حُدّث الاحتياج' : 'أُنشئ الاحتياج كمسودة');
      renderNeeds(container);
    });
    dialog.querySelector('[data-act="publish"]')?.addEventListener('click', async () => {
      await repos.needs.update(existing.id, { status: 'published', publishedAt: new Date().toISOString() });
      close();
      toastSuccess('نُشر الاحتياج وأصبح ظاهرًا في البوابة العامة');
      renderNeeds(container);
    });
  }
}
