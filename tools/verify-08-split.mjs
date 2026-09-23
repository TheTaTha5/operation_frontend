#!/usr/bin/env node
// verify-08-split · prove the 08-app.js domain split changed nothing at runtime.
//
//   node tools/verify-08-split.mjs static                 source check against git HEAD~0 / a ref
//   node tools/verify-08-split.mjs snapshot <out.json>    open the app in Chrome, record globals + views
//   node tools/verify-08-split.mjs compare <a.json> <b.json>
//
// static   · every top-level chunk of the original 08-app.js (git ref, default HEAD) appears exactly
//            once across 08-app.js + 08?-*.js, and 08-app.js keeps all non-function statements in
//            their original order. Also checks allotment_v2.html loads each domain file exactly once,
//            with a plain <script src> (no defer/async/module), after 07-charter.js and before 08-app.js.
// snapshot · for every top-level name in the app's scripts: typeof + a hash of fn.toString() (or of
//            JSON for data). Then opens every view and hashes its rendered HTML. Uses seed data
//            (static server, no backend), same as test/ui.
// compare  · diff two snapshots. Views whose HTML differs between two runs of the SAME code are
//            nondeterministic (clocks, random ids) — run the baseline twice and pass both to see them.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';
import { chunk, DOMAINS } from './split-08-app.mjs';

const JS = path.resolve('allotment_v2/js');
const HTML = path.resolve('allotment_v2/allotment_v2.html');
const lf = s => s.replace(/\r\n/g, '\n');   // working tree is CRLF on Windows (text=auto), git blobs are LF
const h = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
const [cmd, a, b, c] = process.argv.slice(2);

function scriptOrder(){
  const html = fs.readFileSync(HTML, 'utf8');
  return [...html.matchAll(/<script\b([^>]*)\bsrc="js\/([^"?]+)(?:\?[^"]*)?"([^>]*)><\/script>/g)]
    .map(m => ({ file: m[2], attrs: (m[1] + m[3]).trim() }));
}

function topNames(file){
  const ast = acorn.parse(fs.readFileSync(path.join(JS, file), 'utf8'), { ecmaVersion: 'latest' });
  const out = [];
  for (const n of ast.body){
    if (n.type === 'FunctionDeclaration') out.push([n.id.name, 'fn']);
    else if (n.type === 'ClassDeclaration') out.push([n.id.name, 'class']);
    else if (n.type === 'VariableDeclaration')
      for (const d of n.declarations) if (d.id.type === 'Identifier') out.push([d.id.name, n.kind]);
  }
  return out;
}

function checkStatic(ref = 'HEAD'){
  const orig = lf(execFileSync('git', ['show', `${ref}:allotment_v2/js/08-app.js`], { encoding: 'utf8', maxBuffer: 64 << 20 }));
  const origChunks = chunk(orig);
  const files = ['08-app.js', ...Object.keys(DOMAINS)];
  const pool = new Map();
  let problems = 0;
  for (const f of files){
    const p = path.join(JS, f);
    if (!fs.existsSync(p)){ console.log('✖ missing', f); problems++; continue; }
    let src = lf(fs.readFileSync(p, 'utf8'));
    if (f !== '08-app.js') src = src.split('\n').slice(4).join('\n');   // drop the 3-line header + blank
    for (const ch of chunk(src)) pool.set(ch.text, (pool.get(ch.text) || 0) + 1);
  }
  for (const ch of origChunks){
    const n = pool.get(ch.text) || 0;
    if (!n){ console.log('✖ lost or altered:', ch.name || ch.node.type, ch.text.slice(0, 80).replace(/\n/g, '⏎')); problems++; }
    else pool.set(ch.text, n - 1);
  }
  for (const [t, n] of pool) if (n > 0){ console.log('✖ new/duplicated chunk:', t.slice(0, 80).replace(/\n/g, '⏎')); problems++; }

  const origStmts = origChunks.filter(c => !c.name).map(c => c.text);
  const nowStmts = chunk(lf(fs.readFileSync(path.join(JS, '08-app.js'), 'utf8'))).filter(c => !c.name).map(c => c.text);
  if (origStmts.join('\u0000') !== nowStmts.join('\u0000')){ console.log('✖ 08-app.js load-time statements changed or reordered'); problems++; }

  const order = scriptOrder();
  const at = f => order.findIndex(s => s.file === f);
  for (const f of Object.keys(DOMAINS)){
    const n = order.filter(s => s.file === f).length;
    if (n !== 1){ console.log(`✖ ${f} is loaded ${n} times`); problems++; continue; }
    const s = order[at(f)];
    if (/\b(defer|async|type=)/.test(s.attrs)){ console.log(`✖ ${f} has ${s.attrs}`); problems++; }
    if (!(at('07-charter.js') < at(f) && at(f) < at('08-app.js'))){ console.log(`✖ ${f} is not between 07-charter.js and 08-app.js`); problems++; }
  }
  console.log(`static: ${origChunks.length} chunks · ${origChunks.filter(c => c.name).length} functions · problems ${problems}`);
  return problems;
}

