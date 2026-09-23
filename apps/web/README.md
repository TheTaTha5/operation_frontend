# LOVE Andaman web app (Vue)

Vue 3 + Vite + TypeScript (Vue Router, Pinia) app that replaces `allotment_v2` one page at a time.
It does not import or modify the legacy app. The two are joined by plain links:

- Pages not moved yet are listed in `src/lib/legacy.ts` and open at
  `allotment_v2.html?view=<data-view>` (handled by `_laRestoreView` in `allotment_v2/js/01-auth-sync.js`).
- Both apps sit on one origin, so they share the `sess` login cookie. The app is served under `/app/`
  (`VITE_BASE`).

To move a page: add a route in `src/router.ts`, delete its entry from `legacyViews`, and point the
legacy sidebar item at `/app/<route>`.

## Requirements

Node.js 22.22+ (CI uses 24).

## Local development

```bash
cp .env.example .env.local
npm ci
npm run dev        # http://localhost:5173/app/
```

The dev server proxies `/api`, `/auth` and `/allotment_v2` to `server.js` (`DEV_BACKEND_URL`,
default `http://localhost:3000`). Start it from the repo root with `npm run dev:local`, then sign in
through the legacy link. The Vue app picks up the same session.

## Checks (same as CI)

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
