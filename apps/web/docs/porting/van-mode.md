# Porting spec: Van mode (By-trip · date tab)

- **Revised 2026-09-25:** phase 1 is built against the hand-off contract, before the backend has shipped it:
  - **Code:** `ob.vanBoard`, `stores/vanBoard.ts`, `features/bookings/vanMode.ts`, `vanColor.ts`, `VanCell.vue`, `VanGroupHead.vue`, `VansCard.vue`, plus the van-mode wiring in `ByTripView.vue` (`?mode=van`).
  - **While the backend answers 404:**
    - The Van button reads "not in backend yet".
    - The VANS card links to the legacy page.
    - The table keeps the plain manifest.
  - **Differences from the plan below:**
    - `ob.vans()` was not needed, because the board carries its vans.
    - The legacy "รถปนกัน" chip is replaced by `warnings.van_on_two_routes`, since a group now holds a single van.
    - The time cell shows the final pickup time over the booked one in van mode only.

- **Legacy entry point:** `bkV2ToggleVanMode` (`allotment_v2/js/booking.js:2228`) sets `_bkV2.vanAssignMode`. The mode is rendered by `bkV2RenderTab2` (`booking.js:9480`) → `bkV2T2RouteHtml(rid, C)` with `C.vanMode` (`booking.js:8551`). Output goes into `#view-booking > #bkv2-host` (tab `bytrip`).
- **Helpers in scope:**
  - **Cell and headers:**
    - `bkV2VanCellHTML` (`booking.js:3247`)
    - `_grpHeaderRow` (`booking.js:8800`; van-mode branch `8849-8893`)
    - `_unassignedHdr` (`booking.js:9075`)
    - VANS pieces (`booking.js:9345-9410`) and VANS card (`booking.js:10050-10068`)
    - day warn chips (`booking.js:9705-9744`)
  - **Selection:** `bkV2VanSelToggle` / `bkV2VanSelClear` (`booking.js:2288-2289`)
  - **Groups:**
    - `_bkV2InZone` (`2293`), `_bkV2VanNextGroup` (`2299`)
    - `bkV2VanGroupSelected` (`2311`), `bkV2VanGroupHeal` (`2338`), `bkV2VanGroupConflicts` (`2355`)
    - `_bkV2GrpApply` (`2372`), `bkV2VanGroupPax` (`2374`)
    - `bkV2VanGroupSetVan` (`2384`), `bkV2VanGroupDisband` (`2409`), `bkV2VanGroupSetTime` (`2410`), `bkV2VanGroupClearSeq` (`2411`), `bkV2VanGroupSave` (`2413`), `bkV2VanGroupSetReturn` (`2424`)
    - `_bkV2VanOtherGroups` (`3022`)
  - **Return, time and clear:**
    - `bkV2AssignVanReturn` (`2246`), `bkV2SetReturnSameVan` (`2248`), `bkV2RetInfo` (`2251`)
    - `bkV2VanClearRoute` (`2279`), `bkV2SetPickupFinal` (`3008`), `bkV2ScrollToVan` (`3010`), `bkV2AssignVanReturnSplit` (`3246`)
  - **Splits:**
    - `bkV2VanSplit` (`2426`), `bkV2SplitClose/Set/All/Apply` (`2443-2450`), `bkV2SplitRender` (`2471`), `bkV2VanUnsplit` (`2525`)
    - automatic alt-pickup splits: `bkV2SyncAltPickupSplits` (`2845`), `bkV2HealSplitPax` (`2907`), `bkV2HealAltSplits` (`2984`)
  - **Zones:** `bkV2EffZone` (`booking.js:2958`)
  - **Per-date ops:** `bkOpsRead` / `bkOpsFor` / `bkOpsDate` / `bkOpsClear` (`booking.js:1910-1947`)
  - **Vans** (`allotment_v2/js/vans.js`):
    - `vehGet` (`:75`), `vehColor` / `vehChipPair` (`:14, :28`)
    - `_vehUsableOn` (`:1243`), `vanVehiclesForZone` (`:1244`), `vanVehiclesForRoute` (`:1248`)
    - `vjRound*` (`:1271-1333`)
    - `vanJobsDriverInfo` / `vanJobsSetDriver` (`:1401-1402`)
