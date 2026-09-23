# LOVE Andaman — allotment_v2

Staff web app for LOVE Andaman (Phuket marine tours: Similan, Surin, Phi Phi, Phang Nga Bay, Whale Shark). Served at `rsvn.loveandaman.com` from Railway, behind Cloudflare.

## Git flow — read before any push

- `origin` = **the fork** (`TheTaTha5/operation_frontend`). `upstream` = **production** (`digitalmkt-bbot/LOVE_Andaman_Workspace`). Railway deploys `upstream/lk-inbox`, and pushes there run migrations against the live DB.
- Flow: feature branch in the fork → merge into `origin/uat` for testing → PR to `upstream/lk-inbox`. **Never push to `upstream`.** Fast-forward `uat` (`git push origin HEAD:uat`); don't force-push it.
- `main` on both remotes is a stale snapshot that nothing deploys from. Don't merge into or out of it.
- To see what prod is actually running, query `SELECT name, applied_at FROM allotment.schema_migrations ORDER BY applied_at` on the prod DB. `OPS_DATABASE_URL` is in `D:/projects/Loveandaman-Kingdom/.env`; the URL in `db/rt.cjs` is dead. App tables live in schema `operation_schemas`.

## Stack

- **`server.js`** — Node monolith: static files, `/api`, auth, and the migration runner. Postgres (~103 tables) is the source of truth.
- **`allotment_v2/allotment_v2.html`** — markup plus `<script src>` tags. **`allotment_v2/js/*.js`** (~107k lines) holds all the client code: `01..10-*.js` plus domain files (`booking.js`, `agents.js`, `rates.js`, `contracts.js`, `checkin.js`, `vans.js`, `cash.js`, `accounting.js`, `reports.js`, `boatjob.js`) that load between `07-charter.js` and `08-app.js`. CSS is in `allotment_v2/css/`.
- **One global scope.** These are classic scripts sharing thousands of top-level functions, called by name from ~2,000+ inline `onclick=` handlers (in the HTML and in JS-built templates). **Never add `defer`/`async`/`type="module"` or reorder the tags** — every handler breaks. See `allotment_v2/js/README.md`. Cloudflare Rocket Loader must stay off for the same reason (it looks like a permissions bug).
- New and converted screens use `laDelegate(host, actions)` (`08-app.js`) instead of inline handlers.
- `js/10-embed.js` must stay the **first** script in `<head>`. It powers `/embed/*` iframes, which are read-only UX, not a permission boundary. Details are in the comments at `EMBED_ORIGINS` / `EMBED_TOKEN_SECRET` in `server.js`.
- Off by default: `api-proxy.js` (forwards `API_PROXY_ROUTES` to another backend) and `auth/oidc.js` (Authentik SSO, active only when `AUTH_OIDC_*` is set).
- `apps/web/` — isolated Next.js shell, now obsolete: the new frontend will be **Vue 3 + Vite + TypeScript** (Vue Router, Pinia), replacing `allotment_v2` page by page. It does not touch `allotment_v2`.
- `os-backend/src/mapping/` (`field_mapping.json`, `os_repo.js`) is **live** — `server.js` requires it.

## Working in the code

- Files are huge. Grep for the function, read a 30–50 line window, make a targeted edit, then `node --check allotment_v2/js/<file>.js`.
- Old notes cite line numbers into the pre-split HTML (e.g. `bkV2InferZone:69054`). Grep the function name, or translate with `node tools/js-split-linemap.mjs <line>`.
- Local backend: `npm run dev:local` (throwaway Docker Postgres + `server.js`). Static-only UI work: `allotment_v2/start_server.command` → `http://localhost:8765/allotment_v2.html`. Never use `file://`.
- Tests: `node --test`, `npm run test:ui`, and the per-feature `npm run test:*` scripts in `package.json`.
- Use English/ASCII in `alert()`, `console.log()` and new hooks; Thai text in the UI is fine.
- `esc`/`escapeHTML` is **not global** — each render function declares its own.
- Dates: build `YYYY-MM-DD` with `bkV2LocalYMD(dt)`, never `toISOString().slice(0,10)` (UTC shift, site is +07:00).
- Re-rendering a container that holds the focused element jumps the scroll to the top. Update only the changed sub-region.
- `backdrop-filter` creates a stacking context that traps dropdowns. Keep it off cards that contain them.
- Sticky offsets read `--topbar` / `--t2-vangroup-top`. Never hardcode pixel heights.

