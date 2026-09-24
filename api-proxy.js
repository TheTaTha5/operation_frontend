'use strict';
/**
 * Route-level API proxy — the switch that moves `/api` traffic to the new backend.
 *
 * Why a server-side proxy rather than a base URL in the client:
 *
 *   · allotment_v2 has no base URL to set. Every call is a hardcoded same-origin absolute path
 *     (`/api/load`, `/api/save`, `/api/v1/_batch`, `/api/me`, …, mostly in
 *     allotment_v2/js/01-auth-sync.js). There is nothing to repoint, and the app is classic
 *     <script src> files, so `import.meta.env.VITE_API_BASE_URL` does not exist there.
 *   · Cross-origin calls would need CORS with credentials AND session cookies re-issued as
 *     `SameSite=None; Secure`. Proxying keeps every request same-origin, so the existing
 *     `SameSite=Lax` cookie keeps working and nothing about auth changes.
 *   · It can move ONE route at a time. The new backend does not implement the whole surface yet,
 *     so an all-or-nothing switch would be an outage. `API_PROXY_ROUTES` is the strangler-fig seam:
 *     listed prefixes go upstream, everything else is still served locally by this process.
 *
 * Env:
 *   API_PROXY_URL        target origin, e.g. https://operationbackend-production.up.railway.app
 *                        Unset = this module does nothing at all.
 *   API_PROXY_ROUTES     comma-separated path prefixes to send upstream, e.g.
 *                        `/api/v1/rate-types,/api/agents`. Default `*` = every /api route.
 *                        An entry `from=to` also rewrites the prefix on the way out, for an upstream
 *                        whose paths differ from ours: `/api/v1/bookings=/v1/bookings` sends
 *                        `/api/v1/bookings/b1/cancel` to `/v1/bookings/b1/cancel`. The longest
 *                        matching `from` wins; an unrewritten route keeps its path as-is.
 *                        `/api/ob/*` is always forwarded with the prefix stripped: the namespace
 *                        the Vue app uses for operation-backend's own `/v1/*` and `/operations/*`.
 *   API_PROXY_TIMEOUT_MS default 30000.
 *   AUTH_BACKEND_LOGIN   `true` = sign in against the upstream's `POST /v1/login` (operation-backend's
 *                        HS256 password login) instead of the local users table. server.js keeps
 *                        the returned token in the HttpOnly `ob_at` cookie and every proxied request
 *                        carries it as `Authorization: Bearer`. /api/login, /api/logout and /api/me
 *                        stay local in this mode — they own the `sess` cookie the whole app reads.
 */
const http  = require('http');
const https = require('https');

const TARGET     = (process.env.API_PROXY_URL || '').trim().replace(/\/+$/, '');
const RAW_ROUTES = (process.env.API_PROXY_ROUTES || '').trim();
const TIMEOUT_MS = Math.max(1000, parseInt(process.env.API_PROXY_TIMEOUT_MS || '30000', 10) || 30000);
const BACKEND_LOGIN = /^(1|true|yes)$/i.test(String(process.env.AUTH_BACKEND_LOGIN || '').trim());
const TOKEN_COOKIE  = 'ob_at';
const AUTH_LOCAL    = new Set(['/api/login', '/api/logout', '/api/me']);

// Hop-by-hop headers are meaningful only on a single connection and must not be relayed
// (RFC 7230 §6.1). `host` is dropped separately because the upstream needs its OWN host for
// vhost routing — forwarding ours would make Railway serve the wrong service.
const HOP = new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization',
                     'te','trailer','transfer-encoding','upgrade','host']);

const ROUTES = RAW_ROUTES.split(',').map(s => s.trim()).filter(Boolean).map(s => {
  const i = s.indexOf('=');
  return { from: (i < 0 ? s : s.slice(0, i)).trim().replace(/\/+$/, ''),
           to:   i < 0 ? null : s.slice(i + 1).trim().replace(/\/+$/, '') };
});
const ALL = ROUTES.length === 0 || ROUTES.some(r => r.from === '*');
// Built-in namespace for pages written against operation-backend's own contract: /api/ob/<path>
// is <path> upstream (/api/ob/v1/availability -> /v1/availability), so a new page needs no
// API_PROXY_ROUTES change. Pushed after ALL is computed so it cannot turn "*" off.
ROUTES.push({ from: '/api/ob', to: '' });

function enabled(){ return !!TARGET; }
function backendLoginEnabled(){ return !!TARGET && BACKEND_LOGIN; }

/** The most specific API_PROXY_ROUTES entry covering this path, or null. */
function rule(pathname){
  let best = null;
  for(const r of ROUTES){
    if(r.from === '*' || !(pathname === r.from || pathname.startsWith(r.from + '/'))) continue;
    if(!best || r.from.length > best.from.length) best = r;
  }
  return best;
}

/**
 * Only ever true for an /api path. A misconfigured route list must not be able to send the app
 * HTML, the JS bundle or /auth/* upstream — that would be an unexplainable white screen.
 */
