// تنبيهات عائمة قصيرة — نجاح/خطأ/معلومة، مع إعلان لقارئات الشاشة
import { escapeHtml } from '../core/sanitizer.js';

let container = null;

function ensureContainer() {
  if (container && document.body.contains(container)) return container;
  container = document.createElement('div');
  container.className = 'mi-toasts';
  container.setAttribute('aria-live', 'polite');
  document.body.appendChild(container);
  return container;
}

export function toast(message, level = 'info', { duration = 3500 } = {}) {
  const box = ensureContainer();
  const el = document.createElement('div');
  el.className = 'mi-toast';
  el.dataset.level = level;
  el.setAttribute('role', level === 'error' ? 'alert' : 'status');
  el.innerHTML = `<span class="mi-toast__msg">${escapeHtml(message)}</span>`;
  const close = document.createElement('button');
  close.className = 'mi-toast__close';
  close.setAttribute('aria-label', 'إغلاق التنبيه');
  close.textContent = '✕';
  close.addEventListener('click', () => el.remove());
  el.appendChild(close);
  box.appendChild(el);
  if (duration) setTimeout(() => el.remove(), duration);
  return el;
}

export const toastSuccess = (msg) => toast(msg, 'success');
export const toastError = (msg) => toast(msg, 'error', { duration: 6000 });
