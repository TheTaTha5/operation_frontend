'use strict';

// pier_sect. Column format: data-model/README.md
module.exports = [
  {
    table: "pier_sect",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "pier_sect[].id (record id; generated if absent)" },
      { name: "pier", type: "text", kind: "scalar", source: "pier", note: "ท่าเรือที่กลุ่มนี้เป็นของ" },
      { name: "name", type: "text", kind: "scalar", source: "name", note: "ชื่อกลุ่มที่แสดงเป็นแถบคั่นในตาราง เช่น OFFICE · BOAT CREW" },
      { name: "ord", type: "bigint", kind: "scalar", source: "ord", note: "ลำดับของแถบคั่นในตาราง" },
    ],
  },
];
