// نموذج تقديم مبادرة — معالج من 5 خطوات وفق «قالب تعريف المبادرة» المعتمد بالأمانة
// يشمل تحديد الموقع على خريطة تفاعلية (نقطة/خط/مساحة) وصورة للمبادرة
import { repos } from '../../data/repositories.js';
import { escapeHtml } from '../../core/sanitizer.js';
import { createWizard } from '../../ui/form-wizard.js';
import { newInitiative, validateInitiative, sanitizeInitiative, historyEntry } from '../../domain/initiative-model.js';
import { CATEGORIES, DISTRICTS, PARTNERSHIP_MODELS, COST_BANDS, DURATION_BANDS, READINESS_LEVELS } from '../../core/constants.js';
import { validate, required, minLength, isEmail, isSaudiPhone, isPositiveNumber } from '../../core/validation.js';
import { toastError, toastSuccess } from '../../ui/toast.js';
import { notify } from '../../services/notification-service.js';
import { openLocationPicker } from '../../ui/location-picker.js';
import { pickInitiativeImage } from '../../services/image-service.js';
import { measureLabel, sitesSummaryLabel } from '../../core/geo.js';
import { uid } from '../../core/utils.js';
import { firstLatLng } from '../../domain/initiative-model.js';

function field(label, inner, hint = '') {
  return `<div class="mi-form-field"><label>${escapeHtml(label)}</label>${inner}${hint ? `<small class="mi-muted">${escapeHtml(hint)}</small>` : ''}</div>`;
}

function options(list, selected) {
  return list.map((o) => `<option value="${o.id}" ${o.id === selected ? 'selected' : ''}>${o.label}</option>`).join('');
}

