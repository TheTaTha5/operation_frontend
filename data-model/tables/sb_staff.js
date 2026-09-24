'use strict';

// sb_staff. Column format: data-model/README.md
module.exports = [
  {
    table: "sb_staff",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "sb_staff[].id (record id; generated if absent)" },
      { name: "code", type: "text", kind: "scalar", source: "code" },
      { name: "name", type: "text", kind: "scalar", source: "name" },
      { name: "dept", type: "text", kind: "scalar", source: "dept" },
      { name: "active", type: "boolean", kind: "scalar", source: "active" },
      { name: "quota_2026", type: "bigint", kind: "scalar", source: "quota.2026" },
    ],
  },
];
