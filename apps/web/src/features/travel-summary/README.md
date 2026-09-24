# Travel Summary (Vue port)

`/app/travel-summary` replaces the legacy **Travel Summary** view (`allotment_v2.html?view=travelsum`) in phases.
The legacy page stays live until this one does everything it does.

| Phase | Scope | Status |
|---|---|---|
| 1 | Day overview (KPIs, fact line), full manifest, date / route / VAT / issues-only filters in the URL | done, read-only |
| 2 | Section 02: penalty decisions (`travel_sum` writes via `/api/v1/_batch`) | todo |
| 3 | Section 03: on-site money, COT deduct/payout decisions, slip upload and viewing | todo |
| 4 | Print / PDF packs | todo |

## Files

- `legacy/` is a function-for-function TypeScript port of the legacy calculations (`tsRows`, `tsNetOf`,
  `tsMoneyOf`, `ckLostByType`, ...). Each function's doc comment names the legacy function it mirrors.
  It reads the loosely shaped legacy records as `Rec` (`any`); nothing outside this folder does.
- `model.ts` turns that into a typed view model (`buildTravelSummary`), mirroring `renderTravelSum`,
  `tsManifestRow`, `tsPayCell` and `tsCxlCell` without the HTML.
- `api.ts` loads one day: bookings from `/api/ck?date=`, reference data from `/api/v1/<resource>`,
  moved-away bookings (`ops_stranded`, read via `/api/v1/_meta/ops_stranded`) by id. It never calls `/api/load`.

## Keeping it faithful

`legacy/golden.spec.ts` extracts the **real** legacy functions from `allotment_v2/js/*.js` at test time,
runs them in a `vm` sandbox on the dataset in `legacy/fixture.ts`, and compares every result with the
port. If the legacy code changes behaviour, the test fails and the port has to follow. When you add a
case to the fixture, add a line to the "reaches the branches" test so it is known to be exercised.
