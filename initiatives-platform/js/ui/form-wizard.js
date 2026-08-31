// معالج نماذج متعدد الخطوات — يدير التنقل والتحقق لكل خطوة
import { escapeHtml } from '../core/sanitizer.js';

// steps: [{ id, title, render(container, data), validate(data) => {valid, errors} , collect(container, data) }]
// onDraft (اختياري): يظهر زر «حفظ كمسودة» في كل الخطوات
export function createWizard(container, steps, { onSubmit, onDraft = null, submitLabel = 'إرسال' }) {
  let current = 0;
  const data = {};

  function draw() {
    const step = steps[current];
    const trail = steps.map((s, i) => `
      <li class="mi-wiz-step" data-state="${i < current ? 'done' : i === current ? 'current' : 'todo'}">
        <span class="mi-wiz-step__num">${i + 1}</span>
        <span class="mi-wiz-step__title">${escapeHtml(s.title)}</span>
      </li>`).join('');

    container.innerHTML = `
      <ol class="mi-wiz-trail" aria-label="خطوات النموذج">${trail}</ol>
      <div class="mi-wiz-body" role="group" aria-label="${escapeHtml(step.title)}"></div>
      <div class="mi-wiz-errors" aria-live="assertive"></div>
      <div class="mi-wiz-nav">
        <button type="button" class="mi-btn mi-btn--ghost" data-act="back" ${current === 0 ? 'disabled' : ''}>السابق</button>
        ${onDraft ? '<button type="button" class="mi-btn mi-btn--gold" data-act="draft">حفظ كمسودة</button>' : ''}
        <button type="button" class="mi-btn mi-btn--primary" data-act="next">${current === steps.length - 1 ? escapeHtml(submitLabel) : 'التالي'}</button>
      </div>`;

    step.render(container.querySelector('.mi-wiz-body'), data);

    container.querySelector('[data-act="back"]').addEventListener('click', () => {
      collect();
      if (current > 0) { current--; draw(); }
    });
    container.querySelector('[data-act="draft"]')?.addEventListener('click', async () => {
      collect();
      await onDraft(data);
    });
    container.querySelector('[data-act="next"]').addEventListener('click', async () => {
      collect();
      const result = step.validate ? step.validate(data) : { valid: true, errors: {} };
      showErrors(result.errors || {});
      if (!result.valid) return;
      if (current < steps.length - 1) { current++; draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      else await onSubmit(data);
    });
  }

  function collect() {
    const step = steps[current];
    if (step.collect) step.collect(container.querySelector('.mi-wiz-body'), data);
    else {
      // جمع تلقائي: كل عنصر باسم name يُخزَّن في data
      container.querySelectorAll('.mi-wiz-body [name]').forEach((el) => {
        if (el.type === 'checkbox') {
          if (!Array.isArray(data[el.name])) data[el.name] = [];
          data[el.name] = data[el.name].filter((v) => v !== el.value);
          if (el.checked) data[el.name].push(el.value);
        } else if (el.type === 'radio') {
          if (el.checked) data[el.name] = el.value;
        } else {
          data[el.name] = el.value;
        }
      });
    }
  }

  function showErrors(errors) {
    const box = container.querySelector('.mi-wiz-errors');
    container.querySelectorAll('.mi-field-error').forEach((el) => el.remove());
    container.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    const entries = Object.entries(errors);
    if (!entries.length) { box.innerHTML = ''; return; }
    for (const [field, msg] of entries) {
      const input = container.querySelector(`[name="${field}"]`);
      if (input) {
        input.setAttribute('aria-invalid', 'true');
        const small = document.createElement('small');
        small.className = 'mi-field-error';
        small.textContent = msg;
        input.closest('.mi-form-field')?.appendChild(small);
      }
    }
    box.innerHTML = `<div class="mi-alert mi-alert--error">يرجى تصحيح ${entries.length} من الحقول قبل المتابعة</div>`;
  }

  draw();
  return { getData: () => data };
}
