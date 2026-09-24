'use strict';

// meal_venues. Column format: data-model/README.md
module.exports = [
  {
    table: "meal_venues",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "ทะเบียนร้านอาหาร · meal_venues[].id (record id; generated if absent)" },
      { name: "name", type: "text", kind: "scalar", source: "name", note: "ชื่อร้าน" },
      { name: "place", type: "text", kind: "scalar", source: "place", note: "เกาะ / จุดจอดที่ขึ้นกินข้าว" },
      { name: "price_ad", type: "numeric", kind: "scalar", source: "priceAd", note: "ราคาต่อหัว ผู้ใหญ่" },
      { name: "price_ch", type: "numeric", kind: "scalar", source: "priceCh", note: "ราคาต่อหัว เด็ก" },
      { name: "phone", type: "text", kind: "scalar", source: "phone", note: "เบอร์ติดต่อร้าน" },
      { name: "eta", type: "text", kind: "scalar", source: "eta", note: "เวลาที่เรือถึงร้านโดยประมาณ เช่น 09:30 · ไปขึ้นบนใบสั่งอาหารให้ร้านเตรียมของทัน · ระบบรู้แค่เวลาออกจากท่า" },
      { name: "note", type: "text", kind: "scalar", source: "note" },
      { name: "active", type: "boolean", kind: "scalar", source: "active", note: "ปิดร้านแทนการลบ · ทริปเก่ายังอ่านราคาที่ใช้จริงตอนนั้นได้" },
    ],
  },
];
