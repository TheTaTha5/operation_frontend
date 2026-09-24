'use strict';

// app_hooks. Column format: data-model/README.md
module.exports = [
  {
    table: "app_hooks",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "_app_hooks map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "_app_hooks map key (original)" },
      { name: "value", type: "boolean", kind: "map_value", source: "_app_hooks[key] value" },
    ],
  },
];
