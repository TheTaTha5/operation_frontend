#!/usr/bin/env node
// handler-map · prove an inline-handler → delegation conversion changed no behavior.
//
//   node tools/handler-map.mjs record  <dir> [screen]   before converting
//   node tools/handler-map.mjs compare <dir> [screen]   after converting
//
// A "screen" (SCREENS below) names a view, how to render it, its host element, and the global
// function prefix its handlers call. Handler elements are found by either form:
//   before   on<type>="…"              (inline)
//   after    data-on-<type>="action"   (dispatched by laDelegate, js/08-app.js)
// and addressed by position among handler elements, which the conversion does not change.
//
// Three checks, each recorded before and compared after:
//   map      handler functions are stubbed (nothing re-renders), then every event a user can raise on
//            every handler element is fired; logged per element: which function was called with which
//            arguments (elements → their position), defaultPrevented, whether the event reached
//            document (stopPropagation), focus and text afterwards.
//   render   the host's HTML with on*/data-on-*/data-a-* attributes stripped — the rest must match.
//            --no-map skips this comparison: once a file is wrapped in its own scope (boatjob.js), calls
//            between its private functions can no longer be stubbed from window.
//   replay   un-stubbed: a long fixed sequence of real selects / clicks / key presses / blurs, walking
//            the handler elements in order; after every step the screen's data, UI state and HTML.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { open } from '../test/ui/_harness.mjs';
import { seedPage } from '../test/fixtures/ui-seed.mjs';

const noMap = process.argv.includes('--no-map');
const [cmd, dir, only] = process.argv.slice(2).filter(a => a !== '--no-map');
if (!['record', 'compare'].includes(cmd) || !dir){ console.log('usage: record|compare <dir> [screen]'); process.exit(2); }

const SCREENS = {
  // ใบงานเรือ · boat job sheet (renderPierJob + js/boatjob.js)
  'pierjob-panwa':   { view: 'poj-panwa',   host: '#pj-host-panwa',   prefix: 'pj', render: `_poDate='2026-10-15'; _pjF='all'; _pjHideIdle=0; renderPierJob('panwa')`,
                       state: `JSON.stringify({ PIER_JOB, d: _poDate, p: _poPier, f: _pjF, w: _pjW, idle: typeof _pjHideIdle !== 'undefined' ? _pjHideIdle : null })` },
  'pierjob-tublamu': { view: 'poj-tublamu', host: '#pj-host-tublamu', prefix: 'pj', render: `_poDate='2026-10-15'; _pjF='all'; _pjHideIdle=0; renderPierJob('tublamu')`,
                       state: `JSON.stringify({ PIER_JOB, d: _poDate, p: _poPier, f: _pjF, w: _pjW, idle: typeof _pjHideIdle !== 'undefined' ? _pjHideIdle : null })` },
};

// ── in-page helpers (serialized into the page) ─────────────────────────────────────────────────
const PAGE_LIB = `
window.__hm = {
  TYPES: ['click', 'change', 'keydown', 'blur'],
  has(el, t){ return el.hasAttribute('on' + t) || el.hasAttribute('data-on-' + t); },
  list(host, t){ return [...host.querySelectorAll('*')].filter(el => this.has(el, t)); },
  all(host){ return [...host.querySelectorAll('*')].filter(el => this.TYPES.some(t => this.has(el, t))); },
  pathOf(el, host){ const p = []; while (el && el !== host){ const par = el.parentNode; if (!par) return 'detached'; p.unshift([...par.children].indexOf(el)); el = par; } return el === host ? p.join('.') : 'outside'; },
  norm(html){ return html.replace(/\\s(on[a-z]+|data-on-[a-z]+|data-a-[a-z0-9-]+)="[^"]*"/g, ''); },
  hash(s){ let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16) + ':' + s.length; },
  quiet(){ // no real pop-ups or dialogs from either version
    window.open = () => ({ document: { open(){}, write(){}, close(){} }, focus(){}, close(){} });
    window.alert = () => {}; window.confirm = () => true; window.prompt = () => null; window.print = () => {};
  },
};`;

