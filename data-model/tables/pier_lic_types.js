'use strict';

// pier_lic_types. Column format: data-model/README.md
module.exports = [
  {
    table: "pier_lic_types",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "pier_lic_types[].id (record id; generated if absent)" },
      { name: "side", type: "text", kind: "scalar", source: "side" },
      { name: "short", type: "text", kind: "scalar", source: "short" },
      { name: "formal", type: "text", kind: "scalar", source: "formal" },
      { name: "perboat", type: "bigint", kind: "scalar", source: "perBoat" },
      { name: "active", type: "boolean", kind: "scalar", source: "active" },
    ],
  },
];
