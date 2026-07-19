# CLAUDE.md — منصة المواقع الاستثمارية بالمدينة المنورة

تطبيق ويب عربي RTL ثابت (بلا خادم خلفي) لإدارة وتحليل ~1015 قطعة أرض بالمدينة المنورة.
هذا الملف يوثّق أعراف المشروع لأي جلسة تطوير قادمة.

## التشغيل والفحص

- خادم التطوير: `npx http-server -p 8123` من مجلد المشروع (أو إعداد `medina-lands` في `.claude/launch.json`).
- لا خطوة بناء — الملفات تُقدَّم كما هي، والمكتبات عبر CDN (Leaflet، Turf، JSZip، SheetJS، Chart.js، FontAwesome، leaflet-simple-map-screenshoter).
- فحص الصياغة قبل أي دفعة: `node --check js/*.js` (خط CI في `.github/workflows/deploy.yml` يفحص ثم ينشر على GitHub Pages).
- التحقق الوظيفي يتم في المتصفح عبر أدوات فحص DOM — أداة لقطة الشاشة قد تنتهي مهلتها على هذا التطبيق (خرائط Canvas ثقيلة)، استخدم فحوص JavaScript بدلها.

## البنية

| الملف | الدور |
|---|---|
| `index.html` + `js/app.js` | الخريطة الرئيسية: لوحة، فلاتر، أقسام، بطاقة الأرض (drawer) |
| `analysis.html` + `js/analysis-page.js` | تحليل المسافات، قائمة طباعة متعددة المواقع |
| `landmarks.html` + `js/landmarks-page.js` | إدارة المعالم (نقطة/خط/مضلع/حلقة) |
| `print.html` + `js/print-page.js` | تقارير الطباعة A4 عرضية — الحمولة عبر `sessionStorage.printPayload` |
| `js/land-manager.js` | حالة الأراضي والمقاييس والفلاتر والأقسام والإعدادات |
| `js/landmarks.js` | نموذج المعالم + الاستيراد + المزامنة |
| `js/distance-analysis.js` | المسافات (نقطة/حلقة/خط/مضلع) والاتجاهات وOSRM |
| `js/storage.js` | طبقة IndexedDB (`medina-lands-db`، مخزن `kv` واحد) |
| `js/export.js` | Excel/GeoJSON/KML + تجهيز حمولات الطباعة |
| `data/lands-data.js` | البيانات المدمجة `window.DEFAULT_LANDS_GEOJSON` — تُحدَّث بـ `node tools/convert-kml.js doc.kml data/lands-data.js` |

## أعراف مهمة (لا تكسرها)

1. **الحفظ فوري دائماً**: كل تعديل يُكتب لحظياً في IndexedDB (لا debounce للكتابات الجديدة) + صمام `beforeunload/pagehide` في storage.js.
2. **مزامنة التبويبات**: تغييرات المعالم تُبث عبر `BroadcastChannel('medina-lands-landmarks')` والإعدادات عبر `'medina-lands-settings'` — أي مصدر تغيير جديد يجب أن يبث بعد الكتابة.
3. **فلاتر فئات المعالم مشتركة**: مصدر الحقيقة `settings.hiddenLandmarkCats` — كل الصفحات والطباعة تقرأ منه.
4. **الإخفاء الفردي للمعلم**: `visible === false`؛ `Landmarks.getAll({includeHidden:false})` يستثنيه تلقائياً، وقائمة الإدارة تستخدم `{withOff:true}` لإبقائه ظاهراً فيها.
5. **تعديلات البيانات الأساسية للقطع**: تُخزن في `edits[id].props` ولها الأولوية داخل `LandManager.getProp` — لا تعدّل خصائص الملف الأصلي أبداً.
6. **تلميحات Leaflet تنزاح في RTL** — لوسوم الخرائط الدائمة استخدم نمط divIcon المرتكز (`.pm-lbl`/`.site-lbl`) لا bindTooltip.
7. **مكتبة اللقطات** تصدّر `L.simpleMapScreenshoter` (دالة مصنعية) — ليس صنفاً عاماً.
8. **الطباعة A4 عرضية** بصفحة واحدة: أي إضافة لمحتوى التقرير يجب أن تُقاس (ارتفاع الورقة المتاح ~194مم؛ حالياً مستهلك ~161مم).
9. الاسم الرسمي: **منصة المواقع الاستثمارية بالمدينة المنورة** (أُعيدت التسمية 2026-07-18).

## مفاتيح التخزين (kv)

`dataset`، `datasetMeta`، `edits`، `sections`، `userLandmarks`، `landmarkOverrides`، `settings`

## التحقق المعتمد

- المعادلات: 33 اختباراً مقابل حساب يدوي (هافرساين/مساحات كروية) — كلها مطابقة (2026-07-19).
- الجودة: مسارات حرجة + روابط + تجاوب 375/768/1440 + أداء (تحميل 726ms، رسم 1015 مضلعاً في 29ms).
