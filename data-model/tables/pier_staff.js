'use strict';

// pier_staff. Column format: data-model/README.md
module.exports = [
  {
    table: "pier_staff",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "pier_staff[].id (record id; generated if absent)" },
      { name: "pier", type: "text", kind: "scalar", source: "pier" },
      { name: "nick", type: "text", kind: "scalar", source: "nick" },
      { name: "name", type: "text", kind: "scalar", source: "name" },
      { name: "role", type: "text", kind: "scalar", source: "role" },
      { name: "phone", type: "text", kind: "scalar", source: "phone" },
      { name: "active", type: "boolean", kind: "scalar", source: "active" },
      { name: "defcode", type: "text", kind: "scalar", source: "defCode", note: "รหัสตั้งต้นในตารางการทำงาน เมื่อวันนั้นมีใบงานแล้วแต่คนนี้ไม่ได้ลงเรือ" },
      { name: "sect", type: "text", kind: "scalar", source: "sect", note: "กลุ่ม (pier_sect.id) ที่คนนี้อยู่ในตารางการทำงาน · ว่าง = ยังไม่จัดกลุ่ม" },
      { name: "note", type: "text", kind: "scalar", source: "note", note: "ช่อง REMARKS ในตารางการทำงาน · เช่น ลาออก · กลับมาช่วงไฮซีซัน" },
      { name: "ord", type: "bigint", kind: "scalar", source: "ord", note: "ลำดับของคนในกลุ่ม · ผู้ใช้ลากจัดเอง · ว่าง = ยังไม่เคยจัด ให้เรียงตามทะเบียน" },
    ],
  },
];
