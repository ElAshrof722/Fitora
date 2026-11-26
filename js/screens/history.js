import { DB } from '../db.js';
import { escapeHtml } from '../utils.js';

let openIds = new Set();

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function render(container) {
  const sessions = DB.getSessions();

  if (!sessions.length) {
    container.innerHTML = `
      <h1 class="page-title">History</h1>
      <p class="page-sub">All past sessions — tap to expand</p>
      <div class="empty">
        <div class="empty-title">NO SESSIONS YET</div>
        <div class="empty-sub">Log your first workout to see it here.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <h1 class="page-title">History</h1>
    <p class="page-sub">All past sessions — tap to expand</p>
    <div id="session-list"></div>
  `;

  const list = container.querySelector('#session-list');
  list.innerHTML = sessions.map((s, i) => sessionHtml(s, i)).join('');

  sessions.forEach((s, i) => {
    const key = s.id || i;
    const card = list.querySelector(`[data-session="${key}"]`);
    if (!card) return;
    card.querySelector('.session-header-main').addEventListener('click', () => {
      openIds.has(key) ? openIds.delete(key) : openIds.add(key);
      render(container);
    });
    card.querySelector('.del-btn').addEventListener('click', async () => {
      if (!window.confirm('Delete session? This cannot be undone.')) return;
      const updated = sessions.filter((_, idx) => idx !== i);
      await DB.setSessions(updated);
      render(container);
    });
  });
}

function muscleTotalsHtml(session) {
  const totals = {};
  session.exercises.forEach(e => { const m = e.muscle || 'Other'; totals[m] = (totals[m] || 0) + e.sets.length; });
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '';
  return `<div class="totals-chips" style="margin-bottom:12px;">${entries.map(([m, n]) => `<span class="total-chip"><b>${escapeHtml(m)}</b> ${n} sets</span>`).join('')}</div>`;
}

function sessionHtml(session, i) {
  const key = session.id || i;
  const open = openIds.has(key);
  const exCount = session.exercises.length;
  const setCount = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const prCount = session.exercises.reduce((a, e) => a + e.sets.filter(s => s.pr).length, 0);

  return `
    <div class="session-card" data-session="${key}">
      <div class="session-header">
        <button type="button" class="session-header-main">
          <div style="flex:1;">
            <div class="session-date">${formatDate(session.date)}</div>
            <div class="session-time">${escapeHtml(session.timeStart || '')}${session.timeEnd ? ` → ${escapeHtml(session.timeEnd)}` : ''} · ${escapeHtml(session.name)}</div>
            <div class="session-summary">${exCount} ex · ${setCount} sets${prCount ? ` · ★ ${prCount} PRs` : ''}</div>
          </div>
          <span class="chevron ${open ? 'open' : ''}">▾</span>
        </button>
        <button type="button" class="del-btn btn btn-danger btn-sm">Delete</button>
      </div>
      ${open ? `
        <div class="session-body">
          ${muscleTotalsHtml(session)}
          ${session.notes ? `<div class="session-notes">"${escapeHtml(session.notes)}"</div>` : ''}
          ${session.exercises.map(ex => `
            <div class="ex-row">
              <div class="ex-row-title">
                <span class="ex-row-name">${escapeHtml(ex.name)}</span>
                ${ex.muscle ? `<span class="badge">${escapeHtml(ex.muscle)}</span>` : ''}
              </div>
              <div class="pills">
                ${ex.sets.map((s, si) => `
                  <div class="pill ${s.pr ? 'pr' : ''}">Set ${si + 1}: ${s.weight ? `${escapeHtml(s.weight)}kg` : '—'} × ${escapeHtml(s.reps) || '—'}${s.pr ? ' ★' : ''}</div>
                `).join('')}
              </div>
              ${ex.sets.some(s => s.notes) ? `
                <ul class="set-notes">
                  ${ex.sets.map((s, si) => s.notes ? `<li><b>Set ${si + 1}:</b> ${escapeHtml(s.notes)}</li>` : '').join('')}
                </ul>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}
