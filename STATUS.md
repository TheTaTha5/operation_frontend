# LOVE Andaman — Allotment v2 · Project Status

**As of:** 2026-09-14 · branch `lk-inbox` @ `898a866` · **1,401 commits** · working tree clean,
**0 commits ahead of origin** (everything pushed)
**Data snapshot:** `allotment_v2/data_exports/backup_2026-09-14_1355.json` (22.2 MB)

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

Ten commits, all measured before and after, all with the regression suite green
(68 views · 21 value sets unchanged · registry clean).

### Data integrity — the seams

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
| **Same fact stored in two places** | Charter boat lived in `charterBoatId` *and* `ops.boatId`; allergies live in `allergyList` *and* `allergies`; slot labels lived globally *and* per-boat. Every one of these produced a bug where two screens disagreed. | Fixed case by case. The general fix is a single reader per fact (`bkBoatIdOf`, `bkV2AllergyText` are the good examples) — **use them, don't re-read the raw fields.** |
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
4. **Move the test harness into the repo** and run `t_smoke` + `t_vals` in CI.
5. Decide on ใบยื่นเจ้าท่า / ใบสั่งงานมัคคุเทศก์ food coverage (deferred, not closed).

---

## 7 · Where to read next

| Question | File |
|---|---|
| How do I work on this without breaking it? | `HANDOFF.md` |
| How does it run / deploy / authenticate? | `README.md` |
| How is it put together? | `ARCHITECTURE.md` → `allotment_v2/docs/workflows/README.md` |
| Why is this odd block written this way? | `grep '§tagname' allotment_v2/js/` — the comment above it |
| What was asked for and not built? | `BACKLOG.md` |
