import fs from "node:fs";

/**
 * License validation for the MCP server — the real enforcement point.
 *
 * Mirrors the contract and grace semantics of the WordPress plugin
 * (wds-mcp-plugin/includes/license.php): validate {key, domain} against the
 * wallstrdev license server, cache the result, trust it for up to 7 days
 * offline, then lock down.
 *
 * Note: a `free` tier with `valid: true` is a *real* license (issued by the
 * free product for lead capture) — it counts as active. Only `valid: false`
 * or an expired (>7d) cache locks the server.
 */

export const LICENSE_SERVER_URL =
  process.env.LICENSE_SERVER_URL ??
  "https://wallstrdev.com/wp-json/wds-license/v1/validate";

const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_MS = 7 * DAY_MS;

export type Tier = "free" | "pro";

export type ValidationResult = {
  valid: boolean;
  tier: Tier;
  expires: string | null;
  reason: string | null;
};

export type LicenseCache = ValidationResult & { cachedAt: number };

/** Lowercase, strip scheme and leading www. */
export function normalizeDomain(host: string): string {
  let h = host.trim().toLowerCase();
  h = h.replace(/^[a-z]+:\/\//, "");
  h = h.replace(/\/.*$/, "");
  h = h.replace(/^www\./, "");
  return h;
}

/**
 * Call the license server. Returns the parsed result, or null on any
 * network/parse failure (so callers can fall back to cache + grace).
 */
export async function validateRemote(
  key: string,
  domain: string,
  fetchFn: typeof fetch = fetch,
): Promise<ValidationResult | null> {
  try {
    const res = await fetchFn(LICENSE_SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, domain }),
    });
    const body: unknown = await res.json();
    if (!body || typeof body !== "object") return null;
    const b = body as Record<string, unknown>;
    return {
      valid: Boolean(b.valid),
      tier: b.tier === "pro" ? "pro" : "free",
      expires: typeof b.expires === "string" ? b.expires : null,
      reason: typeof b.reason === "string" ? b.reason : null,
    };
  } catch {
    return null;
  }
}

/** True if the cache is older than the 24h re-validation window. */
export function isStale(cache: LicenseCache, now: number): boolean {
  return now - cache.cachedAt >= DAY_MS;
}

/**
 * Resolve the effective entitlement from a cached result.
 * Within the 7-day grace window a valid cache stays active; past it we
 * downgrade (locked) until a fresh validation succeeds.
 */
export function computeStatus(
  cache: LicenseCache | null,
  now: number,
): { active: boolean; tier: Tier } {
  if (!cache) return { active: false, tier: "free" };
  if (now - cache.cachedAt >= GRACE_MS) return { active: false, tier: "free" };
  if (!cache.valid) return { active: false, tier: "free" };
  return { active: true, tier: cache.tier };
}

export function readCache(file: string): LicenseCache | null {
  try {
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as LicenseCache;
  } catch {
    return null;
  }
}

export function writeCache(file: string, result: ValidationResult, now: number): void {
  const cache: LicenseCache = { ...result, cachedAt: now };
  fs.writeFileSync(file, JSON.stringify(cache, null, 2));
}

export type LicenseStatus = {
  active: boolean;
  tier: Tier;
  expires: string | null;
  reason: string | null;
};

/**
 * End-to-end resolution used at server startup:
 * - no key → inactive (never hits the network)
 * - fresh cache (<24h) → used as-is
 * - stale/missing cache → re-validate; persist on success, fall back to the
 *   existing cache (within the 7-day grace) when the server is unreachable
 */
export async function resolveLicense(opts: {
  key: string;
  domain: string;
  cacheFile: string;
  fetchFn?: typeof fetch;
  now?: number;
}): Promise<LicenseStatus> {
  const { key, domain, cacheFile, fetchFn = fetch, now = Date.now() } = opts;

  if (!key) {
    return { active: false, tier: "free", expires: null, reason: "no-key" };
  }

  let cache = readCache(cacheFile);

  if (!cache || isStale(cache, now)) {
    const fresh = await validateRemote(key, domain, fetchFn);
    if (fresh) {
      writeCache(cacheFile, fresh, now);
      cache = { ...fresh, cachedAt: now };
    }
    // else: network failure — keep the existing cache and let grace decide
  }

  const { active, tier } = computeStatus(cache, now);
  return {
    active,
    tier,
    expires: cache?.expires ?? null,
    reason: active ? null : cache?.reason ?? "unlicensed",
  };
}
