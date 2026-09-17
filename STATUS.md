# LOVE Andaman — Allotment v2 · Project Status

**As of:** 2026-09-17 · branch `lk-inbox` @ `579768d` · **1 commit ahead of origin**
(push from GitHub Desktop — the shell here has no credentials)
**Data snapshot:** `allotment_v2/data_exports/backup_2026-09-10_1830.json` (19.4 MB)
**Untracked, owner to decide:** `test/ui/t_scroll.mjs` + `test/ui/scroll_base.json` (real work from
another session — run it, then commit), `B2B-Promotion-Requirements.docx`, 5 scratch files in
`Claude outputs/`.

> Another Claude session landed **78 commits on 14–17 Sep** that this file does not detail: cost
> sheet, B2B promo, By-trip scroll/pin, mobile/iOS pass, sidebar theming, calendar, boat rental +
> fuel, petty cash, and `§testUI` (which moved the UI tests into `test/ui/`). Read
> `git log --oneline 898a866..HEAD` before assuming anything below is the whole picture.

---

## 1 · Where the project is

In production and in daily use across three piers. The app is past the build-it phase; the work now
is **correctness in the seams** — places where two screens disagree, or where something a person
typed doesn't reach the person who needs it.

### Scale it runs at

| | count |
|---|---|
| Bookings | **3,927** (3,589 confirmed · 297 cancelled · 24 weather · 9 rejected · 7 quote) |
| Trips | 3,931 · travel dates **2026-06-04 → 2027-05-14** |
| Agents | 795 |
| Contracts | 829 |
| Rate types | 51 |
| Invoices | 367 |
| Boats | 20 · Engines 53 · Maintenance records 112 |
| Routes | 57 |
| Guides 31 · Pier staff 40 · Pier job sheets 113 |
| Views (screens) | **68** |

### Development pace

| month | commits |
|---|---|
| 2026-06 | 27 |
| 2026-07 | 559 |
| 2026-08 | 430 |
| 2026-09 (to 14th) | 385 |

---

## 2 · What shipped most recently

All measured before and after, all with the regression suite green
(68 views · 21 value sets unchanged · registry clean).

### 2026-09-17 — vans on the guide sheet, and stale derived tables

| Tag | What was wrong | Measured result |
|---|---|---|
| `§gvanSplit` | A booking with a **split pickup** has its van moved out of `ops.vanId` and into `vanSplits`. The guide job order grouped on `r.vanId` alone, so every one of those bookings printed under **"มาเอง / เอเย่นต์ส่งเอง"** — the sheet told the guide nobody was collecting guests who in fact had a van. | `ckGroupVanId(r)` reads both shapes, applied at **4 grouping sites** (print sheet, screen cards, sheet-by-van, sheet-by-boat). Scan of the database: **6 of 6** bookings with `vanSplits` were affected, and all 6 span more than one van. |
| `§gvanJob` `§gvanJob2` | No way to open the guide job order from the boat band; `margin-left:auto` did not move the button because `.pcs-w` is `width:fit-content` + `position:sticky;left:0` on purpose. | Button sits **6 px from the visible pane's right edge** on both boats, via a full-width `.pcs-row` wrapper and `position:sticky;right:6px`. |
| `§gvanHead` `§gvanHead2` `§gvanHead3` | Van headers showed a short name only, and a booking split across two vans named just one of them. | Header is now `Love6 ทะเบียน 31-6678 · พี่คิง · 095-061-0687 / Love9 ทะเบียน 36-0024 · ต่อ · 098-448-4983` — same format on screen and on paper, both vans in full. |
| `§poKindStale` | Stock card headers printed raw ids (`pk_bo15o`, `pk_73f85`, `pk_0z9bq`). `PO_KIND` is a pre-built lookup; the sync path overwrote `PIER_KINDS` without rebuilding it. | Rebuild added to the sync path. **This turned out to be half the bug** — see the next row. |
| `§laDerived` | The audit that followed found the same fault on the **ordinary page load**: `PIER_KINDS`/`PIER_ITEMS` load around line 55000, but `poKindSync()` had already run at ~54970, so `PO_KIND` held only the three seed categories on **every F5**. And `RT_ADDON_DEFS` (built from `SB_ADDON_TYPES`) was never rebuilt on sync, so a custom add-on type created on another device never reached Rate Types or the contract text. | Cold boot: categories missing from the lookup **3 of 6 → 0**. The **ปรับยอด / ซ่อมเสร็จ buttons crashed on 7 of 21 items** (`PO_KIND[kind].u` on `undefined`) — **now 0 of 21**. `RT_ADDON_DEFS` picks up new types on sync. One function, `laRebuildDerived()`, called from exactly two places. |

**The detector is the reusable part.** Two datasets, the second with a `ZZMARK` item added to every
registry; boot one page fresh and drive `_laReloadData` on another; diff which globals contain the
marker. What the fresh page has and the reloaded page doesn't **is** the stale-table list, with no
code reading involved. It found `RT_ADDON_DEFS` on its own. Rebuild it when you touch the load path
(the recipe is in `HANDOFF.md` §5).

