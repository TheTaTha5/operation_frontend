// The backend switch (api-proxy.js, 2026-08-28): send /api routes to the new backend without
// touching the client.
//
// allotment_v2 has no API base URL — every call is a hardcoded same-origin absolute path — so the
// switch has to happen server-side. Four things here are easy to get wrong and expensive:
//   1. a proxied route must reach upstream intact: method, path, query, body, cookies
//   2. NOTHING outside /api may ever be proxied — a proxied app.html or bundle is a white screen
//   3. with API_PROXY_ROUTES set, an unlisted /api route must still be served locally (strangler fig)
//   4. an unreachable upstream must 502 fast, not hang
//
// Runs server.js against an in-test stand-in for the new backend. No database, no real backend.
// Run: node --test test/unit/api-proxy.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const UP_PORT = 8843, ALL_PORT = 8844, SOME_PORT = 8845, DEAD_PORT = 8846;
const UPSTREAM = `http://127.0.0.1:${UP_PORT}`;
const ALL = `http://127.0.0.1:${ALL_PORT}`;       // API_PROXY_ROUTES unset  → every /api route
const SOME = `http://127.0.0.1:${SOME_PORT}`;     // API_PROXY_ROUTES=/api/v1/rate-types
const DEAD = `http://127.0.0.1:${DEAD_PORT}`;     // points at a port nothing listens on
const BL_PORT = 8848;
const BL = `http://127.0.0.1:${BL_PORT}`;         // AUTH_BACKEND_LOGIN + /api/v1/bookings=/v1/bookings

// Shaped like operation-backend's HS256 token; only the payload is read on our side.
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const FAKE_TOKEN = b64({ alg: 'HS256' }) + '.' + b64({ sub: 'ops', preferred_username: 'ops', groups: ['admin'],
  exp: Math.floor(Date.now() / 1000) + 3600 }) + '.sig';

let upstream, seen = [], kids = [];

function boot(port, env) {
  const c = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), SESSION_SECRET: 'test-secret',
           DATABASE_URL: '', AUTH_OIDC_ISSUER: '', AUTH_OIDC_CLIENT_ID: '', ...env },
  });
  kids.push(c);
  return new Promise((resolve, reject) => {
    let log = '';
    const t = setTimeout(() => reject(new Error(`server on ${port} did not start:\n` + log)), 60_000);
    const on = (d) => { log += d; if (log.includes('LOVE Andaman on')) { clearTimeout(t); resolve(log); } };
    c.stdout.on('data', on); c.stderr.on('data', on);
  });
}

test.before(async () => {
  upstream = http.createServer((q, s) => {
    let body = '';
    q.on('data', (d) => (body += d));
    q.on('end', () => {
      seen.push({ method: q.method, url: q.url, body, headers: q.headers });
      if (q.url === '/v1/login') {                      // operation-backend's password login
        const b = JSON.parse(body || '{}');
        const ok = b.username === 'ops' && b.password === 'pw';
        s.writeHead(ok ? 200 : 401, { 'Content-Type': 'application/json' });
        return s.end(JSON.stringify(ok ? { access_token: FAKE_TOKEN, token_type: 'Bearer', expires_in: 3600 }
                                         : { statusCode: 401, message: 'Invalid username or password' }));
      }
      s.writeHead(201, { 'Content-Type': 'application/json', 'X-Upstream': 'yes',
                         'Set-Cookie': 'from_upstream=1; Path=/' });
      s.end(JSON.stringify({ hello: 'from the new backend', saw: q.url }));
    });
  });
  await new Promise((r) => upstream.listen(UP_PORT, r));
  await boot(ALL_PORT,  { API_PROXY_URL: UPSTREAM });
  await boot(SOME_PORT, { API_PROXY_URL: UPSTREAM, API_PROXY_ROUTES: '/api/v1/rate-types' });
  await boot(DEAD_PORT, { API_PROXY_URL: `http://127.0.0.1:1` });
  await boot(BL_PORT, { API_PROXY_URL: UPSTREAM, AUTH_BACKEND_LOGIN: 'true',
                        API_PROXY_ROUTES: '/api/v1/bookings=/v1/bookings' });
});
test.after(() => { kids.forEach((c) => c.kill()); upstream?.close(); });

const get = (base, p, opt = {}) => fetch(base + p, { redirect: 'manual', ...opt });

