/**
 * أداة تحويل ملف KML الخاص بأراضي أمانة المدينة المنورة إلى GeoJSON مدمج
 * الاستخدام: node tools/convert-kml.js <doc.kml> <output.js>
 * تستخرج الأداة خصائص كل قطعة من جدول HTML داخل وسم description
 * وتحتفظ فقط بالحقول غير الفارغة لتقليل حجم الملف الناتج.
 */
const fs = require('fs');

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Usage: node convert-kml.js <doc.kml> <output.js>');
  process.exit(1);
}

const kml = fs.readFileSync(inputPath, 'utf8');

// تقسيم الملف إلى Placemarks
const placemarkRe = /<Placemark id="([^"]*)">([\s\S]*?)<\/Placemark>/g;
const features = [];
let m;

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// استخراج أزواج (اسم الحقل، القيمة) من جدول HTML داخل description
function parseAttributes(desc) {
  const attrs = {};
  const rowRe = /<tr[^>]*>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g;
  let r;
  while ((r = rowRe.exec(desc)) !== null) {
    const key = decodeEntities(r[1]).replace(/<[^>]*>/g, '').trim();
    let val = decodeEntities(r[2]).replace(/<[^>]*>/g, '').trim();
    if (!key) continue;
    if (val === '<Null>' || val === '' || val === 'NULL') continue; // تجاهل القيم الفارغة
    // لا نكرر مفتاحاً موجوداً بقيمة (بعض الجداول تكرر "اشتراطات البناء")
    if (attrs[key] !== undefined) continue;
    attrs[key] = val;
  }
  return attrs;
}

// استخراج حلقات الإحداثيات من المضلعات
function parsePolygons(body) {
  const polys = [];
  const polyRe = /<Polygon>([\s\S]*?)<\/Polygon>/g;
  let p;
  while ((p = polyRe.exec(body)) !== null) {
    const rings = [];
    const outerRe = /<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/outerBoundaryIs>/g;
    const innerRe = /<innerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/innerBoundaryIs>/g;
    let b;
    while ((b = outerRe.exec(p[1])) !== null) rings.push(parseCoords(b[1]));
    while ((b = innerRe.exec(p[1])) !== null) rings.push(parseCoords(b[1]));
    if (rings.length && rings[0].length >= 4) polys.push(rings);
  }
  return polys;
}

function parseCoords(text) {
  const pts = text
    .trim()
    .split(/\s+/)
    .map((t) => {
      const parts = t.split(',');
      // تقريب إلى 7 خانات عشرية (~1 سم) لتقليل الحجم
      return [Math.round(parseFloat(parts[0]) * 1e7) / 1e7, Math.round(parseFloat(parts[1]) * 1e7) / 1e7];
    })
    .filter((c) => isFinite(c[0]) && isFinite(c[1]));
  // إغلاق الحلقة إن لم تكن مغلقة
  if (pts.length >= 3) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) pts.push([first[0], first[1]]);
  }
  return pts;
}

let skipped = 0;
while ((m = placemarkRe.exec(kml)) !== null) {
  const id = m[1];
  const body = m[2];
  const nameMatch = body.match(/<name>([\s\S]*?)<\/name>/);
  const name = nameMatch ? decodeEntities(nameMatch[1]).trim() : '';
  const descMatch = body.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/);
  const attrs = descMatch ? parseAttributes(descMatch[1]) : {};
  const polys = parsePolygons(body);
  if (!polys.length) {
    skipped++;
    continue;
  }
  const geometry =
    polys.length === 1
      ? { type: 'Polygon', coordinates: polys[0] }
      : { type: 'MultiPolygon', coordinates: polys };
  features.push({
    type: 'Feature',
    id,
    properties: { _kmlName: name === 'NULL' ? '' : name, ...attrs },
    geometry,
  });
}

const fc = { type: 'FeatureCollection', name: 'الاراضى التابعة لامانة المدينة المنورة', features };
const js = '// بيانات الأراضي المحوّلة من ملف KMZ الخاص بأمانة منطقة المدينة المنورة\n' +
  'window.DEFAULT_LANDS_GEOJSON = ' + JSON.stringify(fc) + ';\n';
fs.writeFileSync(outputPath, js, 'utf8');
console.log(`Features: ${features.length}, skipped (no geometry): ${skipped}`);
console.log(`Output size: ${(js.length / 1024 / 1024).toFixed(2)} MB`);
