'use strict';

// app_meta. Column format: data-model/README.md
module.exports = [
  {
    table: "app_meta",
    primaryKey: null,
    foreignKeys: [],
    columns: [
      { name: "key", type: "text", kind: "map_key", source: "top-level key 'version'" },
      { name: "value", type: "text", kind: "map_value_json", source: "top-level value of 'version'" },
    ],
  },
];
