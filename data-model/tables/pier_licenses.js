'use strict';

// pier_licenses. Column format: data-model/README.md
module.exports = [
  {
    table: "pier_licenses",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "pier_licenses[].id (record id; generated if absent)" },
      { name: "staffid", type: "text", kind: "scalar", source: "staffId" },
      { name: "classid", type: "text", kind: "scalar", source: "classId" },
      { name: "no", type: "text", kind: "scalar", source: "no" },
      { name: "exp", type: "text", kind: "scalar", source: "exp" },
      { name: "issuedat", type: "text", kind: "scalar", source: "issuedAt" },
      { name: "issuer", type: "text", kind: "scalar", source: "issuer" },
      { name: "note", type: "text", kind: "scalar", source: "note" },
    ],
  },
];