- **Already ported:**
  - `ByTripView.vue` renders the Van / Boat / Re-confirm mode buttons **disabled**, marked "not in backend yet" (`apps/web/src/features/bookings/ByTripView.vue:276-280`).
  - Its Notice card says vans are not in operation-backend (`ByTripView.vue:307`).
  - Base CSS for `.bt-mrow`, `.bt-mc` (without the `.on/.warn/.ok/.x` states), `.bt-c`, `.bt-ct`, `.bt-cnt`, `.bt-none2` and `table.t2-mtbl` is already in `ByTripView.vue`'s scoped style.
  - Generated types `SbVehicle` and `VanjobDriver` exist (`apps/web/src/models/generated.ts:1374, 1435`).
  - Nothing else.
- **Backend checked at:** `operation-backend@347a19b`, plus untracked `migrations/013_booking_trip_operations.sql`
- **Backend hand-off:** `apps/web/docs/handoff/van-endpoints.md`
- **Date:** 2026-09-25

---

## 1. Functionality

### Purpose
On the By-trip tab for one date, ops staff group the passengers who ride one van together. For each group they pick the outbound van, a return van, a pickup time and the pickup order. They also enter the day's driver details. The mode flags bookings with no van, no return van, or mixed vans inside one group.

**Legacy has no "lock-in" for vans.** "✓ Save" on a group only renumbers the pickup order (`bkV2VanGroupSave`, `booking.js:2413`). "Sent to driver" is a display-only timestamp on another page (`VANJOB_SENT`, `vans.js:1260`). A lock would be a new feature; it is drafted in the hand-off §6.

### Inputs
| Source | What is read | Where |
|---|---|---|
| `SB_BOOKINGS` | `status`, `trips[].{date, routeId, zone, pax, bookingMode, charterBoatId, pickupTime, ovnLeg, ops}`, `ops.{vanGroup, vanId, vanSeq, vanReturnId, returnSameVan, pickupTimeFinal, vanSplits[], boatSplits}`, `pickupSelf`, `pickupTime`, `dropoffSame`, `dropoff*`, `altPickups`, add-ons (`transfer-<route>-<zone>-<veh>`) | rows `booking.js:9497-9531`; ops `1910-1947`; zone `2948-2963` |
| `SB_VEHICLES` | `id, name, plate, capacity, color, active, ownership, zoneBase, driver, driverPhone, dayRoute{date}, dayStatus{date}, statusRanges[]` | `08-app.js:164`; pool `vans.js:1243-1248` |
| `VANJOB_DRIVER` | `['date::vanId'] → {driver, phone, plate}` | `08-app.js:2779`; `vans.js:1401` |
| `ROUTES` | `id, name, color, pier` (pier → zone: `panwa` → PK, `tublamu` → KL) | `vans.js:2909` |
| URL / tab state | the By-trip date, route and pier filters (already in `ByTripView.vue:23-31` query) | — |
| `sessionStorage.la_view` | `st.bk.van`, which restores van mode on reload | `01-auth-sync.js:448, 467` |
| Session | `laCanEditArea('operations') \|\| laCanEditArea('accounting')` gates persistence only. **No van function calls `laGuardEdit`**: a view-only user changes memory and nothing saves. | `accounting.js:13-14` |
| Embed | `/embed/*` replaces the toggle with a notice | `10-embed.js:163, 176-178` |

### Outputs

#### Rendered sections (van mode on)
1. **Mode row:** the Van button is `on` (bg `--mc`, with an "×"). Boat and Re-confirm switch van mode off (`booking.js:2227-2237, 9964-9970`).
2. **VANS card** replaces the Seat Lock and Notice cards (`booking.js:10034, 10050-10068`):
   - title "VANS n vans · k trips"
   - per trip: a label, then van chips (dot, name, "4+9/12 pax" per round, 📍 areas; red border when over capacity; click → scroll to the group)
   - extras: "⚠ ยังไม่จัดรถ N pax" (no van yet) and "self-arrive N pax"
   - "ล้าง" (clear route) when a single trip is shown
   - **grouping bar:** with ticks it shows "X pax · N ราย" plus "👥 จับเป็นกรุ๊ปใหม่" (new group), "+ กรุ๊ป g" per existing group of the first-ticked zone, and "ล้าง". Without ticks it shows a hint.
   - The card gets class `.act` (blue) while anything is ticked.
3. **Day warn chips** in the date header (`booking.js:9740-9742`):
   - "Van ·" (no outbound van), orange
   - "รถกลับ ·" (return van missing), dark yellow
   - "รถปนกัน ·" (mixed vans in a group), purple
   - Clicking any chip enters van mode.
