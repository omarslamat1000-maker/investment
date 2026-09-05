// استيراد المبادرات من «نموذج احتياج المبادرات المستقبلية» (PPTX) أو من ملف CSV
// PPTX: يُفك ضغطه في المتصفح (JSZip عبر CDN) وتُقرأ الشرائح: كل نموذج شريحتان (بيانات + تقديرات)
// والتأشير في المربعات يُستنتج من شكل المربع (تعبئة accent6) وموقعه يمين التسمية.
import { CATEGORIES, COST_BANDS, DURATION_BANDS, READINESS_LEVELS } from '../core/constants.js';

const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
let zipPromise = null;
function loadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (zipPromise) return zipPromise;
  zipPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = JSZIP_URL;
    s.onload = () => resolve(window.JSZip);
    s.onerror = () => { zipPromise = null; reject(new Error('تعذر تحميل مكتبة فك الضغط — تحقق من الاتصال')); };
    document.head.appendChild(s);
  });
  return zipPromise;
}

// خيارات النموذج → قيم المنصة
const FIELD_MAP = { 'طرق': 'roads', 'أنسنة': 'humanization', 'حدائق': 'parks', 'إنارة': 'lighting', 'تصريف أمطار': 'drainage', 'مرافق': 'facilities', 'تقنية': 'technology' };
const COST_MAP = { 'أقل من 1 مليون': 'lt1m', '1–5 ملايين': '1to5m', '5–20 مليونًا': '5to20m', 'أكثر من 20 مليون ريال': 'gt20m', 'غير محددة': 'tbd' };
const DURATION_MAP = { 'أقل من 3 أشهر': 'lt3m', '3–6 أشهر': '3to6m', '6–12 شهرًا': '6to12m', 'أكثر من سنة': 'gt1y' };
const READINESS_MAP = { 'فكرة': 'idea', 'موقع محدد': 'sited', 'دراسة متوفرة': 'studied', 'تصميم متوفر': 'designed', 'جاهزة للتنفيذ': 'ready' };
const OPTION_LABELS = [...Object.keys(FIELD_MAP), ...Object.keys(COST_MAP), ...Object.keys(DURATION_MAP), ...Object.keys(READINESS_MAP)];
const PLACEHOLDERS = new Set(['اكتب هنا...', 'اكتب هنا', 'أخرى: ........', '']);

