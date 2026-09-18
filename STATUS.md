# LOVE Andaman — Allotment v2 · Project Status

**As of:** 2026-09-18 · branch `lk-inbox` @ `§rateBind` · **1 commit ahead of origin**
(everything up to `§rtExpiry` is pushed and live; only `§rateBind` is waiting)
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

### 2026-09-18 — changing an agent's Rate Type from the Agents page was silently undone

Found while starting the season-schedule work, and it had to land first, because the season list
would have been eaten by the same mechanism.

The Agent→Rate Type binding is stored **twice**: `sb_agents[].rateTypeId` and a sidecar
`sb_agents_rate_bindings`. On load `_rtRestore` lets the sidecar overwrite the agent record. But the
two writers each wrote only one store — `rtPersist` (Rate Types page) the sidecar, `sbAgentsPersist`
(Agents page) the agent record.

So: change an agent's rate on the **Agents** page, save, reload — **the sidecar puts the old rate
back**, with no error and nothing on screen. Reproduced in the harness before fixing: set SAYAMA to
`RT - Main 26-27 TH-WW`, save, reload → back to `Special RATE Sayama LOW 2026`. Changes made on the
**Rate Types** page stuck, which is why the two stores had drifted for 32 agents in the same
direction and the effective prices still happened to be the intended ones.

| Tag | What was wrong | Measured result |
|---|---|---|
| `§rateBind` | Two stores, two writers, one store each. A rate change from the Agents page never reached the store that wins at load. | Both writers now write both stores. The same reproduction now keeps the new rate across reload. |
| `§rateBind` (guard) | `sbAgentsPersist()` is also called by seed blocks that run **before** `_rtRestore` in file order. Writing the sidecar there would push the stale `sb_agents` values over the newer sidecar — silently re-pricing every drifted agent. | `_LA_RATE_BIND_READY` opens only at the end of `_rtRestore`; before that the sidecar is left untouched. |

**The sidecar still wins at load, deliberately.** It has been there since the initial commit with no
recorded rationale, so it was kept rather than removed. That choice is what makes this safe: every
one of the 32 drifted agents keeps the exact rate the system was already using. **No price moves.**
Asserted in the test, not assumed.

Side effect worth having: `sb_agents[].rateTypeId` in an export is now true. Until today anything
reading it — a report, a script, a BI pull — got the wrong rate for those 32 agents. It got this
session's own first set of numbers wrong before the harness caught the disagreement.

`test/ui/t_ratebind.mjs` (7 checks, `npm run test:ratebind`) reloads the page twice and pins:
the Agents-page change survives, the Rate Types-page change lands in both stores, the guard refuses
to write the sidecar before the restore, and — the one that matters most — no already-drifted agent's
effective rate moves. Proven to fail: revert either writer → `พัง 1` each; remove the guard → `พัง 1`.
Suite green: `t_smoke` พัง 2 (environment-only), `t_mobile` · `t_fleetcal` · `t_daydetail` ·
`t_ovnmeal` · `t_ratexp` all พัง 0.

### 2026-09-18 — 172 agents are riding a rate that expires in 26 days, and nothing says so

Asked from the Agent screen: SAYAMA's rate covers 16 May → 14 Oct 26 — what gets used after that?

**The same one.** `validTo` is a label, not a gate; `§promoMx` says so deliberately, because the main
rate is the fallback that must always exist. The side effect is that the day it expires, pricing
carries on silently.

Measured on the 17 Sep backup, read the way the app reads it:

| | |
|---|---|
| Rate types expiring within 60 days, with agents on them | **12** |
| Agents riding them | **172** (biggest: `RT-MAIN TH-WW Low-Promotion`, 15 Oct, **151 agents**) |
| Of those, agents who sell a route their rate cannot price | **38** — Similan/Surin have no low-season price because the park is shut, so on the first day of the season the Save button locks (`noRate`) |
| Trips already booked to travel after 14 Oct on an expiring rate | **11** · 54 pax |
| Price drift where both rates price the route | Phi Phi Bamboo 1,700 → 1,800 · Whale Shark 3,000 → 3,200 — **undercharged by 100–200 ฿/pax**, silently |
| Promo contracts reaching past 14 Oct, system-wide | **1** — the promo overlay is not being used for the season change |
| Agents whose main contract names a *different* rate than the binding | **90**, of which **76** name `RT - Main 26-27 TH-WW` — the successor is already written down, just never applied |

