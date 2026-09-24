'use strict';

// sb_vehicles and its child tables. Column format: data-model/README.md
module.exports = [
  {
    table: "sb_vehicles",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "sb_vehicles[].id (record id; generated if absent)" },
      { name: "name", type: "text", kind: "scalar", source: "name" },
      { name: "plate", type: "text", kind: "scalar", source: "plate" },
      { name: "type", type: "text", kind: "scalar", source: "type" },
      { name: "capacity", type: "bigint", kind: "scalar", source: "capacity" },
      { name: "ownership", type: "text", kind: "scalar", source: "ownership" },
      { name: "costperday", type: "numeric", kind: "scalar", source: "costPerDay", note: "ค่ารถต่อวันของคันนี้ · รถบริษัทคิดน้ำมัน+คนขับ รถเช่าคิดค่าเช่า · ว่าง = ใช้ค่าตั้งต้นตามประเภท" },
      { name: "partnername", type: "text", kind: "scalar", source: "partnerName" },
      { name: "zonebase", type: "text", kind: "scalar", source: "zoneBase" },
      { name: "active", type: "boolean", kind: "scalar", source: "active" },
      { name: "note", type: "text", kind: "scalar", source: "note" },
      { name: "color", type: "text", kind: "scalar", source: "color" },
      { name: "driver", type: "text", kind: "scalar", source: "driver" },
      { name: "driverphone", type: "text", kind: "scalar", source: "driverPhone" },
      { name: "dayzone_2026_06_12", type: "text", kind: "scalar", source: "dayZone.2026-06-12" },
    ],
  },
  {
    table: "sb_vehicles__log",
    primaryKey: "row_pk",
    foreignKeys: [{ column: "sb_vehicles_id", references: "sb_vehicles.id" }],
    columns: [
      { name: "sb_vehicles_id", type: "text", kind: "fk", source: "(link) sb_vehicles.id" },
      { name: "idx", type: "bigint", kind: "synthetic", source: "(order) position in log[]" },
      { name: "row_pk", type: "text", kind: "synthetic-pk", source: "(generated child key)" },
      { name: "at", type: "text", kind: "scalar", source: "log[].at" },
      { name: "kind", type: "text", kind: "scalar", source: "log[].kind" },
      { name: "text", type: "text", kind: "scalar", source: "log[].text" },
    ],
  },
  {
    table: "sb_vehicles__statusranges",
    primaryKey: "row_pk",
    foreignKeys: [{ column: "sb_vehicles_id", references: "sb_vehicles.id" }],
    columns: [
      { name: "sb_vehicles_id", type: "text", kind: "fk", source: "(link) sb_vehicles.id" },
      { name: "idx", type: "bigint", kind: "synthetic", source: "(order) position in statusRanges[]" },
      { name: "row_pk", type: "text", kind: "synthetic-pk", source: "(generated child key)" },
      { name: "s", type: "text", kind: "scalar", source: "statusRanges[].s" },
      { name: "from", type: "text", kind: "scalar", source: "statusRanges[].from" },
      { name: "to", type: "text", kind: "scalar", source: "statusRanges[].to" },
      { name: "note", type: "text", kind: "scalar", source: "statusRanges[].note" },
    ],
  },
  {
    table: "sb_vehicles__dayroute",
    primaryKey: "row_pk",
    foreignKeys: [{ column: "sb_vehicles_id", references: "sb_vehicles.id" }],
    columns: [
      { name: "sb_vehicles_id", type: "text", kind: "fk", source: "(link) sb_vehicles.id" },
      { name: "key", type: "text", kind: "map_key", source: "(map key of sb_vehicles.dayRoute)" },
      { name: "row_pk", type: "text", kind: "synthetic-pk", source: "(generated child key)" },
      { name: "value", type: "text", kind: "map_value_json", source: "sb_vehicles.dayRoute[key] value" },
    ],
  },
  {
    table: "sb_vehicles__daystatus",
    primaryKey: "row_pk",
    foreignKeys: [{ column: "sb_vehicles_id", references: "sb_vehicles.id" }],
    columns: [
      { name: "sb_vehicles_id", type: "text", kind: "fk", source: "(link) sb_vehicles.id" },
      { name: "key", type: "text", kind: "map_key", source: "(map key of sb_vehicles.dayStatus)" },
      { name: "row_pk", type: "text", kind: "synthetic-pk", source: "(generated child key)" },
      { name: "value", type: "text", kind: "map_value_json", source: "sb_vehicles.dayStatus[key] value" },
    ],
  },
];
