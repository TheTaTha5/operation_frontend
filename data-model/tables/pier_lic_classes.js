'use strict';

// pier_lic_classes. Column format: data-model/README.md
module.exports = [
  {
    table: "pier_lic_classes",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "pier_lic_classes[].id (record id; generated if absent)" },
      { name: "typeid", type: "text", kind: "scalar", source: "typeId" },
      { name: "name", type: "text", kind: "scalar", source: "name" },
      { name: "maxgt", type: "double precision", kind: "scalar", source: "maxGt" },
      { name: "maxbhp", type: "double precision", kind: "scalar", source: "maxBhp" },
      { name: "ord", type: "bigint", kind: "scalar", source: "ord" },
    ],
  },
];