### 2026-09-14 — data integrity, the seams

| Tag | What was wrong | Measured result |
|---|---|---|
| `§chOpsSync` | Changing the boat on a charter booking updated the sales record and the fleet lock but **not** `ops.boatId` — the field Boat Operation, pier check-in, job sheets and the Daily Fleet Log all read. The manifest showed the new boat; every operational screen still sent crew to the old one. | Edit→Save now leaves all four in agreement. Already-broken bookings self-repair on the next manifest render. |
| `§ovnBoatFollow` | Overnight bookings have a system-generated return leg. It was converted to charter **once** and never updated, so changing the outbound boat left the return leg on the old one — **two whole boats locked for one 12-pax group** on the return date. | Return leg follows the outbound. Old boat released across the whole span (16–19 Sep: `Oceanus` only, was `Zeus + Oceanus`). |
| `§bkAlFlush` `§bkAlFree` `§bkAlKeep` | Text typed into the allergy box and saved without pressing "+ เพิ่ม" was **silently discarded**. The free-text food field had no input anywhere in the booking form. `pierAt`/`pierBy` were wiped on every save. | Pending text is captured on save (long → note, short → counted chip). New "รายละเอียดเพิ่มเติมเรื่องอาหาร" field. Pier attribution survives. |
| `§gdAlList` `§pckAlTip` | The guide job sheet read only the free-text allergy field, **never `allergyList`** — but chips are the primary way allergies are recorded (every preset button creates one). Allergies entered the normal way never reached the guide. Pier check-in showed a count with no detail and no tooltip. | Guide sheet prints both forms (verified on a real 22 KB sheet). Pier chips carry the detail in a tooltip. |
| `§drIssIdle` `§drIssMerge` | Non-departing boats had their whole row collapsed, so supplies loaded onto a parked boat had to go into free "อื่นๆ" rows — which are **not counted in the column totals**. Visit Panwa 8 Sep: blue Pepsi read 8, actual 11. | All 9 boats keyable (was 2/9). Duplicate "อื่นๆ" rows now flagged and one click merges them into the column. |

### Printed documents

| Tag | Result |
|---|---|
| `§pjWkLb` | Custom slot names on non-departing boats now print (they were stored under a separate key the sheet never read). |
| `§pjHideIdle` | Idle boats hidden by default on screen; the "Not available" box collapses to a one-line count on paper (941 → 75 chars), which also gave the Departures box back its width — programme names stopped truncating. |
| `§pjLbScope` `§pjGdOrder` `§gdOptOrder` | Slot names are per-boat-per-date, print on the sheet, and guide rows follow card order instead of Thai alphabetical. |

### UI

| Tag | Result |
|---|---|
| `§laRfLeft` | "มีข้อมูลใหม่" banner moved to the bottom-left, sized exactly to the sidebar column (250 px, 0 px overflow into content). It used to cover the page action buttons. Small screens unaffected. |
| `§abRisk5` `§abBar14` `§abTop20` `§abAgPill` `§abRowH` `§abGrid2` `§abSB3` | Action Board pass: at-risk threshold, 14-day bars, top-20 agents, agent colour bands, aligned rows, 3 px scrollbars. |

---

## 3 · Verified correct — do not re-audit

Checked by measurement this cycle; no change needed:

- **ใบแจ้งร้านอาหาร (kitchen order slip)** — reads all three food sources (tick-box counts,
  structured allergy chips, free text). Printed and confirmed. This was the one document that had
  been right all along; the code comment says so explicitly.
- **Charter TRIPS release on save** — the edit path correctly releases the old boat's lock before
  applying the new one. The bug was only in `ops.boatId`, now fixed.
- **Every other pre-built lookup on the load path** — the `ZZMARK` detector, re-run after
  `§laDerived`, leaves exactly two hits, both harmless: `SB_AGENT_PRICES` (the v1 pricing table;
  **0 of 3,734 bookings** are schemaVer 1, so the path is dead) and `_loaded` (a boot temp read only
  by the three lines under it).

Not checked, by the owner's decision: **ใบยื่นเจ้าท่า** and **ใบสั่งงานมัคคุเทศก์** (whether food
detail appears on them).

---

## 4 · Open items

### High — customer safety, needs a person

**30 bookings where the agent voucher records a food request but the system has no detail.**
Full list: `Claude outputs/food_notes_missing_2026-09-14.md`. Among them:

```
1pax allergic to shellfish          Allergy shellfish
Cashew nut allergies                1pax allergic with alster and almond
Allergy papaya                      Allergies strawberry, oat, kiwi, coconut
1pax allergy with eggs              Dairy and no cheese
No seafood                          several "Halal food" with halal count = 0
```

The text is recoverable — it sits in the voucher OCR already attached to each booking. A script
could restore it automatically, but it **should not run unattended**: these are allergy records and
a mis-parse is a health risk. Recommendation: work the list by travel date, future dates first,
with a human confirming each line.

