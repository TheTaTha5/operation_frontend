# Rule: a write touches only what changed

- **Applies to:** the Vue app (`apps/web`) and operation-backend
- **Decided:** 2026-09-25
- **Why:** legacy saved whole records, and that let one person's edit silently undo another's

## The rule

1. **The client sends only the fields that changed.**
   - A `PATCH` body holds just those fields.
   - Collections (trips, passengers) are sent only when the user changed them.
2. **The server writes only the rows those fields live in.**
   - No delete-and-re-insert of a record's children to apply a change.
   - A field the request does not mention keeps its value.
3. **Rows keep their ids across edits.**
   - Nothing attached to a row (van data, lock draws, check-in, boat assignment) may depend on the row surviving by luck.
   - An id is never rebuilt from a position.
4. **Separate concerns get separate endpoints.** Van assignment, boat assignment, re-confirm and check-in write their own tables through `/operations/*`. They never write the booking.
5. **A write answers with what it changed** (the updated record or trip slice). The client replaces that part of its state and re-renders only that part.

## Where the project stands

| Part | Today | Meets the rule? |
|---|---|---|
| Legacy `allotment_v2` + `server.js` | A `/api/v1/_batch` `patch` loads the record, merges it, then deletes and re-inserts the record and its child rows (`server.js:2752-2775`). `/api/save` diffs the whole blob. | No. Frozen; not being fixed. |
| Vue app | Read-only; no booking writes yet | Starts compliant: every new write follows the rule |
| operation-backend: booking header | `UPDATE` of the mentioned columns only (`src/domain/postgres-operations.ts:327-334`) | Yes |
| operation-backend: trips | `writeTrips` deletes and re-inserts every trip on **every** amendment, header-only included (`:236-250`, `:322`), and on partial-cancel (`:349`). Ids are `trip_<booking>_<seq>`. | **No.** Fix: `apps/web/docs/handoff/van-endpoints.md` §2.1 (b) |
| operation-backend: passengers | The whole list is replaced when sent (`:252`, `:337`) | Acceptable for now: nothing attaches to a passenger yet. Revisit with per-passenger check-in. |
| operation-backend: cancel, seat locks, deployments | Single-row updates / upserts | Yes |
| Van assign (planned) | Own tables, one row per action (`apps/web/docs/porting/van-mode.md` §4a) | Yes |

## Checklist for a new write

Client:
- The body holds only changed fields.
- The response replaces local state; there is no full reload.

Server:
- An unmentioned field is unchanged.
- There is a test for "edit field A does not touch field B / child rows".

Both: nothing that hangs off the changed record loses its id.