export function renderInitiativeForm(container, { onDone }) {
  const steps = [
    {
      id: 'definition', title: 'التعريف والمشكلة',
      render(box, data) {
        box.innerHTML =
          field('1. اسم المبادرة', `<input class="mi-input" name="title" value="${escapeHtml(data.title || '')}" placeholder="اسم مختصر وواضح للمبادرة">`) +
          field('2. الجهة المقدمة (الوكالة / الإدارة / الشركة / الجمعية)', `<input class="mi-input" name="submitterEntity" value="${escapeHtml(data.submitterEntity || '')}" placeholder="اختياري للأفراد">`) +
          field('3. مجال المبادرة', `<select class="mi-input" name="category"><option value="">اختر…</option>${options(CATEGORIES, data.category)}</select>`) +
          field('4. المشكلة أو الاحتياج', `<textarea class="mi-input" name="problem" rows="3" placeholder="ما المشكلة الحالية؟ وما حجمها أو آثارها؟">${escapeHtml(data.problem || '')}</textarea>`) +
          field('5. وصف المبادرة والحل المقترح', `<textarea class="mi-input" name="summary" rows="4" placeholder="صف الحل المقترح وأبرز عناصره ومخرجاته">${escapeHtml(data.summary || '')}</textarea>`);
      },
      validate(data) {
        return validate(data, {
          title: [(v) => required(v, 'اسم المبادرة'), (v) => minLength(v, 8, 'اسم المبادرة')],
          category: [(v) => required(v, 'مجال المبادرة')],
          problem: [(v) => required(v, 'المشكلة أو الاحتياج'), (v) => minLength(v, 15, 'وصف المشكلة')],
          summary: [(v) => required(v, 'وصف المبادرة'), (v) => minLength(v, 30, 'وصف المبادرة')]
        });
      }
    },
    {
      id: 'location', title: 'المواقع والصورة',
      render(box, data) {
        if (!Array.isArray(data.sites)) data.sites = [];
        const siteRows = data.sites.map((s, i) => `
          <div class="mi-site-row" data-site="${escapeHtml(s.id)}">
            <input class="mi-input mi-site-row__name" data-site-name="${escapeHtml(s.id)}" value="${escapeHtml(s.name || '')}" placeholder="اسم الموقع ${i + 1} (مثال: ساحة المدرسة الشمالية)">
            <span class="mi-site-row__measure">${escapeHtml(measureLabel(s.geometry))}</span>
            <button type="button" class="mi-btn mi-btn--ghost mi-btn--sm" data-edit-site="${escapeHtml(s.id)}">تعديل</button>
            <button type="button" class="mi-btn mi-btn--ghost mi-btn--sm" data-del-site="${escapeHtml(s.id)}">حذف</button>
          </div>`).join('');

        box.innerHTML =
          `<div class="mi-form-row">` +
          field('6. الموقع (الطريق / المعلم / المنطقة)', `<input class="mi-input" name="location" value="${escapeHtml(data.location || '')}" placeholder="وصف الموقع: الطريق أو المعلم أو المنطقة">`) +
          `</div>` +
          `<div class="mi-form-field">
            <label>مواقع المبادرة على الخريطة — يمكن إضافة أكثر من موقع (نقطة أو خط أو مساحة)</label>
            <div class="mi-sites-list">${siteRows || '<p class="mi-muted mi-sites-empty">لم تُحدد مواقع بعد</p>'}</div>
            <div class="mi-geo-field" data-has="${data.sites.length ? 'yes' : 'no'}">
              <span class="mi-geo-field__label">${escapeHtml(sitesSummaryLabel(data.sites))}</span>
              <button type="button" class="mi-btn mi-btn--primary mi-btn--sm" data-act="add-site">إضافة موقع على الخريطة</button>
            </div>
            <small class="mi-muted">يُحسب الطول أو المساحة تلقائيًا بالمتر عند الرسم</small>
          </div>` +
          `<div class="mi-form-field">
            <label>صورة المبادرة أو الموقع (اختياري)</label>
            <div class="mi-image-field">
              ${data.imageDataUrl ? `<img class="mi-image-thumb" src="${data.imageDataUrl}" alt="صورة المبادرة">` : '<span class="mi-image-empty" aria-hidden="true">🖼</span>'}
              <div class="mi-image-field__actions">
                <button type="button" class="mi-btn mi-btn--ghost mi-btn--sm" data-act="pick-image">${data.imageDataUrl ? 'تغيير الصورة' : 'إضافة صورة'}</button>
                ${data.imageDataUrl ? '<button type="button" class="mi-btn mi-btn--ghost mi-btn--sm" data-act="clear-image">إزالة</button>' : ''}
              </div>
            </div>
          </div>`;

        const collectInputs = () => {
          data.location = box.querySelector('[name="location"]').value;
          box.querySelectorAll('[data-site-name]').forEach((inp) => {
            const site = data.sites.find((s) => s.id === inp.dataset.siteName);
            if (site) site.name = inp.value.trim();
          });
        };
        const rerender = () => { collectInputs(); steps.find((x) => x.id === 'location').render(box, data); };

        box.querySelector('[data-act="add-site"]').addEventListener('click', () => {
          collectInputs();
          openLocationPicker({
            initial: null,
            onConfirm(geometry) {
              data.sites.push({ id: uid('site'), name: '', geometry });
              rerender();
            }
          });
        });
        box.querySelectorAll('[data-edit-site]').forEach((btn) => btn.addEventListener('click', () => {
          collectInputs();
          const site = data.sites.find((s) => s.id === btn.dataset.editSite);
          openLocationPicker({
            initial: site.geometry,
            onConfirm(geometry) { site.geometry = geometry; rerender(); }
          });
        }));
        box.querySelectorAll('[data-del-site]').forEach((btn) => btn.addEventListener('click', () => {
          collectInputs();
          data.sites = data.sites.filter((s) => s.id !== btn.dataset.delSite);
          rerender();
        }));
        box.querySelector('[data-act="pick-image"]').addEventListener('click', async () => {
          try {
            const dataUrl = await pickInitiativeImage();
            if (dataUrl) { data.imageDataUrl = dataUrl; rerender(); }
          } catch (err) { toastError(err.message); }
        });
        box.querySelector('[data-act="clear-image"]')?.addEventListener('click', () => { data.imageDataUrl = null; rerender(); });
      },
      collect(box, data) {
        data.location = box.querySelector('[name="location"]').value;
        box.querySelectorAll('[data-site-name]').forEach((inp) => {
          const site = (data.sites || []).find((s) => s.id === inp.dataset.siteName);
          if (site) site.name = inp.value.trim();
        });
      },
      validate(data) {
        return validate(data, { location: [(v) => required(v, 'الموقع')] });
      }
    },
    {
      id: 'impact', title: 'الأثر والموارد',
      render(box, data) {
        box.innerHTML =
          field('7. الفئات المستفيدة', `<input class="mi-input" name="beneficiaryGroups" value="${escapeHtml(data.beneficiaryGroups || '')}" placeholder="مثال: طلاب المدارس، كبار السن، مرتادو الحديقة">`) +
          field('عدد المستفيدين التقديري', `<input class="mi-input" name="beneficiaries" type="number" min="0" value="${escapeHtml(String(data.beneficiaries ?? ''))}">`) +
          field('8. الأثر المتوقع ومؤشر قياسه', `<textarea class="mi-input" name="expectedImpact" rows="3" placeholder="الأثر على جودة الحياة أو السلامة أو الكفاءة أو الاستدامة، مع مؤشر قياس إن أمكن">${escapeHtml(data.expectedImpact || '')}</textarea>`) +
          `<div class="mi-form-row">` +
          field('9. التكلفة التقديرية', `<select class="mi-input" name="costBand"><option value="">اختر…</option>${options(COST_BANDS, data.costBand)}</select>`) +
          field('مبلغ تقديري بالريال (اختياري)', `<input class="mi-input" name="budget" type="number" min="0" value="${escapeHtml(String(data.budget ?? ''))}">`) +
          `</div><div class="mi-form-row">` +
          field('10. المدة التقديرية', `<select class="mi-input" name="durationBand"><option value="">اختر…</option>${options(DURATION_BANDS, data.durationBand)}</select>`) +
          field('11. مستوى الجاهزية', `<select class="mi-input" name="readinessLevel"><option value="">اختر…</option>${options(READINESS_LEVELS, data.readinessLevel)}</select>`) +
          `</div>` +
          `<fieldset class="mi-form-field"><legend>نموذج المساهمة المقترح</legend><div class="mi-check-grid">` +
          PARTNERSHIP_MODELS.map((m) => `<label class="mi-check-item"><input type="radio" name="fundingModel" value="${m.id}" ${data.fundingModel === m.id ? 'checked' : ''}><span>${m.label}</span></label>`).join('') +
          `</div></fieldset>` +
          field('ملاحظات إضافية', `<textarea class="mi-input" name="notes" rows="2">${escapeHtml(data.notes || '')}</textarea>`);
      },
      validate(data) {
        return validate(data, {
          expectedImpact: [(v) => required(v, 'الأثر المتوقع'), (v) => minLength(v, 15, 'الأثر المتوقع')],
          costBand: [(v) => required(v, 'نطاق التكلفة')],
          durationBand: [(v) => required(v, 'المدة التقديرية')],
          readinessLevel: [(v) => required(v, 'مستوى الجاهزية')],
          fundingModel: [(v) => required(v, 'نموذج المساهمة')],
          budget: [(v) => isPositiveNumber(v, 'المبلغ التقديري')],
          beneficiaries: [(v) => isPositiveNumber(v, 'عدد المستفيدين')]
        });
      }
    },
    {
      id: 'submitter', title: 'مسؤول التواصل',
      render(box, data) {
        box.innerHTML =
          `<div class="mi-form-row">` +
          field('12. الاسم', `<input class="mi-input" name="submitterName" value="${escapeHtml(data.submitterName || '')}">`) +
          field('الجوال', `<input class="mi-input" name="submitterPhone" dir="ltr" value="${escapeHtml(data.submitterPhone || '')}" placeholder="05xxxxxxxx">`) +
          `</div>` +
          field('البريد الإلكتروني', `<input class="mi-input" name="submitterEmail" type="email" dir="ltr" value="${escapeHtml(data.submitterEmail || '')}">`);
      },
      validate(data) {
        return validate(data, {
          submitterName: [(v) => required(v, 'الاسم')],
          submitterEmail: [(v) => required(v, 'البريد الإلكتروني'), (v) => isEmail(v)],
          submitterPhone: [(v) => required(v, 'رقم الجوال'), (v) => isSaudiPhone(v)]
        });
      }
    },
    {
      id: 'review', title: 'المراجعة والإقرار',
      render(box, data) {
        const catLabel = CATEGORIES.find((c) => c.id === data.category)?.label || '';
        box.innerHTML = `
          <div class="mi-review-summary">
            <h4>ملخص قالب تعريف المبادرة</h4>
            <dl class="mi-dl">
              <div class="mi-dl__row"><dt>المبادرة</dt><dd>${escapeHtml(data.title || '')}</dd></div>
              <div class="mi-dl__row"><dt>المجال</dt><dd>${escapeHtml(catLabel)}</dd></div>
              <div class="mi-dl__row"><dt>الموقع</dt><dd>${escapeHtml(data.location || '')}${data.sites?.length ? ' — ' + escapeHtml(sitesSummaryLabel(data.sites)) : ''}</dd></div>
              <div class="mi-dl__row"><dt>التكلفة</dt><dd>${escapeHtml(COST_BANDS.find((b) => b.id === data.costBand)?.label || '—')}</dd></div>
              <div class="mi-dl__row"><dt>المدة</dt><dd>${escapeHtml(DURATION_BANDS.find((b) => b.id === data.durationBand)?.label || '—')}</dd></div>
              <div class="mi-dl__row"><dt>الجاهزية</dt><dd>${escapeHtml(READINESS_LEVELS.find((b) => b.id === data.readinessLevel)?.label || '—')}</dd></div>
              <div class="mi-dl__row"><dt>مسؤول التواصل</dt><dd>${escapeHtml(data.submitterName || '')}${data.submitterEntity ? ' — ' + escapeHtml(data.submitterEntity) : ''}</dd></div>
              ${data.imageDataUrl ? '<div class="mi-dl__row"><dt>الصورة</dt><dd>مرفقة ✔</dd></div>' : ''}
            </dl>
          </div>
          <label class="mi-check-item mi-consent">
            <input type="checkbox" name="consent" value="yes" ${data.consent?.includes?.('yes') ? 'checked' : ''}>
            <span>أقرّ بصحة البيانات وبأن المبادرة مقدمة للأمانة لدراستها وفق آلية الحوكمة المعتمدة، وأوافق على التواصل معي بشأنها.</span>
          </label>`;
      },
      validate(data) {
        const ok = Array.isArray(data.consent) && data.consent.includes('yes');
        return { valid: ok, errors: ok ? {} : { consent: 'الإقرار مطلوب لإرسال الطلب' } };
      }
    }
  ];

  function buildRecord(data, status) {
    const sites = (data.sites || []).map((s, i) => ({ ...s, name: s.name || `الموقع ${i + 1}` }));
    const { lat, lng } = firstLatLng(sites);
    return { sites, lat, lng, status };
  }

  createWizard(container, steps, {
    submitLabel: 'إرسال المبادرة للمراجعة',
    // حفظ كمسودة من أي خطوة — يتطلب اسم المبادرة فقط
    async onDraft(data) {
      if (!data.title || data.title.trim().length < 8) {
        toastError('لحفظ المسودة: اكتب اسم المبادرة أولًا (8 أحرف على الأقل)');
        return;
      }
      const { sites, lat, lng } = buildRecord(data, 'draft');
      const draft = sanitizeInitiative(newInitiative({
        title: data.title, summary: data.summary || '', problem: data.problem || '',
        category: data.category || 'rehab', district: '',
        location: data.location || '', sites, lat, lng,
        imageDataUrl: data.imageDataUrl || null,
        beneficiaryGroups: data.beneficiaryGroups || '',
        beneficiaries: data.beneficiaries ? Number(data.beneficiaries) : null,
        expectedImpact: data.expectedImpact || '',
        costBand: data.costBand || '', durationBand: data.durationBand || '',
        readinessLevel: data.readinessLevel || '',
        budget: data.budget ? Number(data.budget) : null,
        fundingModel: data.fundingModel || '', notes: data.notes || '',
        submitterName: data.submitterName || '', submitterEntity: data.submitterEntity || '',
        submitterEmail: data.submitterEmail || '', submitterPhone: data.submitterPhone || '',
        channel: 'public', status: 'draft'
      }));
      const saved = await repos.initiatives.create(draft);
      toastSuccess(`حُفظت المسودة برقم ${saved.id} — يمكنك استكمالها لاحقًا من سجل المبادرات`);
    },
    async onSubmit(data) {
      const { sites, lat, lng } = buildRecord(data, 'draft');
      const record = sanitizeInitiative(newInitiative({
        title: data.title,
        summary: data.summary,
        problem: data.problem || '',
        category: data.category,
        district: '',
        location: data.location || '',
        sites,
        imageDataUrl: data.imageDataUrl || null,
        lat, lng,
        beneficiaryGroups: data.beneficiaryGroups || '',
        beneficiaries: data.beneficiaries ? Number(data.beneficiaries) : null,
        expectedImpact: data.expectedImpact || '',
        costBand: data.costBand || '',
        durationBand: data.durationBand || '',
        readinessLevel: data.readinessLevel || '',
        budget: data.budget ? Number(data.budget) : null,
        fundingModel: data.fundingModel || '',
        notes: data.notes || '',
        submitterName: data.submitterName,
        submitterEntity: data.submitterEntity || '',
        submitterEmail: data.submitterEmail,
        submitterPhone: data.submitterPhone,
        channel: 'public',
        status: 'draft'
      }));
      const check = validateInitiative(record);
      if (!check.valid) { toastError(Object.values(check.errors)[0]); return; }
      // المسار الرسمي: إنشاء كمسودة ثم التقديم (يسجَّل الانتقال ويُخطَر المشرفون)
      try {
        const saved = await repos.initiatives.create(record);
        const submitted = await repos.initiatives.transition(saved.id, 'submitted', { by: record.submitterName });
        await notify('مبادرة جديدة مقدمة', `${saved.title} — ${saved.id}`, 'info');
        onDone(submitted || saved);
      } catch (err) {
        toastError(err.message);
      }
    }
  });
}
