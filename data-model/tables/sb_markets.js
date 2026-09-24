'use strict';

// sb_markets and its child tables. Column format: data-model/README.md
module.exports = [
  {
    table: "sb_markets",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "sb_markets[].id (record id; generated if absent)" },
      { name: "name", type: "text", kind: "scalar", source: "name" },
      { name: "color", type: "text", kind: "scalar", source: "color" },
      { name: "sort", type: "bigint", kind: "scalar", source: "sort" },
    ],
  },
  {
    table: "sb_markets__subs",
    primaryKey: "row_pk",
    foreignKeys: [{ column: "sb_markets_id", references: "sb_markets.id" }],
    columns: [
      { name: "sb_markets_id", type: "text", kind: "fk", source: "(link) sb_markets.id" },
      { name: "idx", type: "bigint", kind: "synthetic", source: "(order) position in subs[]" },
      { name: "row_pk", type: "text", kind: "synthetic-pk", source: "(generated child key)" },
      { name: "value", type: "text", kind: "array_scalar", source: "subs[] (element)" },
    ],
  },
];
