#!/usr/bin/env node
// Generate TypeScript types for the Vue app (apps/web) from the data model (data-model/tables).
//
// The types describe the app-side shape — what /api/load's blob and /api/v1/<resource> return — not
// the SQL rows. They are derived from os_repo's own plan (field names, nesting, arrays vs keyed maps),
// so they cannot disagree with how the server actually assembles records.
//
//   node tools/gen-model-types.mjs          write apps/web/src/models/generated.ts
//   node tools/gen-model-types.mjs --check  exit 1 if that file is out of date (used by the unit test)

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'apps/web/src/models/generated.ts');
const require = createRequire(import.meta.url);

// os_repo assembles these itself (day -> boatId -> fields); the generic plan does not describe them.
const HAND_TYPED = {
  trips: 'TripDeployments',
  fleet_daily: 'FleetDailyLog',
};
const HAND_WRITTEN = `/** trips[date][boatId]: one boat's deployment on one day (Boat Operation). Open-ended, stored as JSON. */
export type TripDeployments = Record<string, Record<string, TripDeployment>>;
export interface TripDeployment {
  route?: string;
  type?: string;
  booked?: number;
  charterBookingId?: string;
  [field: string]: unknown;
}

/** fleet_daily[date][boatId]: Daily Fleet Log for one boat on one day. Open-ended, stored as JSON. */
export type FleetDailyLog = Record<string, Record<string, FleetDailyBoat>>;
export interface FleetDailyBoat {
  fuel?: number;
  paxActual?: number;
  /** tripKey -> that trip's engine readings etc. */
  trips?: Record<string, unknown>;
  [field: string]: unknown;
}
`;

function tsType(dbType) {
  switch (dbType) {
    case 'text': return 'string';
    case 'bigint': return 'number';                 // server.js parses int8 to Number
    case 'double precision': return 'number';
    case 'numeric': return 'number | string';       // pg returns numeric as a string; the client writes numbers
    case 'boolean': return 'boolean';
    default: throw new Error('no TS type for db type ' + dbType);
  }
}

const pascal = (s) => s.split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
function singular(w) {
  if (/ies$/i.test(w)) return w.slice(0, -3) + 'y';
  if (/(ss|us|is)$/i.test(w)) return w;
  if (/(sses|xes|ches|shes)$/i.test(w)) return w.slice(0, -2);
  if (/s$/i.test(w)) return w.slice(0, -1);
  return w;
}
const singularPascal = (s) => {
  const parts = s.split(/_+/).filter(Boolean);
  parts[parts.length - 1] = singular(parts[parts.length - 1]);
  return pascal(parts.join('_'));
};
const propKey = (k) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k));

export function render() {
  const { tables } = require(path.join(ROOT, 'data-model/index.js'));
  const { _plan: PLAN, _children: CHILDREN } = require(path.join(ROOT, 'data-model/os_repo.js'));
  const colType = {};
  for (const t of tables) for (const c of t.columns) colType[t.table + '.' + c.name] = c.type;

  const names = {};          // table -> interface name
  const used = new Map();    // interface name -> table
  const nameOf = (table) => {
    if (names[table]) return names[table];
    const p = PLAN[table];
    const n = p.isChild ? nameOf(p.parentTable) + singularPascal(p.field) : singularPascal(table);
    if (used.has(n)) throw new Error(`type name ${n} is used by both ${used.get(n)} and ${table}`);
    used.set(n, table); names[table] = n;
    return n;
  };

  // Type of the value a table contributes to its parent (or to the blob, for a root).
  const valueType = (table) => {
    const p = PLAN[table];
    if (p.elementScalar) return tsType(colType[table + '.' + p.elementScalar]) + '[]';
    if (p.container === 'map') {
      if (p.valueCol) return `Record<string, ${p.valueJson ? 'unknown' : tsType(colType[table + '.' + p.valueCol])}>`;
      return `Record<string, ${nameOf(table)}>`;
    }
    return nameOf(table) + '[]';
  };

  const blocks = [];
  const emitInterface = (table) => {
    const p = PLAN[table];
    if (p.elementScalar || p.valueCol) return;                 // no record type of its own
    const tree = {};
    for (const dc of p.dataCols) {
      // A few fields (e.g. sb_bookings.cashOnTour) are mapped both whole and by sub-field; the record
      // ends up an object, so the object shape wins over the whole-value column.
      let o = tree;
      for (const k of dc.path.slice(0, -1)) o = (typeof o[k] === 'object' ? o[k] : (o[k] = {}));
      const leaf = dc.path[dc.path.length - 1];
      if (typeof o[leaf] !== 'object') o[leaf] = dc.kind === 'json_text' ? 'unknown' : tsType(colType[table + '.' + dc.col]);
    }
    for (const child of CHILDREN[table] || []) tree[PLAN[child].field] = valueType(child);
    const body = (o, ind) => Object.entries(o).map(([k, v]) => typeof v === 'string'
      ? `${ind}${propKey(k)}?: ${v};`
      : `${ind}${propKey(k)}?: {\n${body(v, ind + '  ')}\n${ind}};`).join('\n');
    const idLine = !p.isChild && p.container === 'array' ? '  id: string;\n' : '';
    blocks.push(`/** Table \`${table}\`. */\nexport interface ${nameOf(table)} {\n${idLine}${body(tree, '  ')}\n}\n`);
    for (const child of CHILDREN[table] || []) emitInterface(child);
  };

  const appData = [];
  for (const [table, p] of Object.entries(PLAN)) {
    if (p.isChild || p.container === 'scalars') continue;
    if (HAND_TYPED[table]) { appData.push(`  ${propKey(p.appKey)}?: ${HAND_TYPED[table]};`); continue; }
    emitInterface(table);
    appData.push(`  ${propKey(p.appKey)}?: ${valueType(table)};`);
  }

  return `// GENERATED by tools/gen-model-types.mjs from data-model/tables. Do not edit by hand:
// change the model, then run \`npm run gen:models\` in the repo root.

${HAND_WRITTEN}
${blocks.join('\n')}
/**
 * The whole app state as /api/load returns it (the legacy \`loveandaman_v2\` blob). Top-level scalar
 * settings (table \`app_meta\`) sit beside these keys and are not listed here.
 */
export interface AppData {
${appData.join('\n')}
}
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const src = render();
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
    if (cur !== src) { console.error('apps/web/src/models/generated.ts is out of date: run npm run gen:models'); process.exit(1); }
    console.log('generated.ts is up to date');
  } else {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, src);
    console.log('wrote ' + path.relative(ROOT, OUT));
  }
}