## Data model and persistence

- The client keeps a working copy in localStorage `loveandaman_v2` (`LS_KEY`), seeded from `DEFAULT_*` / `FL_DEFAULT_*` in `04-data-core.js` / `05-fleet.js`, and syncs to Postgres via `/api/save` and `/api/v1/_batch`. The blob is shared by `save()` and `flSave()`, so **always read-modify-write it**; never clobber other keys.
- Load persisted lists with `Array.isArray(x)` so a deliberately emptied list stays empty. A key that is persisted but never loaded silently vanishes on refresh.
- A new persisted field needs its persist helper, both client load paths, a `field_mapping.json` entry, and a migration. **Ship the mapping and the migration in the same push** — a mapping without its migration takes `/api/load` down.
- Migrations: `db/migrations/*.sql` (019+; 001–018 are folded into `db/baseline/`) apply automatically at boot. Never delete a migration that has not shipped.
- Appending to an `FL_DEFAULT_*` list doesn't reach already-seeded data. Add an idempotent merge in `flLoad` that pushes only the missing ids.
- Structural fleet changes: bump `FLEET_VERSION` (currently `fleet_v34`) and add a migration in `flLoad`.
- Don't rename or delete fields (mark them inactive); add new fields as optional. Don't add auto-mutating "self-heals" to `flLoad`. Keep data fixes user-triggered.
- Per-area edit rights (`edit_areas`) are enforced **client-side only**; the server sees any area as full `edit:true`.

## Domain rules

**Boats**
- `pier` enum is exactly `tublamu` | `panwa` | `ranong`. Check existing values before writing any enum string.
- `cap` = booking cap; `licensePax` = real registered seats. Over cap → `pending_approval`; over license → hard block; boat-assign tolerance `BA_CAP_TOL`.
- Current status = the **last** entry of `boat.log[]`.

**Bookings**
- Cancelled statuses `['cancelled','cancelled_weather','rejected']` are excluded from every pax, revenue and count aggregate.
- `bkV2CommitBooking` rebuilds the booking on edit. Its `if(editing)` block must carry over `ops`, `upgrades`, `feeItems`, `reschedule`, `partialCancels`, `cancellation`, `cancelCategory`, `history`, `weatherResolve`, `rebook`, `invoiceId`, `paymentStatus`. Any field you add that the form doesn't render must be added there too.
- `bk.ops` is day-1 only. For a specific date, read through `bkOpsRead` / `bkOpsFor`.
- Charter trips are excluded from the seat pool (`baCharterBoatIds`, `getSeatsConsumed`); `bkV2CharterBoatHeal` mirrors `trip.charterBoatId` → `ops.boatId`.

**Seat locks**
- Locks reduce the sellable pool (`getAllotment`). Eating locked seats is a hard block; physical oversell is a soft confirm.
- `bkV2LockPoolHold` counts holds at the parent level only. Month locks release per trip (`releaseDaysBefore`/`releaseTime`), not via a global `expiry`.

**Vans**
- A van group = one outbound van; the return van is per booking. Disband nulls both `vanId` and `vanReturnId`; `bkV2VanGroupHeal` touches `vanId` only. Never auto-pick a van — surface conflicts instead.

**Rates and agents**
- Rate types (`SB_RATE_TYPES`) bind to agents via `agent.rateTypeId`. Persist with `rtPersist()` / `sbAgentsPersist()`. Zones are `PK`, `KL`, `NoTransfer`.
- Longtail pricing is per-route: read it via `_rtLongtailForRoute`. Add-on types come from `RT_ADDON_DEFS` (`rtRebuildAddonDefs` = `RT_ADDON_BUILTIN` + `SB_ADDON_TYPES`).

**Fleet**
- Engine hours = `baseHours` + (latest − first Daily-Log reading), skipping readings ≤ 0.
- Per-asset maintenance cost (`flMaintCostShare`) applies only on the engine/gearbox/propeller detail pages; other totals count each job once.
- Positions normalize via `flPosLabel`/`flPosRank`. 1 engine = 1 gearbox = 1 propeller; a spare part must be detached.

## Reference docs

`SYSTEM_MAP.md` (architecture map; update it when adding modules) · `OPERATIONS_PIPELINE_DESIGN.md` (van-assign/grouping) · `allotment_v2/js/README.md` (script loading) · `STATUS.md` (recent state and known risks).
