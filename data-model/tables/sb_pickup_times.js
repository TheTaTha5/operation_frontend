'use strict';

// sb_pickup_times. Column format: data-model/README.md
module.exports = [
  {
    table: "sb_pickup_times",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "sb_pickup_times map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "sb_pickup_times map key (original)" },
      { name: "pk_n1", type: "text", kind: "scalar", source: "sb_pickup_times[key].pk-n1" },
      { name: "pk_n2", type: "text", kind: "scalar", source: "sb_pickup_times[key].pk-n2" },
      { name: "pk_e1", type: "text", kind: "scalar", source: "sb_pickup_times[key].pk-e1" },
      { name: "pk_e2", type: "text", kind: "scalar", source: "sb_pickup_times[key].pk-e2" },
      { name: "pk_wn1", type: "text", kind: "scalar", source: "sb_pickup_times[key].pk-wn1" },
      { name: "pk_w1", type: "text", kind: "scalar", source: "sb_pickup_times[key].pk-w1" },
      { name: "pk_w2", type: "text", kind: "scalar", source: "sb_pickup_times[key].pk-w2" },
      { name: "pk_s1", type: "text", kind: "scalar", source: "sb_pickup_times[key].pk-s1" },
      { name: "pk_s2", type: "text", kind: "scalar", source: "sb_pickup_times[key].pk-s2" },
      { name: "pk_c1", type: "text", kind: "scalar", source: "sb_pickup_times[key].pk-c1" },
      { name: "pk_c2", type: "text", kind: "scalar", source: "sb_pickup_times[key].pk-c2" },
      { name: "pk_pa1", type: "text", kind: "scalar", source: "sb_pickup_times[key].pk-pa1" },
      { name: "nt_vp", type: "text", kind: "scalar", source: "sb_pickup_times[key].nt-vp" },
      { name: "pk_pn1", type: "text", kind: "scalar", source: "sb_pickup_times[key].pk-pn1" },
      { name: "nt_tl", type: "text", kind: "scalar", source: "sb_pickup_times[key].nt-tl" },
    ],
  },
];
