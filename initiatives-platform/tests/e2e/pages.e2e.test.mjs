// E2E: تشغيل خادم حقيقي وطلب كل صفحة وأصولها والتحقق من المحتوى والمسارات
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8219;
const BASE = `http://localhost:${PORT}`;
let server;

before(async () => {
  server = spawn(process.execPath, [join(ROOT, 'tools', 'serve.mjs'), String(PORT)], {
    cwd: ROOT, stdio: 'ignore'
  });
  // انتظار جاهزية الخادم
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${BASE}/index.html`);
      if (res.ok) return;
    } catch { /* لم يجهز بعد */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('الخادم لم يجهز خلال المهلة');
});

after(() => { server?.kill(); });

const PAGES = [
  { path: '/', marker: 'بنيةٌ تحتية يبنيها' },
  { path: '/index.html', marker: 'قدّم مبادرتك' },
  { path: '/app.html', marker: 'mi-app' },
  { path: '/login.html', marker: 'تسجيل الدخول' },
  { path: '/submit.html', marker: 'قدّم مبادرتك' },
  { path: '/opportunity.html', marker: 'منصة المبادرات' },
  { path: '/initiative-details.html', marker: 'تتبع حالة مبادرة' },
  { path: '/partner-portal.html', marker: 'بوابة الشركاء' },
  { path: '/dashboard.html', marker: 'app.html#/dashboard' },
  { path: '/print.html', marker: 'mi-print-root' },
  { path: '/offline.html', marker: 'لا يوجد اتصال' },
  { path: '/404.html', marker: 'الصفحة غير موجودة' }
];

for (const page of PAGES) {
  test(`الصفحة ${page.path} تعمل وتحوي محتواها`, async () => {
    const res = await fetch(BASE + page.path);
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.ok(body.includes(page.marker), `العلامة «${page.marker}» غير موجودة`);
  });
}

test('كل صفحات المنصة عربية RTL', async () => {
  for (const page of PAGES.filter((p) => p.path !== '/')) {
    const body = await (await fetch(BASE + page.path)).text();
    assert.ok(body.includes('lang="ar"') && body.includes('dir="rtl"'), page.path);
  }
});

test('جميع أصول CSS وJS المشار إليها تُحمَّل بلا 404', async () => {
  const seen = new Set();
  for (const page of PAGES) {
    const body = await (await fetch(BASE + page.path)).text();
    const refs = [...body.matchAll(/(?:href|src)="(\.\/[^"]+)"/g)].map((m) => m[1]);
    for (const ref of refs) {
      const clean = ref.split('#')[0].split('?')[0];
      if (seen.has(clean)) continue;
      seen.add(clean);
      const res = await fetch(`${BASE}/${clean.slice(2)}`);
      assert.equal(res.status, 200, `${page.path} ← ${clean}`);
    }
  }
  assert.ok(seen.size > 10, 'عدد الأصول المفحوصة غير منطقي');
});

test('وحدات JavaScript الرئيسة تُقدَّم بترميز صحيح', async () => {
  for (const mod of ['/js/app.js', '/js/router.js', '/service-worker.js']) {
    const res = await fetch(BASE + mod);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /javascript/);
  }
});

test('manifest صالح ونسبي النطاق', async () => {
  const res = await fetch(`${BASE}/manifest.webmanifest`);
  assert.equal(res.status, 200);
  const manifest = JSON.parse(await res.text());
  assert.equal(manifest.scope, './');
  assert.equal(manifest.dir, 'rtl');
  assert.ok(manifest.start_url.startsWith('./'));
});

test('مسار غير موجود يعيد 404 مع صفحة عربية', async () => {
  const res = await fetch(`${BASE}/لا-وجود-لهذا.html`);
  assert.equal(res.status, 404);
  const body = await res.text();
  assert.ok(body.includes('الصفحة غير موجودة'));
});

test('لا مسارات من جذر النطاق في أي صفحة (توافق GitHub Pages subpath)', async () => {
  for (const page of PAGES) {
    const body = await (await fetch(BASE + page.path)).text();
    const bad = [...body.matchAll(/(?:href|src)="(\/[^"/][^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(bad, [], `${page.path}: ${bad.join(', ')}`);
  }
});

test('استيراد وحدات النطاق يعمل فعليًا (تحميل ديناميكي)', async () => {
  // يثبت أن شيفرة النطاق تعمل خارج المتصفح أيضًا — الوحدات نقية
  const { weightedScore } = await import(new URL('file://' + join(ROOT, 'js', 'domain', 'scoring.js').replace(/\\/g, '/')).href);
  assert.equal(weightedScore({ strategic: 5, impact: 5, feasibility: 5, readiness: 5, risk: 5 }), 100);
});
