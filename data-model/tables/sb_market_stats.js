'use strict';

// sb_market_stats. Column format: data-model/README.md
module.exports = [
  {
    table: "sb_market_stats",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "sb_market_stats map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "sb_market_stats map key (original)" },
      { name: "value", type: "text", kind: "map_value_json", source: "sb_market_stats[key] value" },
    ],
  },
];
