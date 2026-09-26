# Porting spec: Agent List (`data-view="agents"`)

- **Revised 2026-09-26:** phase 1 is built against this contract, before the backend has shipped it.
  - **Code:** `ob.agents / agent / markets / salesPeople / rateTypes / agentActivity / agentBookings` (types `ObAgent*` in `apps/web/src/lib/ob.ts`), `stores/agents.ts`, `features/agents/` (`AgentsView`, `AgentBar`, `AgentList`, `AgentDetail`, `AgentInfoTab`, `AgentBookingsTab`, `AgentActivityTab`, `agentRules.ts`), routes `/agents` and `/agents/:id`, and the first shared `styles/components.css` (`.chip`, `.tabs`, `.callout`) with the status tokens in `styles.css`.
  - **While the backend answers 404:** the page says "Agents are not in operation-backend yet".
  - **Differences from the plan below:**
    - The summary row carries `has_contact` and the client works out the missing fields (`agentRules.incompleteFields`), instead of the server sending `incomplete[]`.
    - `ob.agentBookings` also filters rows by `agent_id` client-side, so a backend that ignores the new filter cannot show other agents' bookings.
    - Credit "used" shows "not available yet" (§5 Q4 default).
    - The store test lives in `AgentsView.spec.ts` (load, 404, 403, bookings, activity).

- **Legacy entry point:** `renderAgents()` (`allotment_v2/js/08-app.js:6072`), dispatched from `allotment_v2/js/04-data-core.js:701`. Markup: `#view-agents` (`allotment_v2/allotment_v2.html:641-770`).
- **Helpers in scope:** almost everything is in `allotment_v2/js/agents.js` (4,253 lines, 174 functions; moved verbatim out of 08-app.js, `agents.js:1-3`):
  - **Header strip:** `renderAgKPI` (`08-app.js:6300`)
  - **List and filters:** `agRenderFilters` (`agents.js:1059`), `agRenderList` (`1216`), `agSelect` (`1357`)
  - **Detail:** `agRenderDetail` (`2334`). Tabs: `agTabInfo` (`2416`), `agTabPrices` (`2753`), `agTabHist` (`3223`), `agTabContracts` (`3157`), `agTabActivity` (`3440`), `agTabRate` (`3271`). Alerts: `agAlerts` (`2136`)
  - **Edit modal:** `agEditOpen` / `agEditRender` / `agEditSave` (`1372`, `1448`, `2038`)
  - **New agent:** `agNew` / `agNewRender` / `agCreateSubmit` (`3557`, `3680`, `3786`)
  - **Table view:** `agRenderTable` (`790`), bulk and fill-down (`738`, `775`)
  - **Import:** `agImportPick` → `agImportApply` (`333-503`)
  - **Add-ons:** `agpRenderAddonSection` and `agp*` (`2926-3136`)
  - **Programs picker:** `agProgPicker` (`656`)
  - **Code in agents.js that belongs to other screens, not this port:**
    - `tm*` (`3849-4117`): Team & Markets
    - `aos*` (`4112-4253`): Add-on Services master list
    - `agProgBulk*` (`951-1046`): Rate Admin page
    - The contract wizard, renewal, artifacts and PDF: `contracts.js`
- **Already ported:** none. The Vue bookings pages show raw `agent_id` with the tooltip "agent name not in operation-backend yet" (`apps/web/src/features/bookings/ByTripView.vue`).
- **Backend checked at:** `operation-backend@347a19b` plus its uncommitted working copy (015/016, `src/tools/import-legacy.ts`). **operation-backend has no agents at all.**
- **Date:** 2026-09-26

---

## 1. Functionality

### Purpose
The sales team keeps the list of resellers (travel agents) here. Each agent has its company and contract details, owner salesperson, market, payment and credit terms, the rate type that prices its bookings, and the programmes (routes) it may sell. The screen flags agents that cannot be sold correctly, for example with no rate, an unpriced route, an expiring contract or credit over the limit.

### Inputs
| Source | What is read | Where |
|---|---|---|
| `SB_AGENTS` | `id, code, name, market, sub, sales, color, payType, vatMode, creditDays, creditLimit, creditBalance, contact, email, phone, note, rateTypeId, rateSeasons[], contractTemplateId, programs[], programPeriods[], companyInfo{legalName,taxId,tatLicense,address,tel,hotline,fax,website}, agentSignatory{name,designation,tel,signedDate}, bookingChannel{method,cutoff,cancelPolicy,email,phone}, contractStatus, contractVersion, contractStart, contractEnd, contractHistory[], addonServices[], activity[]` | declared `08-app.js:330`, loaded `:411`, `:996` |
| `sb_agents_rate_bindings` sidecar | overrides `a.rateTypeId` / `a.rateSeasons` at load | `08-app.js:6269-6284` |
| `SB_MARKETS` | `{id, name, color, subs[]}` | `08-app.js:93` |
| `SB_SALES` | `{id, code, name, fullName, designation, email, tel, color, signature}` | `08-app.js:141` |
| `SB_PAYMENT_TYPES` | `proforma / invoice / bt / cot` with `short, needCredit, cot` | `08-app.js:111` |
| `SB_RATE_TYPES` | `id, code, name, color, active, owner, routes[], routeValidity{}, validFrom, validTo, seatRates{}` (only presence per route matters here, except on the Pricing tab) | `rates.js` |
| `SB_CONTRACTS` | main / promo contracts per agent: `kind, status, rateTypeId, programPeriods, activeFrom/To, version` | `contracts.js`; promo panel `agents.js:2835-2891` |
| `SB_BOOKINGS` | credit used (`agCreditState` `157-172`), Recent Bookings (`3223`) | — |
| `SB_ADDON_SVCS` | hard-coded master list, no load or persist | `08-app.js:8878` |
| Session | `laCanEditArea('sales')`, `laGuardEdit('sales')`, `laIsAdmin()` (delete), sales scoping `laSalesScoped` / `laScopeAgents` / `laAgentInScope` (a salesperson sees only agents where `a.sales === salesId`) | `01-auth-sync.js:1057`, `08-app.js:1172-1182`, `agents.js:2336-2341` |
| sessionStorage `la_view` | `{view, ag: _agSelected}`: reopens the same agent after reload | `01-auth-sync.js:450, 468` |

