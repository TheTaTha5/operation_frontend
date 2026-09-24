'use strict';

// sb_payments. Column format: data-model/README.md
module.exports = [
  {
    table: "sb_payments",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "sb_payments[].id (record id; generated if absent)" },
      { name: "invoiceid", type: "text", kind: "scalar", source: "invoiceId" },
      { name: "agentid", type: "text", kind: "scalar", source: "agentId" },
      { name: "amount", type: "bigint", kind: "scalar", source: "amount" },
      { name: "method", type: "text", kind: "scalar", source: "method" },
      { name: "date", type: "text", kind: "scalar", source: "date" },
      { name: "type", type: "text", kind: "scalar", source: "type" },
      { name: "slips", type: "text", kind: "json_text", source: "slips" },
    ],
  },
];
