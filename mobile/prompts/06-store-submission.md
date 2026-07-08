# Task 06 — Store submission (mostly 🔒 human; agent prepares everything)

## Agent prepares (06-prep, can run any time after 04)
1. `mobile/store/` folder with, per app (owner / tenant), in TH + EN:
   - `listing.md` — name, subtitle, short + full description, keywords.
     Owner: "HostGate — บริหารโรงแรม/หอพักครบวงจร" positioning. Tenant:
     "HostGate Tenant — เช็คบิล จ่ายค่าห้อง แจ้งซ่อม" positioning.
   - `privacy-labels.md` — Apple nutrition labels + Google Data-safety answers
     derived from what the apps ACTUALLY collect (auth email, device token,
     slip images; no ads, no tracking SDKs). Point both stores at
     `https://hostgate.app/privacy`.
   - `review-notes.md` — demo credentials plan (seed a demo tenant org +
     linked portal tenant on production, low-volume), reviewer walkthrough,
     and the Apple-4.2 defense paragraph (native push, camera capture,
     closed-audience utility).
2. Screenshot script: `mobile/store/screenshots.md` — the 6 shots per app to
   take (which screens, which data seeded), sized 6.7" + 6.1" (Apple) and
   phone+7" (Play).
3. Version/build hygiene: set `versionName 1.0.0` / `versionCode 1` (Android)
   and document the bump procedure in `mobile/README.md`.

## Human does (🔒)
- Play Console ($25 once): create both apps, upload `.aab` (Android Studio →
  Generate Signed Bundle; Play App Signing on), internal testing → production.
- Apple ($99/yr): Xcode archive → App Store Connect, TestFlight → review.
  If the OWNER app hits a 4.2 rejection: switch to unlisted distribution
  (App Store Connect → unlisted URL) — decision pre-made, don't argue with
  review twice.
- Firebase: confirm APNs auth key uploaded (Cloud Messaging settings) before
  the iOS builds go out.

## Done =
Both apps installable from both stores (owner app possibly unlisted on iOS),
push verified on production installs, listings live in TH + EN.
