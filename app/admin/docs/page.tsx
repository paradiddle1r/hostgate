// Channex onboarding checklist — the condensed, always-visible version of
// docs/channex/ONBOARDING.md (the repo file has the full detail + email
// draft). Static content; update both together.

const h2 = "mt-8 mb-3 text-lg font-semibold tracking-tight text-zinc-100";
const list = "list-decimal space-y-1.5 pl-5 text-sm text-zinc-300";
const ulist = "list-disc space-y-1.5 pl-5 text-sm text-zinc-300";
const code = "rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200";
const link = "text-emerald-400 underline underline-offset-2 hover:text-emerald-300";

export default function AdminDocs() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Channex go-live checklist</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Full detail + partnership email draft: <span className={code}>docs/channex/ONBOARDING.md</span> in the repo.
      </p>

      <h2 className={h2}>1 · Staging (now)</h2>
      <ol className={list}>
        <li>Sign up at <a className={link} href="https://staging.channex.io" target="_blank" rel="noreferrer">staging.channex.io</a> (self-service, free).</li>
        <li>Create an API key: Organization → <b>API Keys</b> (shown once — store as <span className={code}>CHANNEX_API_KEY</span> in Vercel).</li>
        <li>Env vars on Vercel: <span className={code}>CHANNEX_BASE_URL=https://staging.channex.io</span>, <span className={code}>CHANNEX_API_KEY</span>, <span className={code}>CHANNEX_WEBHOOK_SECRET</span> (random), <span className={code}>CRON_SECRET</span> (random), <span className={code}>SUPABASE_SERVICE_ROLE_KEY</span>, <span className={code}>PLATFORM_ADMIN_EMAILS</span>.</li>
        <li>On the <a className={link} href="/admin/channex">Channex page</a>: <b>Test Channex API</b> → connect a property → <b>Provision</b>.</li>
      </ol>

      <h2 className={h2}>2 · Certification test property</h2>
      <ul className={ulist}>
        <li>Name: <b>Test Property - (HostGate)</b>, currency USD.</li>
        <li>2 room types: <b>Twin Room</b>, <b>Double Room</b> (occupancy 2 each).</li>
        <li>4 rate plans: BAR Twin, BAR Double, B&amp;B Twin, B&amp;B Double.</li>
        <li>Realistic, non-uniform rates/availability (flat data gets rejected).</li>
      </ul>

      <h2 className={h2}>3 · The 14 certification scenarios</h2>
      <ol className={list}>
        <li>Full sync — 500 days, ALL rooms/rates, in 2 calls (1 availability + 1 restrictions)</li>
        <li>Single date + single rate price update — 1 call</li>
        <li>Single date, 3 room/rate combos — 1 call</li>
        <li>Multiple dates, multiple rates — 1 call</li>
        <li>Min-stay update (3 combos) — 1 call</li>
        <li>Stop-sell update (3 combos) — 1 call</li>
        <li>CTA/CTD/min/max-stay (4 combos) — 1 call</li>
        <li>~6-month rates+restrictions, 2 room types — 1 call</li>
        <li>Availability update via a booking in the PMS (availability zeroing)</li>
        <li>Multi-date availability update — same</li>
        <li>Receive + acknowledge new/modified/cancelled bookings (revisions feed)</li>
        <li>Rate-limit compliance (queue + throttle, ~20 ARI req/min/property)</li>
        <li>Delta-only updates — no timer-based full syncs (nightly full sync max)</li>
        <li>Capability questionnaire (min-stay type, restrictions support, card needs)</li>
      </ol>
      <p className="mt-3 text-sm text-zinc-300">
        Record the <b>task IDs</b> Channex returns per scenario, submit the Google Form:{" "}
        <a className={link} href="https://forms.gle/xA8F3eSYBPBd8apYA" target="_blank" rel="noreferrer">forms.gle/xA8F3eSYBPBd8apYA</a>.
        A live screenshare review follows — actions must run from this real UI, not scripts.
      </p>

      <h2 className={h2}>4 · Production</h2>
      <ol className={list}>
        <li>After passing: production access via <a className={link} href="mailto:support@channex.io">support@channex.io</a>.</li>
        <li>Flip env: <span className={code}>CHANNEX_BASE_URL=https://app.channex.io</span> + production API key.</li>
        <li>Re-provision properties on production; connect real OTAs via the Channels iframe.</li>
        <li>Card data (later, optional): Stripe Tokenization app or a PCI-certified route — see the repo doc.</li>
      </ol>
    </div>
  );
}
