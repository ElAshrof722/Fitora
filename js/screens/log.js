import { DB } from '../db.js';
import { MUSCLES, localDateStr, uid, escapeHtml, toast } from '../utils.js';

function makeSet(prev) {
  return { weight: prev?.weight || '', reps: prev?.reps || '', pr: false, notes: '' }; // note is never copied
}
function makeExercise() {
  return { id: uid(), name: '', muscle: 'Chest', sets: [makeSet()] };
}

// Every machine/exercise the user already has: saved machines first, then
// any names used in past sessions. Keyed by lowercase name to avoid dupes.
function getKnownExercises() {
  const map = new Map();
  DB.getMachines().forEach(m => {
    if (m.name) map.set(m.name.toLowerCase(), { name: m.name, muscle: m.muscle });
  });
  DB.getSessions().forEach(s => (s.exercises || []).forEach(e => {
    if (e.name && !map.has(e.name.toLowerCase())) map.set(e.name.toLowerCase(), { name: e.name, muscle: e.muscle });
  }));
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

let exercises = [makeExercise()];
let sessName = '';
let notes = '';
let date = localDateStr();
let timeStart = new Date().toTimeString().slice(0, 5);
let timeEnd = '';
let openMusclePicker = null; // exercise id

export function render(container) {
  const today = new Date();

  container.innerHTML = `
    <div class="page-title-wrap" style="margin-bottom:16px;">
      <h1 class="page-title">Today's Workout</h1>
      <p class="page-sub">${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="row2">
        <div>
          <label class="field-label">Date</label>
          <input id="f-date" class="input" placeholder="YYYY-MM-DD" value="${escapeHtml(date)}" />
        </div>
        <div>
          <label class="field-label">Workout Name</label>
          <input id="f-name" class="input" placeholder="Push Day A" value="${escapeHtml(sessName)}" />
        </div>
      </div>
      <div class="row2">
        <div>
          <label class="field-label">Start</label>
          <input id="f-start" class="input" placeholder="HH:MM" value="${escapeHtml(timeStart)}" />
        </div>
        <div>
          <label class="field-label">End</label>
          <input id="f-end" class="input" placeholder="HH:MM" value="${escapeHtml(timeEnd)}" />
        </div>
      </div>
      <label class="field-label">Notes</label>
      <textarea id="f-notes" class="input" rows="2" placeholder="How are you feeling...">${escapeHtml(notes)}</textarea>
    </div>

    <div id="ex-list"></div>

    <div id="muscle-totals"></div>

    <div class="actions">
      <button id="add-ex" class="btn btn-ghost">+ Exercise</button>
      <button id="save-log" class="btn btn-accent">💾 Save</button>
      <button id="clear-log" class="btn btn-ghost">Clear</button>
    </div>
  `;

  container.querySelector('#f-date').addEventListener('input', e => date = e.target.value);
  container.querySelector('#f-name').addEventListener('input', e => sessName = e.target.value);
  container.querySelector('#f-start').addEventListener('input', e => timeStart = e.target.value);
  container.querySelector('#f-end').addEventListener('input', e => timeEnd = e.target.value);
  container.querySelector('#f-notes').addEventListener('input', e => notes = e.target.value);

  container.querySelector('#add-ex').addEventListener('click', () => {
    exercises.push(makeExercise());
    renderExercises(container.querySelector('#ex-list'));
  });

  container.querySelector('#save-log').addEventListener('click', () => save(container));
  container.querySelector('#clear-log').addEventListener('click', () => {
    if (!window.confirm('This will clear the current workout.')) return;
    exercises = [makeExercise()];
    sessName = ''; notes = '';
    render(container);
  });

  renderExercises(container.querySelector('#ex-list'));
}

// Sets per muscle group for the workout currently being logged.
function renderMuscleTotals() {
  const el = document.getElementById('muscle-totals');
  if (!el) return;
  const totals = {};
  exercises.forEach(ex => {
    if (!ex.name.trim()) return;
    totals[ex.muscle] = (totals[ex.muscle] || 0) + ex.sets.length;
  });
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (!entries.length) { el.innerHTML = ''; return; }
  const all = entries.reduce((a, [, n]) => a + n, 0);
  el.innerHTML = `
    <div class="card totals-card">
      <div class="card-title">Sets by muscle <span class="totals-all">${all} total</span></div>
      <div class="totals-chips">
        ${entries.map(([m, n]) => `<span class="total-chip"><b>${escapeHtml(m)}</b> ${n}</span>`).join('')}
      </div>
    </div>`;
}

function renderExercises(listEl) {
  listEl.innerHTML = exercises.map(ex => exerciseHtml(ex)).join('');
  renderMuscleTotals();

  exercises.forEach(ex => {
    const block = listEl.querySelector(`[data-ex="${ex.id}"]`);
    if (!block) return;

    const nameInput = block.querySelector('.ex-name');
    nameInput.addEventListener('input', e => { ex.name = e.target.value; renderMuscleTotals(); });
    // When a known machine/exercise is picked, fill in its muscle group.
    nameInput.addEventListener('change', e => {
      ex.name = e.target.value;
      const known = getKnownExercises().find(k => k.name.toLowerCase() === ex.name.trim().toLowerCase());
      if (known && known.muscle && known.muscle !== ex.muscle) {
        ex.muscle = known.muscle;
        renderExercises(listEl);
      }
    });
    block.querySelector('.pick-btn').addEventListener('click', () => {
      openPicker(picked => {
        ex.name = picked.name;
        if (picked.muscle) ex.muscle = picked.muscle;
        renderExercises(listEl);
      });
    });
    block.querySelector('.muscle-btn').addEventListener('click', () => {
      openMusclePicker = openMusclePicker === ex.id ? null : ex.id;
      renderExercises(listEl);
    });

    block.querySelectorAll('.muscle-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        ex.muscle = btn.dataset.muscle;
        openMusclePicker = null;
        renderExercises(listEl);
      });
    });

    ex.sets.forEach((s, si) => {
      const row = block.querySelector(`[data-set="${si}"]`);
      if (!row) return;
      row.querySelector('.set-weight').addEventListener('input', e => { s.weight = e.target.value; });
      row.querySelector('.set-reps').addEventListener('input', e => { s.reps = e.target.value; });
      const noteEl = block.querySelector(`[data-note="${si}"]`);
      if (noteEl) noteEl.addEventListener('input', e => { s.notes = e.target.value; });
      row.querySelector('.pr-toggle').addEventListener('click', () => {
        s.pr = !s.pr;
        renderExercises(listEl);
      });
      const delBtn = row.querySelector('.del-set');
      if (delBtn) delBtn.addEventListener('click', () => {
        ex.sets = ex.sets.filter((_, i) => i !== si);
        renderExercises(listEl);
      });
    });

    block.querySelector('.add-set-btn').addEventListener('click', () => {
      const last = ex.sets[ex.sets.length - 1];
      ex.sets.push(makeSet(last));
      renderExercises(listEl);
    });
    block.querySelector('.remove-ex-btn').addEventListener('click', () => {
      if (exercises.length <= 1) return;
      exercises = exercises.filter(e => e.id !== ex.id);
      renderExercises(listEl);
    });
  });
}

