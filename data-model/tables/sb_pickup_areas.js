'use strict';

// sb_pickup_areas. Column format: data-model/README.md
module.exports = [
  {
    table: "sb_pickup_areas",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "sb_pickup_areas[].id (record id; generated if absent)" },
      { name: "name", type: "text", kind: "scalar", source: "name" },
      { name: "zone", type: "text", kind: "scalar", source: "zone" },
      { name: "region", type: "text", kind: "scalar", source: "region" },
      { name: "timegroup", type: "text", kind: "scalar", source: "timeGroup" },
    ],
  },
];
