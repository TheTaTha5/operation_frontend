'use strict';

// po_cash_lt. Column format: data-model/README.md
module.exports = [
  {
    table: "po_cash_lt",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "po_cash_lt[].id (record id)", note: "longtail sheet · id is pier|date|boat so the same cell from two devices merges instead of duplicating" },
      { name: "pier", type: "text", kind: "scalar", source: "po_cash_lt[].pier" },
      { name: "date", type: "text", kind: "scalar", source: "po_cash_lt[].date" },
      { name: "bid", type: "text", kind: "scalar", source: "po_cash_lt[].bid" },
      { name: "n", type: "bigint", kind: "scalar", source: "po_cash_lt[].n" },
      { name: "nj", type: "bigint", kind: "scalar", source: "po_cash_lt[].nj" },
      { name: "nc", type: "bigint", kind: "scalar", source: "po_cash_lt[].nc" },
      { name: "amt", type: "bigint", kind: "scalar", source: "po_cash_lt[].amt" },
      { name: "note", type: "text", kind: "scalar", source: "po_cash_lt[].note" },
      { name: "by", type: "text", kind: "scalar", source: "po_cash_lt[].by" },
      { name: "ts", type: "text", kind: "scalar", source: "po_cash_lt[].ts" },
    ],
  },
];