const attr = (xml, re) => (xml.match(re) || [])[1];
function paragraphs(xml) {
  return [...xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)]
    .map((m) => [...m[1].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((x) => decodeXml(x[1])).join('').trim())
    .filter(Boolean);
}
function decodeXml(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

// قيمة حقل مرقّم: النص بين عنوان الحقل والعنوان التالي
function fieldValue(paras, label, nextLabels) {
  const i = paras.findIndex((p) => p.startsWith(label));
  if (i < 0) return '';
  const out = [];
  for (let k = i + 1; k < paras.length; k++) {
    const p = paras[k];
    if (nextLabels.some((n) => p.startsWith(n))) break;
    if (/^مبادرة\s*:/.test(p) || /^https?:\/\//.test(p) || OPTION_LABELS.includes(p) || PLACEHOLDERS.has(p)) continue;
    out.push(p);
  }
  return out.join(' ').trim();
}

// المربعات المؤشَّرة: مربع بتعبئة accent6 على يمين تسمية الخيار في الصف نفسه
function tickedOptions(xml) {
  const shapes = [...xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)].map((m) => m[1]);
  const labels = []; const ticks = [];
  for (const s of shapes) {
    const x = Number(attr(s, /<a:off x="(\d+)"/)); const y = Number(attr(s, /<a:off x="\d+" y="(\d+)"/));
    const w = Number(attr(s, /<a:ext cx="(\d+)"/)); const h = Number(attr(s, /<a:ext cx="\d+" cy="(\d+)"/));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const t = paragraphs(s).join(' ').trim();
    if (t && OPTION_LABELS.includes(t)) { labels.push({ t, x, w, cy: y + h / 2 }); continue; }
    if (t) continue;
    const style = (s.match(/<p:style>[\s\S]*?<\/p:style>/) || [''])[0];
    const sp = (s.match(/<p:spPr>[\s\S]*?<\/p:spPr>/) || [''])[0];
    const isAccent = /fillRef idx="1"[^>]*>\s*<a:schemeClr val="accent6"/.test(style) && !/alpha val="0"/.test(sp) && !/srgbClr val="FFFFFF"/.test(sp) && w < 400000;
    if (isAccent) ticks.push({ x, cy: y + h / 2 });
  }
  const picked = new Set();
  for (const c of ticks) {
    const row = labels.filter((l) => Math.abs(l.cy - c.cy) < 150000 && l.x + l.w <= c.x + 60000);
    if (!row.length) continue;
    picked.add(row.sort((a, b) => b.x - a.x)[0].t);
  }
  return picked;
}

function pick(set, map, order) {
  const hits = order.filter((k) => set.has(k));
  return hits.length ? map[hits[hits.length - 1]] : '';
}

// يقرأ ملف PPTX ويعيد سجلات مبادرات مقترحة (لا تُحفظ حتى يعتمدها المستخدم)
export async function parseInitiativeFormPptx(file, { compressImage = null } = {}) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(file);
  const slideFiles = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  const slides = [];
  for (const name of slideFiles) {
    const xml = await zip.file(name).async('string');
    const rels = await zip.file(name.replace('slides/', 'slides/_rels/') + '.rels')?.async('string');
    slides.push({ name, xml, rels: rels || '' });
  }
  const records = [];
  for (let i = 0; i < slides.length; i++) {
    const paras = paragraphs(slides[i].xml);
    if (!paras.some((p) => p.startsWith('1. اسم المبادرة'))) continue;
    const next = slides[i + 1] || { xml: '', paras: [] };
    const nextParas = paragraphs(next.xml || '');
    const LABELS = ['1. اسم المبادرة', '2. الوكالة', '3. مجال', '4. المشكلة', '5. وصف', '6. الموقع', 'الحي / المنطقة', 'الطريق / المعلم', 'الإحداثيات', '7. الفئات', '8. الأثر', '9. التكلفة', '10. المدة', '11. مستوى', '12. المرفقات'];
    let title = fieldValue(paras, '1. اسم المبادرة', LABELS);
    const tag = paras.find((p) => /^مبادرة\s*:/.test(p));
    if (!title && tag) title = tag.replace(/^مبادرة\s*:\s*/, '').trim();
    const entity = fieldValue(paras, '2. الوكالة', LABELS) || paras.find((p) => /وكالة|الوكالة المساعدة/.test(p) && !/^2\./.test(p)) || '';
    const problem = fieldValue(paras, '4. المشكلة', LABELS);
    const summary = fieldValue(paras, '5. وصف', LABELS);
    const area = fieldValue(paras, 'الحي / المنطقة', LABELS);
    const road = fieldValue(paras, 'الطريق / المعلم', LABELS);
    const mapLink = paras.find((p) => /^https?:\/\//.test(p)) || '';
    const beneficiaries = fieldValue(paras, '7. الفئات', LABELS);
    const impact = fieldValue(nextParas, '8. الأثر', LABELS).replace(/^وضح الأثر المتوقع[^.]*مؤشر قياس إن أمكن\s*/, '');
    const ticks = tickedOptions(slides[i].xml);
    const ticks2 = tickedOptions(next.xml || '');
    const fieldPick = pick(ticks, FIELD_MAP, Object.keys(FIELD_MAP));
    let image = null;
    if (compressImage && next.rels) {
      // أكبر صورة في شريحة الأثر (صورة الموقع)
      const targets = [...next.rels.matchAll(/Target="\.\.\/media\/([^"]+)"/g)].map((m) => 'ppt/media/' + m[1]).filter((n) => /\.(jpe?g|png)$/i.test(n));
      let best = null;
      for (const t of targets) { const f = zip.file(t); if (!f) continue; const blob = await f.async('blob'); if (!best || blob.size > best.blob.size) best = { name: t, blob }; }
      if (best && best.blob.size > 40 * 1024) {
        try { image = await compressImage(new File([best.blob], best.name.split('/').pop(), { type: best.blob.type || 'image/png' })); } catch { image = null; }
      }
    }
    records.push({
      title, submitterEntity: entity, problem, summary,
      location: [road, area].filter((v) => v && !PLACEHOLDERS.has(v)).join(' — '),
      mapLink, beneficiaryGroups: beneficiaries, expectedImpact: impact,
      category: fieldPick || 'roads',
      costBand: pick(ticks2, COST_MAP, Object.keys(COST_MAP)) || 'tbd',
      durationBand: pick(ticks2, DURATION_MAP, Object.keys(DURATION_MAP)),
      readinessLevel: pick(ticks2, READINESS_MAP, Object.keys(READINESS_MAP)),
      imageDataUrl: image,
      source: `${file.name} — شريحة ${i + 1}`
    });
  }
  return records;
}

// ————— CSV —————
export const CSV_COLUMNS = [
  ['title', 'اسم المبادرة'], ['submitterEntity', 'الجهة المقدمة'], ['category', 'المجال (معرّف)'], ['problem', 'المشكلة'],
  ['summary', 'الحل المقترح'], ['location', 'الموقع'], ['beneficiaryGroups', 'الفئات المستفيدة'], ['expectedImpact', 'الأثر المتوقع'],
  ['costBand', 'نطاق التكلفة (معرّف)'], ['durationBand', 'المدة (معرّف)'], ['readinessLevel', 'الجاهزية (معرّف)'], ['lat', 'خط العرض'], ['lng', 'خط الطول']
];

export function csvTemplate() {
  const head = CSV_COLUMNS.map(([k, label]) => `${label} [${k}]`).join(',');
  const hints = [
    `المعرّفات: المجال ${CATEGORIES.map((c) => c.id + '=' + c.label).join(' | ')}`,
    `التكلفة ${COST_BANDS.map((c) => c.id + '=' + c.label).join(' | ')}`,
    `المدة ${DURATION_BANDS.map((c) => c.id + '=' + c.label).join(' | ')}`,
    `الجاهزية ${READINESS_LEVELS.map((c) => c.id + '=' + c.label).join(' | ')}`
  ].map((h) => `"# ${h.replace(/"/g, '""')}"`).join('\n');
  return '﻿' + head + '\n' + hints + '\n';
}

export function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  const src = String(text).replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()) && !r[0].startsWith('#'));
  if (!head) return [];
  const keys = head.map((h) => (h.match(/\[([a-zA-Z]+)\]/) || [])[1] || h.trim());
  return body.map((r, idx) => {
    const o = {};
    keys.forEach((k, i) => { o[k] = (r[i] || '').trim(); });
    return { ...o, lat: o.lat ? Number(o.lat) : null, lng: o.lng ? Number(o.lng) : null, source: `CSV — سطر ${idx + 2}` };
  }).filter((o) => o.title);
}
