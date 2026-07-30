/**
 * تحويل ملف GeoJSON للمعالم (تصدير المنصة) إلى ملف المعالم الافتراضية المدمجة
 * الاستخدام: node tools/convert-landmarks.js <معالم.geojson> data/landmarks-data.js
 * - Point عادي → معلم نقطي
 * - Point مع خاصية ring (رقم) → طريق دائري (حلقة بنصف قطر كم)
 * - LineString → طريق (خط بمساره الفعلي)
 * - Polygon → مشروع (مضلع)
 * تحافظ على المعرفات التاريخية للمعالم الأصلية حتى لا تنكسر تعديلات المستخدمين المخزنة.
 */
const fs = require('fs');

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Usage: node convert-landmarks.js <landmarks.geojson> <output.js>');
  process.exit(1);
}

// معرفات تاريخية ثابتة (تعديلات المستخدمين المخزنة تشير إليها)
const LEGACY_IDS = {
  'المسجد النبوي الشريف': 'bl-prophet-mosque',
  'مسجد قباء': 'bl-quba-mosque',
  'مسجد القبلتين': 'bl-qiblatain',
  'ميقات ذي الحليفة (أبيار علي)': 'bl-miqat',
  'مطار الأمير محمد بن عبدالعزيز الدولي': 'bl-airport',
  'محطة قطار الحرمين': 'bl-hhr-station',
  'محطة قطار الحرمين بالمدينة المنورة': 'bl-hhr-station',
  'جبل أحد': 'bl-uhud',
  'ممشى وادي العقيق': 'bl-aqeeq-walk',
  'الطريق الدائري الأول (طريق الملك فيصل)': 'bl-ring1',
  'الطريق الدائري الثاني (طريق الملك عبدالله)': 'bl-ring2',
  'الطريق الدائري الثالث (طريق الملك خالد)': 'bl-ring3',
  'طريق الهجرة (محور مكة)': 'bl-hijrah-rd',
  'طريق المطار (محور الشمال الشرقي)': 'bl-airport-rd',
  'طريق الملك عبدالعزيز': 'bl-king-abdulaziz-rd',
  'طريق القصيم (محور الشرق)': 'bl-qassim-rd',
};

const CAT_ICONS = {
  religious: 'fa-mosque', transport: 'fa-train', airport: 'fa-plane', road: 'fa-road',
  tourism: 'fa-mountain-sun', services: 'fa-building', project: 'fa-diagram-project', user: 'fa-location-dot',
};

const gj = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const r6 = (n) => Math.round(n * 1e6) / 1e6;
const usedIds = new Set();
let seq = 0;

const landmarks = gj.features.map((f) => {
  const p = f.properties || {};
  const name = p.name || 'معلم';
  const category = p.category || 'user';
  let id = LEGACY_IDS[name] || 'bl-x' + (++seq);
  while (usedIds.has(id)) id = id + '-' + (++seq); // ضمان الفرادة عند تكرار الأسماء
  usedIds.add(id);

  const lm = {
    id,
    name,
    category,
    icon: p.icon || CAT_ICONS[category] || 'fa-location-dot',
    description: p.description || '',
  };
  if (p.color) lm.color = p.color;

  const g = f.geometry;
  if (g.type === 'Point') {
    lm.lng = r6(g.coordinates[0]);
    lm.lat = r6(g.coordinates[1]);
    if (p.ring) lm.ring = { radiusKm: +p.ring };
  } else if (g.type === 'LineString') {
    lm.geomType = 'line';
    lm.path = g.coordinates.map((c) => [r6(c[1]), r6(c[0])]); // [lat,lng]
    lm.lat = r6(lm.path.reduce((s, x) => s + x[0], 0) / lm.path.length);
    lm.lng = r6(lm.path.reduce((s, x) => s + x[1], 0) / lm.path.length);
  } else if (g.type === 'Polygon') {
    const ringArr = g.coordinates[0] || [];
    const path = ringArr.slice(0, -1).map((c) => [r6(c[1]), r6(c[0])]);
    lm.geomType = 'polygon';
    lm.path = path;
    lm.lat = r6(path.reduce((s, x) => s + x[0], 0) / path.length);
    lm.lng = r6(path.reduce((s, x) => s + x[1], 0) / path.length);
  } else {
    return null; // نوع غير مدعوم
  }
  return lm;
}).filter(Boolean);

const js = '// المعالم الافتراضية المدمجة — مولّدة بـ tools/convert-landmarks.js\n' +
  'window.DEFAULT_LANDMARKS_DATA = ' + JSON.stringify(landmarks) + ';\n';
fs.writeFileSync(outputPath, js, 'utf8');

const byGeom = {};
landmarks.forEach((l) => { const t = l.ring ? 'ring' : (l.geomType || 'point'); byGeom[t] = (byGeom[t] || 0) + 1; });
console.log('Landmarks:', landmarks.length, JSON.stringify(byGeom));
console.log('Output:', (js.length / 1024).toFixed(1), 'KB');
