'use strict';

// van_bill. Column format: data-model/README.md
module.exports = [
  {
    table: "van_bill",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "van_bill map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "van_bill map key (original)" },
      { name: "value", type: "text", kind: "map_value_json", source: "van_bill[key] value", note: "ทั้งก้อนเป็น JSON text เหมือน vanjob_sent — perPax/rate/rows/extra/by/at เพิ่มช่องได้โดยไม่ต้องแตะ DB" },
    ],
  },
];
