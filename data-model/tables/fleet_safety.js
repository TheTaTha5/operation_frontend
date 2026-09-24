'use strict';

// fleet_safety and its child tables. Column format: data-model/README.md
module.exports = [
  {
    table: "fleet_safety",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "fleet_safety[].id (record id; generated if absent)" },
      { name: "boatid", type: "text", kind: "scalar", source: "boatId" },
      { name: "category", type: "text", kind: "scalar", source: "category" },
      { name: "name", type: "text", kind: "scalar", source: "name" },
      { name: "brand", type: "text", kind: "scalar", source: "brand" },
      { name: "model", type: "text", kind: "scalar", source: "model" },
      { name: "serial", type: "text", kind: "scalar", source: "serial" },
      { name: "qty", type: "bigint", kind: "scalar", source: "qty" },
      { name: "installdate", type: "text", kind: "scalar", source: "installDate" },
      { name: "expirydate", type: "text", kind: "scalar", source: "expiryDate" },
      { name: "nextpm", type: "text", kind: "scalar", source: "nextPM" },
      { name: "lastinspect", type: "text", kind: "scalar", source: "lastInspect" },
      { name: "status", type: "text", kind: "scalar", source: "status" },
      { name: "location", type: "text", kind: "scalar", source: "location" },
      { name: "note", type: "text", kind: "scalar", source: "note" },
    ],
  },
  {
    table: "fleet_safety__log",
    primaryKey: "row_pk",
    foreignKeys: [{ column: "fleet_safety_id", references: "fleet_safety.id" }],
    columns: [
      { name: "fleet_safety_id", type: "text", kind: "fk", source: "(link) fleet_safety.id" },
      { name: "idx", type: "bigint", kind: "synthetic", source: "(order) position in log[]" },
      { name: "row_pk", type: "text", kind: "synthetic-pk", source: "(generated child key)" },
      { name: "date", type: "text", kind: "scalar", source: "log[].date" },
      { name: "type", type: "text", kind: "scalar", source: "log[].type" },
      { name: "desc", type: "text", kind: "scalar", source: "log[].desc" },
    ],
  },
  {
    table: "fleet_safety__inspections",
    primaryKey: "row_pk",
    foreignKeys: [{ column: "fleet_safety_id", references: "fleet_safety.id" }],
    columns: [
      { name: "fleet_safety_id", type: "text", kind: "fk", source: "(link) fleet_safety.id" },
      { name: "idx", type: "bigint", kind: "synthetic", source: "(order) position in inspections[]" },
      { name: "row_pk", type: "text", kind: "synthetic-pk", source: "(generated child key)" },
      { name: "id", type: "text", kind: "scalar", source: "inspections[].id" },
      { name: "date", type: "text", kind: "scalar", source: "inspections[].date" },
      { name: "result", type: "text", kind: "scalar", source: "inspections[].result" },
      { name: "note", type: "text", kind: "scalar", source: "inspections[].note" },
      { name: "by", type: "text", kind: "scalar", source: "inspections[].by" },
    ],
  },
];
