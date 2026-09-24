'use strict';

// pier_kinds. Column format: data-model/README.md
module.exports = [
  {
    table: "pier_kinds",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "pier_kinds[].id (record id; generated if absent)" },
      { name: "name", type: "text", kind: "scalar", source: "name", note: "ชื่อประเภท เช่น ตีนกบ · หน้ากาก · เสื้อชูชีพ" },
      { name: "name_en", type: "text", kind: "scalar", source: "name_en", note: "ชื่อภาษาอังกฤษ · ใช้เป็นหัวคอลัมน์ในใบเซ็นซึ่งพิมพ์เป็นภาษาอังกฤษทั้งใบ · เว้นว่างได้ จะถอยไปใช้ชื่อไทย" },
      { name: "unit", type: "text", kind: "scalar", source: "unit", note: "หน่วยนับของประเภทนี้ เช่น คู่ · ชิ้น · ตัว" },
      { name: "color", type: "text", kind: "scalar", source: "color", note: "สีป้ายของประเภทนี้" },
      { name: "ord", type: "bigint", kind: "scalar", source: "ord", note: "ลำดับที่แสดงในตารางและบนใบเบิก" },
      { name: "active", type: "boolean", kind: "scalar", source: "active" },
    ],
  },
];
