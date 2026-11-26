import { DB } from '../db.js';
import { escapeHtml, localDateStr } from '../utils.js';

export function render(container) {
  const sessions = DB.getSessions();
  const machines = DB.getMachines();

  if (!sessions.length) {
    container.innerHTML = `
      <h1 class="page-title">Stats</h1>
      <p class="page-sub">Your training overview</p>
      <div class="empty">
        <div class="empty-title">NO DATA YET</div>
        <div class="empty-sub">Complete some sessions to see your stats.</div>
      </div>
    `;
    return;
  }

  const totalSets = sessions.reduce((a, s) => a + s.exercises.reduce((b, e) => b + e.sets.length, 0), 0);
  const totalPRs = sessions.reduce((a, s) => a + s.exercises.reduce((b, e) => b + e.sets.filter(st => st.pr).length, 0), 0);

  const last7 = sessions.slice(0, 7).reverse();
  const volumes = last7.map(s =>
    s.exercises.reduce((a, e) => a + e.sets.reduce((b, st) => b + (parseFloat(st.weight) || 0) * (parseInt(st.reps) || 0), 0), 0)
  );
  const maxVol = Math.max(...volumes, 1);

  const muscleCounts = {};
  sessions.forEach(s => s.exercises.forEach(e => { if (e.muscle) muscleCounts[e.muscle] = (muscleCounts[e.muscle] || 0) + 1; }));
  const topMuscles = Object.entries(muscleCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const prMachines = machines.filter(m => m.weight > 0).sort((a, b) => b.weight - a.weight);

  container.innerHTML = `
    <h1 class="page-title">Stats</h1>
    <p class="page-sub">Your training overview</p>

    <div class="stats-row">
      <div class="stat-card"><div class="stat-val">${sessions.length}</div><div class="stat-label">Sessions</div></div>
      <div class="stat-card"><div class="stat-val">${totalSets}</div><div class="stat-label">Total Sets</div></div>
      <div class="stat-card"><div class="stat-val">${totalPRs}</div><div class="stat-label">PRs Hit</div></div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="card-title">Volume — Last ${last7.length} Sessions</div>
      <div class="card-sub">kg × reps per session</div>
      <div class="bar-chart">
        ${last7.map((s, i) => {
          const h = Math.max(4, Math.round((volumes[i] / maxVol) * 90));
          const val = volumes[i] > 999 ? `${(volumes[i] / 1000).toFixed(1)}k` : Math.round(volumes[i]);
          return `
            <div class="bar-col">
              <div class="bar-val">${val}</div>
              <div class="bar" style="height:${h}px;"></div>
              <div class="bar-label">${s.date ? escapeHtml(s.date.slice(5)) : ''}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    ${topMuscles.length ? `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">Top Muscle Groups</div>
        ${topMuscles.map(([m, n]) => `
          <div class="muscle-row">
            <span class="badge">${escapeHtml(m)}</span>
            <div class="muscle-bar"><div class="muscle-bar-fill" style="width:${Math.round((n / topMuscles[0][1]) * 100)}%;"></div></div>
            <span class="muscle-count">${n}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <div class="card" id="sets-card" style="margin-bottom:16px;"></div>

    ${prMachines.length ? `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">Personal Records</div>
        <div class="pr-grid">
          ${prMachines.map(m => `
            <div class="pr-item">
              <div class="pr-item-name">${escapeHtml(m.name)}</div>
              <div class="pr-item-val">${m.weight} kg</div>
              ${m.target ? `<div class="pr-item-target">goal: ${m.target} kg</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
  renderSetsCard(container.querySelector('#sets-card'), sessions);
}

// ---------------------------------------------------------------
// Sets per muscle group — by Day / Week / Total
// ---------------------------------------------------------------
const WEEK_START = 1; // 0 = Sunday, 1 = Monday, 6 = Saturday — change if your week starts on another day

let setsMode = 'total';   // 'day' | 'week' | 'total'
let setsDay = null;       // YYYY-MM-DD
let setsWeek = null;      // YYYY-MM-DD (first day of the week)

function parseDate(ds) { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d); }
function weekStartOf(ds) {
  const dt = parseDate(ds);
  dt.setDate(dt.getDate() - ((dt.getDay() - WEEK_START + 7) % 7));
  return localDateStr(dt);
}
function fmtShort(ds) { return parseDate(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function fmtDay(ds) { return parseDate(ds).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); }
function weekLabel(ws) {
  const end = parseDate(ws); end.setDate(end.getDate() + 6);
  const label = `${fmtShort(ws)} – ${fmtShort(localDateStr(end))}`;
  return ws === weekStartOf(localDateStr()) ? `This week (${label})` : label;
}

function renderSetsCard(card, sessions) {
  if (!card) return;
  const dated = sessions.filter(s => s.date);
  const days = [...new Set(dated.map(s => s.date))].sort().reverse();
  const weekSet = new Set(dated.map(s => weekStartOf(s.date)));
  weekSet.add(weekStartOf(localDateStr()));            // always offer the current week
  const weeks = [...weekSet].sort().reverse();

  if (!setsDay || !days.includes(setsDay)) setsDay = days[0] || null;
  if (!setsWeek || !weeks.includes(setsWeek)) setsWeek = weekStartOf(localDateStr());

  let scoped;
  if (setsMode === 'day') scoped = dated.filter(s => s.date === setsDay);
  else if (setsMode === 'week') scoped = dated.filter(s => weekStartOf(s.date) === setsWeek);
  else scoped = sessions;

  const totals = {};
  scoped.forEach(s => s.exercises.forEach(e => { const m = e.muscle || 'Other'; totals[m] = (totals[m] || 0) + e.sets.length; }));
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const all = entries.reduce((a, [, n]) => a + n, 0);

  const picker = setsMode === 'day'
    ? `<select class="input sets-select" id="sets-day">${days.map(d => `<option value="${d}" ${d === setsDay ? 'selected' : ''}>${escapeHtml(fmtDay(d))}</option>`).join('')}</select>`
    : setsMode === 'week'
      ? `<select class="input sets-select" id="sets-week">${weeks.map(w => `<option value="${w}" ${w === setsWeek ? 'selected' : ''}>${escapeHtml(weekLabel(w))}</option>`).join('')}</select>`
      : '';

  card.innerHTML = `
    <div class="card-title">Total Sets by Muscle <span class="totals-all">${all} sets</span></div>
    <div class="seg" role="tablist">
      ${[['day', 'Day'], ['week', 'Week'], ['total', 'Total']].map(([k, l]) =>
        `<button type="button" class="seg-btn ${setsMode === k ? 'active' : ''}" data-mode="${k}">${l}</button>`).join('')}
    </div>
    ${picker}
    ${entries.length ? entries.map(([m, n]) => `
      <div class="muscle-row">
        <span class="badge">${escapeHtml(m)}</span>
        <div class="muscle-bar"><div class="muscle-bar-fill" style="width:${Math.round((n / entries[0][1]) * 100)}%;"></div></div>
        <span class="muscle-count">${n}</span>
      </div>`).join('') : `<div class="empty-sub" style="padding:14px 0;">No sets logged for this ${setsMode === 'day' ? 'day' : 'week'}.</div>`}
  `;

  card.querySelectorAll('.seg-btn').forEach(b => b.addEventListener('click', () => { setsMode = b.dataset.mode; renderSetsCard(card, sessions); }));
  const dSel = card.querySelector('#sets-day');
  if (dSel) dSel.addEventListener('change', e => { setsDay = e.target.value; renderSetsCard(card, sessions); });
  const wSel = card.querySelector('#sets-week');
  if (wSel) wSel.addEventListener('change', e => { setsWeek = e.target.value; renderSetsCard(card, sessions); });
}
