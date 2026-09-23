// tools/lift.mjs moves code out of big functions. These cases pin the rules that keep a lift
// behavior-neutral: what it must refuse, and that what it accepts still computes the same thing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TOOL = path.join(ROOT, 'tools/lift.mjs');

function lift(code, outer, target, write = true){
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lift-')), 'x.js');
  fs.writeFileSync(f, code);
  const r = spawnSync(process.execPath, [TOOL, f, outer, target, 'lifted', ...(write ? ['--write'] : [])], { encoding: 'utf8' });
  return { ok: r.status === 0, out: r.stdout + r.stderr, code: fs.readFileSync(f, 'utf8') };
}
const run = (code, call) => { const c = vm.createContext({}); vm.runInContext(code + '\nthis.__r = ' + call + ';', c); return c.__r; };

test('context lift: result unchanged, captured names passed in C', () => {
  const code = 'function f(a){ const k = 2; var m = a * 3; const s = [a, k, m].map(x => x + k).join(","); return s; }';
  const r = lift(code, 'f', 'var:s');
  assert.ok(r.ok, r.out);
  assert.match(r.code, /lifted\(\{ a, k, m \}\)/);
  assert.equal(run(r.code, 'f(5)'), run(code, 'f(5)'));
});

test('closure-free arrow becomes a plain function', () => {
  const code = 'function f(){ const sq = x => x * x; return sq(4); }';
  const r = lift(code, 'f', 'var:sq');
  assert.ok(r.ok, r.out);
  assert.match(r.code, /function lifted\(x\)\{ return x \* x; \}/);
  assert.equal(run(r.code, 'f()'), 16);
});

test('refuses a binding that is reassigned later', () => {
  const r = lift('function f(){ let n = 1; const g = () => n; n = 2; return g(); }', 'f', 'var:g', false);
  assert.ok(!r.ok); assert.match(r.out, /reassigns/);
});

test('refuses += and ++ and destructuring writes too', () => {
  for (const w of ['n += 1', 'n++', '[n] = [5]', '({n} = {n: 5})'])
    assert.ok(!lift(`function f(){ let n = 1; const g = () => n; ${w}; return g(); }`, 'f', 'var:g', false).ok, w);
});

test('refuses a binding declared after the site', () => {
  const r = lift('function f(){ const g = () => later; const later = 1; return g(); }', 'f', 'var:g', false);
  assert.ok(!r.ok); assert.match(r.out, /declared at or after/);
});

test('refuses `this` and `arguments` of the outer function', () => {
  assert.ok(!lift('function f(){ const g = () => this.x; return g(); }', 'f', 'var:g', false).ok);
  assert.ok(!lift('function f(){ const n = arguments.length; return n; }', 'f', 'var:n', false).ok);
  // a non-arrow function's own `this`/`arguments` are fine
  assert.ok(lift('function f(){ const g = function(){ return arguments.length + (this ? 1 : 0); }; return g(1, 2); }', 'f', 'var:g', false).ok);
});

test('a shadowed name inside the piece is not captured', () => {
  const code = 'function f(){ const later = () => { const date = 3; return date; }; const date = 9; return later() + date; }';
  const r = lift(code, 'f', 'var:later');
  assert.ok(r.ok, r.out);
  assert.equal(run(r.code, 'f()'), 12);
});

test('fn:NAME moves a closure-free inner declaration and renames its call sites', () => {
  const code = 'function f(){ const a = helper(2); function helper(x){ return x + 1; } return a + helper(3); }';
  const r = lift(code, 'f', 'fn:helper');
  assert.ok(r.ok, r.out);
  assert.doesNotMatch(r.code.slice(r.code.indexOf('function f(')), /function helper/);
  assert.equal(run(r.code, 'f()'), 7);
});

test('fn:NAME refuses when the inner function reads outer bindings', () => {
  assert.ok(!lift('function f(){ const k = 1; function h(){ return k; } return h(); }', 'f', 'fn:h', false).ok);
});
