import { DB } from '../db.js';
import { escapeHtml } from '../utils.js';

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
}
