'use strict';

// trip_actuals. Column format: data-model/README.md
module.exports = [
  {
    table: "trip_actuals",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "trip_actuals map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "trip_actuals map key (original)", note: "'YYYY-MM-DD::boatId' · คีย์เดียวกับ trips / fleet_daily / pier_job" },
      { name: "value", type: "text", kind: "map_value_json", source: "trip_actuals[key] value", note: "ของจริงรายทริป · ตอนนี้มี meal (ต้นทุนอาหารที่ส่งร้านจริง) · หน้า P&L ใช้ทับค่าประมาณจากสูตร" },
    ],
  },
];
