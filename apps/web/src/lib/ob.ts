// Typed client for operation-backend, reached through server.js's /api/ob/* proxy namespace
// (api-proxy.js strips the prefix and adds the Bearer token). Shapes follow operation-backend's
// README; the backend does not publish JSON schemas yet, so these are written by hand.
import { getJson } from "./api";

const OB = "/api/ob";

/** GET /v1/routes: the route catalogue. */
export interface ObRoute {
  id: string;
  name: string;
  /** `tublamu` | `panwa` | `ranong`, or another pier id. */
  pier?: string;
  family_id?: string;
  color?: string;
  islands?: string;
  sort?: number;
  /** Departure times, earliest first, e.g. "08:30". */
  times?: string[];
}

/** GET /v1/boats: the boat catalogue (not date-aware). */
export interface ObBoat {
  id: string;
  name: string;
  type?: string;
  pier?: string;
  capacity: number;
  /** null = no licence on file; not a licence of zero. */
  license_pax: number | null;
  charter_ceiling: number;
  crew?: number;
}

/** One boat's share of a route-day in the availability range. */
export interface ObDayBoat {
  boat_id: string;
  /** Sellable seats that day, after any override and the licence clamp. */
  capacity: number;
  license_pax: number | null;
  /** Taken whole by a charter: none of its seats are on sale. */
  chartered: boolean;
}

/** GET /v1/availability?from=&to=: one route on one day. Every route-day is present. */
export interface ObAvailabilityDay {
  route_id: string;
  service_date: string;
  /** The route calendar's answer. Tells a closed day from an open one with no boat yet. */
  open: boolean;
  deployed_capacity: number;
  licensed_capacity: number;
  booked_pax: number;
  charter_pax: number;
  locked_pax: number;
  available_seats: number;
  deployments: ObDayBoat[];
}

/** The ten lifecycle statuses the backend accepts. */
export type ObBookingStatus =
  | 'draft' | 'quote' | 'pending' | 'pending_approval' | 'pending_foc'
  | 'confirmed' | 'completed' | 'rejected' | 'cancelled' | 'cancelled_weather';

/** One departure of a booking. `pax` is the flat grid: `ad`, `ad_fr`, `ad_th`, `chd`, … `foc_th`. */
export interface ObTrip {
  id: string;
  seq: number;
  route_id: string;
  service_date: string;
  booking_mode: string;
  pax: Record<string, number>;
  pax_total: number;
  charter_boat_id?: string;
}

export interface ObPassenger { seq: number; name: string; nationality?: string; type?: string; foc?: boolean }

/**
 * GET /v1/bookings[/:id]. The header columns are optional: the backend leaves a column out when it
 * is empty. `route_id` / `service_date` / `pax` are derived from the first trip and the total.
 */
export interface ObBooking {
  id: string;
  status: ObBookingStatus;
  created_at: string;
  updated_at: string;
  cancellation_reason?: string;
  external_id?: string;
  agent_id?: string;
  voucher_ref?: string;
  rate_type_ref?: string;
  passengers: ObPassenger[];
  trips: ObTrip[];
  route_id: string;
  service_date: string;
  booking_mode?: string;
  pax: number;
  sold_by?: string; purpose?: string; staff_id?: string; staff_purpose?: string;
  lead_pax?: string; lead_nationality?: string; lead_type?: string; lead_foc?: boolean;
  lead_phone?: string; lead_email?: string;
  pickup_area_id?: string; pickup_self?: boolean; pickup_area?: string; pickup_zone?: string;
  hotel_name?: string; room_number?: string;
  dropoff_same?: boolean; dropoff_area_id?: string; dropoff_area?: string; dropoff_hotel_name?: string;
  guide_english?: boolean; guide_russian?: boolean; guide_chinese?: boolean; guide_other_lang?: string;
  pax_type?: string;
  special_meals_veg?: number; special_meals_vegan?: number; special_meals_halal?: number;
  special_meals_allergies?: string; large_luggage?: number;
  cash_on_tour_amount?: number; cash_on_tour_currency?: string; cash_on_tour_handling?: string; cash_on_tour_note?: string;
  price_mode?: string; manual_total?: number; total?: number;
  price_seat?: number; price_addon?: number; price_foc_discount?: number; price_discount?: number; price_extra?: number;
  payment_method?: string; payment_net_days?: number; payment_source?: string; payment_contract_version?: string;
  market?: string; market_sub?: string; market_agent_id?: string; market_at?: string;
  booking_date?: string; booked_at?: string; created_by?: string; updated_by?: string;
  confirmed_at?: string; confirmed_by?: string;
  notes?: string; note?: string;
}

/** Why a route runs or not on a date (the same rule names as legacy getDayStatus). */
export type ObDaySource = 'override' | 'season' | 'outside-season' | 'no-seasons';

/** GET /v1/routes?from=&to=: the catalogue with each route's calendar resolved per date. */
export interface ObRouteDays extends ObRoute {
  days: Record<string, { open: boolean; source: ObDaySource }>;
}