4. **Per trip, the manifest table** gets class `t2-van` (`booking.js:9141`):
   - Hidden columns: Add-on, Pay, Total, VC.
   - Added column: "✓ กลุ่ม" (group), after Time.
   - The Time cell becomes a text input (`booking.js:9039`).
   - Zone bands keep their order: `__CHARTER__` first, then `bkV2ZoneOrder` (`booking.js:8734-8745`).
   - Within a zone:
     - the **unassigned header** "⚠ ยังไม่ assign · N booking · X pax" (`9075`), then the ungrouped rows
     - per group, a **group header** then its rows, sorted by `vanSeq`, then the column sort, then pickup time (`8785-8790`)
   - Cancelled bookings go to a compact list with no van cell (`9233-9250`).
5. **Group header (editable)** (`booking.js:8849-8893`):
   - "🚐 กรุ๊ป g"
   - round chip "↻ รอบ n/tot", with a warning for a missing or clashing round time
   - mixed-van chip
   - "N booking · pax/cap"
   - van select: disabled options for a van that is too small; "↻ รอบถัดไป" (next round) for a van already used by another group
   - group time input, return-van select
   - driver / phone / (partner) plate inputs
   - "✓ Save", "↻ เรียงตามเวลา" (sort by time), "ยกเลิกกรุ๊ป" (disband)
   - A group with no van gets a red frame (header plus `t2-novan` rows).
6. **Row "✓ กลุ่ม" cell** (`bkV2VanCellHTML`, `booking.js:3247-3285`):
   - NoTransfer shows "self-arrive" only.
   - Otherwise:
     - tick box, and a group chip "g · van" (or "—")
     - a return select, only when the row is grouped
     - "✂" (split), or on the first split "✂+" and "รวม" (merge)
7. **Send-back cell:** from `bkV2RetInfo` (`booking.js:8946-8956`): self-return / arranged / "↩ กลับคันเดิม ✓" / "⚠ ยังไม่จัดรถกลับ" + "↩ กลับคันเดิม" button.
8. **Split modal** `#bk-split-modal` (`booking.js:2471-2520`): steppers for ad/chd/inf/foc, "all", apply, close.

#### Handlers
| Trigger | Calls | Effect | Writes? |
|---|---|---|---|
| Van button, warn chips, send-back buttons while off | `bkV2ToggleVanMode` (`2228`) | toggles mode; turns off boat/rc | UI only |
| ✓ tick box | `bkV2VanSelToggle(key)` (`2288`) | selection with tick order; key `bkId` or `bkId@i` | UI only |
| "จับเป็นกรุ๊ปใหม่" / "+ กรุ๊ป g" | `bkV2VanGroupSelected(date,rid,zone,'new'\|g)` (`2311`) | groups the ticked rows that are in the zone. Capacity alert only if the group has a van. | `vanGroup`, `vanSeq`, `vanId`, `vanReturnId` (if empty) |
| ล้าง (group bar) | `bkV2VanSelClear` (`2289`) | clears ticks | UI only |
| Group van select | `bkV2VanGroupSetVan` (`2384`) | capacity alert; confirm when the van is in another group (second round) | `vanId` on all members |
| Group time input | `bkV2VanGroupSetTime` (`2410`) | no re-render | `pickupTimeFinal` on all members |
| Group return select | `bkV2VanGroupSetReturn` (`2424`) | — | `vanReturnId` on all members |
| Driver / phone / plate inputs | `vanJobsSetDriver` (`vans.js:1402`) | no re-render | `VANJOB_DRIVER[date::van]` |
| ✓ Save | `bkV2VanGroupSave` (`2413`) | renumber by ticks, clear ticks | `vanSeq` |
| ↻ เรียงตามเวลา | `bkV2VanGroupClearSeq` (`2411`) | — | deletes `vanSeq` |
| ยกเลิกกรุ๊ป | `bkV2VanGroupDisband` (`2409`) | no confirm | clears group/van/return/seq |
| Row return select | `bkV2AssignVanReturn` / `…Split` (`2246`, `3246`) | — | `vanReturnId` (+ `returnSameVan=false` on the flat setter) |
| Time input (row) | `bkV2SetPickupFinal` (`3008`) | oninput, no re-render | `pickupTimeFinal` |
| "↩ กลับคันเดิม" / "✓" | `bkV2SetReturnSameVan(id, bool, date)` (`2248`) | — | `returnSameVan`; true nulls the flat `vanReturnId` |
| ✂ / ✂+ | `bkV2VanSplit` (`2426`) | opens modal; a pool < 2 shows a toast | modal draft `_bkSplitM` |
| Split modal apply | `bkV2SplitApply` (`2450`) | needs 1 ≤ n < total; warns about a child without an adult | `vanSplits[]` |
| รวม | `bkV2VanUnsplit` (`2525`) | — | collapses `vanSplits` |
| Van chip | `bkV2ScrollToVan` (`3010`) | scroll + flash `#vg-rid-vid` | no |
| ล้าง (VANS title) | `bkV2VanClearRoute` (`2279`) | confirm | `vanId = null` on route |

