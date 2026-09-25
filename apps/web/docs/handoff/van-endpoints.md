# Hand-off to operation-backend: van assignment endpoints

- **For:** operation-backend (`D:/projects/operation-backend`, checked at `347a19b` plus the untracked `migrations/013_booking_trip_operations.sql` and `src/tools/import-legacy.ts`)
- **From:** the Vue port of the By-trip "Van" mode. Frontend spec: `apps/web/docs/porting/van-mode.md`
- **Date:** 2026-09-25
- **Scope:** endpoints, contracts and schema only. The backend delivers no UI (operation-backend `CLAUDE.md`).

All legacy citations below are `allotment_v2/js/<file>:<line>` in `operation_frontend`.

---

## 0. Read first

1. **Legacy has no van "lock-in".** Nothing in the legacy code locks a van group or a job order against edits. Three things come close:
   - "✓ Save" on a group header (`bkV2VanGroupSave`, `booking.js:2413`) only renumbers the pickup order.
   - "Sent to driver" (`VANJOB_SENT`, `vans.js:1260`, `08-app.js:2757`) is a timestamp that is displayed but never enforced.
   - The Traveling Summary "FREEZE" exists only in `OPERATIONS_PIPELINE_DESIGN.md:12,126-129`.

   §6 drafts a lock as a **new feature**. It needs a product decision before anyone builds it.
2. **Migration 013 as written loses van data on every booking edit.**
   - `writeTrips` deletes and re-inserts all `booking_trips` rows of a booking (`src/domain/postgres-operations.ts:236-250`).
   - It runs on every `PATCH /v1/bookings/:id`, header-only ones included (`:322`), and on `partial-cancel` (`:349`).
   - `booking_trip_operations.booking_trip_id` is `ON DELETE CASCADE` (013:9), so the van assignment vanishes each time.

   Fix this before building anything (§2.1).
3. **Legacy stores van data very differently from the "one row per trip" 013 table.** The model in §2 follows what the legacy code actually does.
4. **The legacy server validates nothing.** Every van write in legacy is a generic `/api/v1/_batch` patch of `sb_bookings` (`server.js:3213-3238`), with no capacity, conflict or permission check. All the rules below live in client functions today. The endpoints are where they should become enforced.

---

## 1. How legacy van assignment works

### 1.1 Where the data sits

**Vehicles** are held in the global `SB_VEHICLES` (`08-app.js:164`) and saved to table `sb_vehicles` plus four child tables (`data-model/tables/sb_vehicles.js`):

| Field | Meaning |
|---|---|
| `id, name, plate, type, capacity, color, active` | Catalogue fields. `capacity` = seats. |
| `ownership` (`own` \| `partner`), `partnerName` | A partner van has no fixed plate, so the plate is overridden per day. |
| `zoneBase` (`PK` \| `KL`) | Home zone. |
| `driver, driverPhone` | Default driver. |
| `dayRoute{date: routeId \| routeId[]}` | **The month matrix.** It says which programmes a van serves on a date, and it is the only source of the outbound van pool. |
| `dayStatus{date}`, `statusRanges[]` | `off` / `maintenance` make the van unusable (`_vehUsableOn`, `vans.js:1243`). |
| `zoneOverrides[]`, `dayZone{date}` | **Not persisted.** There is no column (only a hardcoded `dayzone_2026_06_12`), so leave these out. |

**Per-day driver override:** `VANJOB_DRIVER['YYYY-MM-DD::vanId'] = {driver, phone, plate}` (`08-app.js:2779`, table `vanjob_driver`). `vanJobsDriverInfo` reads it and falls back to the vehicle's own values (`vans.js:1401`).

**Assignment** is held per booking **per service date**, in an "ops" block (`booking.js:1910-1947`):
- Day 1 of the booking → `booking.ops`. Later days → `trip.ops` for the trip on that date.
- The legacy trip is the natural key, and the backend's `booking_trips` row is its equivalent.

