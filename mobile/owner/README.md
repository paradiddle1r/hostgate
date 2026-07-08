# HostGate Owner — Capacitor shell

Wraps the live PMS (`https://hostgate.app/app`). Remote-URL mode: web deploys
update the app instantly.

```bash
npm install
npx cap add android   # generates android/ (commit it)
npx cap sync
npx cap open android  # run in Android Studio / emulator
```

iOS (needs Xcode): `npx cap add ios` → drop `GoogleService-Info.plist` into
`ios/App/App/` → open in Xcode, set the signing team, run.

Android push: place Firebase `google-services.json` in `android/app/` after
the human creates the Firebase project (PLAN.md 🔒 01b).

Icons/splash: put `resources/icon.png` (1024²) + `resources/splash.png`
(2732²) then `npm run assets`.

Work orders: `mobile/prompts/01-owner-shell.md` (+ 02 for push).
