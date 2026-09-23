#!/usr/bin/env node
// lift-candidates · list the pieces of a big function that tools/lift.mjs could move out, and what it
// says about each (dry run, nothing is written).
//
//   node tools/lift-candidates.mjs <file> <outerFn> [minLines=8]
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import * as acorn from 'acorn';

const [file, name, min = 8] = process.argv.slice(2);
if (!name){ console.log('usage: lift-candidates.mjs <file> <outerFn> [minLines]'); process.exit(2); }
const src = fs.readFileSync(file, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', locations: true });
const fn = ast.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name);
if (!fn){ console.log('no top-level function ' + name); process.exit(1); }
console.log(`${name} · ${fn.loc.end.line - fn.loc.start.line + 1} lines`);
const targets = [];
for (const st of fn.body.body){
  const L = st.loc.end.line - st.loc.start.line + 1;
  if (L < +min) continue;
  if (st.type === 'FunctionDeclaration') targets.push(['fn:' + st.id.name, L]);
  else if (st.type === 'VariableDeclaration') st.declarations.forEach(d => d.init && targets.push(['var:' + d.id.name, L]));
  else if (st.type === 'ReturnStatement' && st.argument) targets.push(['return', L]);
  else if (st.type === 'ExpressionStatement' && st.expression.type === 'CallExpression' && st.expression.callee.property
           && st.expression.callee.property.name === 'forEach') targets.push(['each:' + st.loc.start.line, L]);
}
for (const [t, L] of targets.sort((a, b) => b[1] - a[1])){
  const r = spawnSync(process.execPath, [new URL('./lift.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), file, name, t, 'zzCandidate'], { encoding: 'utf8' });
  const line = (r.stdout + r.stderr).split('\n')[0].replace(/ → zzCandidate/, '');
  console.log(`  ${String(L).padStart(4)}  ${r.status === 0 ? '✓' : '·'} ${t.padEnd(16)} ${r.status === 0 ? line.replace(/^.*?· /, '') : line.replace('✖ refused: ', 'refused: ')}`);
}
