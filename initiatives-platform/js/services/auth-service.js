// خدمة المصادقة — حسابات محلية في مخزن users بكلمات مرور مجزأة SHA-256
// تنبيه: هذه مصادقة عرض توضيحي على المتصفح؛ أي نشر فعلي يتطلب خادم مصادقة حقيقيًا
// (انظر supabase/README.md) — التجزئة هنا تمنع كشف كلمات المرور نصًا فقط.
import { dataProvider } from '../data/data-provider.js';
import { setSession, clearSession, getSession, setRole, setUserName } from '../core/state.js';
import { ROLES } from '../core/constants.js';
import { nowIso } from '../core/date-time.js';
import { isCloudMode } from '../config.js';

export const DEFAULT_PASSWORD = 'Admin@123';

// أسماء الدخول الافتراضية لحسابات العرض (حسب معرف المستخدم)
export const DEFAULT_USERNAMES = {
  'u-admin': 'admin',
  'u-pmo': 'pmo',
  'u-rev1': 'reviewer1',
  'u-rev2': 'reviewer2',
  'u-exec': 'executor',
  'u-partner': 'partner',
  'u-prt-waha': 'waha',
  'u-prt-suqya': 'suqya',
  'u-prt-noor': 'noor',
  'u-prt-darbak': 'darbak',
  'u-prt-masarat': 'masarat',
  'u-prt-omran': 'omran',
  'u-prt-emaar': 'emaar',
  'u-prt-yanabea': 'yanabea'
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
  if (isCloudMode()) return; // الحسابات السحابية تُدار في Supabase حصريًا
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

// ————— وضع السحابة: مصادقة Supabase الحقيقية —————
async function buildCloudSession(client, authUser) {
  const { data: profile, error } = await client
    .from('profiles')
    .select('*, organizations(name_ar, code)')
    .eq('id', authUser.id)
    .maybeSingle();
  if (error || !profile) return { ok: false, error: 'تعذر قراءة الملف الشخصي — تواصل مع مدير النظام' };
  if (!profile.is_active) {
    await client.auth.signOut();
    return { ok: false, error: 'الحساب موقوف — تواصل مع مدير النظام' };
  }
  const session = {
    userId: authUser.id,
    name: profile.full_name || authUser.email,
    username: authUser.email,
    role: profile.role,
    grants: profile.overrides?.grants || [],
    denies: profile.overrides?.denies || [],
    organizationId: profile.organization_id,
    organizationName: profile.organizations?.name_ar || null,
    organizationCode: profile.organizations?.code || null,
    mustChangePassword: Boolean(profile.must_change_password),
    cloud: true,
    at: nowIso()
  };
  setSession(session);
  setRole(profile.role);
  setUserName(session.name);
  return { ok: true, session };
}

async function cloudLogin(email, password) {
  const { getSupabase } = await import('../data/supabase-client.js');
  const client = await getSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: normalizeUsername(email), password
  });
  if (error) {
    const msg = /credentials/i.test(error.message)
      ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      : error.message;
    return { ok: false, error: msg };
  }
  return buildCloudSession(client, data.user);
}

// استعادة جلسة سحابية قائمة (عند فتح التطبيق) — تعيد الجلسة أو null
export async function restoreCloudSession() {
  if (!isCloudMode()) return null;
  const { getSupabase } = await import('../data/supabase-client.js');
  const client = await getSupabase();
  const { data } = await client.auth.getSession();
  if (!data?.session?.user) { clearSession(); return null; }
  const existing = getSession();
  if (existing?.userId === data.session.user.id) return existing;
  const result = await buildCloudSession(client, data.session.user);
  return result.ok ? result.session : null;
}

// تغيير كلمة المرور (أول دخول أو لاحقًا) في وضع السحابة
export async function cloudChangePassword(newPassword) {
  const { getSupabase } = await import('../data/supabase-client.js');
  const client = await getSupabase();
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  await client.rpc('clear_password_flag');
  const session = getSession();
  if (session) setSession({ ...session, mustChangePassword: false });
  return { ok: true };
}

// تسجيل الدخول: يعيد { ok, user?, error }
export async function login(username, password) {
  if (isCloudMode()) return cloudLogin(username, password);
  const user = await findUserByUsername(username);
  if (!user) return { ok: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
  // دورة اعتماد حسابات الشركاء المسجلة ذاتيًا
  if (user.approvalStatus === 'pending') {
    return { ok: false, error: 'حسابكم قيد المراجعة — يُفعَّل بعد تدقيق البيانات واعتماد مدير النظام' };
  }
  if (user.approvalStatus === 'rejected') {
    return { ok: false, error: 'نعتذر — لم يُعتمد طلب التسجيل. تواصلوا مع مكتب إدارة المبادرات' };
  }
  if (user.active === false) return { ok: false, error: 'الحساب موقوف — تواصل مع مدير النظام' };
  const hash = await hashPassword(password);
  if (hash !== user.passwordHash) return { ok: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
  if (!ROLES[user.role]) return { ok: false, error: 'دور الحساب غير معرف — تواصل مع مدير النظام' };

  const session = {
    userId: user.id,
    name: user.name,
    username: normalizeUsername(user.username),
    role: user.role,
    partnerId: user.partnerId || null, // حساب جهة شريكة: مقيد ببيانات جهته
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
  if (isCloudMode()) {
    import('../data/supabase-client.js')
      .then(({ getSupabase }) => getSupabase())
      .then((client) => client.auth.signOut())
      .catch(() => { /* الجلسة المحلية أُزيلت على أي حال */ });
  }
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
    partnerId: user.partnerId || null,
    grants: user.grants || [],
    denies: user.denies || []
  });
  setRole(user.role);
  setUserName(user.name);
}
