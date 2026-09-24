'use strict';

// fleet_fuelprice. Column format: data-model/README.md
module.exports = [
  {
    table: "fleet_fuelprice",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "fleet_fuelprice map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "fleet_fuelprice map key (original)" },
      { name: "value", type: "text", kind: "map_value_json", source: "fleet_fuelprice[key] value" },
    ],
  },
];
