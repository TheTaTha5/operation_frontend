#!/usr/bin/env node
// lift · move a piece of a big function out to a top-level function, without changing behavior.
//
//   node tools/lift.mjs <file> <outerFn> <target> <newName> [--write]
//
// target:
//   var:NAME    the initializer of a top-level `var/let/const NAME = …` in outerFn's body
//   return      the argument of outerFn's last top-level `return …`
//   fn:NAME     a function declaration at the top level of outerFn's body
//
// Two shapes of result:
//   closure-free function  →  `function newName(…){…}` at top level; the site becomes `NAME = newName`
//                             (fn:NAME: the inner declaration is deleted and its references renamed)
//   anything else          →  `function newName(C){ const {a, b} = C; return <expr>; }`; the site becomes
//                             `newName({a, b})`, C being every outer binding the expression reads.
//
// Refuses (exit 1, nothing written) when the move could change behavior:
//   - the piece uses `this`/`arguments` that belong to outerFn
//   - it reads an outer binding that is ever reassigned (C would hold a stale copy)
//   - it reads an outer let/const/var declared at or after the site (TDZ / hoisted-undefined differences)
//   - fn:NAME that reads outer bindings (it is hoisted; a C-factory could not be called before its line)
// References are resolved with a real scope walk (params, var hoisting, block let/const/class, catch,
// named function expressions), not by name matching.
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';

const [file, outerName, target, newName] = process.argv.slice(2);
const write = process.argv.includes('--write');
if (!newName){ console.log('usage: lift.mjs <file> <outerFn> <var:NAME|return|fn:NAME> <newName> [--write]'); process.exit(2); }
const fail = m => { console.error('✖ refused: ' + m); process.exit(1); };

let src = fs.readFileSync(file, 'utf8');
const NL = src.includes('\r\n') ? '\r\n' : '\n';
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
const outer = ast.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === outerName);
if (!outer) fail(`no top-level function ${outerName} in ${file}`);
function checkFreeName(){
// every classic script in the directory shares one global scope · the new name must be free in all of them
for (const f of fs.readdirSync(path.dirname(path.resolve(file))).filter(f => f.endsWith('.js'))){
  const p = path.join(path.dirname(path.resolve(file)), f);
  const tops = p === path.resolve(file) ? ast.body : acorn.parse(fs.readFileSync(p, 'utf8'), { ecmaVersion: 'latest' }).body;
  for (const n of tops){
    const names = n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration' ? [n.id.name]
      : n.type === 'VariableDeclaration' ? n.declarations.flatMap(d => patNames(d.id).map(i => i.name)) : [];
    if (names.includes(newName)) fail(`${newName} is already a top-level name in ${f}`);
  }
}
}

// ── scope analysis ──────────────────────────────────────────────────────────────────────────
const isFn = n => /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(n.type);
const patNames = (p, out = []) => {
  if (!p) return out;
  switch (p.type){
    case 'Identifier': out.push(p); break;
    case 'ObjectPattern': p.properties.forEach(q => patNames(q.type === 'RestElement' ? q.argument : q.value, out)); break;
    case 'ArrayPattern': p.elements.forEach(e => patNames(e, out)); break;
    case 'AssignmentPattern': patNames(p.left, out); break;
    case 'RestElement': patNames(p.argument, out); break;
  }
  return out;
};
function children(n){ const out = []; for (const k in n){ if (k === 'loc' || k === 'start' || k === 'end') continue; const v = n[k];
  if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && out.push([c, k])); else if (v && typeof v.type === 'string') out.push([v, k]); } return out; }

