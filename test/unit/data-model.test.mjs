// data-model/ is the single source for the relational mapping (os_repo) and the schema server.js
// builds SQL from. These guard the invariants the old pair of JSON files used to break silently.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require_ = createRequire(import.meta.url);
const { tables, fieldMapping, schemaModel } = require_(path.join(ROOT, 'data-model/index.js'));
const osRepo = require_(path.join(ROOT, 'data-model/os_repo.js'));

test('every child table has its parent, and a link column pointing at it', () => {
  const names = new Set(tables.map((t) => t.table));
  for (const t of tables) {
    if (!t.table.includes('__')) continue;
    const parent = t.table.split('__').slice(0, -1).join('__');
    assert.ok(names.has(parent), `${t.table} has no parent table ${parent}`);
    assert.ok(t.columns.some((c) => c.kind === 'fk'), `${t.table} has no fk column`);
  }
});

test('every entity file under data-model/tables is loaded', () => {
  const files = fs.readdirSync(path.join(ROOT, 'data-model/tables')).filter((f) => f.endsWith('.js'));
  const roots = new Set(tables.filter((t) => !t.table.includes('__')).map((t) => t.table + '.js'));
  for (const f of files) assert.ok(roots.has(f), `data-model/tables/${f} is not listed in data-model/index.js ENTITIES`);
});

test('mapping and schema describe the same tables and columns', () => {
  assert.deepEqual(Object.keys(fieldMapping), Object.keys(schemaModel));
  for (const t of Object.keys(fieldMapping)) {
    assert.deepEqual(Object.keys(fieldMapping[t]), schemaModel[t].columns.map((c) => c.name), t);
  }
});

// Booking fields the mapping has no column for: saved, then gone after the next /api/load.
// Pre-existing gap found 2026-09-24, listed so it stays visible; fixing it needs a migration + model column.
const KNOWN_UNMAPPED_BOOKING_FIELDS = ['channel'];

test('a booking survives decompose -> assemble (apart from nulls, empties and known gaps)', async () => {
  const { buildBooking } = await import('../fixtures/booking.mjs');
  const bk = buildBooking();
  const back = osRepo.assembleBlob(osRepo.decomposeBlob({ sb_bookings: [bk] })).sb_bookings[0];
  // os_repo skips NULL columns and never fabricates empty children, so null/[]/{} come back absent.
  const prune = (v) => {
    if (Array.isArray(v)) return v.map(prune);
    if (!v || typeof v !== 'object') return v;
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      const p = prune(x);
      if (p === null || (typeof p === 'object' && Object.keys(p).length === 0)) continue;
      o[k] = p;
    }
    return o;
  };
  const want = prune(bk);
  for (const f of KNOWN_UNMAPPED_BOOKING_FIELDS) delete want[f];
  assert.deepEqual(prune(back), want);
});

test('apps/web/src/models/generated.ts is up to date with data-model', async () => {
  const { render } = await import('../../tools/gen-model-types.mjs');
  const cur = fs.readFileSync(path.join(ROOT, 'apps/web/src/models/generated.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(cur, render(), 'run `npm run gen:models` and commit the result');
});
