'use strict';

// routes and its child tables. Column format: data-model/README.md
module.exports = [
  {
    table: "routes",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "routes[].id (record id; generated if absent)" },
      { name: "name", type: "text", kind: "scalar", source: "name" },
      { name: "islands", type: "text", kind: "scalar", source: "islands" },
      { name: "mealvenueid", type: "text", kind: "scalar", source: "mealVenueId", note: "ร้านอาหารกลางวันประจำเส้นทางนี้ · อ้าง meal_venues.id · ว่าง = เส้นทางนี้ไม่มีอาหารกลางวัน" },
      { name: "color", type: "text", kind: "scalar", source: "color" },
      { name: "pier", type: "text", kind: "scalar", source: "pier" },
      { name: "kind", type: "text", kind: "scalar", source: "kind", note: "§routeKind · ชนิดของโปรแกรม · marine = ทริปเรือ · land = ไม่ใช้เรือ (City Tour / Transfer) · null = ยังไม่เคยตั้ง ถอยไปดู pier='other' แบบเดิม" },
      { name: "dailycap", type: "bigint", kind: "scalar", source: "dailyCap", note: "§otherPier · โควตาที่นั่งต่อวันของโปรแกรมบก (ไม่มีเรือให้นับ) · null = ไม่จำกัด · เส้นทางเรือไม่ใช้ค่านี้" },
      { name: "familyid", type: "text", kind: "scalar", source: "familyId", note: "§famField · กลุ่มโปรแกรมที่เส้นทางนี้สังกัด · เดิมเดาจากชื่อเส้นทางตอน render · null = ยังไม่เคยตั้ง (ถอยไปใช้การเดา) · empty string = ตั้งใจไม่ผูกกลุ่ม" },
      { name: "sort", type: "bigint", kind: "scalar", source: "sort" },
      { name: "code", type: "text", kind: "scalar", source: "code", note: "รหัสสั้นที่ผู้ใช้ตั้งเอง · ใช้แสดงในช่องวันของตารางการทำงาน · ไม่ตั้งก็เดาจากชื่อเส้นทาง" },
      { name: "extid", type: "text", kind: "scalar", source: "extId", note: "§b2cCatalog · id ของสินค้า/ตัวย่อยฝั่ง B2C ที่เส้นทางนี้ถูกสร้างขึ้นมาให้ (POW-008) · null = สร้างเองในหน้า Config ไม่ได้มาจาก B2C · เป็นกุญแจกันสร้างซ้ำของ POST /api/b2c/routes" },
    ],
  },
  {
    table: "routes__times",
    primaryKey: "row_pk",
    foreignKeys: [{ column: "routes_id", references: "routes.id" }],
    columns: [
      { name: "routes_id", type: "text", kind: "fk", source: "(link) routes.id" },
      { name: "idx", type: "bigint", kind: "synthetic", source: "(order) position in times[]" },
      { name: "row_pk", type: "text", kind: "synthetic-pk", source: "(generated child key)" },
      { name: "value", type: "text", kind: "array_scalar", source: "times[] (element)" },
    ],
  },
  {
    table: "routes__seasons",
    primaryKey: "row_pk",
    foreignKeys: [{ column: "routes_id", references: "routes.id" }],
    columns: [
      { name: "routes_id", type: "text", kind: "fk", source: "(link) routes.id" },
      { name: "idx", type: "bigint", kind: "synthetic", source: "(order) position in seasons[]" },
      { name: "row_pk", type: "text", kind: "synthetic-pk", source: "(generated child key)" },
      { name: "id", type: "text", kind: "scalar", source: "seasons[].id" },
      { name: "type", type: "text", kind: "scalar", source: "seasons[].type" },
      { name: "from", type: "text", kind: "scalar", source: "seasons[].from" },
      { name: "to", type: "text", kind: "scalar", source: "seasons[].to" },
    ],
  },
  {
    table: "routes__overrides",
    primaryKey: "row_pk",
    foreignKeys: [{ column: "routes_id", references: "routes.id" }],
    columns: [
      { name: "routes_id", type: "text", kind: "fk", source: "(link) routes.id" },
      { name: "key", type: "text", kind: "map_key", source: "(map key of routes.overrides)" },
      { name: "row_pk", type: "text", kind: "synthetic-pk", source: "(generated child key)" },
      { name: "value", type: "text", kind: "map_value_json", source: "routes.overrides[key] value" },
    ],
  },
];
