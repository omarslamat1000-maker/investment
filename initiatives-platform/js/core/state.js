// حالة الجلسة (الدور الحالي، المستخدم، التفضيلات) — مفاتيح LocalStorage ببادئة مستقلة
import { STORAGE_PREFIX, ROLES } from './constants.js';
import { emit, EVENTS } from './events.js';

function key(name) { return STORAGE_PREFIX + name; }

function readLs(name, fallback = null) {
  try {
    const raw = localStorage.getItem(key(name));
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}

function writeLs(name, value) {
  try { localStorage.setItem(key(name), JSON.stringify(value)); } catch { /* تخزين ممتلئ أو محظور */ }
}

const state = {
  role: readLs('currentRole', 'pmo'),
  userName: readLs('userName', 'مستخدم تجريبي'),
  theme: readLs('theme', 'light'),
  lastRoute: readLs('lastRoute', '/dashboard')
};

export function getRole() { return state.role; }
export function getRoleLabel() { return ROLES[state.role]?.label || state.role; }
export function setRole(role) {
  if (!ROLES[role]) return;
  state.role = role;
  writeLs('currentRole', role);
  emit(EVENTS.roleChanged, { role });
}

export function getUserName() { return state.userName; }
export function setUserName(name) {
  state.userName = name;
  writeLs('userName', name);
}

export function getTheme() { return state.theme; }
export function setTheme(theme) {
  state.theme = theme;
  writeLs('theme', theme);
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-mi-theme', theme);
  }
  emit(EVENTS.settingsChanged, { theme });
}

export function rememberRoute(path) {
  state.lastRoute = path;
  writeLs('lastRoute', path);
}
export function getLastRoute() { return state.lastRoute; }
