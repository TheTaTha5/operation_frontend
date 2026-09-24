'use strict';

// pier_codes. Column format: data-model/README.md
module.exports = [
  {
    table: "pier_codes",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "pier_codes[].id (record id; generated if absent)" },
      { name: "code", type: "text", kind: "scalar", source: "code" },
      { name: "label", type: "text", kind: "scalar", source: "label" },
      { name: "color", type: "text", kind: "scalar", source: "color" },
      { name: "bg", type: "text", kind: "scalar", source: "bg" },
      { name: "kind", type: "text", kind: "scalar", source: "kind" },
      { name: "ord", type: "bigint", kind: "scalar", source: "ord" },
      { name: "active", type: "boolean", kind: "scalar", source: "active" },
    ],
  },
];