| Ops field | Meaning |
|---|---|
| `vanGroup` | Group number. 0 or missing = ungrouped. |
| `vanId` | Outbound van. |
| `vanSeq` | Manual pickup order inside the group. Missing = order by pickup time. |
| `vanReturnId` | Return van. Empty = returns on the group's outbound van. |
| `returnSameVan` | Staff confirmed "the outbound van also does the drop-off at a different address". |
| `pickupTimeFinal` | Pickup time as finalised by ops (free text, e.g. `07:30`). It overrides the booked time. |
| `vanSplits[]` | Splits one booking's passengers across groups/vans. See 1.2. |

### 1.2 Allocations (splits)

A booking on one day is one of two things:
- one **allocation** (the flat ops fields apply), or
- several allocations in `ops.vanSplits[]`, each `{ad, chd, inf, foc, pax, vanGroup, vanId, vanReturnId, vanSeq}`.

When splits exist, split[0] is the "main" part and the flat `vanGroup`/`vanId` are deleted (`booking.js:2465, 2889`).

Splits come from two places:
- **Manual** (✂): `bkV2SplitApply` (`booking.js:2450`) needs 1 ≤ moved < total. It warns, without blocking, when a part has children or infants and no adult. The moved part starts ungrouped, with no van.
- **Automatic**, from alternate pickups: `bkV2SyncAltPickupSplits` (`booking.js:2845`) gives one split per extra pickup or drop-off point. Main = total − alternates. Each extra split carries `fromAlt, pickAreaId, pickHotel, pickZone, dropAreaId, dropHotel, dropZone, altWho`. Assignments are kept by index. A drop-off-only alternate inherits the main part's van and group.

Unsplit (`bkV2VanUnsplit`, `booking.js:2525`) collapses everything back onto split[0]'s assignment, and the other splits' assignments are lost.

**Recommendation:** model every booking-day as having ≥1 allocation. An unsplit booking has exactly one allocation, idx 0, holding the full pax. This removes the flat-vs-split branch that every legacy function repeats.

### 1.3 Groups

A group is "the passengers that ride one outbound van together on one run".

- **Scope:** `(service_date, route_id, zone, group number)`, where zone = `bkV2EffZone(booking, trip)` (`booking.js:2958`), or `__CHARTER__` for charter trips (`_bkV2InZone`, `booking.js:2293`).
- **Numbering:** `_bkV2VanNextGroup` (`booking.js:2299`) takes the max number over every booking on that date and route (all zones, cancelled included) and adds 1. One sequence per date+route.
- **Van:** held on each member, not on the group. The group's van = the first member's van. `bkV2VanGroupHeal` (`booking.js:2338`) copies it to members that have none. It never touches the return van.
- **Mixed vans:** a group whose members disagree on the van is a **conflict**. `bkV2VanGroupConflicts` (`booking.js:2355`) reports it and never auto-fixes it (CLAUDE.md: "never auto-pick a van").

**Recommendation:** make the group a real row that holds the van (and the default return van and pickup time). This makes mixed-van groups impossible and removes the heal. The legacy import must still resolve existing conflicts; see §5.

### 1.4 The rules, one by one

