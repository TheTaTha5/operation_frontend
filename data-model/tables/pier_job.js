'use strict';

// pier_job. Column format: data-model/README.md
module.exports = [
  {
    table: "pier_job",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "pier_job map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "pier_job map key (original)" },
      { name: "value", type: "text", kind: "map_value_json", source: "pier_job[key] value" },
    ],
  },
];