async function snapshot(out){
  const { open, views, goView } = await import('../test/ui/_harness.mjs');
  const names = [];
  for (const { file } of scriptOrder()) if (fs.existsSync(path.join(JS, file))) for (const n of topNames(file)) names.push(n);
  const { page, errors, close } = await open();
  const bootErrors = [...errors];
  const globals = await page.evaluate(list => {
    const r = {};
    for (const [nm] of list){
      try {
        const v = (0, eval)(nm);
        let repr;
        if (typeof v === 'function') repr = String(v);
        else { try { repr = JSON.stringify(v); } catch { repr = '[unserializable]'; } }
        r[nm] = { t: typeof v, len: repr ? repr.length : 0, s: repr ? repr.slice(0, 400000) : '' };
      } catch (e){ r[nm] = { t: 'THROWS', s: String(e).slice(0, 120) }; }
    }
    return r;
  }, names);
  for (const k in globals) globals[k].s = h(globals[k].s);
  const viewHtml = {};
  for (const v of await views(page)){
    errors.length = 0;
    try { await goView(page, v); } catch (e){ errors.push('throw ' + e); }
    const html = await page.evaluate(() => (document.querySelector('.view.active') || {}).innerHTML || '');
    viewHtml[v] = { h: h(html.replace(/\d{1,2}:\d{2}(:\d{2})?/g, 'T')), len: html.length, errors: [...new Set(errors)] };
  }
  await close();
  fs.writeFileSync(out, JSON.stringify({ bootErrors, globals, viewHtml }, null, 1));
  console.log(`snapshot: ${Object.keys(globals).length} names · ${Object.keys(viewHtml).length} views · boot errors ${bootErrors.length} → ${out}`);
}

function compare(fa, fb, fa2){
  const A = JSON.parse(fs.readFileSync(fa, 'utf8')), B = JSON.parse(fs.readFileSync(fb, 'utf8'));
  const A2 = fa2 ? JSON.parse(fs.readFileSync(fa2, 'utf8')) : null;
  let diffs = 0;
  const flaky = k => A2 && A2.viewHtml[k] && A2.viewHtml[k].h !== A.viewHtml[k]?.h;
  const gflaky = k => A2 && A2.globals[k] && A2.globals[k].s !== A.globals[k]?.s;
  for (const k of new Set([...Object.keys(A.globals), ...Object.keys(B.globals)])){
    const x = A.globals[k], y = B.globals[k];
    if (!x || !y || x.t !== y.t || (x.s !== y.s && !gflaky(k))){
      console.log(`✖ global ${k}: ${x ? x.t + ' ' + x.s : 'absent'} → ${y ? y.t + ' ' + y.s : 'absent'}`); diffs++;
    }
  }
  for (const k of new Set([...Object.keys(A.viewHtml), ...Object.keys(B.viewHtml)])){
    const x = A.viewHtml[k], y = B.viewHtml[k];
    if (!x || !y){ console.log(`✖ view ${k} ${x ? 'missing after' : 'new after'}`); diffs++; continue; }
    if (x.h !== y.h && !flaky(k)){ console.log(`✖ view ${k} html ${x.len} → ${y.len}`); diffs++; }
    if (JSON.stringify(x.errors) !== JSON.stringify(y.errors)){ console.log(`✖ view ${k} errors`, x.errors, '→', y.errors); diffs++; }
  }
  if (JSON.stringify(A.bootErrors) !== JSON.stringify(B.bootErrors)){ console.log('✖ boot errors', A.bootErrors, '→', B.bootErrors); diffs++; }
  const fl = A2 ? Object.keys(A.viewHtml).filter(flaky) : [];
  console.log(`compare: ${diffs} differences` + (fl.length ? ` · ignored nondeterministic views: ${fl.join(', ')}` : ''));
  return diffs;
}

if (cmd === 'static') process.exit(checkStatic(a) ? 1 : 0);
else if (cmd === 'snapshot') await snapshot(a || 'snapshot.json');
else if (cmd === 'compare') process.exit(compare(a, b, c) ? 1 : 0);
else { console.log('usage: static [ref] | snapshot <out> | compare <before> <after> [before2]'); process.exit(2); }
