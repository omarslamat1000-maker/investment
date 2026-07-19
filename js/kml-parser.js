/**
 * kml-parser.js — قراءة ملفات KML و KMZ وتحويلها إلى GeoJSON
 * - يدعم KMZ (أرشيف مضغوط) عبر JSZip و KML نصي مباشرة
 * - يستخرج خصائص القطع من جداول HTML داخل وسم description (صيغة ArcGIS)
 *   ومن وسوم ExtendedData/SchemaData القياسية
 * - يعالج المضلعات غير المغلقة ويتجاهل الأشكال غير الصالحة
 * - يعالج الملف على دفعات (chunks) حتى لا تتجمد الواجهة
 */
(function () {
  'use strict';

  function decodeEntities(s) {
    const el = document.createElement('textarea');
    el.innerHTML = s;
    return el.value;
  }

  // استخراج أزواج (الحقل، القيمة) من جدول HTML داخل description
  function parseDescriptionTable(desc) {
    const attrs = {};
    if (!desc) return attrs;
    try {
      const doc = new DOMParser().parseFromString(desc, 'text/html');
      doc.querySelectorAll('tr').forEach((tr) => {
        const tds = tr.querySelectorAll('td');
        if (tds.length === 2) {
          const key = tds[0].textContent.trim();
          const val = tds[1].textContent.trim();
          if (key && val && val !== '<Null>' && val !== 'NULL' && attrs[key] === undefined) {
            attrs[key] = val;
          }
        }
      });
    } catch (e) {
      /* وصف غير قابل للتحليل — نتجاهله */
    }
    return attrs;
  }

  // تحويل نص إحداثيات KML إلى مصفوفة [lng, lat]
  function parseCoordText(text) {
    const pts = [];
    text
      .trim()
      .split(/\s+/)
      .forEach((t) => {
        const p = t.split(',');
        const lng = parseFloat(p[0]);
        const lat = parseFloat(p[1]);
        if (isFinite(lng) && isFinite(lat)) pts.push([lng, lat]);
      });
    return pts;
  }

  // إغلاق الحلقة إن لم تكن مغلقة
  function closeRing(ring) {
    if (ring.length >= 3) {
      const f = ring[0];
      const l = ring[ring.length - 1];
      if (f[0] !== l[0] || f[1] !== l[1]) ring.push([f[0], f[1]]);
    }
    return ring;
  }

  function parsePolygonEl(polyEl) {
    const rings = [];
    const outer = polyEl.querySelector('outerBoundaryIs coordinates');
    if (outer) {
      const r = closeRing(parseCoordText(outer.textContent));
      if (r.length >= 4) rings.push(r);
    }
    polyEl.querySelectorAll('innerBoundaryIs coordinates').forEach((c) => {
      const r = closeRing(parseCoordText(c.textContent));
      if (r.length >= 4) rings.push(r);
    });
    return rings.length ? rings : null;
  }

  // تحويل عنصر Placemark إلى Feature (مضلعات فقط للأراضي، ونقاط للمعالم)
  function placemarkToFeature(pm, index) {
    const id = pm.getAttribute('id') || 'PM_' + index;
    const nameEl = pm.querySelector(':scope > name');
    let name = nameEl ? nameEl.textContent.trim() : '';
    if (name === 'NULL') name = '';

    const props = { _kmlName: name };

    // ExtendedData القياسي
    pm.querySelectorAll('ExtendedData Data').forEach((d) => {
      const k = d.getAttribute('name');
      const v = d.querySelector('value');
      if (k && v && v.textContent.trim()) props[k] = v.textContent.trim();
    });
    pm.querySelectorAll('ExtendedData SchemaData SimpleData').forEach((d) => {
      const k = d.getAttribute('name');
      if (k && d.textContent.trim()) props[k] = d.textContent.trim();
    });

    // جدول HTML داخل description (صيغة تصدير ArcGIS)
    const descEl = pm.querySelector(':scope > description');
    if (descEl) {
      Object.assign(props, parseDescriptionTable(descEl.textContent));
    }

    // الأشكال الهندسية
    const polys = [];
    pm.querySelectorAll('Polygon').forEach((p) => {
      const rings = parsePolygonEl(p);
      if (rings) polys.push(rings);
    });

    if (polys.length) {
      const geometry =
        polys.length === 1
          ? { type: 'Polygon', coordinates: polys[0] }
          : { type: 'MultiPolygon', coordinates: polys };
      return { type: 'Feature', id, properties: props, geometry };
    }

    // نقطة (تُستخدم عند استيراد معالم)
    const pt = pm.querySelector('Point coordinates');
    if (pt) {
      const c = parseCoordText(pt.textContent);
      if (c.length) {
        return { type: 'Feature', id, properties: props, geometry: { type: 'Point', coordinates: c[0] } };
      }
    }

    // خط
    const ls = pm.querySelector('LineString coordinates');
    if (ls) {
      const c = parseCoordText(ls.textContent);
      if (c.length >= 2) {
        return { type: 'Feature', id, properties: props, geometry: { type: 'LineString', coordinates: c } };
      }
    }

    return null; // شكل غير مدعوم أو ناقص
  }

  /**
   * تحويل نص KML إلى GeoJSON على دفعات مع تقرير تقدم
   * onProgress(done, total) اختيارية
   */
  async function kmlToGeoJSON(kmlText, onProgress) {
    const doc = new DOMParser().parseFromString(kmlText, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) throw new Error('ملف KML غير صالح — تعذّر تحليل XML');

    const placemarks = Array.from(doc.getElementsByTagName('Placemark'));
    if (!placemarks.length) throw new Error('لا توجد عناصر Placemark في الملف');

    const features = [];
    let skipped = 0;
    const CHUNK = 100; // معالجة 100 عنصر ثم إعادة التحكم للواجهة

    for (let i = 0; i < placemarks.length; i += CHUNK) {
      const end = Math.min(i + CHUNK, placemarks.length);
      for (let j = i; j < end; j++) {
        try {
          const f = placemarkToFeature(placemarks[j], j);
          if (f) features.push(f);
          else skipped++;
        } catch (e) {
          skipped++;
        }
      }
      if (onProgress) onProgress(end, placemarks.length);
      // إعادة التحكم لحلقة الأحداث حتى لا تتجمد الواجهة
      await new Promise((r) => setTimeout(r, 0));
    }

    const docName = doc.querySelector('Document > name');
    return {
      geojson: {
        type: 'FeatureCollection',
        name: docName ? docName.textContent.trim() : 'طبقة مستوردة',
        features,
      },
      skipped,
    };
  }

  /**
   * قراءة ملف (KML أو KMZ) وإرجاع GeoJSON
   */
  async function parseFile(file, onProgress) {
    const name = file.name.toLowerCase();
    let kmlText;

    if (name.endsWith('.kmz')) {
      if (typeof JSZip === 'undefined') throw new Error('مكتبة JSZip غير محمّلة');
      const zip = await JSZip.loadAsync(file);
      // البحث عن أول ملف .kml داخل الأرشيف (عادة doc.kml)
      let kmlEntry = zip.file('doc.kml');
      if (!kmlEntry) {
        const kmlFiles = Object.keys(zip.files).filter((f) => f.toLowerCase().endsWith('.kml'));
        if (!kmlFiles.length) throw new Error('لا يوجد ملف KML داخل أرشيف KMZ');
        kmlEntry = zip.file(kmlFiles[0]);
      }
      kmlText = await kmlEntry.async('string');
    } else if (name.endsWith('.kml')) {
      kmlText = await file.text();
    } else if (name.endsWith('.geojson') || name.endsWith('.json')) {
      // دعم إضافي: استيراد GeoJSON مباشرة
      const gj = JSON.parse(await file.text());
      if (gj.type !== 'FeatureCollection') throw new Error('ملف GeoJSON غير صالح');
      return { geojson: gj, skipped: 0 };
    } else {
      throw new Error('صيغة الملف غير مدعومة — الرجاء اختيار KML أو KMZ');
    }

    return kmlToGeoJSON(kmlText, onProgress);
  }

  window.KMLParser = { parseFile, kmlToGeoJSON };
})();
