import { DB, auth } from '../db.js';
import { escapeHtml, localDateStr, toast } from '../utils.js';
import { Icon } from '../icons.js';

const GOAL_KEY = 'il_weekly_goal';

function getWeeklyGoal() {
  const v = parseInt(localStorage.getItem(GOAL_KEY), 10);
  return Number.isFinite(v) && v > 0 ? v : 4;
}
function setWeeklyGoal(n) { localStorage.setItem(GOAL_KEY, String(n)); }

function daysAgo(dateStr) {
  if (!dateStr) return Infinity;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((today - date) / 86400000);
}

function sessionVolume(s) {
  return s.exercises.reduce((a, e) => a + e.sets.reduce((b, st) => b + (parseFloat(st.weight) || 0) * (parseInt(st.reps) || 0), 0), 0);
}
function sessionSets(s) {
  return s.exercises.reduce((a, e) => a + e.sets.length, 0);
}

function computeStreak(sessions) {
  const dates = [...new Set(sessions.map(s => s.date).filter(Boolean))].sort().reverse();
  if (!dates.length) return 0;
  const today = localDateStr();
  let cursor = new Date();
  // if no session logged today yet, start counting from yesterday
  if (dates[0] !== today) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  const dateSet = new Set(dates);
  for (;;) {
    const ds = localDateStr(cursor);
    if (dateSet.has(ds)) { streak++; cursor.setDate(cursor.getDate() - 1); }
    else break;
  }
  return streak;
}

function trendChip(current, prev) {
  if (prev <= 0 && current <= 0) return `<span class="metric-trend flat">—</span>`;
  if (prev <= 0) return `<span class="metric-trend up">New</span>`;
  const pct = Math.round(((current - prev) / prev) * 100);
  if (pct === 0) return `<span class="metric-trend flat">0%</span>`;
  const cls = pct > 0 ? 'up' : 'down';
  const sign = pct > 0 ? '+' : '';
  return `<span class="metric-trend ${cls}">${sign}${pct}%</span>`;
}

function fmtVol(v) {
  return v > 999 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));
}

