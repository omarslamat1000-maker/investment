/**
 * ui-common.js — مكونات واجهة مشتركة بين الصفحات:
 * التنبيهات (Toast)، النوافذ المنبثقة (Modal)، شريط التقدم، تبديل الوضع الليلي
 */
(function () {
  'use strict';

  /* ============ التنبيهات ============ */
  function toast(message, type = 'success', duration = 3000) {
    const wrap = document.getElementById('toastWrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-triangle-exclamation';
    el.innerHTML = '<i class="fa-solid ' + icon + '"></i><span></span>';
    el.querySelector('span').textContent = message;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s';
      setTimeout(() => el.remove(), 350);
    }, duration);
  }

  /* ============ النوافذ المنبثقة ============ */
  let modalResolve = null;

  function openModal({ title, icon = 'fa-circle-info', bodyHTML, buttons, wide = false, onOpen }) {
    const overlay = document.getElementById('modalOverlay');
    const box = document.getElementById('modalBox');
    const head = document.getElementById('modalHead');
    const body = document.getElementById('modalBody');
    const foot = document.getElementById('modalFoot');
    if (!overlay) return Promise.resolve(null);

    box.classList.toggle('wide', wide);
    head.innerHTML = '<i class="fa-solid ' + icon + '"></i><span></span>';
    head.querySelector('span').textContent = title;
    body.innerHTML = bodyHTML || '';
    foot.innerHTML = '';

    return new Promise((resolve) => {
      modalResolve = resolve;
      (buttons || [{ label: 'إغلاق', value: null }]).forEach((b) => {
        const btn = document.createElement('button');
        btn.className = 'btn ' + (b.class || '');
        btn.innerHTML = (b.icon ? '<i class="fa-solid ' + b.icon + '"></i> ' : '') + b.label;
        btn.onclick = () => {
          // إن كان للزر مدقق (validator) يمنع الإغلاق عند إرجاع false
          if (b.validate && b.validate() === false) return;
          closeModal(typeof b.value === 'function' ? b.value() : b.value);
        };
        foot.appendChild(btn);
      });
      overlay.classList.add('open');
      if (onOpen) onOpen(body);
    });
  }

  function closeModal(value) {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('open');
    if (modalResolve) { modalResolve(value === undefined ? null : value); modalResolve = null; }
  }

  /** نافذة تأكيد */
  function confirmModal(title, message, dangerLabel = 'تأكيد') {
    return openModal({
      title,
      icon: 'fa-triangle-exclamation',
      bodyHTML: '<p>' + message + '</p>',
      buttons: [
        { label: dangerLabel, value: true, class: 'danger', icon: 'fa-check' },
        { label: 'إلغاء', value: false },
      ],
    });
  }

  /** نافذة إدخال نص */
  function promptModal(title, label, initial = '', placeholder = '') {
    return openModal({
      title,
      icon: 'fa-pen',
      bodyHTML:
        '<div class="field"><label>' + label + '</label>' +
        '<input type="text" id="promptInput" value="' + String(initial).replace(/"/g, '&quot;') + '" placeholder="' + placeholder + '" /></div>',
      buttons: [
        {
          label: 'حفظ', class: 'primary', icon: 'fa-check',
          value: () => document.getElementById('promptInput').value.trim(),
          validate: () => document.getElementById('promptInput').value.trim() !== '',
        },
        { label: 'إلغاء', value: null },
      ],
      onOpen: (body) => {
        const inp = body.querySelector('#promptInput');
        inp.focus();
        inp.select();
      },
    });
  }

  // إغلاق بالنقر خارج النافذة أو بزر Esc
  document.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal(null);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal(null);
  });

  /* ============ شريط التقدم ============ */
  function showProgress(text) {
    const o = document.getElementById('progressOverlay');
    if (!o) return;
    document.getElementById('progressText').textContent = text || 'جارٍ المعالجة...';
    document.getElementById('progressFill').style.width = '0%';
    o.classList.add('open');
  }
  function updateProgress(done, total, text) {
    const fill = document.getElementById('progressFill');
    if (fill) fill.style.width = Math.round((done / total) * 100) + '%';
    if (text) document.getElementById('progressText').textContent = text;
  }
  function hideProgress() {
    const o = document.getElementById('progressOverlay');
    if (o) o.classList.remove('open');
  }

  /* ============ الوضع الليلي ============ */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('btnTheme');
    if (btn) btn.innerHTML = '<i class="fa-solid ' + (theme === 'dark' ? 'fa-sun' : 'fa-moon') + '"></i>';
  }

  async function initTheme() {
    const settings = (await Storage2.get('settings')) || {};
    applyTheme(settings.theme || 'light');
    const btn = document.getElementById('btnTheme');
    if (btn) {
      btn.addEventListener('click', async () => {
        const s = (await Storage2.get('settings')) || {};
        const next = (s.theme || 'light') === 'dark' ? 'light' : 'dark';
        s.theme = next;
        await Storage2.set('settings', s);
        if (window.LandManager) LandManager.state.settings.theme = next;
        applyTheme(next);
      });
    }
  }

  /* ============ أدوات تنسيق ============ */
  function fmtNum(n, digits = 0) {
    return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: digits });
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /**
   * نافذة خيارات الاستيراد الموحّدة — تُعرض قبل استيراد أي ملفات:
   * - نوع البيانات: أراضٍ أو معالم
   * - للمعالم: التصنيف (أو تلقائي من الملف) والنوع الهندسي (تلقائي/نقطة/خط/مضلع)
   * ترجع {kind, category, geomType} أو null عند الإلغاء
   */
  function askImportOptions(defaultKind = 'lands', fileCount = 1) {
    const cats = window.Landmarks ? Landmarks.CATEGORIES : {};
    const catOptions = Object.entries(cats)
      .map(([k, c]) => `<option value="${k}">${c.name}</option>`)
      .join('');
    return openModal({
      title: 'خيارات الاستيراد' + (fileCount > 1 ? ' (' + fileCount + ' ملفات)' : ''),
      icon: 'fa-file-import',
      bodyHTML: `
        <div class="field"><label>نوع البيانات المستوردة</label>
          <select id="impKind">
            <option value="lands" ${defaultKind === 'lands' ? 'selected' : ''}>أراضٍ — المضلعات تُضاف إلى طبقة الأراضي</option>
            <option value="landmarks" ${defaultKind === 'landmarks' ? 'selected' : ''}>معالم — نقاط / خطوط / مضلعات</option>
          </select>
        </div>
        <div id="impLmOpts" style="display:${defaultKind === 'landmarks' ? 'block' : 'none'}">
          <div class="field"><label>تصنيف المعالم</label>
            <select id="impCat"><option value="">تلقائي من الملف</option>${catOptions}</select>
          </div>
          <div class="field"><label>النوع الهندسي</label>
            <select id="impGeom">
              <option value="auto">تلقائي كما في الملف (نقطة/خط/مضلع)</option>
              <option value="point">نقاط — تحويل الخطوط والمضلعات إلى مراكزها</option>
              <option value="line">خطوط — تحويل المضلعات إلى حدودها</option>
              <option value="polygon">مضلعات — إغلاق الخطوط (3 نقاط فأكثر)</option>
            </select>
          </div>
          <p style="font-size:11.5px;color:var(--text-2)"><i class="fa-solid fa-circle-info"></i> تنطبق هذه الخيارات على جميع العناصر في كل الملفات المختارة.</p>
        </div>`,
      buttons: [
        {
          label: 'استيراد', class: 'primary', icon: 'fa-check',
          value: () => ({
            kind: document.getElementById('impKind').value,
            category: document.getElementById('impCat').value,
            geomType: document.getElementById('impGeom').value,
          }),
        },
        { label: 'إلغاء', value: null },
      ],
      onOpen: (body) => {
        const kindSel = body.querySelector('#impKind');
        kindSel.onchange = () => {
          body.querySelector('#impLmOpts').style.display = kindSel.value === 'landmarks' ? 'block' : 'none';
        };
      },
    });
  }

  /**
   * ربط زر «حفظ الكل» (إن وُجد في الصفحة): حفظ فوري شامل لكل تعديلات النظام
   * — تعديلات القطع والبيانات الأساسية والأقسام والإعدادات والمعالم —
   * علماً أن الحفظ التلقائي يعمل مع كل تعديل، وهذا الزر تأكيد إضافي بيد المستخدم
   */
  function wireSaveAllButton() {
    const btn = document.getElementById('btnSaveAll');
    if (!btn) return;
    btn.onclick = async () => {
      const icon = btn.querySelector('i');
      const prev = icon.className;
      icon.className = 'fa-solid fa-spinner fa-spin';
      try {
        if (window.LandManager && LandManager.saveAllNow) await LandManager.saveAllNow();
        if (window.Landmarks && Landmarks.saveNow) await Landmarks.saveNow();
        toast('تم حفظ جميع التعديلات — ستجدها كما هي عند إعادة فتح التطبيق', 'success', 3500);
      } catch (e) {
        toast('تعذر الحفظ: ' + (e.message || e), 'error', 5000);
      }
      icon.className = prev;
    };
  }
  // يُربط تلقائياً بعد اكتمال تحميل الصفحة
  document.addEventListener('DOMContentLoaded', wireSaveAllButton);

  window.UI = { toast, openModal, closeModal, confirmModal, promptModal, showProgress, updateProgress, hideProgress, initTheme, applyTheme, fmtNum, escapeHtml, askImportOptions, wireSaveAllButton };
})();
