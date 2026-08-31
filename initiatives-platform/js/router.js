// موجّه Hash — متوافق مع GitHub Pages تحت مسار فرعي بلا إعادة توجيه خادمية
import { emit, EVENTS } from './core/events.js';
import { rememberRoute } from './core/state.js';
import { focusMain } from './ui/accessibility.js';

const routes = []; // { pattern: 'initiatives/:id', regex, keys, handler, title }

export function route(pattern, handler, title = '') {
  const keys = [];
  const regexStr = pattern
    .replace(/\/$/, '')
    .split('/')
    .map((seg) => {
      if (seg.startsWith(':')) { keys.push(seg.slice(1)); return '([^/]+)'; }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  routes.push({ pattern, regex: new RegExp(`^${regexStr}$`), keys, handler, title });
}

export function currentPath() {
  const hash = location.hash.replace(/^#\/?/, '');
  return hash || '';
}

export function navigate(path) {
  location.hash = '#/' + path.replace(/^\/+/, '');
}

let notFoundHandler = null;
export function onNotFound(handler) { notFoundHandler = handler; }

export async function resolve() {
  const path = currentPath();
  for (const r of routes) {
    const m = r.regex.exec(path);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      rememberRoute('/' + path);
      emit(EVENTS.routeChanged, { path: '/' + path, params });
      await r.handler(params);
      if (r.title) {
        document.title = `${r.title} — منصة المبادرات`;
        focusMain(r.title);
      }
      return;
    }
  }
  if (notFoundHandler) await notFoundHandler(path);
}

export function startRouter(defaultPath = 'dashboard') {
  window.addEventListener('hashchange', resolve);
  if (!currentPath()) navigate(defaultPath);
  else resolve();
}
