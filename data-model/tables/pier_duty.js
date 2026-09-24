'use strict';

// pier_duty. Column format: data-model/README.md
module.exports = [
  {
    table: "pier_duty",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "pier_duty map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "pier_duty map key (original)" },
      { name: "value", type: "text", kind: "map_value_json", source: "pier_duty[key] value", note: "ค่าเป็น array ของ staffId — เก็บทั้งก้อนเป็น JSON text เหมือน vanjob_sent · เพิ่มคนหรือเปลี่ยนรูปแบบไม่ต้องแตะ DB" },
    ],
  },
];
