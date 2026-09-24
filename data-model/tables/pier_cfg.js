'use strict';

// pier_cfg. Column format: data-model/README.md
module.exports = [
  {
    table: "pier_cfg",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "pier_cfg map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "pier_cfg map key (original)" },
      { name: "value", type: "text", kind: "map_value_json", source: "pier_cfg[key] value" },
    ],
  },
];
