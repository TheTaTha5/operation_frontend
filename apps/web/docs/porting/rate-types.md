# Porting spec: Rate Types (`data-view="rate-types"`)

- **Legacy entry point:** `renderRateTypes()` (`allotment_v2/js/08-app.js:6152-6168`), dispatched from `allotment_v2/js/04-data-core.js:702`. Markup: `#view-rate-types` (`allotment_v2/allotment_v2.html:791-846`).
- **Helpers in scope** (`allotment_v2/js/rates.js` unless noted):
  - List: `rtRenderList` (`691-765`), `rtSelectCard` (`467`)
  - Detail: `rtRenderDetail` (`1506-1587`) and `rtBuildDetailBody` (`1319`), which the Agent › Pricing Matrix tab shares (`agents.js:2902`)
  - Agents column: `rtRenderAgentColumn` (`519-594`)
  - Agent picker: `rtOpenAgentPicker` … `rtAgentPickerApply` (`1589-1640`)
  - Editor: `rtOpenNew` / `rtOpenEdit` / `rtClone` (`1809-1857`), `rtModalRender` (`2168-2486`), `rtSaveDraft` (`2488-2519`), `rtDeleteRT` (`2521`)
  - Banners: `rtDupCodeBanner` / `rtDupCodeFix` (`61`, `98-122`), `rtExpBanner` (`343`)
  - Add-on types: `rtAddonTypesOpen` / `Create` / `Delete` (`1248-1317`); definitions in `RT_ADDON_BUILTIN` (`08-app.js:6170-6190`) + `SB_ADDON_TYPES`
  - Persistence: `rtPersist` (`2537-2550`)
- **Not in this screen but priced from it:** the booking pricing engine (`allotment_v2/js/booking.js:13177-13410`, §1 "Pricing engine"). The sibling **Rate Expiry** screen (`data-view="rate-admin"`, `renderRateAdmin` `08-app.js:6118`) is summarised in §1 and planned for phase 3.
- **Already ported:**
  - `apps/web/src/lib/ob.ts` has `ObRateTypeSummary` and `ob.rateTypes()` (`GET /v1/rate-types`), used by the agents page for binding labels, coverage and expiry alerts (`features/agents/agentRules.ts`).
  - Nothing else.
- **Backend checked at:** `operation-backend@6afb049` ("read-only agents, markets and salespeople"; clean working copy). **There are no rate types, prices, add-ons or pricing code.**
- **Date:** 2026-09-26

---

## 1. Functionality

### Purpose
Sales keeps price lists ("rate types") here. Each one holds:
- seat prices per route, pickup zone, age and nationality
- charter prices per route and boat type
- add-on prices
- a travel validity window per route

An agent is bound to one rate type (optionally switching rate by travel date through seasons), and that rate prices every booking the agent makes.

### Inputs
| Source | What is read | Where |
|---|---|---|
| `SB_RATE_TYPES` | `id, code, name, note, color, createdDate, owner ('' = shared), validFrom, validTo, active, nationalityScope ('both'\|'thai'\|'fr'), routes[], seatRates{route:{zone:{'adult-thai','child-thai','adult-fr','child-fr','infant-thai','infant-fr'} \| null}}, priceTiers{route:{zone:{pax:{sell,minSell}}}}, routeValidity{route:{from,to}}, routeBundles{route:{longtail:{mode,adult,child,applyTo}}}, charterRates{route:{boatType:{starterPrice,starterIncludes,extraPerPax}}}, addOns{longtail:{applies,byRoute{route:{join{adult,child},charter{price,capacity}}}}, privateTransfer:{unit, route:{PK\|KL:{sedan,van}}}, custom:{applies, adult, child} \| {applies, price}}` | declared `08-app.js:564`, restored `_rtRestore` `08-app.js:6224-6287` |
| Zones per route | `PK`, `KL`, `NoTransfer`; Ranong routes use `RN` + `NoTransfer` | `rtZonesForRoute` `rates.js:10-16` |
| `SB_AGENTS` | `rateTypeId` (binding), `rateSeasons`, and for the column/picker: `name, code, sub, market, sales, programs, creditLimit, creditDays, payType` | `rates.js:21`, `519-594`, `1654-1715` |
| `ROUTES` | `id, name, pier, extId` (B2C routes hidden from new selection) | `rates.js:2187-2192` |
| `SB_SALES` | owner labels, admin owner select | `rates.js:647-650`, `1568` |
| `SB_CONTRACTS` | next rate for expiry (`rtExpNextOf` `133-140`); promotions (pricing engine) | — |
| `SB_ADDON_TYPES` | custom add-on registry `{key, label{en,th}, model 'perPax'\|'flat', unit}` | `08-app.js:6194-6196` |
| Session | `laCanEditArea('sales')` in `rtPersist` (`2538`); `laGuardEdit('sales')` only on dup-fix, bulk seasons, `rtmSave`; `laIsAdmin()` for the owner (`685`). Sales scoping: `_rtInScope` (`683`) shows own + shared rates; `rtScopeList` / `rtForSales` (`663-681`) feed the agent editors | `01-auth-sync.js:981, 991, 1057-1063` |

### Outputs

#### Rendered sections
1. **Header:** title, Detail / Agents view toggle, "ชนิด Add-on" (add-on types), "New Rate Type" (`allotment_v2.html:792-813`).
2. **Duplicate-code banner:**
   - Agent import binds by code, so duplicates bind the wrong rate (`rates.js:22-34`).
   - One-click fix: the rate with the most agents keeps the code; the others are re-coded (`98-122`).
