// نافذة استيراد المبادرات من نموذج PPTX أو CSV — معاينة وتدقيق ثم حفظ المحدد كمبادرات مقدَّمة
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { openModal } from '../../ui/modal.js';
import { toastSuccess, toastError } from '../../ui/toast.js';
import { parseInitiativeFormPptx, parseCsv, csvTemplate } from '../../services/form-import.js';
import { compressImage } from '../../services/image-service.js';
import { repos } from '../../data/repositories.js';
import { newInitiative, sanitizeInitiative, validateInitiative, categoryLabel, costBandLabel, durationBandLabel, readinessLabel } from '../../domain/initiative-model.js';
import { CATEGORIES, COST_BANDS, DURATION_BANDS, READINESS_LEVELS } from '../../core/constants.js';
import { uid } from '../../core/utils.js';
import { getSession } from '../../core/state.js';
import { notify } from '../../services/notification-service.js';

export function openImportModal({ onDone }) {
  let records = [];
  const { dialog, close } = openModal({
    title: 'استيراد مبادرات من نموذج الاحتياج (PPTX) أو CSV',
    wide: true,
    bodyHtml: html`
      <p class="mi-muted">ارفع عرض «نموذج احتياج المبادرات المستقبلية» بصيغة PPTX (يُقرأ كل نموذج بشريحتيه مع التأشيرات وصورة الموقع)، أو ملف CSV وفق القالب. تُعرض النتائج للتدقيق قبل الحفظ.</p>
      <div class="mi-import-tools">
        <label class="mi-btn mi-btn--primary mi-file-btn">اختيار ملف PPTX / CSV<input type="file" accept=".pptx,.csv,text/csv,application/vnd.openxmlformats-officedocument.presentationml.presentation" hidden data-file></label>
        <button type="button" class="mi-btn mi-btn--ghost" data-act="template">تنزيل قالب CSV</button>
        <label class="mi-check-item"><input type="checkbox" data-as-draft><span>حفظ كمسودات بدل «مقدَّمة»</span></label>
        <span class="mi-muted" data-status></span>
      </div>
      <div class="mi-import-preview" data-preview></div>`,
    footerHtml: html`
      <button class="mi-btn mi-btn--ghost" data-act="cancel">إغلاق</button>
      <button class="mi-btn mi-btn--gold" data-act="save" disabled>حفظ المحدد</button>`
  });
  const preview = dialog.querySelector('[data-preview]');
  const status = dialog.querySelector('[data-status]');
  const saveBtn = dialog.querySelector('[data-act="save"]');
  const sel = (name, list, value) => `<select class="mi-input mi-input--sm" data-f="${name}"><option value="">—</option>${list.map((o) => `<option value="${o.id}" ${o.id === value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}</select>`;

  function draw() {
    if (!records.length) { preview.innerHTML = '<p class="mi-muted">لم تُقرأ مبادرات بعد.</p>'; saveBtn.disabled = true; return; }
    preview.innerHTML = html`
      <div class="mi-table-wrap"><table class="mi-table mi-import-table">
        <thead><tr><th><input type="checkbox" data-all checked></th><th>الصورة</th><th>اسم المبادرة</th><th>الجهة</th><th>المجال</th><th>الموقع</th><th>التكلفة</th><th>المدة</th><th>الجاهزية</th><th>التحقق</th></tr></thead>
        <tbody>${raw(records.map((r, i) => {
          const check = validateInitiative(sanitizeInitiative(newInitiative({ ...r, district: '', submitterName: r.submitterEntity || 'مستورد', status: 'draft' })));
          return `<tr data-i="${i}" data-valid="${check.valid ? 'yes' : 'no'}">
            <td><input type="checkbox" data-pick ${check.valid ? 'checked' : ''}></td>
            <td>${r.imageDataUrl ? `<img class="mi-import-thumb" src="${r.imageDataUrl}" alt="">` : '<span class="mi-muted">—</span>'}</td>
            <td><input class="mi-input mi-input--sm" data-f="title" value="${escapeHtml(r.title)}"><small class="mi-muted">${escapeHtml(r.source)}</small></td>
            <td><input class="mi-input mi-input--sm" data-f="submitterEntity" value="${escapeHtml(r.submitterEntity)}"></td>
            <td>${sel('category', CATEGORIES, r.category)}</td>
            <td><input class="mi-input mi-input--sm" data-f="location" value="${escapeHtml(r.location)}">${r.mapLink ? `<small><a href="${escapeHtml(r.mapLink)}" target="_blank" rel="noopener" dir="ltr">رابط الموقع</a></small>` : ''}</td>
            <td>${sel('costBand', COST_BANDS, r.costBand)}</td>
            <td>${sel('durationBand', DURATION_BANDS, r.durationBand)}</td>
            <td>${sel('readinessLevel', READINESS_LEVELS, r.readinessLevel)}</td>
            <td>${check.valid ? '<span class="mi-rpt-chip" data-tone="ok">صالح</span>' : `<span class="mi-rpt-chip" data-tone="bad" title="${escapeHtml(Object.values(check.errors)[0] || '')}">ناقص</span>`}</td>
          </tr>`;
        }).join(''))}</tbody>
      </table></div>`;
    preview.querySelectorAll('[data-f]').forEach((inp) => inp.addEventListener('input', () => {
      const i = Number(inp.closest('tr').dataset.i); records[i][inp.dataset.f] = inp.value;
    }));
    preview.querySelector('[data-all]').addEventListener('change', (e) => preview.querySelectorAll('[data-pick]').forEach((c) => { c.checked = e.target.checked; }));
    saveBtn.disabled = false;
  }

  dialog.querySelector('[data-file]').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    status.textContent = 'جارٍ القراءة…';
    try {
      records = /\.pptx$/i.test(file.name)
        ? await parseInitiativeFormPptx(file, { compressImage })
        : parseCsv(await file.text());
      status.textContent = `قُرئت ${records.length} مبادرة من ${file.name}`;
      draw();
    } catch (err) { status.textContent = ''; toastError(err.message); }
    e.target.value = '';
  });
  dialog.querySelector('[data-act="template"]').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csvTemplate()], { type: 'text/csv;charset=utf-8' }));
    a.download = 'قالب-استيراد-المبادرات.csv'; a.click(); URL.revokeObjectURL(a.href);
  });
  dialog.querySelector('[data-act="cancel"]').addEventListener('click', close);
  saveBtn.addEventListener('click', async () => {
    const asDraft = dialog.querySelector('[data-as-draft]').checked;
    const picked = [...preview.querySelectorAll('tr[data-i]')].filter((tr) => tr.querySelector('[data-pick]').checked).map((tr) => records[Number(tr.dataset.i)]);
    if (!picked.length) { toastError('حدد مبادرة واحدة على الأقل'); return; }
    const by = getSession()?.name || 'استيراد';
    let ok = 0; const errors = [];
    for (const r of picked) {
      const record = sanitizeInitiative(newInitiative({
        title: r.title, summary: r.summary || r.problem || r.title, problem: r.problem || '', category: r.category || 'roads',
        district: '', location: r.location || '', lat: r.lat ?? null, lng: r.lng ?? null,
        sites: r.lat && r.lng ? [{ id: uid('site'), name: 'الموقع', geometry: { type: 'point', coords: [[r.lat, r.lng]] } }] : [],
        beneficiaryGroups: r.beneficiaryGroups || '', expectedImpact: r.expectedImpact || '',
        costBand: r.costBand || '', durationBand: r.durationBand || '', readinessLevel: r.readinessLevel || '',
        submitterName: r.submitterEntity || by, submitterEntity: r.submitterEntity || '', channel: 'internal', status: 'draft',
        imageDataUrl: r.imageDataUrl || null, notes: `مستورد من ${r.source}${r.mapLink ? ' — رابط الموقع: ' + r.mapLink : ''}`
      }));
      const check = validateInitiative(record);
      if (!check.valid) { errors.push(`${r.title}: ${Object.values(check.errors)[0]}`); continue; }
      try {
        const created = await repos.initiatives.create(record);
        if (!asDraft) await repos.initiatives.transition(created.id, 'submitted', { by });
        ok += 1;
      } catch (err) { errors.push(`${r.title}: ${err.message}`); }
    }
    if (ok) await notify('استيراد مبادرات', `أُضيفت ${ok} مبادرة من ملف`, 'info');
    close();
    toastSuccess(`حُفظت ${ok} مبادرة${errors.length ? ` — تعذر ${errors.length}: ${errors[0]}` : ''}`);
    onDone?.();
  });
  draw();
}
