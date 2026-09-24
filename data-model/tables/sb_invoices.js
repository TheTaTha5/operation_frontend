'use strict';

// sb_invoices and its child tables. Column format: data-model/README.md
module.exports = [
  {
    table: "sb_invoices",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "sb_invoices[].id (record id; generated if absent)" },
      { name: "number", type: "text", kind: "scalar", source: "number" },
      { name: "agentid", type: "text", kind: "scalar", source: "agentId" },
      { name: "subtotal", type: "bigint", kind: "scalar", source: "subtotal" },
      { name: "depositapplied", type: "bigint", kind: "scalar", source: "depositApplied" },
      { name: "total", type: "bigint", kind: "scalar", source: "total" },
      { name: "issuedat", type: "text", kind: "scalar", source: "issuedAt" },
      { name: "dueat", type: "text", kind: "scalar", source: "dueAt" },
      { name: "status", type: "text", kind: "scalar", source: "status" },
      { name: "createdby", type: "text", kind: "scalar", source: "createdBy" },
      { name: "netamount", type: "bigint", kind: "scalar", source: "netAmount" },
      { name: "vatmode", type: "text", kind: "scalar", source: "vatMode" },
      { name: "vatrate", type: "double precision", kind: "scalar", source: "vatRate" },
      { name: "vatamount", type: "bigint", kind: "scalar", source: "vatAmount" },
      { name: "feetype", type: "text", kind: "scalar", source: "feeType" },
      { name: "note", type: "text", kind: "scalar", source: "note" },
    ],
  },
  {
    table: "sb_invoices__bookingids",
    primaryKey: "row_pk",
    foreignKeys: [{ column: "sb_invoices_id", references: "sb_invoices.id" }],
    columns: [
      { name: "sb_invoices_id", type: "text", kind: "fk", source: "(link) sb_invoices.id" },
      { name: "idx", type: "bigint", kind: "synthetic", source: "(order) position in bookingIds[]" },
      { name: "row_pk", type: "text", kind: "synthetic-pk", source: "(generated child key)" },
      { name: "value", type: "text", kind: "array_scalar", source: "bookingIds[] (element)" },
    ],
  },
  {
    table: "sb_invoices__lineitems",
    primaryKey: "row_pk",
    foreignKeys: [{ column: "sb_invoices_id", references: "sb_invoices.id" }],
    columns: [
      { name: "sb_invoices_id", type: "text", kind: "fk", source: "(link) sb_invoices.id" },
      { name: "idx", type: "bigint", kind: "synthetic", source: "(order) position in lineItems[]" },
      { name: "row_pk", type: "text", kind: "synthetic-pk", source: "(generated child key)" },
      { name: "label", type: "text", kind: "scalar", source: "lineItems[].label" },
      { name: "amount", type: "bigint", kind: "scalar", source: "lineItems[].amount" },
    ],
  },
];
