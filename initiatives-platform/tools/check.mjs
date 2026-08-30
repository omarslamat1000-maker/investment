// فحوص الاستقلالية والسلامة البنيوية للمنصة — تفشل العملية عند أي مخالفة
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, statSync } from 'node:fs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const errors = [];
const ok = (msg) => console.log(`OK   ${msg}`);
const fail = (msg) => { errors.push(msg); console.error(`FAIL ${msg}`); };

// 1) الملفات الأساسية موجودة
const REQUIRED = [
  'index.html', 'app.html', 'submit.html', 'opportunity.html',
  'initiative-details.html', 'partner-portal.html', 'dashboard.html',
  'print.html', 'offline.html', '404.html',
  'manifest.webmanifest', 'service-worker.js', 'package.json',
  'js/app.js', 'js/router.js', 'js/config.example.js',
  'css/tokens.css', 'css/base.css'
];
for (const f of REQUIRED) {
  try { await access(join(ROOT, f)); ok(`موجود: ${f}`); }
  catch { fail(`ملف مطلوب مفقود: ${f}`); }
}

// 2) لا مسارات تبدأ من جذر النطاق في HTML/CSS/JS
function collect(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) {
      if (name === 'node_modules') continue;
      collect(full, exts, out);
    } else if (exts.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}
const htmlFiles = collect(ROOT, ['.html']).filter((f) => !f.includes('node_modules'));
for (const file of htmlFiles) {
  const src = await readFile(file, 'utf8');
  const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
  const badRefs = [...src.matchAll(/(?:href|src)="(\/[^"]*)"/g)]
    .map((m) => m[1])
    .filter((u) => !u.startsWith('//')); // البروتوكول النسبي مسموح
  if (badRefs.length) fail(`${rel}: مسارات من جذر النطاق: ${badRefs.join(', ')}`);
  else ok(`${rel}: كل المسارات نسبية`);
}

// 3) Manifest: النطاق وبداية التشغيل نسبية
const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.webmanifest'), 'utf8'));
if (manifest.start_url === '/' || manifest.start_url?.startsWith('/')) fail('manifest: start_url يشير لجذر النطاق');
else ok(`manifest: start_url = ${manifest.start_url}`);
if (manifest.scope !== './') fail(`manifest: scope يجب أن يكون ./ — الحالي: ${manifest.scope}`);
else ok('manifest: scope = ./');
if (manifest.dir !== 'rtl' || manifest.lang !== 'ar') fail('manifest: يجب أن يكون lang=ar وdir=rtl');
else ok('manifest: عربي RTL');

// 4) Service Worker: بادئة تخزين مستقلة ولا يستخدم أسماء التطبيق الأصلي
const sw = await readFile(join(ROOT, 'service-worker.js'), 'utf8');
if (!sw.includes("'madinah-initiatives-platform-'")) fail('service-worker: بادئة التخزين المستقلة غير موجودة');
else ok('service-worker: بادئة التخزين madinah-initiatives-platform-');
if (/medina-lands/.test(sw)) fail('service-worker: يشير إلى أسماء التطبيق الأصلي');
else ok('service-worker: لا تداخل مع التطبيق الأصلي');

// 5) تسجيل SW بالنطاق المحدود — في البوابة (index.html) وتطبيق الإدارة (js/app.js)
for (const entry of ['index.html', 'js/app.js']) {
  const src = await readFile(join(ROOT, entry), 'utf8');
  if (src.includes("register('./service-worker.js', { scope: './' })")) ok(`${entry}: تسجيل SW بنطاق ./`);
  else fail(`${entry}: تسجيل SW بالنطاق المحدود غير موجود`);
}

// 6) استقلالية قاعدة البيانات ومفاتيح التخزين والقنوات
const constants = await readFile(join(ROOT, 'js/core/constants.js'), 'utf8');
const jsFiles = collect(join(ROOT, 'js'), ['.js']);
if (!constants.includes("'madinah-initiatives-platform-db'")) fail('constants: اسم قاعدة البيانات المستقل غير موجود');
else ok('constants: قاعدة البيانات madinah-initiatives-platform-db');
if (!constants.includes("'madinahInitiativesPlatform:'")) fail('constants: بادئة LocalStorage المستقلة غير موجودة');
else ok('constants: بادئة LocalStorage مستقلة');
for (const ch of ['madinah-initiatives-platform-events', 'madinah-initiatives-platform-settings', 'madinah-initiatives-platform-notifications']) {
  if (!constants.includes(`'${ch}'`)) fail(`constants: قناة البث ${ch} غير معرفة`);
  else ok(`constants: قناة ${ch}`);
}
let leaks = 0;
for (const file of jsFiles) {
  const src = await readFile(file, 'utf8');
  if (/medina-lands-db|medina-lands-landmarks|medina-lands-settings/.test(src)) {
    fail(`${file.slice(ROOT.length + 1)}: يشير إلى قاعدة/قنوات التطبيق الأصلي`);
    leaks++;
  }
}
if (!leaks) ok('js/**: لا إشارات لقاعدة التطبيق الأصلي أو قنواته');

// 7) لا استيراد لملفات خارج مجلد المنصة
let externalImports = 0;
for (const file of [...jsFiles, ...htmlFiles]) {
  const src = await readFile(file, 'utf8');
  const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
  const depth = rel.split('/').length - 1;
  for (const m of src.matchAll(/from\s+'((?:\.\.\/)+)[^']*'/g)) {
    const ups = (m[1].match(/\.\.\//g) || []).length;
    if (ups > depth) { fail(`${rel}: استيراد يخرج من مجلد المنصة`); externalImports++; }
  }
}
if (!externalImports) ok('لا استيرادات خارج مجلد المنصة');

// 8) لا أسرار في المستودع
const configExample = await readFile(join(ROOT, 'js/config.example.js'), 'utf8');
if (/supabaseAnonKey:\s*''/.test(configExample) && /supabaseUrl:\s*''/.test(configExample)) ok('config.example: بلا أسرار');
else fail('config.example: يحتوي قيم Supabase غير فارغة');
const gitignore = await readFile(join(ROOT, '.gitignore'), 'utf8');
if (gitignore.includes('config.local.js')) ok('.gitignore: يستثني config.local.js');
else fail('.gitignore: لا يستثني config.local.js');

console.log(errors.length ? `\n${errors.length} مخالفة` : '\nكل فحوص الاستقلالية ناجحة');
if (errors.length) process.exit(1);
