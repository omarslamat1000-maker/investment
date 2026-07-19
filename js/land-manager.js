/**
 * land-manager.js — إدارة بيانات الأراضي: التحميل، التصنيف، التعديلات،
 * الأقسام المخصصة، الفلاتر، والإحصاءات.
 * البيانات الأصلية المستوردة تُحفظ منفصلة تماماً عن تعديلات المستخدم.
 */
(function () {
  'use strict';

  // فئات التصنيف حسب المساحة (م²)
  const SIZE_CATS = {
    small: { name: 'أقل من 50,000 م²', max: 50000 },
    medium: { name: 'من 50,000 إلى 100,000 م²', max: 100000 },
    large: { name: 'أكثر من 100,000 م²', max: Infinity },
  };
  const DEFAULT_COLORS = { small: '#4ade80', medium: '#f59e0b', large: '#dc2626' };

  const STATUS_OPTIONS = ['', 'متاحة', 'تحت الدراسة', 'محجوزة', 'مخصصة لمشروع', 'بحاجة تحقق ميداني'];
  const PRIORITY_OPTIONS = ['', 'عالية', 'متوسطة', 'منخفضة'];

  // أسماء الحقول المحتملة في بيانات KML لكل خاصية
  const FIELD_ALIASES = {
    parcelNo: ['رقم مميز قطعة الأرض', 'رقم قطعة الارض بالمخطط', 'رقم القطعة', 'PARCEL_NO'],
    district: ['اسم الحي', 'إسم الحي', 'الحي', 'DISTRICT'],
    street: ['اسم الشارع', 'الشارع'],
    deed: ['رقم الصك'],
    plan: ['رقم مميز المخطط التقسيمي', 'رقم المخطط'],
    owner: ['الاسم بالعربية', 'المالك'],
    measuredArea: ['المساحة المقاسة'],
  };

  const state = {
    features: [],        // GeoJSON features الأصلية
    metrics: {},         // {id: {areaM2, perimeterM, center, sizeCat}}
    edits: {},           // {id: {customName, notes, description, status, priority, savedAnalysis}}
    sections: [],        // [{id, name, color, createdAt, items:[{landId, customName}]}]
    settings: {
      theme: 'light',
      basemap: 'streets',
      catColors: { ...DEFAULT_COLORS },
      hiddenLandmarkCats: [],
      landmarksVisible: true,
    },
    datasetMeta: null,
    ready: false,
  };

  const listeners = { change: [], dataset: [] };
  function on(event, fn) { (listeners[event] || (listeners[event] = [])).push(fn); }
  function emit(event) { (listeners[event] || []).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }

  /** قراءة خاصية من بيانات القطعة عبر الأسماء البديلة */
  function getProp(feature, key) {
    // تعديلات المستخدم على البيانات الأساسية (رقم القطعة، الشارع...) لها الأولوية على قيم الملف
    const edit = state.edits[feature.id];
    if (edit && edit.props && edit.props[key]) return edit.props[key];
    const aliases = FIELD_ALIASES[key] || [key];
    for (const a of aliases) {
      const v = feature.properties && feature.properties[a];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return '';
  }

  function sizeCategoryOf(areaM2) {
    if (areaM2 < SIZE_CATS.small.max) return 'small';
    if (areaM2 < SIZE_CATS.medium.max) return 'medium';
    return 'large';
  }

  /** الاسم المعروض للقطعة: الاسم المخصص ثم رقم القطعة ثم المعرف */
  function displayName(id) {
    const edit = state.edits[id];
    if (edit && edit.customName) return edit.customName;
    const f = getFeature(id);
    if (!f) return id;
    const parcel = getProp(f, 'parcelNo');
    if (parcel) return 'قطعة ' + parcel;
    if (f.properties._kmlName) return f.properties._kmlName;
    return 'أرض ' + id;
  }

  function getFeature(id) {
    return state.features.find((f) => f.id === id) || null;
  }

  /** حساب المساحات والمراكز على دفعات حتى لا تتجمد الواجهة */
  async function computeMetrics(onProgress) {
    const CHUNK = 80;
    state.metrics = {};
    for (let i = 0; i < state.features.length; i += CHUNK) {
      const end = Math.min(i + CHUNK, state.features.length);
      for (let j = i; j < end; j++) {
        const f = state.features[j];
        const m = DistanceAnalysis.landMetrics(f);
        state.metrics[f.id] = {
          areaM2: m.areaM2,
          perimeterM: m.perimeterM,
          center: DistanceAnalysis.landCenter(f),
          sizeCat: sizeCategoryOf(m.areaM2),
        };
      }
      if (onProgress) onProgress(end, state.features.length);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  /** تحميل الحالة من IndexedDB — وإن لم توجد بيانات مستوردة تستخدم البيانات المدمجة */
  async function init(onProgress) {
    const [dataset, meta, edits, sections, settings] = await Promise.all([
      Storage2.get('dataset'),
      Storage2.get('datasetMeta'),
      Storage2.get('edits'),
      Storage2.get('sections'),
      Storage2.get('settings'),
    ]);

    if (dataset && dataset.features && dataset.features.length) {
      state.features = dataset.features;
      state.datasetMeta = meta;
    } else if (window.DEFAULT_LANDS_GEOJSON) {
      // البيانات المدمجة (ملف أمانة المدينة المنورة)
      state.features = window.DEFAULT_LANDS_GEOJSON.features;
      state.datasetMeta = {
        fileName: 'الاراضى التابعة لامانة المدينة المنورة.kmz (مدمج)',
        importedAt: null,
        count: state.features.length,
      };
    }

    if (edits) state.edits = edits;
    if (sections) state.sections = sections;
    if (settings) state.settings = { ...state.settings, ...settings, catColors: { ...DEFAULT_COLORS, ...(settings.catColors || {}) } };

    await Landmarks.load();
    await computeMetrics(onProgress);
    state.ready = true;
    emit('dataset');
  }

  /** استيراد بيانات جديدة من ملف KML/KMZ — تستبدل مجموعة البيانات الحالية */
  async function importDataset(geojson, fileName, onProgress) {
    state.features = geojson.features;
    state.datasetMeta = { fileName, importedAt: new Date().toISOString(), count: geojson.features.length };
    await Storage2.set('dataset', geojson);
    await Storage2.set('datasetMeta', state.datasetMeta);
    await computeMetrics(onProgress);
    emit('dataset');
  }

  /* حفظ فوري (غير مؤجل) — لا يضيع أي تعديل حتى لو أُغلقت الصفحة مباشرة بعده */
  function persistEdits() {
    Storage2.set('edits', state.edits).catch((e) => console.error('edits persist failed:', e));
  }
  function persistSections() {
    Storage2.set('sections', state.sections).catch((e) => console.error('sections persist failed:', e));
  }

  /* مزامنة الإعدادات (منها فلاتر فئات المعالم) بين الصفحات والتبويبات فورياً */
  const settingsListeners = [];
  let settingsChannel = null;
  try {
    settingsChannel = new BroadcastChannel('medina-lands-settings');
    settingsChannel.onmessage = async (ev) => {
      if (ev.data && ev.data.type === 'changed') {
        const s = await Storage2.get('settings');
        if (s) Object.assign(state.settings, s);
        settingsListeners.forEach((cb) => { try { cb(); } catch (e) { /* تجاهل */ } });
      }
    };
  } catch (e) { /* متصفح قديم — تبقى المزامنة عند إعادة التحميل */ }

  /** تسجيل دالة تُستدعى عند تغيّر الإعدادات من صفحة أخرى */
  function onSettingsChanged(cb) { settingsListeners.push(cb); }

  function persistSettings() {
    // حفظ فوري ثم بث للتبويبات الأخرى
    Storage2.set('settings', state.settings)
      .then(() => { if (settingsChannel) settingsChannel.postMessage({ type: 'changed' }); })
      .catch((e) => console.error('settings persist failed:', e));
  }

  /**
   * حفظ شامل فوري لكل بيانات النظام دفعة واحدة:
   * تعديلات القطع (الأسماء، رقم القطعة، الشارع، معالم التركيز...)، الأقسام، الإعدادات
   * يُستدعى من زر «حفظ الكل» — والحفظ التلقائي يعمل مع كل تعديل على أي حال
   */
  async function saveAllNow() {
    await Promise.all([
      Storage2.set('edits', state.edits),
      Storage2.set('sections', state.sections),
      Storage2.set('settings', state.settings),
    ]);
  }

  /* ================= التعديلات على القطع ================= */

  function getEdit(id) { return state.edits[id] || {}; }

  function setEdit(id, changes) {
    state.edits[id] = { ...(state.edits[id] || {}), ...changes };
    persistEdits();
    emit('change');
  }

  /** حذف تعديلات المستخدم واستعادة البيانات الأصلية للقطعة */
  function resetEdit(id) {
    delete state.edits[id];
    persistEdits();
    emit('change');
  }

  /* ================= الأقسام المخصصة ================= */

  const SECTION_COLORS = ['#0e7a4f', '#1d4ed8', '#b45309', '#7c3aed', '#be123c', '#0e7490', '#4d7c0f', '#a21caf'];

  function createSection(name) {
    const section = {
      id: 'sec-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      name: name || 'قسم جديد',
      color: SECTION_COLORS[state.sections.length % SECTION_COLORS.length],
      createdAt: new Date().toISOString(),
      items: [],
    };
    state.sections.push(section);
    persistSections();
    emit('change');
    return section;
  }

  function renameSection(id, name) {
    const s = state.sections.find((x) => x.id === id);
    if (s) { s.name = name; persistSections(); emit('change'); }
  }

  function deleteSection(id) {
    state.sections = state.sections.filter((x) => x.id !== id);
    persistSections();
    emit('change');
  }

  function getSection(id) { return state.sections.find((x) => x.id === id) || null; }

  /** نسخ قطعة (أو قطع) إلى قسم — دون حذفها من تصنيفها أو من أقسام أخرى */
  function addToSection(sectionId, landIds) {
    const s = getSection(sectionId);
    if (!s) return 0;
    let added = 0;
    (Array.isArray(landIds) ? landIds : [landIds]).forEach((landId) => {
      if (!s.items.some((it) => it.landId === landId)) {
        s.items.push({ landId, customName: '' });
        added++;
      }
    });
    persistSections();
    emit('change');
    return added;
  }

  /** إزالة قطعة من قسم دون حذفها من الخريطة */
  function removeFromSection(sectionId, landId) {
    const s = getSection(sectionId);
    if (!s) return;
    s.items = s.items.filter((it) => it.landId !== landId);
    persistSections();
    emit('change');
  }

  /** إعادة تسمية القطعة داخل قسم معين باسم مخصص */
  function renameInSection(sectionId, landId, customName) {
    const s = getSection(sectionId);
    if (!s) return;
    const it = s.items.find((x) => x.landId === landId);
    if (it) { it.customName = customName; persistSections(); emit('change'); }
  }

  /** الأقسام التي تنتمي إليها قطعة */
  function sectionsOfLand(landId) {
    return state.sections.filter((s) => s.items.some((it) => it.landId === landId));
  }

  /** إحصاءات قسم: عدد القطع وإجمالي المساحة */
  function sectionStats(sectionId) {
    const s = getSection(sectionId);
    if (!s) return { count: 0, totalArea: 0 };
    let totalArea = 0;
    s.items.forEach((it) => {
      const m = state.metrics[it.landId];
      if (m) totalArea += m.areaM2;
    });
    return { count: s.items.length, totalArea };
  }

  /* ================= الفلاتر ================= */

  const emptyFilters = () => ({
    sizeCats: [],          // ['small','medium','large']
    areaMin: null,
    areaMax: null,
    name: '',
    parcelNo: '',
    district: '',
    sectionId: '',
    status: '',
    priority: '',
    nearLandmarkId: '',
    nearDistanceKm: null,
    selectedOnly: false,
    unsectionedOnly: false,
  });

  let filters = emptyFilters();
  let selectedIds = new Set();

  function getFilters() { return filters; }
  function setFilters(changes) { filters = { ...filters, ...changes }; emit('change'); }
  function resetFilters() { filters = emptyFilters(); emit('change'); }

  function getSelected() { return selectedIds; }
  function setSelected(ids) { selectedIds = new Set(ids); emit('change'); }
  function toggleSelected(id) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    emit('change');
  }
  function clearSelected() { selectedIds.clear(); emit('change'); }

  /** تطبيق الفلاتر وإرجاع القطع المطابقة */
  function filteredFeatures() {
    const f = filters;
    let nearLm = null;
    if (f.nearLandmarkId && f.nearDistanceKm) nearLm = Landmarks.getById(f.nearLandmarkId);

    return state.features.filter((feat) => {
      const m = state.metrics[feat.id];
      if (!m) return false;
      const edit = state.edits[feat.id] || {};

      if (f.sizeCats.length && !f.sizeCats.includes(m.sizeCat)) return false;
      if (f.areaMin !== null && m.areaM2 < f.areaMin) return false;
      if (f.areaMax !== null && m.areaM2 > f.areaMax) return false;

      if (f.name) {
        const name = displayName(feat.id);
        if (!name.includes(f.name)) return false;
      }
      if (f.parcelNo) {
        const p = String(getProp(feat, 'parcelNo'));
        if (!p.includes(f.parcelNo)) return false;
      }
      if (f.district) {
        const d = String(getProp(feat, 'district')) + ' ' + String(getProp(feat, 'street'));
        if (!d.includes(f.district)) return false;
      }
      if (f.sectionId) {
        const s = getSection(f.sectionId);
        if (!s || !s.items.some((it) => it.landId === feat.id)) return false;
      }
      if (f.status && edit.status !== f.status) return false;
      if (f.priority && edit.priority !== f.priority) return false;

      if (nearLm) {
        const d = DistanceAnalysis.distanceToLandmark(m.center, nearLm);
        if (d.km > f.nearDistanceKm) return false;
      }

      if (f.selectedOnly && !selectedIds.has(feat.id)) return false;
      if (f.unsectionedOnly && sectionsOfLand(feat.id).length > 0) return false;

      return true;
    });
  }

  /* ================= الإحصاءات ================= */

  function stats(features) {
    const feats = features || state.features;
    const counts = { small: 0, medium: 0, large: 0 };
    let totalArea = 0;
    let largest = null;
    let smallest = null;
    feats.forEach((f) => {
      const m = state.metrics[f.id];
      if (!m) return;
      counts[m.sizeCat]++;
      totalArea += m.areaM2;
      if (!largest || m.areaM2 > state.metrics[largest].areaM2) largest = f.id;
      if (!smallest || m.areaM2 < state.metrics[smallest].areaM2) smallest = f.id;
    });
    return {
      total: feats.length,
      totalArea,
      counts,
      avgArea: feats.length ? totalArea / feats.length : 0,
      largest,
      smallest,
      sectionsCount: state.sections.length,
    };
  }

  /* ================= صفوف التصدير ================= */

  function landToRow(id) {
    const f = getFeature(id);
    const m = state.metrics[id] || {};
    const edit = state.edits[id] || {};
    if (!f) return null;
    return {
      'الاسم': displayName(id),
      'رقم القطعة': getProp(f, 'parcelNo'),
      'المساحة (م²)': Math.round(m.areaM2 || 0),
      'المساحة (هكتار)': +((m.areaM2 || 0) / 10000).toFixed(2),
      'التصنيف': SIZE_CATS[m.sizeCat] ? SIZE_CATS[m.sizeCat].name : '',
      'المحيط (م)': Math.round(m.perimeterM || 0),
      'الشارع': getProp(f, 'street'),
      'رقم الصك': getProp(f, 'deed'),
      'رقم المخطط': getProp(f, 'plan'),
      'الحالة': edit.status || '',
      'الأولوية': edit.priority || '',
      'الملاحظات': edit.notes || '',
      'الأقسام': sectionsOfLand(id).map((s) => s.name).join('، '),
      'خط العرض': m.center ? +m.center[1].toFixed(6) : '',
      'خط الطول': m.center ? +m.center[0].toFixed(6) : '',
    };
  }

  /** FeatureCollection لقطع محددة (مع دمج التعديلات في الخصائص) */
  function toFeatureCollection(ids) {
    const features = ids
      .map((id) => {
        const f = getFeature(id);
        if (!f) return null;
        const m = state.metrics[id] || {};
        const edit = state.edits[id] || {};
        return {
          ...f,
          properties: {
            ...f.properties,
            _customName: edit.customName || '',
            _areaM2: Math.round(m.areaM2 || 0),
            _status: edit.status || '',
            _priority: edit.priority || '',
            _notes: edit.notes || '',
            name: displayName(id),
          },
        };
      })
      .filter(Boolean);
    return { type: 'FeatureCollection', name: 'أراضي مصدّرة', features };
  }

  window.LandManager = {
    SIZE_CATS,
    DEFAULT_COLORS,
    STATUS_OPTIONS,
    PRIORITY_OPTIONS,
    state,
    on,
    emit,
    init,
    importDataset,
    getProp,
    getFeature,
    displayName,
    getEdit,
    setEdit,
    resetEdit,
    createSection,
    renameSection,
    deleteSection,
    getSection,
    addToSection,
    removeFromSection,
    renameInSection,
    sectionsOfLand,
    sectionStats,
    getFilters,
    setFilters,
    resetFilters,
    filteredFeatures,
    getSelected,
    setSelected,
    toggleSelected,
    clearSelected,
    stats,
    landToRow,
    toFeatureCollection,
    persistSettings,
    onSettingsChanged,
    saveAllNow,
  };
})();
