'use strict';

// vanjob_pickup_th. Column format: data-model/README.md
module.exports = [
  {
    table: "vanjob_pickup_th",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "vanjob_pickup_th map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "vanjob_pickup_th map key (original)" },
      { name: "value", type: "text", kind: "map_value", source: "vanjob_pickup_th[key] value" },
    ],
  },
];
