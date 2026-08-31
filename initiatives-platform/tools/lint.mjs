// فحص صياغة جميع ملفات JavaScript كوحدات ES — بلا اعتمادات خارجية
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, statSync } from 'node:fs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function collectJs(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) {
      if (name === 'node_modules') continue;
      collectJs(full, out);
    } else if (/\.(js|mjs)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const files = [
  ...collectJs(join(ROOT, 'js')),
  ...collectJs(join(ROOT, 'data')),
  ...collectJs(join(ROOT, 'tools')),
  ...collectJs(join(ROOT, 'tests')),
  join(ROOT, 'service-worker.js')
];

let failed = 0;
for (const file of files) {
  const src = await readFile(file, 'utf8');
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: src, encoding: 'utf8'
  });
  const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
  if (result.status === 0) {
    console.log(`OK   ${rel}`);
  } else {
    failed++;
    console.error(`FAIL ${rel}\n${result.stderr}`);
  }
}

console.log(`\n${files.length - failed}/${files.length} ملفًا سليم الصياغة`);
if (failed) process.exit(1);
