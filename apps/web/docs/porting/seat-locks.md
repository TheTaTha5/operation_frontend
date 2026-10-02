# Porting spec: Seat Locks tab (Booking page)

- **Revised 2026-10-02:**
  - Re-checked against `operation-backend` `origin/main@638c64b`. The local `main` checkout (`43142a8`) is behind and doesn't have the agents merge.
  - The seat-lock endpoints are unchanged. They moved to `operations.ts:358-369`.
  - Draft E (agent catalogue) has shipped as `GET /v1/agents` and is already in `ob.ts`. Holder names and colours are now **ready**.
  - `GET /v1/bookings` now takes `agent_id`, which makes coverage cheaper.
  - Draft F (enforce the lock's agent on draws) is still missing (`capacity.ts:139-141`).
  - `apps/web/src/styles/components.css` and the tone tokens in `styles.css` now exist, so §2 reuses them instead of the `--tone-*` set proposed on 2026-09-24.
  - Updated frontend line refs: "All →" is at `ByTripView.vue:365`, `ob.seatLocks` at `ob.ts:331`.
- **Built 2026-10-02 (phase 1):** `features/seat-locks/`, `stores/seatLocks.ts`, `components/LaDialog.vue`, route `/bookings/locks`. Where the build differs from this plan:
  - **Giving back every held seat:** a lock with draws is kept at `pax = drawn_pax` instead of being released (`releasePlan` in `model.ts`). This matches legacy, which marked such a lock `depleted`, not `released`. A lock with no draws calls `/release`.
  - **Write errors:** writes go through the new `sendJson` / `patchJson` in `lib/api.ts`. The error text is Fastify's `message` (e.g. "Insufficient available seats"), not its `error` ("Conflict").
  - **Agent colour:** `agentColor` and `CXL` are imported from `features/bookings/byTrip.ts`, following the Agents feature's existing cross-feature import, instead of being moved to `lib/`.
  - **Filters:** the scope filter (day / bulk) is left out, since every lock is a day lock.
  - **Buttons and status chips:**
    - "ประวัติ" is now "รายละเอียด", because there is no history to show yet.
    - Status chips use `.chip--ok` (active), base `.chip` (depleted) and `.chip--warn` (released).
  - **Agent picker:** the create form accepts an agent's name or code and refuses text that matches no agent. Legacy kept free text as the holder id.

- **Legacy entry point:** `bkV2RenderLocks` (`allotment_v2/js/booking.js:623`). It is dispatched from `bkV2RenderTabBody` when `_bkV2.tab==='locks'` (`booking.js:6309`), mounted by `bkV2Render` into `#view-booking > #bkv2-host > .bkv2.bkv2-bodycard` (`booking.js:4620`). The tab is opened by `bkV2SwitchTab('locks')` (`booking.js:10328`).
- **Helpers in scope:**
  - Lock maths:
    - `bkV2LockSpansDays`, `bkV2LockRange`, `bkV2LockDowOk`, `bkV2LockUsedOn`, `bkV2LockPeakUsed` (`booking.js:25-59`)
    - Release cutoff: `bkV2LockReleaseCutoff` / `ReleasedForDate` / `CutoffLabel` (`65-87`)
    - Sub-groups: `bkV2LockChildren` … `bkV2LockPoolHold` (`139-153`)
    - `bkV2LockRounds` (`155`), `bkV2LocksOnDate` (`1025`)
  - Holder display: `bkV2LockHolderName` (`618`), `bkV2LockHolderColor` (`1006`), `bkV2LockDayStr` (`1014`)
  - Writes:
    - `bkV2CreateLock` (`171`), `bkV2CreateSubLock` (`522`)
    - `bkV2LockAddSeats` (`339`), `bkV2ReleaseLock` (`353`)
    - `bkV2LockFixUsed` / `FixTree` (`307`, `323`)
  - Audit: `bkV2LockClaims` (`241`), `bkV2LockAudit` (`260`), `bkV2LockCoverage` (`272`), `bkV2LockAuditTree` (`298`), `bkV2LockSweep` (`552`)
  - Create form: `bkV2LockFormFields` (`392`), `bkV2RenderLockModal` (`458`), `bkV2LockCreateSubmit` (`481`)
  - Overlays: `bkV2LockAddModal` (`1050`), and `bkV2LockOverlays` (`1091-1284`), which holds the release, sub-group and manage modals
  - State declarations: `allotment_v2/js/08-app.js:1198-1210`. Persistence: `sbSeatLocksPersist` (`08-app.js:1163`).
- **Already ported:**
  - `ByTripView.vue` shows a read-only per-day Seat Lock card through `ob.seatLocks(date)` (`ByTripView.vue:85`). Its "All →" button is disabled (`ByTripView.vue:365`).
  - `BookingTabs.vue` sends "Seat Locks" to the legacy app (`BookingTabs.vue:15`).
  - `features/agents` + `stores/agents.ts` already load the agent catalogue (`ob.agents()`, `ob.ts:336`).
  - Nothing else.
- **Backend checked at:** `operation-backend@638c64b` (origin/main); first draft at `@347a19b`
- **Date:** 2026-09-24

---

## 1. Functionality

### Purpose
Staff reserve ("lock") seats on a route and date for an agent, an office hold or a global pool, before the seats go on general sale. The tab lists every lock with how much of it has been used. From it, staff create, top up, split into sub-groups and release locks. It also flags locks whose used counter disagrees with the bookings.

### Inputs
| Source | What is read | Where |
|---|---|---|
| `SB_SEAT_LOCKS` (global) | `id, parentId, subName, scope ('day'\|'bulk'\|'month'), routeId, date, dateFrom, dateTo, monthFrom, monthTo, month, dow[], holderType ('agent'\|'office'\|'global'), holderId, qty, used, usedBy{date:n}, releaseDaysBefore, releaseTime, expiry, reason, status ('active'\|'depleted'\|'released'\|'expired'), log[]` | shape at `booking.js:175-184`; loaded at `08-app.js:995`, `08-app.js:1158` |
| `ROUTES` (global) | `id, name, color` | `booking.js:626-628` |
| `SB_AGENTS` (global) | `id, name` (holder name, create-form datalist) | `booking.js:397`, `494`, `621` |
| `SB_BOOKINGS` (global) | `status, trips[].{routeId,date,pax,bookingMode,lockDraws[]}, agentId, voucherRef, code, leadPax` (claims, coverage, sweep) | `booking.js:245-256`, `278-291` |
| Route calendar | `bkV2IsRouteOpenOn(routeId, date)`, used to count bulk rounds | `booking.js:164` |
| Agent colour | `bkV2AgentColor(holderId)` | `booking.js:1008` |
| Page flavour | `_bkV2CityTourOnly` plus `laIsLandRoute(rid)`: the marine page hides land-route locks and the City Tour page shows only them | `booking.js:633`, set at `04-data-core.js:708` |
| Session | `laCanEditArea('operations')` gates persistence; `laGuardEdit('operations')` gates the two "fix" actions; `laBy()` stamps `createdBy` / `log[].by` | `08-app.js:1163`, `booking.js:324`, `585`, `08-app.js:1167` |
| Clock | `Date.now()` for release countdowns and the 48h window | `booking.js:649` |

### Outputs

#### Rendered sections (in order, `booking.js:992-1003`)
1. **Header:** the title "Seat Locks", a subtitle, and the "+ ล็อกที่นั่ง" button (`993-997`).
2. **Sweep banner:** shown only when the sweep finds seats. It reads "มีที่นั่งกันไว้เปล่า N ที่" with a "ดูรายการ" button (`924-935`). The sweep modal is inline (`936-991`).
3. **KPI cards (4)** (`679-686`):
   - active locks, split into day and bulk
   - seats held **tomorrow**, with a lock and route count and a 14-day sparkline
   - seats drawn, with the conversion % of capacity offered
   - rounds releasing within 48h, and how many seats that returns to the pool
4. **"ล็อกของวัน" day table** (`724-747`):
   - A date header with prev/next buttons and Today/Tomorrow buttons. It defaults to **tomorrow** (`dayOff:1`).
   - Rows sorted by holder, then route. Columns: holder · route · type (Bulk/Day) · held · used today · left · release (a countdown pill) · "+ ที่นั่ง".
5. **Filter bar** (`775-785`):
   - search box, route select, holder select, scope select
   - status segment (active / all)
   - group segment (by agent / by route / none)
   - the row count
6. **Main table** (`906-921`):
   - One `<tbody>` per group, each with a coloured group header row (`891-897`).
   - Lock rows (`807-848`) have an expand toggle, holder with status and sub-group chips, route with reason, a when-cell (date, or range plus weekday chips), qty, used with a progress bar, left, the release rule, and actions.
   - Expanded rows list the sub-groups (`849-865`).
7. **Overlays:** create (`458`), add seats (`1050`), release (`1094`), sub-group (`1119`) and manage/history (`1227`). They are rendered globally by `bkV2Render`, so By-trip can open them too.

#### Handlers
| Trigger | Calls | Effect | Writes? |
|---|---|---|---|
| "+ ล็อกที่นั่ง" | `bkV2OpenLockModal()` (`1039`) | opens the create modal | — |
| Create form fields | `bkV2LockSetField(f,v)` (`477`), `bkV2LockToggleDow(i)` (`452`) | edits `_bkV2LockForm`; re-renders when holderType, routeId or scope changes | — |
| "สร้างล็อก" | `bkV2LockCreateSubmit()` (`481`) → `bkV2CreateLock` (`171`) | validates the route, the date (or range, with to ≥ from) and qty > 0; resolves the agent name to an id, keeping free text if there is no match; pushes the lock | **yes**: new lock |
| "+ ที่นั่ง" (row, child, day table, manage) | `bkV2LockAddOpen(id)` (`1041`) → `bkV2LockAddSubmit` (`1044`) → `bkV2LockAddSeats` (`339`) | `qty += n`; a child cannot exceed the parent's unallocated seats; reactivates a depleted or released lock; logs `add` with a note | **yes**: `qty`, `status`, `log` |
| "+ ย่อย" | `bkV2SubOpen(id)` (`599`) → `bkV2SubCommit` (`604`) → `bkV2CreateSubLock` (`522`) | the child copies the parent's route, dates, holder and cutoff; qty must be ≤ `bkV2LockUnallocDrawable(parent)` | **yes**: new child lock |
| "คืน" / "ปล่อย" | `bkV2LockReleaseConfirm(id)` (`514`) → stepper `bkV2ReleaseModalSet` (`605`) → `bkV2ReleaseModalCommit` (`611`) → `bkV2ReleaseLock` (`353`) | **partial** release. `qty` goes down by n, never below the peak used, and for a parent never below what is allocated to sub-groups. Status becomes `depleted` or `released` when nothing is left. | **yes**: `qty`, `status`, `log` |
| "ประวัติ" | `bkV2LockManageOpen(id)` (`600`) | opens the manage modal, which shows held/used/total, sub-groups split into free/used/released buckets, the voucher codes that drew from the lock, an audit warning, and coverage (bookings of this holder that bypassed the lock) | — |
| Manage → voucher row | `bkV2LockManageClose(); bkV2OpenDetail(id)` (`booking.js:1219`) | opens that booking | — |
| Manage → "แก้ตัวเลขให้ตรงกับใบจอง" | `bkV2LockFixTree(id)` (`323`) | uses `confirm()`, then resets `used`/`usedBy` from live bookings | **yes**: `used`, `usedBy`, `log` |
| Sweep "ดูรายการ" / "คืนที่นั่งทั้งหมด" | `bkV2LockSweepOpen` (`582`), `bkV2LockSweepFixAll` (`584`) | the same reconcile, across every lock | **yes** |
| Row ▸ toggle | `bkV2LockUIToggle(id)` (`1038`) | expands the sub-group rows | — |
| Filters, segments, search | `bkV2LockUISet(field,val)` (`1037`) | updates `_bkV2LockUI`; **every keystroke re-renders the whole tab** | — |
| Day nav | `bkV2LockDayShift(±1)` (`1022`), `bkV2LockDaySet(0\|1)` (`1023`) | changes `dayOff` | — |

Every write goes through `sbSeatLocksPersist()` (`08-app.js:1163`), which read-modify-writes `localStorage[LS_KEY].sb_seat_locks`. From there it syncs to Postgres through `/api/save`. The server does no validation, and some bulk fields have no column (see "Legacy server side" below).

### State
| State | Kind | Held in | Survives navigation? → port |
|---|---|---|---|
| `q, route, holder, scope, st ('active'), grp ('holder')` | UI | `_bkV2LockUI` (`08-app.js:1202`) | yes → **store** |
| `dayOff` (default 1 = tomorrow) | UI | `_bkV2LockUI.dayOff` | yes → **store** |
| `open{}`: expanded parent rows | UI | `_bkV2LockUI.open` | no → **component** |
| Create form | UI | `_bkV2LockForm` (`08-app.js:1199`); defaults: `holderType:'agent'`, `releaseDaysBefore:'1'`, `releaseTime:'18:00'` | resets per open → **component** |
| Open modal + its draft (`_bkV2AddModal`, `_bkV2ReleaseModal`, `_bkV2SubModal`, `_bkV2LockManageId`, `_bkV2SweepOpen`, `_bkV2LockModalOpen`) | UI | `08-app.js:1203-1210` | no → **component** |
| Locks, agents, routes, bookings | domain | globals | → **backend via store** |

### Domain rules that must survive the port
- **Cancelled bookings don't count.** Bookings with status `cancelled`, `rejected` or `cancelled_weather` never count as drawing from a lock (`booking.js:246`, `279`). The backend applies the same rule when it derives `drawn_pax` (`booking-status.ts:29`).
- **A lock holds only its undrawn remainder.** It holds `qty − used` seats against the sellable pool, counted at the parent level only (`bkV2LockPoolHold`, `booking.js:152`). The backend equivalent is `remaining = max(pax − drawn, 0)` (`capacity.ts:98`).
- **Released seats don't count toward held seats.** When a round's release cutoff has passed, its seats don't count as held (`booking.js:659`, `671`, `696`).
- **Charter trips don't draw from locks** (`booking.js:283`). The backend returns 400 for lock draws on a charter.
- **A lock can't shrink below what's already used.** Release never takes `qty` below the peak used (`booking.js:358-363`). In the backend, `PATCH pax` below `drawn_pax` returns 409.
- **Dates are local (+07:00).** Build every date with `localYmd`, never `toISOString` (CLAUDE.md).

### Edge cases
- **Empty states:** "วันนี้ไม่มีล็อก" in the day table (`723`) and "ไม่มีล็อกที่ตรงกับตัวกรอง" in the main table (`902`).
- **Read-only users see changes that vanish.** `sbSeatLocksPersist` returns early without saving, but the in-memory lock has already changed, so the change shows on screen and disappears on reload (`08-app.js:1163`). **The port must hide or disable writes instead.**
- **Embed mode hides the create buttons.** In read-only embed mode, `.bkv2-newbtn2` is hidden (`10-embed.js:111`). That hides both "+ ล็อกที่นั่ง" and the create modal's submit button.
- **The day-lock expiry sweep changes data on page load.** `bkV2LockExpireSweep` (`booking.js:89`, run at `08-app.js:1196`) sets status to `expired` or reactivates locks. CLAUDE.md forbids this kind of auto-mutating heal, so don't port it.
- **Text language.** Labels are Thai; the modal eyebrows are English. Keep them as they are.
- **Group headers aren't sticky.** The `§lkStickyFix` comment (`875`, `904`) says they stick, but the group header row has no `position:sticky` (`891`). Either the comment is stale or the behaviour was lost.

### Legacy server side (`server.js` + database)
*Added 2026-09-24. The first draft covered only the client code.*

**Storage and validation.** `server.js` stores locks but doesn't validate them:
- `sbSeatLocksPersist` writes the whole `sb_seat_locks` array into the blob. `/api/save` then splits it into rows using the data model: tables `sb_seat_locks` and `sb_seat_locks__log` (`data-model/tables/sb_seat_locks.js`, `data-model/os_repo.js:1-13`).
- The server checks none of the lock rules: release below used, sub-group room, qty > 0. All of them are client-only.
- There is no race protection either. `db/test_seat_lock_race.mjs` refers to a `draw_seat()` function in "migrations/001_seat_locks.sql", but that function doesn't exist in `db/baseline/` or `db/migrations/`.

**Bulk-lock fields have no column.** The data model has columns for `scope`, `month`, `monthFrom`, `monthTo`, `parentId`, `subName`, `releaseDaysBefore`, `releaseTime`, `reason`, `expiry`, `createdBy` and `log[]`. It has **none** for `dateFrom`, `dateTo`, `dow` or `usedBy`, and none for `log[].tripDate`. `os_repo` is driven by the model, so these fields look like they are **not saved to Postgres**. A bulk lock would then come back from `/api/load` with no range, which means `bkV2LockRange` returns `''` and the lock matches no date. **Not yet verified**; see open question 2 for a local test.

**Where the server reads locks.** There are three readers, and none of them matches the client's rules:

| Reader | Where | What it counts |
|---|---|---|
| B2C webshop availability `GET /api/b2c/availability` | `server.js:3288`, lock query `3326-3348` | Active **parent or standalone** locks on the exact `date`: `qty − used − children's used`. Children count 0 (`§parentLock`). |
| B2C sync oversell safety net | `server.js:1651-1700`, lock query `1670-1672` | `fillLine = capacity − locked`. Newer B2C bookings above the line go to `pending_approval`. The lock sum is **flat over every active row, children included**, so it double-counts sub-groups. This is the bug that `§parentLock` fixed in the availability query but not here. |
| View `operation_schemas.v_seat_availability` | `db/migrations/020_v_seat_availability_trips_boat.sql:65-75` | Same parent-only rule as the webshop query, keyed by `left(date,10)` |

**The server and the client count locks differently:**
- **Bulk/month locks:** all three server readers match only the exact `date`, and bulk/month locks have `date=''`, so the server **ignores them completely**. The client counts them per departure (`bkV2LocksFor`, `booking.js:107-118`). As a result, the webshop can sell seats that ops think are locked for an agent.
- **Release cutoff and weekdays:** the server ignores `releaseDaysBefore`/`releaseTime` and `dow`. A lock past its cutoff still blocks webshop sales.
- **Expiry:** the server trusts `status`. Expiry only happens when the client's `bkV2LockExpireSweep` runs on some staff member's page load.

**What this means for the port:**
- **operation-backend's model is not a step down from what legacy actually enforces.** It has single-day locks, derived `drawn_pax`, and capacity checks with an advisory lock (`capacity.ts`). In legacy, bulk locks, cutoffs and weekdays only work inside the staff screen, and possibly don't survive a reload.
- **Drafts A (bulk) and C (cutoff) are new behaviour for the backend,** not parity with legacy. Their rules must be written once in the backend and read everywhere (webshop, availability, booking draws), so this client/server split doesn't happen again.
- **Phase 1 goes through operation-backend,** so it gets server-side validation that legacy never had.

---

## 2. Style

### Legacy rules found
Nearly everything is inline: about 392 `style=""` attributes across the five functions. Only four classes appear:

| Selector | File:line | Winning value |
|---|---|---|
| `.bkv2-locks` | root at `booking.js:992`, create dialog at `463` | scope only; no rules of its own |
| `.bkv2-newbtn2` | `02-skins.css:66-67`, `75-76` | pill, 12.5px/600, bg **#C0392B**, hover **#9A2D1E**. The locks-scoped rule beats the navy default. |
| `.bkv2-nb-label` | `01-base.css:2096` | 10px/600, uppercase, `.06em`, #64748B |
| `.bkv2-nb-input` | `01-base.css:2097`, `2107`, `2109`; `02-skins.css:78` | 1px #E5E7EB border, radius 11px, padding 8px 11px, 13px. Focus border **#C0392B**, but the focus ring stays navy `rgba(27,42,85,.08)`. |
| `#view-booking` vars | `02-skins.css:4-21` | font Inter; `--ink #1F2A44`, `--ink-soft #64748B`, `--ink-faint #94A3B8`, `--border #E5E7EB`, `--border-2 #EEF0F3` |
| `.bkv2-bodycard` | `01-base.css:1814`, `02-skins.css:252-256` | radius 18px, skin shadow, `overflow:hidden` |

- **Dead rules:** `.bkv2-locks .bkv2-stat.hero` and `.bkv2-nb-sec-h::first-letter` (`02-skins.css:74`, `77`). Drop them.
- **Responsive:** no rules for this tab. The KPI grid stays `repeat(4,1fr)` at every width (`booking.js:679`). At ≤820px, the generic `min-height:40px` rule (`02-skins.css:739-743`) stretches the 22px nav buttons and the 30–34px controls.

### Class mapping
The legacy markup has no classes to map, so the BEM blocks are named after the inline recipes they replace.

| Legacy (inline recipe / class) | BEM class | Notes |
|---|---|---|
| `.bkv2-locks` root | `.seat-locks` | page block |
| header row (`993`) | `.seat-locks__head`, `__title`, `__sub` | |
| `.bkv2-newbtn2` (`996`) | `.btn .btn--lock` | shared button block (see Tokens) |
| sweep banner (`927`) | `.callout .callout--alert` | shared callout block |
| KPI grid (`679`) + `card()` (`673`) | `.lock-kpis`, `.lock-kpi`, `__label`, `__value`, `__unit`, `__foot`, `.lock-kpi--lock` / `--warning` | tone modifier replaces the gradient args |
| `pill()` (`678`) | `.chip` + tone modifiers | shared |
| sparkline (`683`) | `.lock-kpi__spark`, `__spark-bar`, `__spark-bar--empty` | height as a CSS var `--h` |
| day box (`724-747`) | `.lock-day`, `__head`, `__date`, `__tag`, `__nav`, `__summary`, `__scroll` | |
| `navBtn` (`697`), Today/Tomorrow (`735`) | `.lock-day__step`, `.lock-day__jump`, `.lock-day__jump--on` | |
| `th2`/`td2` (`698-699`), `th`/`td` (`905`, `834`) | `.lock-table`, `__th`, `__td`, `__td--num`, `__td--center` | one table block with `.lock-table--compact` for the day table |
| filter bar (`775`) + `inp` (`756`) | `.lock-filters`, `__search`, `__select`, `__label`, `__count` | |
| `seg()` (`753`) | `.seg`, `.seg__btn`, `.seg__btn--on` | shared |
| group header (`891`) | `.lock-group`, `__bar`, `__name`, `__meta` | agent/route colour via `--group-color`; replaces `_calRgba`/`_calDk` with `color-mix()` |
| lock row (`835-848`) | `.lock-row`, `__toggle`, `__holder`, `__dot`, `__route`, `__route-bar`, `__reason`, `__when`, `__qty`, `__used`, `__left`, `__release`, `__actions` | |
| child row (`851`) | `.lock-row--child` | |
| `stChip` (`788`) | `.chip .chip--active` / `--depleted` / `--released` | `expired` dropped (see §3) |
| Bulk/Day badges (`715`, `801`) | `.chip .chip--day` / `.chip--bulk` | |
| `bar6()` (`805`) | `.meter`, `.meter__fill` | width via `--pct` |
| `btn()` (`826`) | `.btn .btn--sm` + `--success` / `--danger` / `--ghost` | |
| modals (`462`, `1061`, `1095`, `1228`) | `.dialog`, `__backdrop`, `__box`, `__head`, `__eyebrow`, `__title`, `__close`, `__body`, `__foot` | one shared `<LaDialog>`; widths via `--dialog-w` |
| `.bkv2-nb-label` / `.bkv2-nb-input` | `.field`, `.field__label`, `.field__input`, `.field__hint` | shared |
| note boxes (`450`, `1069`, `1081`) | `.callout .callout--note` | |
| release stepper (`1103-1107`) | `.stepper`, `__btn`, `__input` | |

Shared blocks go in `apps/web/src/styles/components.css` (see §5 Decisions). *Revised 2026-10-02:*
- **Already there, reuse:**
  - `.chip` with `--ok` / `--warn` / `--danger` / `--info` / `--on`. Add `--bulk` and `--lock` modifiers.
  - `.callout` with `--danger` / `--warn`, used for the notes and the "not in the backend yet" states.
  - Add `features/seat-locks/*` entries to both "Used by" comments.
- **New in this port, each with its own "Used by" comment:** `.btn`, `.seg`, `.field`, `.meter`, `.dialog`, `.stepper`.
- **Chip modifier names change:** `--active`/`--depleted`/`--released`/`--day` in the table above become `.chip--ok`, base `.chip`, `.chip--warn` and `.chip--info`.

### Tokens
*Revised 2026-10-02.* The legacy tab uses about 70 distinct colours, mixing warm neutrals (#FBFAF7, #F7F6F1, #FAF9F5) with cool slate. `styles.css` now has a tone set (fg / `-bg` / `-line`) that the agents port uses, so map onto that first and add only what has no match:

| Token | Status | Replaces |
|---|---|---|
| `--surface`, `--surface-2`, `--text`, `--muted`, `--border`, `--accent` | existing | #fff ×41, #FAF9F5/#fafafa/#FCFBF8, `--ink`, `--ink-soft`, #E5E7EB |
| `--ok` / `-bg` / `-line` | existing | success green (#0F6E56, #0F7A5A): active chip, "+ ที่นั่ง" |
| `--danger` / `-bg` / `-line` | existing | #A32D2D: release button, full/over states |
| `--warn` / `-bg` / `-line` | existing | #A05A1A, #B45309, #92400E: released, "soon", unallocated, both orange and yellow callouts merged |
| `--info` / `-bg` / `-line` | existing | #2A5EA8: day badge; #3730A3: voucher chips |
| `--lock` / `-bg` / `-line` | **new** (light #C0392B / #FBEAE6 / #EAC6BF; dark #f07a6c / #3a1f1c / #5c2e28) | lock red: primary button, focus ring, sparkline. Used by this tab and the By-trip lock card, so it earns a token. |
| `--bulk` / `-bg` | **new** (light #5B3FA5 / #F3EEFB; dark #b39cf0 / #2a2140) | bulk badge, weekday chips, and sub-groups (#534AB7 merged) |
| `--text-faint` | **new** (light #94A3B8; dark #6b7c84) | `--ink-faint` ×22 |
| `--overlay` | **new** (light rgba(15,23,42,.45); dark rgba(0,0,0,.6)) | dialog backdrops; the first shared `.dialog` needs it |
| neutral (depleted, office holder) | none needed | use the base `.chip` (`--surface-2` / `--muted`) |
| track (meter, spark, segment track) | none needed | `--surface-2` with a `--border` hairline |

- **Keep as one-off hex, each with a comment naming its legacy source:**
  - #8A6A0B (global holder, `booking.js:1010`)
  - #9C9C95 (route/holder fallback, `628`)
  - the spark fill #E2B7B0 (`683`)
- **Leave out of the palette:** agent and route colours are data (`bkV2AgentColor`, `route.color`).
- **`--topbar`:** legacy forces it to `0px` (`02-skins.css:351`). This tab's sticky headers are `top:0` inside their own scroll boxes, so they don't need it. The port keeps inner scroll boxes, so no `--topbar` dependency.
- **Fonts:**
  - Inline `'DM Mono'` (26×) → a `--font-mono` token.
  - `Manrope` with `tabular-nums` (7×) → `font-variant-numeric: tabular-nums` on the numeric cells; drop the family.

### Style block plan
- **KPI grid:** `.lock-kpis` is `grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))`, so it collapses on phones. Legacy is fixed at 4 columns.
- **Scroll boxes:**
  - The day table uses `.lock-day__scroll { max-height: 212px; overflow: auto }`.
  - The main table uses `max-height: calc(100dvh - var(--topbar) - 300px)`, replacing `calc(100vh - 300px)`.
- **Sticky headers:** `.lock-table__th` is `position: sticky; top: 0`. Group header rows get `position: sticky; top: var(--lock-th-h)` to restore the lost `§lkStickyFix` behaviour, where `--lock-th-h: 31px` is declared once on `.lock-table`.
- **Phone width:**
  - The main table becomes horizontally scrollable inside its card (`overflow-x: auto`). Don't reflow it to cards in phase 1.
  - The filter bar wraps.
  - Buttons get `min-height: 36px` on touch widths, set deliberately rather than by the legacy global rule.
- **No `!important`.** None is needed, because there is no legacy cascade to beat.
- **No `backdrop-filter`** on any card. The dropdowns are native `<select>`/`<datalist>`, so nothing is at risk today, but keep it that way.
- **Focus ring:** `.field__input:focus` uses `--lock` for both the border and the ring. This fixes the legacy mix of a red border with a navy ring.

---

## 3. Data model

Backend checked at `operation-backend@638c64b` (origin/main). The first draft was checked at `@347a19b`. Since then the seat-lock routes and the `capacity.ts` lock rules haven't changed; only their line numbers in `operations.ts` moved.

**Summary:** the backend models a lock as **one route × one date × `pax` seats, optionally for one `agent_id`**, with a live, derived `drawn_pax` (`src/domain/operations.ts:107-119`; `migrations/001_operations.sql:22-33`). The following legacy concepts don't exist in the backend:
- bulk or month ranges and weekdays
- sub-groups
- office/global holders
- release cutoffs and expiry
- notes, created_by and history

The legacy importer skips bulk and undated locks and folds sub-groups into their parent (`src/tools/import-legacy.ts:124-143`, `185-205`).

| Legacy field / action | Backend endpoint + field | In `ob.ts`? | Status |
|---|---|---|---|
| list all locks | `GET /v1/seat-locks` (no filter → all, incl. released; ordered by `created_at`) (`operations.ts:358`) | only `?date=` | **backend-only**: add `ob.seatLocksAll()` / `ob.seatLocks({ route_id?, service_date? })` |
| `routeId` | `route_id` | yes | ready |
| `date` (day scope) | `service_date` | yes | ready |
| `qty` | `pax` | yes | ready |
| `used` / `usedBy` | `drawn_pax` (derived from `booking_trip_lock_draws`, cancelled excluded) | yes | ready. It is **always correct**, so the legacy sweep and "fix counter" features are **dropped**, not ported. |
| held (`bkV2LockHeldRemaining`) | — | — | **derivable**: `max(pax − (drawn_pax ?? 0), 0)`, the same as `capacity.ts:98` |
| `holderType:'agent'`, `holderId` | `agent_id` | yes | ready |
| holder **name** | `GET /v1/agents` → `name` (`operations.ts:349`) | yes: `ob.agents()` (`ob.ts:336`) | **ready**. `ob.agents()` asks for `?active=true`, but a lock can still point at an inactive agent. Look names up with `active=all` (add an optional arg) and fall back to the raw id. |
| `holderType:'office'\|'global'` | — | — | **missing**. Today `agent_id` null = unassigned. |
| `status` active / released | `status`, `released_at` | yes | ready |
| `status` depleted | — | — | **derivable**: `status==='active' && held===0` |
| `status` expired | — | — | **dropped**: no expiry in the backend, and the legacy auto-expire sweep breaks the CLAUDE.md "no self-heal" rule |
| `scope:'bulk'\|'month'`, `dateFrom/To`, `dow[]` | — | — | **missing** (draft A) |
| `parentId`, `subName` (sub-groups) | — | — | **missing** (draft B) |
| `releaseDaysBefore`, `releaseTime`, `expiry` | — | — | **missing** (draft C). This blocks the "ใกล้ปล่อยคืน 48 ชม." KPI and the release column. |
| `reason` (note) | — | — | **missing** (draft D) |
| `createdBy`, `log[]` (history) | `created_at`, `updated_at` only | partly | **missing** (draft D) |
| create lock | `POST /v1/seat-locks` `{route_id, service_date, pax, agent_id?}` → 201; 409 when it doesn't fit (`operations.ts:362`) | no | **backend-only**: `ob.createSeatLock(input)` via `postJson` |
| add seats (`bkV2LockAddSeats`) | `PATCH /v1/seat-locks/:id` `{pax: pax + n}`; capacity-checked (`operations.ts:363-368`) | no | **backend-only**: `ob.amendSeatLock(id, {pax})`. The note is lost (draft D). |
| partial release (`bkV2ReleaseLock` with n) | `PATCH …/:id` `{pax: pax − n}`; 409 below `drawn_pax` | no | **backend-only** (same method) |
| full release | `POST /v1/seat-locks/:id/release`; idempotent; drawn seats stay with bookings (`operations.ts:369`) | no | **backend-only**: `ob.releaseSeatLock(id)` |
| change holder | `PATCH …/:id` `{agent_id}` (cannot clear it; `""` → 400) | no | **backend-only**. Legacy has no UI for this, so it's optional. |
| claims (vouchers that drew from the lock) | every booking trip returns `lock_draws: Record<lockId, qty>` (`BookingTrip` in `domain/operations.ts`) | no: `ObTrip` lacks it (`ob.ts:66`) | **derivable**: `ob.bookingsBetween(d, d)` filtered by `trip.lock_draws[lock.id] > 0`. Add `lock_draws: Record<string, number>` to `ObTrip` (field name confirmed). |
| coverage (holder's bookings that bypassed the lock) | `GET /v1/bookings` now filters by `agent_id` (`operations.ts:157`) | partly: `ob.agentBookings` pages by agent only | **derivable** (`bkV2LockCoverage`, `booking.js:272`). The same-day `bookingsBetween` already loaded for claims is enough; filter it by `agent_id` on the client. |
| 14-day held sparkline | all locks, bucketed client-side | — | **derivable**. Cross-check against `GET /v1/availability` `locked_pax`. |
| "ดึงไปขายแล้ว" + conversion % | Σ `drawn_pax` / Σ `pax` | — | **derivable** (day locks only, so the bulk "rounds past" maths drops out) |
| land/marine split (`_bkV2CityTourOnly`) | — | — | **open question**: nothing on `ObRoute` marks a land route |
| routes (name, colour) | `GET /v1/routes` | yes | ready |
| agent colour (`bkV2AgentColor`) | `GET /v1/agents` → `color` (null = automatic) | yes | **ready**: `agent.color ?? agentColor(id)`. The hash is already ported in `features/bookings/byTrip.ts:66`; move it to `lib/` once a second feature imports it. |
| write permission | backend scope `booking:write` (`operations.ts:148-155`) | via proxy token | ready. The client also hides writes unless `session.me.canEdit` and `editAreas` include `operations`. |

### `ob.ts` additions
- `seatLocks(filter?: { route_id?: string; service_date?: string })` → `ObSeatLock[]`. Widen the current `seatLocks(date)` and keep a date-only overload for `ByTripView`.
- `createSeatLock(input: { route_id: string; service_date: string; pax: number; agent_id?: string })` → `ObSeatLock`
- `amendSeatLock(id: string, changes: { pax?: number; agent_id?: string })` → `ObSeatLock`. This needs a `patchJson` helper in `lib/api.ts`, which has only `getJson`/`postJson` today.
- `releaseSeatLock(id: string)` → `ObSeatLock`
- `ObTrip.lock_draws: Record<string, number>`
- `agents(active: boolean | 'all' = true)`: lets callers ask for every agent, inactive ones included

### Missing endpoints (hand-off to operation-backend)
These are drafts. The backend's `CLAUDE.md` puts endpoint design in that repo, so treat each one as a request, not a spec.

#### A. Range ("bulk") locks
- **Why:** legacy bulk locks hold N seats **per departure** over a date range, optionally only on some weekdays (`bkV2LockSpansDays`/`Range`/`DowOk`, `booking.js:25-45`). The importer drops them today.
- **Option 1 (recommended):** add no new table. `POST /v1/seat-locks/bulk` expands the range into one `seat_locks` row per open departure, sharing a `group_id`.
  - Response: `{ "group_id": "lkg_…", "seat_locks": [SeatLock, …], "skipped": [{ "service_date": "2026-10-07", "reason": "route closed" }] }`
  - Capacity check per day: reuse `assertLockFits`.
- **Option 2:** a real range lock (`date_from`, `date_to`, `dow int[]`) that `capacity.ts` expands per day. This fits the legacy model better but touches every availability read.
- **Tables:** `seat_locks.group_id TEXT NULL` (Option 1).

#### B. Sub-groups
- **Why:** legacy splits a parent lock into named children (A/B/C) that bookings draw from separately. The parent then holds only its unallocated remainder (`booking.js:139-153`, `522-545`).
- **Draft:** `seat_locks.parent_id TEXT NULL REFERENCES seat_locks`, `seat_locks.sub_name TEXT NULL`.
  - `POST /v1/seat-locks/:id/sub-groups` `{ "sub_name": "A", "pax": 5 }` → 201 SeatLock. Returns 409 if `pax` > the parent's `pax − Σ children.pax − parent drawn`.
- **Rule to keep:** only parents count toward `locked_pax` (`bkV2LockPoolHold`, `booking.js:152`).
- **Decide first:** whether sub-groups are still wanted. The importer folds them away today.

#### C. Release cutoff
- **Why:** seats go back to the pool automatically at `service_date − release_days_before`, at `release_time` (+07:00) (`bkV2LockReleaseCutoff`, `booking.js:65-76`).
- **Draft:** `seat_locks.release_days_before INT NULL`, `seat_locks.release_time TIME NULL`, plus a derived `release_at` timestamptz on responses.
  - `capacity.ts` ignores a lock whose `release_at` ≤ now. This is computed on read; no cron.
- **Unblocks:** the 48h KPI and the release column.

#### D. Notes and history
- **Why:** legacy keeps `reason`, `createdBy` and an event `log[]` (create, add, release, draw, return, reconcile) that the "ประวัติ" modal shows.
- **Draft:** `seat_locks.note TEXT NULL`, `seat_locks.created_by TEXT NULL`, and a `seat_lock_events(id, seat_lock_id, type, qty, note, by, at)` table written by POST/PATCH/release.
  - `GET /v1/seat-locks/:id/events` → `{ "events": [{ "type": "amend", "qty": 5, "note": "เอเจ้นขอเพิ่มโควตา", "by": "ops", "at": "…" }] }`.
  - `PATCH` accepts `note` for the event row.

#### E. Agent catalogue: **shipped** (`6afb049`, merged as `638c64b`)
- `GET /v1/agents`, `/v1/agents/:id` and `/v1/agents/:id/activity` (`operations.ts:349-356`). Nothing left to request.

#### F. Enforce the lock's agent on draws
- **Why:** legacy only lets a booking draw from locks held by **its own agent**, or from office/global locks (`bkV2LocksForAgent`, `booking.js:121-123`). The backend never reads `agent_id` when checking draws (`assertDayFits`, `capacity.ts:139-141` at `638c64b`; still open), so any booking can use any agent's reserved seats.
- **Draft:** in `assertDayFits`, reject a draw when `lock.agent_id` is set and differs from `booking.agent_id`. Return 400 "Seat lock X is held for agent Y".
- **Draw order to keep:** legacy auto-draws in this order: the agent's own lock → office → global (`booking.js:13086`). If office and global must stay distinct, add a `seat_locks.holder_type` column (`agent` | `office` | `global`) at the same time.

---

## 4. Store and component plan

### `useSeatLocksStore` (`apps/web/src/stores/seatLocks.ts`)
- **State:**
  - `locks: ObSeatLock[]`, `routes: ObRoute[]`
  - `status: 'idle'|'loading'|'ready'|'error'`, `error: string`
  - `filters: { q, routeId, agentId, status: 'active'|'all', groupBy: 'agent'|'route'|'none' }`, defaulting to `status:'active'`, `groupBy:'agent'` as in legacy
  - `dayOffset` (default 1 = tomorrow)
  - `claims: Record<lockId, Claim[]>`, a cache filled when a lock's detail opens
- **Stays in the component:** expanded-row ids, the open dialog and its draft form, because they don't need to survive navigation.
- **Getters:**
  - `held(lock)` replaces `bkV2LockHeldRemaining`
  - `isDepleted(lock)` replaces the `depleted` status
  - `filtered` replaces the filter block at `booking.js:759-773`, sorted by `service_date`, then route name
  - `groups` replaces `booking.js:870-901`
  - `dayView(date)` replaces `bkV2LocksOnDate` + `dQty`/`dUsed`/`dHeld` (`692-696`)
  - `kpis` replaces `booking.js:636-671`: active count, held tomorrow + 14-day spark, drawn + conversion. The 48h card is shown disabled until draft C lands.
- **Actions:**
  - `load()`: `Promise.all([ob.seatLocks(), ob.routes(), ob.agents('all')])`. Keep the agents in this store rather than in `useAgentsStore`; that store also loads markets, sales and rate types, which this page doesn't need.
  - `create(input)` → `ob.createSeatLock` → re-fetch `locks`
  - `addSeats(id, n)` → `ob.amendSeatLock(id, { pax: lock.pax + n })` → replace that lock in state with the response
  - `reduce(id, n)` → `ob.amendSeatLock(id, { pax: lock.pax − n })`; show the 409 message as returned
  - `release(id)` → `ob.releaseSeatLock` → replace the lock
  - `loadClaims(lock)` → `ob.bookingsBetween(lock.service_date, lock.service_date)`, keeping trips whose `lock_draws[lock.id] > 0`
  - After every write, also clear `availability` if a shared availability store exists later; `ByTripView` currently re-fetches on date change.
- **Pure helpers** (`features/seat-locks/model.ts`, unit-tested): `held`, `filterLocks`, `groupLocks`, `sparkline`, `claimsFor`.

### Components (`apps/web/src/features/seat-locks/`)
- `SeatLocksView.vue`: the page. Renders `BookingTabs` with `active="locks"`, then the header, KPIs, day table, filters and main table.
- `LockKpis.vue`, `LockDayTable.vue`, `LockFilters.vue`, `LockTable.vue` (group headers + rows)
- `LockCreateDialog.vue`: day scope only in phase 1. The bulk option is shown disabled with the tooltip "Coming in phase 2".
- `LockSeatsDialog.vue`: one dialog for "+ ที่นั่ง" and "คืน N", with a stepper. "Release all" calls `release(id)`.
- `LockDetailDialog.vue`: replaces the "ประวัติ" manage modal. Shows held/used/total, claims (voucher chips linking to `/bookings/:id`) and coverage. Sub-groups and history are hidden until drafts B and D land.
- `apps/web/src/components/LaDialog.vue`: a shared dialog. It needs focus trap, Esc to close and backdrop click; the legacy modals have none of these.
- **Route:** `{ path: "/bookings/locks", name: "booking-locks", component: () => import("@/features/seat-locks/SeatLocksView.vue") }` in `apps/web/src/router.ts`.
- **Wiring:**
  - `BookingTabs.vue`: remove "Seat Locks" from `LEGACY_TABS` and add a `RouterLink`. Widen the `active` prop to `'bytrip' | 'all' | 'locks'`.
  - `ByTripView.vue:293`: enable "All →" as a link to `/bookings/locks`.
- **Phase 2**, after backend drafts A–D and F land: bulk locks, sub-groups, release cutoff (and its 48h KPI card), and notes/history. Agent names have moved to phase 1. Office/global holders map to an empty `agent_id` until then.
- **Dropped entirely:** the sweep banner and modal, and "fix counters". The backend derives `drawn_pax`, so there is nothing to reconcile.
- **Permissions:** hide create and the row actions unless `session.me.canEdit` and (`editAreas` is null or includes `'operations'`). This mirrors `laCanEditArea` (`08-app.js:1163`) without the legacy silent no-op.
- **Tests:**
  - `features/seat-locks/model.spec.ts`: held, filter, group, sparkline.
  - `SeatLocksView.spec.ts`: `fetch` stubbed like `ByTripView.spec.ts`. Covers that it renders the grouped rows; that add seats sends `PATCH` with `pax + n`; that a 409 shows the backend message; that release posts to `/release`; and that read-only users see no action buttons.

---

## 5. Decisions
- **2026-09-24: phase 1 writes to operation-backend.** Create, amend (add seats / reduce) and release go through `/v1/seat-locks`. Consequence: locks created in legacy (`sb_seat_locks`) and in phase 1 live in different databases. Bulk locks and sub-groups made in legacy do **not** reduce availability in operation-backend, so "link to legacy" is not a safe fallback for them (see open question 1).
- **2026-09-24: shared BEM blocks go global first.** `.btn`, `.chip`, `.seg`, `.field`, `.dialog`, `.callout` and `.meter` go in `apps/web/src/styles/components.css`, imported once in `main.ts`. Each block starts with a comment listing where it is used, for example:
  ```css
  /* .chip: status / scope / count badges.
     Used by: features/seat-locks/LockTable.vue, features/seat-locks/LockDayTable.vue */
  ```
  Update the list whenever a component starts or stops using the block. Feature-only classes (`.lock-*`) stay in each component's `<style scoped>`.

- **2026-09-24: every feature the backend can't store is handed to the backend team.** This covers bulk locks (A), sub-groups (B, confirmed in use), release cutoff (C), notes/history (D), agent names (E, shipped 2026-09-26) and enforcing the lock's agent on draws (F). None of them is dropped. They come to the Vue page in phase 2.
  - **Phase 1** is day-scope locks held by an agent or by no one (office/global → empty `agent_id`). It covers list, create, add seats, reduce, release, claims/coverage, and agent names and colours.

## 6. Open questions
1. **What staff do between phase 1 and phase 2.** Until drafts A and B land, a bulk lock or sub-group can only be made in legacy, and it won't reduce availability in operation-backend. Options:
   - hold phase 1 until A and B land, or
   - ship phase 1 and accept the gap, or
   - have ops create day locks by hand for the next few weeks instead of bulk locks.
2. **Do bulk locks survive a save/load in legacy?** Verify locally, without prod:
   1. Run `npm run dev:local` (throwaway Docker Postgres + `server.js`).
   2. Create a bulk lock in the Seat Locks tab.
   3. Reload the page.

   If `dateFrom`/`dateTo`/`dow` come back empty, the missing columns are confirmed as a legacy bug. How often ops use bulk locks and sub-groups is a question for ops, not the database.
3. **Land/marine split.** The City Tour page shows only land-route locks (`booking.js:633`), but `ObRoute` has nothing that marks a land route. Is a route flag needed, or can phase 1 show all routes?
4. **Dark-mode values** in the tokens table are first proposals and need a visual pass.
