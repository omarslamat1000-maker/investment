/**
 * app.js — منطق الصفحة الرئيسية (الخريطة)
 * يربط: الخريطة، لوحة المعلومات، الفلاتر، الأقسام، بطاقة الأرض، الأدوات
 */
(function () {
  'use strict';

  let mapApi = null;
  let sizeChart = null;
  let sectionsChart = null;
  let multiSelectMode = false;
  let landsListLimit = 200;

  const KEY_LANDMARKS = ['bl-prophet-mosque', 'bl-airport', 'bl-hhr-station']; // للمسافات في البطاقة

  /* ================== الإقلاع ================== */
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    await UI.initTheme();
    UI.showProgress('جارٍ تحميل بيانات الأراضي...');
    try {
      await LandManager.init((done, total) => UI.updateProgress(done, total, 'جارٍ حساب المساحات... (' + done + '/' + total + ')'));
    } catch (e) {
      console.error(e);
      UI.toast('خطأ في تحميل البيانات: ' + e.message, 'error');
    }
    UI.hideProgress();

    mapApi = MapFactory.createMap('map', { basemap: LandManager.state.settings.basemap });
    mapApi.onLandClick = onLandClick;

    buildBasemapMenu();
    buildFiltersPane();
    buildSectionsPane();
    renderAll();
    mapApi.fitAllLands();
    wireHeader();
    wireTools();
    wireSearch();
    wireSidebar();
    wireMultiBar();

    LandManager.on('change', renderAll);

    // فتح أرض من رابط (مثل ?land=ID_00001)
    const params = new URLSearchParams(location.search);
    const landId = params.get('land');
    if (landId && LandManager.getFeature(landId)) {
      mapApi.zoomToLand(landId);
      openDrawer(landId);
    }

    if (LandManager.state.features.length) {
      UI.toast('تم تحميل ' + UI.fmtNum(LandManager.state.features.length) + ' قطعة أرض', 'success');
    }

    // مزامنة فورية: تعديلات المعالم من صفحة أخرى تنعكس هنا مباشرة
    Landmarks.onChanged(() => { renderAll(); refreshLandmarkFilterOptions(); });
    // مزامنة فلاتر فئات المعالم المعدلة في صفحتي التحليل وإدارة المعالم
    LandManager.onSettingsChanged(() => renderAll());

    // منفذ للتشخيص والاختبار من وحدة التحكم
    window.AppPage = { mapApi, openDrawer, renderAll, printLandsBatch };
  }

  /** تحديث خيارات فلتر «القرب من معلم» بعد تغيّر المعالم مع الحفاظ على الاختيار الحالي */
  function refreshLandmarkFilterOptions() {
    const sel = document.getElementById('fltLandmark');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— بدون —</option>' +
      Landmarks.getAll({ includeHidden: false })
        .map((lm) => `<option value="${lm.id}" ${lm.id === current ? 'selected' : ''}>${UI.escapeHtml(lm.name)}</option>`)
        .join('');
  }

  /** إعادة عرض كل شيء (بعد فلترة/تعديل) */
  function renderAll() {
    const filtered = LandManager.filteredFeatures();
    mapApi.renderLands(filtered);
    mapApi.setSelectedIds(LandManager.getSelected());
    mapApi.renderLandmarks({
      hiddenCats: LandManager.state.settings.hiddenLandmarkCats,
      onClick: onLandmarkClick,
    });
    mapApi.setLandmarksVisible(LandManager.state.settings.landmarksVisible !== false);
    renderLegend(filtered);
    renderDashboard(filtered);
    renderSections();
    renderLandsList(filtered);
    updateMultiBar();
  }

  /* ================== الشريط العلوي ================== */
  function wireHeader() {
    document.getElementById('btnUpload').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', onFileSelected);
    document.getElementById('btnBackup').addEventListener('click', openSettingsModal);
  }

  /** استيراد ملف أو عدة ملفات دفعة واحدة — أراضٍ (مضلعات مدموجة) أو معالم حسب اختيار المستخدم */
  async function onFileSelected(e) {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;

    // نافذة الخيارات: أرض أم معلم؟ + التصنيف والنوع الهندسي للمعالم
    const opts = await UI.askImportOptions('lands', files.length);
    if (!opts) return;

    if (opts.kind === 'landmarks') {
      // استيراد كمعالم بالخيارات المحددة
      let total = 0;
      const errors = [];
      for (const file of files) {
        try {
          const list = Landmarks.applyImportOverrides(await Landmarks.parseImportFile(file), opts);
          const count = Landmarks.importMany(list);
          if (!count) throw new Error('لا معالم صالحة');
          total += count;
        } catch (err) {
          errors.push(file.name + ': ' + err.message);
        }
      }
      renderAll();
      refreshLandmarkFilterOptions();
      if (total) UI.toast('تم استيراد ' + total + ' معلماً من ' + files.length + ' ملف', 'success');
      if (errors.length) UI.toast('تعذر استيراد: ' + errors.join(' — '), 'error', 6000);
      return;
    }

    UI.showProgress('جارٍ قراءة ' + (files.length > 1 ? files.length + ' ملفات' : 'الملف: ' + files[0].name));
    try {
      const allFeatures = [];
      const seenIds = new Set();
      let totalSkipped = 0;
      const errors = [];
      for (let fi = 0; fi < files.length; fi++) {
        const file = files[fi];
        try {
          const { geojson, skipped } = await KMLParser.parseFile(file, (d, t) =>
            UI.updateProgress(d, t, 'ملف ' + (fi + 1) + '/' + files.length + ' — جارٍ تحليل العناصر... (' + d + '/' + t + ')'));
          totalSkipped += skipped;
          geojson.features.forEach((f) => {
            if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') return;
            // ضمان معرّف فريد عند دمج أكثر من ملف
            let id = f.id || 'PM_' + allFeatures.length;
            if (seenIds.has(id)) id = id + '-f' + (fi + 1);
            seenIds.add(id);
            allFeatures.push({ ...f, id });
          });
        } catch (err) {
          errors.push(file.name + ': ' + (err.message || 'فشل التحليل'));
        }
      }
      if (!allFeatures.length) throw new Error(errors.length ? errors.join(' — ') : 'لا توجد مضلعات أراضٍ في الملفات المختارة');
      UI.updateProgress(0, 1, 'جارٍ حساب المساحات...');
      const dsName = files.length > 1 ? files.map((f) => f.name).join(' + ') : files[0].name;
      await LandManager.importDataset(
        { type: 'FeatureCollection', name: dsName, features: allFeatures },
        dsName,
        (d, t) => UI.updateProgress(d, t, 'جارٍ حساب المساحات... (' + d + '/' + t + ')')
      );
      renderAll();
      mapApi.fitAllLands();
      UI.toast('تم استيراد ' + UI.fmtNum(allFeatures.length) + ' قطعة أرض من ' + files.length + ' ملف' +
        (totalSkipped ? ' (تم تجاهل ' + totalSkipped + ' عنصراً غير صالح)' : ''), 'success');
      if (errors.length) UI.toast('ملفات لم تُستورد: ' + errors.join(' — '), 'error', 6000);
    } catch (err) {
      console.error(err);
      UI.toast(err.message || 'فشل استيراد الملفات', 'error', 5000);
    }
    UI.hideProgress();
  }

  /* ================== الإعدادات والنسخ الاحتياطي ================== */
  function openSettingsModal() {
    const c = LandManager.state.settings.catColors;
    UI.openModal({
      title: 'الإعدادات والنسخ الاحتياطي',
      icon: 'fa-gear',
      wide: true,
      bodyHTML: `
        <h4 style="color:var(--primary);margin-bottom:8px"><i class="fa-solid fa-palette"></i> ألوان تصنيفات المساحة</h4>
        <div class="field-row">
          <div class="field"><label>${LandManager.SIZE_CATS.small.name}</label><input type="color" id="colSmall" value="${c.small}" style="height:40px;padding:3px"></div>
          <div class="field"><label>${LandManager.SIZE_CATS.medium.name}</label><input type="color" id="colMedium" value="${c.medium}" style="height:40px;padding:3px"></div>
          <div class="field"><label>${LandManager.SIZE_CATS.large.name}</label><input type="color" id="colLarge" value="${c.large}" style="height:40px;padding:3px"></div>
        </div>
        <h4 style="color:var(--primary);margin:14px 0 8px"><i class="fa-solid fa-database"></i> النسخ الاحتياطي</h4>
        <div class="btn-group">
          <button class="btn" id="btnExportBackup"><i class="fa-solid fa-download"></i> إنشاء نسخة احتياطية (JSON)</button>
          <button class="btn" id="btnImportBackup"><i class="fa-solid fa-upload"></i> استعادة نسخة احتياطية</button>
          <input type="file" id="backupFile" accept=".json" hidden>
        </div>
        <h4 style="color:var(--danger);margin:14px 0 8px"><i class="fa-solid fa-trash"></i> منطقة الخطر</h4>
        <button class="btn danger" id="btnResetAll"><i class="fa-solid fa-rotate-left"></i> مسح جميع البيانات والعودة للافتراضي</button>
      `,
      buttons: [
        {
          label: 'حفظ الألوان', class: 'primary', icon: 'fa-check',
          value: () => {
            LandManager.state.settings.catColors = {
              small: document.getElementById('colSmall').value,
              medium: document.getElementById('colMedium').value,
              large: document.getElementById('colLarge').value,
            };
            LandManager.persistSettings();
            renderAll();
            UI.toast('تم حفظ الألوان');
            return true;
          },
        },
        { label: 'إغلاق', value: null },
      ],
      onOpen: (body) => {
        body.querySelector('#btnExportBackup').onclick = async () => {
          const backup = await Storage2.exportBackup();
          ExportUtils.downloadText(JSON.stringify(backup), 'نسخة-احتياطية-أراضي-المدينة-' + new Date().toISOString().slice(0, 10) + '.json', 'application/json');
          UI.toast('تم إنشاء النسخة الاحتياطية');
        };
        body.querySelector('#btnImportBackup').onclick = () => body.querySelector('#backupFile').click();
        body.querySelector('#backupFile').onchange = async (ev) => {
          const f = ev.target.files[0];
          if (!f) return;
          try {
            const backup = JSON.parse(await f.text());
            await Storage2.importBackup(backup);
            UI.toast('تمت الاستعادة — جارٍ إعادة التحميل');
            setTimeout(() => location.reload(), 800);
          } catch (err) {
            UI.toast('فشل الاستعادة: ' + err.message, 'error', 5000);
          }
        };
        body.querySelector('#btnResetAll').onclick = async () => {
          UI.closeModal(null);
          const ok = await UI.confirmModal('مسح جميع البيانات', 'سيتم حذف كل البيانات المحفوظة (الأقسام، التعديلات، المعالم المخصصة) والعودة للبيانات المدمجة. هل أنت متأكد؟', 'نعم، امسح الكل');
          if (ok) {
            await Storage2.clearAll();
            location.reload();
          }
        };
      },
    });
  }

  /* ================== قائمة خرائط الأساس ================== */
  function buildBasemapMenu() {
    const menu = document.getElementById('basemapMenu');
    menu.innerHTML = '';
    Object.entries(MapFactory.BASEMAPS).forEach(([key, bm]) => {
      const btn = document.createElement('button');
      btn.textContent = bm.name;
      btn.className = key === mapApi.getBasemapKey() ? 'active' : '';
      btn.onclick = () => {
        mapApi.setBasemap(key);
        LandManager.state.settings.basemap = key;
        LandManager.persistSettings();
        menu.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        menu.classList.remove('open');
      };
      menu.appendChild(btn);
    });
  }

  /* ================== أدوات الخريطة ================== */
  function wireTools() {
    const tools = document.getElementById('mapTools');
    tools.addEventListener('click', (e) => {
      const btn = e.target.closest('.map-tool-btn');
      if (!btn) return;
      const tool = btn.dataset.tool;
      const basemapMenu = document.getElementById('basemapMenu');
      if (tool !== 'basemap') basemapMenu.classList.remove('open');

      switch (tool) {
        case 'fullscreen': mapApi.toggleFullscreen(); break;
        case 'locate': mapApi.locateMe((msg) => UI.toast(msg, 'error')); break;
        case 'fitAll': mapApi.fitAllLands(); break;
        case 'basemap': basemapMenu.classList.toggle('open'); break;
        case 'landmarks': {
          const v = LandManager.state.settings.landmarksVisible !== false;
          LandManager.state.settings.landmarksVisible = !v;
          LandManager.persistSettings();
          mapApi.setLandmarksVisible(!v);
          UI.toast(!v ? 'تم إظهار المعالم' : 'تم إخفاء المعالم');
          break;
        }
        case 'measureDist': mapApi.startMeasure('distance'); UI.toast('انقر على الخريطة لقياس المسافة، ونقراً مزدوجاً للإنهاء', 'warn', 4000); break;
        case 'measureArea': mapApi.startMeasure('area'); UI.toast('انقر لرسم المضلع، ونقراً مزدوجاً للإنهاء', 'warn', 4000); break;
        case 'drawPoint': mapApi.startMeasure('point'); UI.toast('انقر لوضع نقطة', 'warn'); break;
        case 'drawLine': mapApi.startMeasure('line'); UI.toast('انقر لرسم خط، ونقراً مزدوجاً للإنهاء', 'warn', 4000); break;
        case 'drawPolygon': mapApi.startMeasure('polygon'); UI.toast('انقر لرسم مضلع، ونقراً مزدوجاً للإنهاء', 'warn', 4000); break;
        case 'clearDraw': mapApi.clearMeasurements(); UI.toast('تم مسح الرسومات والقياسات'); break;
        case 'multiSelect': toggleMultiSelect(btn); break;
        case 'screenshot': mapApi.screenshot(); break;
        case 'print': printMapReport(); break;
      }
    });
  }

  function printMapReport() {
    const filtered = LandManager.filteredFeatures();
    const stats = LandManager.stats(filtered);
    ExportUtils.openPrintPage({
      type: 'summary',
      stats: {
        total: stats.total,
        totalArea: stats.totalArea,
        counts: stats.counts,
        avgArea: stats.avgArea,
        sectionsCount: LandManager.state.sections.length,
      },
      rows: filtered.slice(0, 500).map((f) => LandManager.landToRow(f.id)),
      title: 'تقرير أراضي أمانة المدينة المنورة',
    });
  }

  /* ================== التحديد المتعدد ================== */
  function toggleMultiSelect(btn) {
    multiSelectMode = !multiSelectMode;
    btn.classList.toggle('active', multiSelectMode);
    if (!multiSelectMode) LandManager.clearSelected();
    UI.toast(multiSelectMode ? 'وضع التحديد المتعدد مفعّل — انقر على الأراضي لتحديدها' : 'تم إيقاف التحديد المتعدد', 'warn');
    updateMultiBar();
  }

  function updateMultiBar() {
    const bar = document.getElementById('multiBar');
    const count = LandManager.getSelected().size;
    bar.classList.toggle('open', multiSelectMode || count > 0);
    document.getElementById('multiCount').textContent = count;
  }

  function wireMultiBar() {
    document.getElementById('btnMultiClear').onclick = () => LandManager.clearSelected();
    document.getElementById('btnMultiExport').onclick = () => {
      const ids = [...LandManager.getSelected()];
      if (!ids.length) return UI.toast('لا توجد أراضٍ محددة', 'warn');
      exportLandsMenu(ids, 'الأراضي المحددة');
    };
    document.getElementById('btnMultiCopy').onclick = async () => {
      const ids = [...LandManager.getSelected()];
      if (!ids.length) return UI.toast('لا توجد أراضٍ محددة', 'warn');
      const secId = await pickSectionModal();
      if (secId) {
        const added = LandManager.addToSection(secId, ids);
        UI.toast('تم نسخ ' + added + ' قطعة إلى القسم');
      }
    };
    document.getElementById('btnMultiPrint').onclick = () => {
      const ids = [...LandManager.getSelected()];
      if (!ids.length) return UI.toast('لا توجد أراضٍ محددة — فعّل التحديد المتعدد وانقر على الأراضي', 'warn');
      printLandsBatch(ids, 'تقرير الأراضي المحددة (' + ids.length + ' موقع)');
    };
  }

  /** نافذة اختيار قسم (مع إمكانية إنشاء قسم جديد) */
  async function pickSectionModal() {
    const sections = LandManager.state.sections;
    const options = sections.map((s) => '<option value="' + s.id + '">' + UI.escapeHtml(s.name) + '</option>').join('');
    return UI.openModal({
      title: 'نسخ إلى قسم',
      icon: 'fa-folder-plus',
      bodyHTML: `
        <div class="field"><label>اختر القسم</label>
          <select id="pickSection">${options}<option value="__new__">+ إنشاء قسم جديد...</option></select>
        </div>
        <div class="field" id="newSecWrap" style="display:${sections.length ? 'none' : 'block'}">
          <label>اسم القسم الجديد</label><input type="text" id="newSecName" placeholder="مثال: أراضي استثمارية">
        </div>`,
      buttons: [
        {
          label: 'نسخ', class: 'primary', icon: 'fa-copy',
          value: () => {
            const sel = document.getElementById('pickSection').value;
            if (sel === '__new__' || !sel) {
              const name = document.getElementById('newSecName').value.trim();
              if (!name) return null;
              return LandManager.createSection(name).id;
            }
            return sel;
          },
        },
        { label: 'إلغاء', value: null },
      ],
      onOpen: (body) => {
        const sel = body.querySelector('#pickSection');
        if (!sections.length) sel.value = '__new__';
        sel.onchange = () => {
          body.querySelector('#newSecWrap').style.display = sel.value === '__new__' ? 'block' : 'none';
        };
      },
    });
  }

  /** قائمة تصدير مجموعة أراضٍ */
  function exportLandsMenu(ids, title) {
    UI.openModal({
      title: 'تصدير: ' + title,
      icon: 'fa-file-export',
      bodyHTML: '<p>اختر صيغة التصدير لعدد ' + ids.length + ' قطعة أرض:</p>',
      buttons: [
        {
          label: 'Excel', icon: 'fa-file-excel', class: 'primary',
          value: () => { ExportUtils.toExcel(ids.map((id) => LandManager.landToRow(id)).filter(Boolean), title + '.xlsx', 'الأراضي'); return true; },
        },
        {
          label: 'GeoJSON', icon: 'fa-code',
          value: () => { ExportUtils.toGeoJSONFile(LandManager.toFeatureCollection(ids), title + '.geojson'); return true; },
        },
        {
          label: 'KML', icon: 'fa-earth-asia',
          value: () => { ExportUtils.toKMLFile(LandManager.toFeatureCollection(ids), title + '.kml', title); return true; },
        },
        { label: 'إلغاء', value: null },
      ],
    });
  }

  /* ================== البحث الجغرافي ================== */
  function wireSearch() {
    const input = document.getElementById('searchInput');
    const results = document.getElementById('searchResults');
    const doSearch = async () => {
      const q = input.value.trim();
      if (!q) return;
      // البحث أولاً في الأراضي والمعالم محلياً
      const local = [];
      LandManager.state.features.forEach((f) => {
        const name = LandManager.displayName(f.id);
        const parcel = String(LandManager.getProp(f, 'parcelNo'));
        if (name.includes(q) || parcel.includes(q)) local.push({ type: 'land', id: f.id, label: name + (parcel ? ' — ' + parcel : '') });
      });
      Landmarks.getAll({ includeHidden: false }).forEach((lm) => {
        if (lm.name.includes(q)) local.push({ type: 'landmark', id: lm.id, label: lm.name });
      });

      results.innerHTML = '';
      local.slice(0, 5).forEach((r) => {
        const div = document.createElement('div');
        div.className = 'result';
        div.innerHTML = '<i class="fa-solid ' + (r.type === 'land' ? 'fa-vector-square' : 'fa-location-dot') + '" style="color:var(--primary);margin-inline-end:6px"></i>' + UI.escapeHtml(r.label);
        div.onclick = () => {
          results.classList.remove('open');
          if (r.type === 'land') { mapApi.zoomToLand(r.id); openDrawer(r.id); }
          else { const lm = Landmarks.getById(r.id); mapApi.map.setView([lm.lat, lm.lng], 15); }
        };
        results.appendChild(div);
      });

      // ثم البحث الجغرافي عبر الإنترنت
      try {
        const geo = await mapApi.geocode(q);
        geo.forEach((g) => {
          const div = document.createElement('div');
          div.className = 'result';
          div.innerHTML = '<i class="fa-solid fa-globe" style="color:var(--info);margin-inline-end:6px"></i>' + UI.escapeHtml(g.display_name);
          div.onclick = () => {
            results.classList.remove('open');
            mapApi.map.setView([parseFloat(g.lat), parseFloat(g.lon)], 15);
          };
          results.appendChild(div);
        });
      } catch (e) { /* لا إنترنت — نكتفي بالنتائج المحلية */ }

      if (!results.children.length) {
        results.innerHTML = '<div class="result">لا توجد نتائج</div>';
      }
      results.classList.add('open');
    };
    document.getElementById('btnSearch').onclick = doSearch;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.map-search')) results.classList.remove('open');
    });
  }

  /* ================== الشريط الجانبي ================== */
  function wireSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    toggle.onclick = () => {
      sidebar.classList.toggle('collapsed');
      const collapsed = sidebar.classList.contains('collapsed');
      toggle.classList.toggle('shifted', !collapsed);
      toggle.innerHTML = '<i class="fa-solid fa-chevron-' + (collapsed ? 'left' : 'right') + '"></i>';
      setTimeout(() => mapApi.map.invalidateSize(), 300);
    };
    document.querySelectorAll('.sidebar-tabs button').forEach((btn) => {
      btn.onclick = () => {
        document.querySelectorAll('.sidebar-tabs button').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.sidebar-pane').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('pane-' + btn.dataset.pane).classList.add('active');
        // إعادة رسم مخططات اللوحة بعد ظهور التبويب (لا تُقاس أبعادها وهي مخفية)
        if (btn.dataset.pane === 'dashboard') renderDashboard(LandManager.filteredFeatures());
      };
    });
  }

  /* ================== لوحة المعلومات ================== */
  function renderDashboard(filtered) {
    const pane = document.getElementById('pane-dashboard');
    const all = LandManager.stats();
    const st = LandManager.stats(filtered);
    const m = LandManager.state.metrics;

    pane.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card wide"><div class="val">${UI.fmtNum(st.total)} <small style="font-size:12px;color:var(--text-2)">من ${UI.fmtNum(all.total)}</small></div><div class="lbl">قطعة أرض (المعروضة/الكل)</div></div>
        <div class="stat-card"><div class="val">${UI.fmtNum(st.totalArea / 1e6, 2)}</div><div class="lbl">إجمالي المساحة (كم²)</div></div>
        <div class="stat-card"><div class="val">${UI.fmtNum(st.avgArea)}</div><div class="lbl">متوسط المساحة (م²)</div></div>
        <div class="stat-card"><div class="val" style="color:${LandManager.state.settings.catColors.small}">${UI.fmtNum(st.counts.small)}</div><div class="lbl">أقل من 50 ألف م²</div></div>
        <div class="stat-card"><div class="val" style="color:${LandManager.state.settings.catColors.medium}">${UI.fmtNum(st.counts.medium)}</div><div class="lbl">50 – 100 ألف م²</div></div>
        <div class="stat-card"><div class="val" style="color:${LandManager.state.settings.catColors.large}">${UI.fmtNum(st.counts.large)}</div><div class="lbl">أكثر من 100 ألف م²</div></div>
        <div class="stat-card"><div class="val">${UI.fmtNum(LandManager.state.sections.length)}</div><div class="lbl">قسم مخصص</div></div>
      </div>
      ${st.largest ? `
      <div class="stat-row"><span>أكبر قطعة</span><b style="cursor:pointer" data-land="${st.largest}">${UI.escapeHtml(LandManager.displayName(st.largest))} (${UI.fmtNum(m[st.largest].areaM2)} م²)</b></div>
      <div class="stat-row"><span>أصغر قطعة</span><b style="cursor:pointer" data-land="${st.smallest}">${UI.escapeHtml(LandManager.displayName(st.smallest))} (${UI.fmtNum(m[st.smallest].areaM2)} م²)</b></div>` : ''}
      <div class="chart-box"><div class="chart-holder"><canvas id="sizeChart"></canvas></div></div>
      <div class="chart-box"><div class="chart-holder"><canvas id="sectionsChart"></canvas></div></div>
      <p style="font-size:11.5px;color:var(--text-2);margin-top:10px">
        <i class="fa-solid fa-database"></i> مصدر البيانات: ${UI.escapeHtml((LandManager.state.datasetMeta || {}).fileName || 'لا توجد بيانات')}
      </p>
    `;

    pane.querySelectorAll('[data-land]').forEach((el) => {
      el.onclick = () => { mapApi.zoomToLand(el.dataset.land); openDrawer(el.dataset.land); };
    });

    // مخطط توزيع الفئات
    if (typeof Chart !== 'undefined') {
      const colors = LandManager.state.settings.catColors;
      if (sizeChart) sizeChart.destroy();
      sizeChart = new Chart(document.getElementById('sizeChart'), {
        type: 'doughnut',
        data: {
          labels: [LandManager.SIZE_CATS.small.name, LandManager.SIZE_CATS.medium.name, LandManager.SIZE_CATS.large.name],
          datasets: [{ data: [st.counts.small, st.counts.medium, st.counts.large], backgroundColor: [colors.small, colors.medium, colors.large] }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false, // يملأ الحاوية ذات الارتفاع الثابت
          plugins: {
            legend: { position: 'bottom', labels: { font: { family: 'Tajawal' }, boxWidth: 14 } },
            title: { display: true, text: 'توزيع الأراضي حسب فئة المساحة', font: { family: 'Tajawal', size: 13 } },
          },
        },
      });

      // مخطط الأقسام
      if (sectionsChart) sectionsChart.destroy();
      const secs = LandManager.state.sections;
      if (secs.length) {
        sectionsChart = new Chart(document.getElementById('sectionsChart'), {
          type: 'bar',
          data: {
            labels: secs.map((s) => s.name),
            datasets: [{ label: 'عدد الأراضي', data: secs.map((s) => s.items.length), backgroundColor: secs.map((s) => s.color) }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
              legend: { display: false },
              title: { display: true, text: 'توزيع الأراضي حسب الأقسام', font: { family: 'Tajawal', size: 13 } },
            },
            scales: { x: { ticks: { precision: 0 } } },
          },
        });
      } else {
        document.getElementById('sectionsChart').parentElement.innerHTML =
          '<p style="text-align:center;color:var(--text-2);font-size:12.5px;padding:20px">لا توجد أقسام بعد — أنشئ قسماً من تبويب «الأقسام»</p>';
      }
    }
  }

  /* ================== مفتاح الخريطة ================== */
  function renderLegend(filtered) {
    const el = document.getElementById('mapLegend');
    const st = LandManager.stats(filtered);
    const colors = LandManager.state.settings.catColors;
    el.innerHTML = `
      <div class="legend-title"><span><i class="fa-solid fa-list-ul"></i> مفتاح الخريطة</span>
        <button class="icon-btn" id="btnLegendColors" title="تعديل ألوان الفئات" style="width:24px;height:24px;font-size:12px"><i class="fa-solid fa-palette"></i></button>
      </div>
      <div class="legend-item"><span class="legend-swatch" style="background:${colors.small}"></span> ${LandManager.SIZE_CATS.small.name} <span class="cnt">${UI.fmtNum(st.counts.small)}</span></div>
      <div class="legend-item"><span class="legend-swatch" style="background:${colors.medium}"></span> ${LandManager.SIZE_CATS.medium.name} <span class="cnt">${UI.fmtNum(st.counts.medium)}</span></div>
      <div class="legend-item"><span class="legend-swatch" style="background:${colors.large}"></span> ${LandManager.SIZE_CATS.large.name} <span class="cnt">${UI.fmtNum(st.counts.large)}</span></div>
    `;
    // فتح نافذة الإعدادات (تعديل ألوان فئات الأراضي) مباشرة من المفتاح
    el.querySelector('#btnLegendColors').onclick = openSettingsModal;
  }

  /* ================== الفلاتر ================== */
  function buildFiltersPane() {
    const pane = document.getElementById('pane-filters');
    const sectionOpts = () => LandManager.state.sections.map((s) => `<option value="${s.id}">${UI.escapeHtml(s.name)}</option>`).join('');
    const lmOpts = () => Landmarks.getAll({ includeHidden: false }).map((l) => `<option value="${l.id}">${UI.escapeHtml(l.name)}</option>`).join('');

    pane.innerHTML = `
      <div class="field"><label>فئة المساحة</label>
        <div class="chip-row" id="fltSizeCats">
          <span class="chip" data-cat="small">أقل من 50 ألف</span>
          <span class="chip" data-cat="medium">50 – 100 ألف</span>
          <span class="chip" data-cat="large">أكثر من 100 ألف</span>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>أدنى مساحة (م²)</label><input type="number" id="fltAreaMin" min="0" placeholder="0"></div>
        <div class="field"><label>أقصى مساحة (م²)</label><input type="number" id="fltAreaMax" min="0" placeholder="∞"></div>
      </div>
      <div class="field"><label>اسم الأرض</label><input type="text" id="fltName" placeholder="بحث بالاسم..."></div>
      <div class="field"><label>رقم القطعة</label><input type="text" id="fltParcel" placeholder="مثال: 3-41516"></div>
      <div class="field"><label>الحي / الشارع</label><input type="text" id="fltDistrict" placeholder="بحث بالحي أو الشارع..."></div>
      <div class="field"><label>القسم</label><select id="fltSection"><option value="">الكل</option>${sectionOpts()}</select></div>
      <div class="field-row">
        <div class="field"><label>الحالة</label><select id="fltStatus">${LandManager.STATUS_OPTIONS.map((s) => `<option value="${s}">${s || 'الكل'}</option>`).join('')}</select></div>
        <div class="field"><label>الأولوية</label><select id="fltPriority">${LandManager.PRIORITY_OPTIONS.map((s) => `<option value="${s}">${s || 'الكل'}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>القرب من معلم</label><select id="fltLandmark"><option value="">— بدون —</option>${lmOpts()}</select></div>
      <div class="field"><label>نطاق المسافة من المعلم (كم)</label><input type="number" id="fltDistance" min="0" step="0.5" placeholder="مثال: 5"></div>
      <label class="checkbox-line"><input type="checkbox" id="fltSelectedOnly"> إظهار الأراضي المحددة فقط</label>
      <label class="checkbox-line"><input type="checkbox" id="fltUnsectioned"> الأراضي غير المصنفة في أقسام فقط</label>
      <div class="btn-group" style="margin-top:12px">
        <button class="btn primary block" id="btnResetFilters"><i class="fa-solid fa-rotate-left"></i> إعادة ضبط جميع الفلاتر</button>
      </div>
    `;

    // ربط الأحداث — تحديث فوري
    pane.querySelector('#fltSizeCats').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      chip.classList.toggle('active');
      const cats = [...pane.querySelectorAll('.chip.active')].map((c) => c.dataset.cat);
      LandManager.setFilters({ sizeCats: cats });
    });
    const bind = (id, key, transform) => {
      pane.querySelector(id).addEventListener('input', (e) => {
        LandManager.setFilters({ [key]: transform ? transform(e.target.value) : e.target.value });
      });
    };
    bind('#fltAreaMin', 'areaMin', (v) => (v === '' ? null : +v));
    bind('#fltAreaMax', 'areaMax', (v) => (v === '' ? null : +v));
    bind('#fltName', 'name');
    bind('#fltParcel', 'parcelNo');
    bind('#fltDistrict', 'district');
    pane.querySelector('#fltSection').addEventListener('change', (e) => LandManager.setFilters({ sectionId: e.target.value }));
    pane.querySelector('#fltStatus').addEventListener('change', (e) => LandManager.setFilters({ status: e.target.value }));
    pane.querySelector('#fltPriority').addEventListener('change', (e) => LandManager.setFilters({ priority: e.target.value }));
    pane.querySelector('#fltLandmark').addEventListener('change', (e) => LandManager.setFilters({ nearLandmarkId: e.target.value }));
    bind('#fltDistance', 'nearDistanceKm', (v) => (v === '' ? null : +v));
    pane.querySelector('#fltSelectedOnly').addEventListener('change', (e) => LandManager.setFilters({ selectedOnly: e.target.checked }));
    pane.querySelector('#fltUnsectioned').addEventListener('change', (e) => LandManager.setFilters({ unsectionedOnly: e.target.checked }));
    pane.querySelector('#btnResetFilters').addEventListener('click', () => {
      LandManager.resetFilters();
      buildFiltersPane(); // إعادة بناء الحقول فارغة
      UI.toast('تمت إعادة ضبط الفلاتر');
    });
  }

  /* ================== الأقسام ================== */
  function buildSectionsPane() {
    const pane = document.getElementById('pane-sections');
    pane.innerHTML = `
      <button class="btn primary block" id="btnNewSection"><i class="fa-solid fa-folder-plus"></i> إنشاء قسم جديد</button>
      <p style="font-size:11.5px;color:var(--text-2);margin:8px 0">أمثلة: أراضي استثمارية، أراضي تحت الدراسة، أراضي مقترحة للمشاريع، أراضي ذات أولوية، أراضي تحتاج تحقق ميداني</p>
      <div id="sectionsList"></div>
    `;
    pane.querySelector('#btnNewSection').onclick = async () => {
      const name = await UI.promptModal('إنشاء قسم جديد', 'اسم القسم', '', 'مثال: أراضي استثمارية');
      if (name) { LandManager.createSection(name); UI.toast('تم إنشاء القسم: ' + name); }
    };
    renderSections();
  }

  function renderSections() {
    const list = document.getElementById('sectionsList');
    if (!list) return;
    const secs = LandManager.state.sections;
    if (!secs.length) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-2);padding:20px;font-size:13px">لا توجد أقسام بعد</p>';
      return;
    }
    list.innerHTML = '';
    secs.forEach((s) => {
      const st = LandManager.sectionStats(s.id);
      const card = document.createElement('div');
      card.className = 'section-card';
      card.innerHTML = `
        <div class="sec-head">
          <span class="sec-color" style="background:${s.color}"></span>
          <span class="sec-name">${UI.escapeHtml(s.name)}</span>
          <button class="icon-btn" data-act="rename" title="إعادة تسمية"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn danger" data-act="delete" title="حذف القسم"><i class="fa-solid fa-trash"></i></button>
        </div>
        <div class="sec-meta">${UI.fmtNum(st.count)} قطعة — إجمالي ${UI.fmtNum(st.totalArea)} م² (${UI.fmtNum(st.totalArea / 10000, 1)} هكتار)</div>
        <div class="sec-actions">
          <button class="btn sm" data-act="show"><i class="fa-solid fa-eye"></i> عرض على الخريطة</button>
          <button class="btn sm" data-act="export"><i class="fa-solid fa-file-export"></i> تصدير</button>
          <button class="btn sm" data-act="print"><i class="fa-solid fa-print"></i> طباعة PDF</button>
          <button class="btn sm" data-act="toggle"><i class="fa-solid fa-list"></i> القطع</button>
        </div>
        <div class="section-lands" style="display:none"></div>
      `;
      card.querySelector('[data-act="rename"]').onclick = async () => {
        const name = await UI.promptModal('إعادة تسمية القسم', 'الاسم الجديد', s.name);
        if (name) LandManager.renameSection(s.id, name);
      };
      card.querySelector('[data-act="delete"]').onclick = async () => {
        const ok = await UI.confirmModal('حذف القسم', 'سيتم حذف قسم «' + UI.escapeHtml(s.name) + '» (لن تُحذف الأراضي نفسها من الخريطة). هل أنت متأكد؟', 'نعم، احذف');
        if (ok) { LandManager.deleteSection(s.id); UI.toast('تم حذف القسم'); }
      };
      card.querySelector('[data-act="show"]').onclick = () => {
        LandManager.setFilters({ sectionId: s.id });
        buildFiltersPane();
        document.querySelector('.sidebar-tabs button[data-pane="filters"]');
        const filterSel = document.getElementById('fltSection');
        if (filterSel) filterSel.value = s.id;
        UI.toast('تم عرض أراضي القسم على الخريطة — أعد ضبط الفلاتر للعودة');
        mapApi.fitAllLands();
      };
      card.querySelector('[data-act="export"]').onclick = () => {
        const ids = s.items.map((it) => it.landId);
        if (!ids.length) return UI.toast('القسم فارغ', 'warn');
        exportLandsMenu(ids, s.name);
      };
      card.querySelector('[data-act="print"]').onclick = () => {
        const ids = s.items.map((it) => it.landId);
        if (!ids.length) return UI.toast('القسم فارغ', 'warn');
        printLandsBatch(ids, 'تقرير قسم: ' + s.name);
      };
      const landsDiv = card.querySelector('.section-lands');
      card.querySelector('[data-act="toggle"]').onclick = () => {
        const open = landsDiv.style.display !== 'none';
        landsDiv.style.display = open ? 'none' : 'block';
        if (!open) renderSectionLands(s, landsDiv);
      };
      list.appendChild(card);
    });
  }

  function renderSectionLands(section, container) {
    container.innerHTML = '';
    if (!section.items.length) {
      container.innerHTML = '<p style="color:var(--text-2);font-size:12px;text-align:center;padding:8px">لا توجد قطع في هذا القسم</p>';
      return;
    }
    section.items.forEach((it) => {
      const name = it.customName || LandManager.displayName(it.landId);
      const m = LandManager.state.metrics[it.landId];
      const row = document.createElement('div');
      row.className = 'section-land-item';
      row.innerHTML = `
        <i class="fa-solid fa-vector-square" style="color:${section.color};font-size:11px"></i>
        <span class="name">${UI.escapeHtml(name)} <small style="color:var(--text-2)">(${m ? UI.fmtNum(m.areaM2) : '؟'} م²)</small></span>
        <button class="icon-btn" data-act="rename" title="تسمية مخصصة"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn danger" data-act="remove" title="إزالة من القسم"><i class="fa-solid fa-xmark"></i></button>
      `;
      row.querySelector('.name').onclick = () => { mapApi.zoomToLand(it.landId); openDrawer(it.landId); };
      row.querySelector('[data-act="rename"]').onclick = async () => {
        const nn = await UI.promptModal('تسمية مخصصة داخل القسم', 'الاسم المخصص', it.customName || '');
        if (nn !== null) LandManager.renameInSection(section.id, it.landId, nn);
      };
      row.querySelector('[data-act="remove"]').onclick = async () => {
        const ok = await UI.confirmModal('إزالة من القسم', 'إزالة «' + UI.escapeHtml(name) + '» من القسم؟ (لن تُحذف من الخريطة)', 'إزالة');
        if (ok) LandManager.removeFromSection(section.id, it.landId);
      };
      container.appendChild(row);
    });
  }

  /* ================== قائمة الأراضي ================== */
  function renderLandsList(filtered) {
    const pane = document.getElementById('pane-lands');
    const items = filtered.slice(0, landsListLimit);
    pane.innerHTML = `
      <div class="field"><input type="text" id="landsListSearch" placeholder="بحث سريع في القائمة..." value=""></div>
      <p style="font-size:12px;color:var(--text-2);margin-bottom:8px">عرض ${UI.fmtNum(items.length)} من ${UI.fmtNum(filtered.length)} قطعة مطابقة للفلاتر</p>
      <div id="landsListItems"></div>
      ${filtered.length > landsListLimit ? '<button class="btn block" id="btnMoreLands" style="margin-top:8px">عرض المزيد</button>' : ''}
    `;
    const container = pane.querySelector('#landsListItems');
    const renderItems = (feats) => {
      container.innerHTML = '';
      const frag = document.createDocumentFragment();
      feats.forEach((f) => {
        const m = LandManager.state.metrics[f.id];
        const colors = LandManager.state.settings.catColors;
        const row = document.createElement('div');
        row.className = 'section-land-item';
        row.style.cursor = 'pointer';
        row.innerHTML = `
          <span class="legend-swatch" style="background:${m ? colors[m.sizeCat] : '#888'};width:11px;height:11px;flex-shrink:0"></span>
          <span class="name">${UI.escapeHtml(LandManager.displayName(f.id))}</span>
          <small style="color:var(--text-2);direction:ltr">${m ? UI.fmtNum(m.areaM2) : '؟'} م²</small>
        `;
        row.onclick = () => { mapApi.zoomToLand(f.id); openDrawer(f.id); };
        frag.appendChild(row);
      });
      container.appendChild(frag);
    };
    renderItems(items);
    pane.querySelector('#landsListSearch').addEventListener('input', (e) => {
      const q = e.target.value.trim();
      const list = q
        ? filtered.filter((f) => LandManager.displayName(f.id).includes(q) || String(LandManager.getProp(f, 'parcelNo')).includes(q))
        : filtered;
      renderItems(list.slice(0, landsListLimit));
    });
    const more = pane.querySelector('#btnMoreLands');
    if (more) more.onclick = () => { landsListLimit += 300; renderLandsList(LandManager.filteredFeatures()); };
  }

  /* ================== بطاقة الأرض (اللوحة الجانبية) ================== */
  function onLandClick(feature) {
    if (multiSelectMode) {
      LandManager.toggleSelected(feature.id);
      return;
    }
    openDrawer(feature.id);
  }

  function onLandmarkClick(lm) {
    const cat = Landmarks.CATEGORIES[lm.category] || {};
    UI.openModal({
      title: lm.name,
      icon: lm.icon || 'fa-location-dot',
      bodyHTML: `
        <table class="kv-table">
          <tr><td>التصنيف</td><td>${cat.name || lm.category}</td></tr>
          <tr><td>النوع الهندسي</td><td>${Landmarks.geomLabel(lm)}</td></tr>
          <tr><td>الإحداثيات${lm.path ? ' (المركز)' : ''}</td><td style="direction:ltr;text-align:right">${lm.lat.toFixed(6)}, ${lm.lng.toFixed(6)}</td></tr>
          ${lm.ring ? `<tr><td>نصف قطر الحلقة</td><td>${lm.ring.radiusKm} كم</td></tr>` : ''}
          <tr><td>الوصف</td><td>${UI.escapeHtml(lm.description || '—')}</td></tr>
        </table>`,
      buttons: [
        { label: 'الاتجاهات', icon: 'fa-diamond-turn-right', class: 'primary', value: () => { window.open('https://www.google.com/maps/dir/?api=1&destination=' + lm.lat + ',' + lm.lng, '_blank'); return true; } },
        { label: 'تعديل المعلم', icon: 'fa-pen', value: () => { location.href = 'landmarks.html?edit=' + lm.id; return true; } },
        { label: 'إغلاق', value: null },
      ],
    });
  }

  function openDrawer(landId) {
    const f = LandManager.getFeature(landId);
    if (!f) return;
    const m = LandManager.state.metrics[landId] || {};
    const edit = LandManager.getEdit(landId);
    const drawer = document.getElementById('detailDrawer');
    const secs = LandManager.sectionsOfLand(landId);

    mapApi.setHighlight(landId);
    document.getElementById('drawerTitle').textContent = LandManager.displayName(landId);

    // فلاتر فئات المعالم المشتركة تنطبق على مسافات البطاقة أيضاً
    const hiddenLmCats = LandManager.state.settings.hiddenLandmarkCats || [];
    const visibleLms = Landmarks.getAll({ includeHidden: false }).filter((lm) => !hiddenLmCats.includes(lm.category));

    // زر إخفاء المعلم من كل الجداول والخريطة والطباعة (يُستعاد من صفحة إدارة المعالم)
    const hideBtn = (lmId) =>
      `<button class="icon-btn" data-lm-hide="${lmId}" title="إخفاء المعلم من كل الجداول والخريطة والطباعة" style="width:22px;height:22px;font-size:10px;vertical-align:middle;margin-inline-start:4px"><i class="fa-solid fa-eye-slash"></i></button>`;

    // المسافات للمعالم الرئيسة (تُخفى فئاتها المفلترة والموقوفة بزر العين)
    const keyDistances = KEY_LANDMARKS.map((id) => {
      const lm = Landmarks.getById(id);
      if (!lm || !m.center || hiddenLmCats.includes(lm.category) || lm.visible === false) return '';
      const d = DistanceAnalysis.distanceToLandmark(m.center, lm);
      return `<tr><td>يبعد عن ${UI.escapeHtml(lm.name.split('(')[0].trim())}${hideBtn(lm.id)}</td><td class="num">${DistanceAnalysis.fmtKm(d.km)} (${d.direction})</td></tr>`;
    }).join('');

    // معالم التركيز المحددة يدوياً، وإلا أقرب 3 معالم
    const focusIds = edit.focusLandmarks || [];
    let nearest = '';
    if (m.center) {
      const pool = focusIds.length ? visibleLms.filter((lm) => focusIds.includes(lm.id)) : visibleLms;
      const results = DistanceAnalysis.analyzePoint(m.center, pool);
      nearest = (focusIds.length ? results : results.slice(0, 3))
        .map((r) => `<tr><td>${UI.escapeHtml(r.landmark.name)}${hideBtn(r.landmark.id)}</td><td class="num">${DistanceAnalysis.fmtKm(r.km)} (${r.direction})</td></tr>`)
        .join('');
    }

    // قائمة اختيار معالم التركيز (تحديد متعدد)
    const focusOptions = visibleLms
      .map((lm) => `<option value="${lm.id}" ${focusIds.includes(lm.id) ? 'selected' : ''}>${UI.escapeHtml(lm.name)}</option>`)
      .join('');

    // الخصائص الأصلية من KML
    const rawProps = Object.entries(f.properties)
      .filter(([k, v]) => !k.startsWith('_') && v)
      .map(([k, v]) => `<tr><td>${UI.escapeHtml(k)}</td><td>${UI.escapeHtml(v)}</td></tr>`)
      .join('');

    const catBadge = m.sizeCat ? `<span class="badge ${m.sizeCat}">${LandManager.SIZE_CATS[m.sizeCat].name}</span>` : '';

    document.getElementById('drawerBody').innerHTML = `
      <div style="margin-bottom:8px">${catBadge}</div>
      <h4><i class="fa-solid fa-circle-info"></i> البيانات الأساسية <small style="color:var(--text-2);font-weight:400">(رقم القطعة والشارع قابلان للتعديل)</small></h4>
      <table class="kv-table">
        <tr><td>رقم القطعة</td><td><input type="text" id="editParcelNo" value="${UI.escapeHtml(LandManager.getProp(f, 'parcelNo') || '')}" placeholder="—" style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:13px"></td></tr>
        <tr><td>المساحة</td><td class="num">${UI.fmtNum(m.areaM2)} م² (${UI.fmtNum(m.areaM2 / 10000, 2)} هكتار)</td></tr>
        <tr><td>المحيط</td><td class="num">${UI.fmtNum(m.perimeterM)} م</td></tr>
        <tr><td>الإحداثيات (المركز)</td><td class="num" style="direction:ltr;text-align:right">${m.center ? m.center[1].toFixed(6) + ', ' + m.center[0].toFixed(6) : '—'}</td></tr>
        <tr><td>اسم الشارع</td><td><input type="text" id="editStreet" value="${UI.escapeHtml(LandManager.getProp(f, 'street') || '')}" placeholder="—" style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:13px"></td></tr>
        <tr><td>الأقسام</td><td>${secs.length ? secs.map((s) => '<span class="badge" style="background:' + s.color + '22;color:' + s.color + '">' + UI.escapeHtml(s.name) + '</span>').join(' ') : '—'}</td></tr>
      </table>

      <h4><i class="fa-solid fa-route"></i> المسافات من المعالم</h4>
      <table class="kv-table">${keyDistances || '<tr><td colspan="2">—</td></tr>'}</table>

      <h4><i class="fa-solid fa-location-crosshairs"></i> ${focusIds.length ? 'معالم التركيز' : 'أقرب المعالم'}</h4>
      <table class="kv-table">${nearest || '<tr><td colspan="2">—</td></tr>'}</table>
      <div class="field" style="margin-top:8px"><label>تحديد المعالم المراد التركيز عليها <small style="color:var(--text-2)">(اختيار متعدد بـ Ctrl/سحب — فارغ = أقرب المعالم تلقائياً)</small></label>
        <select id="editFocusLms" multiple size="6" style="width:100%">${focusOptions}</select>
      </div>

      <button class="btn primary block" id="btnSaveEdit"><i class="fa-solid fa-floppy-disk"></i> حفظ البيانات</button>

      <details style="margin-top:14px">
        <summary style="cursor:pointer;color:var(--primary);font-weight:700;font-size:13px">الخصائص الأصلية الكاملة (KML)</summary>
        <table class="kv-table" style="margin-top:8px">${rawProps || '<tr><td>لا توجد خصائص</td></tr>'}</table>
      </details>
    `;

    // أزرار إخفاء المعالم داخل جدولي المسافات وأقرب المعالم
    document.querySelectorAll('#drawerBody [data-lm-hide]').forEach((btn) => {
      btn.onclick = () => {
        const lm = Landmarks.getById(btn.dataset.lmHide);
        Landmarks.update(btn.dataset.lmHide, { visible: false });
        UI.toast('أُخفي «' + (lm ? lm.name : 'المعلم') + '» من كل الجداول والخريطة والطباعة — يُستعاد من صفحة إدارة المعالم', 'warn', 4500);
        renderAll();
        openDrawer(landId); // تحديث الجداول فوراً
      };
    });

    document.getElementById('btnSaveEdit').onclick = () => {
      const focusSel = [...document.getElementById('editFocusLms').selectedOptions].map((o) => o.value);
      LandManager.setEdit(landId, {
        props: {
          parcelNo: document.getElementById('editParcelNo').value.trim(),
          street: document.getElementById('editStreet').value.trim(),
        },
        focusLandmarks: focusSel,
      });
      UI.toast('تم حفظ بيانات الأرض');
      renderAll();            // قد يتغير الاسم/الفلاتر المعتمدة على الشارع
      openDrawer(landId);     // تحديث العرض بمعالم التركيز الجديدة
    };

    // أزرار الإجراءات
    const actions = document.getElementById('drawerActions');
    actions.innerHTML = '';
    const mkBtn = (label, icon, cls, fn) => {
      const b = document.createElement('button');
      b.className = 'btn sm ' + cls;
      b.innerHTML = '<i class="fa-solid ' + icon + '"></i> ' + label;
      b.onclick = fn;
      actions.appendChild(b);
    };
    mkBtn('نسخ إلى قسم', 'fa-copy', 'primary', async () => {
      const secId = await pickSectionModal();
      if (secId) { LandManager.addToSection(secId, landId); UI.toast('تم النسخ إلى القسم'); openDrawer(landId); }
    });
    mkBtn('إعادة تسمية', 'fa-pen', '', async () => {
      const name = await UI.promptModal('إعادة تسمية الأرض', 'الاسم الجديد', edit.customName || LandManager.displayName(landId));
      if (name) { LandManager.setEdit(landId, { customName: name }); openDrawer(landId); }
    });
    mkBtn('تحليل الموقع', 'fa-route', '', () => { location.href = 'analysis.html?land=' + encodeURIComponent(landId); });
    mkBtn('تكبير', 'fa-magnifying-glass-plus', '', () => mapApi.zoomToLand(landId));
    mkBtn('الاتجاهات', 'fa-diamond-turn-right', '', () => {
      if (m.center) window.open('https://www.google.com/maps/dir/?api=1&destination=' + m.center[1] + ',' + m.center[0], '_blank');
    });
    mkBtn('تصدير البيانات', 'fa-file-export', '', () => exportLandsMenu([landId], LandManager.displayName(landId)));
    mkBtn('بطاقة طباعة', 'fa-print', '', () => printLandCard(landId));
    mkBtn('استعادة الأصل', 'fa-rotate-left', 'danger', async () => {
      const ok = await UI.confirmModal('استعادة البيانات الأصلية', 'سيتم حذف جميع تعديلاتك على هذه القطعة (الاسم، الملاحظات، الحالة...). متابعة؟', 'استعادة');
      if (ok) { LandManager.resetEdit(landId); UI.toast('تمت الاستعادة'); openDrawer(landId); }
    });

    drawer.classList.add('open');
    document.getElementById('btnCloseDrawer').onclick = () => {
      drawer.classList.remove('open');
      mapApi.setHighlight(null);
    };
  }

  /** بطاقة طباعة لأرض واحدة — التجهيز عبر ExportUtils.buildLandCardData المشتركة */
  function printLandCard(landId) {
    const data = ExportUtils.buildLandCardData(landId);
    if (!data) return;
    ExportUtils.openPrintPage({
      type: 'landCard',
      title: 'بطاقة أرض: ' + LandManager.displayName(landId),
      ...data,
    });
  }

  /** طباعة عدة مواقع في ملف واحد — كل موقع بصفحاته (بيانات + خرائط) */
  const MAX_PRINT_LANDS = 15; // حد أعلى حتى لا تثقل الخرائط صفحة التقرير

  function printLandsBatch(ids, title) {
    if (!ids.length) return UI.toast('لا توجد أراضٍ محددة للطباعة', 'warn');
    let list = ids;
    if (ids.length > MAX_PRINT_LANDS) {
      list = ids.slice(0, MAX_PRINT_LANDS);
      UI.toast('سيُطبع أول ' + MAX_PRINT_LANDS + ' موقعاً من أصل ' + ids.length, 'warn', 5000);
    }
    const lands = list.map((id) => ExportUtils.buildLandCardData(id)).filter(Boolean);
    if (lands.length === 1) {
      // موقع واحد → بطاقة مفردة عادية
      ExportUtils.openPrintPage({ type: 'landCard', title: 'بطاقة أرض: ' + lands[0].land.name, ...lands[0] });
      return;
    }
    ExportUtils.openPrintPage({
      type: 'landCards',
      title: title || 'تقرير مواقع الأراضي (' + lands.length + ' موقع)',
      lands,
    });
  }
})();