function mapRun(host, prefix){
  const H = window.__hm; H.quiet();
  const root = document.querySelector(host);
  const log = [];
  const ser = v => (v instanceof Element) ? { el: H.pathOf(v, root) } : (typeof v === 'function' ? 'fn' : v);
  const names = Object.getOwnPropertyNames(window).filter(n => n.startsWith(prefix) && typeof window[n] === 'function');
  const saved = {};
  for (const n of names){ saved[n] = window[n]; window[n] = function(...a){ log.push(n + '(' + JSON.stringify(a.map(ser)) + ')'); }; }
  let reached = false; const onDoc = () => { reached = true; };
  document.addEventListener('click', onDoc); document.addEventListener('change', onDoc); document.addEventListener('keydown', onDoc);
  const out = {};
  try {
    const els = H.all(root);
    els.forEach((el, i) => {
      const p = H.pathOf(el, root), rec = [];
      const fire = (label, ev, before) => {
        log.length = 0; reached = false; if (before) before();
        const r = el.dispatchEvent(ev);
        rec.push({ ev: label, calls: log.slice(), prevented: ev.defaultPrevented, reached,
                   focus: document.activeElement === el, text: el.isContentEditable ? el.textContent : undefined });
      };
      fire('click', new MouseEvent('click', { bubbles: true, cancelable: true }));
      if (/^(SELECT|INPUT|TEXTAREA)$/.test(el.tagName)){
        fire('change', new Event('change', { bubbles: true }), () => {
          if (el.tagName === 'SELECT'){ if (el.options.length > 1) el.value = el.options[1].value; }
          else if (el.type === 'date') el.value = '2026-10-20';
          else if (el.type === 'color') el.value = '#123456';
          else el.value = 'zz';
        });
      }
      if (el.isContentEditable || (el.tagName === 'INPUT' && !/^(date|color|checkbox|radio)$/.test(el.type))){
        for (const key of ['Enter', 'Escape', 'a']){
          el.focus();
          fire('keydown:' + key, new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        }
        if (el.isContentEditable) el.textContent = 'zz edited';
        log.length = 0; el.focus(); el.blur();
        rec.push({ ev: 'blur', calls: log.slice() });
      }
      out[p] = { tag: el.tagName, rec };
    });
  } finally {
    for (const n of names) window[n] = saved[n];
    document.removeEventListener('click', onDoc); document.removeEventListener('change', onDoc); document.removeEventListener('keydown', onDoc);
  }
  return out;
}

async function replay(page, S){
  const steps = [];
  const snap = async label => steps.push(await page.evaluate(([label, host, state]) => {
    const H = window.__hm, root = document.querySelector(host);
    return { label, state: H.hash(eval(state)), html: root ? H.hash(H.norm(root.innerHTML)) : 'no host',
             view: (document.querySelector('.view.active') || {}).id || '' };
  }, [label, S.host, S.state]));
  const rerender = () => page.evaluate(([view, render]) => {
    const el = document.querySelector('.nav-item[data-view="' + view + '"]'); if (el) nav(el); (0, eval)(render);
  }, [S.view, S.render]);
  // act on the i-th handler element of a type, as a user would
  const act = (type, i) => page.evaluate(([host, type, i]) => {
    const H = window.__hm, root = document.querySelector(host); if (!root) return 'no host';
    const L = H.list(root, type); if (i >= Math.min(L.length, 60)) return null;
    const el = L[(i * 7) % L.length];   // stride through the screen, not just the first card
    const p = H.pathOf(el, root);
    if (type === 'click') el.click();
    else if (type === 'change'){
      if (el.tagName === 'SELECT'){ const o = el.options[Math.min(el.options.length - 1, 1 + (i % 3))]; if (o) el.value = o.value; }
      else if (el.type === 'date') el.value = '2026-10-14';
      else if (el.type === 'color') el.value = '#2A7F62';
      else el.value = 'Zz band ' + i;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (type === 'blur'){ el.focus(); if (el.isContentEditable) el.textContent = 'Zz label ' + i; el.blur(); }
    else if (type === 'keydown'){ el.focus(); el.dispatchEvent(new KeyboardEvent('keydown', { key: i % 2 ? 'Escape' : 'Enter', bubbles: true, cancelable: true })); }
    return p;
  }, [S.host, type, i]);
  await rerender(); await snap('start');
  for (const type of ['change', 'blur', 'keydown', 'click']){
    for (let i = 0; i < 60; i++){
      const p = await act(type, i);
      if (p === null) break;
      await page.waitForTimeout(20);
      await snap(type + '#' + i + '@' + p);
      await rerender();   // back to the base date / filter / view · the data changes keep accumulating
    }
  }
  return steps;
}

const { page, errors, close } = await open();
await seedPage(page);
await page.evaluate(PAGE_LIB);
fs.mkdirSync(dir, { recursive: true });
let diffs = 0;
for (const [name, S] of Object.entries(SCREENS)){
  if (only && name !== only) continue;
  errors.length = 0;
  await page.evaluate(([view, render]) => { const el = document.querySelector('.nav-item[data-view="' + view + '"]'); if (el) nav(el); (0, eval)(render); }, [S.view, S.render]);
  const render = await page.evaluate(host => { const r = document.querySelector(host); return r ? window.__hm.norm(r.innerHTML) : ''; }, S.host);
  // with --no-map the stubs could not hold the actions back, so the map phase would really edit data · skip it
  const map2 = noMap ? {} : await page.evaluate(([f, host, prefix]) => (0, eval)('(' + f + ')')(host, prefix), [mapRun.toString(), S.host, S.prefix]);
  const steps = await replay(page, S);
  // second map pass on the state the replay built (assigned slots expose their ✕ buttons etc.)
  await page.evaluate(([view, render]) => { const el = document.querySelector('.nav-item[data-view="' + view + '"]'); if (el) nav(el); (0, eval)(render); }, [S.view, S.render]);
  const mapAfter = noMap ? {} : await page.evaluate(([f, host, prefix]) => (0, eval)('(' + f + ')')(host, prefix), [mapRun.toString(), S.host, S.prefix]);
  for (const [p, v] of Object.entries(mapAfter)) map2['after-replay:' + p] = v;
  const result = { render, map: map2, steps, errors: [...new Set(errors)] };
  const f = path.join(dir, name + '.json');
  const n = Object.keys(map2).length;
  if (cmd === 'record'){
    fs.writeFileSync(f, JSON.stringify(result, null, 1));
    console.log(`${name}: ${n} handler elements · ${steps.length} replay steps · render ${render.length} chars · errors ${result.errors.length}`);
    continue;
  }
  const was = JSON.parse(fs.readFileSync(f, 'utf8'));
  const d = [];
  if (was.render !== render) d.push('render differs (attributes stripped)');
  if (!noMap) for (const p of new Set([...Object.keys(was.map), ...Object.keys(map2)])){
    const a = JSON.stringify(was.map[p]), b = JSON.stringify(map2[p]);
    if (a !== b) d.push(`map ${p}: ${a ? a.slice(0, 300) : 'absent'}\n        → ${b ? b.slice(0, 300) : 'absent'}`);
  }
  const k = Math.max(was.steps.length, steps.length);
  for (let i = 0; i < k; i++){
    const a = JSON.stringify(was.steps[i]), b = JSON.stringify(steps[i]);
    if (a !== b){ d.push(`replay step ${i}: ${a}\n        → ${b}`); break; }
  }
  if (JSON.stringify(was.errors) !== JSON.stringify(result.errors)) d.push('errors: ' + JSON.stringify(was.errors) + ' → ' + JSON.stringify(result.errors));
  diffs += d.length;
  console.log(`${d.length ? '✖' : '✓'} ${name}: ${n} handler elements · ${steps.length} replay steps` + (d.length ? '\n    ' + d.slice(0, 12).join('\n    ') : ''));
  if (d.length) fs.writeFileSync(f.replace(/\.json$/, '.after.json'), JSON.stringify(result, null, 1));
}
await close();
if (cmd === 'compare'){ console.log('differences: ' + diffs); process.exit(diffs ? 1 : 0); }
