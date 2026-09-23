// bkV2CommitBooking rebuilds a fresh booking object on edit, so every field the form does not rebuild
// has to be copied across from the booking being edited — CLAUDE.md §3.4 / §6 warn that missing one
// wipes it on every edit. Those fields now live in one list (BK_EDIT_CARRY, js/08a-booking.js); this
// pins the list and proves bkV2CarryOver behaves exactly like the inline ifs it replaced.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(ROOT, 'allotment_v2/js/08a-booking.js'), 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest' });
const pick = n => ast.body.find(s =>
  (s.type === 'FunctionDeclaration' && s.id.name === n) ||
  (s.type === 'VariableDeclaration' && s.declarations.some(d => d.id.name === n)));
const ctx = vm.createContext({});
vm.runInContext(['BK_EDIT_CARRY', 'bkV2CarryOver'].map(n => src.slice(pick(n).start, pick(n).end)).join('\n')
  + '\nthis.BK_EDIT_CARRY = BK_EDIT_CARRY; this.bkV2CarryOver = bkV2CarryOver;', ctx);
const { BK_EDIT_CARRY, bkV2CarryOver } = ctx;

test('every field CLAUDE.md says must survive an edit is carried', () => {
  const carried = [...BK_EDIT_CARRY.early, ...BK_EDIT_CARRY.dayOf].map(([k]) => k);
  for (const k of ['ops', 'upgrades', 'feeItems', 'reschedule', 'partialCancels', 'cancellation',
                   'cancelCategory', 'history', 'weatherResolve', 'rebook', 'invoiceId', 'paymentStatus'])
    assert.ok(carried.includes(k), `${k} is not carried across edits`);
  assert.equal(new Set(carried).size, carried.length, 'a field is listed twice');
});

test('ops is carried in the early group (the travel-day clean-up needs it)', () => {
  assert.ok(BK_EDIT_CARRY.early.some(([k]) => k === 'ops'));
});

// The inline code bkV2CommitBooking had before §editCarry, verbatim.
function before(editing, newBk, group){
  if (group === 'early'){
    if(Array.isArray(editing.history)) newBk.history = editing.history;
    if(editing.weatherResolve) newBk.weatherResolve = editing.weatherResolve;
    if(editing.rebook) newBk.rebook = editing.rebook;
    if(editing.invoiceId) newBk.invoiceId = editing.invoiceId;
    if(editing.paymentStatus) newBk.paymentStatus = editing.paymentStatus;
    if(editing.ops) newBk.ops = editing.ops;
  } else {
    if(Array.isArray(editing.upgrades)) newBk.upgrades = editing.upgrades;
    if(Array.isArray(editing.feeItems)) newBk.feeItems = editing.feeItems;
    if(editing.reschedule) newBk.reschedule = editing.reschedule;
    if(Array.isArray(editing.partialCancels)) newBk.partialCancels = editing.partialCancels;
    if(editing.cancellation) newBk.cancellation = editing.cancellation;
    if(editing.cancelCategory) newBk.cancelCategory = editing.cancelCategory;
  }
}

test('bkV2CarryOver matches the inline code it replaced', () => {
  const keys = [...BK_EDIT_CARRY.early, ...BK_EDIT_CARRY.dayOf].map(([k]) => k).concat(['total', 'status']);
  const values = [undefined, null, 0, '', 'x', 7, [], [1], {}, { boatId: 'b1' }, false, true];
  let seed = 1;
  const rnd = n => (seed = (seed * 16807) % 2147483647) % n;
  for (let i = 0; i < 2000; i++){
    const editing = {}, base = {};
    for (const k of keys){
      if (rnd(3)) editing[k] = values[rnd(values.length)];
      if (rnd(3)) base[k] = values[rnd(values.length)];
    }
    for (const g of ['early', 'dayOf']){
      const a = { ...base }, b = { ...base };
      before(editing, a, g);
      bkV2CarryOver(editing, b, g);
      assert.deepEqual(b, a, `group ${g} differs for ${JSON.stringify(editing)}`);
      for (const k of Object.keys(a)) assert.equal(b[k], a[k], `${k} is not the same reference`);
    }
  }
});
