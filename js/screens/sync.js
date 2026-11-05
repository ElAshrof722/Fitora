import { DB, getSyncMode, auth } from '../db.js';
import { toast } from '../utils.js';

export function render(container) {
  const mode = getSyncMode();
  const user = auth.currentUser;
  const cloud = mode === 'cloud';

  container.innerHTML = `
    <h1 class="page-title">Sync</h1>
    <p class="page-sub">Backups & cloud sync status</p>

    <div class="card" style="margin-bottom:16px;">
      <div class="card-title">Cloud Sync</div>
      <div class="sync-status">
        <span class="sync-dot ${cloud ? '' : 'offline'}"></span>
        <span style="font-size:12px;">${cloud
          ? `Signed in as ${user?.isAnonymous ? 'Guest' : (user?.email || 'account')} — data syncs live across devices.`
          : 'Local mode — data is stored only in this browser.'}</span>
      </div>
      <p class="desc">
        ${cloud
          ? 'Every change you make here is written straight to Firestore and pushed to any other device signed into the same account, in real time — no manual export needed.'
          : 'Sign in with an email account from the login screen to enable automatic cross-device cloud sync via Firebase.'}
      </p>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="card-title">⬇ Export Backup</div>
      <p class="desc">Save your full training log as a JSON file — a manual snapshot you can keep, in addition to cloud sync.</p>
      <button id="export-btn" class="btn btn-accent">Download Backup</button>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="card-title">⬆ Import Backup</div>
      <p class="desc">Load a previously exported backup file. This will <span style="color:var(--danger);">replace all current data</span>.</p>
      <input type="file" id="import-file" accept="application/json" hidden />
      <button id="import-btn" class="btn btn-ghost">Choose Backup File</button>
    </div>

    <div class="card">
      <div class="card-title">ℹ How sync works now</div>
      <p class="desc">
        1. Sign in with the same email/password on any device<br/>
        2. Your sessions and PRs sync instantly through Firebase — no file transfer needed<br/>
        3. Use "Download Backup" any time you want an offline copy or to migrate to a different account
      </p>
    </div>
  `;

  container.querySelector('#export-btn').addEventListener('click', async () => {
    const data = await DB.exportAll();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `fitora-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Backup downloaded');
  });

  const fileInput = container.querySelector('#import-file');
  container.querySelector('#import-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const ok = window.confirm(
        `This will replace all current data with:\n• ${(data.sessions || []).length} sessions\n• ${(data.machines || []).length} machines\n\nThis cannot be undone.`
      );
      if (!ok) return;
      await DB.importAll(data);
      toast('✅ Imported successfully');
    } catch (e) {
      toast('Could not import: ' + e.message);
    } finally {
      fileInput.value = '';
    }
  });
}
