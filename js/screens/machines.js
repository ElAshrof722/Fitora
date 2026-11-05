import { DB } from '../db.js';
import { MUSCLES, uid, escapeHtml, toast } from '../utils.js';

let name = '', muscle = 'Chest', weight = '', target = '';
let muscleOpen = false;
let editingId = null;

export function render(container) {
  const machines = DB.getMachines();
  const groups = {};
  machines.forEach(m => { (groups[m.muscle] ||= []).push(m); });

  container.innerHTML = `
    <h1 class="page-title">PRs & Machines</h1>
    <p class="page-sub">Track your personal records</p>

    <div class="card" style="margin-bottom:20px;">
      <div class="form-title">${editingId ? 'Edit Machine' : 'Add Machine / Exercise'}</div>
      <label class="field-label">Name</label>
      <input id="m-name" class="input" placeholder="e.g. Bench Press" value="${escapeHtml(name)}" />

      <label class="field-label">Muscle Group</label>
      <button type="button" id="m-muscle-trigger" class="muscle-trigger">
        <span>${escapeHtml(muscle)}</span><span>▾</span>
      </button>
      ${muscleOpen ? `
        <div class="muscle-picker">
          ${MUSCLES.map(m => `<button type="button" class="muscle-opt ${muscle === m ? 'active' : ''}" data-muscle="${m}">${m}</button>`).join('')}
        </div>` : ''}

      <div class="row2" style="margin-top:10px;">
        <div>
          <label class="field-label">Max Weight (kg)</label>
          <input id="m-weight" class="input" placeholder="0" value="${escapeHtml(weight)}" inputmode="decimal" />
        </div>
        <div>
          <label class="field-label">Target (kg)</label>
          <input id="m-target" class="input" placeholder="0" value="${escapeHtml(target)}" inputmode="decimal" />
        </div>
      </div>

      <div class="form-btns">
        <button id="m-save" class="btn btn-accent">${editingId ? 'Update' : 'Save Machine'}</button>
        ${editingId ? `<button id="m-cancel" class="btn btn-ghost">Cancel</button>` : ''}
      </div>
    </div>

    <div id="machine-list">
      ${machines.length === 0 ? `
        <div class="empty">
          <div class="empty-title">NO MACHINES YET</div>
          <div class="empty-sub">Add your first machine above.</div>
        </div>
      ` : Object.keys(groups).sort().map(g => groupHtml(g, groups[g])).join('')}
    </div>
  `;

  container.querySelector('#m-name').addEventListener('input', e => name = e.target.value);
  container.querySelector('#m-weight').addEventListener('input', e => weight = e.target.value);
  container.querySelector('#m-target').addEventListener('input', e => target = e.target.value);
  container.querySelector('#m-muscle-trigger').addEventListener('click', () => { muscleOpen = !muscleOpen; render(container); });
  container.querySelectorAll('.muscle-opt').forEach(btn => {
    btn.addEventListener('click', () => { muscle = btn.dataset.muscle; muscleOpen = false; render(container); });
  });
  container.querySelector('#m-save').addEventListener('click', () => saveMachine(container));
  const cancelBtn = container.querySelector('#m-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', () => {
    editingId = null; name = ''; weight = ''; target = '';
    render(container);
  });

  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = machines.find(mm => String(mm.id) === btn.dataset.id);
      if (!m) return;
      editingId = m.id; name = m.name; muscle = m.muscle;
      weight = String(m.weight || ''); target = String(m.target || '');
      render(container);
    });
  });
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!window.confirm('Remove this machine/PR record?')) return;
      const updated = machines.filter(mm => String(mm.id) !== btn.dataset.id);
      await DB.setMachines(updated);
      render(container);
    });
  });
}

function groupHtml(group, list) {
  return `
    <div class="group-header"><span class="badge">${escapeHtml(group)}</span></div>
    ${list.map(m => machineHtml(m)).join('')}
  `;
}

function machineHtml(m) {
  const hasPR = m.weight > 0;
  const progress = m.target > 0 ? Math.min(100, Math.round((m.weight / m.target) * 100)) : 0;
  return `
    <div class="machine-card ${hasPR ? 'has-pr' : ''}">
      ${hasPR ? `<span class="pr-star">★</span>` : ''}
      <div style="flex:1;">
        <div class="machine-name">${escapeHtml(m.name)}</div>
        <div class="machine-weight">${m.weight ? `${m.weight} kg` : '—'}${m.target ? ` <span class="machine-target">/ goal ${m.target} kg</span>` : ''}</div>
        ${m.target > 0 ? `
          <div class="progress-bg"><div class="progress-fill" style="width:${progress}%;"></div></div>
          <div class="progress-label">${progress}% to goal</div>
        ` : ''}
      </div>
      <div class="machine-btns">
        <button type="button" class="edit-btn" data-id="${m.id}">Edit</button>
        <button type="button" class="delete-btn" data-id="${m.id}">Delete</button>
      </div>
    </div>
  `;
}

async function saveMachine(container) {
  if (!name.trim()) { toast('Enter a name'); return; }
  let updated = [...DB.getMachines()];
  if (editingId !== null) {
    updated = updated.map(m => m.id === editingId
      ? { ...m, name: name.trim(), muscle, weight: parseFloat(weight) || 0, target: parseFloat(target) || 0 }
      : m
    );
    editingId = null;
  } else {
    const existing = updated.find(m => m.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.muscle = muscle;
      existing.weight = parseFloat(weight) || 0;
      existing.target = parseFloat(target) || 0;
    } else {
      updated.push({ id: uid(), name: name.trim(), muscle, weight: parseFloat(weight) || 0, target: parseFloat(target) || 0 });
    }
  }
  await DB.setMachines(updated);
  name = ''; weight = ''; target = ''; muscle = 'Chest';
  render(container);
}
