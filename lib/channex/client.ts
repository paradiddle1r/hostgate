import "server-only";

// Channex.io REST client (server-only).
//
// Auth = `user-api-key` header. Staging and production are separate stacks
// with separate keys:
//   staging     https://staging.channex.io
//   production  https://app.channex.io
// The active environment comes from CHANNEX_BASE_URL (+ CHANNEX_API_KEY);
// defaults to staging so a misconfigured deploy can never touch production.
//
// Responses are JSON:API-ish ({ data, meta } / { errors }). This client
// unwraps them and throws ChannexApiError on failure so callers can log the
// upstream code/details into channex_sync_log.

import type {
  ChannexResource,
  ChannexListMeta,
  ChannexAvailabilityValue,
  ChannexRestrictionValue,
  ChannexBookingRevision,
  ChannexPropertyAttrs,
  ChannexRoomTypeAttrs,
  ChannexRatePlanAttrs,
  ChannexWebhookAttrs,
} from "./types";

export class ChannexApiError extends Error {
  status: number;
  code: string;
  details: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(`Channex ${status} ${code}: ${message}`);
    this.name = "ChannexApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function channexBaseUrl(): string {
  return (process.env.CHANNEX_BASE_URL || "https://staging.channex.io").replace(/\/+$/, "");
}

export function channexConfigured(): boolean {
  return Boolean(process.env.CHANNEX_API_KEY);
}

interface RequestOpts {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Extra query params, e.g. { "filter[property_id]": "..." } */
  query?: Record<string, string | number | undefined>;
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<{ data: T; meta?: ChannexListMeta }> {
  const key = process.env.CHANNEX_API_KEY;
  if (!key) {
    throw new ChannexApiError(0, "not_configured",
      "CHANNEX_API_KEY is not set — add it in Vercel env (get a key from staging.channex.io → API Keys).");
  }
  const url = new URL(`${channexBaseUrl()}/api/v1${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers: {
      "user-api-key": key,
      "Content-Type": "application/json",
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: "no-store",
  });

  // DELETE and some acks return empty bodies.
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }

  if (!res.ok) {
    const err = json?.errors;
    throw new ChannexApiError(
      res.status,
      err?.code ?? String(res.status),
      err?.title ?? text.slice(0, 300) ?? "request failed",
      err?.details,
    );
  }
  return { data: (json?.data ?? json) as T, meta: json?.meta as ChannexListMeta | undefined };
}

/** Paginate through a list endpoint (max 100/page) and return every row. */
async function listAll<T>(path: string, query: Record<string, string | number | undefined> = {}): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  for (;;) {
    const { data, meta } = await request<T[]>(path, {
      query: { ...query, "pagination[page]": page, "pagination[limit]": 100 },
    });
    const rows = Array.isArray(data) ? data : [];
    out.push(...rows);
    const total = meta?.total ?? rows.length;
    if (out.length >= total || rows.length === 0) return out;
    page += 1;
  }
}

// ── Health ──────────────────────────────────────────────────────────────────

/** Cheap authenticated call — used by the admin "Test connection" button. */
export async function healthCheck(): Promise<{ ok: boolean; properties: number; error?: string }> {
  try {
    const rows = await listAll<ChannexResource<{ title: string }>>("/properties/options");
    return { ok: true, properties: rows.length };
  } catch (e) {
    return { ok: false, properties: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Properties ──────────────────────────────────────────────────────────────

export function listProperties() {
  return listAll<ChannexResource<ChannexPropertyAttrs>>("/properties");
}

export async function createProperty(attrs: ChannexPropertyAttrs) {
  const { data } = await request<ChannexResource<ChannexPropertyAttrs>>("/properties", {
    method: "POST",
    body: { property: attrs },
  });
  return data;
}

// ── Room types ──────────────────────────────────────────────────────────────

export async function createRoomType(attrs: ChannexRoomTypeAttrs) {
  const { data } = await request<ChannexResource<ChannexRoomTypeAttrs>>("/room_types", {
    method: "POST",
    body: { room_type: attrs },
  });
  return data;
}

// ── Rate plans ──────────────────────────────────────────────────────────────

export async function createRatePlan(attrs: ChannexRatePlanAttrs) {
  const { data } = await request<ChannexResource<ChannexRatePlanAttrs>>("/rate_plans", {
    method: "POST",
    body: { rate_plan: attrs },
  });
  return data;
}

// ── ARI ─────────────────────────────────────────────────────────────────────
// One call, many values — Channex certification requires batching N changes
// into a single request, and throttling to ~20 ARI calls/min per property.

export async function pushAvailability(values: ChannexAvailabilityValue[]) {
  if (values.length === 0) return null;
  const { data } = await request<unknown>("/availability", {
    method: "POST",
    body: { values },
  });
  return data; // { task_id ... } — applied async by Channex
}

export async function pushRestrictions(values: ChannexRestrictionValue[]) {
  if (values.length === 0) return null;
  const { data } = await request<unknown>("/restrictions", {
    method: "POST",
    body: { values },
  });
  return data;
}

// ── Booking revisions (feed + ack — THE certified ingestion path) ───────────

export async function bookingRevisionsFeed(channexPropertyId?: string) {
  return listAll<ChannexBookingRevision>("/booking_revisions/feed", {
    "filter[property_id]": channexPropertyId,
    "order[inserted_at]": "asc",
  });
}

export async function ackBookingRevision(revisionId: string) {
  await request<unknown>(`/booking_revisions/${revisionId}/ack`, { method: "POST" });
}

// ── Webhooks ────────────────────────────────────────────────────────────────

export async function createWebhook(attrs: ChannexWebhookAttrs) {
  const { data } = await request<ChannexResource<ChannexWebhookAttrs>>("/webhooks", {
    method: "POST",
    body: { webhook: attrs },
  });
  return data;
}

export async function deleteWebhook(webhookId: string) {
  await request<unknown>(`/webhooks/${webhookId}`, { method: "DELETE" });
}

// ── Channel-mapping iframe (white-label UI) ─────────────────────────────────

/** 15-minute one-time token → embed {base}/auth/exchange?oauth_session_key=… */
export async function oneTimeToken(channexPropertyId: string, username: string): Promise<string> {
  const { data } = await request<{ token: string }>("/auth/one_time_token", {
    method: "POST",
    body: { property_id: channexPropertyId, username },
  });
  return (data as any)?.token ?? (data as any)?.attributes?.token;
}

export function mappingIframeUrl(token: string, channexPropertyId: string, lng = "en"): string {
  const base = channexBaseUrl();
  const q = new URLSearchParams({
    oauth_session_key: token,
    app_mode: "headless",
    redirect_to: "/channels",
    property_id: channexPropertyId,
    lng,
  });
  return `${base}/auth/exchange?${q.toString()}`;
}
