# What the Vue pages need from operation-backend

Decision (2026-09-24): the Vue app uses operation-backend's data model (`/v1/*`, snake_case,
`Booking` with `trips[]`) instead of the legacy blob. Per page, this maps the data shown to its
backend source and lists what is missing. Each missing item is one request to the backend (issue
title in **bold**).

## Travel Summary (phase 1)

Checked against operation-backend `49cdefa` (main, 2026-09-24).

### Already available

| Page shows | Backend source |
|---|---|
| bookings with a trip on the day, per route | `GET /v1/bookings?service_date=&route_id=` (paged, `next_cursor`) |
| route name, colour, departure time | `GET /v1/routes` (`color`, `route_times.departs_at`) |
| boat names | `GET /v1/boats` |
| voucher, lead name and phone, hotel, room | `voucher_ref`, `lead_pax`, `lead_phone`, `hotel_name`, `room_number` |
| pickup / drop-off text | `pickup_area`, `pickup_self`, `dropoff_same`, `dropoff_area`, `dropoff_hotel_name` |
| booked pax by type | `trips[].pax` (category × residency grid) |
| booking total, price mode | `total`, `price_mode`, `price_*` |
| COT amount, handling, note | `cash_on_tour_amount`, `cash_on_tour_handling`, `cash_on_tour_note` |
| status, cancelled | `status` (`cancelled`, `cancelled_weather`, `rejected`) |

### Missing, needed for phase 1 (read-only manifest)

1. **Include trip dispatch in the booking response.** `booking_trip_operations` exists (migration 013) but
   `Booking.trips[]` does not include it. Needed: `boat_id`, `van_id`, `van_return_id`,
   `pier_checkin`, `van_checkin`, `return_same_van`. Proposed: `trips[].operations` (null when no row).
2. **Agent catalogue.** Only `agent_id` exists. Needed per agent: `name`, `code`, `color`,
   `pay_type` (`invoice` | `credit` | `proforma` | `prepaid` | `cot` | `bt`), `booking_channel`.
   Proposed: `GET /v1/agents`.
3. **Vehicle catalogue.** Vans are referenced by `van_id` with no way to name them.
   Proposed: `GET /v1/vehicles` (`id`, `name`, `type`, `seats`).
4. **Check-in results per trip.** Legacy check-in events: per pax type, how many boarded, no-show,
   cancelled on site, with a reason code and who/when. Travel Summary's travelled / no-show /
   CXL-on-site KPIs and the "issue" rows come from this. Proposed: `trips[].checkin` summary
   (`boarded`, `no_show`, `cancelled_on_site` by pax category) plus the event list behind it.
5. **Cancellation detail.** Only `cancellation_reason` (text). Needed: `charge_type`
   (`full` | `partial` | `none`), `charge_amount`, `cancelled_at`, `cancelled_by`.
6. **Bookings moved off a day.** A booking rescheduled from D to D' no longer has a trip on D, but
   D's Travel Summary still lists it as "moved" with the new date and reason (legacy
   `ops_stranded` + `reschedule[]`). Proposed: `GET /v1/bookings?moved_from=D` or a trip history
   the list can filter on.
7. **Overnight legs.** `ovn` (`return` | `self`) and `ovn_of` are in `todo/booking-model.md`
   corrections but not in the API. The manifest marks overnight returns and outbound dates.

### Missing, needed for the money column (phase 1) and phases 2–3

8. **Pier payments and site sales.** On-site collections per booking and day: `amount`, `method`
   (`cash` | `transfer` | `card`), `fee`, slip attachments, `by`, `at`; plus extras sold at the pier.
9. **Invoices and payments per booking.** Which invoice covers the booking, paid / balance /
   settled, proforma paid date.
10. **Amount to collect, computed by the backend.** Legacy `tsMoneyOf` / `pckMoney` derive
    "due at pier" from COT, balance, upgrades, invoice payments and pier payments. The frontend
    should not re-derive money rules. Proposed: `trips[].collect` = `{ target, paid, due }`.
    The golden-tested TypeScript port in `legacy/money.ts` is the reference spec.
