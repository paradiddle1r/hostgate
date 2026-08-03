# HostGate.app

HostGate is a multi-tenant hotel-property management SaaS, not only a marketing
site. It combines the public website, authentication/onboarding, the customer
PMS, a public booking engine, and the HostGate platform-admin/Channex console in
one Next.js application.

Production: [hostgate.app](https://hostgate.app)

Platform admin: [admin.hostgate.app](https://admin.hostgate.app)

## Stack

- Next.js 14 App Router, React 18, TypeScript, Tailwind CSS
- Supabase Auth (Google, LINE, and email live; Facebook code path ready for
  provider setup) + PostgreSQL 17 with tenant-scoped RLS
- Thai/English marketing and PMS interfaces
- Vitest for pure helpers
- Vercel deployment

## Main routes

- `/`, `/blog`, `/contact`, `/privacy`, `/terms` — public marketing
- `/login`, `/signup`, `/onboarding` — authentication and tenant provisioning
- `/app/*` — customer PMS
- `/book/[code]/*` — public direct-booking flow
- `/admin/*` — platform administration and Channex operations
- `/api/channex/webhook`, `/api/channex/cron` — channel-manager ingestion/jobs

The PMS includes bookings/calendar, rooms, guests, rates, invoices/payments,
monthly rentals, housekeeping, shifts, maintenance, POS/inventory, reports,
team administration, notes, announcements, and activity history.

## Local development

```bash
cd /Users/pornchai/Documents/HostGate.app
npm install
npm run dev
```

Verification:

```bash
npm run typecheck
npm test
npm run build
```

Local secrets belong in `.env.local`; use `.env.example` as the variable list.
The repository is already linked locally to the production Vercel project and
Supabase project.

Social-provider production setup and smoke tests are documented in
[`docs/auth/PROVIDERS.md`](./docs/auth/PROVIDERS.md).

## Start here

Read [`CLAUDE.md`](./CLAUDE.md) for the architecture, database model,
conventions, Channex flow, and operational cautions. Channex details live in
[`docs/channex/`](./docs/channex/).
