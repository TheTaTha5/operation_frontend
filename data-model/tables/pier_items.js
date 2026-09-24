'use strict';

// pier_items. Column format: data-model/README.md
module.exports = [
  {
    table: "pier_items",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "pier_items[].id (record id; generated if absent)" },
      { name: "pier", type: "text", kind: "scalar", source: "pier" },
      { name: "kind", type: "text", kind: "scalar", source: "kind" },
      { name: "label", type: "text", kind: "scalar", source: "label" },
      { name: "total", type: "bigint", kind: "scalar", source: "total" },
      { name: "active", type: "boolean", kind: "scalar", source: "active" },
      { name: "note", type: "text", kind: "scalar", source: "note" },
    ],
  },
];