11. **Net price, computed by the backend.** Legacy `netOf` resolves rate type → season → promo →
    contract. Same argument as 10; `legacy/pricing.ts` is the reference spec.
12. **VAT flag per booking** (`legacy/rows.ts` `vatMode` / `hasVat`).
13. **Add-ons per trip** (`booking_addons` is designed in `todo/booking-model.md`, not built).
14. **Document check status and attachments** (`booking_attachments`, designed, not built).
15. **Upgrades** (`upgrades[]`: due / received).

### Phase 2–3 writes (not needed until then)

16. **Penalty decisions for no-shows / on-site cancellations** (legacy `travel_sum`: per booking
    and day, `decision` = `full` | `partial` | `none` | `postpone`, `amount`, `note`, `by`).
17. **COT settlement decisions** (legacy `ts_cot`: `deduct`, `payout`, `ref`, `by`).

---

## Calendar (`?view=calendar`, legacy `renderCal` / `_calTripsFor`)

Already available: routes (`pier`, `color`, `times`), open/closed per day (`/v1/routes?from=&to=`),
boat deployments (`/operations/deployments?from=&to=`), boat capacity, licence and daily overrides.

1. **Availability over a date range.** Requested 2026-09-24. `/v1/availability` answers one route
   and one day; a month is ~30 days × 7 routes = ~210 calls. Wanted:
   `GET /v1/availability?from=&to=[&route_id=]` →
   `{ days: [{ route_id, service_date, open, deployed_capacity, licensed_capacity, booked_pax,
   charter_pax, locked_pax, available_seats, deployments: [{ boat_id, capacity, license_pax }] }] }`.
2. **A chartered boat leaves the seat pool.** Legacy: the chartered boat's whole capacity is removed
   (0 free on that boat). Backend: `available_seats = deployed_capacity − booked_pax − locked_pax`,
   the charter is not subtracted, so a day with one boat chartered over-reports free seats by
   that boat's capacity.
3. **Locks count only what is still held.** Legacy subtracts a lock's pax minus what bookings have
   already drawn from it (`bkV2LockPoolHold`). Backend subtracts the whole lock *and* the drawn
   bookings, counting those seats twice. `booking_trip_lock_draws` is designed, not built.
4. **Boat status by date.** Down / under repair on a date, the pier a boat sits at on a date,
   retired. The calendar marks a trip whose boat is down instead of hiding it.
5. **Weather closures.** Route + date closed for weather, and the cancelled / rescheduled /
   pending pax of the bookings it hit.
6. **Route kind** (`sea` | `land`).

## Before any page can switch: data

The backend's production database held one booking on 2026-08-26
(`todo/live-correctness-charter-seats.md`). Legacy Boat Ops and bookings still write only to the
legacy database. Needed: an import plus a sync (or dual-write) for the transition, or every page
above shows empty days.

## Bookings (`/app/bookings`, legacy "All bookings" tab `bkV2RenderTab3`)

Built on `GET /v1/bookings?from=&to=` (a travel month, all pages) and `GET /v1/bookings/:id`.

1. **Agent catalogue** (same as Travel Summary 2). The list and detail show `agent_id` (`a01`) where
   legacy shows the agent's name and rate-type code.
2. **Search, status filter and counts on the list.** Legacy searches every month at once and shows a
   count per status; the API has neither, so the page loads one month and narrows it client-side,
   and search covers that month only. Wanted: `q` (BK number, voucher, lead name, phone),
   `status` (repeatable), and per-status counts.
3. **`booking_date` is shifted a day by the import.** A booking made on 2026-09-24 has
   `booking_date = 2026-09-23T17:00:00Z`: the legacy `YYYY-MM-DD` was read as local midnight
   (+07:00) and stored as a UTC timestamp. It should be a date (or the local date kept as-is).
4. **FOC approval state** (`focApproval.status`) is not in the model; the Pending FOC tile relies
   on `status = pending_foc` alone.
