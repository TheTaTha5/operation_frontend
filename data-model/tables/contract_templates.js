'use strict';

// contract_templates. Column format: data-model/README.md
module.exports = [
  {
    table: "contract_templates",
    primaryKey: "id",
    foreignKeys: [],
    columns: [
      { name: "id", type: "text", kind: "pk", source: "contract_templates map key (generated id)" },
      { name: "key", type: "text", kind: "map_key", source: "contract_templates map key (original)" },
      { name: "value", type: "text", kind: "map_value_json", source: "contract_templates[key] value", note: "whole template object as JSON: {id,code,name,active,isDefault,sections{},text{en{},th{}}} — new template fields need no DB change" },
    ],
  },
];
