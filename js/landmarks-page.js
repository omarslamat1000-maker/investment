/**
 * landmarks-page.js — صفحة إدارة المعالم
 * إضافة بالنقر، تعديل بالسحب، تغيير الاسم/الأيقونة/التصنيف/اللون،
 * حذف مع تأكيد، استيراد وتصدير Excel/GeoJSON
 */
(function () {
  'use strict';

  let mapApi = null;
  /* الفئات المخفية مشتركة بين كل الصفحات عبر الإعدادات المحفوظة */
  let hiddenCats = [];
  let draggable = false;

  function loadHiddenCats() {
    hiddenCats = [...(LandManager.state.settings.hiddenLandmarkCats || [])];
  }

  function saveHiddenCats() {
    LandManager.state.settings.hiddenLandmarkCats = [...hiddenCats];
    LandManager.persistSettings(); // حفظ فوري + بث لبقية الصفحات
  }

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    await UI.initTheme();
    UI.showProgress('جارٍ تحميل البيانات...');
    await LandManager.init((d, t) => UI.updateProgress(d, t));
    UI.hideProgress();

    mapApi = MapFactory.createMap('map', { basemap: LandManager.state.settings.basemap });
    // خلفية خفيفة للأراضي للاستدلال
    mapApi.renderLands(LandManager.state.features);
    mapApi.map.setView(MapFactory.MEDINA_CENTER, 12);

    mapApi.onPick = (lat, lng) => openLandmarkModal(null, lat, lng);

    loadHiddenCats();
    buildCatChips();
    renderLandmarksLayer();
    renderList();
    wirePanel();

    // مزامنة فورية: تعديلات المعالم من صفحة/تبويب آخر تنعكس هنا مباشرة
    Landmarks.onChanged(() => { renderLandmarksLayer(); renderList(); });
    // مزامنة فلاتر الفئات القادمة من الصفحات الأخرى
    LandManager.onSettingsChanged(() => {
      loadHiddenCats();
      buildCatChips();
      renderLandmarksLayer();
      renderList();
    });

    // فتح معلم للتعديل من رابط ?edit=ID
    const params = new URLSearchParams(location.search);
    const editId = params.get('edit');
    if (editId) {
      const lm = Landmarks.getById(editId);
      if (lm) openLandmarkModal(lm);
    }
  }

  function renderLandmarksLayer() {
    mapApi.renderLandmarks({
      hiddenCats,
      draggable,
      onClick: (lm) => openLandmarkCard(lm),
      onDrag: (lm, lat, lng) => {
        Landmarks.update(lm.id, { lat, lng });
        UI.toast('تم تحديث موقع «' + lm.name + '»');
        renderList();
      },
    });
  }

  function buildCatChips() {
    const wrap = document.getElementById('lmCatChips');
    wrap.innerHTML = '';
    Object.entries(Landmarks.CATEGORIES).forEach(([key, cat]) => {
      const chip = document.createElement('span');
      chip.className = 'chip' + (hiddenCats.includes(key) ? '' : ' active');
      chip.innerHTML = '<i class="fa-solid ' + cat.icon + '"></i> ' + cat.name;
      chip.onclick = () => {
        chip.classList.toggle('active');
        if (hiddenCats.includes(key)) hiddenCats = hiddenCats.filter((c) => c !== key);
        else hiddenCats.push(key);
        saveHiddenCats(); // يُبث للصفحات الأخرى (الخريطة والتحليل)
        renderLandmarksLayer();
        renderList();
      };
      wrap.appendChild(chip);
    });
  }

  /* ========== لوحة تحليل المعالم: العدد الكلي ولكل فئة ولكل نوع هندسي ========== */
  function renderStats() {
    const box = document.getElementById('lmStats');
    if (!box) return;
    const all = Landmarks.getAll({ includeHidden: false, withOff: true });
    const byCat = {};
    const byGeom = { point: 0, line: 0, polygon: 0, ring: 0 };
    all.forEach((lm) => {
      byCat[lm.category] = (byCat[lm.category] || 0) + 1;
      if (lm.ring) byGeom.ring++;
      else if (lm.path && lm.path.length) byGeom[lm.geomType === 'polygon' ? 'polygon' : 'line']++;
      else byGeom.point++;
    });
    const catRows = Object.entries(Landmarks.CATEGORIES)
      .filter(([k]) => byCat[k])
      .map(([k, c]) => `
        <div class="stat-row lm-stat" data-cat="${k}" style="cursor:pointer" title="عرض معالم هذه الفئة فقط">
          <span><i class="fa-solid ${c.icon}" style="color:${c.color};width:18px"></i> ${c.name}</span>
          <b>${byCat[k]}</b>
        </div>`).join('');
    box.innerHTML = `
      <div class="stat-row"><span><i class="fa-solid fa-location-dot" style="width:18px"></i> إجمالي المعالم</span><b style="color:var(--primary)">${all.length}</b></div>
      ${catRows}
      <div class="stat-row" style="border-top:1px dashed var(--border);margin-top:6px;padding-top:8px">
        <span>نقطة: <b>${byGeom.point}</b></span>
        <span>خط: <b>${byGeom.line}</b></span>
        <span>مضلع: <b>${byGeom.polygon}</b></span>
        <span>حلقة: <b>${byGeom.ring}</b></span>
      </div>`;
    // النقر على فئة = تصفية القائمة والخريطة عليها فقط (نقرة ثانية تعيد الكل)
    box.querySelectorAll('.lm-stat').forEach((row) => {
      row.onclick = () => {
        const cat = row.dataset.cat;
        const allKeys = Object.keys(Landmarks.CATEGORIES);
        const onlyThis = hiddenCats.length === allKeys.length - 1 && !hiddenCats.includes(cat);
        hiddenCats = onlyThis ? [] : allKeys.filter((k) => k !== cat);
        saveHiddenCats(); // مزامنة مع بقية الصفحات
        buildCatChips();  // حالة الشرائح تُشتق من hiddenCats مباشرة
        renderLandmarksLayer();
        renderList();
      };
    });
  }

  function wirePanel() {
    document.getElementById('btnAddByClick').onclick = () => {
      mapApi.startMeasure('pick');
      UI.toast('انقر على الموقع المطلوب في الخريطة', 'warn', 4000);
    };
    document.getElementById('chkDraggable').onchange = (e) => {
      draggable = e.target.checked;
      renderLandmarksLayer();
      if (draggable) UI.toast('اسحب أي معلم لتغيير موقعه', 'warn');
    };
    document.getElementById('lmSearch').addEventListener('input', renderList);
    document.getElementById('btnExportLmExcel').onclick = () => {
      ExportUtils.toExcel(Landmarks.toRows(), 'معالم-المدينة-المنورة.xlsx', 'المعالم');
    };
    document.getElementById('btnExportLmGeo').onclick = () => {
      ExportUtils.toGeoJSONFile(Landmarks.toGeoJSON(), 'معالم-المدينة-المنورة.geojson');
    };
    document.getElementById('btnImportLm').onclick = () => document.getElementById('lmFileInput').click();
    document.getElementById('lmFileInput').addEventListener('change', importFile);
  }

  /* ========== الاستيراد ==========
   * يدعم عدة ملفات دفعة واحدة بصيغ: KML/KMZ، GeoJSON، Excel/CSV
   * مع نافذة خيارات: أرض/معلم + التصنيف + النوع الهندسي
   */
  async function importFile(e) {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;

    const opts = await UI.askImportOptions('landmarks', files.length);
    if (!opts) return;

    if (opts.kind === 'lands') {
      // استيراد كأراضٍ: دمج مضلعات كل الملفات في طبقة الأراضي
      UI.showProgress('جارٍ قراءة الملفات...');
      try {
        const allFeatures = [];
        const seenIds = new Set();
        for (let fi = 0; fi < files.length; fi++) {
          const { geojson } = await KMLParser.parseFile(files[fi]);
          geojson.features.forEach((f) => {
            if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') return;
            let id = f.id || 'PM_' + allFeatures.length;
            if (seenIds.has(id)) id = id + '-f' + (fi + 1);
            seenIds.add(id);
            allFeatures.push({ ...f, id });
          });
        }
        if (!allFeatures.length) throw new Error('لا توجد مضلعات أراضٍ في الملفات');
        const dsName = files.map((f) => f.name).join(' + ');
        await LandManager.importDataset({ type: 'FeatureCollection', name: dsName, features: allFeatures }, dsName);
        mapApi.renderLands(LandManager.state.features);
        UI.toast('تم استيراد ' + UI.fmtNum(allFeatures.length) + ' قطعة أرض — افتح صفحة الخريطة لإدارتها', 'success', 5000);
      } catch (err) {
        UI.toast(err.message || 'فشل الاستيراد', 'error', 5000);
      }
      UI.hideProgress();
      return;
    }

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
    renderLandmarksLayer();
    renderList();
    if (total) UI.toast('تم استيراد ' + total + ' معلماً من ' + files.length + ' ملف');
    if (errors.length) UI.toast('تعذر استيراد: ' + errors.join(' — '), 'error', 6000);
  }

  /* ========== القائمة ========== */
  function renderList() {
    const list = document.getElementById('lmList');
    const q = document.getElementById('lmSearch').value.trim();
    // withOff: الموقوفة تبقى في القائمة (باهتة) حتى يمكن إعادة إظهارها
    const all = Landmarks.getAll({ includeHidden: false, withOff: true })
      .filter((lm) => !hiddenCats.includes(lm.category))
      .filter((lm) => !q || lm.name.includes(q));
    document.getElementById('lmCount').textContent = '(' + all.length + ')';
    list.innerHTML = '';
    all.forEach((lm) => {
      const cat = Landmarks.CATEGORIES[lm.category] || Landmarks.CATEGORIES.user;
      const isOff = lm.visible === false;
      const item = document.createElement('div');
      item.className = 'lm-list-item';
      if (isOff) item.style.opacity = '0.45';
      item.innerHTML = `
        <div class="lm-ico" style="background:${lm.color || cat.color}"><i class="fa-solid ${lm.icon || cat.icon}"></i></div>
        <div class="lm-info">
          <div class="nm">${UI.escapeHtml(lm.name)}</div>
          <div class="ct">${cat.name} — ${Landmarks.geomLabel(lm)}${lm.builtin ? '' : ' — <span style="color:var(--primary)">مستخدم</span>'}${isOff ? ' — <span style="color:#b45309">مخفي</span>' : ''}</div>
        </div>
        <button class="icon-btn" data-act="vis" title="${isOff ? 'إظهار في الخريطة والطباعة' : 'إخفاء من الخريطة والطباعة'}"><i class="fa-solid ${isOff ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
        <button class="icon-btn" data-act="zoom" title="تكبير"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
        <button class="icon-btn" data-act="edit" title="تعديل"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn danger" data-act="del" title="حذف"><i class="fa-solid fa-trash"></i></button>
      `;
      // تبديل الإظهار/الإخفاء — ينعكس على الخريطة والتحليل والطباعة في كل الصفحات
      item.querySelector('[data-act="vis"]').onclick = () => {
        Landmarks.update(lm.id, { visible: isOff });
        renderLandmarksLayer();
        renderList();
        UI.toast(isOff ? 'أصبح «' + lm.name + '» ظاهراً' : 'أُخفي «' + lm.name + '» من الخريطة والطباعة');
      };
      item.querySelector('[data-act="zoom"]').onclick = () => {
        if (lm.path && lm.path.length >= 2) mapApi.map.fitBounds(L.latLngBounds(lm.path).pad(0.3));
        else mapApi.map.setView([lm.lat, lm.lng], lm.ring ? 12 : 15);
      };
      item.querySelector('[data-act="edit"]').onclick = () => openLandmarkModal(lm);
      item.querySelector('[data-act="del"]').onclick = async () => {
        const ok = await UI.confirmModal(
          'حذف المعلم',
          'حذف «' + UI.escapeHtml(lm.name) + '»؟' + (lm.builtin ? ' (معلم افتراضي — سيُخفى ويمكن استعادته لاحقاً)' : ''),
          'نعم، احذف'
        );
        if (ok) {
          Landmarks.remove(lm.id);
          renderLandmarksLayer();
          renderList();
          UI.toast('تم حذف المعلم');
        }
      };
      list.appendChild(item);
    });
    renderStats(); // تحديث لوحة التحليل مع كل تغيير
  }

  /* ========== بطاقة معلم ========== */
  function openLandmarkCard(lm) {
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
        { label: 'تعديل', icon: 'fa-pen', value: () => { setTimeout(() => openLandmarkModal(lm), 100); return true; } },
        {
          label: 'حذف', icon: 'fa-trash', class: 'danger',
          value: () => {
            // تأكيد بعد إغلاق البطاقة، ثم حذف وتحديث الخريطة والقائمة
            setTimeout(async () => {
              const ok = await UI.confirmModal(
                'حذف المعلم',
                'حذف «' + UI.escapeHtml(lm.name) + '»؟' + (lm.builtin ? ' (معلم افتراضي — سيُخفى ويمكن استعادته لاحقاً)' : ''),
                'نعم، احذف'
              );
              if (ok) {
                Landmarks.remove(lm.id);
                renderLandmarksLayer();
                renderList();
                UI.toast('تم حذف المعلم');
              }
            }, 100);
            return true;
          },
        },
        { label: 'إغلاق', value: null },
      ],
    });
  }

  /* ========== نافذة إضافة/تعديل معلم ==========
   * تدعم ثلاثة أنواع هندسية:
   * - نقطة ثابتة (معلم): إحداثية واحدة — التقاط من الخريطة أو إدخال يدوي
   * - خط (طريق): مجموعة إحداثيات مترابطة — رسم على الخريطة أو إدخال يدوي
   * - مضلع (مشروع): عدة نقاط (3 فأكثر) تحيط بمنطقة
   * draft: مسودة محفوظة لإعادة فتح النافذة بعد الرسم على الخريطة
   */
  function openLandmarkModal(lm, lat, lng, draft) {
    const isNew = !lm;
    const data = draft || (lm
      ? { ...lm, path: lm.path ? lm.path.map((p) => [p[0], p[1]]) : null }
      : { name: '', category: 'user', icon: 'fa-location-dot', description: '', lat, lng, color: '', geomType: 'point', path: null });
    if (!data.geomType) data.geomType = data.path && data.path.length ? 'line' : 'point';

    // نقاط المسار الجارية داخل النافذة (تحرر يدوياً أو بالرسم)
    let pts = (data.path || []).map((p) => [p[0], p[1]]);

    const catOptions = Object.entries(Landmarks.CATEGORIES)
      .map(([k, c]) => `<option value="${k}" ${data.category === k ? 'selected' : ''}>${c.name}</option>`)
      .join('');
    const geomOptions = Object.entries(Landmarks.GEOM_TYPES)
      .map(([k, g]) => `<option value="${k}" ${data.geomType === k ? 'selected' : ''}>${g.name}</option>`)
      .join('');
    const icons = Landmarks.ICON_LIBRARY
      .map((ic) => `<button type="button" class="${ic === data.icon ? 'active' : ''}" data-icon="${ic}"><i class="fa-solid ${ic}"></i></button>`)
      .join('');

    /* قراءة قيم النموذج الحالية (تستخدم قبل الإغلاق المؤقت للرسم) */
    const collectForm = () => {
      const selIcon = document.querySelector('#lmIcons button.active');
      return {
        id: data.id,
        builtin: data.builtin,
        ring: data.ring || null,
        name: document.getElementById('lmName').value.trim(),
        category: document.getElementById('lmCat').value,
        color: document.getElementById('lmColor').value,
        geomType: document.getElementById('lmGeomType').value,
        lat: parseFloat(document.getElementById('lmLat').value),
        lng: parseFloat(document.getElementById('lmLng').value),
        path: pts.map((p) => [p[0], p[1]]),
        description: document.getElementById('lmDesc').value.trim(),
        icon: selIcon ? selIcon.dataset.icon : data.icon,
      };
    };

    UI.openModal({
      title: isNew ? 'إضافة معلم جديد' : 'تعديل المعلم',
      icon: isNew ? 'fa-map-pin' : 'fa-pen',
      wide: true,
      bodyHTML: `
        <div class="field"><label>اسم المعلم *</label><input type="text" id="lmName" value="${UI.escapeHtml(data.name)}" placeholder="مثال: مركز صحي..."></div>
        <div class="field-row">
          <div class="field"><label>نوع المعلم</label><select id="lmGeomType">${geomOptions}</select></div>
          <div class="field"><label>التصنيف</label><select id="lmCat">${catOptions}</select></div>
        </div>
        <div class="field"><label>لون مخصص (اختياري)</label><input type="color" id="lmColor" value="${data.color || '#be123c'}" style="height:40px;padding:3px;width:120px"></div>

        <!-- حقول النقطة الثابتة -->
        <div id="lmPointFields" style="display:${data.geomType === 'point' ? 'block' : 'none'}">
          <div class="field-row">
            <div class="field"><label>خط العرض</label><input type="number" id="lmLat" step="0.000001" value="${data.lat != null && isFinite(data.lat) ? data.lat : ''}" style="direction:ltr"></div>
            <div class="field"><label>خط الطول</label><input type="number" id="lmLng" step="0.000001" value="${data.lng != null && isFinite(data.lng) ? data.lng : ''}" style="direction:ltr"></div>
          </div>
          <button type="button" class="btn sm" id="btnPickPoint"><i class="fa-solid fa-hand-pointer"></i> التقاط النقطة من الخريطة</button>
        </div>

        <!-- محرر نقاط الخط/المضلع -->
        <div id="lmPathFields" style="display:${data.geomType !== 'point' ? 'block' : 'none'}">
          <div class="field"><label>نقاط المسار <span id="ptsCount" style="color:var(--primary)"></span> <small style="color:var(--text-2)">(خط: نقطتان فأكثر — مضلع: 3 نقاط فأكثر)</small></label>
            <div id="lmPtsList" style="max-height:180px;overflow-y:auto"></div>
          </div>
          <div class="btn-group">
            <button type="button" class="btn sm primary" id="btnDrawPath"><i class="fa-solid fa-draw-polygon"></i> رسم النقاط من الخريطة</button>
            <button type="button" class="btn sm" id="btnAddPt"><i class="fa-solid fa-plus"></i> إضافة إحداثية يدوياً</button>
            <button type="button" class="btn sm" id="btnClearPts"><i class="fa-solid fa-eraser"></i> مسح النقاط</button>
          </div>
          <p style="font-size:11.5px;color:var(--text-2);margin-top:6px"><i class="fa-solid fa-circle-info"></i> الرسم من الخريطة: انقر لإضافة كل نقطة، ثم نقراً مزدوجاً للإنهاء وستعود هذه النافذة تلقائياً.</p>
        </div>

        <div class="field"><label>الوصف</label><textarea id="lmDesc" rows="2">${UI.escapeHtml(data.description || '')}</textarea></div>
        <div class="field"><label>الأيقونة</label><div class="icon-grid" id="lmIcons">${icons}</div></div>
      `,
      buttons: [
        {
          label: isNew ? 'إضافة' : 'حفظ التعديلات', class: 'primary', icon: 'fa-check',
          validate: () => {
            const f = collectForm();
            if (!f.name) { UI.toast('الرجاء إدخال اسم المعلم', 'error'); return false; }
            if (f.geomType === 'point') {
              if (!isFinite(f.lat) || !isFinite(f.lng)) { UI.toast('إحداثيات غير صحيحة', 'error'); return false; }
            } else {
              const valid = f.path.filter((p) => isFinite(p[0]) && isFinite(p[1]));
              const min = Landmarks.GEOM_TYPES[f.geomType].min;
              if (valid.length < min) {
                UI.toast('النوع المحدد يتطلب ' + min + ' نقاط صحيحة على الأقل (الحالي: ' + valid.length + ')', 'error', 4000);
                return false;
              }
            }
            return true;
          },
          value: () => {
            const f = collectForm();
            const changes = {
              name: f.name,
              category: f.category,
              color: f.color,
              geomType: f.geomType,
              description: f.description,
              icon: f.icon,
            };
            if (f.geomType === 'point') {
              changes.lat = f.lat;
              changes.lng = f.lng;
              changes.path = null;
            } else {
              changes.path = f.path.filter((p) => isFinite(p[0]) && isFinite(p[1]));
            }
            if (isNew) Landmarks.add(changes);
            else Landmarks.update(data.id, changes);
            return true;
          },
        },
        ...(!isNew && data.builtin ? [{
          label: 'استعادة الأصل', icon: 'fa-rotate-left',
          value: () => { Landmarks.resetBuiltin(data.id); return true; },
        }] : []),
        { label: 'إلغاء', value: null },
      ],
      onOpen: (body) => {
        /* اختيار الأيقونة */
        body.querySelector('#lmIcons').addEventListener('click', (e) => {
          const btn = e.target.closest('button[data-icon]');
          if (!btn) return;
          body.querySelectorAll('#lmIcons button').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
        });

        /* تبديل نوع المعلم يظهر الحقول المناسبة */
        const geomSel = body.querySelector('#lmGeomType');
        geomSel.onchange = () => {
          const isPoint = geomSel.value === 'point';
          body.querySelector('#lmPointFields').style.display = isPoint ? 'block' : 'none';
          body.querySelector('#lmPathFields').style.display = isPoint ? 'none' : 'block';
        };

        /* محرر النقاط اليدوي */
        const listEl = body.querySelector('#lmPtsList');
        const renderPts = () => {
          body.querySelector('#ptsCount').textContent = '(' + pts.length + ')';
          listEl.innerHTML = '';
          pts.forEach((p, i) => {
            const row = document.createElement('div');
            row.className = 'pt-row';
            row.innerHTML = `
              <span class="pt-idx">${i + 1}</span>
              <input type="number" step="0.000001" value="${isFinite(p[0]) ? p[0] : ''}" placeholder="خط العرض" data-i="${i}" data-k="0">
              <input type="number" step="0.000001" value="${isFinite(p[1]) ? p[1] : ''}" placeholder="خط الطول" data-i="${i}" data-k="1">
              <button type="button" class="icon-btn danger" title="حذف النقطة"><i class="fa-solid fa-xmark"></i></button>
            `;
            row.querySelectorAll('input').forEach((inp) => {
              inp.oninput = () => { pts[+inp.dataset.i][+inp.dataset.k] = parseFloat(inp.value); };
            });
            row.querySelector('button').onclick = () => { pts.splice(i, 1); renderPts(); };
            listEl.appendChild(row);
          });
          if (!pts.length) listEl.innerHTML = '<p style="font-size:12px;color:var(--text-2);text-align:center;padding:8px">لا توجد نقاط بعد — ارسم من الخريطة أو أضف إحداثيات يدوياً</p>';
        };
        renderPts();

        body.querySelector('#btnAddPt').onclick = () => { pts.push([NaN, NaN]); renderPts(); };
        body.querySelector('#btnClearPts').onclick = () => { pts = []; renderPts(); };

        /* رسم النقاط من الخريطة: حفظ مسودة، إغلاق، رسم، ثم إعادة فتح النافذة */
        body.querySelector('#btnDrawPath').onclick = () => {
          const d = collectForm();
          UI.closeModal('__drawing__');
          UI.toast('انقر على الخريطة لإضافة النقاط، ونقراً مزدوجاً للإنهاء', 'warn', 5000);
          mapApi.startPath(d.geomType === 'polygon' ? 'polygon' : 'line', (drawn) => {
            if (drawn.length) d.path = drawn;
            openLandmarkModal(lm, null, null, d);
          });
        };

        /* التقاط نقطة واحدة من الخريطة (للنوع النقطي) */
        body.querySelector('#btnPickPoint').onclick = () => {
          const d = collectForm();
          UI.closeModal('__drawing__');
          UI.toast('انقر على الموقع المطلوب في الخريطة', 'warn', 4000);
          const prevPick = mapApi.onPick;
          mapApi.onPick = (la, ln) => {
            mapApi.onPick = prevPick;
            d.lat = la; d.lng = ln;
            openLandmarkModal(lm, null, null, d);
          };
          mapApi.startMeasure('pick');
        };
      },
    }).then((saved) => {
      if (saved && saved !== '__drawing__') {
        renderLandmarksLayer();
        renderList();
        UI.toast(isNew ? 'تمت إضافة المعلم' : 'تم حفظ التعديلات');
      }
    });
  }
})();