// declarations hoisted to a function scope: var (any depth, not into nested fns) + block-level function decls
function hoisted(body, out = new Map()){
  (function walk(n, depth){
    for (const [c] of children(n)){
      if (c.type === 'VariableDeclaration' && c.kind === 'var') c.declarations.forEach(d => patNames(d.id).forEach(id => out.set(id.name, { kind: 'var', node: d, id })));
      if (c.type === 'FunctionDeclaration'){ if (depth > 0) out.set(c.id.name, { kind: 'function', node: c, id: c.id }); continue; }
      if (isFn(c)) continue;
      walk(c, depth + (c.type === 'BlockStatement' ? 1 : 0));
    }
  })(body, 0);
  return out;
}
function blockDecls(stmts, out = new Map()){
  for (const s of stmts){
    if (s.type === 'VariableDeclaration' && s.kind !== 'var') s.declarations.forEach(d => patNames(d.id).forEach(id => out.set(id.name, { kind: s.kind, node: d, id, stmt: s })));
    if (s.type === 'ClassDeclaration') out.set(s.id.name, { kind: 'class', node: s, id: s.id });
    if (s.type === 'FunctionDeclaration') out.set(s.id.name, { kind: 'function', node: s, id: s.id });
  }
  return out;
}
// Resolve every identifier reference under `root` → { id, binding, scopeOwner } using a scope stack
function resolveAll(root){
  const refs = [];
  const stack = [];
  const lookup = name => { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].names.has(name)) return stack[i]; return null; };
  function withScope(owner, names, fn){ stack.push({ owner, names }); fn(); stack.pop(); }
  function visit(n, parent, key){
    if (!n) return;
    if (isFn(n)){
      const outerNames = new Map();
      if (n.type === 'FunctionExpression' && n.id) outerNames.set(n.id.name, { kind: 'fname', id: n.id });
      withScope(n, outerNames, () => {
        const names = new Map();
        n.params.forEach(p => patNames(p).forEach(id => names.set(id.name, { kind: 'param', id })));
        if (n.body.type === 'BlockStatement'){ hoisted(n.body, names); blockDecls(n.body.body, names); }
        withScope(n, names, () => { n.params.forEach(p => visitPattern(p)); if (n.body.type === 'BlockStatement') n.body.body.forEach(s => visit(s, n.body, 'body')); else visit(n.body, n, 'body'); });
      });
      return;
    }
    if (n.type === 'BlockStatement' || n.type === 'StaticBlock'){ withScope(n, blockDecls(n.body), () => n.body.forEach(s => visit(s, n, 'body'))); return; }
    if (n.type === 'SwitchStatement'){ visit(n.discriminant, n); withScope(n, blockDecls(n.cases.flatMap(c => c.consequent)), () => n.cases.forEach(c => { visit(c.test, c); c.consequent.forEach(s => visit(s, c)); })); return; }
    if ((n.type === 'ForStatement' || n.type === 'ForInStatement' || n.type === 'ForOfStatement')){
      const init = n.type === 'ForStatement' ? n.init : n.left;
      const names = (init && init.type === 'VariableDeclaration' && init.kind !== 'var') ? blockDecls([init]) : new Map();
      withScope(n, names, () => { for (const [c, k] of children(n)) visit(c, n, k); });
      return;
    }
    if (n.type === 'CatchClause'){ const names = new Map(); patNames(n.param).forEach(id => names.set(id.name, { kind: 'catch', id })); withScope(n, names, () => { visitPattern(n.param); visit(n.body, n, 'body'); }); return; }
    if (n.type === 'ClassDeclaration' || n.type === 'ClassExpression'){ if (n.superClass) visit(n.superClass, n); n.body.body.forEach(m => { if (m.computed) visit(m.key, m); visit(m.value, m); }); return; }
    if (n.type === 'VariableDeclarator'){ visitPattern(n.id); visit(n.init, n, 'init'); return; }
    if (n.type === 'MemberExpression'){ visit(n.object, n, 'object'); if (n.computed) visit(n.property, n, 'property'); return; }
    if (n.type === 'Property'){ if (n.computed) visit(n.key, n, 'key'); visit(n.value, n, 'value'); return; }
    if (n.type === 'LabeledStatement'){ visit(n.body, n, 'body'); return; }
    if (n.type === 'BreakStatement' || n.type === 'ContinueStatement') return;
    if (n.type === 'AssignmentExpression'){ visitPattern(n.left, true); visit(n.right, n, 'right'); if (n.left.type === 'Identifier') refs.push({ id: n.left, scope: lookup(n.left.name), write: true }); return; }
    if (n.type === 'UpdateExpression' && n.argument.type === 'Identifier'){ refs.push({ id: n.argument, scope: lookup(n.argument.name), write: true }); return; }
    if (n.type === 'Identifier'){ refs.push({ id: n, scope: lookup(n.name), write: false }); return; }
    if (n.type === 'ThisExpression'){ refs.push({ id: n, this: true, scope: nearestFn() }); return; }
    for (const [c, k] of children(n)) visit(c, n, k);
  }
  function nearestFn(){ for (let i = stack.length - 1; i >= 0; i--) if (isFn(stack[i].owner) && stack[i].owner.type !== 'ArrowFunctionExpression') return stack[i]; return null; }
  // patterns: default values and computed keys are references; Identifier leaves are bindings (or writes)
  function visitPattern(p, isAssign){
    if (!p) return;
    if (p.type === 'Identifier'){ if (isAssign) {/* recorded by caller for plain identifiers */} return; }
    if (p.type === 'MemberExpression'){ visit(p, null); return; }
    if (p.type === 'AssignmentPattern'){ visitPattern(p.left, isAssign); visit(p.right, p); return; }
    if (p.type === 'ObjectPattern'){ p.properties.forEach(q => { if (q.type === 'RestElement') visitPattern(q.argument, isAssign); else { if (q.computed) visit(q.key, q); visitPattern(q.value, isAssign); if (isAssign) patNames(q.value).forEach(id => refs.push({ id, scope: lookup(id.name), write: true })); } }); return; }
    if (p.type === 'ArrayPattern'){ p.elements.forEach(e => { visitPattern(e, isAssign); if (isAssign) patNames(e).forEach(id => refs.push({ id, scope: lookup(id.name), write: true })); }); return; }
    if (p.type === 'RestElement'){ visitPattern(p.argument, isAssign); return; }
  }
  visit(root, null);
  return refs;
}