| # | Rule | Legacy | Enforce as |
|---|---|---|---|
| R1 | Cancelled bookings (`cancelled`, `cancelled_weather`, `rejected`) take no part in groups, van pax, conflicts, pools or warnings. | everywhere, e.g. `booking.js:2338, 2355` | use `holdsSeats(status)` (`src/domain/booking-status.ts:29-31`) |
| R2 | **Outbound van pool** for (date, route) = active, usable vans whose `dayRoute[date]` includes the route. No zone fallback. An empty pool shows "no van assigned to this programme — assign in the month matrix". | `vanVehiclesForRoute` `vans.js:1248`, `_vehUsableOn` `:1243` | 422 when `van_id` is not in the pool |
| R3 | **Return van pool** = the outbound pool ∪ usable vans whose effective zone equals the booking's zone. NoTransfer → none. `__CHARTER__` / other → every usable van. Route `pier` → zone: `panwa` → PK, `tublamu` → KL. | `vanVehiclesForZone` `vans.js:1244`, `_vehRouteZone` `:2909` | 422 when outside the pool |
| R4 | **Capacity:** group pax ≤ van `capacity`. Checked when a van is set on a group and when members are added to a group that already has a van. A group without a van has no limit. | `bkV2VanGroupSetVan` `booking.js:2384`, `bkV2VanGroupSelected` `:2311` | 409 `van_over_capacity` |
| R5 | **Group pax** = the sum over allocations: split pax, or else the trip's pax. Every category takes a seat (infants and FOC included). | `bkV2VanGroupPax` `booking.js:2374` | reuse `paxTotal` (`src/domain/pax.ts:48`). See Q4 about the zone quirk. |
| R6 | **Rounds:** the same van may serve several groups of the **same route and day**. Each is a "round", ordered by earliest pickup time (not group number). Putting a van on a second group needs an explicit confirm. Round n > 1 without a time, or with the same time as round n−1, is flagged. | `_bkV2VanOtherGroups` `booking.js:3022`; `vjRoundAll`/`vjRoundOfC` `vans.js:1271-1333`; chips `booking.js:8863-8869` | 409 `van_in_other_group` unless `allow_second_round: true`; warnings in the board |
| R7 | **Capacity per round** is checked on each group, never summed across rounds. | `booking.js:9358-9367` | as R4 |
| R8 | **Van on two routes at the same time is NOT checked** in legacy. | — | report as a warning, don't block (Q5) |
| R9 | **Self-arrive:** zone NoTransfer (or NT) → no van at all. `booking.pickupSelf` → no outbound leg. A NoTransfer seat with a private-van add-on (`transfer-<route>-<PK\|KL>-<veh>`) counts as that van's zone. | `bkV2EffZone` `booking.js:2948-2963`; `bkV2VanCellHTML` `:3247` | 422 when grouping a NoTransfer allocation |
| R10 | **Return leg needed** (`sep`) when `dropoff_same = false` and a drop-off is set. **Self return** when the drop-off area zone is NoTransfer or its name matches `/self-?arrive\|กลับเอง\|self return/i`. **Arranged** = a return van is set (for splits: on every split). **Alert** = `sep && !arranged && !selfRet && !returnSameVan`. | `bkV2RetInfo` `booking.js:2251` | derive in the board |
| R11 | Setting a return van clears `returnSameVan`. Setting `returnSameVan = true` clears the return van. Legacy does this only on the per-booking setter; the group and split setters skip it. | `bkV2AssignVanReturn` `:2246`, `bkV2SetReturnSameVan` `:2248` | apply the same way on every setter |
| R12 | **Ordering inside a group:** `vanSeq` ascending (missing = last), then pickup time (`pickupTimeFinal` → trip time → booking time). New members get `seq = max + tick order`. "Save" renumbers 1..n in tick order. "Sort by time" deletes all `vanSeq`. | `booking.js:8785-8790, 2311, 2413, 2411` | `PUT …/order` |
| R13 | **Disband** clears group, van, return van and seq on every member. It keeps `returnSameVan` and `pickupTimeFinal`. There is no confirm. | `bkV2VanGroupDisband` `booking.js:2409` | `DELETE` group |
| R14 | **Clear route** nulls the outbound van on every allocation of (date, route). It keeps groups and return vans. It asks for a confirm. | `bkV2VanClearRoute` `booking.js:2279` | `POST …/clear` |
| R15 | **Trip date moves** → wipe that day's van fields. | `bkOpsClear` `booking.js:1933` | the carry-over rule in §2.1 |
| R16 | **Overnight charters:** days between outbound and return are "hold" rows (0 pax, never grouped). The return-leg day has no pickup ("↩ no pickup leg"). The outbound leg is skipped on the return job order and the other way round. | `booking.js:9506-9518, 9039`; `vanJobsOrderInner` `vans.js:2462` | board flags `leg: 'out' \| 'ret' \| 'hold'` |
| R17 | **Driver override** per (date, van): driver, phone, and plate (partner vans only in the UI). | `vanJobsSetDriver` `vans.js:1402` | `PUT /operations/van-days/…` |
| R18 | **Job order rows:** outbound = allocations on that van (optionally one group). Return = allocations whose `vanReturnId \|\| vanId` is that van. Cancelled bookings that still hold an assignment print struck through. | `vanJobsOrderInner` `vans.js:2462`, `vanJobsBookingsFor` `:1334` | `GET /operations/van-jobs` (phase 3) |

