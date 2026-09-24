'use strict';

// ts_cot. Column format: data-model/README.md
module.exports = [
  {
    table: "ts_cot",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "ts_cot map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "ts_cot map key (original)" },
      { name: "mode", type: "text", kind: "scalar", source: "ts_cot[key].mode" },
      { name: "deduct", type: "bigint", kind: "scalar", source: "ts_cot[key].deduct" },
      { name: "payout", type: "bigint", kind: "scalar", source: "ts_cot[key].payout" },
      { name: "ref", type: "text", kind: "scalar", source: "ts_cot[key].ref" },
      { name: "slips", type: "text", kind: "json_text", source: "ts_cot[key].slips" },
      { name: "by", type: "text", kind: "scalar", source: "ts_cot[key].by" },
      { name: "at", type: "text", kind: "scalar", source: "ts_cot[key].at" },
    ],
  },
];
