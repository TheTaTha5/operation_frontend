# data-model

The single description of every persisted entity: how each field of the app's data (the
`loveandaman_v2` blob) maps to a table and column in Postgres schema `operation_schemas`.
`server.js` requires it at boot; it is live code, not documentation.

| Path | What it is |
|---|---|
| `tables/<entity>.js` | One file per top-level entity: its table, then its child tables (`<entity>__<field>`). |
| `index.js` | Loads the entities in order and builds `fieldMapping` (for `os_repo.js`) and `schemaModel` (for `server.js` SQL). |
| `os_repo.js` | The engine: `decomposeBlob` (app data → rows) and `assembleBlob` (rows → app data). |

TypeScript types for the Vue app are generated from here into `apps/web/src/models/generated.ts`
(`npm run gen:models`). `test/unit/data-model.test.mjs` fails if they are stale.

## Column format

```js
{ name: "voucherref", type: "text", kind: "scalar", source: "voucherRef" }
```

- `name`: the SQL column (lower case).
- `type`: `text` | `bigint` | `double precision` | `numeric` | `boolean`.
- `kind`: how `os_repo` treats the column:
  - `pk`, `fk`, `synthetic-pk` (`row_pk`) and `synthetic` (`idx`, the position in an array) are keys.
  - `scalar`: a plain value. `json_text`: any value, stored as JSON text.
  - `map_key` / `map_value` / `map_value_json`: a keyed map, one row per key.
  - `array_scalar`: an array of plain values, one row per element.
- `source`: the field's path in the app data. `os_repo` reads the real field name and nesting from it
  (`companyInfo.legalName`, `trips[].pax.ad_fr`, `(map key of times)`), so copy the pattern of a
  neighbouring column exactly.
- `note` (optional): free text.

A table's `primaryKey` / `foreignKeys` are listed only where the schema had them. `server.js` sorts
rows on load by `sort`, then by the primary key, so leaving the primary key off changes the load order.

## Adding a persisted field

1. Add the column to the entity's file in `tables/`.
2. Add a migration in `db/migrations/` that creates the column. **Ship both in the same push.** A
   column in the model that the database lacks makes every batched insert for that table fail.
3. Run `npm run gen:models`.
4. Client side: the persist helper and both load paths (see `CLAUDE.md`).

A new entity gets a new file in `tables/` and is appended to `ENTITIES` in `index.js`. The order there
is the order of top-level keys in `/api/load`.
