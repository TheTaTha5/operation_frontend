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
};
