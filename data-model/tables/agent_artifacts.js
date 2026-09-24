'use strict';

// agent_artifacts. Column format: data-model/README.md
module.exports = [
  {
    table: "agent_artifacts",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "agent_artifacts map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "agent_artifacts map key (original)" },
      { name: "value", type: "text", kind: "map_value_json", source: "agent_artifacts[key] value" },
    ],
  },
];
