/**
 * landmarks.js — طبقة المعالم الثابتة في المدينة المنورة وإدارتها
 * - معالم افتراضية (دينية، نقل، مطارات، طرق، سياحية، خدمات)
 * - الطرق الدائرية ممثلة كحلقات (مركز + نصف قطر) لحساب المسافة لأقرب نقطة
 * - تعديلات المستخدم على المعالم الافتراضية تحفظ كـ overrides دون مساس بالأصل
 * - معالم المستخدم تحفظ في IndexedDB
 */
(function () {
  'use strict';

  const CATEGORIES = {
    religious: { name: 'معالم دينية', icon: 'fa-mosque', color: '#0e7a4f' },
    transport: { name: 'محطات نقل', icon: 'fa-train', color: '#1d4ed8' },
    airport: { name: 'مطارات', icon: 'fa-plane', color: '#7c3aed' },
    road: { name: 'طرق رئيسة', icon: 'fa-road', color: '#b45309' },
    tourism: { name: 'مواقع سياحية', icon: 'fa-mountain-sun', color: '#0e7490' },
    services: { name: 'خدمات ومرافق', icon: 'fa-building', color: '#64748b' },
    project: { name: 'مشاريع', icon: 'fa-diagram-project', color: '#9333ea' },
    user: { name: 'معالم المستخدم', icon: 'fa-location-dot', color: '#be123c' },
  };

  /* الأنواع الهندسية للمعلم:
   * point   — نقطة ثابتة (الافتراضي)
   * line    — خط: مجموعة إحداثيات مترابطة (طريق/محور)
   * polygon — مضلع: عدة نقاط تحيط بمنطقة (مشروع)
   * المعالم الحلقية القديمة (ring) تبقى مدعومة للطرق الدائرية */
  const GEOM_TYPES = {
    point: { name: 'نقطة ثابتة (معلم)', min: 1 },
    line: { name: 'خط — إحداثيات مترابطة (طريق)', min: 2 },
    polygon: { name: 'مضلع — عدة نقاط (مشروع)', min: 3 },
  };

  /** مركز تمثيلي لمسار [[lat,lng],...] — يستخدم للقوائم والاتجاهات */
  function centerOfPath(path) {
    const lat = path.reduce((s, p) => s + p[0], 0) / path.length;
    const lng = path.reduce((s, p) => s + p[1], 0) / path.length;
    return { lat, lng };
  }

  // مكتبة أيقونات للاختيار منها عند إضافة معلم
  const ICON_LIBRARY = [
    'fa-mosque', 'fa-kaaba', 'fa-plane', 'fa-train', 'fa-train-subway', 'fa-bus',
    'fa-road', 'fa-mountain-sun', 'fa-mountain', 'fa-tree', 'fa-hospital',
    'fa-school', 'fa-building', 'fa-building-columns', 'fa-store', 'fa-hotel',
    'fa-location-dot', 'fa-flag', 'fa-star', 'fa-landmark', 'fa-warehouse',
    'fa-water', 'fa-person-walking', 'fa-car', 'fa-gas-pump', 'fa-utensils',
  ];

  // المعالم الافتراضية للمدينة المنورة (إحداثيات تقريبية قابلة للتعديل من صفحة إدارة المعالم)
  const DEFAULT_LANDMARKS = [
    { id: 'bl-prophet-mosque', name: 'المسجد النبوي الشريف', category: 'religious', lat: 24.4672, lng: 39.6111, icon: 'fa-mosque', description: 'ثاني أقدس المساجد في الإسلام، في قلب المدينة المنورة.' },
    { id: 'bl-quba-mosque', name: 'مسجد قباء', category: 'religious', lat: 24.4394, lng: 39.6172, icon: 'fa-mosque', description: 'أول مسجد بني في الإسلام، جنوب المدينة المنورة.' },
    { id: 'bl-qiblatain', name: 'مسجد القبلتين', category: 'religious', lat: 24.4844, lng: 39.5788, icon: 'fa-mosque', description: 'المسجد الذي تحولت فيه القبلة من بيت المقدس إلى الكعبة.' },
    { id: 'bl-miqat', name: 'ميقات ذي الحليفة (أبيار علي)', category: 'religious', lat: 24.4139, lng: 39.5427, icon: 'fa-kaaba', description: 'ميقات أهل المدينة ومن مرّ بها للإحرام.' },
    { id: 'bl-airport', name: 'مطار الأمير محمد بن عبدالعزيز الدولي', category: 'airport', lat: 24.5534, lng: 39.7051, icon: 'fa-plane', description: 'المطار الدولي للمدينة المنورة، شمال شرق المدينة.' },
    { id: 'bl-hhr-station', name: 'محطة قطار الحرمين بالمدينة المنورة', category: 'transport', lat: 24.4836, lng: 39.5420, icon: 'fa-train', description: 'محطة قطار الحرمين السريع، غرب المدينة قرب مدينة المعرفة الاقتصادية.' },
    { id: 'bl-uhud', name: 'جبل أحد', category: 'tourism', lat: 24.5085, lng: 39.6137, icon: 'fa-mountain', description: 'أكبر جبال المدينة المنورة وموقع غزوة أحد.' },
    { id: 'bl-aqeeq-walk', name: 'ممشى وادي العقيق', category: 'tourism', lat: 24.4400, lng: 39.5680, icon: 'fa-person-walking', description: 'ممشى ترفيهي على ضفاف وادي العقيق المبارك.' },
    // الطرق الدائرية — نموذج حلقي: المسافة تحسب لأقرب نقطة على الحلقة
    { id: 'bl-ring1', name: 'الطريق الدائري الأول (طريق الملك فيصل)', category: 'road', lat: 24.4672, lng: 39.6111, icon: 'fa-road', ring: { radiusKm: 1.3 }, description: 'الدائري المحيط بالمنطقة المركزية حول المسجد النبوي.' },
    { id: 'bl-ring2', name: 'الطريق الدائري الثاني (طريق الملك عبدالله)', category: 'road', lat: 24.4672, lng: 39.6111, icon: 'fa-road', ring: { radiusKm: 4.5 }, description: 'الدائري الأوسط للمدينة المنورة.' },
    { id: 'bl-ring3', name: 'الطريق الدائري الثالث (طريق الملك خالد)', category: 'road', lat: 24.4672, lng: 39.6111, icon: 'fa-road', ring: { radiusKm: 8.5 }, description: 'الدائري الخارجي للمدينة المنورة.' },
    // محاور رئيسة (نقاط استدلالية على المحور)
    { id: 'bl-hijrah-rd', name: 'طريق الهجرة (محور مكة)', category: 'road', lat: 24.4080, lng: 39.5560, icon: 'fa-road', description: 'المحور الرئيس جنوب غرب المدينة باتجاه مكة المكرمة.' },
    { id: 'bl-airport-rd', name: 'طريق المطار (محور الشمال الشرقي)', category: 'road', lat: 24.5150, lng: 39.6560, icon: 'fa-road', description: 'المحور الرابط بين وسط المدينة والمطار.' },
    { id: 'bl-king-abdulaziz-rd', name: 'طريق الملك عبدالعزيز', category: 'road', lat: 24.4900, lng: 39.5900, icon: 'fa-road', description: 'محور رئيس يخترق المدينة من الشمال الغربي.' },
    { id: 'bl-qassim-rd', name: 'طريق القصيم (محور الشرق)', category: 'road', lat: 24.4850, lng: 39.6800, icon: 'fa-road', description: 'المحور الشرقي باتجاه القصيم.' },
  ];

  let overrides = {}; // تعديلات المستخدم على المعالم الافتراضية
  let userLandmarks = []; // معالم أضافها المستخدم
  let loaded = false;

  /* قناة بث لمزامنة التعديلات بين الصفحات/التبويبات المفتوحة فورياً */
  const changeListeners = [];
  let syncChannel = null;
  try {
    syncChannel = new BroadcastChannel('medina-lands-landmarks');
    syncChannel.onmessage = async (ev) => {
      if (ev.data && ev.data.type === 'changed') {
        // إعادة تحميل من التخزين ثم إبلاغ الصفحة لتحديث الخريطة والقوائم
        overrides = (await Storage2.get('landmarkOverrides')) || {};
        userLandmarks = (await Storage2.get('userLandmarks')) || [];
        changeListeners.forEach((cb) => { try { cb(); } catch (e) { /* تجاهل */ } });
      }
    };
  } catch (e) { /* متصفح لا يدعم BroadcastChannel — تبقى المزامنة عند إعادة التحميل */ }

  /** تسجيل دالة تُستدعى عند تغيّر المعالم من صفحة/تبويب آخر */
  function onChanged(cb) { changeListeners.push(cb); }

  async function load() {
    if (loaded) return;
    overrides = (await Storage2.get('landmarkOverrides')) || {};
    userLandmarks = (await Storage2.get('userLandmarks')) || [];
    loaded = true;
  }

  function persist() {
    // حفظ فوري (غير مؤجل) حتى لا تضيع التعديلات عند الانتقال السريع بين الصفحات
    return Promise.all([
      Storage2.set('landmarkOverrides', overrides),
      Storage2.set('userLandmarks', userLandmarks),
    ]).then(() => {
      if (syncChannel) syncChannel.postMessage({ type: 'changed' });
    }).catch((e) => console.error('landmarks persist failed:', e));
  }

  /** حفظ فوري شامل لكل المعالم وتعديلاتها — لزر «حفظ الكل» */
  function saveNow() {
    return persist();
  }

  /**
   * القائمة النهائية بعد دمج التعديلات
   * includeHidden=false : استبعاد المحذوفة (الافتراضية المخفية بالحذف)
   *                       واستبعاد الموقوفة بزر الإظهار/الإخفاء (visible === false)
   *                       — وهذا ما تستخدمه الخريطة والتحليل والطباعة تلقائياً
   * withOff=true        : إبقاء الموقوفة في القائمة (لصفحة إدارة المعالم حتى يمكن إعادة تفعيلها)
   */
  function getAll({ includeHidden = true, withOff = false } = {}) {
    const merged = DEFAULT_LANDMARKS.map((lm) => {
      const ov = overrides[lm.id];
      return ov ? { ...lm, ...ov, builtin: true } : { ...lm, builtin: true };
    });
    const all = merged.concat(userLandmarks.map((lm) => ({ ...lm, builtin: false })));
    if (includeHidden) return all;
    let list = all.filter((lm) => !lm.hidden);
    if (!withOff) list = list.filter((lm) => lm.visible !== false);
    return list;
  }

  function getById(id) {
    return getAll().find((lm) => lm.id === id) || null;
  }

  /** إضافة معلم مستخدم جديد — نقطة أو خط (path) أو مضلع */
  function add(lm) {
    const landmark = {
      id: 'user-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      name: lm.name || 'معلم جديد',
      category: lm.category || 'user',
      geomType: lm.geomType || 'point',
      lat: lm.lat,
      lng: lm.lng,
      path: lm.path || null, // [[lat,lng],...] للخط والمضلع
      icon: lm.icon || 'fa-location-dot',
      color: lm.color || null,
      description: lm.description || '',
      createdAt: new Date().toISOString(),
    };
    // للخط والمضلع: المركز التمثيلي يحسب من نقاط المسار
    if (landmark.path && landmark.path.length) {
      const c = centerOfPath(landmark.path);
      landmark.lat = c.lat;
      landmark.lng = c.lng;
    }
    userLandmarks.push(landmark);
    persist();
    return landmark;
  }

  /** تعديل معلم (افتراضي عبر override أو معلم مستخدم مباشرة) */
  function update(id, changes) {
    // عند تغيير المسار يعاد حساب المركز التمثيلي، وعند التحول لنقطة يمسح المسار
    if (changes.path && changes.path.length) {
      const c = centerOfPath(changes.path);
      changes.lat = c.lat;
      changes.lng = c.lng;
      if (changes.geomType && changes.geomType !== 'point') changes.ring = null;
    } else if (changes.geomType === 'point') {
      changes.path = null;
    }
    const builtin = DEFAULT_LANDMARKS.find((l) => l.id === id);
    if (builtin) {
      overrides[id] = { ...(overrides[id] || {}), ...changes };
    } else {
      const idx = userLandmarks.findIndex((l) => l.id === id);
      if (idx === -1) return false;
      userLandmarks[idx] = { ...userLandmarks[idx], ...changes };
    }
    persist();
    return true;
  }

  /** حذف معلم — الافتراضي يُخفى فقط (يمكن استعادته)، ومعلم المستخدم يحذف نهائياً */
  function remove(id) {
    const builtin = DEFAULT_LANDMARKS.find((l) => l.id === id);
    if (builtin) {
      overrides[id] = { ...(overrides[id] || {}), hidden: true };
    } else {
      userLandmarks = userLandmarks.filter((l) => l.id !== id);
    }
    persist();
  }

  /** استعادة معلم افتراضي لأصله */
  function resetBuiltin(id) {
    delete overrides[id];
    persist();
  }

  /** استيراد معالم من مصفوفة (Excel/GeoJSON) */
  function importMany(list) {
    let count = 0;
    list.forEach((lm) => {
      if (isFinite(lm.lat) && isFinite(lm.lng) && lm.name) {
        add(lm);
        count++;
      }
    });
    return count;
  }

  /* ========== استيراد المعالم من الملفات (مشترك بين الصفحات) ========== */

  /** تحويل عناصر GeoJSON إلى معالم (نقطة/خط/مضلع) */
  function geojsonToLandmarks(gj) {
    const list = [];
    (gj.features || []).forEach((f) => {
      if (!f.geometry) return;
      const props = f.properties || {};
      const base = {
        name: props.name || props._kmlName || 'معلم مستورد',
        category: props.category || 'user',
        icon: props.icon || 'fa-location-dot',
        description: props.description || '',
      };
      const g = f.geometry;
      if (g.type === 'Point') {
        list.push({ ...base, lng: g.coordinates[0], lat: g.coordinates[1] });
      } else if (g.type === 'LineString') {
        const path = g.coordinates.map((c) => [c[1], c[0]]);
        if (path.length >= 2) list.push({ ...base, geomType: 'line', path, lat: path[0][0], lng: path[0][1] });
      } else if (g.type === 'MultiLineString') {
        (g.coordinates || []).forEach((seg, i) => {
          const path = seg.map((c) => [c[1], c[0]]);
          if (path.length >= 2) list.push({ ...base, name: base.name + (g.coordinates.length > 1 ? ' (' + (i + 1) + ')' : ''), geomType: 'line', path, lat: path[0][0], lng: path[0][1] });
        });
      } else if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
        polys.forEach((poly, i) => {
          const ring = (poly[0] || []).map((c) => [c[1], c[0]]);
          if (ring.length >= 4) {
            const path = ring.slice(0, -1);
            list.push({ ...base, name: base.name + (polys.length > 1 ? ' (' + (i + 1) + ')' : ''), geomType: 'polygon', path, lat: path[0][0], lng: path[0][1] });
          }
        });
      }
    });
    return list;
  }

  /** قراءة ملف واحد (KML/KMZ/GeoJSON/Excel/CSV) وإرجاع قائمة معالم خام */
  async function parseImportFile(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.kml') || name.endsWith('.kmz')) {
      const { geojson } = await KMLParser.parseFile(file);
      return geojsonToLandmarks(geojson);
    }
    if (name.endsWith('.geojson') || name.endsWith('.json')) {
      return geojsonToLandmarks(JSON.parse(await file.text()));
    }
    // Excel/CSV عبر SheetJS — أعمدة متوقعة: الاسم، خط العرض، خط الطول، التصنيف، الوصف
    if (typeof XLSX === 'undefined') throw new Error('مكتبة Excel غير محمّلة');
    const wb = XLSX.read(await file.arrayBuffer());
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    const catByName = {};
    Object.entries(CATEGORIES).forEach(([k, c]) => (catByName[c.name] = k));
    const list = [];
    rows.forEach((r) => {
      const lat = parseFloat(r['خط العرض'] ?? r.lat ?? r.Lat ?? r.latitude);
      const lng = parseFloat(r['خط الطول'] ?? r.lng ?? r.Lng ?? r.longitude);
      if (isFinite(lat) && isFinite(lng)) {
        list.push({
          name: r['الاسم'] || r.name || 'معلم مستورد',
          category: catByName[r['التصنيف']] || r.category || 'user',
          description: r['الوصف'] || r.description || '',
          lat, lng,
        });
      }
    });
    return list;
  }

  /**
   * تطبيق خيارات الاستيراد التي اختارها المستخدم على القائمة:
   * category: فرض تصنيف موحد ('' = تلقائي من الملف)
   * geomType: 'auto' | 'point' (تحويل الكل لنقاط مركزية) | 'line' | 'polygon'
   */
  function applyImportOverrides(list, { category = '', geomType = 'auto' } = {}) {
    return list.map((lm) => {
      const out = { ...lm };
      if (category) out.category = category;
      if (geomType === 'point' && out.path && out.path.length) {
        const c = centerOfPath(out.path);
        out.lat = c.lat; out.lng = c.lng;
        out.path = null; out.geomType = 'point';
      } else if (geomType === 'line' && out.path && out.path.length >= 2) {
        out.geomType = 'line'; // مضلع → خط حدوده
      } else if (geomType === 'polygon' && out.path && out.path.length >= 3) {
        out.geomType = 'polygon'; // خط مغلق → مضلع
      }
      return out;
    });
  }

  /** الوصف العربي للنوع الهندسي */
  function geomLabel(lm) {
    if (lm.ring) return 'حلقة (' + lm.ring.radiusKm + ' كم)';
    if (lm.path && lm.path.length) {
      return (lm.geomType === 'polygon' ? 'مضلع' : 'خط') + ' — ' + lm.path.length + ' نقطة';
    }
    return 'نقطة';
  }

  /** تصدير المعالم كصفوف جدول */
  function toRows() {
    return getAll().map((lm) => ({
      'المعرف': lm.id,
      'الاسم': lm.name,
      'التصنيف': CATEGORIES[lm.category] ? CATEGORIES[lm.category].name : lm.category,
      'النوع الهندسي': geomLabel(lm),
      'خط العرض': lm.lat,
      'خط الطول': lm.lng,
      'نقاط المسار': lm.path ? lm.path.map((p) => p[0].toFixed(6) + ',' + p[1].toFixed(6)).join(' ; ') : '',
      'الوصف': lm.description || '',
      'النوع': lm.builtin ? 'افتراضي' : 'مستخدم',
    }));
  }

  /** تصدير GeoJSON — النقطة/الخط/المضلع بأنواعها الهندسية الحقيقية */
  function toGeoJSON() {
    return {
      type: 'FeatureCollection',
      name: 'معالم المدينة المنورة',
      features: getAll().map((lm) => {
        let geometry;
        if (lm.path && lm.path.length >= 2) {
          const coords = lm.path.map((p) => [p[1], p[0]]); // [lng,lat]
          if (lm.geomType === 'polygon' && lm.path.length >= 3) {
            geometry = { type: 'Polygon', coordinates: [coords.concat([coords[0]])] };
          } else {
            geometry = { type: 'LineString', coordinates: coords };
          }
        } else {
          geometry = { type: 'Point', coordinates: [lm.lng, lm.lat] };
        }
        return {
          type: 'Feature',
          id: lm.id,
          properties: {
            name: lm.name,
            category: lm.category,
            icon: lm.icon,
            description: lm.description || '',
            ring: lm.ring ? lm.ring.radiusKm : null,
          },
          geometry,
        };
      }),
    };
  }

  window.Landmarks = {
    CATEGORIES,
    GEOM_TYPES,
    ICON_LIBRARY,
    DEFAULT_LANDMARKS,
    geomLabel,
    centerOfPath,
    onChanged,
    geojsonToLandmarks,
    parseImportFile,
    applyImportOverrides,
    saveNow,
    load,
    getAll,
    getById,
    add,
    update,
    remove,
    resetBuiltin,
    importMany,
    toRows,
    toGeoJSON,
  };
})();
