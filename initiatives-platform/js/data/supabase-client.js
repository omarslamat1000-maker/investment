// عميل Supabase الرسمي (supabase-js v2) — يُحمَّل عند الحاجة فقط في وضع السحابة
// المفتاح المستخدم في الواجهة هو المفتاح القابل للنشر (anon/publishable) حصريًا
import { APP_CONFIG, isCloudMode } from '../config.js';
import { STORAGE_PREFIX } from '../core/constants.js';

let clientPromise = null;

export { isCloudMode };

export function getSupabase() {
  if (!isCloudMode()) throw new Error('وضع السحابة غير مفعّل في الإعدادات');
  if (!clientPromise) {
    clientPromise = import('https://esm.sh/@supabase/supabase-js@2.49.4?bundle')
      .then(({ createClient }) => createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey, {
        auth: {
          storageKey: STORAGE_PREFIX + 'sbauth',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }));
  }
  return clientPromise;
}