// Bottom-sheet on phones / centered dialog on desktop: searchable list of
// every machine + exercise the user has saved or used before.
function openPicker(onPick) {
  const known = getKnownExercises();
  const overlay = document.createElement('div');
  overlay.className = 'pick-overlay';
  overlay.innerHTML = `
    <div class="pick-sheet" role="dialog" aria-label="Choose machine or exercise">
      <div class="sw-handle"></div>
      <div class="pick-title">Machines &amp; Exercises</div>
      <input class="input pick-search" type="search" placeholder="Search…" autocomplete="off" />
      <div class="pick-filters"></div>
      <div class="pick-list"></div>
      <button type="button" class="link-btn pick-close">Close</button>
    </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('no-scroll');

  const listEl = overlay.querySelector('.pick-list');
  const filtersEl = overlay.querySelector('.pick-filters');
  const search = overlay.querySelector('.pick-search');
  let activeMuscle = 'All';
  // Only offer muscle groups the user actually has exercises for.
  const usedMuscles = MUSCLES.filter(m => known.some(k => k.muscle === m));
  const filterNames = ['All', ...usedMuscles];
  const close = () => { overlay.remove(); document.body.classList.remove('no-scroll'); };

  function drawFilters() {
    filtersEl.innerHTML = filterNames.map(m => {
      const n = m === 'All' ? known.length : known.filter(k => k.muscle === m).length;
      return `<button type="button" class="pick-chip ${activeMuscle === m ? 'active' : ''}" data-m="${escapeHtml(m)}">${escapeHtml(m)} <span>${n}</span></button>`;
    }).join('');
    filtersEl.querySelectorAll('.pick-chip').forEach(b => b.addEventListener('click', () => {
      activeMuscle = b.dataset.m;
      drawFilters();
      draw();
    }));
  }

  function draw() {
    const q = search.value.trim().toLowerCase();
    const items = known.filter(k =>
      (activeMuscle === 'All' || k.muscle === activeMuscle) && k.name.toLowerCase().includes(q));
    listEl.innerHTML = items.length
      ? items.map((k, i) => `<button type="button" class="pick-item" data-i="${i}"><span>${escapeHtml(k.name)}</span><span class="badge">${escapeHtml(k.muscle || '')}</span></button>`).join('')
      : `<div class="pick-empty">${known.length ? 'No match.' : 'Nothing saved yet — add machines on the PRs tab, or just type a name.'}</div>`;
    listEl.querySelectorAll('.pick-item').forEach(btn => {
      btn.addEventListener('click', () => { const k = items[+btn.dataset.i]; close(); onPick(k); });
    });
  }
  search.addEventListener('input', draw);
  overlay.querySelector('.pick-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  drawFilters();
  draw();
}

function exerciseHtml(ex) {
  return `
    <div class="ex-block" data-ex="${ex.id}">
      <div class="ex-header">
        <input class="ex-name" autocomplete="off" placeholder="Exercise / Machine name" value="${escapeHtml(ex.name)}" />
        <button class="pick-btn" type="button" title="Choose from my machines" aria-label="Choose from my machines">☰</button>
        <button class="muscle-btn" type="button">${escapeHtml(ex.muscle)} ▾</button>
      </div>
      ${openMusclePicker === ex.id ? `
        <div class="muscle-picker">
          ${MUSCLES.map(m => `<button type="button" class="muscle-opt ${ex.muscle === m ? 'active' : ''}" data-muscle="${m}">${m}</button>`).join('')}
        </div>` : ''}
      <div class="sets-header">
        <span style="width:20px;">#</span><span style="width:64px;">KG</span><span style="width:54px;">REPS</span><span style="flex:1;">PR</span>
      </div>
      ${ex.sets.map((s, si) => `
        <div class="set-row" data-set="${si}">
          <span class="set-num">${si + 1}</span>
          <input class="set-input set-weight" style="width:64px;" placeholder="kg" value="${escapeHtml(s.weight)}" inputmode="decimal" />
          <input class="set-input set-reps" style="width:54px;" placeholder="reps" value="${escapeHtml(s.reps)}" inputmode="numeric" />
          <button type="button" class="pr-toggle ${s.pr ? 'active' : ''}">PR ★</button>
          ${ex.sets.length > 1 ? `<button type="button" class="del-set">×</button>` : ''}
        </div>
        <input class="set-note" data-note="${si}" placeholder="Note for set ${si + 1} (optional)" value="${escapeHtml(s.notes || '')}" autocomplete="off" />
      `).join('')}
      <div class="ex-footer">
        <button type="button" class="add-set-btn">+ Add Set</button>
        <button type="button" class="remove-ex-btn">Remove</button>
      </div>
    </div>
  `;
}

async function autoUpdatePRs(exs) {
  let machines = [...DB.getMachines()];
  exs.forEach(ex => {
    if (!ex.name.trim()) return;
    const prSets = ex.sets.filter(s => s.pr && parseFloat(s.weight) > 0);
    if (!prSets.length) return;
    const maxW = Math.max(...prSets.map(s => parseFloat(s.weight)));
    let m = machines.find(mc => mc.name.toLowerCase() === ex.name.toLowerCase());
    if (!m) {
      machines.push({ id: uid(), name: ex.name, muscle: ex.muscle, weight: maxW, target: 0 });
    } else if (maxW > (parseFloat(m.weight) || 0)) {
      m.weight = maxW;
    }
  });
  await DB.setMachines(machines);
}

async function save(container) {
  if (!date) { toast('Please add a date'); return; }
  const validEx = exercises.filter(e => e.name.trim());
  if (!validEx.length) { toast('Add at least one exercise'); return; }

  const sessions = [...DB.getSessions()];
  const session = {
    id: uid(), date, timeStart,
    timeEnd: timeEnd || new Date().toTimeString().slice(0, 5),
    name: sessName || 'Workout', notes,
    exercises: JSON.parse(JSON.stringify(validEx)),
  };
  sessions.unshift(session);
  await DB.setSessions(sessions);
  await autoUpdatePRs(validEx);

  toast('💪 Saved!');
  exercises = [makeExercise()];
  sessName = ''; notes = ''; timeEnd = '';
  render(container);
}
