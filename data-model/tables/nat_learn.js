'use strict';

// nat_learn. Column format: data-model/README.md
module.exports = [
  {
    table: "nat_learn",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "nat_learn map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "nat_learn map key (original)" },
      { name: "value", type: "text", kind: "map_value_json", source: "nat_learn[key] value" },
    ],
  },
];
