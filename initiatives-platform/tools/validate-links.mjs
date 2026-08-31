// التحقق من أن كل رابط/مورد محلي في صفحات HTML يشير إلى ملف موجود فعلًا
import { readFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, statSync } from 'node:fs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const errors = [];

function collectHtml(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) {
      if (name === 'node_modules') continue;
      collectHtml(full, out);
    } else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

for (const file of collectHtml(ROOT)) {
  const src = await readFile(file, 'utf8');
  const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
  const refs = [...src.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|#|data:)/.test(ref)) continue;
    const clean = ref.split('#')[0].split('?')[0];
    if (!clean) continue;
    if (clean.startsWith('/')) { errors.push(`${rel}: مسار من جذر النطاق ${ref}`); continue; }
    const target = join(dirname(file), clean);
    try {
      await access(target);
      console.log(`OK   ${rel} ← ${clean}`);
    } catch {
      errors.push(`${rel}: الملف المشار إليه غير موجود: ${clean}`);
      console.error(`FAIL ${rel} ← ${clean}`);
    }
  }
  // فحص استيرادات الوحدات داخل <script type="module">
  for (const m of src.matchAll(/from\s+'(\.[^']+)'/g)) {
    const target = join(dirname(file), m[1]);
    try { await access(target); }
    catch { errors.push(`${rel}: استيراد وحدة غير موجودة: ${m[1]}`); console.error(`FAIL ${rel} ← ${m[1]}`); }
  }
}

console.log(errors.length ? `\n${errors.length} رابطًا مكسورًا` : '\nكل الروابط والموارد المحلية سليمة');
if (errors.length) process.exit(1);
