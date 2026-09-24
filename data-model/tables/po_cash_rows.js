'use strict';

// po_cash_rows. Column format: data-model/README.md
module.exports = [
  {
    table: "po_cash_rows",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "po_cash_rows[].id (record id)", note: "pier petty cash day ledger · one row per entry · was one JSON string per pier, which the server replaced wholesale so two people at one pier erased each other" },
      { name: "pier", type: "text", kind: "scalar", source: "po_cash_rows[].pier" },
      { name: "date", type: "text", kind: "scalar", source: "po_cash_rows[].date" },
      { name: "kind", type: "text", kind: "scalar", source: "po_cash_rows[].kind" },
      { name: "txt", type: "text", kind: "scalar", source: "po_cash_rows[].txt" },
      { name: "amt", type: "bigint", kind: "scalar", source: "po_cash_rows[].amt" },
      { name: "at", type: "text", kind: "scalar", source: "po_cash_rows[].at" },
      { name: "by", type: "text", kind: "scalar", source: "po_cash_rows[].by" },
      { name: "ts", type: "text", kind: "scalar", source: "po_cash_rows[].ts" },
      { name: "src", type: "text", kind: "scalar", source: "po_cash_rows[].src" },
    ],
  },
];
