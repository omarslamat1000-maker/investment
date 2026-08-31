// محمّل الإعدادات الموحد — الأولوية: config.runtime.js (يولَّد في بناء Netlify من متغيرات البيئة)
// ثم config.local.js (محلي، خارج Git) ثم config.example.js (الافتراضي: وضع محلي بلا أسرار)
// يُتحقق من وجود الملف بـ fetch أولًا كي لا يظهر 404 استيراد الوحدات في Console
const RESOLVED_KEY = 'madinahInitiativesPlatform:configSource';

async function tryLoad(path) {
  try {
    const probe = await fetch(new URL(path, import.meta.url), { method: 'HEAD' });
    if (!probe.ok) return null;
    return (await import(path)).APP_CONFIG || null;
  } catch { return null; }
}

// المصدر المكتشف يُحفظ للجلسة فلا يتكرر فحص الملفات (ولا ضجيج 404) مع كل صفحة
let cfg = null;
let remembered = null;
try { remembered = sessionStorage.getItem(RESOLVED_KEY); } catch { /* بيئة بلا تخزين */ }

if (remembered) cfg = await tryLoad(remembered);
if (!cfg) {
  for (const path of ['./config.runtime.js', './config.local.js']) {
    cfg = await tryLoad(path);
    if (cfg) { try { sessionStorage.setItem(RESOLVED_KEY, path); } catch { /* تجاهل */ } break; }
  }
}
if (!cfg) {
  cfg = (await import('./config.example.js')).APP_CONFIG;
  try { sessionStorage.setItem(RESOLVED_KEY, './config.example.js'); } catch { /* تجاهل */ }
}

export const APP_CONFIG = cfg;

// وضع السحابة مفعّل فقط عند اكتمال إعدادات Supabase
export function isCloudMode() {
  return APP_CONFIG.storageMode === 'supabase'
    && Boolean(APP_CONFIG.supabaseUrl)
    && Boolean(APP_CONFIG.supabaseAnonKey);
}