checkFreeName();

// ── locate the target ───────────────────────────────────────────────────────────────────────
const body = outer.body.body;
let site, expr, fnDecl = null, stmt;
if (target === 'return'){
  stmt = [...body].reverse().find(s => s.type === 'ReturnStatement' && s.argument);
  if (!stmt) fail('no top-level return with a value');
  expr = stmt.argument;
} else if (target.startsWith('var:')){
  const nm = target.slice(4);
  for (const s of body) if (s.type === 'VariableDeclaration') for (const d of s.declarations) if (d.id.type === 'Identifier' && d.id.name === nm){ stmt = s; expr = d.init; }
  if (!expr) fail(`no top-level declaration of ${nm} with an initializer`);
} else if (target.startsWith('fn:')){
  const nm = target.slice(3);
  fnDecl = body.find(s => s.type === 'FunctionDeclaration' && s.id.name === nm);
  if (!fnDecl) fail(`no top-level function declaration ${nm} inside ${outerName}`);
  stmt = fnDecl; expr = fnDecl;
} else fail('bad target ' + target);

// ── analyze ─────────────────────────────────────────────────────────────────────────────────
const refs = resolveAll(outer);
const inside = r => r.id.start >= expr.start && r.id.end <= expr.end;
const outerScopes = new Set();   // scopes that belong to outerFn itself (its fn scope + its body block)
for (const r of refs) if (r.scope && (r.scope.owner === outer || r.scope.owner === outer.body)) outerScopes.add(r.scope);
const isOuter = r => r.scope && (r.scope.owner === outer || r.scope.owner === outer.body);
const exprIsFn = isFn(expr);
const ownFnOf = n => n;   // the expression's own function (when it is one) owns its this/arguments

// this / arguments that belong to outerFn
for (const r of refs.filter(inside)){
  if (r.this && r.scope && r.scope.owner === outer) fail('uses `this` of ' + outerName);
  if (!r.this && r.id.name === 'arguments' && !r.scope){
    // bare `arguments` → nearest non-arrow function; outer's if the expression is not a non-arrow fn containing it
    let owner = null; (function find(n, fnStack){ if (!n || typeof n.type !== 'string') return; if (n === r.id){ owner = fnStack[fnStack.length - 1]; return; }
      const st = (isFn(n) && n.type !== 'ArrowFunctionExpression') ? [...fnStack, n] : fnStack; for (const [c] of children(n)) find(c, st); })(outer, []);
    if (owner === outer) fail('uses `arguments` of ' + outerName);
  }
}
// outer bindings read inside the expression (excluding a fn:NAME's own name)
const captured = new Map();
for (const r of refs.filter(inside)) if (!r.this && isOuter(r)){
  const b = r.scope.names.get(r.id.name);
  if (fnDecl && b && b.node === fnDecl) continue;
  captured.set(r.id.name, b);
}
// reassigned anywhere in outerFn?
const writes = new Set(refs.filter(r => r.write && isOuter(r)).map(r => r.id.name));
const varDeclCount = {}; (function walk(n){ for (const [c] of children(n)){ if (c.type === 'VariableDeclarator') patNames(c.id).forEach(id => varDeclCount[id.name] = (varDeclCount[id.name] || 0) + 1); if (!isFn(c)) walk(c); } })(outer.body);
for (const [nm, b] of captured){
  if (writes.has(nm) || varDeclCount[nm] > 1) fail(`reads ${nm}, which ${outerName} reassigns — a copy in C would go stale`);
  if (b && b.kind !== 'function' && b.kind !== 'param'){
    const declEnd = (b.node && b.node.end) || 0;
    if (!(declEnd <= stmt.start)) fail(`reads ${nm}, declared at or after the site (${b.kind})`);
  }
}
const cap = [...captured.keys()];