test('a proxied route reaches the new backend intact', async () => {
  seen = [];
  const r = await get(ALL, '/api/v1/rate-types?active=1', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sess=abc' },
    body: JSON.stringify({ code: 'RT1' }),
  });
  assert.equal(r.status, 201, 'upstream status must pass through, not be rewritten');
  assert.equal(r.headers.get('x-upstream'), 'yes', 'upstream headers must pass through');
  assert.deepEqual(await r.json(), { hello: 'from the new backend', saw: '/api/v1/rate-types?active=1' });

  assert.equal(seen.length, 1);
  const [hit] = seen;
  assert.equal(hit.method, 'POST');
  assert.equal(hit.url, '/api/v1/rate-types?active=1', 'path AND query string must survive');
  assert.equal(hit.body, '{"code":"RT1"}', 'the request body must be streamed upstream');
  assert.equal(hit.headers.cookie, 'sess=abc', 'the session cookie must reach the new backend');
  assert.equal(hit.headers.host, `127.0.0.1:${UP_PORT}`,
    'host must be rewritten to the upstream, or a vhost router serves the wrong service');
  assert.ok(hit.headers['x-forwarded-host'], 'upstream must still learn who the browser asked for');
});

test('nothing outside /api is ever proxied', async () => {
  seen = [];
  for (const p of ['/allotment_v2/allotment_v2.html', '/allotment_v2/js/08-app.js',
                   '/allotment_v2/css/01-base.css', '/auth/login', '/']) {
    const r = await get(ALL, p, { headers: { Accept: 'text/html' } });
    assert.notEqual(r.headers.get('x-upstream'), 'yes', p + ' must never be proxied');
  }
  assert.equal(seen.length, 0, 'the new backend must not have been contacted at all');
});

test('API_PROXY_ROUTES moves one route without moving the rest', async () => {
  seen = [];
  const moved = await get(SOME, '/api/v1/rate-types');
  assert.equal(moved.headers.get('x-upstream'), 'yes', 'the listed route goes to the new backend');

  const stayed = await get(SOME, '/api/me');
  assert.notEqual(stayed.headers.get('x-upstream'), 'yes', 'an unlisted route stays local');
  assert.equal(stayed.status, 401, 'and is answered by this server exactly as before');
  assert.equal(seen.length, 1, 'only the listed route reached upstream');
});

test('an unreachable backend fails fast and says so', async () => {
  const r = await get(DEAD, '/api/load');
  assert.equal(r.status, 502);
  const body = await r.json();
  assert.match(body.error, /api proxy failed/, 'the message must name the proxy, not look like an app bug');
  assert.equal(body.path, '/api/load');
});

test('the switch is off unless API_PROXY_URL is set', async () => {
  const log = await boot(8847, {});                       // no API_PROXY_URL
  assert.ok(!log.includes('[proxy]'), 'an unconfigured proxy must not announce itself');
  const r = await fetch('http://127.0.0.1:8847/api/me');
  assert.equal(r.status, 401, 'and /api/me is answered locally, exactly as before');
});

test('AUTH_BACKEND_LOGIN signs in at the backend and proxies with its Bearer token', async () => {
  seen = [];
  const bad = await get(BL, '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'ops', password: 'nope' }) });
  assert.equal(bad.status, 401, 'a wrong password is a 401, not a 502');

  const r = await get(BL, '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'ops', password: 'pw' }) });
  assert.equal(r.status, 200, 'login needs no DATABASE_URL in this mode');
  assert.equal((await r.json()).role, 'admin', 'the admin group maps to role admin');
  const jar = r.headers.getSetCookie().map((c) => c.split(';')[0]);
  assert.ok(jar.some((c) => c.startsWith('sess=')), 'a local sess cookie is minted');
  assert.ok(jar.includes('ob_at=' + FAKE_TOKEN), 'the backend token is kept in ob_at');
  assert.deepEqual(seen.map((h) => h.url), ['/v1/login', '/v1/login']);
  const Cookie = jar.join('; ');

  const me = await get(BL, '/api/me', { headers: { Cookie } });
  assert.equal(me.status, 200, '/api/me stays local and reads the minted sess');
  assert.equal((await me.json()).username, 'ops');

  seen = [];
  const bk = await get(BL, '/api/v1/bookings/b1/cancel?why=x', { method: 'POST', headers: { Cookie } });
  assert.equal(bk.headers.get('x-upstream'), 'yes');
  assert.equal(seen[0].url, '/v1/bookings/b1/cancel?why=x', 'the prefix is rewritten, the rest kept');
  assert.equal(seen[0].headers.authorization, 'Bearer ' + FAKE_TOKEN, 'the token rides as Bearer');

  seen = [];
  const local = await get(BL, '/api/v1/sb_bookings', { headers: { Cookie } });
  assert.notEqual(local.headers.get('x-upstream'), 'yes', 'a route without a rule stays local');
  assert.equal(seen.length, 0);

  const out = await get(BL, '/api/logout', { method: 'POST', headers: { Cookie } });
  assert.ok(out.headers.getSetCookie().some((c) => /^ob_at=;/.test(c)), 'logout clears the backend token too');
});
