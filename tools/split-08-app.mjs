#!/usr/bin/env node
// split-08-app · move top-level function declarations out of js/08-app.js into per-domain files.
//
//   node tools/split-08-app.mjs            dry run: print what would move where
//   node tools/split-08-app.mjs --write    write the domain files and the trimmed 08-app.js
//
// This is a MOVE, not a refactor. The rules that keep it behavior-neutral:
//   - only top-level `function` declarations move. Every other top-level statement (const/let/var,
//     IIFEs, addEventListener, the bkV2Render wrapper, try/if blocks) stays in 08-app.js in its
//     original order, because those run at load time and their order matters.
//   - domain files load BEFORE 08-app.js, so every function 08-app.js's load-time code could reach
//     through hoisting before the split is still defined when that code runs.
//   - text is cut into contiguous chunks (leading comments + node + same-line trailing text), so
//     re-merging every chunk by original index reproduces the original file byte-for-byte. The
//     tool asserts that before writing anything.
//   - a name declared more than once must land in one file, in its original order (last one wins).
//
// Verify afterwards with tools/verify-08-split.mjs.
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';

const JS = path.resolve('allotment_v2/js');
const SRC = path.join(JS, '08-app.js');

// prefix (leading underscores stripped) → domain file. Unlisted prefixes stay in 08-app.js.
export const DOMAINS = {
  '08a-booking.js':       { title: 'Booking v2 · by-trip · seat locks · reconfirm · boat capacity',
                            prefixes: ['bkV2', 'bk', 'bkx', 'ba', 'bcap', 'boat', 'ovn', 'rs', 'nat', 'rc', 'bt'] },
  '08b-agents.js':        { title: 'Agents · sales team · add-on services · seed data',
                            prefixes: ['ag', 'agp', 'tm', 'aos', 'seed'] },
  '08c-rates.js':         { title: 'Rate Types',
                            prefixes: ['rt', 'rtm', 'get'] },
  '08d-contracts.js':     { title: 'Contracts · contract templates · costing & boat rent',
                            prefixes: ['ct', 'ctt'] },
  '08e-checkin.js':       { title: 'Check-in (van + pier) · guide jobs · meals',
                            prefixes: ['ck', 'pck', 'vck', 'go', 'mv'] },
  '08f-vans.js':          { title: 'Vans · van jobs · van bill · vehicles · pickup setup',
                            prefixes: ['van', 'vj', 'vjt', 'vb', 'veh', 'psu'] },
  '08g-cash.js':          { title: 'Pier cash · petty cash',
                            prefixes: ['pc', 'po'] },
  '08h-accounting.js':    { title: 'Accounting · daily PFM · travel summary',
                            prefixes: ['acct', 'pfm', 'ts'] },
  '08i-reports.js':       { title: 'Reports · analysis · daily report · market data · pickup map · B2C dashboard',
                            prefixes: ['rep', 'px', 'dr', 'drm', 'md', 'pm', 'pmap', 'b'] },
  '08j-boatjobs.js':      { title: 'Boat job sheet (ใบงานเรือ)',
                            prefixes: ['pj'] },
};

export function prefixOf(name){
  const m = name.replace(/^_+/, '').match(/^[a-z]+(?:V2)?(?=[A-Z_0-9]|$)/);
  return m ? m[0] : name.replace(/^_+/, '');
}

const PREFIX_TO_FILE = {};
for (const [file, d] of Object.entries(DOMAINS))
  for (const p of d.prefixes){
    if (PREFIX_TO_FILE[p]) throw new Error(`prefix ${p} mapped twice`);
    PREFIX_TO_FILE[p] = file;
  }

// Cut src into contiguous chunks, one per top-level statement.
export function chunk(src){
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' });
  const body = ast.body;
  const starts = body.map((n, i) => {
    if (i === 0) return 0;
    const prevEnd = body[i - 1].end;
    const nl = src.indexOf('\n', prevEnd);
    // text on the previous node's last line belongs to it; the rest of the gap leads this node
    return nl === -1 || nl >= n.start ? n.start : nl + 1;
  });
  return body.map((n, i) => ({
    node: n,
    name: n.type === 'FunctionDeclaration' ? n.id.name : null,
    text: src.slice(starts[i], i + 1 < body.length ? starts[i + 1] : src.length),
  }));
}

function main(){
  const write = process.argv.includes('--write');
  const src = fs.readFileSync(SRC, 'utf8');
  const chunks = chunk(src);
  if (chunks.map(c => c.text).join('') !== src) throw new Error('chunks do not reassemble the source');

  const out = { '08-app.js': [] };
  for (const f of Object.keys(DOMAINS)) out[f] = [];
  const fileOfName = {};
  for (const c of chunks){
    const file = c.name ? (PREFIX_TO_FILE[prefixOf(c.name)] || '08-app.js') : '08-app.js';
    if (c.name){
      if (fileOfName[c.name] && fileOfName[c.name] !== file)
        throw new Error(`${c.name} is declared more than once and would be split across files`);
      fileOfName[c.name] = file;
    }
    out[file].push(c);
  }

  // Every chunk lands in exactly one file, each file keeps original order → re-merge by index
  const idx = new Map(chunks.map((c, i) => [c, i]));
  const remerged = Object.values(out).flat().sort((a, b) => idx.get(a) - idx.get(b)).map(c => c.text).join('');
  if (remerged !== src) throw new Error('re-merge check failed');

  for (const [f, cs] of Object.entries(out)){
    const fns = cs.filter(c => c.name).length;
    const lines = cs.reduce((n, c) => n + c.text.split('\n').length - 1, 0);
    console.log(`${f.padEnd(20)} ${String(fns).padStart(5)} functions ${String(lines).padStart(6)} lines`);
  }
  if (!write){ console.log('\n(dry run · pass --write to apply)'); return; }

  for (const [f, cs] of Object.entries(out)){
    if (f === '08-app.js') continue;
    const d = DOMAINS[f];
    const head = `// ${f} · ${d.title}\n`
      + `// Moved verbatim out of 08-app.js by tools/split-08-app.mjs (function declarations only, original\n`
      + `// order). Classic script: loads before 08-app.js, every function is still a global. See js/README.md.\n\n`;
    fs.writeFileSync(path.join(JS, f), head + cs.map(c => c.text).join(''));
  }
  fs.writeFileSync(SRC, out['08-app.js'].map(c => c.text).join(''));
  console.log('\nwritten');
}

if (process.argv[1] && path.basename(process.argv[1]) === 'split-08-app.mjs') main();
