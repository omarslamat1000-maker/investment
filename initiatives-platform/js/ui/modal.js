// نوافذ حوارية — تعتمد <dialog> مع حصر التركيز والإغلاق بـ Esc
import { raw, html } from '../core/sanitizer.js';

// يفتح حوارًا بمحتوى HTML جاهز (معقّم مسبقًا من المنادي عبر قوالب html``)
export function openModal({ title, bodyHtml, footerHtml = '', wide = false, onClose = null }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'mi-modal' + (wide ? ' mi-modal--wide' : '');
  dlg.innerHTML = html`
    <div class="mi-modal__head">
      <h2>${title}</h2>
      <button class="mi-btn mi-btn--ghost mi-modal__close" aria-label="إغلاق">✕</button>
    </div>
    <div class="mi-modal__body">${raw(bodyHtml)}</div>
    ${footerHtml ? raw(`<div class="mi-modal__foot">${footerHtml}</div>`) : ''}`;
  document.body.appendChild(dlg);

  const close = () => {
    if (dlg.open) dlg.close();
  };
  dlg.querySelector('.mi-modal__close').addEventListener('click', close);
  dlg.addEventListener('cancel', () => { /* Esc — السلوك الافتراضي يغلق */ });
  dlg.addEventListener('close', () => {
    dlg.remove();
    if (onClose) onClose();
  });
  dlg.addEventListener('click', (e) => {
    // النقر على الخلفية (خارج المحتوى) يغلق
    const rect = dlg.getBoundingClientRect();
    const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inside) close();
  });
  dlg.showModal();
  return { dialog: dlg, close };
}

// حوار تأكيد يعيد Promise<boolean>
export function confirmModal(title, message, { confirmLabel = 'تأكيد', danger = false } = {}) {
  return new Promise((resolve) => {
    let decided = false;
    const { dialog, close } = openModal({
      title,
      bodyHtml: html`<p class="mi-confirm-text">${message}</p>`,
      footerHtml: html`
        <button class="mi-btn mi-btn--ghost" data-act="cancel">إلغاء</button>
        <button class="mi-btn ${danger ? 'mi-btn--danger' : 'mi-btn--primary'}" data-act="ok">${confirmLabel}</button>`,
      onClose: () => { if (!decided) resolve(false); }
    });
    dialog.querySelector('[data-act="ok"]').addEventListener('click', () => { decided = true; close(); resolve(true); });
    dialog.querySelector('[data-act="cancel"]').addEventListener('click', () => { decided = true; close(); resolve(false); });
  });
}
