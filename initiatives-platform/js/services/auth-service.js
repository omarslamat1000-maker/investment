// خدمة المصادقة — حسابات محلية في مخزن users بكلمات مرور مجزأة SHA-256
// تنبيه: هذه مصادقة عرض توضيحي على المتصفح؛ أي نشر فعلي يتطلب خادم مصادقة حقيقيًا
// (انظر supabase/README.md) — التجزئة هنا تمنع كشف كلمات المرور نصًا فقط.
import { dataProvider } from '../data/data-provider.js';
import { setSession, clearSession, getSession, setRole, setUserName } from '../core/state.js';
import { ROLES } from '../core/constants.js';
import { nowIso } from '../core/date-time.js';

export const DEFAULT_PASSWORD = 'Admin@123';

// أسماء الدخول الافتراضية لحسابات العرض (حسب معرف المستخدم)
export const DEFAULT_USERNAMES = {
  'u-admin': 'admin',
  'u-pmo': 'pmo',
  'u-rev1': 'reviewer1',
  'u-rev2': 'reviewer2',
  'u-exec': 'executor',
  'u-partner': 'partner'
};

export async function hashPassword(password) {
  const bytes = new TextEncoder().encode(String(password));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

export function isValidUsername(username) {
  return /^[a-z0-9._-]{3,32}$/.test(normalizeUsername(username));
}

// ترقية حسابات زُرعت قبل إضافة المصادقة: تُكمل username/passwordHash/active
export async function ensureAuthSeed() {
  const users = await dataProvider.getAll('users');
  const defaultHash = await hashPassword(DEFAULT_PASSWORD);
  for (const user of users) {
    if (!user.username || !user.passwordHash) {
      await dataProvider.put('users', {
        ...user,
        username: user.username || DEFAULT_USERNAMES[user.id] || user.id,
        passwordHash: user.passwordHash || defaultHash,
        active: user.active !== false,
        grants: user.grants || [],
        denies: user.denies || [],
        updatedAt: nowIso()
      });
    }
  }
}

export async function findUserByUsername(username) {
  const users = await dataProvider.getAll('users');
  const uname = normalizeUsername(username);
  return users.find((u) => normalizeUsername(u.username) === uname) || null;
}

// تسجيل الدخول: يعيد { ok, user?, error }
export async function login(username, password) {
  const user = await findUserByUsername(username);
  if (!user) return { ok: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
  if (user.active === false) return { ok: false, error: 'الحساب موقوف — تواصل مع مدير النظام' };
  const hash = await hashPassword(password);
  if (hash !== user.passwordHash) return { ok: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
  if (!ROLES[user.role]) return { ok: false, error: 'دور الحساب غير معرف — تواصل مع مدير النظام' };

  const session = {
    userId: user.id,
    name: user.name,
    username: normalizeUsername(user.username),
    role: user.role,
    grants: user.grants || [],
    denies: user.denies || [],
    at: nowIso()
  };
  setSession(session);
  setRole(user.role);
  setUserName(user.name);
  return { ok: true, user };
}

export function logout() {
  clearSession();
}

export function isLoggedIn() {
  return Boolean(getSession());
}

// مزامنة الجلسة بعد تعديل حساب صاحبها من شاشة المستخدمين
export function refreshSessionFromUser(user) {
  const session = getSession();
  if (!session || session.userId !== user.id) return;
  setSession({
    ...session,
    name: user.name,
    username: normalizeUsername(user.username),
    role: user.role,
    grants: user.grants || [],
    denies: user.denies || []
  });
  setRole(user.role);
  setUserName(user.name);
}
