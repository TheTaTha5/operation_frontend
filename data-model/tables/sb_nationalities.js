'use strict';

// sb_nationalities. Column format: data-model/README.md
module.exports = [
  {
    table: "sb_nationalities",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "sb_nationalities[].id (record id; generated if absent)" },
      { name: "code", type: "text", kind: "scalar", source: "code" },
      { name: "name", type: "text", kind: "scalar", source: "name" },
      { name: "custom", type: "boolean", kind: "scalar", source: "custom" },
    ],
  },
];
