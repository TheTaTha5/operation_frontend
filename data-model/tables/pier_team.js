'use strict';

// pier_team. Column format: data-model/README.md
module.exports = [
  {
    table: "pier_team",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "pier_team map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "pier_team map key (original)" },
      { name: "value", type: "text", kind: "map_value_json", source: "pier_team[key] value" },
    ],
  },
];
