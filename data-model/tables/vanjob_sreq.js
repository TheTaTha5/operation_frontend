'use strict';

// vanjob_sreq. Column format: data-model/README.md
module.exports = [
  {
    table: "vanjob_sreq",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "vanjob_sreq map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "vanjob_sreq map key (original)" },
      { name: "value", type: "text", kind: "map_value_json", source: "vanjob_sreq[key] value" },
    ],
  },
];
