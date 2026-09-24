'use strict';

// sb_market_monthly. Column format: data-model/README.md
module.exports = [
  {
    table: "sb_market_monthly",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "sb_market_monthly map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "sb_market_monthly map key (original)" },
      { name: "value", type: "bigint", kind: "map_value", source: "sb_market_monthly[key] value" },
    ],
  },
];
