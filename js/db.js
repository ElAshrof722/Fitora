import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, sendPasswordResetEmail, signInAnonymously,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let app, auth, dbFs;
let initError = null;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  dbFs = getFirestore(app);
} catch (err) {
  console.error('Firebase failed to initialize:', err);
  initError = err;
}
export { auth };

export const isConfigured = !initError && !String(firebaseConfig.apiKey || '').includes('YOUR_API_KEY');
export const configErrorMessage = initError ? (initError.message || 'Firebase failed to initialize.') : null;

// ------------------------------------------------------------
// Local fallback (used for "Continue as Guest" / when Firebase
// isn't configured yet) so the app is still usable without setup.
// ------------------------------------------------------------
const LOCAL_KEYS = { sessions: 'il_sessions', machines: 'il_machines' };
const Local = {
  getSessions() { try { return JSON.parse(localStorage.getItem(LOCAL_KEYS.sessions)) || []; } catch { return []; } },
  setSessions(v) { localStorage.setItem(LOCAL_KEYS.sessions, JSON.stringify(v)); },
  getMachines() { try { return JSON.parse(localStorage.getItem(LOCAL_KEYS.machines)) || []; } catch { return []; } },
  setMachines(v) { localStorage.setItem(LOCAL_KEYS.machines, JSON.stringify(v)); },
};

// True if this browser has locally-stored guest data. Used to offer a
// one-time merge into a cloud account right after sign-up/sign-in,
// instead of silently discarding it (previously: bug #2).
export function hasLocalGuestData() {
  return Local.getSessions().length > 0 || Local.getMachines().length > 0;
}

let mode = 'local'; // 'local' | 'cloud'
let currentUid = null;
let cache = { sessions: [], machines: [] };
let loading = false; // true while waiting on the first cloud snapshot
let unsub = null;
const listeners = new Set();

function notify() { listeners.forEach(fn => fn(cache)); }

export function onDataChange(fn) {
  listeners.add(fn);
  fn(cache);
  return () => listeners.delete(fn);
}

// opts.mergeLocal: if true, once the first cloud snapshot arrives, any
// local guest data on this device is merged into the cloud cache and
// then cleared from localStorage (so it only ever happens once).
export function setMode(nextMode, uid, opts = {}) {
  mode = nextMode;
  currentUid = uid || null;
  if (unsub) { unsub(); unsub = null; }

  if (mode === 'cloud' && currentUid) {
    loading = true;
    let firstSnapshot = true;
    const wantsMerge = !!opts.mergeLocal;
    const ref = doc(dbFs, 'users', currentUid);
    unsub = onSnapshot(ref, async snap => {
      loading = false;
      const data = snap.exists() ? snap.data() : { sessions: [], machines: [] };
      cache = { sessions: data.sessions || [], machines: data.machines || [] };

      if (firstSnapshot) {
        firstSnapshot = false;
        if (wantsMerge && hasLocalGuestData()) {
          await mergeLocalGuestData();
          return; // mergeLocalGuestData() already persists + notifies
        }
      }
      notify();
    }, err => {
      loading = false;
      console.error('Firestore sync error:', err);
      toastError('Cloud sync error — check your Firestore security rules.');
      notify();
    });
  } else {
    loading = false;
    cache = { sessions: Local.getSessions(), machines: Local.getMachines() };
    notify();
  }
}

// Merges any local-guest sessions/machines on this device into the
// current (cloud) cache. Sessions are simply concatenated (they carry
// their own unique ids). Machines are merged by name, keeping the
// higher recorded weight and any existing target. Local storage is
// cleared afterward so this only ever runs once per browser.
async function mergeLocalGuestData() {
  const localSessions = Local.getSessions();
  const localMachines = Local.getMachines();

  const mergedSessions = [...localSessions, ...cache.sessions];

  const byName = new Map();
  [...cache.machines, ...localMachines].forEach(m => {
    const key = String(m.name || '').toLowerCase();
    const existing = byName.get(key);
    if (!existing) { byName.set(key, { ...m }); return; }
    byName.set(key, {
      ...existing,
      weight: Math.max(parseFloat(existing.weight) || 0, parseFloat(m.weight) || 0),
      target: existing.target || m.target,
    });
  });

  cache = { sessions: mergedSessions, machines: [...byName.values()] };
  await persist();
  Local.setSessions([]);
  Local.setMachines([]);
  notify();
}

export function isLoading() { return loading; }

function toastError(msg) {
  window.dispatchEvent(new CustomEvent('il-toast', { detail: msg }));
}

async function persist() {
  if (mode === 'cloud' && currentUid) {
    const ref = doc(dbFs, 'users', currentUid);
    await setDoc(ref, { ...cache, updatedAt: Date.now() }, { merge: true });
  } else {
    Local.setSessions(cache.sessions);
    Local.setMachines(cache.machines);
    notify();
  }
}

export const DB = {
  getSessions() { return cache.sessions; },
  getMachines() { return cache.machines; },
  async setSessions(data) { cache = { ...cache, sessions: data }; await persist(); },
  async setMachines(data) { cache = { ...cache, machines: data }; await persist(); },
  async exportAll() {
    return { sessions: cache.sessions, machines: cache.machines, exported: new Date().toISOString() };
  },
  async importAll(data) {
    cache = { sessions: data.sessions || [], machines: data.machines || [] };
    await persist();
  },
};

export function getSyncMode() { return mode; }

// ------------------------------------------------------------
// Auth helpers
// ------------------------------------------------------------
export function watchAuth(cb) {
  if (!auth) return () => {}; // Firebase failed to init — stay on login screen, Guest still works locally
  return onAuthStateChanged(auth, cb);
}
export async function signUp(email, password) {
  if (!auth) throw new Error('Firebase isn\u2019t set up yet — check js/firebase-config.js.');
  await createUserWithEmailAndPassword(auth, email, password);
}
export async function signIn(email, password) {
  if (!auth) throw new Error('Firebase isn\u2019t set up yet — check js/firebase-config.js.');
  await signInWithEmailAndPassword(auth, email, password);
}
// Guest mode must always succeed, no matter what: if the project isn't
// configured, or is configured but the "Anonymous" sign-in provider was
// never turned on in the Firebase console (it's off by default even
// after enabling Email/Password), fall back to local-only storage
// instead of leaving the person stuck on the login screen.
export async function signInGuest() {
  if (!isConfigured || !auth) { setMode('local', null); return { cloud: false }; }
  try {
    await signInAnonymously(auth);
    return { cloud: true };
  } catch (err) {
    console.warn('Anonymous sign-in unavailable, falling back to local guest mode:', err);
    setMode('local', null);
    return { cloud: false };
  }
}
export async function logOut() {
  setMode('local', null);
  if (auth) { try { await signOut(auth); } catch {} }
}
export async function resetPassword(email) {
  if (!auth) throw new Error('Firebase isn\u2019t set up yet — check js/firebase-config.js.');
  await sendPasswordResetEmail(auth, email);
}