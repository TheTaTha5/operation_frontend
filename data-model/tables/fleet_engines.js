'use strict';

// fleet_engines and its child tables. Column format: data-model/README.md
module.exports = [
  {
    table: "fleet_engines",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "fleet_engines[].id (record id; generated if absent)" },
      { name: "brand", type: "text", kind: "scalar", source: "brand" },
      { name: "model", type: "text", kind: "scalar", source: "model" },
      { name: "serial", type: "text", kind: "scalar", source: "serial" },
      { name: "hp", type: "bigint", kind: "scalar", source: "hp" },
      { name: "boatid", type: "text", kind: "scalar", source: "boatId" },
      { name: "pos", type: "text", kind: "scalar", source: "pos" },
      { name: "status", type: "text", kind: "scalar", source: "status" },
      { name: "basehours", type: "double precision", kind: "scalar", source: "baseHours" },
      { name: "serviceinterval", type: "bigint", kind: "scalar", source: "serviceInterval" },
      { name: "buydate", type: "text", kind: "scalar", source: "buyDate" },
      { name: "note", type: "text", kind: "scalar", source: "note" },
      { name: "sparelocation", type: "text", kind: "scalar", source: "spareLocation" },
      { name: "price", type: "text", kind: "scalar", source: "price" },
      { name: "lastservicehours", type: "double precision", kind: "scalar", source: "lastServiceHours" },
      { name: "lastservicedate", type: "text", kind: "scalar", source: "lastServiceDate" },
    ],
  },
  {
    table: "fleet_engines__log",
    primaryKey: "row_pk",
    foreignKeys: [{ column: "fleet_engines_id", references: "fleet_engines.id" }],
    columns: [
      { name: "fleet_engines_id", type: "text", kind: "fk", source: "(link) fleet_engines.id" },
      { name: "idx", type: "bigint", kind: "synthetic", source: "(order) position in log[]" },
      { name: "row_pk", type: "text", kind: "synthetic-pk", source: "(generated child key)" },
      { name: "date", type: "text", kind: "scalar", source: "log[].date" },
      { name: "type", type: "text", kind: "scalar", source: "log[].type" },
      { name: "desc", type: "text", kind: "scalar", source: "log[].desc" },
      { name: "detail", type: "text", kind: "scalar", source: "log[].detail" },
      { name: "hours", type: "double precision", kind: "scalar", source: "log[].hours" },
      { name: "by", type: "text", kind: "scalar", source: "log[].by" },
      { name: "cost", type: "double precision", kind: "scalar", source: "log[].cost" },
      { name: "outcome", type: "text", kind: "scalar", source: "log[].outcome" },
      { name: "enginehours", type: "bigint", kind: "scalar", source: "log[].engineHours" },
      { name: "text", type: "text", kind: "scalar", source: "log[].text" },
    ],
  },
];