Every write ends in `acctPersistBookings()` (`accounting.js:14`) → `laBlobSave()` → `save()` → `/api/v1/_batch` (fallback `/api/save`) (`01-auth-sync.js:221-301`). Most then call `bkV2RenderKeep` (`booking.js:2084`), which keeps the scroll position.

### State
| State | Kind | Held in | Survives navigation? |
|---|---|---|---|
| van mode on/off | UI | `_bkV2.vanAssignMode` (`08-app.js:7542`), `sessionStorage` | yes → URL query `mode=van` |
| ticked rows + tick order | UI | `window._bkV2VanSel`, `_bkV2VanSelN` (`booking.js:2288`) | no → store (cleared when the date changes; legacy does not clear it, which is a bug) |
| split modal draft | UI | `_bkSplitM` (`08-app.js:2733`) | no → component |
| scroll position across writes | UI | `bkV2KeepScroll` (`booking.js:2071`) | n/a: Vue patches in place |
| groups, vans, allocations, pools, rounds, warnings | domain | derived from `SB_BOOKINGS` + `SB_VEHICLES` on every render | backend (`GET /operations/van-board`) |
| driver overrides | domain | `VANJOB_DRIVER` | backend |

### Legacy server side
- **No van endpoints.** The only van rule the server applies is the shrink guard on `putall` (`server.js:150-162`).
- `/api/v1/_batch` (`server.js:3213-3238`) checks the op shape and `edit!==false`. It does not check capacity, conflicts, pools or `edit_areas`.
- `/api/ck?date=` (`server.js:3057-3082`) returns the assembled bookings for one date with all ops fields. `features/travel-summary/api.ts` already uses it and `/api/v1/sb_vehicles`.
- B2C sync keeps `ops_*` across its trip rewrite by `(sb_bookings_id, idx)` (`server.js:1531, 1588-1616`).
- Columns exist for every van ops field on `sb_bookings` and `sb_bookings__trips` (`data-model/tables/sb_bookings.js:87-148, 215-221`). The field is `vanSeq` (there is no `vanSequence`).
- **No column (lost on reload):**
  - `ops.altSplitAuto` (`booking.js:2893`)
  - `ops.vanCkS` / `pierCkS` (a mirror)
  - `sb_vehicles.zoneOverrides[]`
  - `sb_vehicles.dayZone` (except the hardcoded `dayzone_2026_06_12`)
- No SQL view or migration touches vans (`db/migrations/019-032`, `v_seat_availability`).

### Domain rules that must survive the port
The full list, R1–R18, is in the hand-off §1.4. The ones the UI itself must keep:
- Cancelled statuses are excluded from groups, pax, conflicts and warnings (root CLAUDE.md, *Bookings*).
- **Never auto-pick a van; surface conflicts** (root CLAUDE.md, *Vans*). No auto-assign. Mixed vans show as a chip and are never silently fixed.
- A van group = one outbound van. The return van is per allocation (root CLAUDE.md, *Vans*). Disband clears the van and the return van.
- Ops are per date: day 1 in `bk.ops`, other days in `trip.ops` (`bkOpsRead`/`bkOpsFor`). In the backend this becomes per `booking_trip`.
- Charter trips form their own `__CHARTER__` zone. Overnight hold rows are never grouped.
- The outbound pool comes only from the month matrix (`dayRoute`), with no zone fallback. The empty-pool text points staff to the month matrix.
- A second round on the same van needs an explicit confirm. Round n>1 needs its own time.
- Dates: `YYYY-MM-DD` built locally (`apps/web/src/lib/date.ts`), never `toISOString().slice(0,10)`.

### Edge cases
- **Empty states:** no bookings on the day; an empty van pool (the select shows the month-matrix hint); "No van assigned yet" in the VANS card.
- **Boat-split rows** (`bkId#i`) can be ticked, but the tick is never resolved (`booking.js:8758-8767`). This is a legacy bug; don't copy it. In the port, boat splits and van allocations are separate lists.
- **Alternate-pickup splits** are re-created after an unsplit by the heal (`booking.js:2984`). The backend should refuse to unsplit them (hand-off §3.3).
- **Legacy reads day 1 where it should read the date:** the day warning count and the van colour map use `b.ops` (`booking.js:9719-9723, 8559`). The backend board fixes this.
- **Private-van add-on:** a NoTransfer seat with the add-on counts 0 pax in `bkV2VanGroupPax` (`booking.js:2374`). Hand-off Q4.
- **Read-only users:** legacy lets them edit in memory. The port must disable every control when the session lacks `operations:write`.
- **Embed:** van mode is not offered.
- **Thai labels:** keep them as they are (listed in §1 Outputs).

