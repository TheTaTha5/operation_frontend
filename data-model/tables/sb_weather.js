'use strict';

// sb_weather. Column format: data-model/README.md
module.exports = [
  {
    table: "sb_weather",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "sb_weather[].id (record id; generated if absent)" },
      { name: "routeid", type: "text", kind: "scalar", source: "routeId" },
      { name: "date", type: "text", kind: "scalar", source: "date" },
      { name: "reason", type: "text", kind: "scalar", source: "reason" },
      { name: "at", type: "text", kind: "scalar", source: "at" },
      { name: "note", type: "text", kind: "scalar", source: "note" },
    ],
  },
];
