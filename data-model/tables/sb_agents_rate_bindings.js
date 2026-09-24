'use strict';

// sb_agents_rate_bindings. Column format: data-model/README.md
module.exports = [
  {
    table: "sb_agents_rate_bindings",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "sb_agents_rate_bindings[].id (record id; generated if absent)" },
      { name: "ratetypeid", type: "text", kind: "scalar", source: "rateTypeId" },
    ],
  },
];
