'use strict';

// boat_capovr. Column format: data-model/README.md
module.exports = [
  {
    table: "boat_capovr",
    columns: [
      { name: "id", type: "text", kind: "pk", source: "boat_capovr map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "boat_capovr map key (original)" },
      { name: "cap", type: "bigint", kind: "scalar", source: "boat_capovr[key].cap" },
      { name: "reason", type: "text", kind: "scalar", source: "boat_capovr[key].reason" },
      { name: "by", type: "text", kind: "scalar", source: "boat_capovr[key].by" },
      { name: "at", type: "text", kind: "scalar", source: "boat_capovr[key].at" },
    ],
  },
];
