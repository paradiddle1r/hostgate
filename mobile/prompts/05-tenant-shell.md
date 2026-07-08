# Task 05 — HostGate Tenant shell

## Context
Portal (`/tenant`) is live after task 04. `mobile/tenant/` holds the Capacitor
config (`app.hostgate.tenant` → `https://hostgate.app/tenant`). Mirror what
task 01 did for the owner shell, plus camera.

## Steps
1. `cd mobile/tenant && npm install && npx cap add android && npx cap sync`;
   boot in emulator: login → link (or already linked) → dashboard; session
   persists across relaunch.
2. Camera: the portal's slip upload uses `<input capture>` — verify the
   Android WebView opens the camera; add the file-chooser/camera permission
   plumbing in `AndroidManifest.xml` if the default WebChromeClient doesn't
   (Capacitor's usually does). Document the iOS `NSCameraUsageDescription` /
   `NSPhotoLibraryUsageDescription` strings in the README for the 🔒 iOS pass.
3. Push registration: confirm `lib/native/push.ts` (task 02c) fires with
   `audience='tenant'` inside this shell after login.
4. Icon + splash (warm/light variant), back-button handling — same recipe as
   task 01. Commit `android/`.
5. Update `mobile/tenant/README.md` with run steps + the iOS checklist.

## Acceptance
- [ ] Emulator: full journey — login → link → view bill → QR shows → camera
      opens for slip → submission visible in owner queue.
- [ ] `bill_issued` push arrives on the emulator (FCM test) or API 200 shown.
- [ ] Gates green at repo root.
