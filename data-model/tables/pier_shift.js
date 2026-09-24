'use strict';

// pier_shift. Column format: data-model/README.md
module.exports = [
  {
    table: "pier_shift",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "pier_shift map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "pier_shift map key (original)" },
      { name: "value", type: "text", kind: "map_value_json", source: "pier_shift[key] value" },
    ],
  },
];
