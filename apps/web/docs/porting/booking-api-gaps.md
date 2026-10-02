# Booking page: API gaps for the remaining pieces

- **Scope:** an API inventory for the parts of the legacy Booking page (`data-view="booking"`) that are
  not in Vue yet: Seat Locks tab, รออนุมัติ tab, Cancellations tab, new/edit booking, van assign writes,
  and the other actions in `booking.js`. For each piece: the legacy function, what it reads and writes,
  the matching operation-backend route, and the gap. There is no style or component plan here.
- **Legacy sources:** `allotment_v2/js/booking.js` (14,912 lines), `08-app.js`, `04-data-core.js`,
  `accounting.js`, `checkin.js`, `vans.js`, `server.js`.
- **Backend sources:** `operation-backend@6afb049` (branch `feat/agents-read-slice`, "read-only agents,
  markets and salespeople"), `src/routes/operations.ts`, `src/domain/*.ts`, `migrations/001–017`.
  - `main` (`43142a8`) is behind it: it has no agents routes, no trip `zone`/`pickup_time`/OVN fields
    (migration 015), no van tables (016) and no agent tables (017). Every route line below is
    `src/routes/operations.ts` at `6afb049` unless it says otherwise.
  - `D:/projects/ops_backend` is a different, older repo (`operation_love_andaman`). It is not used here.
- **Already ported (read-only):** `features/bookings/` (`BookingsView` = All bookings, `ByTripView` =
  By trip · date incl. van mode, `BookingDetailView`), `features/calendar`, `features/travel-summary`,
  `features/agents`. Related specs: [seat-locks.md](seat-locks.md), [van-mode.md](van-mode.md),
  [rate-types.md](rate-types.md), [agents.md](agents.md), [booking-entities.md](booking-entities.md).
- **Date:** 2026-10-02

Status values: **exists** = the route does what the legacy piece needs; **partial** = the route exists
but misses something (named); **missing** = no route. "n/a" rows need no API and are not counted.

---

## 0. Endpoints the Vue app already calls

These are not new work. All go through `/api/ob/<path>` (`api-proxy.js:58-61`) via `apps/web/src/lib/ob.ts:305-351`.

| `ob.ts` method | Endpoint | Backend route | Used by |
|---|---|---|---|
| `routes` | `GET /v1/routes` | `:219` | BookingsView, BookingDetailView, CalendarView, agents store |
| `routesBetween` | `GET /v1/routes?from&to` (calendar open/closed) | `:219` | ByTripView |
| `boats` | `GET /v1/boats` | `:248` | BookingDetailView, ByTripView, CalendarView |
| `availability` | `GET /v1/availability?from&to` | `:261` | ByTripView, CalendarView |
| `bookingsBetween` | `GET /v1/bookings?from&to&cursor` | `:292` | BookingsView, ByTripView |
| `booking` | `GET /v1/bookings/:id` | `:296` | BookingDetailView |
| `seatLocks` | `GET /v1/seat-locks?date` | `:358` | ByTripView (Seat Lock card) |
| `agents`, `agent` | `GET /v1/agents?active=true`, `GET /v1/agents/:id` | `:349`, `:350` | agents store |
| `markets`, `salesPeople` | `GET /v1/markets`, `GET /v1/sales` | `:347`, `:348` | agents store |
| `agentActivity` | `GET /v1/agents/:id/activity` | `:351` | agents store |
| `agentBookings` | `GET /v1/bookings?agent_id&sort=-booking_date` | `:292` | agents store. The backend reads `order=asc\|desc` on `created_at` (`:145-159`); `sort=-booking_date` is ignored. |
| `rateTypes` | `GET /v1/rate-types` | **none** (404) | agents store |
| `vanBoard` | `GET /operations/van-board?date` | **none** (404) | vanBoard store |

`features/travel-summary/api.ts` reads the legacy server (`/api/v1/*`, `/api/ck`), not operation-backend.

Backend routes that exist but Vue does not call yet: `POST /v1/login` (`:206`), `POST /v1/bookings` (`:297`),
`PATCH /v1/bookings/:id` (`:301`), `POST …/cancel` (`:305`), `…/partial-cancel` (`:309`), `…/reschedule` (`:314`),
`GET /v1/manifest` (`:321`), `GET /operations/allotment` (`:326`), `GET/POST/DELETE /operations/deployments`
(`:330-341`), `POST /v1/seat-locks` (`:362`), `PATCH /v1/seat-locks/:id` (`:363`), `POST …/release` (`:369`),
and the single-day form of `/v1/availability?route_id&date&exclude_booking_id` (`:261-269`).

---

## 1. Seat Locks tab

Legacy: `bkV2RenderLocks` (`booking.js:623`). Full field-level analysis is in [seat-locks.md](seat-locks.md); this table
only restates the API side, re-checked at `6afb049`.

| # | Piece | Legacy function | Reads / writes | Backend route | Status | Vue uses? |
|---|---|---|---|---|---|---|
| 1.1 | Lock list, all dates | `bkV2RenderLocks` (`623`) | `SB_SEAT_LOCKS` | `GET /v1/seat-locks` without filters (`:358`) | exists | only `?date=` |
| 1.2 | Locks of one day | `bkV2LocksOnDate` (`1025`) | same | `GET /v1/seat-locks?date` (`:358`) | exists | yes (ByTripView) |
| 1.3 | Used / held seats | `bkV2LockUsedOn`, `bkV2LockHeldRemaining` (`25-59`) | `used`, `usedBy` | `drawn_pax`, derived from `booking_trip_lock_draws` | exists | yes |
| 1.4 | Holder name / colour | `bkV2LockHolderName` (`618`), `bkV2LockHolderColor` (`1006`) | `SB_AGENTS` | `GET /v1/agents` (`:349`) | exists | yes (agents store) |
| 1.5 | Create day lock | `bkV2CreateLock` (`171`), `bkV2LockCreateSubmit` (`481`), `bkV2LockFromCalendar` (`508`) | new lock | `POST /v1/seat-locks` (`:362`) | exists | no |
| 1.6 | Add seats | `bkV2LockAddSeats` (`339`) | `qty` += n, `log[]` | `PATCH /v1/seat-locks/:id {pax}` (`:363`) | partial: no note/log (1.12) | no |
| 1.7 | Partial release | `bkV2ReleaseLock` (`353`) | `qty` −= n | `PATCH /v1/seat-locks/:id {pax}`; 409 below `drawn_pax` | exists | no |
| 1.8 | Full release | `bkV2ReleaseLock` (`353`) | `status:'released'` | `POST /v1/seat-locks/:id/release` (`:369`) | exists | no |
| 1.9 | Bulk / month locks (`scope`, `dateFrom/To`, `dow[]`) | `bkV2CreateLock` (`171`), `bkV2LockSpansDays` (`25`) | range lock, per-day `usedBy` | — | missing (seat-locks.md draft A) | no |
| 1.10 | Sub-groups (`parentId`, `subName`) | `bkV2CreateSubLock` (`522`), `bkV2SubCommit` (`604`), `bkV2LockPoolHold` (`139-153`) | child locks | — | missing (draft B) | no |
| 1.11 | Release cutoff (`releaseDaysBefore`, `releaseTime`) | `bkV2LockReleaseCutoff` (`65-87`) | per-trip release | — | missing (draft C) | no |
| 1.12 | Note, `createdBy`, `log[]` | `bkV2CreateLock`, `bkV2LockAddSeats` | audit | only `created_at`/`updated_at` | missing (draft D) | no |
| 1.13 | Holder type office / global | `bkV2CreateLock` | `holderType` | `agent_id` null only | missing | no |
| 1.14 | Draw only by the lock's agent | `bkV2DrawSources` (`125`) | rank agent → office → global | draw checks `remaining` only (`capacity.ts:141`) | partial: agent not enforced (draft F) | no |
| 1.15 | Claims / coverage | `bkV2LockClaims` (`241`), `bkV2LockCoverage` (`272`) | bookings that drew / bypassed | `GET /v1/bookings` → `trips[].lock_draws` | exists (`ObTrip` lacks `lock_draws`) | partly |
| 1.16 | Sweep / fix counters | `bkV2LockSweep` (`552`), `bkV2LockFixUsed` (`307`), `bkV2LockExpireSweep` (`89`) | repairs `used` | not needed: `drawn_pax` is derived | n/a | — |

---

## 2. รออนุมัติ (pending approval) tab

Legacy: `bkV2RenderApprovals` (`booking.js:6319`), badge count in `bkV2RenderTopbar` (`6236`, tab button at `6245`).

| # | Piece | Legacy function | Reads / writes | Backend route | Status | Vue uses? |
|---|---|---|---|---|---|---|
| 2.1 | List `status='pending_approval'`, any date | `bkV2RenderApprovals` (`6323`) | `SB_BOOKINGS` | `GET /v1/bookings` (`:292`) | partial: no `status=` filter, so the client must page through every booking | no |
| 2.2 | Tab badge count | `bkV2RenderTopbar` (`6245`), `bkV2TopbarMeta` (`6271`, `6292-6294`) | count | — | partial: same filter, plus no count | no |
| 2.3 | Approval record: `reason`, `over[]` (name, date, need, overBy, licFree), `totOver`, `discount`, `saleName`, `requestedBy/At`, `targetStatus` | `bkV2RenderApprovals` (`6325-6358`), `bkV2EnsureApproval` (`6378`) | `b.approval` | — (planned `booking_approvals`, `todo/booking-model.md`) | missing | no |
| 2.4 | Recent decisions (last 15 by `approvedAt`) | `bkV2RenderApprovals` (`6324`) | `approval.status/approvedBy/approvedAt` | — | missing | no |
| 2.5 | Pending reason `closed_day` / `b2c_hold` / `over_cap` | `bkV2PendReason` (`6366`) | trips + calendar + id prefix | `GET /v1/routes?from&to` (`:219`) | exists (derivable) | yes (`routesBetween`) |
| 2.6 | Seat impact "after approval" (excluding own seats) | `bkV2ApprovalImpact` (`6389`) → `getAllotment` (`04-data-core.js:8681`) | sellable, licence free | `GET /v1/availability?route_id&date&exclude_booking_id` (`:261-269`) → `available_seats`, `licensed_capacity` | exists (not in `ob.ts`) | no |
| 2.7 | Approve | `bkV2ApproveBooking` (`6415`) | `approval.status/approvedBy/approvedAt`, `status = targetStatus`, `confirmedBy/At`, history | `PATCH /v1/bookings/:id {status, confirmed_by, confirmed_at}` (`:301`) | partial: no approval record or history; and an over-cap booking cannot be approved, because `amendBooking` re-checks seats and returns 409 (`postgres-operations.ts:401`, `capacity.ts:156`). Needs a manager override. | no |
| 2.8 | Reject | `bkV2RejectBooking` (`6435`) | `approval.status/by/at/note`, `status='rejected'`, history | `PATCH /v1/bookings/:id {status:'rejected'}` (`:301`) | partial: no approver, note or history | no |

---

## 3. Cancellations tab

Legacy: `bkV2RenderCancelReport` (`booking.js:6450`). Read-only report; every number is aggregated client-side.

| # | Piece | Legacy function | Reads | Backend route | Status | Vue uses? |
|---|---|---|---|---|---|---|
| 3.1 | Cancelled bookings (`cancelled`, `cancelled_weather`), all dates | `bkV2RenderCancelReport` (`6456`) | `SB_BOOKINGS` | `GET /v1/bookings` (`:292`) | partial: no `status=` filter | no |
| 3.2 | Denominator: bookings not `rejected`/`draft` | `6458` | count by status | — | partial: no count / status filter | no |
| 3.3 | Category, group (customer/operator/other), charge, `at` | `codeOf`, `feeOf` (`6462-6463`) | `cancelCategory`, `cancellation.{category,group,chargeAmount,at}`, `cancelledAt` | only `bookings.cancellation_reason` text (`migrations/001:16`) | partial: no structured cancellation | no |
| 3.4 | Partial-cancel events (category, count, refund) | `6457`, `6476-6480` | `partialCancels[]` | — | missing | no |
| 3.5 | Top cancelling agents | `agName` (`6514`) | agent names | `GET /v1/agents` (`:349`) | exists | yes (agents store) |
| 3.6 | Reason labels / groups | `BKV2_CANCEL_REASONS` (`08-app.js:8763`) | static list | — | n/a (constant) | — |
| 3.7 | Land/marine split (`_bkV2CityTourOnly`) | `_ctLandBk` (`6454`) | `laIsLandRoute` | — | see 6.20 | — |

A server-side report (`GET /v1/reports/cancellations?from&to`) would avoid loading every booking, but it is optional once 3.1-3.4 exist.

---

## 4. New booking / edit booking

Legacy: the form state is `_bkV2.newBooking`; `bkV2NewBooking` (`booking.js:10386`), `bkV2EditBooking` (`13991`),
`bkV2SaveDraft` (`12270`, status `quote`), `bkV2SubmitBooking` (`12288`, `confirmed` or `pending_foc`) →
`bkV2CommitBooking` (`12457-13175`). The commit rebuilds the whole booking (`newBk`, `12740-12868`) and writes it
to localStorage `sb_bookings` (`13148-13155`), which syncs through `/api/save`.

### 4a. Reads the form needs

| # | Piece | Legacy function | Reads | Backend route | Status | Vue uses? |
|---|---|---|---|---|---|---|
| 4.1 | Agent picker + snapshot (pay type, credit days, contract version, market, sales, rate type) | `sbGetAgent` (`08-app.js:1214`), `12720`, `12857-12862` | `SB_AGENTS` | `GET /v1/agents`, `/v1/agents/:id` (`:349-350`) | exists | yes |
| 4.2 | Contract route whitelist | `12589-12600` | `agent.programPeriods`, `programs` | `program_route_ids` / `programs[]` on the agent | exists | yes |
| 4.3 | Salespeople (`soldBy`, discount approver name) | `12712-12715` | `SB_SALES` | `GET /v1/sales` (`:348`) | exists | yes |
| 4.4 | Routes + open/closed day | `bkV2IsRouteOpenOn` (`4328`), `12575` | `ROUTES`, calendar | `GET /v1/routes?from&to` (`:219`) | exists | yes |
| 4.5 | Boats (charter picker, type for charter rate) | `bkV2TripSubtotal` (`13230`) | `BOATS` | `GET /v1/boats` (`:248`), `charter_ceiling` | exists | yes |
| 4.6 | Seats per trip, excluding the booking being edited; cap vs licence | `getAllotment` (`04-data-core.js:8681`), `12660-12700` | sellable, locked, licence free | `GET /v1/availability?route_id&date&exclude_booking_id` (`:261-269`) | exists (range form in use; single + exclude not in `ob.ts`) | partly |
| 4.7 | Drawable locks for the agent on a trip | `bkV2DrawSources` (`125`), `bkV2AutoDrawLocks` (`11603`) | `SB_SEAT_LOCKS` | `GET /v1/seat-locks?route_id&date` (`:358`) | exists | partly |
| 4.8 | Full rate type (seat prices, tiers, charter rates, bundles, longtail, add-on prices) | `bkV2GetRT` (`13177`), `bkV2TripSubtotal` (`13222`) | `SB_RATE_TYPES` | `GET /v1/rate-types/:id` | missing (rate-types.md) | no |
| 4.9 | Promo contracts and seasonal rate type per trip | `bkV2GetRTForTrip` (`13205`), `laMainRtFor` (`08-app.js:8481`), `laPromoFor` (`8583`), `laPromoRateFor` (`8754`) | `SB_CONTRACTS`, agent seasons | — | missing | no |
| 4.10 | Price quote (seat, add-on, FOC discount, discount, extra, total) | `bkV2CalcQuote` (`13356`), `bkV2NoRateTrips` (`6197`) | all of 4.8-4.9 | `POST /v1/quote` | missing (rate-types.md) | no |
| 4.11 | Add-on types + prices | `bkV2AddOnInfo` (`13317`), `RT_ADDON_DEFS` | `SB_ADDON_TYPES` | `GET /v1/addon-types` | missing | no |
| 4.12 | Pickup areas → name, zone | `bkV2GetArea` (`booking.js:7`) | `SB_PICKUP_AREAS` | — | missing (no area catalogue, `todo/booking-model.md:289`) | no |
| 4.13 | Default pickup time per route × area × date | `bkV2GetPickupTime` (`10`), `psuResolveProfile` (`vans.js:102`) | `SB_PICKUP_TIMES`, pickup profiles | — | missing | no |
| 4.14 | Hotel list (near-duplicate name warning) | `bkV2HotelNear` (`12125`) | hotel names per area/zone | — | missing | no |
| 4.15 | Staff list + welfare quota | `staffGet`/`staffQuota` (`08-app.js:186-187`), `12522-12531` | `SB_STAFF`, staff bookings per year | — | missing | no |
| 4.16 | Duplicate check (voucher; lead name + route/day) | `bkV2FindDuplicateBookings` (`12407`), `bkV2VoucherDupHtml` (`12429`) | all active bookings | `GET /v1/bookings` (`:292`) | partial: no `voucher_ref` / `q` search | no |
| 4.17 | Nationality guess | `natLearnRecord` (`10524`), `bkV2GuessNationality` (`10572`) | `nat_learn` (blob, `data-model/tables/nat_learn.js`) | — | missing | no |

### 4b. Writes

| # | Field(s) | Legacy source | Backend route / column | Status | Vue uses? |
|---|---|---|---|---|---|
| 4.18 | Create: header, trips (route, date, pax grid, mode), passengers | `newBk` (`12740-12868`), `13079-13087` | `POST /v1/bookings` (`:297`), `bookingInput` (`:118`) | exists | no |
| 4.19 | Edit: header, trips, passengers | `bkV2CommitBooking` edit branch (`12949-13009`) | `PATCH /v1/bookings/:id` (`:301`), `bookingChanges` (`:166`) | partial: `agent_id`, `voucher_ref`, `rate_type_ref` are set on create only; PATCH ignores them | no |
| 4.20 | Status `quote` / `pending_foc` / `confirmed` / `pending_approval` | `12270`, `12288`, `12924` | `status` (`booking-status.ts:8-11`) | exists | no |
| 4.21 | Trip `zone`, `pickupTime`, `ovn`, `ovnReturnDate`, `ovnLeg`, `ovnOf` | `12800-12818`, §ovnSync (`12882-12918`) | `tripDetails` (`:80-103`), `assertItinerary` | exists (on `6afb049` only, not `main`) | no |
| 4.22 | Trip `charterBoatId`; boat locked for the whole OVN span | `12806`, `13125-13145`, `bkOvnSpanDates` (`1719`) | `trips[].charter_boat_id`; a charter takes the whole boat (`capacity.ts:151-152`) | exists | no |
| 4.23 | Trip `charterPriceMode/Manual/Note`, `charterDisplacementAck`, `ovnCharge`, `subtotal`, `promoId`, `rtRef`, `nat` | `12807-12840` | — | missing | no |
| 4.24 | Lock draws (`lockDrawSel` → `lockDraws`), return on edit | `13091-13115`, `bkV2DrawLock` (`188`), `bkV2ReturnBookingDraws` (`221`) | `trips[].lock_draws` (`:43-48`); returns are automatic (derived) | exists | no |
| 4.25 | Seat tiers: over locked → block; over licence → block; over cap → save as `pending_approval` | `12660-12708` | `assertTrips` returns 409 for anything over `available_seats` (`postgres-operations.ts:259`, `capacity.ts:156`) | partial: no cap-vs-licence tier, so an over-cap booking cannot be saved for approval | no |
| 4.26 | Approval request (`over_capacity`, `discount`) | `_approvalReq` (`12703-12719`), `12922-12934` | — (planned `booking_approvals`) | missing | no |
| 4.27 | FOC approval record (`focApproval`, `focReason`) | `12853-12859`, `13066-13072` | — | missing | no |
| 4.28 | Header scalars: lead, pickup/dropoff, hotel, room, guides, meals counts, allergies text, luggage, cash on tour, price breakdown, `total`, `priceMode`, `manualTotal`, payment snapshot, market snapshot, `bookedAt`, `bookingDate`, `confirmedBy/At`, `soldBy`, `purpose`, `staffId`, `notes`, `note` | `12740-12868`, `12936-12947` | `BOOKING_HEADER_COLUMNS` (`booking-header.ts`, migration 011) | exists | no |
| 4.29 | `specialMeals.allergyList`, `pierAt`, `pierBy` | `12793-12795` | — | missing | no |
| 4.30 | Add-ons (`type`, `label`, `amount`, `qty`, `note`, `jAd`, `jChd`) | `12841-12848` | — (planned `booking_addons`) | missing | no |
| 4.31 | Adjustments | `12849-12852` | — (planned `booking_adjustments`) | missing | no |
| 4.32 | `altPickups` (who, qty, area, zone, place, drop side) | `12773-12787`, `bkV2SyncAltPickupSplits` (`2845`) | `booking_trip_van_allocations` with `source='alt_pickup'` (016), no write route | partial: schema only | no |
| 4.33 | Attachments, `docCheck` | `12756-12757`, `bkV2AttachUpload` (`12050`), `bkV2AttachRemove` (`12062`) | legacy `/api/attach` (`server.js:3104-3127`) | missing | no |
| 4.34 | `incomplete[]` (soft-missing flags) | `12920` | — | missing | no |
| 4.35 | `history[]` (every save, every automatic fix) | `bkV2AddHistory` (`3807`), `13008`, `13011` | — (booking-entities.md §4 draft) | missing | no |
| 4.36 | Carry-over on edit: `ops` (boat, van, pickup final, reconfirm) kept unless the day moved | `BK_EDIT_CARRY` (`12448`), `12951`, `12969-12990` | `planTrips` keeps trip ids; moved trips lose van data (`todo/vans.md`) | exists (server-side) | no |
| 4.37 | Carry-over on edit: `upgrades`, `feeItems`, `reschedule`, `partialCancels`, `cancellation`, `cancelCategory`, `weatherResolve`, `rebook` | `BK_EDIT_CARRY` (`12448-12451`) | — | missing (no columns; each is listed in §6) | no |
| 4.38 | `invoiceId`, `paymentStatus` | `BK_EDIT_CARRY` (`12449`) | — | missing (accounting) | no |
| 4.39 | B2C-owned fields and `b2cOverride` | `12955-12967`, `bkV2B2CDiff` (`13960`) | — | missing | no |
| 4.40 | Charter boat → `ops.boatId` sync | §chOpsSync (`13013-13048`) | `booking_trip_operations.boat_id` (013), not written by any route | missing | no |
| 4.41 | Stranded snapshot when the day moves | `ckStrandSnap` (`checkin.js:235`), `12976` | legacy blob `ops_stranded` | missing | no |
| 4.42 | Edit lock (who is editing) | `bkV2SetEditLock` / `bkV2ClearEditLock` (`13953-13954`) | `editLock` | — (optimistic `If-Match` on `updated_at` would also do) | missing | no |

---

## 5. Van assign writes

Source: [van-mode.md](van-mode.md) §4a. The schema exists at `6afb049` (migration 016: `vans`, `van_days`,
`van_status_ranges`, `van_day_routes`, `van_groups`, `booking_trip_van_allocations`; 013 reshaped as
`booking_trip_operations`), but `todo/vans.md` says steps 3-6 (board read, writes, error codes, live updates)
are not started. No route exists.

| # | Piece | Legacy function | Backend route (hand-off) | Status | Vue uses? |
|---|---|---|---|---|---|
| 5.1 | Board read | `bkV2RenderTab2` van mode (`9478`) | `GET /operations/van-board?date` | missing | called, answers 404 |
| 5.2 | Van catalogue | `SB_VEHICLES` | `GET /operations/vans` (board carries vans) | missing | — |
| 5.3 | New group | `bkV2VanGroupSelected(…,'new')` (`2311`) | `POST /operations/van-groups` | missing | no |
| 5.4 | Add to / remove from group | `bkV2VanGroupSelected(…,g)` | `POST …/van-groups/:id/members`, `DELETE …/members/:trip/:idx` | missing | no |
| 5.5 | Group van / return van / time | `bkV2VanGroupSetVan` (`2384`), `SetReturn` (`2424`), `SetTime` (`2410`) | `PATCH /operations/van-groups/:id` | missing | no |
| 5.6 | Order / clear order | `bkV2VanGroupSave` (`2413`), `ClearSeq` (`2411`) | `PUT …/van-groups/:id/order` | missing | no |
| 5.7 | Disband | `bkV2VanGroupDisband` (`2409`) | `DELETE /operations/van-groups/:id` | missing | no |
| 5.8 | Clear route | `bkV2VanClearRoute` (`2279`) | `POST /operations/van-board/clear` | missing | no |
| 5.9 | Row return van | `bkV2AssignVanReturn` (`2246`), `…Split` (`3246`) | `PATCH /operations/van-allocations/:trip/:idx` | missing | no |
| 5.10 | Pickup final time, return-same-van | `bkV2SetPickupFinal` (`3008`), `bkV2SetReturnSameVan` (`2248`) | `PATCH /operations/trip-ops/:trip` | missing | no |
| 5.11 | Driver / phone / plate per day | `vanJobsSetDriver` (`vans.js:1402`) | `PUT /operations/van-days/:date/:van_id` | missing | no |
| 5.12 | Split / unsplit (phase 3) | `bkV2SplitApply` (`2450`), `bkV2VanUnsplit` (`2525`) | `POST /operations/trip-ops/:trip/split` / `unsplit` | missing | no |
| 5.13 | Live updates (gap G5) | — | `GET /operations/van-board/stream?date` (SSE) | missing | no |
| 5.14 | Van job order print | `bkV2VanJobOrder` (`3230`) | reads 5.1 | missing (depends on 5.1) | no |
| 5.15 | Auto-assign | `bkV2VanAutoAssign` (`2261`) | — | n/a: not ported (CLAUDE.md "never auto-pick a van") | — |

Contract gaps G1-G4 (group `return_pool`, write responses carrying `{trip, warnings}`, `/api/me` groups, error
`code`s) are in van-mode.md §4a.7 and still apply.

---

## 6. Other booking-page actions in `booking.js`

| # | Action | Legacy function | Writes | Backend route | Status | Vue uses? |
|---|---|---|---|---|---|---|
| 6.1 | Cancel | `bkV2DetailCancel` (`13539`) → `bkV2CancelConfirm` (`13588`) → `bkV2CancelBooking` (`12297`) | `status`, `cancellation{category,group,note,chargeType,chargeAmount,at,by}`, `cancelCategory`, void invoice + fee invoice, history | `POST /v1/bookings/:id/cancel {reason}` (`:305`) | partial: free-text reason only; no category, charge, by, fee invoice or history | disabled button |
| 6.2 | Restore (un-cancel) | `bkV2RestoreBooking` (`12358`) | `status='confirmed'`, clears cancellation, redraws locks, re-locks charter, voids fee invoice | `PATCH /v1/bookings/:id {status:'confirmed'}` (`:301`) | partial: seats are re-checked, but `cancellation_reason` stays, lock draws are not restored, no history | disabled button |
| 6.3 | Reschedule | `bkV2RescheduleModal` (`13609`) → `bkV2RescheduleConfirm` (`13649`) → `bkV2RescheduleBooking` (`13668`) | trips on `from` date → `to`, `reschedule{…}`, `rebook`, `feeItems[]`, invoice line, ops cleared, history | `POST /v1/bookings/:id/reschedule {route_id, service_date}` (`:314`) | partial: one-trip bookings only (`nextTrips`, `operations.ts:516`); no fee, collect mode, reason or history | disabled button |
| 6.4 | Reduce pax (partial cancel) | `bkV2DetailPartial` (`13785`) → `bkV2PartialConfirm` (`13849`) → `bkV2PartialCancel` (`13875`) | per-trip, per-pax-key decrement, `partialCancels[]`, refund, total, invoice flag, lock return | `POST /v1/bookings/:id/partial-cancel {pax_to_cancel}` (`:309`) | partial: one-trip only, one total count (no category/residency), no category/refund record, `total` unchanged | disabled button |
| 6.5 | FOC approve / reject | `bkV2FocApprove` (`13495`), `bkV2FocReject` (`13522`) | `focApproval`, `status`, history | `PATCH {status}` (`:301`) | partial: no FOC record or history | no |
| 6.6 | Boat assign (row, bulk, auto) | `bkV2AssignBoat` (`2032`), `bkV2BoatAssignSelected` (`2088`), `baAutoAssign` (`3286`) | `bkOpsFor(b,d).boatId`, cap check with `BA_CAP_TOL` | `booking_trip_operations.boat_id` (013), no route | missing | no |
| 6.7 | Boat split | `bkV2BoatSplitApply` (`2703`), `bkV2BoatUnsplit` (`2725`) | `ops.boatSplits` | — | missing | no |
| 6.8 | Upgrade flag | `bkV2BoatUpgrade` (`3301`) | `ops.upgrade{reason,charge,by,at}` | `booking_trip_operations.upgrade` (013), no route | missing | no |
| 6.9 | Upgrade ledger | `bkV2UpgradeSave` (`3710`), `bkV2UpgradeDelete` (`3740`) | `bk.upgrades[]` | — | missing | no |
| 6.10 | Extras (on-tour sales) | `bkV2ExtraSave` (`3583`), `bkV2ExtraCollect` (`3633`), `bkV2ExtraDelete` (`3650`) | `SB_EXTRAS`, slips | — | missing | no |
| 6.11 | Invoice / payment from the detail page | `bkV2PayDoCreate` (`3429`), `bkV2PayDoRecord` (`3435`) | `acctCreateInvoice`, `acctRecordPayment` | — | missing (accounting) | no |
| 6.12 | Re-confirm (row, all, status picker) | `bkV2Reconfirm` (`2231`), `bkV2ReconfirmAll` (`2233`), `rcSetStatus` (`1328`), `rcToggleBooking` (`1473`) | `ops.reconfirm{status,via,by,at}` | `booking_trip_operations.reconfirm_*` (013), no route | missing | no |
| 6.13 | Re-confirm "sent to agent" | `rcSendAgent` (`1457`), `rcUnsendAgent` (`1466`) | `ops.reconfirm.rcSent*` | — | missing | no |
| 6.14 | Re-confirm sheet (print) | `rcSheet` (`1514`) | read only: bookings of a date + agents | `GET /v1/bookings?service_date`, `/v1/agents` | exists | partly |
| 6.15 | Weather closure: tag, confirm, un-cancel | `bkV2WeatherTagBookings` (`3824`), `bkV2WeatherMarkConfirm` (`3766`), `bkV2WeatherUncancel` (`3778`) | `SB_WEATHER_CLOSURES`, `weatherResolve`, `status='cancelled_weather'` | route day overrides are read-only (`listDayOverrides`, `:219`) | missing (write) | no |
| 6.16 | Weather resolve / notify per booking | `bkV2WeatherResolveOne` (`3885`), `bkV2WeatherNotify` (`3877`) | `weatherResolve` | — | missing | no |
| 6.17 | Daily boat cap override | `_bcapSave` (`3134`) → `boatCapSet` (`3075`), `_bcapClear` (`3144`) | `BOAT_CAP_OVR` (cap clamped to licence) | `boat_capacity_overrides` is read by `/v1/availability`; no write route | partial: read only | no |
| 6.18 | Agent colour | `bkV2AgentColorSet` (`7540`) | `agent.color` | `PATCH /v1/agents/:id` (agents.md draft) | missing | no |
| 6.19 | Pier / van check-in fields shown on the booking | `ops.pierCheckin`, `ops.vanCheckin` (cleared in `13730-13740`) | check-in results | `booking_trip_operations.pier_checkin` (013), not in the booking read | missing | no |
| 6.20 | Land vs marine route (city-tour pages) | `laIsLandRoute`, `_bkV2CityTourOnly` (`6322`, `6454`) | route kind | nothing on `/v1/routes` marks it | missing | no |
| 6.21 | Trip operations in the booking read (boat, pickup final, reconfirm, check-in per trip) | `bkOpsRead` / `bkOpsFor` (`1918`, `1925`) | — | `GET /v1/bookings/:id` lacks `operations` (booking-entities.md §4) | missing | no |
| 6.22 | Form-only helpers: group paste, OVN return leg, allergy chips | `bkV2GroupPasteApply` (`10742`), `bkV2CreateOvnReturnLeg` (`10801`), `bkV2AllergyAdd` (`11697`) | form state | — | n/a | — |

---

## 7. Counts

Counted rows exclude the "n/a" rows (1.16, 3.6, 5.15, 6.22) and 3.7, which points at 6.20.

| Section | exists | partial | missing |
|---|---|---|---|
| 1. Seat Locks | 8 | 2 | 5 |
| 2. รออนุมัติ | 2 | 4 | 2 |
| 3. Cancellations | 1 | 3 | 1 |
| 4a. Form reads | 7 | 1 | 9 |
| 4b. Form writes | 7 | 3 | 15 |
| 5. Van assign | 0 | 0 | 14 |
| 6. Other actions | 1 | 6 | 14 |
| **Total** | **26** | **19** | **60** |

Of the 26 "exists":
- 10 are reads the Vue app already calls in full (§0): 1.2, 1.3, 1.4, 2.5, 3.5, 4.1-4.5.
- 4 are called in part: 1.15 (`ObTrip` lacks `lock_draws`), 4.6 (no single-day `exclude_booking_id` form),
  4.7 (no `route_id` filter), 6.14 (`service_date` form).
- 12 are backend routes or fields Vue has not wired yet: 1.1, 1.5, 1.7, 1.8, 2.6, 4.18, 4.20, 4.21, 4.22, 4.24,
  4.28, 4.36.

---

## Backend work to request

Ordered by the tab or action each one unblocks first.

1. **รออนุมัติ + Cancellations tabs** (read-only first):
   - `GET /v1/bookings?status=a,b&q=&voucher_ref=` plus a `total` count. One change; it unblocks 2.1, 2.2, 3.1,
     3.2 and the duplicate check 4.16.
   - Approval record (`booking_approvals`: reason, over[], over_total, discount, sale, requested/decided by/at,
     note, target status) embedded in the booking read (2.3, 2.4).
   - Structured cancellation (`category`, `group`, `charge_type`, `charge_amount`, `by`, `at`) on cancel and in
     the read; `partial_cancels[]` (3.3, 3.4).
2. **Approve / reject**: `POST /v1/bookings/:id/approve` and `/reject` with `{by, note}`. Approve must allow
   seats over the company cap up to the licence (manager override), which `PATCH` refuses today (2.7, 2.8).
   Write a history entry.
3. **Seat Locks tab** (phase 1 is unblocked already; [seat-locks.md](seat-locks.md) drafts A-F for the rest):
   range locks, sub-groups, release cutoff, note/log, office/global holder, enforce the lock's agent on draws.
4. **New / edit booking** (biggest block):
   - Capacity tiers on create/amend: over cap but within licence → save as `pending_approval` with an
     approval record, instead of 409 (4.25, 4.26).
   - `PATCH` accepts `agent_id`, `voucher_ref`, `rate_type_ref` (4.19).
   - Pricing: `GET /v1/rate-types/:id`, promo/season resolution, `GET /v1/addon-types`, `POST /v1/quote`
     (4.8-4.11; drafts in rate-types.md).
   - Reference catalogues: pickup areas + zones, pickup times, hotels, staff + welfare quota (4.12-4.15).
   - Booking sub-resources: add-ons, adjustments, allergy list, FOC approval, attachments, incomplete flags,
     B2C override, and the remaining trip fields (charter price mode, OVN charge, subtotal, promo/rate ref,
     real nationality) (4.23, 4.27, 4.29-4.34, 4.39).
   - `booking_history` with `GET /v1/bookings/:id/history`, appended by every write (4.35).
   - Optimistic concurrency (`If-Match` / `updated_at`) in place of the legacy edit lock (4.42).
5. **Detail-page actions** (the four disabled buttons in `BookingDetailView.vue:150-156`):
   - Cancel with category/charge/by; restore that clears the cancellation and redraws locks.
   - Multi-trip reschedule (`{from_date, to_date}` or per trip id) with fee/collect/reason record.
   - Partial cancel per trip and per pax category, with category/refund record and a new total.
6. **Van assign** (By trip · date, van mode): the van hand-off steps 3-6 (`todo/vans.md`): board read, group /
   allocation / trip-ops / van-day writes, error codes, SSE (§5).
7. **Day-of-operations on the booking page**: trip `operations` in the booking read (6.21), then writes for boat
   assign and split, upgrade flag, re-confirm and re-confirm sent (6.6-6.8, 6.12-6.13), daily boat cap
   override write (6.17), weather closure + resolve (6.15-6.16).
8. **Accounting-owned** (later, with the accounting port): `invoiceId`/`paymentStatus`, fee items, invoices and
   payments from the detail page, extras, upgrade ledger (4.38, 6.9-6.11).
9. **Small**: route kind (land/marine) on `/v1/routes` (6.20); `sort=-booking_date` on `/v1/bookings`, which
   `ob.agentBookings` already sends (§0).