3. **Expiry banner:** rates ending within 60 days with agents but no season to take over. It links to Rate Expiry (`343-361`).
4. **List** (`691-765`):
   - Search by name, code or note.
   - Sort: active first, then by validity rank (Active < Expiring < Always < Upcoming < Expired), then name.
   - Grouping: sales-scoped users see Active/Inactive; admins see groups by owner with "Shared · กลาง" last.
   - Row: code dot, name, "code · N routes · N agents", validity chip.
5. **Detail** (`1506-1587`):
   - Header: code, name, Inactive badge; Activate/Deactivate, Edit, Clone, Manage agents.
   - Chips: validity, owner, and counts of seat routes / charter / add-ons.
   - Bound agents (collapsed), then the body (`rtBuildDetailBody`):
     - **§1 Seat rates:** route × zone rows, adult/child per nationality scope, route Start/End, longtail bundle notes.
     - **§2 Charter rates:** route, vessel, starter price, pax included, price per extra pax.
     - **§3 Add-on services.**
6. **Agents column** (Agents mode, `519-594`): market filter pills, agent cards (click → the agent page, ✕ → unbind), and Agents / Programs / Credit Σ tiles.
7. **Editor modal** (`2168-2486`):
   - Basic info: name, colour, note, valid from/to, active.
   - Routes.
   - Nationality scope.
   - Seat grid with a tier switch (Net / Selling / Min sell), "Copy from…", "Copy from Net", Offer / N/A per zone, route validity, longtail bundle.
   - Charter rows.
   - Add-ons.
   - Footer: summary, Delete, Cancel, Save.
8. **Agent picker** (`1589-1640`): tick agents to bind or untick to unbind. A move from another rate is flagged "⚠ moves from CODE".
9. **Add-on types modal** (`1248-1317`): create or delete custom add-on kinds.

#### Handlers
Every write ends in `rtPersist()` (`rates.js:2537`). It read-modify-writes the blob with `sb_rate_types`, `sb_agents_rate_bindings` and **all of `sb_agents`**, then syncs with the debounced `/api/save`.

| Trigger | Calls | Effect | Writes? |
|---|---|---|---|
| Search input | `rtRenderList` | filter | no |
| Row | `rtSelectCard` (`467`) | select | no |
| Detail / Agents toggle | `rtSetViewMode` (`481`) | 2 or 3 columns | no |
| Activate / Deactivate | `rtToggleActive` (`617`) | flips `active`; no guard, no confirm | yes |
| Owner select (admin) | `rtSetOwner` (`684`) | `owner` | yes |
| Unbind ✕ | `rtUnbindAgent` (`1763`) | confirm, then `agent.rateTypeId = null`; no guard | yes: agent |
| Manage agents → Apply | `rtAgentPickerApply` (`1621`) | bind the ticked agents in scope, unbind the unticked; skips `agLog`, contract sync and programme sync, unlike the agent editor (`agents.js:2107-2115`) | yes: agents |
| New / Edit / Clone | `rtOpenNew` / `rtOpenEdit` / `rtClone` (`1809-1857`) | draft | no |
| Editor inputs | `rtDraftSet`, `rtDraftToggleRoute`, `rtToggleZoneNotOffered`, `rtSetTier`, `rtCopyNetToTier`, `rtCopyFromRT`, `rtToggleBundleLongtail`, `rtAddCharterRow`, `rtToggleAddOn`, `rtAddTransferRoute`, … (`1775-2134`) | draft only | no |
| Save | `rtSaveDraft` (`2488`) | validate (name; `validFrom ≤ validTo`); drop prices of removed routes; a new rate gets an id and an auto code (`_rtAutoCode` `645-654`, SALES-NAME[-n]) | yes |
| Delete | `rtDeleteRT` (`2521`) | confirm with agent count; unbind agents; remove. Seasons, contracts and `bookings.rateTypeRef` are left dangling | yes |
| Dup-code fix | `rtDupCodeFix` (`98`) | re-codes duplicates | yes |
| Add-on type create / delete | `rtAddonTypeCreate` / `Delete` (`1297-1317`) | registry; prices in rates are kept but hidden | yes: `sb_addon_types` (never reaches Postgres) |

### State
| State | Kind | Held in | Survives navigation? |
|---|---|---|---|
| selected rate | UI | `_rtSelected` (`08-app.js:6086`) | yes → route `/rate-types/:id` |
| search | UI | DOM input | yes → `?q=` |
| view mode | UI | `_rtViewMode` (`6087`), resets on reload | yes → `?view=agents` |
| agents-column market filter | UI | `_rtAgentMktFilter` (`6088`) | component |
| editor draft, tier, "is new" | UI draft | `_rtDraft`, `_rtTier` (never reset between openings), `_rtDraftIsNew` | component |
| picker selection and search | UI draft | `_rtAgentPicker*` (`6201-6204`) | component |
| rate types, add-on types, bindings | domain | globals | backend |

### Pricing engine (legacy `booking.js`, what the backend must take over)
1. **Base rate:** `booking.rateTypeRef = agent.rateTypeId` when the agent is picked (`booking.js:11342`, `12248`). It is required unless the price is manual (`12544`). There is no `active` check (`bkV2GetRT` `13177-13180`).
2. **Rate per trip** (`bkV2GetRTForTrip` `13201-13220`):
   1. **Season:** the latest agent season covering the travel date (`laSeasonAt` `08-app.js:8467-8485`), else the base rate.
   2. **Promotion:** the highest-priority active promo contract covering the route, travel date and (if `bookWin`) booking date, with a price for the route (`laPromoFor` `8583-8595`). It resolves by `priceMode`:
      - `rate`: the promo's rate type
      - `own`: the promo's own seat prices over the season rate
      - `discount`: % or amount off the main rate; zeros stay zero (`laPromoRate` `8603-8683`)