---

## 2. Proposed schema

### 2.1 Fix the cascade first

Pick one. **(a)** is the smallest change:

- **(a) Carry ops across trip rewrites.** In `writeTrips`, before the `DELETE`:
  - Read the ops, groups and allocations keyed by `(seq, route_id, service_date)`.
  - After the insert, restore them for every trip whose three values are unchanged. Drop the rest; this is R15.
  - Legacy's B2C sync does the same by `(sb_bookings_id, idx)` (`server.js:1588-1616`).
  - The in-memory store needs the same helper, as a pure function in `src/domain/` (`CLAUDE.md:56-63`).
- **(b)** Make `writeTrips` diff the trips (update in place, insert new, delete removed) instead of delete-all. It is cleaner, but touches capacity and lock-draw code.

Add a test: "`PATCH` header-only keeps the van group", plus "moving a trip's date clears its van".

### 2.2 Tables

013 is untracked. If it has not been applied to any shared database, **replace it**. Otherwise add 015 and drop the unused van columns from 013.

```sql
-- Fleet the ops board assigns (legacy sb_vehicles).
CREATE TABLE vans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plate TEXT,
  type TEXT,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  ownership TEXT NOT NULL DEFAULT 'own' CHECK (ownership IN ('own','partner')),
  partner_name TEXT,
  zone_base TEXT CHECK (zone_base IN ('PK','KL')),
  color TEXT,
  driver TEXT,
  driver_phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true
);

-- The month matrix: which programmes a van serves on a date (legacy dayRoute). Source of the pool.
CREATE TABLE van_day_routes (
  van_id TEXT NOT NULL REFERENCES vans (id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  route_id TEXT NOT NULL REFERENCES routes (id),
  PRIMARY KEY (van_id, service_date, route_id)
);
CREATE INDEX ON van_day_routes (service_date, route_id);

-- Per-day status and driver override (legacy dayStatus/statusRanges + VANJOB_DRIVER).
CREATE TABLE van_days (
  van_id TEXT NOT NULL REFERENCES vans (id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  status TEXT CHECK (status IN ('off','maintenance')),   -- NULL = usable
  driver TEXT,
  driver_phone TEXT,
  plate TEXT,
  sent_at TIMESTAMPTZ,            -- legacy VANJOB_SENT, informational
  PRIMARY KEY (van_id, service_date)
);

-- One outbound van run. Replaces legacy's implicit (date, route, zone, vanGroup) + vanId-on-members.
CREATE TABLE van_groups (
  id TEXT PRIMARY KEY,                               -- vgrp_<uuid>
  service_date DATE NOT NULL,
  route_id TEXT NOT NULL REFERENCES routes (id),
  zone TEXT NOT NULL,                                -- 'PK' | 'KL' | '__CHARTER__' | other effective zone
  number INTEGER NOT NULL CHECK (number > 0),        -- display number, one sequence per (date, route)
  van_id TEXT REFERENCES vans (id),                  -- NULL = "no van picked yet"
  return_van_id TEXT REFERENCES vans (id),           -- group default; NULL = same van
  pickup_time TEXT,                                  -- group time ("ตั้งเวลาทั้งกรุ๊ป")
  UNIQUE (service_date, route_id, number)
);

-- Per booking-trip day: what is not per allocation.
CREATE TABLE booking_trip_operations (
  booking_trip_id TEXT PRIMARY KEY REFERENCES booking_trips (id) ON DELETE CASCADE,
  pickup_time_final TEXT,
  return_same_van BOOLEAN NOT NULL DEFAULT false,
  -- keep 013's non-van columns (boat_id, upgrade, pier_checkin, reconfirm_*) here
  ...
);

-- ≥1 per booking-trip that needs a van. idx 0 = main part. Unsplit = one row with the trip's full pax.
CREATE TABLE booking_trip_van_allocations (
  booking_trip_id TEXT NOT NULL REFERENCES booking_trips (id) ON DELETE CASCADE,
  idx INTEGER NOT NULL CHECK (idx >= 0),
  ad INTEGER NOT NULL DEFAULT 0, chd INTEGER NOT NULL DEFAULT 0,
  inf INTEGER NOT NULL DEFAULT 0, foc INTEGER NOT NULL DEFAULT 0,
  van_group_id TEXT REFERENCES van_groups (id) ON DELETE SET NULL,
  sequence INTEGER,                                  -- legacy vanSeq; NULL = by time
  return_van_id TEXT REFERENCES vans (id),           -- overrides the group default
  source TEXT NOT NULL DEFAULT 'main' CHECK (source IN ('main','manual','alt_pickup')),
  pick_area_id TEXT, pick_hotel TEXT, pick_zone TEXT,  -- alt_pickup only
  drop_area_id TEXT, drop_hotel TEXT, drop_zone TEXT,
  PRIMARY KEY (booking_trip_id, idx)
);
CREATE INDEX ON booking_trip_van_allocations (van_group_id);
```