---

## 2. Style

### Legacy rules found
All van-mode rules are in the `BKV2_T2_CSS` string (`booking.js:7681-8547`, injected at `10071`). None are in `allotment_v2/css/*.css`. The van cell, group header, van chips, grouping bar and split modal are built from **inline styles only**.

| Selector | File:line | Notes (winning source) |
|---|---|---|
| `.bt-mc.warn/.ok/.on/.on::before/.on .t/.on .n/.dis/.x` | `booking.js:8429-8442` | `.on .s{display:none}` (8441) beats 8434 |
| `.t2-hd-warnchip` (+`:hover`, `b`, `.bt-ncb` variant) | `7719-7721, 8535-8536` | bg set inline per chip (9739-9743) |
| `.t2-mtbl.t2-van .t2-more, .t2-leadonly` | `8149` | display none |
| `.t2-mtbl.t2-van td.t2-cu` | `8150` | 186px (normally 210, `8105`) |
| `th.t2-gwrap, td.t2-gwrap` | `8148` | 184px; th inline `#0C6B47` on `#DCF0E7`, td inline `#F3FBF7` |
| `tr.t2-novan`, `tr.t2-novan-last` | `8142-8144` | 2px `#E05B5B` box |
| `tr.t2-unassigned` | `8138-8140` | 2px `#E6A85C` |
| `.bt-vans` (+`.act`, `>.bt-ct`) | `8486-8492` | green `#0F6E56` frame; `.act` blue `#185FA5` |
| `.bt-vgrid` (+ scrollbar), `.bt-vtrip`, `.bt-vgrp`, `.bt-vgrpt` | `8499-8520` | |
| `.bkv2-selcount` + `@keyframes bkv2-selpop` | `7837` | DM Mono 24px `#185FA5` |
| group header (inline) | `8879-8894` | van colours from `vehChipPair`; no-van `#FCEDED` / `#D64545` / `#E05B5B` |
| unassigned header (inline) | `9075` | `#FFF7E6`, `inset 4px #E6A23C`, `#9A6B00` |
| van cell (inline) | `3247-3291` | tick `#185FA5` / `#C9CDD4`; split `#5B289A` on `#F3EFFB`; return `#534AB7` / `#C7B8E8` |
| row tint (inline) | `9003` | group colour bg + `inset 4px` bar; ticked `#EEF5FC` |

### Class mapping
Rules copied from `BKV2_T2_CSS` keep their legacy names, because `ByTripView.vue` already uses `bt-*` / `t2-*` (skill rule: existing ports keep legacy names). Markup that was inline-styled has no legacy class, so it gets BEM classes in new child components.

| Legacy | New class | Notes |
|---|---|---|
| `.bt-mc.on/.warn/.ok/.x` | same | add to `ByTripView.vue` |
| `.t2-hd-warnchip` | same | + modifiers `--van`, `--ret`, `--mixed` replacing the inline bg |
| `.t2-van`, `.t2-gwrap`, `.t2-novan*`, `.t2-unassigned` | same | |
| `.bt-vans`, `.bt-vgrid`, `.bt-vtrip`, `.bt-vgrp`, `.bt-vgrpt` | same | |
| inline van cell | `.van-cell`, `__tick`, `__tick--on`, `__chip`, `__none`, `__ret`, `__split`, `__unsplit`, `__self` | `VanCell.vue` |
| inline group header | `.van-group-head`, `--novan`, `--round2`, `__title`, `__round`, `__round--warn`, `__mixed`, `__pax`, `__pax--over`, `__van`, `__time`, `__ret`, `__driver`, `__save`, `__sort`, `__disband` | `VanGroupHead.vue`; the group colour is passed as `--vg-bg` / `--vg-ink` |
| inline unassigned header | `.van-unassigned-head` | `VanGroupHead.vue` (variant) |
| inline van chip | `.van-chip`, `--over`, `__dot`, `__name`, `__pax`, `__area` | `VansCard.vue` |
| inline grouping bar | `.van-groupbar`, `--active`, `__count` (was `.bkv2-selcount`), `__new`, `__add`, `__clear` | `VansCard.vue` |
| `#bk-split-modal` | `.van-split` (inside the global `.dialog` if it exists) | `VanSplitDialog.vue` |

