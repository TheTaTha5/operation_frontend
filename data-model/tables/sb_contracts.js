'use strict';

// sb_contracts and its child tables. Column format: data-model/README.md
module.exports = [
  {
    table: "sb_contracts",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "sb_contracts[].id (record id; generated if absent)" },
      { name: "agentid", type: "text", kind: "scalar", source: "agentId" },
      { name: "kind", type: "text", kind: "scalar", source: "kind" },
      { name: "ratetypeid", type: "text", kind: "scalar", source: "rateTypeId" },
      { name: "activefrom", type: "text", kind: "scalar", source: "activeFrom" },
      { name: "activeto", type: "text", kind: "scalar", source: "activeTo" },
      { name: "priority", type: "bigint", kind: "scalar", source: "priority" },
      { name: "version", type: "text", kind: "scalar", source: "version" },
      { name: "status", type: "text", kind: "scalar", source: "status" },
      { name: "createddate", type: "text", kind: "scalar", source: "createdDate" },
      { name: "createdby", type: "text", kind: "scalar", source: "createdBy" },
      { name: "note", type: "text", kind: "scalar", source: "note" },
      { name: "docid", type: "text", kind: "scalar", source: "docId" },
      { name: "pricemode", type: "text", kind: "scalar", source: "priceMode", note: "rate | own | discount · missing = rate (every promo written before 029)" },
      { name: "rates", type: "text", kind: "json_text", source: "rates", note: "{routeId:{zone:{paxType:price}}} · price_mode=own only · zone left out falls back to the standard rate" },
      { name: "discount", type: "text", kind: "json_text", source: "discount", note: "{mode:'pct'|'amt', value} · price_mode=discount only · always off the main contract price" },
      { name: "bonus", type: "text", kind: "json_text", source: "bonus", note: "{on,buy,free,basis} · buy-N-get-1 · system counts and warns, never adds the free seat itself" },
      { name: "bookwin", type: "bigint", kind: "scalar", source: "bookWin", note: "1 = enforce the booking window on programPeriods · older rows stay NULL so their bookings do not reprice" },
    ],
  },
  {
    table: "sb_contracts__programperiods",
    primaryKey: "row_pk",
    foreignKeys: [{ column: "sb_contracts_id", references: "sb_contracts.id" }],
    columns: [
      { name: "sb_contracts_id", type: "text", kind: "fk", source: "(link) sb_contracts.id" },
      { name: "idx", type: "bigint", kind: "synthetic", source: "(order) position in programPeriods[]" },
      { name: "row_pk", type: "text", kind: "synthetic-pk", source: "(generated child key)" },
      { name: "routeid", type: "text", kind: "scalar", source: "programPeriods[].routeId" },
      { name: "bookfrom", type: "text", kind: "scalar", source: "programPeriods[].bookFrom" },
      { name: "bookto", type: "text", kind: "scalar", source: "programPeriods[].bookTo" },
      { name: "travelfrom", type: "text", kind: "scalar", source: "programPeriods[].travelFrom" },
      { name: "travelto", type: "text", kind: "scalar", source: "programPeriods[].travelTo" },
      { name: "note", type: "text", kind: "scalar", source: "programPeriods[].note" },
    ],
  },
];
