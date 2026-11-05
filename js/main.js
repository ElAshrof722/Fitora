import './stopwatch.js';
import { initAuth } from './auth.js';
import { onDataChange, isLoading, auth } from './db.js';
import { toast } from './utils.js';
import { Icon } from './icons.js';
import * as DashboardScreen from './screens/dashboard.js';
import * as LogScreen from './screens/log.js';
import * as HistoryScreen from './screens/history.js';
import * as MachinesScreen from './screens/machines.js';
import * as StatsScreen from './screens/stats.js';
import * as SyncScreen from './screens/sync.js';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Icon.dashboard, screen: DashboardScreen },
  { id: 'log', label: 'Workout', icon: Icon.workout, screen: LogScreen },
  { id: 'history', label: 'History', icon: Icon.history, screen: HistoryScreen },
  { id: 'machines', label: 'PRs', icon: Icon.trophy, screen: MachinesScreen },
  { id: 'stats', label: 'Stats', icon: Icon.stats, screen: StatsScreen },
  { id: 'sync', label: 'Sync', icon: Icon.sync, screen: SyncScreen },
];

const mainContent = document.getElementById('main-content');
const sidebarNav = document.getElementById('sidebar-nav');
const tabsMobile = document.getElementById('tabs-mobile');
const logoutIcon = document.getElementById('logout-icon');
const searchIcon = document.getElementById('search-icon');
const bellIcon = document.getElementById('bell-icon');
const plusIcon = document.getElementById('plus-icon');
const userAvatar = document.getElementById('user-avatar');
const userEmailEl = document.getElementById('user-email');
const notifBtn = document.getElementById('notif-btn');
const quickAddBtn = document.getElementById('quick-add-btn');

if (logoutIcon) logoutIcon.innerHTML = Icon.logout;
if (searchIcon) searchIcon.innerHTML = Icon.search;
if (bellIcon) bellIcon.innerHTML = Icon.bell;
if (plusIcon) plusIcon.innerHTML = Icon.plus;

let activeTab = 'dashboard';
let started = false;

function tabFromHash() {
  const h = (location.hash || '').replace('#', '');
  return TABS.some(t => t.id === h) ? h : 'dashboard';
}

function renderNav() {
  sidebarNav.innerHTML = TABS.map(t => `
    <button data-tab="${t.id}" class="sidebar-item ${t.id === activeTab ? 'active' : ''}" title="${t.label}">
      <span class="nav-icon">${t.icon}</span><span class="nav-lbl">${t.label}</span>
    </button>
  `).join('');

  tabsMobile.innerHTML = TABS.map(t => `
    <button data-tab="${t.id}" class="${t.id === activeTab ? 'active' : ''}">
      <span class="icon">${t.icon}</span><span class="lbl">${t.label}</span>
    </button>
  `).join('');

  [...sidebarNav.querySelectorAll('button'), ...tabsMobile.querySelectorAll('button')].forEach(btn => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  });
}

function setTab(id) {
  activeTab = id;
  location.hash = id;
  renderNav();
  renderActive();
}

function renderActive() {
  if (isLoading()) {
    mainContent.innerHTML = `
      <div class="empty">
        <div class="empty-title">SYNCING</div>
        <div class="empty-sub">Loading your data from the cloud…</div>
      </div>
    `;
    return;
  }
  const tab = TABS.find(t => t.id === activeTab) || TABS[0];
  tab.screen.render(mainContent);
}

function updateUserChip() {
  const u = auth?.currentUser;
  const label = u ? (u.isAnonymous ? 'Guest' : (u.email || '')) : (userEmailEl.textContent || 'Guest');
  if (userEmailEl && !userEmailEl.textContent) userEmailEl.textContent = label;
  const source = (userEmailEl && userEmailEl.textContent) || label || 'G';
  if (userAvatar) userAvatar.textContent = source.trim().charAt(0).toUpperCase() || 'G';
}

function startApp() {
  if (started) {
    updateUserChip();
    return;
  }
  started = true;
  activeTab = tabFromHash();
  renderNav();
  renderActive();
  updateUserChip();

  window.addEventListener('hashchange', () => {
    activeTab = tabFromHash();
    renderNav();
    renderActive();
  });

  // Re-render the current screen whenever the underlying data changes
  // (e.g. a Firestore realtime update from another device).
  onDataChange(() => {
    if (started) renderActive();
  });

  if (notifBtn) notifBtn.addEventListener('click', () => toast('No new notifications'));
  if (quickAddBtn) quickAddBtn.addEventListener('click', () => setTab('log'));
}

initAuth(startApp);
