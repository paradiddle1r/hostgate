// Channex.io API types — hand-written from https://docs.channex.io/
// (see docs/channex/CHANNEX.md for the full integration reference).
// JSON:API style: every resource arrives as { id, type, attributes }.

export interface ChannexResource<A> {
  id: string;
  type: string;
  attributes: A;
}

export interface ChannexListMeta {
  page?: number;
  limit?: number;
  total?: number;
}

export interface ChannexError {
  code: string;
  title: string;
  details?: Record<string, unknown>;
}

// ── Property ────────────────────────────────────────────────────────────────
export interface ChannexPropertyAttrs {
  title: string;
  currency: string;
  email?: string | null;
  phone?: string | null;
  zip_code?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  address?: string | null;
  timezone?: string | null;
  property_type?: string | null;
  group_id?: string | null;
  settings?: Record<string, unknown> | null;
}

// ── Room type ───────────────────────────────────────────────────────────────
export interface ChannexRoomTypeAttrs {
  title: string;
  property_id: string;
  count_of_rooms: number;
  occ_adults: number;
  occ_children: number;
  occ_infants: number;
  default_occupancy: number;
  room_kind?: "room" | "dorm";
}

// ── Rate plan ───────────────────────────────────────────────────────────────
export interface ChannexRatePlanOption {
  occupancy: number;
  is_primary: boolean;
  rate: number | string;
  derived_option?: unknown;
}

export interface ChannexRatePlanAttrs {
  title: string;
  property_id: string;
  room_type_id: string;
  options: ChannexRatePlanOption[];
  currency?: string;
  sell_mode?: "per_room" | "per_person";
  rate_mode?: "manual" | "derived" | "auto" | "cascade";
  meal_type?: string;
}

// ── ARI ─────────────────────────────────────────────────────────────────────
/** One entry of POST /api/v1/availability { values: [...] } */
export interface ChannexAvailabilityValue {
  property_id: string;
  room_type_id: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  availability: number;
}

/** One entry of POST /api/v1/restrictions { values: [...] } */
export interface ChannexRestrictionValue {
  property_id: string;
  rate_plan_id: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  days?: string[]; // ["mo","tu",...]
  rate?: number | string;
  rates?: { occupancy: number; rate: number | string }[];
  stop_sell?: boolean;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
  min_stay_arrival?: number;
  min_stay_through?: number;
  min_stay?: number;
  max_stay?: number;
}

// ── Booking revision ────────────────────────────────────────────────────────
export interface ChannexBookingRoomDay {
  [date: string]: string; // "2026-07-10": "1200.00"
}

export interface ChannexBookingRoom {
  room_type_id: string | null; // null = unmapped!
  rate_plan_id: string | null;
  checkin_date?: string;
  checkout_date?: string;
  days?: ChannexBookingRoomDay;
  amount?: string;
  occupancy?: { adults?: number; children?: number; infants?: number; ages?: number[] };
  guests?: { name?: string; surname?: string }[];
  services?: unknown[];
  taxes?: unknown[];
}

export interface ChannexBookingRevisionAttrs {
  booking_id: string;
  property_id: string;
  status: "new" | "modified" | "cancelled";
  unique_id?: string;             // e.g. "BDC-3333333333"
  system_id?: string;
  ota_reservation_code?: string | null;
  ota_name?: string | null;
  arrival_date?: string;
  departure_date?: string;
  arrival_hour?: string | null;
  amount?: string | null;
  currency?: string | null;
  ota_commission?: string | null;
  payment_collect?: string | null; // property | ota
  customer?: {
    name?: string; surname?: string; mail?: string; phone?: string;
    country?: string; language?: string;
  } | null;
  guarantee?: Record<string, unknown> | null; // card data (masked unless PCI)
  rooms?: ChannexBookingRoom[];
  services?: unknown[];
  notes?: string | null;
  inserted_at?: string;
}

export type ChannexBookingRevision = ChannexResource<ChannexBookingRevisionAttrs>;

// ── Webhook ─────────────────────────────────────────────────────────────────
export interface ChannexWebhookAttrs {
  property_id: string | null;
  callback_url: string;
  event_mask: string;
  request_params?: Record<string, unknown>;
  headers?: Record<string, string>;
  is_active?: boolean;
  send_data?: boolean;
}

/** What Channex POSTs to our callback URL. */
export interface ChannexWebhookDelivery {
  event: string;
  property_id?: string;
  payload?: Record<string, unknown> & { booking_id?: string; revision_id?: string };
  user_id?: string | null;
  timestamp?: string;
}