/** GET /v1/seat-locks. A lock still holds `pax - drawn_pax` seats. */
export interface ObSeatLock {
  id: string;
  route_id: string;
  service_date: string;
  pax: number;
  agent_id?: string;
  status: 'active' | 'released';
  created_at: string;
  updated_at: string;
  released_at?: string;
  drawn_pax?: number;
}

// ── Van assignment (GET /operations/van-board). Contract drafted in apps/web/docs/handoff/van-endpoints.md
//    §3.1; operation-backend has not shipped it yet, so until it does the endpoint answers 404. ──

/** A van as the board sees it on one day: catalogue fields plus that day's matrix, status and driver. */
export interface ObVanOnDay {
  id: string;
  name: string;
  plate?: string;
  capacity: number;
  color?: string;
  ownership?: 'own' | 'partner';
  zone_base?: string;
  /** Active and not off / in maintenance that day. */
  usable: boolean;
  /** Programmes the month matrix gives this van on the day. */
  route_ids: string[];
  driver?: string;
  driver_phone?: string;
  /** The driver / phone / plate is a per-day override, not the van's default. */
  driver_overridden?: boolean;
}

/** One outbound van run: the passengers that ride one van together. */
export interface ObVanGroup {
  id: string;
  /** Display number, one sequence per date + route. */
  number: number;
  zone: string;
  /** null = no van picked yet. */
  van_id: string | null;
  /** Group default return van; null = back on the same van. */
  return_van_id: string | null;
  pickup_time: string | null;
  pax: number;
  capacity: number | null;
  over_capacity: boolean;
  /** Set when the van runs this route more than once that day. */
  round: { no: number; of: number; time: string | null } | null;
  /** Round n > 1 with no time, or the same time as the round before. */
  round_warning: 'no_time' | 'same_time' | null;
}

/** A booking's share of one trip-day. An unsplit booking has one allocation, idx 0. */
export interface ObVanAllocation {
  booking_id: string;
  booking_trip_id: string;
  idx: number;
  split: boolean;
  status: ObBookingStatus;
  /** Effective zone (a private-van add-on moves a NoTransfer seat into that van's zone). */
  zone: string;
  leg: 'out' | 'ret' | 'hold';
  pax: { ad: number; chd: number; inf: number; foc: number; total: number };
  group_id: string | null;
  /** Manual pickup order inside the group; null = by pickup time. */
  sequence: number | null;
  pickup: { hotel?: string; area?: string; room?: string; time_booked?: string; time_final?: string };
  return: { needed: boolean; self: boolean; same_van: boolean; van_id: string | null; alert: boolean; pool: string[] };
}

export interface ObVanTrip {
  route_id: string;
  pool: { outbound: string[] };
  groups: ObVanGroup[];
  allocations: ObVanAllocation[];
  totals: { unassigned_pax: number; self_arrive_pax: number };
}

export interface ObVanBoard {
  date: string;
  vans: ObVanOnDay[];
  trips: ObVanTrip[];
  warnings: {
    no_outbound_van: { route_id: string; bookings: number; pax: number }[];
    no_return_van: { route_id: string; bookings: number; pax: number }[];
    van_on_two_routes: { van_id: string; route_ids: string[] }[];
  };
}

/** The API pages at most 100 bookings per call. */
const PAGE = 100;

export const ob = {
  routes: () => getJson<{ routes: ObRoute[] }>(`${OB}/v1/routes`).then((r) => r.routes),
  boats: () => getJson<{ boats: ObBoat[] }>(`${OB}/v1/boats`).then((r) => r.boats),
  /** Both ends inclusive. The backend caps a range over every route at 62 days. */
  availability: (from: string, to: string) =>
    getJson<{ days: ObAvailabilityDay[] }>(
      `${OB}/v1/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ).then((r) => r.days),
  /**
   * Every booking with a trip between `from` and `to` (inclusive), following `next_cursor` to the
   * end. The backend has no status filter, search or count yet, so callers narrow client-side.
   */
  async bookingsBetween(from: string, to: string): Promise<ObBooking[]> {
    const out: ObBooking[] = [];
    let cursor: string | undefined;
    do {
      const q = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=${PAGE}` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
      const page = await getJson<{ bookings: ObBooking[]; next_cursor?: string }>(`${OB}/v1/bookings?${q}`);
      out.push(...page.bookings);
      cursor = page.next_cursor;
    } while (cursor);
    return out;
  },
  booking: (id: string) => getJson<ObBooking>(`${OB}/v1/bookings/${encodeURIComponent(id)}`),
  /** Both ends inclusive; the backend caps the range at 400 days. */
  routesBetween: (from: string, to: string) =>
    getJson<{ routes: ObRouteDays[] }>(`${OB}/v1/routes?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`).then((r) => r.routes),
  seatLocks: (date: string) =>
    getJson<{ seat_locks: ObSeatLock[] }>(`${OB}/v1/seat-locks?date=${encodeURIComponent(date)}`).then((r) => r.seat_locks),
  /** Everything van mode shows for one day. Cancelled bookings are already left out. */
  vanBoard: (date: string) => getJson<ObVanBoard>(`${OB}/operations/van-board?date=${encodeURIComponent(date)}`),
};
