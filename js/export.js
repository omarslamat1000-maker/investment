/**
 * export.js — تصدير البيانات: Excel و GeoJSON و KML و JSON (نسخة احتياطية)
 * والتقارير القابلة للطباعة (PDF عبر نافذة الطباعة لضمان دعم العربية)
 */
(function () {
  'use strict';

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function downloadText(text, filename, mime = 'text/plain;charset=utf-8') {
    downloadBlob(new Blob([text], { type: mime }), filename);
  }

  /** تصدير صفوف إلى Excel عبر SheetJS مع دعم RTL */
  function toExcel(rows, filename, sheetName = 'بيانات') {
    if (typeof XLSX === 'undefined') {
      alert('مكتبة تصدير Excel غير محمّلة — تحقق من الاتصال بالإنترنت');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    // ضبط عرض الأعمدة تلقائياً
    if (rows.length) {
      ws['!cols'] = Object.keys(rows[0]).map((k) => ({
        wch: Math.min(40, Math.max(k.length + 4, ...rows.map((r) => String(r[k] ?? '').length + 2))),
      }));
    }
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
  }

  /** تصدير GeoJSON */
  function toGeoJSONFile(featureCollection, filename) {
    downloadText(JSON.stringify(featureCollection, null, 1), filename, 'application/geo+json;charset=utf-8');
  }

  function escapeXml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** تحويل FeatureCollection إلى KML (مضلعات ونقاط) */
  function toKML(featureCollection, docName) {
    const placemarks = featureCollection.features
      .map((f) => {
        const name = f.properties && (f.properties.name || f.properties._customName || f.properties._kmlName || f.id);
        let geomXml = '';
        const polyToXml = (rings) =>
          '<Polygon><outerBoundaryIs><LinearRing><coordinates>' +
          rings[0].map((c) => c[0] + ',' + c[1] + ',0').join(' ') +
          '</coordinates></LinearRing></outerBoundaryIs>' +
          rings.slice(1).map((r) =>
            '<innerBoundaryIs><LinearRing><coordinates>' +
            r.map((c) => c[0] + ',' + c[1] + ',0').join(' ') +
            '</coordinates></LinearRing></innerBoundaryIs>').join('') +
          '</Polygon>';

        if (f.geometry.type === 'Polygon') geomXml = polyToXml(f.geometry.coordinates);
        else if (f.geometry.type === 'MultiPolygon')
          geomXml = '<MultiGeometry>' + f.geometry.coordinates.map(polyToXml).join('') + '</MultiGeometry>';
        else if (f.geometry.type === 'Point')
          geomXml = '<Point><coordinates>' + f.geometry.coordinates[0] + ',' + f.geometry.coordinates[1] + ',0</coordinates></Point>';
        else return '';

        // الخصائص كـ ExtendedData
        const data = Object.entries(f.properties || {})
          .filter(([k, v]) => v !== null && v !== undefined && v !== '' && !k.startsWith('_'))
          .map(([k, v]) => '<Data name="' + escapeXml(k) + '"><value>' + escapeXml(v) + '</value></Data>')
          .join('');

        return (
          '<Placemark id="' + escapeXml(f.id || '') + '"><name>' + escapeXml(name || '') + '</name>' +
          (data ? '<ExtendedData>' + data + '</ExtendedData>' : '') +
          geomXml + '</Placemark>'
        );
      })
      .join('\n');

    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>' +
      '<name>' + escapeXml(docName || 'تصدير') + '</name>\n' + placemarks + '\n</Document></kml>'
    );
  }

  function toKMLFile(featureCollection, filename, docName) {
    downloadText(toKML(featureCollection, docName), filename, 'application/vnd.google-earth.kml+xml;charset=utf-8');
  }

  /**
   * تجهيز بيانات بطاقة أرض للطباعة (بيانات + مسافات + هندسة)
   * مشتركة بين صفحة الخريطة وصفحة تحليل الموقع
   */
  function buildLandCardData(landId) {
    const f = LandManager.getFeature(landId);
    if (!f) return null;
    const m = LandManager.state.metrics[landId] || {};
    const edit = LandManager.getEdit(landId);
    // فلاتر فئات المعالم المشتركة تنطبق على جدول مسافات البطاقة أيضاً
    const hiddenCats = (LandManager.state.settings || {}).hiddenLandmarkCats || [];
    let lms = Landmarks.getAll({ includeHidden: false }).filter((lm) => !hiddenCats.includes(lm.category));
    // إن حدد المستخدم معالم تركيز لهذه الأرض تُعرض هي فقط في التقرير
    const focusIds = edit.focusLandmarks || [];
    if (focusIds.length) lms = lms.filter((lm) => focusIds.includes(lm.id));
    const results = m.center ? DistanceAnalysis.analyzePoint(m.center, lms) : [];
    return {
      geometry: f.geometry,
      land: {
        name: LandManager.displayName(landId),
        parcelNo: LandManager.getProp(f, 'parcelNo'),
        areaM2: m.areaM2,
        perimeterM: m.perimeterM,
        sizeCat: m.sizeCat ? LandManager.SIZE_CATS[m.sizeCat].name : '',
        center: m.center,
        street: LandManager.getProp(f, 'street'),
        deed: LandManager.getProp(f, 'deed'),
        plan: LandManager.getProp(f, 'plan'),
        status: edit.status || '',
        priority: edit.priority || '',
        notes: edit.notes || '',
        sections: LandManager.sectionsOfLand(landId).map((s) => s.name),
      },
      // مع معالم التركيز تُعرض كلها، وإلا أقرب 12
      distances: (focusIds.length ? results : results.slice(0, 12)).map((r) => ({
        name: r.landmark.name,
        category: (Landmarks.CATEGORIES[r.landmark.category] || {}).name || '',
        km: r.km,
        direction: r.direction,
      })),
    };
  }

  /** فتح صفحة الطباعة (PDF) مع تمرير البيانات عبر sessionStorage */
  function openPrintPage(payload) {
    // إرفاق المعالم تلقائياً لعرضها على خرائط التقرير — مع احترام فلاتر الفئات المخفية
    if (!payload.landmarks && window.Landmarks) {
      const hiddenCats = (window.LandManager && LandManager.state.settings.hiddenLandmarkCats) || [];
      payload.landmarks = Landmarks.getAll({ includeHidden: false })
        .filter((lm) => !hiddenCats.includes(lm.category))
        .map((lm) => ({
        name: lm.name,
        lat: lm.lat,
        lng: lm.lng,
        category: lm.category,
        color: lm.color || (Landmarks.CATEGORIES[lm.category] || {}).color || '#64748b',
        ring: lm.ring || null,
        geomType: lm.geomType || 'point',
        path: lm.path || null, // مسار الخط/المضلع لعرضه على خرائط التقرير
      }));
    }
    sessionStorage.setItem('printPayload', JSON.stringify(payload));
    window.open('print.html', '_blank');
  }

  window.ExportUtils = { downloadBlob, downloadText, toExcel, toGeoJSONFile, toKML, toKMLFile, openPrintPage, buildLandCardData };
})();