Root cause is fixed as of `f0eba63`, so the list should stop growing.

### Medium — data hygiene

- **86 active MAIN contracts point at a different rate type than their agent.** Breakdown of the
  829 contracts: 498 agree · 209 have no rate type on the contract while the agent has one
  (cosmetic — the contract card shows nothing) · **86 genuinely disagree** · 13 belong to agents
  that no longer exist · 1 reversed. `§ctRateSync` keeps new changes in step; these 86 predate it
  and need a one-shot repair pass that the owner reviews.
- **3 trips have a display-string date** (`"Sat Jul 04"`) instead of `YYYY-MM-DD`. All three are
  cancelled B2C test records (`b2c_BK-001..003`). Harmless today; worth deleting or normalising
  before the relational migration, which will reject them.

### Low / offered, not requested

- Crew + guide block on ใบงานไกด์ with custom slot labels (it is an internal document, so the
  constraint that blocks it on the park register doesn't apply).
- Pier "โน้ต" text does not reach the kitchen slip — only the "อาหารพิเศษ" dialog does. Believed
  intentional; confirm with the pier team before changing.
- `_to_delete/gitlocks/` and `_to_delete/abase/` are scratch and can be deleted by the owner
  (the session cannot delete files on the mount).

---

## 5 · Risks worth naming

| Risk | Why it matters | Mitigation in place |
|---|---|---|
| **Fields lost on booking save** | `bkV2CommitBooking` rebuilds the record from the form; anything the form doesn't render can be dropped. This one pattern caused three separate incidents (`ops.boatId`, `pierAt/pierBy`, the food note). | Each found instance fixed. **No systematic guard exists.** A diff-on-save audit — snapshot before, compare after, log dropped keys — would turn a whole bug class into a log line. Recommended next piece of work. |
| **Same fact stored in two places** | Charter boat lived in `charterBoatId` *and* `ops.boatId`; allergies live in `allergyList` *and* `allergies`; slot labels lived globally *and* per-boat; a van lives in `ops.vanId` *or* inside `vanSplits`. Every one of these produced a bug where two screens disagreed. | Fixed case by case. The general fix is a single reader per fact (`bkBoatIdOf`, `bkV2AllergyText`, `ckGroupVanId` are the good examples) — **use them, don't re-read the raw fields.** |
| **Pre-built lookups going stale** | `PO_KIND` and `RT_ADDON_DEFS` are assembled once from raw arrays that two different paths overwrite. Both went stale; one of them crashed a third of the stock-item buttons for months. | **Closed as a class.** `laRebuildDerived()` (`§laDerived`) is the single rebuild, called from the end of `_laReloadData` and the end of `08-app.js`. **Add any new pre-built lookup to that one function.** The `ZZMARK` detector re-runs in minutes and proves there are no others. |
| **No automated test gate** | The regression suite is real and effective, but it is run by hand from a scratch directory. A new contributor would not know it exists. | `HANDOFF.md` §5. Moving `/tmp/w` into the repo and wiring CI is the obvious upgrade. |
| **Single 63k-line file** | `08-app.js` holds booking, pricing, pier, vans, accounting and printing. Changes are safe only because of the `§tag` comments and the patch-with-assert discipline. | Do **not** attempt a modularisation; 2,218 inline handlers depend on the global scope. Treat the tags as the module boundary instead. |
| **Backup cadence** | The newest export is the only way to inspect live data from outside the app. On 2026-09-14 the gap was 3 days and a reported booking simply wasn't there yet. | Ask for a fresh export before investigating anything recent. |

---

## 6 · Suggested next actions, in order

1. **Work the 30 food-note bookings**, future travel dates first. Highest real-world consequence
   of anything on this list.
2. **Build the save-diff audit** for `bkV2CommitBooking`. It closes the bug class that produced
   three of this cycle's incidents rather than the fourth instance of it.
3. **Repair the 86 stale contract rate types** with a reviewed one-shot pass.
4. **Move the test harness into the repo** and run `t_smoke` + `t_vals` in CI. `§testUI` has already
   started this (`test/ui/`); finish it, and bring the `ZZMARK` stale-table detector along — it is
   cheap to run and it caught a live crash.
5. Decide on ใบยื่นเจ้าท่า / ใบสั่งงานมัคคุเทศก์ food coverage (deferred, not closed).
6. Two offers left unanswered on 17 Sep: whether the printed guide sheet should split a multi-van
   booking into **one row per van** (a larger change than the header fix), and whether the on-screen
   van header needs the second van's full details too.

---

## 7 · Where to read next

| Question | File |
|---|---|
| How do I work on this without breaking it? | `HANDOFF.md` |
| How does it run / deploy / authenticate? | `README.md` |
| How is it put together? | `ARCHITECTURE.md` → `allotment_v2/docs/workflows/README.md` |
| Why is this odd block written this way? | `grep '§tagname' allotment_v2/js/` — the comment above it |
| What was asked for and not built? | `BACKLOG.md` |
