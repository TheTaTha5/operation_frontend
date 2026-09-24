// Month view model for the Calendar, built from operation-backend's availability range.
// Mirrors the legacy month grid (renderCal / _calTripsFor in 04-data-core.js) where the backend
// has the data: one chip per route with boats that day, free seats, FULL, CH(arter), closed piers.
// Not yet available from the backend, so not shown: boat down/repair, weather closures, land routes.
import { addDays, localYmd } from '@/lib/date';
import type { ObAvailabilityDay, ObBoat, ObRoute } from '@/lib/ob';

export const PIERS = ['tublamu', 'panwa', 'ranong', 'other'] as const;
export type Pier = (typeof PIERS)[number];
export const PIER_LABEL: Record<Pier, string> = { tublamu: 'TL', panwa: 'VP', ranong: 'RN', other: 'OT' };
export const PIER_NAME: Record<Pier, string> = { tublamu: 'Tub Lamu', panwa: 'Visit Panwa', ranong: 'Ranong', other: 'Other' };
export const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];

/** A route's pier as one of the calendar's four groups (legacy §otherPier). */
export const pierOf = (r: ObRoute | undefined): Pier =>
  (PIERS as readonly string[]).includes(r?.pier || '') ? (r!.pier as Pier) : 'other';

export interface Chip {
  routeId: string;
  name: string;
  color: string;
  free: number;
  cap: number;
  /** Percent of deployed seats no longer on sale (booked, locked or chartered), 0–100. */
  pctSold: number;
  boats: { id: string; name: string; capacity: number; chartered: boolean }[];
  full: boolean;
  /** Every seat is gone to a charter: the legacy "CH" badge. */
  charterOnly: boolean;
  day: ObAvailabilityDay;
}

export interface DayCell {
  date: string;
  day: number;
  today: boolean;
  past: boolean;
  chips: Chip[];
  /** Piers with every route closed today (and not closed all month, which the strip shows). */
  shut: Pier[];
}

export interface MonthView {
  year: number;
  /** 0-based. */
  month: number;
  from: string;
  to: string;
  /** Leading blank cells so the 1st lands under its weekday (weeks start on Sunday). */
  pad: number;
  cells: DayCell[];
  /** Routes that appear this month under the pier filter, with their route-day count and seats free across those days. */
  routes: { id: string; name: string; color: string; pier: Pier; trips: number; free: number }[];
  /** Piers whose every route is closed on every day of the month. */
  closedAllMonth: Pier[];
  stats: { trips: number; free: number; cap: number; pctSold: number };
}

export interface Filters {
  pier: Pier | '';
  hidden: ReadonlySet<string>;
}

/** First and last day of a month, as the availability range. */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const from = localYmd(new Date(year, month, 1, 12));
  const to = localYmd(new Date(year, month + 1, 0, 12));
  return { from, to };
}

/** Minutes after midnight of a route's first departure; routes without times sort last. */
function depMinutes(r: ObRoute | undefined): number {
  const t = r?.times?.[0];
  const m = t ? /^(\d{1,2}):(\d{2})/.exec(t) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60;
}

const pct = (cap: number, free: number) => (cap > 0 ? Math.round(((cap - free) / cap) * 100) : 0);

export function buildMonth(
  year: number,
  month: number,
  days: readonly ObAvailabilityDay[],
  routes: readonly ObRoute[],
  boats: readonly ObBoat[],
  f: Filters,
  today: string = localYmd(),
): MonthView {
  const { from, to } = monthRange(year, month);
  const routeById = new Map(routes.map((r) => [r.id, r]));
  const boatName = new Map(boats.map((b) => [b.id, b.name]));
  const inPier = (id: string) => !f.pier || pierOf(routeById.get(id)) === f.pier;

  const byDate = new Map<string, ObAvailabilityDay[]>();
  for (const d of days) {
    if (d.service_date < from || d.service_date > to) continue;
    const list = byDate.get(d.service_date);
    if (list) list.push(d); else byDate.set(d.service_date, [d]);
  }

  // A pier is closed on a day when it has routes and none of them is open.
  const piersShown = f.pier ? [f.pier] : [...PIERS];
  const pierClosed = (list: readonly ObAvailabilityDay[], p: Pier) => {
    const mine = list.filter((d) => pierOf(routeById.get(d.route_id)) === p);
    return mine.length > 0 && mine.every((d) => !d.open);
  };
  const dates: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
  const closedAllMonth = piersShown.filter((p) => dates.every((d) => pierClosed(byDate.get(d) || [], p)));

  const routeTrips = new Map<string, number>();
  const routeFree = new Map<string, number>();
  let trips = 0, free = 0, cap = 0;
  const cells: DayCell[] = dates.map((date) => {
    const list = byDate.get(date) || [];
    const chips: Chip[] = [];
    for (const d of list) {
      // Legacy shows a route only on days a boat runs it, and never on a closed day.
      if (!d.open || d.deployments.length === 0 || !inPier(d.route_id)) continue;
      routeTrips.set(d.route_id, (routeTrips.get(d.route_id) || 0) + 1);
      routeFree.set(d.route_id, (routeFree.get(d.route_id) || 0) + Math.max(0, d.available_seats));
      if (f.hidden.has(d.route_id)) continue;
      const r = routeById.get(d.route_id);
      const full = d.deployed_capacity > 0 && d.available_seats <= 0;
      chips.push({
        routeId: d.route_id,
        name: r?.name || d.route_id,
        color: r?.color || '#8b909c',
        free: Math.max(0, d.available_seats),
        cap: d.deployed_capacity,
        pctSold: pct(d.deployed_capacity, Math.max(0, d.available_seats)),
        boats: d.deployments.map((b) => ({ id: b.boat_id, name: boatName.get(b.boat_id) || b.boat_id, capacity: b.capacity, chartered: b.chartered })),
        full,
        charterOnly: full && d.deployments.some((b) => b.chartered),
        day: d,
      });
      trips++; free += Math.max(0, d.available_seats); cap += d.deployed_capacity;
    }
    chips.sort((a, b) => depMinutes(routeById.get(a.routeId)) - depMinutes(routeById.get(b.routeId)) || a.name.localeCompare(b.name));
    return {
      date,
      day: Number(date.slice(8)),
      today: date === today,
      past: date < today,
      chips,
      shut: piersShown.filter((p) => !closedAllMonth.includes(p) && pierClosed(list, p)),
    };
  });

  return {
    year, month, from, to,
    pad: new Date(year, month, 1, 12).getDay(),
    cells,
    routes: routes
      .filter((r) => routeTrips.has(r.id))
      .map((r) => ({ id: r.id, name: r.name, color: r.color || '#8b909c', pier: pierOf(r), trips: routeTrips.get(r.id)!, free: routeFree.get(r.id) || 0 })),
    closedAllMonth,
    stats: { trips, free, cap, pctSold: pct(cap, free) },
  };
}