### Tokens
The global `apps/web/src/styles.css` has only `--bg --surface --text --muted --accent --border --topbar`. The By-trip palette lives as scoped tokens on `.btw` (`ByTripView.vue:476-488`). New van tokens go on `.btw` next to them (they are only used in By-trip):

| Legacy value | Token | New? | Light / Dark |
|---|---|---|---|
| `#0F6E56` (Van mode colour, VANS frame, save btn, arranged-return chip) | `--van` | new | `#0F6E56` / `#5DCAA5` |
| `#F1FBF6`, `#F3FBF7`, `#DCF0E7` (van header / cell / th bg) | `--van-soft`, `--van-soft-2` | new | `#F1FBF6`, `#DCF0E7` / `#12332A`, `#17443A` |
| `#185FA5` (tick, selection, `.act`, count) | `--sel` | new | `#185FA5` / `#6AA7E6` |
| `#EEF5FC` (ticked row) | `--sel-soft` | new | `#EEF5FC` / `#1A2A3B` |
| `#E05B5B`, `#FCEDED`, `#D64545` (no-van box) | `--van-missing`, `--van-missing-soft` | new | `#E05B5B`, `#FCEDED` / `#F08A8A`, `#3A1E1E` |
| `#7A1FA2`, `#F3E0F7`, `#D9A8E8` (mixed vans) | `--van-mixed`, `--van-mixed-soft` | new | `#7A1FA2`, `#F3E0F7` / `#C98BE0`, `#2E1A36` |
| `#534AB7`, `#C7B8E8` (return select) | `--van-ret` | new | `#534AB7` / `#A69DF0` |
| `#E07C24` / `#B8860B` (warn chips) | one-off hex | — | commented `booking.js:9740-9741` |
| `#5B289A` on `#F3EFFB` (split button) | one-off hex | — | commented `booking.js:3276` |
| van colours | not tokens; from the van record (`vehColor`) | — | tint/shade via a TS port of `vjTint`/`vjShade` (`vans.js:5-25`) |

### Style block plan
- `ByTripView.vue` `<style scoped>`: add the `bt-mc` state rules, `.t2-hd-warnchip*`, `.t2-van*`, `.t2-gwrap`, `.t2-novan*`, `.t2-unassigned`, `.bt-vans*`, `.bt-vgrid*`, `.bt-vtrip`, `.bt-vgrp*` and the new tokens. Drop `!important` from `.bt-vgrp>div{height:auto!important}` (it only beat a legacy rule).
- `VanCell.vue`, `VanGroupHead.vue`, `VansCard.vue` and `VanSplitDialog.vue` each get a scoped BEM block.
- Global `apps/web/src/styles/components.css` does not exist yet. Create it only if the split dialog uses a shared `.dialog`. If it does, its header comment lists `features/bookings/VanSplitDialog.vue`.
- CLAUDE.md carry-overs:
  - No `backdrop-filter` on the VANS card or group header, since both contain `<select>`s.
  - Nothing new is sticky. The group header content stays pinned left with the existing `.t2-mtbl tr>td[colspan]>div{position:sticky;left:0}`.
  - At phone width, `.bt-mrow` already stacks (≤820px). The group header wraps its controls with `flex-wrap`, and the van column stays 184px inside the table's horizontal scroll.

---

## 3. Data model

Backend checked at `operation-backend@347a19b`. **operation-backend has nothing for vans.**
- There is no endpoint (full list in hand-off §3), no vans table, and no import of van data.
- The untracked 013 table has the columns but no code, and its `ON DELETE CASCADE` is wiped on every booking amend (`src/domain/postgres-operations.ts:236-250`).