SAYAMA shows the last row on one screen: the contract card reads `RT - Main 26-27 TH-WW`, the Source
line reads `MISHA-SPECIA-2 · Special RATE Sayama LOW 2026`. Pricing uses the agent binding; the card
shows the contract field. Two facts, one truth.

**`§rtExpiry` — a warning, and only a warning.** It does not touch pricing by one line. One reader,
two places that can never disagree: a panel at the top of Rate Types (every expiring set, soonest
first, agents on each, which routes will be blocked, and the successor the contract already names),
and one line in that agent's Pricing Matrix, right where the person is already reading the price.

**Found while measuring, worth its own line:** the Agent→Rate Type binding is stored **twice** —
`sb_agents[].rateTypeId` and a sidecar `sb_agents_rate_bindings`, and the sidecar overwrites the
agent record at load. They have drifted for **32 agents**. Anything reading the export's
`sb_agents[].rateTypeId` — a report, a BI pull, a script — gets the wrong rate for those 32. It read
wrong for me first, which is why the first numbers in this session were too high. The panel reads
in-memory `SB_AGENTS`, i.e. post-override, so it is correct; the export is not.

`test/ui/t_ratexp.mjs` (13 checks, `npm run test:ratexp`) pins the count against `SB_AGENTS`, pins
that the sidecar won, and pins the two rules this panel must never break: an expired rate still
prices, and an expired rate still appears. Proven to fail: make the panel read a different agent set
→ `พัง 1`; drop already-expired rates from the panel → `พัง 1`. Suite green: `t_smoke` พัง 2
(environment-only), `t_mobile` · `t_fleetcal` · `t_daydetail` · `t_ovnmeal` all พัง 0.

**Still open — the question that started this.** A rate list with priority 1/2/3 was asked for.
Priority already exists on Promotion, and a second priority ladder is two ladders that can disagree.
Agreed direction instead: **a season schedule on the main rate** — several rates, each with a date
range, non-overlapping, no priority, last one open-ended so a booking can never fall into a gap with
no price. Promotion keeps overlaying on top, untouched. Not built yet.

### 2026-09-18 — the OVN return day was being treated as a day at anchor

Reported from the floor: the kitchen popup surfaced an overnight pickup so its meal could be set,
pointed the user at the boat job sheet — and the job sheet had no meal field at all.

One idea was wrong in two places: **an OVN pickup was not counted as "this boat runs a route today".**

| Tag | What was wrong | Measured result |
|---|---|---|
| `§ovnRet` | `pjBoatSt` called any day where `hold.from !== date` a mid-span day. An island hold spans the day out **through the day back**, so the return day — when the boat actually sails home loaded — was classed "เหมาลำค้างเกาะ". `going` was false, so the whole `ครัว · ร้านอาหาร` block never rendered, and the card carried a false `⚠ โปรแกรมค้าง` with an `เอาออก` button beside a live trip. | Mid-span is now strictly between `from` and `to`. Oceanus, hold 16→18 Sep: 16 `run` · 17 `ovn` · **18 `run`**. Kitchen block present, false stale warning gone. |
| `§mealOvnRt` | The kitchen card read its route from `B.torder[0]`, but `§ovnCard` files pickup rows under `B.ovn` and never touches `torder`. A boat whose only job that day is the pickup got route `''` → no venue → no amount → **no send button at all**, under the message "ยังไม่ได้ตั้งร้านให้เส้นทางนี้" — while `r10` had ร้านอาหารต้นไทร set all along. | Falls back to the pickup rows' own `routeId`. Card now shows *Phi Phi Bamboo by Speedboat · ร้านอาหารต้นไทร 210/105*; pressing รวมอาหาร computes **฿2,520** (210 × 12). |