3. **Seat trip subtotal** (`bkV2TripSubtotal` `13223-13290`):
   - `seatRates[route][zone]` missing or null → **no rate** (Save blocked unless the price is manual). Both adult prices 0 → no rate.
   - `adult-fr × (ad_fr + unsuffixed ad) + child-fr × (chd_fr + chd) + adult-thai × ad_th + child-thai × chd_th`, plus a paid longtail bundle (`adult × all adults + child × all children`).
   - **Infants and FOC are never charged.** The overnight return leg is 0.
4. **Charter trip:**
   - `starterPrice + max(0, all pax (infant + FOC included) − starterIncludes) × extraPerPax` + a paid bundle when `applyTo` is charter or both.
   - The row is picked by the boat's type. A missing row is an error.
   - A manual charter price overrides it.
5. **Add-ons** (`bkV2AddOnInfo` `13317-13355`), priced from the **base** rate (not the season or promo rate):
   - **longtail join:** per adult/child per applied trip
   - **longtail charter:** per boat
   - **private transfer:** `privateTransfer[route][zone][sedan|van] × qty`
   - **Custom add-on types are never priced in bookings.**
6. **Quote** (`bkV2CalcQuote` `13356-13410`):
   - `seat + add-ons − discount (% or amount, rounded) + extra + overnight charge`, floored at 0.
   - FOC discount is informational.
   - Manual mode: `max(0, manualTotal)`.
   - VAT is applied at invoicing, from `agent.vatMode` (`accounting.js:44-47`), not here.
7. **Stored on the booking:**
   - `rateTypeRef, priceMode, manualTotal, total, priceBreakdown{seat, addOn, focDiscount(−), discount(−), extra}`
   - per trip: `subtotal, promoId, rtRef` (no column)
   - add-on lines with amounts (`bkV2CommitBooking` `12748-12873`)
8. **Editing an old booking re-prices it** at today's rates (`bkV2EditBooking` `13991-14020`, fresh `bkV2CalcQuote`). Only B2C bookings are frozen (`13003-13008`). The UI promise "ใบที่ขายไปแล้วล็อกราคาเดิม" (`agents.js:3421`) holds only until someone edits.

### Legacy server side
- **No rate-type logic on the server.** Writes go through the generic `/api/save` / `/api/v1/_batch` (`server.js:1812-1846`, `2759-2800`). Only `shrinkGuard` runs: no checks on routes, zones, negative prices, duplicate codes or date order.
- **Tables:**
  - `sb_rate_types`: scalars, with `pricetiers` as JSON
  - `__routes`
  - `__seatrates`: wide, 18 bigint columns `{pk|kl|notransfer}_{adult|child|infant}_{thai|fr}`, plus a stray `kl` JSON column that overwrites KL on read
  - `__charterrates`: speedboat / catamaran columns only
  - `__addons` with grandchildren `__addons__applies`, `__addons__byroute`, and **one hard-coded table per route** `__addons__r4, r5, r6, r10, r11, r12` for private transfer
  - `__routevalidity`, `__routebundles`
  - `sb_agents_rate_bindings` (`id, ratetypeid`), with no FK to rate types
  - Model: `data-model/tables/sb_rate_types.js`; DDL `db/baseline/operation_schemas_20260820.sql:2040-2266`
- **Edited on screen but never saved to Postgres:**
  - `seatRates[route].RN` (Ranong zone; there are no `rn_*` columns, and `b2c-catalog.js:103-109` refuses RN for that reason)
  - charter rows for boat type `longtail`
  - private-transfer prices on routes other than r4/r5/r6/r10/r11/r12
  - the flat `price` of custom add-ons
  - `routeBundles[].longtail.applyTo` (falls back to 'seat')
  - the whole `sb_addon_types` registry
  - agents' `rateSeasons`
  - `trips[].rtRef`
- **Other data issues:**
  - "Not offered" (`null`) zones read back as missing.
  - Bigint columns round decimals.
  - Grandchild add-on rows have no FK and are orphaned on per-record saves.
- **B2C endpoints (API key):**
  - `GET /api/b2c/availability` returns the raw seat prices of **every active** rate type for the route. It ignores validity, tiers, nationality scope, bindings, seasons and add-ons (`server.js:3266-3455`).
  - `GET /api/b2c/rate-types` (`b2c-catalog.js:408`).
  - `GET/POST /api/b2c/routes`: POST validates zones (PK/KL/NoTransfer), pax keys, prices ≥ 0 and validity dates, then patches `seatRates[route]` and `routeValidity[route]` (`b2c-catalog.js:243-294`, `416-477`).
- **No views, functions or triggers.** Migration 029 adds the promo pricing columns on `sb_contracts` (`pricemode, rates, discount, bonus, bookwin`).

### Domain rules that must survive the port
- **Only the Net tier bills.** Selling and Min sell are printed in contracts only (`rates.js:2440-2442`).
- **Validity dates do not stop pricing.** `validFrom/validTo` and `routeValidity` never gate the price (`08-app.js:6090-6097`). Route validity feeds agent programme travel dates and contracts.
- **Zones:** `PK, KL, NoTransfer`, plus `RN` on Ranong routes (root CLAUDE.md, *Rates and agents*: "Zones are PK, KL, NoTransfer"; RN is the Ranong case).
- **Pax:**
  - Legacy `ad`/`chd` with no residency price as foreigner (`booking.js:13277-13279`).
  - This matches the backend's `unknown` residency (`operation-backend/src/domain/pax.ts:14,22`).
  - Infants and FOC are free on seats but count toward a charter's extra pax.
