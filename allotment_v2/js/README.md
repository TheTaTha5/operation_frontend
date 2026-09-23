# allotment_v2/js — the app's JavaScript

Until 2026-08-27 all of this lived inline in `allotment_v2.html`. It was lifted out **verbatim** —
byte-identical content, same order, no reformatting, no reordering, zero JS changed. The commit that
did it can be verified by concatenating these files back into the script tags and diffing against
`BACKUP/allotment_v2_20260827_pre_js_split.html`.

## Why this is not a refactor

These are **classic scripts, not modules.** `allotment_v2.html` loads them with plain
`<script src="js/NN-name.js"></script>` in the order below — no `defer`, no `async`, no
`type="module"`. That combination is a semantic no-op versus inline blocks:

- top-level `function` declarations still land on `window`, so the ~2,500 inline `onclick=` /
  `onchange=` attributes in the HTML still resolve exactly as before;
- top-level `const` / `let` still share one global lexical environment across all the files, the
  same as they did across the eight inline blocks;
- the parser still blocks on each one in order, so `DOMContentLoaded` still fires after all of them
  (which `04-data-core.js` depends on — see its `_safeRenderDash` comment).

**Do not add `defer`, `async`, or `type="module"` to these tags,** and do not reorder them. Any of
those changes breaks every inline handler in the app. The same reason **Cloudflare Rocket Loader
must stay off** applies here with a larger blast radius: Rocket Loader defers external scripts.

There is still exactly one global scope shared by ~3,100 top-level functions. Splitting the files
bought load performance and editing ergonomics; it did not buy encapsulation. Real modularization is
`MODERNIZATION_BACKLOG.md` B-15. (The `platform/` strangler rewrite was removed from this fork on 2026-09-23.)

## Load order

| # | file | what's in it | pre-split html lines |
|---|---|---|---|
| 0 | `10-embed.js` | `?embed=1` iframe mode — **must stay first**, see below | — (added 2026-09-19) |
| 1 | `01-auth-sync.js` | login gate, `/api/me`, cloud sync, `LA_NAV` permission table | 5–719 |
| 2 | `02-sidebar.js` | glass sidebar init | 3729–3747 |
| 3 | — | `xlsx.full.min.js` from cdnjs (still inline in the HTML) | 4129 |
| 4 | `03-topbar-nav.js` | topbar tools toggle, mobile nav | 4160–4186 |
| 5 | `04-data-core.js` | `DATA + localStorage`, defaults, `save()`, export/auto-restore | 5557–13383 |
| 6 | `05-fleet.js` | `FLEET_VERSION`, `FL_DEFAULT_*`, `flLoad`/`flSave`, fleet UI | 13806–36255 |
| 7 | `06-engine-assign.js` | engine assign / unassign / swap | 36291–38157 |
| 8 | `07-charter.js` | charter modal | 39185–39227 |
| 9 | `booking.js` | Booking v2 · by-trip · seat locks · reconfirm · boat capacity (`bkV2`, `bk`, `ba`, `rc` …) | split from 08-app.js |
| 10 | `agents.js` | agents · sales team · add-on services (`ag`, `agp`, `tm`, `aos`) | split from 08-app.js |
| 11 | `rates.js` | Rate Types (`rt`, `rtm`) | split from 08-app.js |
| 12 | `contracts.js` | contracts · contract templates · costing & boat rent (`ct`, `ctt`) | split from 08-app.js |
| 13 | `checkin.js` | van + pier check-in · guide jobs · meals (`ck`, `pck`, `vck`, `go`, `mv`) | split from 08-app.js |
| 14 | `vans.js` | vans · van jobs · van bill · vehicles · pickup setup (`van`, `vj`, `vb`, `veh`, `psu`) | split from 08-app.js |
| 15 | `cash.js` | pier cash · petty cash (`pc`, `po`) | split from 08-app.js |
| 16 | `accounting.js` | accounting · daily PFM · travel summary (`acct`, `pfm`, `ts`) | split from 08-app.js |
| 17 | `reports.js` | reports · analysis · daily report · market data · pickup map · B2C dashboard | split from 08-app.js |
| 18 | `boatjob.js` | boat job sheet · ใบงานเรือ (`pj`) · first screen converted to `laDelegate` | split from 08-app.js |
| 19 | `08-app.js` | everything else: **all load-time code** (top-level `const`/`let`, IIFEs, listeners) + `render*` entry points and shared helpers | 39246–86154 |
| 20 | `09-action-board.js` | Action Board (`abRender`) | — (post-split) |

