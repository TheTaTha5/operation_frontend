'use strict';

// fleet_consumable_logs. Column format: data-model/README.md
module.exports = [
  {
    table: "fleet_consumable_logs",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "fleet_consumable_logs[].id (record id; generated if absent)" },
      { name: "date", type: "text", kind: "scalar", source: "date" },
      { name: "itemid", type: "text", kind: "scalar", source: "itemId" },
      { name: "itemname", type: "text", kind: "scalar", source: "itemName" },
      { name: "unit", type: "text", kind: "scalar", source: "unit" },
      { name: "qty", type: "bigint", kind: "scalar", source: "qty" },
      { name: "unitcost", type: "double precision", kind: "scalar", source: "unitCost" },
      { name: "cost", type: "double precision", kind: "scalar", source: "cost" },
      { name: "location", type: "text", kind: "scalar", source: "location" },
      { name: "boatid", type: "text", kind: "scalar", source: "boatId" },
      { name: "engineid", type: "text", kind: "scalar", source: "engineId" },
      { name: "enginelabel", type: "text", kind: "scalar", source: "engineLabel" },
      { name: "by", type: "text", kind: "scalar", source: "by" },
      { name: "note", type: "text", kind: "scalar", source: "note" },
    ],
  },
];