- **Longtail pricing is per route** (root CLAUDE.md: read via `_rtLongtailForRoute`, `rates.js:2098`). A paid bundle adds to seat (and charter) prices, and locks the separate longtail-join add-on.
- **Add-on types:** `RT_ADDON_DEFS = RT_ADDON_BUILTIN + SB_ADDON_TYPES` (root CLAUDE.md; `rtRebuildAddonDefs` `rates.js:1245`).
- **Code:** generated on create/clone only and never editable. The id is what prices; the code is what import matches.
- **Sales scope:** a salesperson sees their own and shared rates. Only an admin sets the owner.
- **Dates:** build them locally. Legacy's `createdDate` (`toISOString().slice(0,10)`, `rates.js:1838`) and `_rtValidityStatus` (`602-615`) are off by the UTC shift.

### Edge cases
- **Empty states:**
  - "ยังไม่มี Rate Type" (`760`)
  - "เลือก Rate Type จากเมนูด้านซ้าย…"
  - "ยังไม่มี seat rate" (`1463`)
  - no charter / add-ons (`1494`, `1501`)
  - "ยังไม่มี agent ผูกกับ rate type นี้" (`573`)
- **The detail and copy-to-tier show PK/KL/NoTransfer only,** so RN prices are invisible there (`1330`, `1781`).
- **Legacy bugs to fix, not copy:**
  - no guards on activate, unbind, bind, save and delete (view-only edits vanish on reload)
  - binding from here skips the agent log, contract sync and programme sync
  - delete leaves dangling references
  - `nationalityScope` does not restrict pricing
  - add-ons are priced from the base rate
  - old bookings re-price on edit
  - names are inserted into HTML unescaped (`733-736`, `2397`)
  - the Rate Expiry row click renders into a hidden pane (`388`)
  - `_rtBackfillOwners` writes data just by opening the page (`637-644`)
  - whole-modal re-renders reset the scroll (root CLAUDE.md warns about this)
- **Rate Expiry (sibling):**
  - It lists active rates ending within 60 days whose in-scope agents have no season taking over, plus the "จองไม่ได้" routes (agent programmes with no seat price) (`rtExpRowFor` `149-169`).
  - Bulk "ตั้งตารางฤดูกาล" writes two seasons per agent (old rate until the split, next rate after) (`rtExpBulkPlan` `208-238`).
  - It has no nav permission entry, so every user can open it (`01-auth-sync.js:1065`).

---

## 2. Style

### Legacy rules found
| Selector group | File:line | Notes (winning source) |
|---|---|---|
| tokens `--fd-*` | `01-base.css:1419-1432`, overridden by `02-skins.css:172-176` | "coral" renders ocean blue `#1683C7`, soft `#E1F0FA` |
| layout `#view-rate-types .sb-wrap / .sb-side / .sb-main`, `.three-col` | `01-base.css:1711-1712`, `1735-1743` | grid `400px 1fr`, three-col `280px 1fr 340px`; the side is sticky at a hard-coded `top:14px` |
| list `.sb-az-hd`, `.sb-rt-row(.sel/.inactive)`, `.sb-rt-dot`, `.sb-rt-valid`, `.sb-rt-vchip` | `1719-1734` | the group header leaks a pink gradient and sticky from `01-base.css:1213`; `.sel` keeps a hard-coded coral border |
| agents column `.sb-third*`, `.rt-ag-*`, `.rt-mkt-pill(s)`, `.rt-agg-*` | `1740-1762` | ✕ turns red on hover |
| phone | `02-skins.css:705-706, 783, 787, 838-839, 887-889` (`!important`) | single column at ≤820 px, the side not sticky |

- **About 94 % of `rates.js` markup is inline style** (582 `style="` against 35 `class="`). The detail body, editor, picker, add-on templates and expiry panel have no classes at all.
- **Dead rules:** `#view-rate-types .num`, `.rt-ag-card.sel`, `.mono` (no rule anywhere), `02-skins.css:705` (a no-op on a grid) and `838-839` (duplicates).
- **No JS-injected style**, and nothing in `03-trippl.css`.

### Class mapping
New port, so BEM. The page follows the agents page's list + detail pattern, so the shape is reused, not the legacy classes.

| Legacy | BEM | Notes |
|---|---|---|
| `.sb-wrap`, `.three-col` | `.rate-page`, `.rate-page--agents` | same grid idea as `.agent-page` |
| `.sb-side`, `#rt-search`, `#rt-list-count` | `.rate-page__side`, `.rate-list__search`, `.rate-list__count` | |
| `.sb-az-hd` | `.rate-list__group` | no pink gradient |
| `.sb-rt-row(.sel/.inactive)`, `.sb-rt-dot`, `.rt-name`, `.sb-rt-valid` | `.rate-row`, `--selected`, `--inactive`, `__dot`, `__name`, `__meta` | |
| `.sb-rt-vchip` | global `.chip` + `--ok/--warn/--danger/--info` | validity |
| detail header (inline) | `.rate-detail__head`, `__title`, `__actions` | |
| seat table (inline) | `.rate-prices`, `__route`, `__zone`, `__cell`, `__cell--na`, `__foot` | |
| charter table (inline) | `.rate-charter`, `__row` | |
| add-on sections (inline) | `.rate-addons`, `__section`, `__row` | |
| `.sb-third*`, `.rt-ag-*`, `.rt-agg-*`, `.rt-mkt-pill` | `.rate-agents`, `__card`, `__tiles`, `__tile`; pills → `.chip` toggles | |
| dup / expiry banners (inline) | global `.callout--warn` | |
| editor modal (inline) | global `.dialog` + `.field` (phase 2) | |

### Tokens
Nothing new. The status tokens (`--danger/--warn/--info/--ok` + `-bg/-line`) and `--surface-2` exist since the agents port (`apps/web/src/styles.css`).

