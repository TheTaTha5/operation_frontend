// View model for the By-trip tab's Van mode, ported from the van branches of legacy bkV2T2RouteHtml
// (allotment_v2/js/booking.js:8551-9410). The grouping, pools, rounds and warnings come from
// operation-backend's van board; this file only lays them out the way the legacy table does.
// Read-only (phase 1 in apps/web/docs/porting/van-mode.md).
import type { ObVanAllocation, ObVanBoard, ObVanGroup, ObVanOnDay, ObVanTrip } from '@/lib/ob';

import type { Row, ZoneBlock } from './byTrip';
import type { PaxSplit } from './model';
import { vanChipPair } from './vanColor';

/** Legacy PAL_BOAT: colours of a group with no van yet (booking.js:8556). */
const PAL_GROUP: [string, string][] = [
  ['#E6F1FB', '#185FA5'], ['#E1F5EE', '#0F6E56'], ['#FAEEDA', '#854F0B'], ['#EEEDFE', '#534AB7'],
  ['#FBEAF0', '#993556'], ['#EAF3DE', '#3B6D11'], ['#FAECE7', '#993C1D'],
];

export const isSelfArrive = (zone: string) => zone === 'NoTransfer' || zone === 'NT';

/** One table row in van mode: a booking's allocation (a split booking gives several). */
export interface VanRow {
  key: string;
  row: Row;
  /** null = the board has no allocation for this trip: shown as the whole trip, ungrouped. */
  alloc: ObVanAllocation | null;
  pax: PaxSplit;
  /** First allocation of its booking: carries the booking-level cells. */
  first: boolean;
}

export interface VanGroupView {
  group: ObVanGroup;
  van: ObVanOnDay | null;
  returnVan: ObVanOnDay | null;
  /** [background, ink]: the van's colour, or a palette colour while no van is picked. */
  colors: [string, string];
  rows: VanRow[];
}

export interface VanZone {
  unassigned: VanRow[];
  unassignedPax: number;
  groups: VanGroupView[];
}

const byTime = (r: VanRow) => r.alloc?.pickup.time_final || r.alloc?.pickup.time_booked || '99:99';

/**
 * Split a zone's rows into "not yet assigned" and one block per van group (legacy order:
 * ungrouped first, then groups by number; inside a group by manual order, then the column sort,
 * then pickup time).
 */
export function vanZone(zone: ZoneBlock, trip: ObVanTrip | undefined, vans: readonly ObVanOnDay[], cmp: (a: Row, b: Row) => number): VanZone {
  const vanById = (id: string | null) => (id ? vans.find((v) => v.id === id) || null : null);
  const rows: VanRow[] = [];
  for (const row of zone.rows) {
    const allocs = (trip?.allocations || []).filter((a) => a.booking_trip_id === row.t.id).sort((a, b) => a.idx - b.idx);
    if (!allocs.length) { rows.push({ key: row.key, row, alloc: null, pax: row.pax, first: true }); continue; }
    allocs.forEach((a, i) => rows.push({ key: `${row.key}@${a.idx}`, row, alloc: a, pax: a.pax, first: i === 0 }));
  }

  const groups = new Map<string, VanRow[]>();
  const unassigned: VanRow[] = [];
  for (const r of rows) {
    const gid = r.alloc?.group_id;
    if (!gid) { unassigned.push(r); continue; }
    const list = groups.get(gid);
    if (list) list.push(r); else groups.set(gid, [r]);
  }
  const inGroup = (a: VanRow, b: VanRow) =>
    (a.alloc?.sequence ?? 9999) - (b.alloc?.sequence ?? 9999) || cmp(a.row, b.row) || byTime(a).localeCompare(byTime(b));
  unassigned.sort((a, b) => cmp(a.row, b.row));

  const views: VanGroupView[] = [];
  for (const [gid, list] of groups) {
    const group = trip?.groups.find((g) => g.id === gid);
    if (!group) { unassigned.push(...list); continue; }
    const van = vanById(group.van_id);
    views.push({
      group, van, returnVan: vanById(group.return_van_id), rows: list.sort(inGroup),
      colors: van ? vanChipPair(van) : PAL_GROUP[(group.number - 1) % PAL_GROUP.length]!,
    });
  }
  views.sort((a, b) => a.group.number - b.group.number);
  return { unassigned, unassignedPax: unassigned.reduce((s, r) => s + r.pax.total, 0), groups: views };
}

/** One van chip in the VANS card (legacy vagg, booking.js:9345-9377). */
export interface VanChip {
  van: ObVanOnDay;
  ink: string;
  bookings: number;
  /** Pax per group, in group-number order: "4+9" when the van runs the route twice. */
  roundPax: number[];
  groupNumbers: number[];
  areas: string[];
  /** Over capacity in at least one round (legacy §vgRound2 checks each round, never the sum). */
  over: boolean;
}

export function vanChips(trip: ObVanTrip | undefined, vans: readonly ObVanOnDay[]): VanChip[] {
  if (!trip) return [];
  const out = new Map<string, VanChip>();
  for (const g of [...trip.groups].sort((a, b) => a.number - b.number)) {
    const van = g.van_id ? vans.find((v) => v.id === g.van_id) : undefined;
    if (!van) continue;
    const members = trip.allocations.filter((a) => a.group_id === g.id);
    const c = out.get(van.id) || { van, ink: vanChipPair(van)[1], bookings: 0, roundPax: [], groupNumbers: [], areas: [], over: false };
    c.bookings += members.length;
    c.roundPax.push(g.pax);
    c.groupNumbers.push(g.number);
    c.over ||= g.over_capacity;
    for (const a of members) if (a.pickup.area && !c.areas.includes(a.pickup.area)) c.areas.push(a.pickup.area);
    out.set(van.id, c);
  }
  return [...out.values()];
}

/** The Van mode button's count and the day warning chips (legacy booking.js:9705-9744, 9967). */
export function vanWarnings(board: ObVanBoard | null) {
  const w = board?.warnings;
  const sum = (l: { bookings: number; pax: number }[] | undefined) =>
    (l || []).reduce((s, x) => ({ bookings: s.bookings + x.bookings, pax: s.pax + x.pax }), { bookings: 0, pax: 0 });
  return { outbound: sum(w?.no_outbound_van), ret: sum(w?.no_return_van), twoRoutes: w?.van_on_two_routes || [] };
}