The Daily Log and Boat Status were already right — both gave Oceanus a full row on the 18th
(PAX 12, fuel, engine hours, water, เบิกของ). Only the boat job sheet and the kitchen card
disagreed, which is why the number looked recorded and the meal did not.

**Answering the question directly:** yes, the return day must be recordable. The boat is at sea,
carrying people who eat on the way in. A hold of *N* nights has *N+1* working days, not *N−1*.

`test/ui/t_ovnmeal.mjs` (13 checks, `npm run test:ovnmeal`) pins all of it — the per-day status
ladder, the route fallback, the ฿ figure, and the §mealOvn rule that the send button stays disabled
until every pickup is marked. Proven to fail: reverting `§ovnRet` gives `พัง 2`, reverting
`§mealOvnRt` gives `พัง 5`. Regression suite unchanged: `t_smoke` พัง 2 (environment-only, as
always), `t_mobile` · `t_fleetcal` · `t_daydetail` all พัง 0.

### 2026-09-17 — "what came in today", in one place

| Tag | What was wrong | Measured result |
|---|---|---|
| `§dayDetail` | The two Live bookings cards answer *"what arrived just now"* and nothing else. The list is the **12 most recent**, unfiltered by day and including cancellations; the summary strip above it counts **only that day's non-cancelled** bookings (`§liveAudit` says the two deliberately don't add up). Nobody could ask the dashboard *"what came in today, all of it, B2C vs B2B"* — that meant opening Booking and filtering by hand. | A popup off both cards. Both summary cards stay on screen together (that is the whole point of "แยก B2C/B2B" — a toggle would make the split unreadable); clicking one switches the breakdown below. Breakdown by route, by agent (B2C: by the channel the guest messaged in on), by travel month, by hour of arrival, by nationality. The list is **every booking of the day** — 17 Sep: **23 B2B rows** where the feed can show 12. |

Three reader rules, not four: `laIsB2C` (`§b2cOne`) splits the sides, `_dashBkDay`
(`§liveDay`) decides which day a booking belongs to, `acctBookingTotal` is the money. The popup
re-reads none of them raw — that is why its numbers cannot drift from the card's.
`laB2CChannel` is new and joins them: the channel lived in `b2cChannel` **or** in the `note`
line the website writes, and two readers of that would have been the next `§b2cOne`.

A second pass on the owner's feedback (`§dayDetail2`): the sheet is **full-screen** (a 14px
margin round a page that is open all day bought nothing and shortened the one long thing on it, the
booking list); **nationality moved to a card of its own**, so the breakdown row is four cards, all
four measured on the same ruler (ยอดขาย) so bar lengths compare across them; and the way in moved
off the card header — where it crowded the B2B/B2C pill onto a second line — down beside
"อัปเดตเองไม่ต้องรีเฟรช", which is already the card's line about the feed itself.

That pass also found a real bug the first one shipped: the popup header reused `.dv-kpi` from the
Dashboard's own header, whose narrow-screen rule is `width:100%` + `margin-right:-92px` — written
for a bar that has a floating button in its right corner. The popup has no such button, so at
390px the chips ran **82px past the right edge and took the close button off-screen with them —
no way out of the popup on a phone**. It threw no error, so `t_smoke` could not see it. Own class
(`.dv-ddkpi`), and `t_daydetail` now opens the popup at 390×812 and asserts 0px overflow with the
close button on screen.

A third pass added a **date range** (`§ddRange`): four presets (วันนี้ / 7 วัน / 30 วัน / เดือนนี้,
all anchored to the real today) plus two date inputs for anything they don't cover, and `‹ ›` now
steps by the whole window instead of by one day. The range lives in `_ddFrom`/`_ddTo`, deliberately
**not** in `_dashDate`: every card on the Dashboard behind it (seat calendar, Boat Operating,
Bookings/day) is a single-day view and could not render a range. A one-day range still drives
`_dashDate`, so the old behaviour — close the popup and the page is on the day you were looking at —
is unchanged; a real range leaves the page alone.

