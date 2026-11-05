# 🏋️ Fitora — Web

A gym-tracking **website** (rebuilt from the original Expo/React Native app). No Expo, no Expo Go,
no app store — it runs in any browser and stores your data in **Firebase (Firestore + Auth)**, so it
syncs live across every device you sign into.

It's a plain static site (HTML/CSS/JS, no build step, no npm install) — open `index.html`, or deploy
it anywhere that serves static files.

---

## 1. Create a Firebase project (free tier is enough)

1. Go to <https://console.firebase.google.com> → **Add project** → follow the wizard.
2. In the left sidebar: **Build → Firestore Database → Create database**.
   - Start in **production mode** (the security rules below lock it down properly).
   - Pick any region close to you.
3. **Build → Authentication → Get started**.
   - Enable the **Email/Password** sign-in method.
   - Enable the **Anonymous** sign-in method too if you want "Continue as Guest" to sync to the
     cloud (it's off by default). If you skip this, Guest mode still works fine — it just falls
     back to storing data in that browser only, instead of syncing.
4. **Project settings** (gear icon, top left) → scroll to **Your apps** → click the web icon `</>`
   → register an app (any nickname) → it shows you a `firebaseConfig` object.

## 2. Paste your config

Open `js/firebase-config.js` and replace the placeholder values with the ones Firebase gave you:

```js
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "...",
  appId: "...",
};
```

That's it — no build step, no `npm install`. Just save the file.

## 3. Lock down the database

In the Firebase Console: **Firestore Database → Rules**, paste the contents of `firestore.rules`
from this folder, then **Publish**. This makes sure every user can only read/write their own data.

## 4. Run it locally

Because it uses ES modules, open it through a local server rather than double-clicking the file
(browsers block `file://` module imports). Any of these work:

```bash
# Option A — Python (already on most machines)
cd ironlog-web
python3 -m http.server 5500
# then open http://localhost:5500

# Option B — Node
npx serve ironlog-web
```

## 5. Deploy it as a real website (free)

**Firebase Hosting (recommended — same project as your data):**

```bash
npm install -g firebase-tools
firebase login
cd ironlog-web
firebase init hosting     # choose your project, public dir = "." , single-page app = No
firebase deploy
```

**Or just drag-and-drop** the `ironlog-web` folder onto [Netlify Drop](https://app.netlify.com/drop),
or push it to a GitHub repo and enable **GitHub Pages** in the repo settings — both work with zero
config since there's no build step.

---

## What changed vs. the original Expo app

| Before (Expo/React Native) | Now (Website) |
|---|---|
| Runs inside Expo Go / a built `.apk` | Runs in any browser, desktop or mobile |
| Data in `AsyncStorage` (device-only) | Data in **Firestore**, synced live across devices |
| No accounts | **Email/password sign-in** (Firebase Auth) — your log follows you |
| Manual JSON export/import to move data between phones | Still available as a backup option, but no longer required — sign in anywhere and your data is just there |
| React Native components (`View`, `TouchableOpacity`, …) | Plain HTML/CSS/JS |

All the original features are intact: workout logging with sets/reps/PR flags, session history,
PR/machine tracking with progress bars, stats (volume chart, muscle breakdown, PR grid), and the
floating stopwatch.

## Project structure

```
ironlog-web/
├── index.html              # App shell (auth screen + tab shell)
├── css/style.css           # Theme (same colors as the original app)
├── firestore.rules         # Paste into Firebase Console → Firestore → Rules
├── js/
│   ├── firebase-config.js  # ← put your Firebase keys here
│   ├── db.js                # Firestore-backed data layer + auth helpers
│   ├── auth.js               # Sign in / sign up / guest UI wiring
│   ├── stopwatch.js          # Floating stopwatch widget
│   ├── utils.js               # Shared constants/helpers
│   ├── main.js                # Tab router
│   └── screens/
│       ├── log.js             # Log a workout
│       ├── history.js         # Past sessions
│       ├── machines.js        # PRs / machines
│       ├── stats.js           # Charts & totals
│       └── sync.js            # Cloud status + manual JSON backup
```

## Notes

- If you skip the Firebase setup, the app still works via **"Continue as Guest"**, storing data in
  `localStorage` on that one browser — handy for trying it out before wiring up a real project.
- Firestore's free "Spark" tier (50K reads / 20K writes per day) is far more than a personal workout
  log will ever use.