Notes:
- **No row = "whole trip, ungrouped".** The board treats a trip with no allocation rows as one virtual idx-0 allocation with full pax. So only trips someone has touched get rows, and the import stays small.
- **The allocation pax grid** uses legacy's `ad/chd/inf/foc`, since splits don't carry residency. Its sum must never exceed the trip's `paxTotal`. When a booking amendment shrinks the trip, shrink idx 0 first. Legacy `bkV2HealSplitPax` (`booking.js:2907`) rebalances so no part has children without an adult; keep that as a warning, not an auto-edit.
- **`van_groups.zone`** is stored, not derived, because the effective zone depends on add-ons (R9). Adding an allocation whose zone differs from the group's → 422.
- **Group number:** legacy counts cancelled bookings. Here, numbers come from `van_groups` rows, so a disbanded group frees nothing and numbers only grow. Take `max + 1` under the same advisory-lock pattern as capacity (`postgres-operations.ts:139, 212-218`), keyed `van:<date>:<route>`.

---

## 3. Endpoints

All live under `/operations/`, so the existing `preHandler` gives them `operations:read` / `operations:write` (`src/routes/operations.ts:148-155`). Writes run in `store.transaction` and return the updated board slice so the client doesn't need a second GET. Errors use the existing Fastify shape `{statusCode, error, message}`, plus a machine `code` for the 409/422 cases the UI must tell apart.

### 3.1 `GET /operations/van-board?date=YYYY-MM-DD[&route_id=]`

Everything van mode renders, for one day. It replaces the legacy client-side pipeline in `bkV2RenderTab2` (`booking.js:9480-9531`) and `bkV2T2RouteHtml` (`booking.js:8551-9410`). Derive it in a pure `src/domain/van-board.ts` that both stores call.

```json
{
  "date": "2026-10-02",
  "vans": [
    { "id": "v7", "name": "Van 7", "plate": "นข 1234", "capacity": 12, "color": "#0F6E56",
      "ownership": "own", "zone_base": "PK", "usable": true, "route_ids": ["sim-dt"],
      "driver": "Somchai", "driver_phone": "08…", "driver_overridden": false }
  ],
  "trips": [
    {
      "route_id": "sim-dt",
      "pool": { "outbound": ["v7", "v9"] },
      "groups": [
        { "id": "vgrp_…", "number": 1, "zone": "PK", "van_id": "v7", "return_van_id": null,
          "pickup_time": "06:40", "pax": 11, "capacity": 12, "over_capacity": false,
          "round": { "no": 1, "of": 2, "time": "06:40" }, "round_warning": null }
      ],
      "allocations": [
        { "booking_id": "lg_123", "booking_trip_id": "trip_lg_123_0", "idx": 0, "split": false,
          "status": "confirmed", "zone": "PK", "leg": "out",
          "pax": { "ad": 2, "chd": 1, "inf": 0, "foc": 0, "total": 3 },
          "group_id": "vgrp_…", "sequence": 2,
          "pickup": { "hotel": "…", "area": "…", "room": "…", "time_booked": "06:30-06:45", "time_final": "06:40" },
          "return": { "needed": true, "self": false, "same_van": false, "van_id": null, "alert": true, "pool": ["v7","v9","v3"] } }
      ],
      "totals": { "unassigned_pax": 4, "self_arrive_pax": 2 }
    }
  ],
  "warnings": {
    "no_outbound_van": [{ "route_id": "sim-dt", "bookings": 3, "pax": 7 }],
    "no_return_van":   [{ "route_id": "sim-dt", "bookings": 1, "pax": 2 }],
    "van_on_two_routes": [{ "van_id": "v9", "route_ids": ["sim-dt", "phi-sp"] }]
  }
}
```