### The 08-app.js domain split (2026-09-23)

The ten domain files (`booking.js` … `boatjob.js`, no number prefix) hold **only function declarations**, moved verbatim by `tools/split-08-app.mjs` (prefix →
file map at the top of that script). Everything that runs at load time stayed in `08-app.js` in its
original order — that is why the domain files load *before* it: every function its load-time code
could reach via hoisting is already defined. Two rules follow:

- **New load-time code goes in `08-app.js`**, never in a domain file. A top-level `const` in a domain file
  that `08-app.js` reads is fine; a top-level statement in a domain file that calls something defined in
  `08-app.js` or reads its `const`s throws at load.
- **New functions go in the file of their prefix.** `node tools/verify-08-split.mjs static` proves
  the move against a git ref; `snapshot`/`compare` diff every global's source and every view's HTML
  in Chrome before vs. after.

### Getting a screen off inline handlers (`laDelegate` · first done: `boatjob.js`)

Inline `onclick="pjPick('b3','cap',this.value)"` is why every function has to stay global. A screen
is converted like this — the boat job sheet (`renderPierJob` + `boatjob.js`) is the worked example:

1. **Markup says what, not how:** `data-on-change="pick" data-a-bid="b3" data-a-slot="cap"`, built by a
   small helper (`pjOn(ev, action, args)`, which also HTML-escapes the values).
2. **One action table per screen** (`PJ_ACTIONS`): `pick(el){ pjPick(el.dataset.aBid, el.dataset.aSlot, el.value); }`.
   `data-a-*` values come back as strings — convert with `+` where the old inline code passed a number.
3. **The render function attaches the dispatcher to the screen's host:** `laDelegate(host, PJ_ACTIONS)`
   (`08-app.js`). It reproduces inline-handler semantics: bubbling order along `composedPath`, stops on
   `stopPropagation`, sits on the host so document-level "click outside" listeners still get stopped,
   `blur` is heard as `focusout`. An empty `data-on-click=""` is a deliberate no-op.
4. **Then the file can be closed:** once nothing calls its functions by name from HTML, wrap it in one
   function scope and export only what other scripts use (`boatjob.js` exports 30 of 112 names; the list is at
   the bottom of the file and is the complete public surface).

Proving it (all three are in `tools/`): `handler-map.mjs record` before, `compare` after — every handler
element must call the same function with the same arguments and propagate the same way, and a
~200-step real-click replay must leave the same data and screen (`--no-map` once the file is wrapped).
`render-golden.mjs` covers the neighbouring views. `check-inline-handlers.mjs` runs in CI and fails if
any file gains an inline handler; after converting a screen, `--update` locks in the lower count.

The `NN-` prefixes are the split order, **not** the load order (the domain files have no prefix at all; the `<script>` tags are the only load order) — `10-embed.js` is deliberately the
first tag in `<head>`, ahead of `01-auth-sync.js`. It has to be: it sets `window.__laEmbed` before
`01-auth-sync.js` schedules `_laRestoreView` (which would otherwise click the last-used view over the
one the embed URL asked for), and it paints the chrome-hiding CSS before the first frame. Without
`?embed=1` in the URL the file returns on its first line and changes nothing.

## Working here

- `node --check allotment_v2/js/<file>.js` — this is now a real per-file syntax check. The old
  ritual of extracting the main `<script>` out of the HTML before checking it is gone.
- `node tools/check-persist-gates.mjs` defaults to this directory.
- `node tools/js-split-linemap.mjs 69054` translates a pre-split `allotment_v2.html` line number
  (as cited throughout `CLAUDE.md`, `docs/workflows/**`, `BACKLOG.md`) into `js/<file>:<line>`.
  Those citations all carry the function name too, so `grep -rn <fnName> allotment_v2/js/` works
  just as well.
- `server.js` reads `LA_NAV` out of `01-auth-sync.js` at boot (`laSyncPermKeys`) to sync permission
  keys, and pre-compresses every file here at startup (`prewarmStatic`). Renaming a file means
  touching both.
