'use strict';

// fleet_drlock. Column format: data-model/README.md
module.exports = [
  {
    table: "fleet_drlock",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "fleet_drlock map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "fleet_drlock map key (original)" },
      { name: "value", type: "text", kind: "map_value_json", source: "fleet_drlock[key] value" },
    ],
  },
];