- **The frontend already consumes this shape** (`ObVanBoard` in `apps/web/src/lib/ob.ts`, phase 1 of the Vue van mode). Tell the frontend if you change it. Until it ships, the page treats a 404 as "not in the backend yet".
- `round_warning` is `'no_time' | 'same_time' | null`. `round` is `null` when the van runs the route once that day.
- `vans[]` holds the vans the board refers to, so phase 1 needs no separate `GET /operations/vans`.
- Cancelled bookings are left out of groups, pax and warnings (R1). Return them separately only if the board needs the struck-through list (legacy shows cancelled rows in a compact list, `booking.js:9233-9250`).
- `leg` is `out` / `ret` / `hold` (R16). `hold` allocations carry `pax.total = 0` and cannot be grouped.
- The pools are computed here (R2, R3), so the client never re-implements them.
- **Legacy bug to not copy:** the "no outbound van" count reads day-1 `b.ops` and the raw zone (`booking.js:9719-9723`), so day 2+ of a multi-day booking is miscounted. Compute per trip.

### 3.2 Groups

| Method + path | Body | Rule | Errors |
|---|---|---|---|
| `POST /operations/van-groups` | `{service_date, route_id, zone, allocations:[{booking_trip_id, idx}], van_id?}` | Next number (§2.2). Members in body order get `sequence` 1..n. Replaces "👥 new group" (`bkV2VanGroupSelected(...,'new')`, `booking.js:2311`). | 422 `zone_mismatch` / `not_on_trip` / `self_arrive` / `cancelled`; 409 `van_over_capacity` |
| `POST /operations/van-groups/:id/members` | `{allocations:[…]}` | Appends with `sequence = max + i + 1`. Moves allocations out of their old group. Capacity only if the group has a van (R4). Replaces "+ group g". | same |
| `DELETE /operations/van-groups/:id/members/:booking_trip_id/:idx` | — | Ungroup one allocation (legacy has no single-row ungroup; it's cheap to add and the UI can ignore it). | 404 |
| `PATCH /operations/van-groups/:id` | `{van_id?: string\|null, return_van_id?: string\|null, pickup_time?: string\|null, allow_second_round?: boolean}` | `van_id`: R2 + R4 + R6. `return_van_id`: R3, and sets `return_same_van = false` on members (R11). `pickup_time`: writes the group time **and** every member's `pickup_time_final`, as legacy does (`bkV2VanGroupSetTime`, `booking.js:2410`). | 422 `van_not_in_pool`; 409 `van_over_capacity`, `van_in_other_group` (body lists `{group_number, pickup_time}` so the UI can show the legacy confirm text) |
| `PUT /operations/van-groups/:id/order` | `{allocations:[{booking_trip_id, idx}]}` or `{clear: true}` | Rewrites `sequence` 1..n in the given order. `clear` nulls all (R12). | 422 when the list is not exactly the members |
| `DELETE /operations/van-groups/:id` | — | Disband (R13). Allocations lose group, sequence and return van. `return_same_van` and `pickup_time_final` stay. 204. | 404 |
| `POST /operations/van-board/clear` | `{service_date, route_id}` | Nulls `van_id` on every group of that trip (R14). | — |

### 3.3 Per booking-trip and per allocation

| Method + path | Body | Rule |
|---|---|---|
| `PATCH /operations/trip-ops/:booking_trip_id` | `{pickup_time_final?: string\|null, return_same_van?: boolean}` | `return_same_van: true` nulls `return_van_id` on every allocation of the trip (R11; legacy leaves split return ids untouched, fix that here). `pickup_time_final` is trimmed free text, as in legacy (`bkV2SetPickupFinal`, `booking.js:3008`). Consider validating `HH:MM` (Q6). |
| `PATCH /operations/van-allocations/:booking_trip_id/:idx` | `{return_van_id: string\|null}` | R3 pool; also sets `return_same_van = false`. Legacy only allows it when the allocation is grouped (`booking.js:3272`). |
| `POST /operations/trip-ops/:booking_trip_id/split` | `{from_idx: 0, move: {ad, chd, inf, foc}}` | 1 ≤ moved < part total. The new allocation is ungrouped. Response `warnings: ['child_without_adult']` when a part has chd/inf and no ad (`bkV2SplitApply`, `booking.js:2450`). |
| `POST /operations/trip-ops/:booking_trip_id/unsplit` | — | Back to one idx-0 allocation with split[0]'s group, sequence and return (`bkV2VanUnsplit`, `booking.js:2525`). Refuse (422 `alt_pickup_split`) for `alt_pickup` rows, because legacy's heal re-creates them straight away. |

Automatic alternate-pickup splits: the backend has no `alt_pickups` on bookings yet. Until it does, `source='alt_pickup'` rows only come from the import. Q3.

### 3.4 Vans and the month matrix

| Method + path | Purpose |
|---|---|
| `GET /operations/vans` | Catalogue. |
| `POST /operations/vans`, `PATCH /operations/vans/:id` | Catalogue edits (legacy Vans page). Don't delete; set `active=false` (root CLAUDE.md: don't delete fields/records). |
| `GET /operations/van-days?from&to` | Matrix + status + drivers for a range (legacy month matrix, `vans.js` `vehDay*`). |
| `PUT /operations/van-days/:service_date/:van_id` | `{route_ids?: string[], status?: 'off'\|'maintenance'\|null, driver?, driver_phone?, plate?}`. Changing `route_ids` does **not** unassign groups that use the van; the board reports them under `warnings.van_not_in_pool`. |