function matches(pathname){
  if(!TARGET) return false;
  if(pathname !== '/api' && !pathname.startsWith('/api/')) return false;
  if(BACKEND_LOGIN && AUTH_LOCAL.has(pathname)) return false;
  return ALL || !!rule(pathname);
}

/** The path to request upstream: the `to` of a rewrite entry, otherwise unchanged. */
function upstreamPath(pathname){
  const r = rule(pathname);
  if(!r || r.to === null) return pathname;
  return (r.to + pathname.slice(r.from.length)) || '/';
}

function cookie(req, name){
  for(const part of String(req.headers.cookie || '').split(';')){
    const i = part.indexOf('=');
    if(i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

/**
 * Exchanges a username/password at the upstream's `POST /v1/login` for its Bearer token.
 * Resolves { token, expiresIn, claims }; rejects with err.status = the upstream's status.
 * The claims are read, not verified: the token came straight from the upstream over our own
 * server-side request, and the upstream verifies it again on every call it is sent with.
 */
async function backendLogin(username, password){
  let r;
  try {
    r = await fetch(TARGET + '/v1/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch(e){ const err = new Error('backend unreachable: ' + e.message); err.status = 502; throw err; }
  let body = null; try { body = await r.json(); } catch(e){}
  if(!r.ok || !body || typeof body.access_token !== 'string'){
    const err = new Error((body && (body.message || body.error)) || ('backend login returned ' + r.status));
    err.status = r.ok ? 502 : r.status;
    throw err;
  }
  let claims = {};
  try { claims = JSON.parse(Buffer.from(body.access_token.split('.')[1], 'base64url').toString()) || {}; } catch(e){}
  return { token: body.access_token, expiresIn: Number(body.expires_in) || 0, claims };
}

function forward(req, res, pathname, query){
  let target;
  try { target = new URL(TARGET); }
  catch(e){ return fail(res, 'API_PROXY_URL is not a valid URL: ' + TARGET, pathname); }
  const isHttps = target.protocol === 'https:';
  const mod = isHttps ? https : http;

  const headers = {};
  for(const k of Object.keys(req.headers)) if(!HOP.has(k.toLowerCase())) headers[k] = req.headers[k];
  headers.host = target.host;
  // The upstream is behind our proxy now, so it can no longer see who the browser really asked for.
  // Without these it would build redirect/callback URLs pointing at ITSELF instead of at this app.
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
             || (req.socket && req.socket.encrypted ? 'https' : 'http');
  headers['x-forwarded-proto'] = proto;
  headers['x-forwarded-host']  = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  headers['x-forwarded-for']   = (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'] + ', ' : '')
                               + ((req.socket && req.socket.remoteAddress) || '');
  // The upstream authenticates by Bearer token only; it never reads our cookies. An explicit
  // Authorization header from the caller wins.
  const tok = cookie(req, TOKEN_COOKIE);
  if(tok && !headers.authorization) headers.authorization = 'Bearer ' + tok;

  const base = target.pathname.replace(/\/+$/, '');   // supports a target with a path prefix
  const up = mod.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || (isHttps ? 443 : 80),
    method: req.method,
    path: base + upstreamPath(pathname) + (query ? '?' + query : ''),
    headers,
  }, r => {
    const out = {};
    for(const k of Object.keys(r.headers)) if(!HOP.has(k.toLowerCase())) out[k] = r.headers[k];
    res.writeHead(r.statusCode || 502, out);
    r.pipe(res);            // piped, not buffered — /api/events is an SSE stream and must not stall
  });

  up.setTimeout(TIMEOUT_MS, () => up.destroy(new Error('upstream did not respond within ' + TIMEOUT_MS + 'ms')));
  up.on('error', err => {
    // Once bytes are on the wire the status is already sent; the only honest signal left is to cut it.
    if(res.headersSent){ try{ res.destroy(); }catch(e){} return; }
    fail(res, err.message, pathname);
  });
  req.on('aborted', () => up.destroy());
  req.pipe(up);
}

function fail(res, message, pathname){
  console.error('[proxy] ' + (pathname || '') + ' -> ' + TARGET + ' failed: ' + message);
  res.writeHead(502, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify({error:'api proxy failed: ' + message, target: TARGET, path: pathname || null}));
}

function describe(){
  if(!TARGET) return null;
  const list = ROUTES.filter(r => r.from !== '*').map(r => r.to === null ? r.from : r.from + '=>' + r.to);
  return '[proxy] /api -> ' + TARGET + ' · routes: '
       + (ALL ? '* (all)' + (list.length ? ' + ' + list.join(' ') : '') : list.join(' '))
       + ' · timeout ' + TIMEOUT_MS + 'ms' + (BACKEND_LOGIN ? ' · login via ' + TARGET + '/v1/login' : '');
}

module.exports = { enabled, matches, forward, describe, backendLoginEnabled, backendLogin, TOKEN_COOKIE,
                   _internal: { TARGET, ROUTES, ALL, HOP, upstreamPath } };