| Legacy value | Token |
|---|---|
| coral-as-blue `#1683C7`, soft `#E1F0FA` (selection) | `--info`, `--info-bg`, `--info-line` (as `.agent-row--selected`) |
| validity chip green / amber / red / blue | `.chip--ok / --warn / --danger / --info` |
| `RT_COLORS` swatches (`08-app.js:6220`) | data: the rate's own `color` |
| N/A cell `#f1efe8`, grey text | `--surface-2`, `--muted` |

### Style block plan
- **`components.css` additions:**
  - `.callout--info` and `.callout--ok` (the dup-code and expiry banners need info). Add `features/rate-types/*` to the `.callout` comment.
  - Add `features/rate-types/*` to the `.chip` comment.
  - Phase 2 adds `.dialog`, `.field`, `.btn`, `.seg` (Net / Selling / Min sell tier switch) with their own comments. The agents phase 2 needs the same blocks, so whichever port comes first creates them.
- **Scoped blocks:** `rate-page`, `rate-list`, `rate-row`, `rate-detail`, `rate-prices`, `rate-charter`, `rate-addons`, `rate-agents`.
- **Sticky side:** `top: calc(var(--topbar) + 12px)`, as on the agents page. The legacy hard-coded `top:14px` is not copied.
- **Phone:**
  - ≤900 px: list and detail are separate screens.
  - The seat table scrolls sideways inside its card.
  - The agents column drops under the detail.

---

## 3. Data model

Backend checked at `operation-backend@6afb049`. Relevant existing pieces:
- `bookings.rate_type_ref` (free text, `002:5`; set on POST only, **PATCH cannot change it**, `routes/operations.ts:130`, `166-182`)
- the price columns on `bookings` (`011:69-78`), stored as sent, never computed or checked
- the pax grid `ad|chd|inf|foc × unknown|foreign|thai` (`src/domain/pax.ts:11-25`)
- trip `zone` (free text, `015:20`)
- `agents.rate_type_id` (no FK "until the Rate Types port", `017:66-67`)
- `sales_people` (`017:34-44`)
- `todo/agents.md:16` lists `GET /v1/rate-types` as "Later"
- next migration: **018**

| Legacy field / action | Backend endpoint + field | In `ob.ts`? | Status |
|---|---|---|---|
| rate list (summary: code, name, color, active, owner, valid dates, priced routes, route validity, agent count) | `GET /v1/rate-types` | yes (`ObRateTypeSummary`, used by agents) | missing |
| full rate (routes, seat prices incl. RN and tiers, not-offered zones, route validity, bundles, charter, add-ons) | `GET /v1/rate-types/:id` | no | missing |
| bound agents | `GET /v1/agents?rate_type_id=` | partly (`ob.agents()` has no param) | missing: filter on the existing endpoint |
| validity status, sort rank, grouping, zones per route | — | — | derivable: `_rtValidityStatus` (`rates.js:602-615`, with local dates), list sort (`703-714`), `rtZonesForRoute` (`10-16`) |
| duplicate codes | — | — | goes away: `code` becomes `UNIQUE` |
| expiry rows | — | — | derivable from rates + agents (+ seasons), `rtExpRowFor` (`149-169`) |
| create / edit / clone | `POST /v1/rate-types`, `PATCH /v1/rate-types/:id`, `POST /v1/rate-types/:id/clone` | no | missing |
| route prices | `PUT /v1/rate-types/:id/routes/:route_id` | no | missing |
| activate / deactivate | `PATCH … {active}` | no | missing |
| delete | `DELETE /v1/rate-types/:id` (409 `in_use` when agents, seasons, contracts or bookings reference it) | no | missing |
| bind / unbind agents | `POST /v1/rate-types/:id/agents {add:[], remove:[]}` | no | missing |
| owner | `PATCH … {owner_sales_id}` (admin) | no | missing |
| add-on types | `GET/POST/DELETE /v1/addon-types` | no | missing |
| agent seasons | `PUT /v1/agents/:id/rate-seasons` (agents spec §3; not in migration 017) | no | missing |
| booking price | `POST /v1/quote` (server-side pricing engine) | no | missing |
| B2C `/api/b2c/availability`, `rate-types`, `routes` | move to operation-backend (Q7) | — | missing |

### `ob.ts` additions
- `ob.rateType(id)` → `ObRateType`
- `ob.agents({ rate_type_id })`: an optional query on the existing method
- Phase 2:
  - `ob.createRateType`, `ob.patchRateType`, `ob.putRateRoute`, `ob.cloneRateType`, `ob.deleteRateType`, `ob.bindAgents`
  - `ob.addonTypes`, `ob.createAddonType`, `ob.deleteAddonType`
  - these need the `patchJson` / `putJson` / `deleteJson` helpers and the `ApiError.code` change planned in `van-mode.md` §4a.4
- Booking port: `ob.quote(draft)` → `ObQuote`

### Missing endpoints (hand-off to operation-backend)

#### Tables (migration 018)
A long format, so a new zone (RN), pax type, boat type or route is data, not a new column. This fixes every silent loss listed in §1.

