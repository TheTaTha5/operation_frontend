'use strict';

// sb_extras. Column format: data-model/README.md
module.exports = [
  {
    table: "sb_extras",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "sb_extras[].id (record id; generated if absent)" },
      { name: "bookingid", type: "text", kind: "scalar", source: "bookingId" },
      { name: "tripdate", type: "text", kind: "scalar", source: "tripDate" },
      { name: "service", type: "text", kind: "scalar", source: "service" },
      { name: "qty", type: "bigint", kind: "scalar", source: "qty" },
      { name: "unitprice", type: "bigint", kind: "scalar", source: "unitPrice" },
      { name: "total", type: "bigint", kind: "scalar", source: "total" },
      { name: "tocompany", type: "bigint", kind: "scalar", source: "toCompany" },
      { name: "commission", type: "bigint", kind: "scalar", source: "commission" },
      { name: "seller", type: "text", kind: "scalar", source: "seller" },
      { name: "method", type: "text", kind: "scalar", source: "method" },
      { name: "settle", type: "text", kind: "scalar", source: "settle" },
      { name: "date", type: "text", kind: "scalar", source: "date" },
      { name: "feepct", type: "double precision", kind: "scalar", source: "feePct" },
      { name: "fee", type: "bigint", kind: "scalar", source: "fee" },
      { name: "customerpaid", type: "bigint", kind: "scalar", source: "customerPaid" },
      { name: "slips", type: "text", kind: "json_text", source: "slips" },
    ],
  },
];
