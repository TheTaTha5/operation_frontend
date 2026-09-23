#!/usr/bin/env node
// check-inline-handlers · inline on*="…" handlers may only go down.
//
//   node tools/check-inline-handlers.mjs            fail if any file has more than its baseline
//   node tools/check-inline-handlers.mjs --update   write the current counts as the new baseline
//
// Inline handlers call global functions by name from HTML strings, which is what keeps all ~3,000
// functions global (see allotment_v2/js/README.md). Screens are converted one at a time to
// laDelegate (data-on-* + an action table · first: the boat job sheet, js/08j-boatjobs.js). This
// check keeps new code from adding inline handlers back while that happens. When a file's count
// drops, run --update so the lower number becomes the new ceiling.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const BASE = path.join(ROOT, 'tools/inline-handlers.baseline.json');
const DIR = path.join(ROOT, 'allotment_v2');
const RE = /\bon(click|dblclick|change|input|keydown|keyup|keypress|blur|focus|submit|mousedown|mouseup|mouseover|mouseout|mouseenter|mouseleave|contextmenu|drag\w*|drop|paste|load|error|scroll|wheel|touch\w+)\s*=\s*["'\\]/g;

const files = ['allotment_v2.html', ...fs.readdirSync(path.join(DIR, 'js')).filter(f => f.endsWith('.js')).sort().map(f => 'js/' + f)];
const now = {};
for (const f of files) now[f] = (fs.readFileSync(path.join(DIR, f), 'utf8').match(RE) || []).length;
const total = Object.values(now).reduce((a, b) => a + b, 0);

if (process.argv.includes('--update')){
  fs.writeFileSync(BASE, JSON.stringify(now, null, 2) + '\n');
  console.log(`baseline written · ${total} inline handlers`);
  process.exit(0);
}
const base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : {};
let bad = 0, lower = 0;
for (const f of files){
  const was = base[f] ?? 0;
  if (now[f] > was){ bad++; console.log(`✖ ${f}: ${now[f]} inline handlers (baseline ${was}) · use data-on-* + laDelegate instead`); }
  else if (now[f] < was) lower++;
}
console.log(`${bad ? '✖' : '✓'} ${total} inline handlers` + (lower ? ` · ${lower} file(s) below baseline — run with --update to lock that in` : ''));
process.exit(bad ? 1 : 0);
