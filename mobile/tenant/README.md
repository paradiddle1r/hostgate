# HostGate Tenant — Capacitor shell

Wraps the tenant portal (`https://hostgate.app/tenant` — built by loop task 04).
For monthly tenants: bills, PromptPay QR, payment-slip upload (camera),
contract, meter history, repair requests.

```bash
npm install
npx cap add android
npx cap sync
npx cap open android
```

iOS extras (when the human runs `npx cap add ios`): add to
`ios/App/App/Info.plist` —
- `NSCameraUsageDescription` — "Take a photo of your payment slip"
- `NSPhotoLibraryUsageDescription` — "Attach a payment slip from your photos"

Push: same Firebase project as the owner app; tokens register with
`audience='tenant'`.

Work orders: `mobile/prompts/04-tenant-portal-web.md` → `05-tenant-shell.md`.