Phase 1 of the Vue port needs only `GET /operations/vans` and `PUT …/van-days` for the driver fields (R17). The matrix editor is its own port.

### 3.5 Job orders (phase 3)

`GET /operations/van-jobs?date&van_id[&route_id&group_id&leg=out|ret]` returns the rows of R18 in print order (group, sequence, time), with the driver info (R17). The printable layout stays in the frontend (`vanJobsOrderInner`, `vans.js:2462`).

---

## 4. Rules that must be the same on both stores

Put them in pure functions in `src/domain/van-board.ts` (`CLAUDE.md:56-63`) and unit-test them directly like `capacity.test.ts`:

- `vanPool(date, route, vans, vanDays)` → R2
- `returnPool(date, route, zone, …)` → R3
- `groupPax(allocations, trips)` → R5
- `rounds(groups)` → R6/R7
- `returnInfo(booking, allocations, tripOps)` → R10
- `effectiveZone(booking, trip)` → R9 (port of `bkV2EffZone`, `booking.js:2948-2963`)

Tests worth writing:
- capacity 409 on set-van and on add-members
- second round needs `allow_second_round`
- R1 (a cancelled booking is excluded from the board and cannot be grouped)
- NoTransfer is refused
- disband keeps `pickup_time_final`
- a header-only `PATCH /v1/bookings/:id` keeps groups (§2.1)
- a trip date move clears them

---

## 5. Import from legacy

Extend `src/tools/import-legacy.ts`. Today it reads `sb_bookings__trips` for dates, pax, mode, charter boat and lock draws only (`:167-205`).

