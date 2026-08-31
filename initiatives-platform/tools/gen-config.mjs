// يولّد js/config.runtime.js من متغيرات البيئة أثناء بناء Netlify
// لا يُشغَّل محليًا إلا إذا رغبت — محليًا استخدم js/config.local.js
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';
const mode = process.env.STORAGE_MODE || (url && key ? 'supabase' : 'indexeddb');

const content = `// ملف مولَّد آليًا وقت البناء — لا يُعدل يدويًا ولا يُرفع للمستودع
export const APP_CONFIG = {
  appName: 'منصة مبادرات البنية التحتية والشراكات المجتمعية',
  entityName: 'أمانة منطقة المدينة المنورة',
  appVersion: '1.4.0',
  basePath: './',
  storageMode: ${JSON.stringify(mode)},
  databaseName: 'madinah-initiatives-platform-db',
  serviceWorkerScope: './',
  timeZone: 'Asia/Riyadh',
  locale: 'ar-SA',
  supabaseUrl: ${JSON.stringify(url)},
  supabaseAnonKey: ${JSON.stringify(key)}
};
`;

writeFileSync(join(ROOT, 'js', 'config.runtime.js'), content, 'utf8');
console.log(`config.runtime.js generated (mode=${mode}, url=${url ? 'set' : 'EMPTY'})`);
if (mode === 'supabase' && (!url || !key)) {
  console.error('تحذير: STORAGE_MODE=supabase لكن SUPABASE_URL/SUPABASE_ANON_KEY غير مضبوطة');
  process.exit(1);
}
