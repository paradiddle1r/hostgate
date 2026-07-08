# HostGate Mobile

Two Capacitor apps over the live Next.js product — see **PLAN.md** for the
full architecture, decisions, and the task checklist the engineering loop works
through.

| App | Wraps | Shell dir | App ID |
|---|---|---|---|
| **HostGate Owner** | `hostgate.app/app` (the PMS — everything the web does) | `mobile/owner/` | `app.hostgate.owner` |
| **HostGate Tenant** | `hostgate.app/tenant` (bills · PromptPay QR · slip upload · contract · meters · repairs) | `mobile/tenant/` | `app.hostgate.tenant` |

## Quickstart (human)

```bash
cd mobile/owner        # or mobile/tenant
npm install
npx cap add android    # needs Android Studio
npx cap add ios        # needs Xcode (macOS)
npx cap sync && npx cap open android
```

Remote-URL mode: the app loads the live site, so **every web deploy updates
both apps instantly** — store re-review only when the native shell itself
changes (icons, plugins, permissions).

## Running the engineering loop (Prontera)

Everything the loop needs is under `mobile/prompts/`:

- `00-loop-protocol.md` — standing instructions (iteration shape, gates, rules)
- `01…06-*.md` — one work order per task in PLAN.md §3

Kickoff prompt is in `mobile/prompts/README.md`. Human-only items are marked 🔒
in PLAN.md (store accounts, Xcode/iOS, Firebase credentials).

## Key drafts awaiting review/apply (loop tasks 02a/03a)
- `supabase/migrations/drafts/21_tenant_portal_DRAFT.sql`
- `supabase/migrations/drafts/22_device_tokens_push_DRAFT.sql`
