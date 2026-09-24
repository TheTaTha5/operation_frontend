'use strict';

// insurance_overrides. Column format: data-model/README.md
module.exports = [
  {
    table: "insurance_overrides",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "insurance_overrides map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "insurance_overrides map key (original)" },
      { name: "value", type: "text", kind: "map_value_json", source: "insurance_overrides[key] value" },
    ],
  },
];
