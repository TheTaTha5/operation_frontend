'use strict';

// vanjob_sent. Column format: data-model/README.md
module.exports = [
  {
    table: "vanjob_sent",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "vanjob_sent map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "vanjob_sent map key (original)" },
      { name: "value", type: "text", kind: "map_value_json", source: "vanjob_sent[key] value" },
    ],
  },
];