### Outputs

#### Rendered sections
1. **Header strip** (`renderAgKPI`, `08-app.js:6300`):
   - total agents, "N selling now" (agents with programmes)
   - a Credit chip (invoice agents plus the sum of `creditLimit`)
   - a "⚠ Needs action N" chip with a popover from `agHdScan` (`agents.js:1150-1175`)
   - the Card/Table toggle and the Excel form / Import / + New Agent buttons
2. **Card view:**
   - **Left:** the A–Z list with search and a filter popover (market / salesperson). Each row shows initials in the market colour, name, contract dot, incomplete badge, market / sub, payment chip, programme count and salesperson badge (`1216`).
   - **Right:** the detail panel (`2334`), with a header (name, market chip, Generate Contract / Edit / Delete) and 6 tabs:
     - **Information** (`2416`), five blocks:
       1. Needs action (`agAlerts`, `2136`)
       2. Commercial: contract, credit and payment, booking channel
       3. Rate used for pricing
       4. Programs sold (`programPeriods`: booking period entered by hand, travel period from the rate type's `routeValidity`)
       5. Company & contact
     - **Pricing Matrix** (`2753`): contracts/promotion panel, the bound rate type's price body, then add-on services
     - **Recent Bookings** (`3223`): 15 per page, read-only
     - **Generated Contracts** (`3157`): list of generated contract documents
     - **Activity** (`3440`): audit log, newest first
     - **Rate Type** (`3271`): bound rate plus the season schedule editor (`rtm*`, `rates.js:2561-2627`)
3. **Table view** (`790`): a spreadsheet over all agents for mass clean-up, with gap filters (missing programs / rate / VAT / documents), inline cell edit, bulk set and fill-down (comment `08-app.js:6011-6016`: built because 24 of 129 agents were unsellable).
4. **Edit modal:** one section at a time: `sales, programs, profile, company, signatory, booking, notes, ratetype, contracttmpl` (`1372-2100`).
5. **New-agent form** (`3680`): seven cards, OCR prefill from a document photo, duplicate warning.
6. **Import:** an Excel upload matched to existing agents, a preview of the writes per row, then apply (`agents.js:173-503`).

#### Writes (all through `sbAgentsPersist`, `08-app.js:434` → `/api/v1/_batch`)
| Action | Fields written | Legacy |
|---|---|---|
| Create | whole agent; id `LA_UID('a')`; code = name uppercased, alphanumerics, 8 chars (not unique-checked); programmes auto-filled from the rate type (`agProgFill`); contract defaults seeded | `agCreateSubmit` `3786` |
| Edit `sales` | `sales` | `agEditSave` `2038` |
| Edit `profile` | `payType, vatMode, creditDays, creditLimit, creditBalance` | same |
| Edit `company` | `name, market, sub, email, color, companyInfo` (**drops `taxId`**, bug) | same, `2078-2080` |
| Edit `signatory` / `booking` / `notes` / `contracttmpl` | the nested object / `note` / `contractTemplateId` | same |
| Edit `programs` | `programPeriods[]` and `programs[]` | same, `2060` |
| Edit `ratetype` | `rateTypeId`, then MAIN contracts follow (`_ctSyncMainRate`), programmes synced (`agProgSyncOnRate` `2314`, removal needs confirm) | same |
| Rate seasons | `rateSeasons[] {rt, from, to}` | `rtmSave` `rates.js:2609` |
| Table cell / bulk / fill-down | any column in `AG_COLS` (`08-app.js:6024`) | `agTblCommit` `608`, `agBulkApply` `738`, `agFillDown` `775` |
| Programs picker (table) | `programs` only (`programPeriods` untouched: drift) | `agTblProgramsOpen` `644` |
| Add-ons | `addonServices[]` (**never persisted**, no column) | `agp*` `3007-3128` |
| Delete (admin) | hard `splice` / `filter`, no cascade, no log | `agDelete` `3834`, `agTblDeleteSelected` `585` |
| Import apply | creates, or fills empty fields (or overwrites when chosen); never changes `name` or `sales` of an existing agent | `agImportApply` `471` |
| Every edit except table / import / add-ons | `activity[]` entry `{at, by, kind, text}`, capped at 200 | `agLog` `7-14` |

### State
| State | Kind | Held in | Survives navigation? |
|---|---|---|---|
| selected agent | UI | `_agSelected` (`08-app.js:1250`), sessionStorage | yes → route param `/agents/:id` |
| search text | UI | `#ag-search` DOM | yes → query `?q=` |
| market / salesperson filter | UI | `_agMktFilter`, `_agSalesFilter` (`08-app.js:1251-1252`) | yes → query `?market=&sales=` |
| card / table view | UI | `_agView` (`6018`) | yes → query `?view=table` |
| detail tab | UI | DOM `.sb-tab.on` only; always resets to Information | yes → query `?tab=` (a fix) |
| table gap filter, doc columns, selection, edited cell | UI | `_agGap`, `_agDocCols`, `_agSel`, `_agCell` (`6019-6022`) | gap → query; the rest component-local |
| recent-bookings page | UI | `_agHistPage` (`6375`) | component-local |
| edit / new / season / add-on / import drafts | UI draft | `_agEditDraft`, `_agNewDraft`, `_rtmDraft`, `_agpAddonDraft`, `_agImp` | component-local |
| agents, markets, salespeople, rate types, bookings | domain | globals | backend |

### Legacy server side
- **No agent-specific endpoint.** All writes go through the generic `/api/v1/_batch` (`server.js:3221-3239`) and `/api/v1/<resource>` (`3250-3262`). They check a session and `edit !== false`, and nothing else:
  - no enums, no foreign keys, no sales scope
  - **Any editor can `DELETE /api/v1/sb_agents/<id>`**; the admin-only rule is client-side
- **Tables** (`data-model/tables/`):
  - `sb_agents`: flattened `companyinfo_*`, `agentsignatory_*`, `bookingchannel_*`
  - `sb_agents__programs`, `__programperiods`, `__activity`, `__contracthistory`
  - `sb_agents_rate_bindings` (`id, ratetypeid` only)
  - `sb_rate_types` plus 9 child tables
  - `sb_contracts` (+ `__programperiods`)
  - `contract_templates`, `agent_artifacts` (metadata JSON, no PDF stored)
- **Fields with no column (lost on reload from Postgres):**
  - `rateSeasons[]`: it travels in the bindings sidecar, whose model has no column for it. **This affects prices by travel date.**
  - `addonServices[]`
  - `contractHistory[].snapshot.rateTypeId`
- **B2C:** `a_b2c` is a client seed (`08-app.js:456-467`). The server's B2C sync hard-codes `agentId: 'a_b2c'` on synced bookings (`server.js:841`).
- **No views, functions or triggers** over these tables. `sb_contracts.agentid` has no FK, so deleting an agent leaves orphan contracts.
- **Demo mock data in production.** `_seedContractExpiryVariety` (`agents.js:43-110`, called on every load `08-app.js:470`) rewrites contract dates for `a01, a10, a30, a40` and `a73`'s `contractHistory`, and those writes were persisted. **An import copies the mock values.** See §5 Q6.

### Domain rules that must survive the port
- **Cancelled statuses** (`cancelled, cancelled_weather, rejected`) are excluded from credit used. Also excluded: `quote`, `draft` and bookings already paid (`agCreditState`, `agents.js:157-172`; `ACCT_PAID_STATES` `08-app.js:1367`).
- **Rate binding** (root CLAUDE.md, *Rates and agents*: rate types bind via `agent.rateTypeId`):
  - Inactive rates can't be newly bound (`1784-1795`).
  - A salesperson sees their own rates plus shared ones (`rtScopeList` / `rtForSales`, `rates.js:663-668`), and the currently bound rate always shows.
- **"Priced"** means the route is in `rt.seatRates`, not merely in `rt.routes` (`agRtRoutes` `2269`).
- **Validity dates don't stop pricing.** A rate's validFrom/To does not stop charging (`2798-2809`). Seasons switch the rate by travel date; outside every season, the bound rate applies (`3405-3419`).
- **Contract dates:**
  - expired = `contractEnd` < today
  - expiring = 0–60 days (`contracts.js:16`)
  - Info tag red at ≤30 days, amber at ≤60 (`2512-2515`)
- **Credit:** the alert is red when over the limit, amber at ≥80 % (`2146-2159`), invoice agents only.
- **Alert order** (`agAlerts` `2136`):
  1. credit
  2. contract expired / expiring
  3. no rate bound
  4. route with no price
  5. rate expiring with no season
  6. rate not started
  7. contract ≠ bound rate
  8. incomplete profile (`agIncompleteFields` `1206`: market, sales, payType, rateTypeId, programmes, one of email/phone/contact)
- **Header "Needs action"** counts only agents with programmes: `norate`, `exp`, `orph`, `drift` (`agHdIssues` `1150`).
- **Travel period** comes from `rt.routeValidity[route]`; the booking period is entered by hand (`agEditRenderPP` `1913`).
- **Dates:** build with the local-date helper, never `toISOString().slice(0,10)` (root CLAUDE.md). Legacy breaks this in `_ctTodayISO` and the seeds.

### Edge cases
- **Empty states:**
  - no selection: "เลือก Agent จากเมนูด้านซ้ายเพื่อดูรายละเอียดและราคา" (`08-app.js:6081`)
  - no match: "ไม่พบ Agent ที่ตรงเงื่อนไข" (`1289`)
  - out-of-scope agent: "เอเยนต์รายนี้ไม่ได้อยู่ในความดูแลของคุณ" (`2339`)
  - no bookings, no activity, no rate on the Pricing tab (red box, add-ons hidden, `2775-2784`)
- **House agents** `a_walkin`, `a_staff` and `a_b2c` are re-seeded by legacy on every load (`08-app.js:436-466`). They have no special handling on the screen.
- **Phone width:** the side list collapses behind a "Browse" toggle (`agSideToggle` `1199`, CSS §agPhone `01-base.css:3238-3290`).
- **Legacy bugs to fix, not copy** (from the code read, `agents.js`):
  1. The company edit wipes `companyInfo.taxId` (`2080`).
  2. The payment enums disagree: `bank` vs `bt` (`1532`), `cash` in the import guide (`304`), and import doesn't validate them.
  3. The rate picker in the edit modal ignores the agent's salesperson (`1767-1770`).
  4. The header "Edit" button is a stub alert (`3833`).
  5. Add-ons are never saved, "add" commits before the price dialog, and each action jumps back to Information (`3024-3128`).
  6. `programs` and `programPeriods` drift apart: the table, bulk and import edit only `programs` (`644`, `2060`).
  7. Hard-coded 2025-10-01 → 2026-09-30 book dates (`2000`, `2023`).
  8. List search throws when an agent has no `code` or `name` (`1227`, `1238`).
  9. Unscoped counts shown to scoped salespeople (`1293`, `536`).
  10. Edits by view-only users look saved, then vanish on reload (`sbAgentsPersist` silently returns).
  11. Hard deletes leave bookings pointing at a missing agent.
  12. The nav badge says "within 30 days" but counts 60 days (`3138`).
  13. Recent Bookings includes cancelled bookings, in array order (`3223`).
  14. `a.name`, `a.note` etc. are interpolated into HTML unescaped (XSS, `2352-2369`). Vue escapes by default.

---

## 2. Style

### Legacy rules found
All in `allotment_v2/css/01-base.css`, scoped `#view-agents …`. There is no JS-injected style and nothing in `03-trippl.css`. The file restyles the same selectors in up to five layers (card → §agSheet → §agStd); the later layer wins:

| Selector group | File:line | Notes (winning source) |
|---|---|---|
| tokens `--fd-*`, `--ag-*` | `01-base.css:1418-1434`, `3046-3051` | `--ag-ink #101828 / #475467 / #667085 / #98A2B3`, `--ag-line #E4E7EC`, `--ag-line2 #F2F4F7`, `--ag-soft #F9FAFB`, `--ag-navy #16265C`, plus red/amber/blue/green triplets |
| coral accent | `02-skins.css:173` | the live skin turns every `--fd-coral*` into ocean blue `#1683C7 / #E1F0FA / #F1F8FD / #0E6AA8` |
| page and layout `.sb-wrap / .sb-side / .sb-main` | `1437-1573` | grid `340px 1fr`, sticky side card, radius 22 |
| list rows `.sb-ag-row`, `.sb-ag-dot`, `.ag-row-*`, `.ag-pay-chip`, `.ag-prog-chip`, `.ag-ct-dot` | `1521-1553` | `.sel` still has a hard-coded coral border that clashes with the blue skin |
| header `.ag-hd*`, `.ag-chip`, `.ag-seg`, `.ag-hd-pop` | `2978-3034` | sticky, navy gradient `rgba(22,38,92,.96)→rgba(12,24,62,.94)`, radius 14 |
| tabs `.sb-tab` | `1556-1573`, `3224-3226` | one horizontally scrolling row |
| Information `.agi-*` | `2179-2276`, `2894-2966`, `3160-3235` | programmes grid changes at 1540 / 1440 / 1279 / 900 px |
| boxes and alerts `.ag-band`, `.ag-als/.ag-al`, `.ag-grp/.ag-box`, `.ag-tag`, `.ag-sh`, `.ag-bar` | `3056-3141` | 12-column grid, boxes span 6 (4 at ≥1500) |
| edit modal `.ag-edit-*` | `2279-2292` | z 200, backdrop `rgba(20,20,20,.4)` with blur, card 680 px, radius 18, `90dvh` (`02-skins.css:919-922`) |
| form `.ag-fld*`, `.ag-need`, `.ag-sub-dd*`, `.ag-pp-*` | `2530-2565` | inputs radius 10, focus ring; `.ag-need` `#E5484D` on `#FEF3F2` |
| pricing `.agp-*` | `2568-2623` | — |
| filter popover `.ag-filter-*`, `.fp` | `2638-2697` | 320 px, radius 14 |
| phone §agPhone | `3238-3290`; `02-skins.css:705-706, 782-787, 829-834, 887-889` (`!important`) | single column at ≤820 / ≤900 |

**Dead rules, not ported:**
- `.ag-filter-bar*`
- `.agi-sales-*`, `.agi-info-card*`, `.agi-grid*`, `.agi-sig-*`, `.agi-prog-summary*`, `.agi-rtchip`
- `.ag-stats`, `.ct-banner`, `#view-agents .sb-kpi*`

**Inline styles:** 439 `style="` against 341 `class=` in agents.js, with the table view, Rate Type tab, import, pickers and activity almost all inline. They become classes in the port.

### Class mapping
New port, so BEM:

| Legacy | BEM | Notes |
|---|---|---|
| `.ag-hd`, `.ag-hd-n`, `.ag-chip`, `.ag-hd-pop` | `.agent-bar`, `__count`, `__chip`, `__chip--warn`, `__issues` | header strip |
| `.ag-seg b.on` | global `.seg`, `.seg__btn--on` | card/table toggle |
| `.sb-wrap`, `.sb-side`, `.sb-main` | `.agent-page`, `__side`, `__main` | |
| `#ag-search`, `.ag-filter-btn`, `.ag-filter-pop`, `.fp` | `.agent-filter`, `__search`, `__btn`, `__pop`, `.chip--toggle` | |
| `.sb-ag-row(.sel)`, `.sb-ag-dot`, `.ag-row-meta/-mkt/-sub`, `.ag-ct-dot`, `.sb-sales-badge` | `.agent-row`, `--selected`, `__avatar`, `__meta`, `__market`, `__sub`, `__contract-dot`, `__sales` | |
| `.ag-pay-chip`, `.ag-prog-chip`, `.ag-tag(.red/.amb/.blu/.grn)` | global `.chip` + `.chip--danger/--warn/--info/--ok` | |
| `.sb-main-hd`, `.sb-main-ttl` | `.agent-detail__head`, `__title` | |
| `.sb-tab(.on)` | global `.tabs`, `.tabs__tab--on` | |
| `.ag-band` (`.ttl`, `.rule`, `.act`) | `.agent-band`, `__title`, `__action` | section heading |
| `.ag-als`, `.ag-al(.red/.amb/.blu)`, `.sev/.t/.d/.go`, `.ag-ok` | `.agent-alerts`, `.agent-alert--danger/--warn/--info`, `__sev`, `__title`, `__detail`, `__go`, `.agent-alerts__ok` | |
| `.ag-grp`, `.ag-box(.c3…)`, `.bh` | `.agent-boxes`, `.agent-box`, `--wide`, `__head` | |
| `.ag-sh .r .k / .v / .sub` | global `.details` (already in `styles.css`) | label/value rows |
| `.agi-prog-wrap/-header/-row/-name`, `.agi-period-val` | `.agent-programs`, `__head`, `__row`, `__name`, `__period` | |
| `.ag-edit-modal`, `.ag-edit-card`, `.ag-edit-btn(.primary/.ghost)` | global `.dialog`, `__card`, `.btn--primary`, `.btn--ghost` | |
| `.ag-fld`, `.ag-fld-lbl`, `.ag-fld-row(-3)`, `.ag-fld-hint`, `.ag-need` | global `.field`, `__label`, `.field-row`, `.field-row--3`, `__hint`, `.field--missing` | |
| `.ag-pp-*` | `.agent-periods__*` | programmes editor |
| `.agtbl-*` (inline today) | `.agent-sheet`, `__cell`, `__cell--empty`, `__bulk` | table view, phase 3 |

### Tokens
| Legacy value | Token | New? | Light / Dark |
|---|---|---|---|
| `--ag-ink #101828` | `--text` | existing | |
| `--ag-ink3 #667085` | `--muted` | existing | |
| `--ag-line #E4E7EC` | `--border` | existing | |
| `--ag-soft #F9FAFB` | `--surface-2` | new | `#F9FAFB` / `#1b2a31` |
| coral-as-ocean `#1683C7` | `--accent` | existing (`#0c7c8c`) | the port follows the app accent, not the legacy skin |
| `--ag-navy #16265C` (header) | `--brand-navy` | new | `#16265C` / `#0e1a3d` |
| red text / bg / border | `--danger`, `--danger-bg`, `--danger-line` | new | `#B42318 #FEF3F2 #FECDCA` / `#F97066 #3a1614 #7a271a` |
| amber | `--warn`, `--warn-bg`, `--warn-line` | new | `#B54708 #FFFAEB #FEDF89` / `#FDB022 #3a2a0c #7a4a0a` |
| blue | `--info`, `--info-bg`, `--info-line` | new | `#175CD3 #EFF8FF #B2DDFF` / `#53B1FD #0f2a44 #1d4a7a` |
| green | `--ok`, `--ok-bg`, `--ok-line` | new | `#067647 #ECFDF3 #ABEFC6` / `#47CD89 #0d2e1f #1a5c3c` |
| market / salesperson / agent colours | data | — | from `markets.color`, `sales.color`, `agents.color` |

The four status triplets are global, because the seat-lock and van specs need the same set.

### Style block plan
- **Create `apps/web/src/styles/components.css`**, imported from `main.ts`. It doesn't exist yet; the seat-lock and van-mode specs plan it too. Blocks:
  - `.btn`, `.chip`, `.seg`, `.tabs`, `.field`
  - `.dialog`: no `backdrop-filter` on the card (it holds selects); a plain dim backdrop
  - `.callout`
  - Each block's first comment lists `features/agents/*` as its users.
- **Status tokens** go in `apps/web/src/styles.css`, with dark values in its existing `prefers-color-scheme: dark` block.
- **Feature-only BEM blocks** (`agent-bar`, `agent-page`, `agent-row`, `agent-detail`, `agent-band`, `agent-alerts`, `agent-boxes`, `agent-programs`, `agent-periods`, `agent-sheet`) live in each component's `<style scoped>`.
- **Legacy `!important`s not copied:** the search box and count (`01-base.css:1514-1516`, `.sb-ag-dot`, `.sb-sales-badge`) and all the `02-skins.css` phone overrides.
- **Sticky:** the header strip is `position: sticky; top: var(--topbar)`. The side list is sticky under it, at `top: calc(var(--topbar) + <bar height var>)`.
- **Phone:**
  - ≤900 px: one column, the list behind a toggle.
  - Programmes table: stacked rows.
  - Table view: horizontal scroll inside its card.

---

## 3. Data model

Backend checked at `operation-backend@347a19b` plus the working copy.
- There are no `agents`, `markets`, `sales` or `rate_types` tables and no endpoints.
- `bookings.agent_id`, `bookings.rate_type_ref` and `seat_locks.agent_id` are free `TEXT` with no FK (`002_booking_source_data.sql:3,5`, `001_operations.sql:27`).
- Snapshots already on bookings: `payment_*`, `market_agent_id` (`011_booking_header_columns.sql:83-89`).
- The import (`src/tools/import-legacy.ts`, untracked) copies agent ids as text and reads none of the agent tables (`:140-148`, `:199`, `:414`).
- No pricing logic exists (`booking-header.ts` only stores `price_*`).
- `/v1/*` routes need `booking:read` / `booking:write` (`src/routes/operations.ts:184-190`).

| Legacy field / action | Backend endpoint + field | In `ob.ts`? | Status |
|---|---|---|---|
| agent list (name, code, market, sub, sales, payType, color, programme count, contract status/end, rate type id, incomplete flags) | `GET /v1/agents` | no | missing |
| full agent (company, signatory, booking channel, credit terms, note, programme periods, contract fields) | `GET /v1/agents/:id` | no | missing |
| markets + sub-markets | `GET /v1/markets` | no | missing |
| salespeople | `GET /v1/sales` | no | missing |
| rate types (summary: `id, code, name, color, active, owner, valid_from, valid_to, priced_routes[], route_validity{}`) | `GET /v1/rate-types` | no | missing |
| payment types | — | — | derivable: a constant in the frontend (`proforma, invoice, bt, cot`, `08-app.js:111`); fix the `bank` / `cash` mismatch |
| agent colour fallback | — | — | derivable: `agentColor` in `features/bookings/byTrip.ts` (legacy `bkV2AgentColor`) |
| alerts / incomplete / needs-action / "selling now" | — | — | derivable client-side from agent + rate type summary + contract dates (`agAlerts` `2136`, `agHdIssues` `1150`, `agIncompleteFields` `1206`), except credit used |
| credit used / available | `GET /v1/agents/:id` → `credit: {limit, used, available, pct}` | no | missing. Needs a server rule; the backend has no invoices/payments, so "used" = unpaid totals is not computable yet (Q4) |
| recent bookings of an agent | `GET /v1/bookings?agent_id=&limit=&cursor=` (sorted by `booking_date` desc) | partly (`bookingsBetween` has no agent filter) | missing: filter + sort on the existing endpoint |
| activity log | `GET /v1/agents/:id/activity` | no | missing; needs actor stamping (`request.user` is never read, per the van hand-off) |
| create | `POST /v1/agents` | no | missing |
| edit a section | `PATCH /v1/agents/:id` (partial, per `apps/web/docs/partial-updates.md`) | no | missing |
| programme periods | `PUT /v1/agents/:id/programs` | no | missing |
| rate binding (+ MAIN contract follows) | `PATCH /v1/agents/:id {rate_type_id}` | no | missing (contract follow waits for contracts) |
| rate seasons | `PUT /v1/agents/:id/rate-seasons` | no | missing; **legacy never saved them to Postgres** |
| delete | `POST /v1/agents/:id/deactivate` (no hard delete; bookings keep a valid FK) | no | missing |
| add-on prices per agent | `PUT /v1/agents/:id/addons` | no | missing; legacy never saved them; the master list isn't persisted either |
| import | client-side match, then `POST` / `PATCH` per row; or `POST /v1/agents/import?dry_run=1` | no | missing (phase 3 decision, Q7) |
| pricing matrix, generated contracts, contract renewal | Rate Types and Contracts ports | — | out of scope |

### `ob.ts` additions
- `ob.agents(params?)` → `ObAgentSummary[]`; `ob.agent(id)` → `ObAgent`
- `ob.markets()` → `ObMarket[]`; `ob.salesPeople()` → `ObSalesPerson[]`; `ob.rateTypes()` → `ObRateTypeSummary[]`
- `ob.agentBookings(id, cursor?)` → `{ bookings: ObBooking[]; next_cursor? }`; `ob.agentActivity(id)` → `ObAgentActivity[]`
- Phase 2: `ob.createAgent`, `ob.patchAgent`, `ob.putAgentPrograms`, `ob.deactivateAgent`. These need `patchJson` / `putJson` and the `ApiError` changes planned in `van-mode.md` §4a.4.

### Missing endpoints (hand-off to operation-backend)

#### Tables
```sql
CREATE TABLE markets (id TEXT PRIMARY KEY, name TEXT NOT NULL, short TEXT, color TEXT, sort INTEGER);
CREATE TABLE market_subs (market_id TEXT REFERENCES markets(id), name TEXT, PRIMARY KEY (market_id, name));
CREATE TABLE sales_people (id TEXT PRIMARY KEY, code TEXT UNIQUE, name TEXT NOT NULL, full_name TEXT, designation TEXT,
  email TEXT, tel TEXT, color TEXT, active BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE agents (
  id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  market_id TEXT REFERENCES markets(id), sub_market TEXT, sales_id TEXT REFERENCES sales_people(id), color TEXT,
  pay_type TEXT NOT NULL CHECK (pay_type IN ('invoice','proforma','bt','cot')),
  vat_mode TEXT NOT NULL CHECK (vat_mode IN ('none','include','exclude')),
  credit_days INTEGER, credit_limit NUMERIC, contact TEXT, email TEXT, phone TEXT, note TEXT,
  rate_type_id TEXT, contract_template_id TEXT,
  contract_status TEXT, contract_version TEXT, contract_start DATE, contract_end DATE,
  legal_name TEXT, tax_id TEXT, tat_license TEXT, address TEXT, company_tel TEXT, hotline TEXT, fax TEXT, website TEXT,
  signatory_name TEXT, signatory_designation TEXT, signatory_tel TEXT, signatory_signed_date DATE,
  booking_method TEXT, booking_cutoff TEXT, booking_cancel_policy TEXT, booking_email TEXT, booking_phone TEXT,
  house BOOLEAN NOT NULL DEFAULT false,         -- a_walkin / a_staff / a_b2c: cannot be deactivated
  active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE agent_programs (agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE, route_id TEXT REFERENCES routes(id),
  book_from DATE, book_to DATE, note TEXT, PRIMARY KEY (agent_id, route_id));   -- travel dates come from the rate type
CREATE TABLE agent_rate_seasons (agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE, idx INTEGER,
  rate_type_id TEXT NOT NULL, from_date DATE NOT NULL, to_date DATE, PRIMARY KEY (agent_id, idx));
CREATE TABLE agent_activity (id BIGSERIAL PRIMARY KEY, agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL DEFAULT now(), by TEXT, kind TEXT NOT NULL, text TEXT NOT NULL);
```
- `credit_balance` is dropped: it is edited but never used (`agCreditState` ignores it, `agents.js:157-172`).
- `programs[]` is replaced by `agent_programs` rows. One list, so the `programs` / `programPeriods` drift is gone.
- `rate_type_id` stays unconstrained until the Rate Types port adds `rate_types`.
- After import, `bookings.agent_id` and `seat_locks.agent_id` can get an FK to `agents(id)`, once dangling ids from legacy hard deletes are listed and resolved.

#### `GET /v1/agents?market=&sales=&q=&active=true`
Summary rows for the list, the filters and the header:
```json
{ "agents": [ { "id": "a12", "code": "SUNTOUR", "name": "Sun Tour", "market_id": "ru", "sub_market": "Moscow",
  "sales_id": "s3", "pay_type": "invoice", "credit_limit": 200000, "rate_type_id": "rt007", "color": null,
  "program_route_ids": ["r5", "r6"], "contract_status": "active", "contract_end": "2026-12-31",
  "has_contact": true, "house": false, "active": true } ] }
```
- **Sales scope, server-side:** when the caller is a salesperson (token claim, Q2), return only `sales_id = caller`. Legacy only hid them in the UI (`laScopeAgents`, `08-app.js:1175`).

#### `GET /v1/agents/:id`
The full agent (every column above, grouped as `company`, `signatory`, `booking_channel`), plus `programs[]`, `rate_seasons[]` and `credit` (Q4). 404 for an unknown id, 403 when out of the caller's scope.

#### `POST /v1/agents`
- **Required:** `name, legal_name, address, market_id, rate_type_id, pay_type, vat_mode` (`agCreateSubmit`, `agents.js:3788`).
- **Id:** generated as `agent_<uuid>`, or kept as the legacy id on import.
- **Code:** generated when missing; 409 `code_taken` on a duplicate.
- **Credit:** non-invoice agents get `credit_days` / `credit_limit` 0.
- **Duplicates:** a near-duplicate name or code returns `warnings: ['possible_duplicate']` with the match. It does not block, as legacy only warns (`agFindDup` `3767`).
- **Side effects:** writes an activity row `created`. With a rate type, it fills `agent_programs` from its priced routes (`agProgFill`).
- **Response:** 201 with the full agent.

#### `PATCH /v1/agents/:id`
- **Body:** any subset of the columns; only those are written. `company` / `signatory` / `booking_channel` merge field by field, so `tax_id` survives a company edit (fixes legacy bug 1).
- **Activity:** one row per call, with the kind picked by the fields touched: `sales`, `credit`, `company`, `rate`, `contract`, `note`, `edit`.
- **Validation:** enums checked (400); an inactive rate type can't be newly bound (422 `rate_inactive`).

#### `PUT /v1/agents/:id/programs`
- **Body:** `[{route_id, book_from, book_to, note}]`, replacing the list. Rows are small and nothing hangs off them.
- **Response:** the list, with `travel_from` / `travel_to` joined from the rate type when that exists.

#### `PUT /v1/agents/:id/rate-seasons`
- **Body:** `[{rate_type_id, from, to}]`. Rows missing `rate_type_id` or `from` are dropped, and rows are sorted by `from`, as `rtmSave` does (`rates.js:2609`).
- Overlap warnings are advisory (`laSeasonIssues`).

#### `POST /v1/agents/:id/deactivate`, `POST /v1/agents/:id/activate`
- Sets `active`. 422 `house_agent` for `a_walkin` / `a_staff` / `a_b2c`.
- Admin only (`laIsAdmin`, `agents.js:3834`), enforced server-side.

#### `GET /v1/bookings?agent_id=…&sort=-booking_date`
The existing list, with an `agent_id` filter and a sort. The Recent Bookings tab excludes cancelled bookings by default (fixes legacy bug 13). `?include_cancelled=1` shows them.

#### `GET /v1/agents/:id/activity?limit=50`
Newest first: `{ at, by, kind, text }`. `by` comes from the token's `preferred_username`. This is the first real use of `request.user`.

#### `GET /v1/markets`, `GET /v1/sales`, `GET /v1/rate-types`
Reference lists as above. `rate-types` returns the summary only; full prices wait for the Rate Types port.

#### Import (`src/tools/import-legacy.ts`)
Add these tables, keeping legacy ids:
- `sb_agents` (+ `__programperiods`, `__activity`)
- `sb_agents_rate_bindings` (wins over `sb_agents.ratetypeid`, as at load, `08-app.js:6269-6284`)
- `SB_MARKETS` and `SB_SALES` (their tables in `operation_schemas`)

Special cases:
- **House agents:** `house = true`.
- **Mock data:** don't carry `contractEnd` / `contractHistory` for `a01, a10, a30, a40, a73` without checking them (Q6).
- **Programmes:** where `programs[]` has routes that `programPeriods` lacks, add them with empty book dates. Log the drift.
- **Not importable:** `rateSeasons` and `addonServices`, because they were never in Postgres.

**Scopes:** per `src/routes/operations.ts:184-190`, `/v1/agents` falls under `booking:read` / `booking:write`. Proposed: a `sales:write` scope for agent writes, since the legacy area is `sales` (`laCanEditArea('sales')`). This needs the preHandler and README scope table updated.

---

## 4. Store and component plan

The port has three phases. Phase 1 needs only the read endpoints and the import.

- **Phase 1:** read-only list and detail:
  - Header strip, filters, card list
  - Detail: Information (alerts, commercial, rate, programmes, company) and Recent Bookings
  - Activity tab
- **Phase 2:** new agent, section edits, programmes editor, deactivate.
- **Phase 3:**
  - table view (inline edit, bulk, fill-down)
  - import (SheetJS) and OCR prefill (Tesseract); both need new npm dependencies
  - rate seasons
  - add-ons, once there is a master list and backend storage
  - Pricing Matrix and Generated Contracts, which follow the Rate Types and Contracts ports

### `useAgentsStore` (`apps/web/src/stores/agents.ts`)
- **State:**
  - `summaries: ObAgentSummary[]`, `details: Map<id, ObAgent>`
  - `markets`, `salesPeople`, `rateTypes`
  - `status`, `error`
  - `bookings: Map<id, {rows, cursor}>`, `activity: Map<id, ObAgentActivity[]>`
- **URL state** (in the route, not the store): `q`, `market`, `sales`, `view`, `tab`, and the selected agent as `/agents/:id`.
- **Getters:**
  - `filtered(q, market, sales)` + `groupedAZ` (replaces `agRenderList`, `agents.js:1216-1293`; null-safe on missing `name` / `code`)
  - `filterCounts` (`agRenderFilters` `1059`)
  - `headerKpis` (`renderAgKPI`, `agHdScan` `1150-1175`)
  - `alertsFor(agent)` (`agAlerts` `2136`)
  - `incompleteFor(agent)` (`agIncompleteFields` `1206`)
  - `contractState(agent)` (`ctIsExpired` / `ctIsExpiringSoon`, `contracts.js:16-20`; local dates)
  - `rateCoverage(agent)`: missing / orphan routes (`agRtRoutes` `2269`)
- **Actions:**
  - Phase 1: `load()` (agents + markets + sales + rate types in parallel), `loadAgent(id)`, `loadBookings(id, next?)`, `loadActivity(id)`
  - Phase 2:
    - `create(draft)`: adds the summary, opens the new agent (fixes legacy `_agSelected` not set, `3786`)
    - `patch(id, fields)`: replaces the detail and its summary row, refetches activity
    - `putPrograms(id, rows)`, `deactivate(id)`
  - Every write replaces only that agent (`partial-updates.md`).
- **Stays in components:** the filter popover being open, the edit/new drafts, the table cell being edited and the ticked rows (phase 3), and the bookings page number.

### Components (`apps/web/src/features/agents/`)
- `AgentsView.vue`: route `/agents` and `/agents/:id`. Header strip + side list + detail. On phones, the list and detail are separate screens.
- `AgentBar.vue`: header strip with KPIs and the needs-action popover.
- `AgentList.vue`: search, filter popover, A–Z list.
- `AgentDetail.vue`: head and tabs (`?tab=info|bookings|activity`; later `prices|rate|contracts`).
- `AgentInfoTab.vue` (alerts, commercial, rate, programmes, company), `AgentBookingsTab.vue`, `AgentActivityTab.vue`.
- Phase 2: `AgentEditDialog.vue` (one component, a section prop), `AgentNewDialog.vue`, `AgentProgramsEditor.vue`.
- Phase 3: `AgentSheetView.vue` (`?view=table`), `AgentImportDialog.vue`, `AgentSeasonsTab.vue`.
- `agentRules.ts`: pure functions for alerts, incomplete, contract state and coverage, with unit tests.
- **Routes** (`apps/web/src/router.ts`): `{ path: '/agents', name: 'agents' }` and `{ path: '/agents/:id', name: 'agent' }`, both on `AgentsView.vue`. Remove `agents` from `legacyViews` (`apps/web/src/lib/legacy.ts`).
- **Links from existing pages:** the bookings pages' agent boxes (`ByTripView.vue`, `BookingsView.vue`, `BookingDetailView.vue`) show the agent name once `summaries` load, and link to `/agents/:id`.
- **Disabled in phase 1:** Generate Contract, Edit/New/Deactivate, the Pricing / Rate Type / Contracts tabs. Their titles read "Not moved yet". **No legacy links:** legacy is no longer reachable.
- **Tests:**
  - `agentRules.spec.ts`: each alert and its order, contract expiry at 0/30/60 days, credit 80 %/over, coverage, incomplete fields
  - `stores/agents.spec.ts`: load, filter and grouping (null name / code), scoped counts, 404 → "not in backend yet"
  - `AgentsView.spec.ts`: `fetch` stubbed like `ByTripView.spec.ts`. The list renders, a click opens the detail and sets the route, `?tab=` persists, and an out-of-scope 403 shows the legacy message.

---

## 5. Open questions
1. **Order of ports:** the Pricing Matrix and Rate Type tabs, rate binding rules and contract follow depend on rate types and contracts. Port Rate Types next, or ship agents phase 1–2 first with rate types as a summary list only? Recommended: agents first; the summary list is enough for binding and alerts.
2. **Sales scope:** the backend token carries groups only. How does operation-backend know a user's salesperson id (a claim, or a `users.sales_id` column) to scope `/v1/agents`?
3. **Delete:** legacy hard-deletes (admin). The plan replaces it with deactivate, so bookings keep a valid agent. OK?
4. **Credit used:** legacy sums unpaid booking totals, but operation-backend has no invoices or payments. Show only the limit and terms until accounting moves, or count all non-cancelled totals as "used" (overstates)?
5. **Add-ons and rate seasons:** neither was ever saved to Postgres, so production has none. Are they in use? If yes, someone re-enters them after phase 3.
6. **Mock contract data:** legacy's demo seed rewrote contract dates for `a01, a10, a30, a40` and `a73`'s contract history in production. Should the import take them as they are, or should sales confirm those five first?
7. **Import:** keep the Excel import (SheetJS) and document OCR (Tesseract) in the Vue app? Both are new dependencies; the import is how 129 agents were cleaned up.
8. **House agents** (`a_walkin`, `a_staff`, `a_b2c`): the plan marks them `house = true` (visible, editable, not deactivatable). Should they be hidden from the list instead?
