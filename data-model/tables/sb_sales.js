'use strict';

// sb_sales. Column format: data-model/README.md
module.exports = [
  {
    table: "sb_sales",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "sb_sales[].id (record id; generated if absent)" },
      { name: "code", type: "text", kind: "scalar", source: "code" },
      { name: "name", type: "text", kind: "scalar", source: "name" },
      { name: "color", type: "text", kind: "scalar", source: "color" },
      { name: "email", type: "text", kind: "scalar", source: "email" },
      { name: "fullname", type: "text", kind: "scalar", source: "fullName" },
      { name: "designation", type: "text", kind: "scalar", source: "designation" },
      { name: "tel", type: "text", kind: "scalar", source: "tel" },
      { name: "signature", type: "text", kind: "scalar", source: "signature" },
      { name: "targets", type: "text", kind: "json_text", source: "targets", note: "monthly pax target per salesperson · {\"YYYY-MM\": pax} · Sales Board finish line" },
      { name: "followup", type: "text", kind: "json_text", source: "followup", note: "agents this salesperson marked handled · {\"YYYY-MM::agentId\": true} · Sales Board follow-up" },
    ],
  },
];