| Legacy field / action | Backend endpoint + field | In `ob.ts`? | Status |
|---|---|---|---|
| bookings on the date (status, trips, pax, pickup/drop, zone) | `GET /v1/bookings?service_date=` (already used by `ByTripView`) | yes | ready |
| routes, pier | `GET /v1/routes` | yes | ready |
| vehicles (`SB_VEHICLES`) | `GET /operations/vans` | no | missing |
| month matrix / pool (`dayRoute`, `dayStatus`) | `GET /operations/van-board` → `trips[].pool` | no | missing |
| per-date driver (`VANJOB_DRIVER`) | `van-board` → `vans[].driver*`; `PUT /operations/van-days/:date/:van` | no | missing |
| `vanGroup`, group van, group return, group time | `van-board` → `trips[].groups[]` | no | missing |
| `vanSeq`, `vanReturnId`, `vanSplits[]` | `van-board` → `trips[].allocations[]` | no | missing |
| `pickupTimeFinal`, `returnSameVan` | `van-board` → `allocations[].pickup.time_final`, `.return.same_van` | no | missing |
| effective zone (`bkV2EffZone`) | `allocations[].zone` | no | missing (server-side derive) |
| return info (`bkV2RetInfo`) | `allocations[].return.{needed,self,alert}` | no | missing (server-side derive) |
| rounds (`vjRound*`), conflicts, warnings | `groups[].round`, `warnings.*` | no | missing (server-side derive) |
| group pax / capacity (`bkV2VanGroupPax`) | `groups[].pax`, `.capacity`, `.over_capacity` | no | missing (server-side derive) |
| new group / add to group | `POST /operations/van-groups`, `POST …/:id/members` | no | missing |
| set van / return / time | `PATCH /operations/van-groups/:id` | no | missing |
| Save order / sort by time | `PUT /operations/van-groups/:id/order` | no | missing |
| disband | `DELETE /operations/van-groups/:id` | no | missing |
| clear route | `POST /operations/van-board/clear` | no | missing |
| row return van | `PATCH /operations/van-allocations/:trip/:idx` | no | missing |
| row pickup time, return-same-van | `PATCH /operations/trip-ops/:trip` | no | missing |
| split / unsplit | `POST /operations/trip-ops/:trip/split` / `unsplit` | no | missing |
| van chip colour tint/shade | — | — | derivable: port `vjTint`/`vjShade` (`vans.js:5-25`) to `features/bookings/vanColor.ts` |
| selection, tick order | — | — | UI state |

### `ob.ts` additions
- `ob.vans()` → `ObVan[]`
- `ob.vanBoard(date, routeId?)` → `ObVanBoard` (types `ObVanTrip`, `ObVanGroup`, `ObVanAllocation`, `ObVanWarnings`)
- `ob.vanGroupCreate(body)`, `ob.vanGroupAdd(id, allocations)`, `ob.vanGroupPatch(id, patch)`, `ob.vanGroupOrder(id, order | {clear:true})`, `ob.vanGroupDisband(id)`, `ob.vanClearRoute(date, routeId)`, `ob.tripOpsPatch(tripId, patch)`, `ob.vanAllocationPatch(tripId, idx, patch)`, `ob.tripSplit(tripId, move)`, `ob.tripUnsplit(tripId)`, `ob.vanDayPut(date, vanId, patch)`: every write returns the updated `ObVanTrip`
- `apps/web/src/lib/api.ts` has only `getJson` / `postJson` (`api.ts:12, 26`). Add `patchJson`, `putJson` and `deleteJson` using the same `ApiError` pattern. Carry the server's `code` on `ApiError` so the UI can branch on `van_over_capacity` / `van_in_other_group`.

### Missing endpoints (hand-off to operation-backend)
Drafted in full, with request/response JSON, rules R1–R18, tables, the cascade fix, the legacy import and the optional lock-in, in **`apps/web/docs/handoff/van-endpoints.md`**. It is not repeated here.

---

## 4. Store and component plan

The port is split by what the backend can deliver:
- **Phase 1** (read-only van mode): needs `GET /operations/vans` + `GET /operations/van-board` + the import. It is safe while legacy still owns the writes (hand-off Q1).
- **Phase 2** (group / van / return / time / order / disband / clear / driver writes): needs hand-off §3.2, §3.3 (except split) and `PUT van-days`, plus the cut-over decision.
- **Phase 3** (split / unsplit modal, job-order print, lock-in if approved).

### `useVanBoardStore` (`apps/web/src/stores/vanBoard.ts`)
- **State:**
  - `date`, `board: ObVanBoard | null`, `vans: ObVan[]`, `status: 'idle'|'loading'|'ready'|'error'`, `error`
  - `saving: Set<string>` (group or allocation keys with a write in flight)
  - `selection: Map<allocKey, tickOrder>` + `tickN`, cleared on `load(date)` with a new date
  - Van mode on/off stays in the URL (`?mode=van`), next to the existing `date/pier/route/q` query.
- **Getters:**
  - `vanById`
  - `groupsByZone(routeId)`: replaces the sort and section order at `booking.js:8785-8799, 9092`
  - `unassigned(routeId, zone)`: replaces `_unassignedHdr`
  - `vanChips(routeId)`: replaces `vagg` at `booking.js:9345-9377`
  - `selectionSummary`: `{zone, pax, count, groups}`, replacing `_selTrip` and the grouping bar at `9381-9395`
  - `warnChips`: from `board.warnings`, replacing `booking.js:9705-9744`
