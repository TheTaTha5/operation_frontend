'use strict';

// fleet_daily and its child tables. Column format: data-model/README.md
module.exports = [
  {
    table: "fleet_daily",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "fleet_daily map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "fleet_daily map key (original)" },
      { name: "b2_fuel", type: "double precision", kind: "scalar", source: "fleet_daily[key].b2.fuel" },
      { name: "b10_fuel", type: "double precision", kind: "scalar", source: "fleet_daily[key].b10.fuel" },
      { name: "b6_fuel", type: "double precision", kind: "scalar", source: "fleet_daily[key].b6.fuel" },
      { name: "b13_fuel", type: "double precision", kind: "scalar", source: "fleet_daily[key].b13.fuel" },
      { name: "b12_fuel", type: "double precision", kind: "scalar", source: "fleet_daily[key].b12.fuel" },
      { name: "b10_paxactual", type: "bigint", kind: "scalar", source: "fleet_daily[key].b10.paxActual" },
      { name: "b2_paxactual", type: "bigint", kind: "scalar", source: "fleet_daily[key].b2.paxActual" },
    ],
  },
  {
    table: "fleet_daily__trips",
    primaryKey: "row_pk",
    foreignKeys: [{ column: "fleet_daily_id", references: "fleet_daily.id" }],
    columns: [
      { name: "fleet_daily_id", type: "text", kind: "fk", source: "(link) fleet_daily.id" },
      { name: "boat", type: "text", kind: "scalar", source: "fleet_daily[key].trips[key].boat" },
      { name: "key", type: "text", kind: "map_key", source: "(map key of fleet_daily[key].boat.trips)" },
      { name: "row_pk", type: "text", kind: "synthetic-pk", source: "(generated child key)" },
      { name: "value", type: "text", kind: "json_text", source: "fleet_daily[key].trips[key] value" },
    ],
  },
  {
    table: "fleet_daily__boat",
    primaryKey: "row_pk",
    foreignKeys: [{ column: "fleet_daily_id", references: "fleet_daily.id" }],
    columns: [
      { name: "fleet_daily_id", type: "text", kind: "fk", source: "(link) fleet_daily.id" },
      { name: "key", type: "text", kind: "map_key", source: "(map key of fleet_daily[key].boats)" },
      { name: "row_pk", type: "text", kind: "synthetic-pk", source: "(generated child key)" },
      { name: "value", type: "text", kind: "map_value_json", source: "fleet_daily[key][boat] scalars" },
    ],
  },
];
