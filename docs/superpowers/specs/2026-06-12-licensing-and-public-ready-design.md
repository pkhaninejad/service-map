# Licensing & Public-Readiness — Design

**Date:** 2026-06-12
**Status:** Approved (design)
**Branch:** `feat/licensing-and-public-ready` (stacks on `feat/port-dtp-viz-mcp-and-probing` / PR #5)

## Goal

Make service-map public-ready under a **source-available** model: free for personal
and community/non-production use, paid for enterprise/production use. Every user —
free or paid — must obtain and activate a license key, which doubles as lead
capture. Licenses are validated against the existing wallstrdev license server.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Target repo | `service-map` (this repo). `wds-mcp-plugin` is only the license-server reference. |
| Feature model | **Any valid license unlocks the full app.** Free vs enterprise is a usage-rights + tier distinction, enforced by which key the license server issues, not by feature gating. |
| Enforcement points | **Web UI activation gate** (lead-gen, honor-system) **+ MCP server startup check** (real enforcement for enterprise installs). |
| Local dev | **License required everywhere**, including `localhost`/`127.0.0.1`. |
| License URLs | **Configurable** (enterprise + free), free defaults to a marked placeholder. |
| Browser validation transport | **A1 — direct browser → license server**, requires CORS on the endpoint (we own it). |
| Software license | **B1 — Business Source License 1.1** with an Additional Use Grant for personal/community use; Change License Apache-2.0; Change Date = 2030-06-12 (today + 4y). |

## License server contract (reference: `wds-mcp-plugin/includes/license.php`)

- `POST https://wallstrdev.com/wp-json/wds-license/v1/validate`
- Request body (JSON): `{ "key": string, "domain": string }`
- Response (JSON): `{ valid: bool, tier?: "free"|"pro", expires?: string, reason?: string }`
  - `reason` values include `expired`, `inactive`.
- Domain is normalized: lowercased, `www.` stripped, no scheme.
- Caching policy to mirror: fresh < 24h → use directly; 24h–7d → offline grace
  (trust cached result); > 7d → downgrade (treat as unlicensed).

## Architecture

Two independent enforcement layers sharing the same validation contract and
grace logic, but with platform-appropriate storage.

### Layer 1 — Web app activation gate (`src/license/`)

Purpose: block the UI behind activation; capture leads; surface tier/expiry.
Honor-system (open source) — not a security boundary.

- **`config.ts`** — `LICENSE_SERVER_URL`, `FREE_URL`, `ENTERPRISE_URL`.
  Defaults baked in; each overridable at build time via `import.meta.env.VITE_LICENSE_SERVER_URL` / `VITE_LICENSE_FREE_URL` / `VITE_LICENSE_ENTERPRISE_URL`.
  `ENTERPRISE_URL` default = the given product URL; `FREE_URL` default = a marked
  placeholder (`https://wallstrdev.com/product/service-map-free/` — TODO: replace).
- **`licenseClient.ts`** — pure, dependency-injected logic (testable):
  - `validateRemote(key, domain, fetchFn): Promise<ValidationResult | null>` (null on network/parse failure).
  - `normalizeDomain(host): string`.
  - `readCache() / writeCache(result)` over `localStorage` key `service-map-license`.
  - `computeStatus(cache, key, now): { tier, active }` — implements the 24h/7d grace.
- **`LicenseProvider.tsx`** + `useLicense()` — context exposing
  `{ status: "unactivated"|"checking"|"valid"|"invalid"|"error", tier, expires, reason, activate(key), deactivate(), recheck() }`.
  On mount: if a key is cached, recheck (respecting grace); else `unactivated`.
- **`LicenseGate.tsx`** — renders children only when `status === "valid"`; otherwise renders `ActivationScreen`. Mounted in `App.tsx` wrapping the whole app.
- **`ActivationScreen.tsx`** — full-screen setup: product blurb, license-key input, **Verify** button (calls `activate`), inline success/error with tier + expiry, and CTA links to `FREE_URL` ("Get a free license") and `ENTERPRISE_URL` ("Buy enterprise").
- **SettingsModal integration** — add a "License" section to the existing
  `src/settings/SettingsModal.tsx`: show current tier/expiry/status, change key,
  remove key (`deactivate`), and re-check now.

Domain sent = `normalizeDomain(window.location.hostname)`.

### Layer 2 — MCP server startup enforcement (`server/`)

Purpose: real enforcement — the server an enterprise deploys refuses to run
without a valid license.

- **`server/src/license.ts`** — `validateLicense(key, domain, { fetch }): Promise<ValidationResult | null>`; on-disk cache at `server/.license-cache.json` (gitignored); `computeStatus` reusing the same 24h/7d grace semantics; `getTier()`.
- **`server/src/config.ts`** — add `licenseKey` (`LICENSE_KEY`, required) and `licenseDomain` (`LICENSE_DOMAIN`, default = `GITHUB_OWNER` lowercased). Config validation stays fail-fast.
- **`server/src/server.ts`** — at startup, after config load: validate. If there is
  no valid license and we are outside the 7-day grace → print activation
  instructions (where to buy/activate, env var names) to stderr and `process.exit(1)`.
  Network failure with a valid cached license inside grace → start normally.
- **`server/.env.example`** + **`server/README.md`** — document `LICENSE_KEY` / `LICENSE_DOMAIN`.

### Shared validation result type

```ts
type ValidationResult = {
  valid: boolean;
  tier: "free" | "pro";
  expires: string | null;
  reason: string | null;
};
```

Web and server each keep their own copy (no shared package; the two runtimes are
already decoupled). Logic is identical and covered by tests on both sides.

## Data flow

1. User enters key → `activate(key)` → `validateRemote(key, domain, fetch)`.
2. On success, cache `{...result, cachedAt: now}` and recompute status.
3. Gate opens when `valid`. Background: on each load, if cache age > 24h, re-validate; keep serving within 7-day grace if the server is unreachable.
4. Server: same, on startup; exits if unlicensed beyond grace.

## Error handling

- Network/parse failure during **activation** → `status: "error"`, message "Couldn't reach the license server" (do not cache a failure).
- Network failure during **background recheck** with a valid cached result inside grace → stay valid silently.
- Invalid/expired key → `status: "invalid"`, show `reason`, keep user on the gate.
- Server unreachable on startup with valid cached license inside grace → start; otherwise exit(1) with guidance.
- **CORS:** the license endpoint must send `Access-Control-Allow-Origin` for the
  app origin (GitHub Pages origin + `http://localhost:*`). Documented as a
  deployment prerequisite; if absent, browser activation fails with the network
  error path. (Server-side validation is unaffected by CORS.)

## Testing

- **Server:** `server/test/license.test.ts` — full coverage of `validateLicense`
  (injected fetch), cache read/write, and `computeStatus` grace transitions
  (fresh / within-grace / expired-grace / no-key). Mirrors existing server test style.
- **Web:** add a minimal `vitest` setup (`vitest` + `vitest.config.ts` + `test`
  script) and `src/license/licenseClient.test.ts` covering `normalizeDomain` and
  `computeStatus` grace logic (pure functions). The repo has no web test runner
  today; this is a small, contained addition.
- Re-run `pnpm build` + `pnpm lint` (web) and `pnpm typecheck` + `pnpm test` (server).

## Legal & docs

- **`LICENSE`** → BSL 1.1 templated:
  - Licensor: WallstrDev / Payam Khaninejad.
  - Additional Use Grant: "You may use the Licensed Work for personal, educational,
    evaluation, and non-production community purposes free of charge. Any
    production or enterprise use requires a commercial license from
    `<ENTERPRISE_URL>`."
  - Change Date: 2030-06-12. Change License: Apache-2.0.
  - Header comment noting it is source-available, not OSI-approved, and that the
    text should be reviewed by counsel before commercial reliance.
- **`README.md`** → add a "License & activation" section: free vs enterprise,
  how to get a key, how to activate (web + server env), product links; note
  source-available status.
- **`.gitignore`** → add `server/.license-cache.json`.

## Out of scope

- Per-tier feature gating (any valid license = full app).
- The WordPress free product itself (created separately; we only link to it).
- A serverless validation proxy (using direct browser → server + CORS).
- Cryptographic/offline-signed licenses (server-validated keys only).