**Vehicles and drivers:**
- `sb_vehicles` → `vans`.
- `sb_vehicles__dayroute` (key = date, value = route id or JSON array) → `van_day_routes`.
- `sb_vehicles__daystatus` + `__statusranges` → `van_days.status`.
- `vanjob_driver` (key `date::vanId`) → `van_days` driver fields.
- `vanjob_sent` → `van_days.sent_at` (key `date::vanId[~route[~group]]`; take the van part).

**Van ops per trip:**
- Day 1 ops come from `sb_bookings.ops_*`. Later days come from `sb_bookings__trips.ops_*` for the trip on that date.
- Columns: `ops_vangroup, ops_vanid, ops_vanseq, ops_vanreturnid, ops_returnsamevan, ops_pickuptimefinal, ops_vansplits` (`data-model/tables/sb_bookings.js:87-148, 215-221`).
- Map to the `lg_` trip whose `service_date` matches.

**Groups:**
- Group by `(date, route, effective zone, vanGroup)`, skipping cancelled bookings (R1). Create one `van_groups` row per key.
- `van_id` = the van on the most members. On a tie or disagreement, set `van_id = NULL` and print the conflict to the import log. Do not guess (the legacy `bkV2VanGroupConflicts` rule).
- The number is kept, but legacy may repeat a number across zones. When it does, renumber the later zone to `max + 1` and log it.

**Splits:**
- `ops_vansplits` (JSON) → one allocation per element. Pax comes from `ad/chd/inf/foc`.
- Set `source='alt_pickup'` when an element has `fromAlt`, else `'manual'`, and `'main'` for idx 0.

`ops.altSplitAuto`, `vanCkS` and `zoneOverrides` have no legacy column and cannot be imported. Nothing is lost that was not already lost.

Van check-in (`ops_vancheckin`, JSON, per-split under `_s[i]`, `checkin.js:406-470`) belongs to the check-in port. Leave it out of this hand-off.

---

## 6. Lock-in (new feature; decide before building)

Legacy has no lock. If ops wants one, here is the smallest design consistent with the above:

- `van_days.locked_at TIMESTAMPTZ, locked_by TEXT`, locking **one van's work for one day**. It naturally follows "job order sent to driver" (`sent_at`).
  - `POST /operations/van-days/:service_date/:van_id/lock` / `…/unlock`
- While locked, any write that changes an allocation on that van (group van, members, order, disband, split, return van, pickup time, clear-route) → **423 `van_locked`**.
- The same for a `PATCH /v1/bookings/:id` that would drop or move a trip with an allocation on a locked van. Either refuse, or accept and flag the board with `warnings.changed_after_lock`. Product must pick one.
- The board returns `locked_at` / `locked_by` per van.

`request.user` is set but never read (`src/auth.ts:98,106`), so there is no actor stamping yet. Adding `locked_by` is the first place it would be read.

---

## 7. Open questions

1. **Cut-over.** The import is a one-off, and legacy keeps writing `sb_bookings.ops_*` while staff use it. If the Vue van mode writes to operation-backend while anyone still uses legacy van mode, the two copies diverge. Should Vue van mode be read-only until legacy van mode is switched off for everyone, or does ops switch over on a set date?
2. **Lock-in (§6):** wanted? Per van-day, per group, or per whole day?
3. **Alternate pickups:** the backend has no `alt_pickups` on bookings. Model them (with auto-splits generated server-side) now, or keep them import-only for now?
4. **Zone quirk:** legacy `bkV2VanGroupPax` uses the raw trip zone, so a NoTransfer seat with a private-van add-on counts as 0 pax (`booking.js:2374`). Fix it (use the effective zone everywhere)? Recommended: yes.
5. **Van on two routes at once (R8):** legacy doesn't check. Warn only, or block when the pickup times overlap?
6. **`pickup_time_final` format:** legacy stores free text (e.g. `06.30`, `07:30-07:45`). Validate `HH:MM`, or keep it as text?
7. **013 status:** has `013_booking_trip_operations.sql` been applied to any shared database? This decides "replace 013" versus "add 015".
