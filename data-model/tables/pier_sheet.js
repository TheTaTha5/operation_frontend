'use strict';

// pier_sheet. Column format: data-model/README.md
module.exports = [
  {
    table: "pier_sheet",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "pier_sheet map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "pier_sheet map key (original)", note: "'YYYY-MM-DD::boatId' · คีย์เดียวกับ trip_actuals / pier_job / fleet_daily" },
      { name: "value", type: "text", kind: "map_value_json", source: "pier_sheet[key] value", note: "ใบเบิก–คืนรายลำ · rows[] ต่อใบจอง + เงินมัดจำ + size[] แยกไซส์ · pier_moves คือตัวจริงของสต็อก" },
    ],
  },
];