```sql
CREATE TABLE rate_types (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, note TEXT, color TEXT,
  owner_sales_id TEXT REFERENCES sales_people(id),          -- NULL = shared
  valid_from DATE, valid_to DATE, CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to),
  active BOOLEAN NOT NULL DEFAULT true,
  nationality_scope TEXT NOT NULL DEFAULT 'both' CHECK (nationality_scope IN ('both','thai','foreign')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- Routes the rate covers, with the per-route travel window and the longtail bundle.
CREATE TABLE rate_type_routes (
  rate_type_id TEXT REFERENCES rate_types(id) ON DELETE CASCADE, route_id TEXT REFERENCES routes(id),
  travel_from DATE, travel_to DATE,
  bundle_longtail TEXT CHECK (bundle_longtail IN ('free','paid')),      -- NULL = no bundle
  bundle_adult NUMERIC(12,2), bundle_child NUMERIC(12,2),
  bundle_applies_to TEXT CHECK (bundle_applies_to IN ('seat','charter','both')),
  PRIMARY KEY (rate_type_id, route_id));

-- A zone the rate offers on a route. No row = not set; offered = false = explicitly "not offered".
CREATE TABLE rate_type_zones (
  rate_type_id TEXT, route_id TEXT, zone TEXT NOT NULL,                  -- 'PK' | 'KL' | 'NoTransfer' | 'RN' | …
  offered BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (rate_type_id, route_id, zone),
  FOREIGN KEY (rate_type_id, route_id) REFERENCES rate_type_routes ON DELETE CASCADE);

-- One price per cell. Categories and residencies are the booking pax keys (src/domain/pax.ts).
CREATE TABLE rate_type_seat_prices (
  rate_type_id TEXT, route_id TEXT, zone TEXT,
  category TEXT NOT NULL CHECK (category IN ('ad','chd','inf')),
  residency TEXT NOT NULL CHECK (residency IN ('thai','foreign')),
  tier TEXT NOT NULL DEFAULT 'net' CHECK (tier IN ('net','sell','min_sell')),   -- only 'net' bills
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  PRIMARY KEY (rate_type_id, route_id, zone, category, residency, tier),
  FOREIGN KEY (rate_type_id, route_id, zone) REFERENCES rate_type_zones ON DELETE CASCADE);

CREATE TABLE rate_type_charter_prices (
  rate_type_id TEXT, route_id TEXT, boat_type TEXT NOT NULL,             -- 'speedboat' | 'catamaran' | 'longtail' | …
  starter_price NUMERIC(12,2) NOT NULL CHECK (starter_price >= 0),
  starter_includes INTEGER NOT NULL DEFAULT 1 CHECK (starter_includes BETWEEN 1 AND 50),
  extra_per_pax NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (extra_per_pax >= 0),
  PRIMARY KEY (rate_type_id, route_id, boat_type),
  FOREIGN KEY (rate_type_id, route_id) REFERENCES rate_type_routes ON DELETE CASCADE);

-- Add-on kinds: the two built-ins plus custom ones (legacy SB_ADDON_TYPES, never persisted before).
CREATE TABLE addon_types (
  key TEXT PRIMARY KEY, label_en TEXT NOT NULL, label_th TEXT,
  model TEXT NOT NULL CHECK (model IN ('longtail','private_transfer','per_pax','flat')),
  unit TEXT, builtin BOOLEAN NOT NULL DEFAULT false, active BOOLEAN NOT NULL DEFAULT true);

-- Add-on prices. `item` names the price inside the add-on:
--   longtail: 'join_adult' | 'join_child' | 'charter' (+ capacity)
--   private_transfer: 'sedan' | 'van' (per zone)
--   per_pax: 'adult' | 'child';  flat: 'price'
CREATE TABLE rate_type_addon_prices (
  rate_type_id TEXT REFERENCES rate_types(id) ON DELETE CASCADE,
  addon_key TEXT REFERENCES addon_types(key),
  route_id TEXT REFERENCES routes(id),          -- every add-on is priced per route (longtail/transfer already are)
  zone TEXT NOT NULL DEFAULT '',                -- private transfer only; '' otherwise
  item TEXT NOT NULL, price NUMERIC(12,2) NOT NULL CHECK (price >= 0), capacity INTEGER,
  PRIMARY KEY (rate_type_id, addon_key, route_id, zone, item));
```

**After import:**
- `agents.rate_type_id` gets `REFERENCES rate_types(id)`.
- `bookings.rate_type_ref` stays text, since it is a historical snapshot (a deleted rate must not break old bookings).

#### `GET /v1/rate-types?active=&owner=&q=`
```json
{ "rate_types": [ { "id": "rt003", "code": "NOK-STD", "name": "Standard 2026", "color": "#1683C7", "active": true,
  "owner": "s1", "valid_from": "2026-01-01", "valid_to": "2026-10-31", "nationality_scope": "both",
  "priced_routes": ["r5", "r6"], "route_validity": { "r5": { "from": "2025-11-01", "to": "2026-04-30" } },
  "agent_count": 14 } ] }
```
- This is the shape the agents page already reads (`ObRateTypeSummary`), plus `nationality_scope` and `agent_count`. **Ship it first:** the agents page needs it today.
- `priced_routes` = routes with at least one offered zone whose Net adult price is > 0. That is legacy's "priced" (`agRtRoutes`, `agents.js:2269`) combined with the no-rate rule (`booking.js:13223-13290`).
- **Sales scope:** own + shared for a salesperson (`_rtInScope`, `rates.js:683`); the token needs the salesperson id (agents spec Q2).

#### `GET /v1/rate-types/:id`
The summary plus:
```json
{ "routes": [ { "route_id": "r5", "travel_from": "2025-11-01", "travel_to": "2026-04-30",
    "bundle": { "longtail": "paid", "adult": 300, "child": 200, "applies_to": "seat" },
    "zones": [ { "zone": "PK", "offered": true,
      "net":  { "ad_foreign": 2900, "chd_foreign": 1900, "ad_thai": 1900, "chd_thai": 1200, "inf_foreign": 0, "inf_thai": 0 },
      "sell": { "ad_foreign": 3400 }, "min_sell": {} },
      { "zone": "KL", "offered": false } ] } ],
  "charter": [ { "route_id": "r5", "boat_type": "speedboat", "starter_price": 45000, "starter_includes": 20, "extra_per_pax": 1500 } ],
  "addons": [ { "key": "longtail", "route_id": "r10", "join_adult": 400, "join_child": 300, "charter": 3500, "capacity": 8 },
              { "key": "private_transfer", "route_id": "r5", "zone": "PK", "sedan": 1200, "van": 1800 } ] }
```