Two things the range forced:

- **A row cap.** 30 days of real intake is **1,194 bookings** (`2026-08-19 → 09-17`), and the B2B
  list alone is 1,085 rows. Measured: 300 rows repaint in **32–42 ms**, all 1,085 in **101 ms** — so
  the cap is for scroll weight, not for a stall. The list draws 300 and says so on the card, with a
  click to draw the rest; the summary numbers always count every booking in the range, never just
  the drawn rows.
- **The hour strip becomes a day strip** when the range is longer than a day. Hour-of-day summed
  over 30 days answers nothing; which days were heavy does.

It also surfaced a bug from the first pass: clicking a row called `dashOpenBooking`, which navigates
to Booking **behind** a full-screen overlay that never closed — the click looked like it did nothing.
Rows now close the sheet first, and the test asserts it.

### 2026-09-17 — `§b2cChan`, the channel card was reading voucher numbers as channels

The owner spotted rows in "ช่องทางที่ลูกค้าทักเข้ามา" named `LOV-1601617`, `LOV-6882506`,
`LOV-2168403` — one row each. `laB2CChannel`, written for `§dayDetail`, took the second segment of
the website's `note` line as the channel. That line has **two shapes**, and only the first has one:

```
B2C · Line OA · LOV-2892592 · Day Trip - Phi Phi - Maiton     ← channel present
B2C · LOV-2766863 · Day Trip - Phi Phi Island                 ← no channel; segment 2 is the voucher
```

**84 of 304** website bookings are the second shape, so the card grew **84 channels that are really
one booking each** — the four real channels were buried under a wall of voucher numbers. Segment 2
is now taken only when it is not that booking's own `voucherRef` (and does not look like a reference
code). Measured on live data: **84 distinct "channels" → 7**, and the untagged 84 land in one row.

They are labelled **ไม่ได้ระบุช่องทาง**, not "Website": they come from `b2c_sync` (23), `BD` (52)
and four named staff (9), so there is no single origin to infer, and a guess here would quietly
distort the number the owner reads to decide marketing spend. 84 of 367 B2C bookings with no channel
recorded is itself the finding.

`t_daydetail` now asserts the invariant that catches this whole class: **no booking's channel may
equal its own `voucherRef` or `id`**, plus a bound on the channel count. Reverting to the old parser
prints `พัง 2`.

`test/ui/t_daydetail.mjs` (`npm run test:daydetail`) recomputes the expected numbers from
`SB_BOOKINGS` inside the same page and compares them against what the popup renders. **Proven to
fail**: swap the day rule to `bookingDate` and it reports `พัง 4` — B2B drops 22 → 17 because five
of that day's bookings were keyed retroactively. Regression: `t_smoke` and `t_mobile` both print
exactly what they printed on `HEAD` before the change (2 environment-only failures each:
`contract-tmpl` 404, `pickupmap` needs network, `vancheckin` demo banner).

### 2026-09-17 — Fleet Calendar rebuilt around the question it is asked

| Tag | What was wrong | Measured result |
|---|---|---|
| `§fcMatrix` | The page laid a month out as *route → boats*, then appended a "Ready at pier" block per cell. It could not answer the question people actually bring to it — **"which boats are on this programme at this pier today, and what is still free there"** — without reading a whole cell. Worse, the 15 not-available boats were printed into **all 30 cells**, and their status does not change across the month; the only thing that varied was buried under a wall of repeated names. The four header counts didn't add up either: "TL 2 · VP 7 · RN 3" = 12 of 20 boats. | Rows are now **pier → programme**, columns are days, and a matrix view at **7 / 14 days** sits beside the month. Boats that are unavailable for the whole window collapse into one row per pier (14-day view: **1,136 px → 787 px**). Header counts reconcile: **TL 8 · VP 9 · RN 3 = 20**. |

