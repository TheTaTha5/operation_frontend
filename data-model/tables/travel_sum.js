'use strict';

// travel_sum. Column format: data-model/README.md
module.exports = [
  {
    table: "travel_sum",
    columns: [
      { name: "id", type: "text", kind: "pk", source: "travel_sum map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "travel_sum map key (original)" },
      { name: "decision", type: "text", kind: "scalar", source: "travel_sum[key].decision" },
      { name: "amount", type: "bigint", kind: "scalar", source: "travel_sum[key].amount" },
      { name: "note", type: "text", kind: "scalar", source: "travel_sum[key].note" },
      { name: "by", type: "text", kind: "scalar", source: "travel_sum[key].by" },
      { name: "at", type: "text", kind: "scalar", source: "travel_sum[key].at" },
    ],
  },
];