#### `POST /v1/rate-types` · `PATCH /v1/rate-types/:id` · `POST /v1/rate-types/:id/clone`
- **POST:**
  - Requires `name`.
  - `code` is generated as SALES-NAME[-n] (`_rtAutoCode`, `rates.js:645-654`) and unique. It is never editable afterwards (import matches by code).
  - `owner_sales_id` defaults to the caller's salesperson.
  - `valid_from ≤ valid_to` (400).
- **PATCH:** only the fields sent (`apps/web/docs/partial-updates.md`). `owner_sales_id` is admin-only (403). `active` toggles.
- **Clone:** new id and code; name `+ " (copy)"`; owner = caller; active; copies routes, zones, prices, charter and add-ons. No agents are bound.

#### `PUT /v1/rate-types/:id/routes/:route_id`
- **Body:** one route's whole block: travel window, bundle, zones with `offered` and prices per tier, charter rows, add-on prices for that route. Replaces that route's rows only.
- **Validation (400):**
  - zones must be valid for the route's pier: `panwa`/`tublamu` → PK/KL/NoTransfer; `ranong` → RN/NoTransfer (`rtZonesForRoute`)
  - pax keys from the pax grid
  - prices ≥ 0
  - `travel_from ≤ travel_to`
- `DELETE …/routes/:route_id` removes the route from the rate.
- The legacy B2C route writer (`POST /api/b2c/routes`, `b2c-catalog.js:416-477`) maps onto this, with the same checks.

#### `DELETE /v1/rate-types/:id`
409 `in_use` with `{agents, seasons, contracts, bookings}` counts when anything references the rate; the UI then offers Deactivate. This replaces legacy's delete, which unbound agents and left seasons, contracts and bookings dangling.

