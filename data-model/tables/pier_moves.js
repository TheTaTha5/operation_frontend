'use strict';

// pier_moves. Column format: data-model/README.md
module.exports = [
  {
    table: "pier_moves",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "pier_moves[].id (record id; generated if absent)" },
      { name: "date", type: "text", kind: "scalar", source: "date" },
      { name: "pier", type: "text", kind: "scalar", source: "pier" },
      { name: "itemid", type: "text", kind: "scalar", source: "itemId" },
      { name: "boatid", type: "text", kind: "scalar", source: "boatId" },
      { name: "type", type: "text", kind: "scalar", source: "type" },
      { name: "qty", type: "bigint", kind: "scalar", source: "qty" },
      { name: "frombucket", type: "text", kind: "scalar", source: "from" },
      { name: "fine", type: "double precision", kind: "scalar", source: "fine" },
      { name: "finepaid", type: "boolean", kind: "scalar", source: "finePaid" },
      { name: "note", type: "text", kind: "scalar", source: "note" },
      { name: "by", type: "text", kind: "scalar", source: "by" },
      { name: "at", type: "text", kind: "scalar", source: "at" },
    ],
  },
];