- **Actions:**
  - `load(date)`: `ob.vans()` once, plus `ob.vanBoard(date)`
  - `toggleSelect(key)`, `clearSelection()`
  - Phase 2: `groupSelected(routeId, zone, 'new' | groupId)`, `setGroupVan(id, vanId, allowSecondRound?)`, `setGroupReturn`, `setGroupTime` (debounced 400ms, as legacy writes on input), `saveOrder(id)`, `clearOrder(id)`, `disband(id)`, `clearRoute(routeId)`, `setReturn(trip, idx, vanId)`, `setPickupTime(trip, value)` (debounced), `setReturnSameVan(trip, bool)`, `setDriver(vanId, field, value)` (debounced)
  - Each write replaces that trip in `board` with the returned `ObVanTrip`. `warnings` are day-wide, so refetch `ob.vanBoard(date)` after the write settles.
  - On 409 `van_in_other_group` the store returns the conflict. The component shows the legacy confirm text ("…อยู่กรุ๊ปอื่น… ให้วิ่งอีกรอบ…") and retries with `allowSecondRound: true`.
  - On 409 `van_over_capacity` it shows the legacy alert text ("ที่นั่งไม่พอ … สร้างกรุ๊ปใหม่ · แยกคน (✂) · หรือเลือกรถใหญ่กว่า").
  - Phase 3: `split(trip, move)`, `unsplit(trip)`.
- **Stays in components:** hover, the split dialog draft (`VanSplitDialog`), the scroll-to-van flash.

### Components
- `apps/web/src/features/bookings/ByTripView.vue`:
  - enable the Van mode button (`:276-280`); Boat and Re-confirm stay disabled
  - `?mode=van` switches the table to van columns and swaps the Seat Lock/Notice cards for `VansCard`
  - add the warn chips to the date header
- `features/bookings/VansCard.vue`: van chips per trip, extras, and the grouping bar.
- `features/bookings/VanGroupHead.vue`: the group header row (`<tr><td :colspan>`), in read-only (phase 1) or editable (phase 2) form, plus the unassigned variant.
- `features/bookings/VanCell.vue`: the "✓ กลุ่ม" cell.
- `features/bookings/VanSplitDialog.vue`: phase 3.
- `features/bookings/vanColor.ts`: `vanColor(van)`, `vanChipPair(van)` (port of `vehColor`/`vehChipPair`/`vjTint`/`vjShade`).
- **Route:** none new. It stays on `/bookings/trips` with `?mode=van`.
- **Stays disabled / links to legacy:**
  - Phase 1: every write control is rendered disabled, with the title "Not moved yet", plus a "Edit in legacy" link: `legacyUrl('booking')` (`apps/web/src/lib/legacy.ts`) with the date.
  - Phase 2: split / unsplit and the job order stay legacy links.
  - The month matrix (Vans page) and the Van Job Order page stay legacy until their own ports.
- **Tests:**
  - `stores/vanBoard.spec.ts`: selection order and date reset; `groupSelected` sends ticked keys of the first zone only; the 409 handling paths; a trip is replaced after a write.
  - `features/bookings/ByTripView.spec.ts`: extend with `fetch` stubbed for `/api/ob/operations/van-board` and `/api/ob/operations/vans`. Van mode hides Add-on/Pay/Total/VC and shows the group column; unassigned header counts; a no-van group gets `t2-novan`; NoTransfer shows "self-arrive"; cancelled rows are absent from groups.
  - `features/bookings/vanColor.spec.ts`: tint/shade match the legacy output for a few colours.

---

## 5. Open questions
1. **Cut-over:** Vue writes and legacy writes cannot both be live (hand-off Q1). Phase 1 is read-only for this reason. When does phase 2 switch on, and does legacy van mode get switched off at the same time?
2. **Lock-in:** legacy has none. Is it wanted, and at what grain (van-day / group / whole day)? See hand-off §6.
3. **Tick → group flow:** keep legacy's "tick rows, then press a group button", or also allow dragging a row onto a group header? Recommended: keep ticks for phase 2.
4. **Disband:** legacy has no confirm (`booking.js:2409`). Add one in the port?
5. **Mode persistence:** legacy restores van mode on reload from `sessionStorage`. `?mode=van` in the URL does the same and survives sharing a link. Is that OK?