#### `POST /v1/rate-types/:id/agents`
- **Body:** `{ add: [agent_id], remove: [agent_id] }`, within the caller's sales scope.
- **Each bound agent:** activity row `rate`, and programmes gain the rate's priced routes.
  - This is the same as `PATCH /v1/agents/:id {rate_type_id}` in the agents spec, so both paths do the same thing (legacy's picker skipped it).
  - Contract follow waits for contracts.
- **Removed agents:** `rate_type_id = NULL`.

#### `GET/POST/DELETE /v1/addon-types`
- Builtins `longtail` and `private_transfer` are seeded and cannot be deleted.
- Custom keys are slugs of `label_en` (≤ 24 chars, `_2`… on collision).
- Delete sets `active = false` and keeps prices (legacy hid them).

#### `POST /v1/quote`: the pricing engine, server-side
- **Input:** a booking draft (`agent_id` or `rate_type_ref`, `booking_date`, trips with `route_id, service_date, zone, booking_mode, charter_boat_id, pax grid, ovn fields`, add-on lines, adjustments, `price_mode`, `manual_total`).
- **Output:**
  ```json
  { "rate_type_ref": "rt003", "trips": [ { "trip_index": 0, "rate_type_id": "rt003", "promo_id": null, "season": false,
      "subtotal": 7600, "no_rate": null } ],
    "addons": [ { "type": "longtail-join", "amount": 1400 } ],
    "breakdown": { "seat": 7600, "addon": 1400, "foc_discount": -2900, "discount": 0, "extra": 0 }, "total": 9000 }
  ```
- **The rules** are legacy's steps 1–7 (§1 "Pricing engine"), in a pure `src/domain/pricing.ts` that both stores call.
- **Legacy bugs fixed:**
  - add-ons price from the **trip's** resolved rate (season/promo), not the base rate
  - `nationality_scope` restricts pricing: a Thai-only rate quotes foreign pax as `no_rate: 'scope'` (Q2)
  - infant and FOC stay free on seats
- **Bookings use it:**
  - `POST /v1/bookings` and any `PATCH` that changes trips, pax or add-ons call the same function and store the result (`total`, `price_*`, per-trip subtotal / promo id / rate id).
  - A `PATCH` that does not touch pricing inputs **keeps the stored prices**. That makes "ใบที่ขายไปแล้วล็อกราคาเดิม" true, not just until the next edit (Q3).
  - `price_mode: 'manual'` keeps `manual_total`.
- **Needs first:**
  - promo contracts (`sb_contracts` with `pricemode/rates/discount/bookwin`)
  - agent seasons (`agent_rate_seasons`, agents spec)
  - booking add-ons (`booking_addons`, `todo/booking-model.md:107-114`)
  - Until those exist, the engine prices seats and charters from the bound rate only, and says so in the response (`"not_applied": ["seasons","promotions","addons"]`).

#### Import (`src/tools/import-legacy.ts`)
Read:
- `sb_rate_types` and children, turning the wide columns into rows (`pk_adult_thai` → zone PK, ad, thai, net)
- the `kl` JSON as the KL source when present (it wins on legacy read)
- `pricetiers` JSON → `sell` / `min_sell`
- `__addons__byroute` / `__addons__r*` / `__addons` → `rate_type_addon_prices`
- all-NULL zones → `offered = false`
- `sb_agents_rate_bindings` for agent bindings (already done for agents)

**Cannot be imported** (never in Postgres): RN prices, longtail charter rows, transfer prices outside r4/5/6/10/11/12, flat custom add-on prices, bundle `applyTo`, custom add-on types. Sales must re-enter these (Q1).

**Scopes:** under the current preHandler, `/v1/rate-types` falls under `booking:*` (`routes/operations.ts:192-199`). Proposed: `sales:write` for rate-type writes, matching the legacy `sales` area and the agents spec.

---

## 4. Store and component plan

- **Phase 1:** read-only list, detail (seat, charter and add-on tables), bound agents column, dup / expiry banners. Needs `GET /v1/rate-types`, `GET /v1/rate-types/:id`, `GET /v1/agents?rate_type_id=`.
- **Phase 2:** editor (create / edit / clone / per-route prices with the tier switch), activate/deactivate, owner, bind agents, delete-when-unused. Also turns on the agents page's Pricing Matrix tab, which shares the detail body.
- **Phase 3:**
  - add-on types
  - the Rate Expiry screen and the agent Rate Type (seasons) tab, together, since they need `agent_rate_seasons`
  - B2C endpoints on the backend (Q7)
- **Booking pricing** (`POST /v1/quote`) belongs to the booking create/edit port. It is specified here because rate types define it.

### `useRateTypesStore` (`apps/web/src/stores/rateTypes.ts`)
- **State:**
  - `summaries: ObRateTypeSummary[]`, `details: Map<id, {status, rate?}>`
  - `agentsByRate: Map<id, ObAgentSummary[]>`
  - `routes`, `salesPeople`, `markets`, loaded once
  - `status`, `error`
- **URL state:** `/rate-types/:id`, `?q=`, `?view=agents`.
- **Shared data:** `useAgentsStore` also loads `summaries` for its labels. The rate-types store is the owner. The agents store reads `useRateTypesStore().summaries` instead of fetching its own, so the list loads once.
- **Getters:**
  - `validityOf(rate, today)` → `always|upcoming|active|expiring|expired` + days (`_rtValidityStatus`, local dates)
  - `sorted` / `grouped` (list sort `rates.js:703-714`, grouping `745-757`)
  - `zonesFor(routeId)` (`rtZonesForRoute`)
  - `duplicateCodes` (legacy data only; empty once `code` is unique)
  - `expiring(today)` (`rtExpRowFor` without seasons until phase 3)
- **Actions:**
  - Phase 1: `load()`, `loadRate(id)`, `loadAgents(id)`.
  - Phase 2: `create`, `patch`, `putRoute`, `clone`, `remove`, `bindAgents`. Each replaces the affected rate and its summary. `bindAgents` also invalidates the agents store's summaries of the touched agents.

### Components (`apps/web/src/features/rate-types/`)
- `RateTypesView.vue`: route `/rate-types` and `/rate-types/:id`. Header, banners, side list, detail, optional agents column.
- `RateTypeList.vue`: search, grouped rows with a validity chip.
- `RateTypeDetail.vue`: head (chips, disabled actions in phase 1) + body.
- `RatePricesTable.vue`: seat rates by route × zone, columns per nationality scope, route validity, bundle notes, "N/A" for not-offered. Reused by the agents page's Pricing Matrix tab in phase 2.
- `RateCharterTable.vue`, `RateAddonsSection.vue`.
- `RateTypeAgents.vue`: bound agents with market filter chips and tiles. Each card links to `/agents/:id`, replacing `agSelectFromRtCol`.
- `rateTypeRules.ts`: pure validity / sort / group / zones / expiry functions, with tests.
- **Routes** (`apps/web/src/router.ts`): `{ path: '/rate-types', name: 'rate-types' }`, `{ path: '/rate-types/:id', name: 'rate-type' }`. Remove `rate-types` from `legacyViews` (`apps/web/src/lib/legacy.ts`). Rate Expiry stays listed until phase 3.
- **Links:** the agents page's "Rate used for pricing" box links the rate code to `/rate-types/:id`.
- **Disabled in phase 1:** New Rate Type, Edit, Clone, Activate/Deactivate, owner, Manage agents, unbind, add-on types. Titles read "Not moved yet". No legacy links (legacy is no longer reachable).
- **Tests:**
  - `rateTypeRules.spec.ts`: validity at the boundaries (the from day is Active, not Upcoming, unlike legacy's UTC bug), sort and group order, zones for panwa/tublamu/ranong
  - `RateTypesView.spec.ts` (`fetch` stubbed):
    - list, select, detail tables (RN zone shown, N/A cell), bound agents
    - 404 → "Rate types are not in operation-backend yet"
    - a `sell` tier value is not shown as the billed price

---

## 5. Open questions
1. **Lost prices:** RN zone prices, longtail charter rows, private-transfer prices outside r4/5/6/10/11/12, flat custom add-on prices and custom add-on types were never saved to Postgres. Sales must re-enter them after the import. Who, and is there a list from memory or paper?
2. **Nationality scope:** legacy's "Thai only" / "Foreigner only" hides columns but still prices the other nationality (at 0 or a stale hidden value). Should the backend refuse to quote the other nationality (`no_rate: 'scope'`)? Recommended: yes.
3. **Re-pricing old bookings:** legacy re-prices a booking at today's rates whenever it is edited. Should the backend keep stored prices unless trips, pax or add-ons change? Recommended: yes.
4. **Add-ons from the season/promo rate:** legacy prices add-ons from the agent's base rate even when a season or promotion prices the seats. Use the trip's resolved rate instead? Recommended: yes.
5. **Delete:** refuse while referenced (the UI offers Deactivate), instead of legacy's unbind-and-delete. OK?
6. **Custom add-on types:** legacy lets you define them but bookings never price them. Keep them (priced in bookings once `booking_addons` exists) or drop them?
7. **B2C:** the B2C site reads `/api/b2c/availability`, `/api/b2c/rate-types` and `/api/b2c/routes` on the legacy server. Legacy is no longer reachable from the frontend. Is `server.js` still running for B2C, or must operation-backend serve these (with the same API key) before rate types move?
8. **Order:** ship `GET /v1/rate-types` (summary) first, because the agents page already calls it and fails without it (see the agents fix). Then the detail endpoint, then writes, then `/v1/quote` with the booking port. OK?
