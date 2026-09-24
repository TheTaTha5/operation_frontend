'use strict';

// vanjob_th_flag. Column format: data-model/README.md
module.exports = [
  {
    table: "vanjob_th_flag",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "vanjob_th_flag map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "vanjob_th_flag map key (original)" },
      { name: "value", type: "text", kind: "map_value_json", source: "vanjob_th_flag[key] value" },
    ],
  },
];