function greetingWord() {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function displayName() {
  const u = auth?.currentUser;
  if (!u) return 'there';
  if (u.isAnonymous) return 'Guest';
  const email = u.email || '';
  const local = email.split('@')[0] || 'there';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function lineChart(points) {
  // points: array of {label, value}, oldest -> newest
  const w = 600, h = 150, padX = 6, padY = 14;
  const max = Math.max(...points.map(p => p.value), 1);
  const stepX = (w - padX * 2) / Math.max(points.length - 1, 1);
  const coords = points.map((p, i) => {
    const x = padX + i * stepX;
    const y = padY + (h - padY * 2) * (1 - (p.value / max));
    return { x, y, ...p };
  });
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${path} L ${coords[coords.length - 1].x.toFixed(1)} ${h - padY} L ${coords[0].x.toFixed(1)} ${h - padY} Z`;

  const gridLines = [0.25, 0.5, 0.75].map(f => {
    const y = padY + (h - padY * 2) * f;
    return `<line x1="${padX}" y1="${y}" x2="${w - padX}" y2="${y}" stroke="var(--border)" stroke-width="1" />`;
  }).join('');

  const dots = coords.map(c => `<circle class="chart-pt" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3.2"><title>${escapeHtml(c.label)}: ${fmtVol(c.value)} kg</title></circle>`).join('');

  const labelEvery = Math.ceil(coords.length / 6);
  const labels = coords.filter((_, i) => i % labelEvery === 0 || i === coords.length - 1)
    .map(c => `<text x="${c.x.toFixed(1)}" y="${h - 1}" font-size="9" fill="var(--muted)" text-anchor="middle">${escapeHtml(c.label)}</text>`).join('');

  return `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#7c4dff" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#7c4dff" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#7c4dff" />
          <stop offset="100%" stop-color="#9b7bff" />
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${areaPath}" fill="url(#areaGrad)" stroke="none" />
      <path d="${path}" fill="none" stroke="url(#lineGrad)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
      ${dots}
      ${labels}
    </svg>
  `;
}

export function render(container) {
  const sessions = DB.getSessions();
  const machines = DB.getMachines();

  if (!sessions.length) {
    container.innerHTML = `
      <div class="dash-greeting">
        <h1 class="dash-hello">${greetingWord()}, ${escapeHtml(displayName())} 👋</h1>
        <p class="dash-sub">Ready to crush today's workout?</p>
      </div>
      <div class="card empty">
        <div class="empty-title">NO WORKOUTS YET</div>
        <div class="empty-sub">Log your first session to unlock your dashboard.</div>
        <button id="dash-start" class="btn btn-accent" style="margin-top:14px;">${Icon.arrowRight} Start Workout</button>
      </div>
    `;
    container.querySelector('#dash-start').addEventListener('click', () => { location.hash = 'log'; });
    return;
  }

  const thisWeek = sessions.filter(s => daysAgo(s.date) < 7);
  const lastWeek = sessions.filter(s => daysAgo(s.date) >= 7 && daysAgo(s.date) < 14);
  const volThis = thisWeek.reduce((a, s) => a + sessionVolume(s), 0);
  const volLast = lastWeek.reduce((a, s) => a + sessionVolume(s), 0);
  const setsThis = thisWeek.reduce((a, s) => a + sessionSets(s), 0);
  const setsLast = lastWeek.reduce((a, s) => a + sessionSets(s), 0);
  const streak = computeStreak(sessions);

  const goal = getWeeklyGoal();
  const goalPct = Math.min(100, Math.round((thisWeek.length / goal) * 100));
  const ringR = 56, ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC * (1 - goalPct / 100);

  const last14 = [...Array(14)].map((_, i) => {
    const idx = 13 - i;
    const d = new Date(); d.setDate(d.getDate() - idx);
    const ds = localDateStr(d);
    const vol = sessions.filter(s => s.date === ds).reduce((a, s) => a + sessionVolume(s), 0);
    return { label: `${d.getMonth() + 1}/${d.getDate()}`, value: vol };
  });

  const todaySession = sessions.find(s => s.date === localDateStr());
  const recentPRs = machines.filter(m => m.weight > 0).sort((a, b) => b.weight - a.weight).slice(0, 4);
  const recentWorkouts = sessions.slice(0, 5);

  container.innerHTML = `
    <div class="dash-greeting">
      <h1 class="dash-hello">${greetingWord()}, ${escapeHtml(displayName())} 👋</h1>
      <p class="dash-sub">Ready to crush today's workout?</p>
    </div>

    <div class="dash-grid">
      <div class="metric-card">
        <div class="metric-top"><span class="metric-icon">${Icon.workout}</span>${trendChip(thisWeek.length, lastWeek.length)}</div>
        <div class="metric-val">${thisWeek.length}</div>
        <div class="metric-label">Workouts this week</div>
      </div>
      <div class="metric-card">
        <div class="metric-top"><span class="metric-icon">${Icon.stats}</span>${trendChip(volThis, volLast)}</div>
        <div class="metric-val">${fmtVol(volThis)} <span style="font-size:13px;color:var(--muted);">kg</span></div>
        <div class="metric-label">Total volume this week</div>
      </div>
      <div class="metric-card">
        <div class="metric-top"><span class="metric-icon">${Icon.check}</span>${trendChip(setsThis, setsLast)}</div>
        <div class="metric-val">${setsThis}</div>
        <div class="metric-label">Sets this week</div>
      </div>
      <div class="metric-card">
        <div class="metric-top"><span class="metric-icon">${Icon.trophy}</span><span class="metric-trend flat">${machines.filter(m => m.weight > 0).length}</span></div>
        <div class="metric-val">${sessions.length}</div>
        <div class="metric-label">Total sessions logged</div>
      </div>
    </div>

    <div class="dash-row">
      <div class="card chart-card">
        <div class="card-title">Activity</div>
        <div class="card-sub">Training volume — last 14 days</div>
        <div class="chart-wrap">${lineChart(last14)}</div>
      </div>

      <div class="card ring-card">
        <div class="card-title" style="align-self:flex-start;">Weekly Goal</div>
        <div class="ring-wrap">
          <svg viewBox="0 0 132 132">
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#7c4dff" />
                <stop offset="100%" stop-color="#9b7bff" />
              </linearGradient>
            </defs>
            <circle class="ring-track" cx="66" cy="66" r="${ringR}" />
            <circle class="ring-fill" cx="66" cy="66" r="${ringR}" stroke-dasharray="${ringC}" stroke-dashoffset="${ringOffset}" />
          </svg>
          <div class="ring-center">
            <div class="ring-pct">${goalPct}%</div>
            <div class="ring-pct-lbl">complete</div>
          </div>
        </div>
        <div class="ring-goal-txt">${thisWeek.length} / ${goal} workouts</div>
        <button id="edit-goal" class="ring-edit" type="button">Edit goal</button>
      </div>
    </div>

    <div class="dash-row">
      <div class="card today-card">
        <div class="section-head">
          <div class="card-title">Today's Activity</div>
        </div>
        ${todaySession ? `
          <div class="rw-tags" style="margin-bottom:8px;">${escapeHtml(todaySession.name)} — ${[...new Set(todaySession.exercises.map(e => e.muscle).filter(Boolean))].map(escapeHtml).join(' • ')}</div>
          ${todaySession.exercises.map(ex => `
            <div class="ex-line">
              <span class="ex-line-icon">${Icon.dumbbell}</span>
              <span class="ex-line-name">${escapeHtml(ex.name)}</span>
              <span class="ex-line-meta">${ex.sets.length} sets</span>
              <span class="ex-line-status done">${Icon.check}</span>
            </div>
          `).join('')}
          <button id="dash-continue" class="btn btn-ghost" style="width:100%; margin-top:12px;">Edit in Log</button>
        ` : `
          <div class="today-empty">
            <div class="empty-sub">No workout logged today yet.</div>
            <button id="dash-start2" class="btn btn-accent">${Icon.arrowRight} Start Workout</button>
          </div>
        `}
      </div>

      <div class="card">
        <div class="card-title">Goals</div>
        <div class="goal-item">
          <div class="goal-top"><span class="goal-name">Weekly Goal — Train ${goal}×</span><span class="goal-pct">${goalPct}%</span></div>
          <div class="goal-bar-bg"><div class="goal-bar-fill" style="width:${goalPct}%;"></div></div>
        </div>
        ${recentPRs.slice(0, 2).map(m => {
          const pct = m.target > 0 ? Math.min(100, Math.round((m.weight / m.target) * 100)) : 0;
          return m.target > 0 ? `
            <div class="goal-item">
              <div class="goal-top"><span class="goal-name">${escapeHtml(m.name)} — ${m.target}kg</span><span class="goal-pct">${pct}%</span></div>
              <div class="goal-bar-bg"><div class="goal-bar-fill" style="width:${pct}%;"></div></div>
            </div>
          ` : '';
        }).join('')}
        <div class="streak-row">
          <span class="streak-flame">${Icon.flame}</span>
          <div>
            <div class="streak-num">${streak} Day Streak</div>
            <div class="streak-lbl">Keep training to grow it</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="section-head">
        <div class="card-title">Recent Workouts</div>
        <button class="section-link" id="see-history">See all ${Icon.chevronRight}</button>
      </div>
      <div id="rw-list">${recentWorkouts.map(rwHtml).join('')}</div>
    </div>

    <div class="card">
      <div class="card-title" style="margin-bottom:14px;">Quick Actions</div>
      <div class="qa-grid">
        <button class="qa-btn primary" data-go="log"><span class="qa-icon">${Icon.workout}</span><span class="qa-lbl">Start Workout</span></button>
        <button class="qa-btn" data-go="machines"><span class="qa-icon">${Icon.trophy}</span><span class="qa-lbl">Add PR</span></button>
        <button class="qa-btn" data-go="stats"><span class="qa-icon">${Icon.stats}</span><span class="qa-lbl">View Progress</span></button>
        <button class="qa-btn" data-go="history"><span class="qa-icon">${Icon.history}</span><span class="qa-lbl">History</span></button>
        <button class="qa-btn" data-go="sync"><span class="qa-icon">${Icon.sync}</span><span class="qa-lbl">Backup</span></button>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => { location.hash = btn.dataset.go; });
  });
  const seeHistory = container.querySelector('#see-history');
  if (seeHistory) seeHistory.addEventListener('click', () => { location.hash = 'history'; });
  const cont = container.querySelector('#dash-continue');
  if (cont) cont.addEventListener('click', () => { location.hash = 'log'; });
  const start2 = container.querySelector('#dash-start2');
  if (start2) start2.addEventListener('click', () => { location.hash = 'log'; });
  const editGoal = container.querySelector('#edit-goal');
  if (editGoal) editGoal.addEventListener('click', () => {
    const val = window.prompt('Set your weekly workout goal (sessions per week):', String(goal));
    if (val === null) return;
    const n = parseInt(val, 10);
    if (!Number.isFinite(n) || n <= 0) { toast('Enter a number greater than 0'); return; }
    setWeeklyGoal(n);
    render(container);
  });

  // simple client-side search over recent workouts (real filter, not decorative)
  const searchInput = document.getElementById('global-search');
  if (searchInput) {
    const handler = () => {
      const q = searchInput.value.trim().toLowerCase();
      const list = container.querySelector('#rw-list');
      if (!list) return;
      const filtered = !q ? recentWorkouts : sessions.filter(s =>
        s.name.toLowerCase().includes(q) || s.exercises.some(e => e.name.toLowerCase().includes(q))
      ).slice(0, 8);
      list.innerHTML = filtered.length ? filtered.map(rwHtml).join('') : `<div class="empty-sub" style="padding:14px 0;">No workouts match "${escapeHtml(searchInput.value)}"</div>`;
    };
    searchInput.addEventListener('input', handler);
    container.dataset.searchBound = '1';
  }
}

function rwHtml(s) {
  const setCount = sessionSets(s);
  const vol = sessionVolume(s);
  const muscles = [...new Set(s.exercises.map(e => e.muscle).filter(Boolean))];
  return `
    <div class="rw-row">
      <span class="rw-icon">${Icon.dumbbell}</span>
      <div class="rw-main">
        <div class="rw-name">${escapeHtml(s.name)}</div>
        <div class="rw-tags">${muscles.map(escapeHtml).join(' • ') || '—'}</div>
        <div class="rw-meta">${escapeHtml(s.date || '')} · ${s.exercises.length} exercises · ${setCount} sets · ${fmtVol(vol)} kg</div>
      </div>
      <span class="rw-badge">${escapeHtml(s.timeStart || '')}</span>
    </div>
  `;
}