A follow-up pass (`§fcEn`) dropped the page's own title block — the top bar already reads
**FLEET CALENDAR**, so the `<h1>` and its one-line description were a duplicate costing two full
rows; the view switcher moved into the top bar in their place. The same pass put **every string on
this page into English**: the owner's guests and partners read this screen, and it was the only
operations view mixing Thai labels into a table that foreign readers use. Code comments stay Thai —
their audience is whoever maintains the file, not whoever reads the screen. The two Thai strings
left on screen are boat names (`สบายดีทัวร์`, `เรือปลอม`), which are data, not labels.

`§fcFwd` changed where the matrix window starts. It had been centred on today (back 3 days for the
7-day view, back 6 for the 14-day), so half the table was days already sailed. This page is used to
plan forward — free capacity in the days ahead is the thing being looked for — so both windows now
begin on **today** and count forward; `‹` still goes back for anyone who wants the history.

`§fcPier` added the **pier filter chips** back (All piers / Tub Lamu / Visit Panwa / Ranong /
In Shop) — the rebuild had dropped them. Selecting one narrows the table *and* the three counters in
the top bar, so the header can never claim fleet-wide numbers over a single-pier table.

That same pass fixed a bug the owner caught **on a real iPhone, which no test here could have
seen**: the pinned first column did not stick, so scrolling sideways left rows of boat chips with no
label saying which programme they belonged to. Cause: `display:flex` on the sticky `<th>`. That takes
the cell out of table layout, and Safari then refuses to apply `position:sticky` — Chrome applies
both, so the dev machine looked perfect. The flex moved to an inner `<span>`. WebKit cannot be
downloaded in this sandbox, so `t_fleetcal` asserts the **condition** rather than the symptom: no
sticky `<th>` may compute to `display:flex`. Reintroducing the flex makes it report 9 offenders.

Two rules the rebuild had to settle, both written into the source:

- **Which pier a boat is at** now comes from `getBoatCurrentPier` — the same reader the Boat Status
  page groups by — not from the pier of whatever route it happens to run. That moved `Artemis`
  (registered at Tub Lamu, actually at Panwa) into Visit Panwa, and gave the 8 shop boats a group of
  their own instead of a footnote.
- **`§fcPax`, the number in each cell.** "People on the boat" (`bkBoatPaxOnBoat`, what Boat Operation
  uses) is **not** the same as "seats taken from the sellable pool" (`getAllotment`, what the
  Dashboard shows): 17 Sep Artemis reads **49** one way and **47** the other, because the second is a
  *route*-level figure that excludes charters. This page asks a *boat*-level question, so it uses the
  first — and the on-screen label says **"คนบนลำ / ที่รับได้"** so the two can never be confused.

`fcLoadMap` exists for speed: computing each cell with `bkBoatLoadOther` would be 14 days × 20 boats ×
every booking ≈ a million iterations per paint. It sweeps bookings once and `t_fleetcal` asserts the
result equals `bkBoatLoadOther` in **every** cell.

`test/ui/t_fleetcal.mjs` (`npm run test:fleetcal`) checks all 280 cells of a 14-day window against
their source readers, that no row header is a boat name (i.e. the table has not drifted back to
per-boat rows), and that at 390 px the table **scrolls** rather than being squeezed — the phone bug
this page shipped with in the mockup, where columns fell to 35 px and every label overlapped.
**Proven to fail**: swap the pier reader for `b.pier` and make `fcLoadMap` overwrite instead of
accumulate → `พัง 2` (140 wrong piers, 14 wrong loads). `t_smoke` and `t_mobile` print exactly what
they printed before.

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
7. Offered with `§dayDetail`, not requested: split the day's intake by pier/boat, a search box in
   the list, an Excel export of the day.

---

## 7 · Where to read next

| Question | File |
|---|---|
| How do I work on this without breaking it? | `HANDOFF.md` |
| How does it run / deploy / authenticate? | `README.md` |
| How is it put together? | `ARCHITECTURE.md` → `allotment_v2/docs/workflows/README.md` |
| Why is this odd block written this way? | `grep '§tagname' allotment_v2/js/` — the comment above it |
| What was asked for and not built? | `BACKLOG.md` |
