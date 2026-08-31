// نقطة تشغيل تطبيق الإدارة app.html — التهيئة، التخطيط، وتسجيل المسارات
import { APP_CONFIG } from './config.js';
import { initDataProvider } from './data/data-provider.js';
import { seedDemoDataIfEmpty } from './services/import-service.js';
import { initNotifications, getNotifications, unreadCount, markAllRead } from './services/notification-service.js';
import { route, startRouter, onNotFound, navigate } from './router.js';
import { getRole, getRoleLabel, getTheme, setTheme, getLastRoute, getSession, setRole, setUserName } from './core/state.js';
import { can, setOverridesProvider } from './core/permissions.js';
import { logout } from './services/auth-service.js';
import { on, EVENTS } from './core/events.js';
import { initAccessibility } from './ui/accessibility.js';
import { html, raw, escapeHtml } from './core/sanitizer.js';
import { emptyState } from './ui/components.js';
import { fmtDateTime } from './core/date-time.js';
import { renderDashboard } from './modules/dashboard/dashboard-view.js';
import { renderInitiativesList, renderInitiativeDetails } from './modules/initiatives/initiatives-view.js';
import { renderNeeds } from './modules/needs/needs-view.js';
import { renderPartners } from './modules/partners/partners-view.js';
import { renderReviews } from './modules/reviews/reviews-view.js';
import { renderDecisions } from './modules/decisions/decisions-view.js';
import { renderExecution } from './modules/execution/execution-view.js';
import { renderBenefits } from './modules/benefits/benefits-view.js';
import { renderRisks } from './modules/risks/risks-view.js';
import { renderQuality } from './modules/quality/quality-view.js';
import { renderMap } from './modules/map/map-view.js';
import { renderReports } from './modules/reports/reports-view.js';
import { renderSettings } from './modules/settings/settings-view.js';
import { renderUsers } from './modules/users/users-view.js';
import { renderPortfolios } from './modules/portfolios/portfolios-view.js';

// perm: الصلاحية اللازمة لظهور الرابط — بدونها يظهر للجميع
const NAV = [
  { path: 'dashboard', label: 'لوحة المتابعة', icon: '◫' },
  { path: 'initiatives', label: 'المبادرات', icon: '▤', perm: 'initiatives.view' },
  { path: 'portfolios', label: 'المحافظ', icon: '▦', perm: 'portfolios.view' },
  { path: 'needs', label: 'الاحتياجات', icon: '◇', perm: 'needs.view' },
  { path: 'partners', label: 'الشركاء', icon: '◔', perm: 'partners.view' },
  { path: 'reviews', label: 'المراجعات', icon: '✎', perm: 'reviews.view' },
  { path: 'decisions', label: 'القرارات', icon: '⚖', perm: 'decisions.view' },
  { path: 'execution', label: 'التنفيذ', icon: '▸', perm: 'execution.view' },
  { path: 'benefits', label: 'المنافع', icon: '✦', perm: 'benefits.view' },
  { path: 'risks', label: 'المخاطر', icon: '△', perm: 'risks.view' },
  { path: 'quality', label: 'الجودة', icon: '✓', perm: 'quality.view' },
  { path: 'map', label: 'الخريطة', icon: '◎' },
  { path: 'reports', label: 'التقارير', icon: '≡', perm: 'reports.view' },
  { path: 'users', label: 'المستخدمون', icon: '◉', perm: 'users.view' },
  { path: 'settings', label: 'الإعدادات', icon: '⚙' }
];

function drawShell(session) {
  document.documentElement.setAttribute('data-mi-theme', getTheme());
  const root = document.getElementById('mi-app');
  const visibleNav = NAV.filter((n) => !n.perm || can(getRole(), n.perm));
  root.innerHTML = html`
    <a class="mi-skip-link" href="#mi-main">تخطٍّ إلى المحتوى</a>
    <div class="mi-shell">
      <aside class="mi-sidebar" aria-label="التنقل الرئيسي">
        <a class="mi-sidebar__brand" href="./index.html">
          <span class="mi-brand-arch" aria-hidden="true"></span>
          <span class="mi-brand-text"><b>منصة المبادرات</b><small>أمانة منطقة المدينة المنورة</small></span>
        </a>
        <nav class="mi-nav">
          ${raw(visibleNav.map((n) => `<a class="mi-nav__link" data-path="${n.path}" href="#/${n.path}"><span class="mi-nav__icon" aria-hidden="true">${n.icon}</span>${escapeHtml(n.label)}</a>`).join(''))}
        </nav>
        <footer class="mi-sidebar__foot">
          <span class="mi-user-chip" title="المستخدم الحالي">${session.name}</span>
          <span class="mi-role-chip" title="الدور الحالي">${getRoleLabel()}</span>
        </footer>
      </aside>
      <div class="mi-content-col">
        <header class="mi-topbar">
          <button class="mi-btn mi-btn--ghost mi-menu-btn" aria-label="فتح القائمة" aria-expanded="false">☰</button>
          <div class="mi-topbar__title" aria-hidden="true"></div>
          <div class="mi-topbar__tools">
            <button class="mi-btn mi-btn--ghost" data-act="theme" aria-label="تبديل السمة">◐</button>
            <button class="mi-btn mi-btn--ghost mi-notif-btn" data-act="notifications" aria-label="الإشعارات">🔔<span class="mi-notif-count" hidden></span></button>
            <button class="mi-btn mi-btn--ghost" data-act="logout" title="تسجيل الخروج">خروج ⎋</button>
          </div>
        </header>
        <main id="mi-main" class="mi-main" role="main" tabindex="-1"></main>
      </div>
    </div>
    <div class="mi-notif-panel" hidden aria-label="الإشعارات"></div>`;

  root.querySelector('.mi-menu-btn').addEventListener('click', () => {
    const open = document.body.classList.toggle('mi-sidebar-open');
    root.querySelector('.mi-menu-btn').setAttribute('aria-expanded', String(open));
  });
  root.querySelector('[data-act="theme"]').addEventListener('click', () => {
    setTheme(getTheme() === 'light' ? 'dark' : 'light');
  });
  root.querySelector('[data-act="notifications"]').addEventListener('click', toggleNotifPanel);
  root.querySelector('[data-act="logout"]').addEventListener('click', () => {
    logout();
    location.replace('./login.html');
  });
}

