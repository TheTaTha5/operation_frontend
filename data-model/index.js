'use strict';
// The data model: one file per entity in ./tables, each listing the entity's table and its child
// tables. This module builds the two views the server uses from them:
//   fieldMapping  { table: { column: { source, kind, db_type[, note] } } }   -> os_repo.js (blob <-> rows)
//   schemaModel   { table: { columns: [{ name, type }], primary_key?, foreign_keys? } } -> server.js (SQL)
// These used to be two hand-kept JSON files (os-backend/src/mapping/) that had to agree with each other.

// Order matters: it is the order of top-level keys in the /api/load blob, and within each file a
// parent's child tables become that record's nested fields in this order. Append new entities at the end.
const ENTITIES = [
  'app_meta', 'routes', 'boats', 'trips', 'fleet_engines', 'fleet_gearboxes', 'fleet_propellers',
  'fleet_daily', 'fleet_maintenance', 'fleet_incidents', 'fleet_inventory', 'fleet_memos',
  'app_hooks', 'sb_rate_types', 'sb_agents_rate_bindings', 'fleet_safety', 'sb_pickup_areas',
  'sb_pickup_times', 'sb_pickup_time_profiles', 'fleet_projects', 'sb_seat_locks', 'sb_sales',
  'sb_agents', 'sb_bookings', 'nat_learn', 'sb_nationalities', 'sb_invoices', 'sb_weather',
  'sb_payments', 'sb_markets', 'sb_market_stats', 'sb_market_monthly', 'sb_staff', 'sb_vehicles',
  'sb_extras', 'fleet_fuelprice', 'fleet_drlock', 'vanjob_pickup_th', 'vanjob_driver',
  'fleet_consumable_logs', 'insurance_overrides', 'vanjob_sreq', 'vanjob_th_flag', 'vanjob_sent',
  'agent_artifacts', 'contract_templates', 'sb_contracts', 'boat_capovr', 'travel_sum', 'ts_cot',
  'pier_items', 'pier_kinds', 'meal_venues', 'pier_moves', 'pier_staff', 'pier_sect', 'pier_duty',
  'pier_team', 'pier_job', 'trip_actuals', 'pier_sheet', 'pier_cfg', 'pier_lic_types',
  'pier_lic_classes', 'pier_licenses', 'pier_codes', 'pier_shift', 'van_bill', 'po_cash_rows',
  'po_cash_lt', 'po_cash_pk',
];

const KINDS = new Set(['pk', 'synthetic-pk', 'fk', 'synthetic', 'map_key', 'map_value', 'map_value_json',
  'array_scalar', 'scalar', 'json_text']);
const TYPES = new Set(['text', 'bigint', 'double precision', 'boolean', 'numeric']);

const tables = [];
for (const entity of ENTITIES) {
  for (const t of require(`./tables/${entity}.js`)) {
    if (t.table !== entity && !t.table.startsWith(entity + '__')) {
      throw new Error(`data-model: ${t.table} does not belong in tables/${entity}.js`);
    }
    tables.push(t);
  }
}

const fieldMapping = {};
const schemaModel = {};
for (const t of tables) {
  if (fieldMapping[t.table]) throw new Error(`data-model: table ${t.table} is defined twice`);
  const cols = {};
  for (const c of t.columns) {
    if (cols[c.name]) throw new Error(`data-model: ${t.table}.${c.name} is defined twice`);
    if (!KINDS.has(c.kind)) throw new Error(`data-model: ${t.table}.${c.name} has unknown kind ${c.kind}`);
    if (!TYPES.has(c.type)) throw new Error(`data-model: ${t.table}.${c.name} has unknown type ${c.type}`);
    cols[c.name] = { source: c.source, kind: c.kind, db_type: c.type };
    if (c.note !== undefined) cols[c.name].note = c.note;
  }
  fieldMapping[t.table] = cols;
  const md = { columns: t.columns.map((c) => ({ name: c.name, type: c.type })) };
  // Absent on purpose for a few tables (e.g. boat_capovr): server.js then loads them without ORDER BY.
  if (t.primaryKey !== undefined) md.primary_key = t.primaryKey;
  if (t.foreignKeys !== undefined) md.foreign_keys = t.foreignKeys.map((f) => ({ column: f.column, references: f.references }));
  schemaModel[t.table] = md;
}

module.exports = { tables, fieldMapping, schemaModel };
