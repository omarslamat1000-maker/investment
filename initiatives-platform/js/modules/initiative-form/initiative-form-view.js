// نموذج تقديم مبادرة — معالج من أربع خطوات يُستخدم في submit.html
import { repos } from '../../data/repositories.js';
import { html, raw, escapeHtml } from '../../core/sanitizer.js';
import { createWizard } from '../../ui/form-wizard.js';
import { newInitiative, validateInitiative, sanitizeInitiative } from '../../domain/initiative-model.js';
import { CATEGORIES, DISTRICTS, PARTNERSHIP_MODELS } from '../../core/constants.js';
import { validate, required, minLength, isEmail, isSaudiPhone, isPositiveNumber } from '../../core/validation.js';
import { historyEntry } from '../../domain/initiative-model.js';
import { toastError } from '../../ui/toast.js';
import { notify } from '../../services/notification-service.js';

function field(label, inner) {
  return `<div class="mi-form-field"><label>${escapeHtml(label)}</label>${inner}</div>`;
}

export function renderInitiativeForm(container, { onDone }) {
  const steps = [
    {
      id: 'idea', title: 'فكرة المبادرة',
      render(box, data) {
        box.innerHTML =
          field('اسم المبادرة', `<input class="mi-input" name="title" value="${escapeHtml(data.title || '')}" placeholder="مثال: تظليل ممرات حديقة الحي">`) +
          field('وصف المبادرة وأثرها المتوقع', `<textarea class="mi-input" name="summary" rows="4" placeholder="ماذا ستقدم المبادرة؟ لمن؟ وما الأثر المتوقع؟">${escapeHtml(data.summary || '')}</textarea>`) +
          `<div class="mi-form-row">` +
          field('التصنيف', `<select class="mi-input" name="category"><option value="">اختر…</option>${CATEGORIES.map((c) => `<option value="${c.id}" ${data.category === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}</select>`) +
          field('الحي', `<select class="mi-input" name="district"><option value="">اختر…</option>${DISTRICTS.map((d) => `<option ${data.district === d ? 'selected' : ''}>${d}</option>`).join('')}</select>`) +
          `</div>` +
          field('الموقع التفصيلي', `<input class="mi-input" name="location" value="${escapeHtml(data.location || '')}" placeholder="وصف الموقع أو أقرب معلم">`);
      },
      validate(data) {
        return validate(data, {
          title: [(v) => required(v, 'اسم المبادرة'), (v) => minLength(v, 8, 'اسم المبادرة')],
          summary: [(v) => required(v, 'وصف المبادرة'), (v) => minLength(v, 30, 'وصف المبادرة')],
          category: [(v) => required(v, 'التصنيف')],
          district: [(v) => required(v, 'الحي')]
        });
      }
    },
    {
      id: 'resources', title: 'الموارد والمساهمة',
      render(box, data) {
        box.innerHTML =
          `<div class="mi-form-row">` +
          field('الميزانية التقديرية (ريال)', `<input class="mi-input" name="budget" type="number" min="0" value="${escapeHtml(String(data.budget ?? ''))}">`) +
          field('عدد المستفيدين المقدَّر', `<input class="mi-input" name="beneficiaries" type="number" min="0" value="${escapeHtml(String(data.beneficiaries ?? ''))}">`) +
          `</div>` +
          `<fieldset class="mi-form-field"><legend>نموذج المساهمة المقترح</legend><div class="mi-check-grid">` +
          PARTNERSHIP_MODELS.map((m) => `<label class="mi-check-item"><input type="radio" name="fundingModel" value="${m.id}" ${data.fundingModel === m.id ? 'checked' : ''}><span>${m.label}</span></label>`).join('') +
          `</div></fieldset>` +
          field('ملاحظات إضافية', `<textarea class="mi-input" name="notes" rows="3">${escapeHtml(data.notes || '')}</textarea>`);
      },
      validate(data) {
        return validate(data, {
          budget: [(v) => isPositiveNumber(v, 'الميزانية التقديرية')],
          beneficiaries: [(v) => isPositiveNumber(v, 'عدد المستفيدين')],
          fundingModel: [(v) => required(v, 'نموذج المساهمة')]
        });
      }
    },
    {
      id: 'submitter', title: 'بيانات مقدّم المبادرة',
      render(box, data) {
        box.innerHTML =
          `<div class="mi-form-row">` +
          field('الاسم', `<input class="mi-input" name="submitterName" value="${escapeHtml(data.submitterName || '')}">`) +
          field('الجهة (اختياري)', `<input class="mi-input" name="submitterEntity" value="${escapeHtml(data.submitterEntity || '')}" placeholder="شركة، جمعية، فريق تطوعي…">`) +
          `</div><div class="mi-form-row">` +
          field('البريد الإلكتروني', `<input class="mi-input" name="submitterEmail" type="email" dir="ltr" value="${escapeHtml(data.submitterEmail || '')}">`) +
          field('رقم الجوال', `<input class="mi-input" name="submitterPhone" dir="ltr" value="${escapeHtml(data.submitterPhone || '')}" placeholder="05xxxxxxxx">`) +
          `</div>`;
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
        box.innerHTML = `
          <div class="mi-review-summary">
            <h4>ملخص الطلب</h4>
            <dl class="mi-dl">
              <div class="mi-dl__row"><dt>المبادرة</dt><dd>${escapeHtml(data.title || '')}</dd></div>
              <div class="mi-dl__row"><dt>التصنيف</dt><dd>${escapeHtml(CATEGORIES.find((c) => c.id === data.category)?.label || '')}</dd></div>
              <div class="mi-dl__row"><dt>الحي</dt><dd>${escapeHtml(data.district || '')}</dd></div>
              <div class="mi-dl__row"><dt>الميزانية</dt><dd>${escapeHtml(String(data.budget || '—'))} ريال</dd></div>
              <div class="mi-dl__row"><dt>مقدّم الطلب</dt><dd>${escapeHtml(data.submitterName || '')}${data.submitterEntity ? ' — ' + escapeHtml(data.submitterEntity) : ''}</dd></div>
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

  createWizard(container, steps, {
    submitLabel: 'إرسال المبادرة',
    async onSubmit(data) {
      const record = sanitizeInitiative(newInitiative({
        title: data.title,
        summary: data.summary,
        category: data.category,
        district: data.district,
        location: data.location || '',
        budget: data.budget ? Number(data.budget) : null,
        beneficiaries: data.beneficiaries ? Number(data.beneficiaries) : null,
        fundingModel: data.fundingModel || '',
        notes: data.notes || '',
        submitterName: data.submitterName,
        submitterEntity: data.submitterEntity || '',
        submitterEmail: data.submitterEmail,
        submitterPhone: data.submitterPhone,
        channel: 'public',
        status: 'submitted'
      }));
      record.statusHistory = [historyEntry('draft', 'submitted', record.submitterName)];
      const check = validateInitiative(record);
      if (!check.valid) { toastError(Object.values(check.errors)[0]); return; }
      const saved = await repos.initiatives.create(record);
      await notify('مبادرة جديدة مقدمة', `${saved.title} — ${saved.id}`, 'info');
      onDone(saved);
    }
  });
}
