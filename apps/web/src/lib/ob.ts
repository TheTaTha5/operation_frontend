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

export const ob = {
  routes: () => getJson<{ routes: ObRoute[] }>(`${OB}/v1/routes`).then((r) => r.routes),
  boats: () => getJson<{ boats: ObBoat[] }>(`${OB}/v1/boats`).then((r) => r.boats),
  /** Both ends inclusive. The backend caps a range over every route at 62 days. */
  availability: (from: string, to: string) =>
    getJson<{ days: ObAvailabilityDay[] }>(
      `${OB}/v1/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ).then((r) => r.days),
};
