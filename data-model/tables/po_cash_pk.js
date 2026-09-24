'use strict';

// po_cash_pk. Column format: data-model/README.md
module.exports = [
  {
    table: "po_cash_pk",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "po_cash_pk[].id (record id)", note: "park fee sheet · both sides kept · what the booking says vs what was paid at the gate" },
      { name: "pier", type: "text", kind: "scalar", source: "po_cash_pk[].pier" },
      { name: "date", type: "text", kind: "scalar", source: "po_cash_pk[].date" },
      { name: "bid", type: "text", kind: "scalar", source: "po_cash_pk[].bid" },
      { name: "ad_th", type: "bigint", kind: "scalar", source: "po_cash_pk[].ad_th" },
      { name: "chd_th", type: "bigint", kind: "scalar", source: "po_cash_pk[].chd_th" },
      { name: "inf_th", type: "bigint", kind: "scalar", source: "po_cash_pk[].inf_th" },
      { name: "foc_th", type: "bigint", kind: "scalar", source: "po_cash_pk[].foc_th" },
      { name: "ad_fr", type: "bigint", kind: "scalar", source: "po_cash_pk[].ad_fr" },
      { name: "chd_fr", type: "bigint", kind: "scalar", source: "po_cash_pk[].chd_fr" },
      { name: "inf_fr", type: "bigint", kind: "scalar", source: "po_cash_pk[].inf_fr" },
      { name: "foc_fr", type: "bigint", kind: "scalar", source: "po_cash_pk[].foc_fr" },
      { name: "amt", type: "bigint", kind: "scalar", source: "po_cash_pk[].amt" },
      { name: "dock", type: "bigint", kind: "scalar", source: "po_cash_pk[].dock" },
      { name: "by", type: "text", kind: "scalar", source: "po_cash_pk[].by" },
      { name: "ts", type: "text", kind: "scalar", source: "po_cash_pk[].ts" },
      { name: "src", type: "text", kind: "scalar", source: "po_cash_pk[].src" },
    ],
  },
];
