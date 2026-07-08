# Task 01 — HostGate Owner shell (Android first)

## Context
`mobile/owner/` already holds the Capacitor config (`app.hostgate.owner`,
remote URL `https://hostgate.app/app`) and package.json. The PMS web app is
live and responsive; this task makes it boot as a native Android app. iOS
(01b) is 🔒 human (Xcode + accounts), but prepare everything it needs.

## Read first
- `mobile/PLAN.md` §1 (architecture) · `mobile/owner/capacitor.config.ts`
- Capacitor docs knowledge: remote-URL apps, `npx cap add android`.

## Steps
1. `cd mobile/owner && npm install && npx cap add android && npx cap sync`.
2. Boot in emulator (`npx cap open android` → Run). Verify: marketing page
   loads → login → lands in PMS → kill app → relaunch → **still logged in**
   (Supabase cookie persistence in the WebView). If the session drops, fix via
   WebView cookie settings — do not build a custom token bridge unless cookies
   are provably impossible.
3. Handle Android back button: `@capacitor/app` `backButton` listener → if
   `canGoBack` then history.back() else move task to background. Put this in a
   tiny `mobile/owner/native.ts` injected via config `appendUserAgent` note —
   or simpler: document that remote mode can't inject JS and instead add the
   handler to the WEB app gated by `Capacitor.isNativePlatform()` (preferred;
   see task 02c for the same pattern).
4. External links (LINE, print pages) must open the system browser, not the
   WebView — verify `/print/*` and add `window.open` targets where needed.
5. Icon + splash: put a 1024×1024 `icon.png` + 2732×2732 `splash.png` in
   `mobile/owner/resources/` (generate a clean placeholder from the HostGate
   logo `components/Logo.tsx` if no asset exists) then `npm run assets`.
6. Commit the generated `android/` folder (yes, committed — reproducible
   builds for the human's Android Studio).

## Acceptance
- [ ] Emulator boots to hostgate.app, login persists across relaunch.
- [ ] Back button navigates history; doesn't kill the app mid-flow.
- [ ] Icon + splash show (no default Capacitor branding).
- [ ] `mobile/owner/README.md` updated with exact run steps for the human.
- [ ] Root gates still green (`tsc`/`build`/`vitest` — mobile/ is inert to the
      Next build; prove it by running them).

## Out of scope
Push (task 02), iOS platform generation (🔒 01b), store upload (06).
