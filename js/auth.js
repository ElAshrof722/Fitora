import {
  auth, isConfigured, configErrorMessage, watchAuth, signUp, signIn, signInGuest, logOut, resetPassword, setMode, hasLocalGuestData,
} from './db.js';

const authScreen = document.getElementById('auth-screen');
const appEl = document.getElementById('app');
const form = document.getElementById('auth-form');
const emailInput = document.getElementById('auth-email');
const passInput = document.getElementById('auth-password');
const submitBtn = document.getElementById('auth-submit');
const errorBox = document.getElementById('auth-error');
const toggleModeBtn = document.getElementById('auth-toggle-mode');
const forgotBtn = document.getElementById('auth-forgot');
const guestBtn = document.getElementById('auth-guest');
const userEmailEl = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');

let isSignUp = false;
let onReady = null; // callback fired once app should render

export function initAuth(cb) {
  onReady = cb;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    submitBtn.disabled = true;
    submitBtn.textContent = isSignUp ? 'Creating account...' : 'Signing in...';
    try {
      if (isSignUp) await signUp(emailInput.value.trim(), passInput.value);
      else await signIn(emailInput.value.trim(), passInput.value);
    } catch (err) {
      showError(friendlyError(err));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = isSignUp ? 'Create Account' : 'Sign In';
    }
  });

  toggleModeBtn.addEventListener('click', () => {
    isSignUp = !isSignUp;
    submitBtn.textContent = isSignUp ? 'Create Account' : 'Sign In';
    toggleModeBtn.textContent = isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up';
    passInput.autocomplete = isSignUp ? 'new-password' : 'current-password';
    hideError();
  });

  forgotBtn.addEventListener('click', async () => {
    hideError();
    const email = emailInput.value.trim();
    if (!email) { showError('Enter your email above first, then tap "Forgot password?".'); return; }
    try {
      await resetPassword(email);
      showError('Password reset email sent. Check your inbox.', true);
    } catch (err) {
      showError(friendlyError(err));
    }
  });

  guestBtn.addEventListener('click', async () => {
    hideError();
    guestBtn.disabled = true;
    guestBtn.textContent = 'Loading...';
    try {
      const { cloud } = await signInGuest();
      if (!cloud) {
        // Fell back to local-only storage (unconfigured project, or the
        // "Anonymous" provider isn't enabled in the Firebase console) —
        // watchAuth won't fire in this case, so transition manually.
        enterLocalGuestMode();
      }
      // If cloud === true, watchAuth's callback below handles the transition.
    } catch (err) {
      showError(friendlyError(err));
    } finally {
      guestBtn.disabled = false;
      guestBtn.textContent = 'Continue as Guest (this device only)';
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await logOut();
    // Bug fix: previously nothing brought the UI back to the login
    // screen after signing out — the app shell just stayed visible.
    returnToLoginScreen();
  });

  if (!isConfigured) {
    const note = document.querySelector('.auth-footnote');
    note.textContent = configErrorMessage
      ? `Firebase failed to start (${configErrorMessage}). Check js/firebase-config.js. You can still tap "Continue as Guest" to use Fitora locally on this device.`
      : 'Firebase isn\u2019t configured yet, so cloud sign-in is disabled. Tap "Continue as Guest" to use Fitora locally on this device, or set up js/firebase-config.js for cloud sync across devices.';
    emailInput.closest('form').style.opacity = '0.4';
    emailInput.disabled = true; passInput.disabled = true; submitBtn.disabled = true;
    toggleModeBtn.disabled = true; forgotBtn.disabled = true;
  }

  watchAuth((user) => {
    if (user) {
      // Bug fix: local guest data on this device (recorded before
      // signing up/in) used to be silently dropped the moment cloud
      // mode took over. Offer to bring it along, once, for real
      // (non-anonymous) accounts.
      let mergeLocal = false;
      if (!user.isAnonymous && hasLocalGuestData()) {
        mergeLocal = window.confirm(
          'You have workout data saved locally as a guest on this device. Import it into this account? It will be merged with any data already in the cloud.'
        );
      }
      setMode('cloud', user.uid, { mergeLocal });
      authScreen.hidden = true;
      appEl.hidden = false;
      userEmailEl.textContent = user.isAnonymous ? 'Guest' : (user.email || '');
      onReady && onReady();
    } else {
      // Not signed in to Firebase — fall back to local-only guest mode
      // so the app still renders instead of blocking on the login screen
      // only once the user explicitly chose "Continue as Guest" while unconfigured.
    }
  });
}

export function enterLocalGuestMode() {
  setMode('local', null);
  authScreen.hidden = true;
  appEl.hidden = false;
  userEmailEl.textContent = 'Guest (local)';
  onReady && onReady();
}

// Brings the UI back to the login screen after an explicit sign-out.
// (watchAuth's null-user branch above stays intentionally inert on
// initial load, so this is the one place responsible for the reverse
// app -> login transition.)
function returnToLoginScreen() {
  appEl.hidden = true;
  authScreen.hidden = false;
  userEmailEl.textContent = '';
  emailInput.value = '';
  passInput.value = '';
  hideError();
}

function showError(msg, ok) {
  errorBox.hidden = false;
  errorBox.textContent = msg;
  errorBox.style.color = ok ? 'var(--green)' : 'var(--danger)';
  errorBox.style.borderColor = ok ? 'var(--green)' : 'var(--danger)';
}
function hideError() { errorBox.hidden = true; }

function friendlyError(err) {
  const code = err && err.code || '';
  const map = {
    'auth/email-already-in-use': 'An account with that email already exists — try signing in instead.',
    'auth/invalid-email': 'That email address looks invalid.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/too-many-requests': 'Too many attempts — please wait a moment and try again.',
    'auth/network-request-failed': 'Network error — check your internet connection and try again.',
    'auth/admin-restricted-operation': 'This project has "Email/Password" sign-in disabled. Enable it in Firebase Console → Authentication → Sign-in method.',
    'auth/operation-not-allowed': 'This project has this sign-in method disabled. Enable it in Firebase Console → Authentication → Sign-in method.',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Invalid Firebase API key — double-check js/firebase-config.js.',
    'auth/configuration-not-found': 'Firebase Authentication hasn\u2019t been set up for this project yet. Go to Firebase Console → Authentication → Get started.',
  };
  return map[code] || (err && err.message) || 'Something went wrong. Please try again.';
}