function markActiveNav(path) {
  const seg = path.replace(/^\//, '').split('/')[0] || 'dashboard';
  document.querySelectorAll('.mi-nav__link').forEach((a) => {
    a.setAttribute('aria-current', a.dataset.path === seg ? 'page' : 'false');
  });
  document.body.classList.remove('mi-sidebar-open');
}

async function refreshNotifBadge() {
  const count = await unreadCount();
  const badge = document.querySelector('.mi-notif-count');
  if (!badge) return;
  badge.hidden = count === 0;
  badge.textContent = count > 9 ? '9+' : String(count);
}

async function toggleNotifPanel() {
  const panel = document.querySelector('.mi-notif-panel');
  if (!panel.hidden) { panel.hidden = true; return; }
  const items = await getNotifications(15);
  panel.innerHTML = items.length
    ? `<h3>الإشعارات</h3>` + items.map((n) => `
        <div class="mi-notif-item" data-read="${n.read ? 'yes' : 'no'}">
          <b>${escapeHtml(n.title)}</b>
          ${n.body ? `<p>${escapeHtml(n.body)}</p>` : ''}
          <time>${escapeHtml(fmtDateTime(n.at))}</time>
        </div>`).join('')
    : '<h3>الإشعارات</h3><p class="mi-muted">لا إشعارات</p>';
  panel.hidden = false;
  await markAllRead();
  refreshNotifBadge();
}

function main(container) { return document.querySelector('.mi-main') || container; }

async function boot() {
  await initDataProvider(APP_CONFIG);
  await seedDemoDataIfEmpty();

  // في السحابة: استعادة جلسة Supabase القائمة قبل الحكم
  const { isCloudMode } = await import('./config.js');
  if (isCloudMode()) {
    const { restoreCloudSession } = await import('./services/auth-service.js');
    await restoreCloudSession();
  }

  // حارس الدخول: لا وصول لتطبيق الإدارة بلا جلسة (وإلزام تغيير كلمة المرور الأولى)
  const session = getSession();
  if (!session || session.mustChangePassword) {
    location.replace('./login.html');
    return;
  }
  // حساب الجهة الشريكة: نطاقه بوابة الشركاء فقط — اطلاع على بياناته ومتابعة مبادراته
  if (session.role === 'partner') {
    location.replace('./partner-portal.html');
    return;
  }
  setRole(session.role);
  setUserName(session.name);
  // تجاوزات صلاحيات الحساب (سماح/منع) تُطبق فوق مصفوفة الدور
  setOverridesProvider(() => getSession());

  initAccessibility();
  initNotifications();
  drawShell(session);
  refreshNotifBadge();

  const m = () => main();
  route('dashboard', () => renderDashboard(m()), 'لوحة المتابعة');
  route('initiatives', () => renderInitiativesList(m()), 'سجل المبادرات');
  route('initiatives/:id', (p) => renderInitiativeDetails(m(), p.id), 'تفاصيل المبادرة');
  route('portfolios', () => renderPortfolios(m()), 'محافظ المبادرات');
  route('needs', () => renderNeeds(m()), 'الاحتياجات');
  route('partners', () => renderPartners(m()), 'الشركاء');
  route('reviews', () => renderReviews(m()), 'المراجعات');
  route('decisions', () => renderDecisions(m()), 'القرارات');
  route('execution', () => renderExecution(m()), 'متابعة التنفيذ');
  route('benefits', () => renderBenefits(m()), 'إدارة المنافع');
  route('risks', () => renderRisks(m()), 'سجل المخاطر');
  route('quality', () => renderQuality(m()), 'فحوص الجودة');
  route('map', () => renderMap(m()), 'الخريطة');
  route('reports', () => renderReports(m()), 'التقارير');
  route('users', () => renderUsers(m()), 'المستخدمون والصلاحيات');
  route('settings', () => renderSettings(m()), 'الإعدادات');
  onNotFound((path) => {
    m().innerHTML = emptyState('الصفحة غير موجودة', `لا مسار باسم «${path}» داخل التطبيق`,
      '<a class="mi-btn mi-btn--primary" href="#/dashboard">العودة للوحة المتابعة</a>');
  });

  on(EVENTS.routeChanged, ({ path }) => markActiveNav(path));
  on(EVENTS.roleChanged, () => {
    const chip = document.querySelector('.mi-role-chip');
    if (chip) chip.textContent = getRoleLabel();
  });
  on(EVENTS.notification, refreshNotifBadge);

  const last = getLastRoute().replace(/^\//, '');
  startRouter(last || 'dashboard');

  // تسجيل Service Worker بنطاق المجلد الحالي فقط
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .catch((err) => console.warn('تعذر تسجيل Service Worker', err));
  }
}

boot().catch((err) => {
  console.error('فشل تشغيل المنصة', err);
  const root = document.getElementById('mi-app');
  if (root) root.innerHTML = `<div class="mi-boot-error"><h1>تعذر تشغيل المنصة</h1><p>${escapeHtml(err.message)}</p></div>`;
});
