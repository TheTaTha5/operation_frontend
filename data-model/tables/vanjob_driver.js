'use strict';

// vanjob_driver. Column format: data-model/README.md
module.exports = [
  {
    table: "vanjob_driver",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "vanjob_driver map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "vanjob_driver map key (original)" },
      { name: "driver", type: "text", kind: "scalar", source: "vanjob_driver[key].driver" },
      { name: "phone", type: "text", kind: "scalar", source: "vanjob_driver[key].phone" },
      { name: "plate", type: "text", kind: "scalar", source: "vanjob_driver[key].plate" },
    ],
  },
];