// ── build the edit ──────────────────────────────────────────────────────────────────────────
const text = n => src.slice(n.start, n.end);
let lifted, siteText;
const closureFree = cap.length === 0;
if (fnDecl){
  if (!closureFree) fail(`${target} reads outer bindings (${cap.join(', ')}) — function declarations are hoisted, so it cannot become a C-factory`);
  lifted = 'function ' + newName + text(fnDecl).slice(text(fnDecl).indexOf('('));
} else if (exprIsFn && closureFree && !(expr.type === 'FunctionExpression' && expr.id) && !(expr.type === 'ArrowFunctionExpression' && refs.some(r => r.this && inside(r)))){
  if (expr.type === 'ArrowFunctionExpression'){
    const params = expr.params.length === 1 && src[expr.start] !== '(' ? '(' + text(expr.params[0]) + ')' : src.slice(expr.start, expr.body.start).replace(/=>\s*$/, '').trim();
    lifted = (expr.async ? 'async ' : '') + 'function ' + newName + params + (expr.body.type === 'BlockStatement' ? text(expr.body) : '{ return ' + text(expr.body) + '; }');
  } else lifted = text(expr).replace(/^(async\s+)?function\s*/, (m, a) => (a || '') + 'function ' + newName);
  siteText = newName;
} else {
  lifted = 'function ' + newName + '(C){' + NL + (cap.length ? '  const { ' + cap.join(', ') + ' } = C;' + NL : '') + '  return ' + text(expr) + ';' + NL + '}';
  siteText = newName + '({ ' + cap.join(', ') + ' })';
}

const header = `/* lifted out of ${outerName} by tools/lift.mjs (${target}) · ${closureFree ? 'closure-free' : 'reads: ' + cap.join(', ')} */` + NL;
const edits = [];
if (fnDecl){
  // delete the inner declaration (with its line) and rename its references inside outerFn
  // take the whole line only when the declaration is alone on it; otherwise just the node
  let a = fnDecl.start; while (a > 0 && src[a - 1] !== '\n') a--;
  let z = fnDecl.end; while (z < src.length && src[z] !== '\n') z++;
  const alone = /^\s*$/.test(src.slice(a, fnDecl.start)) && /^\s*$/.test(src.slice(fnDecl.end, z));
  edits.push(alone ? [a, Math.min(z + 1, src.length), ''] : [fnDecl.start, fnDecl.end, '']);
  for (const r of refs) if (!r.this && r.scope && r.scope.names.get(r.id.name) && r.scope.names.get(r.id.name).node === fnDecl && r.id !== fnDecl.id) edits.push([r.id.start, r.id.end, newName]);
} else edits.push([expr.start, expr.end, siteText]);
let at = outer.start; while (at > 0 && src[at - 1] !== '\n') at--;
edits.push([at, at, header + lifted + NL]);
edits.sort((x, y) => y[0] - x[0]);
for (const [a, z, t] of edits) src = src.slice(0, a) + t + src.slice(z);
acorn.parse(src, { ecmaVersion: 'latest' });   // must still parse

console.log(`${outerName} ${target} → ${newName} · ${text(expr).split('\n').length} lines · ${closureFree ? 'closure-free' : 'C = { ' + cap.join(', ') + ' }'}`);
if (write){ fs.writeFileSync(file, src); console.log('written'); } else console.log('(dry run · --write to apply)');
