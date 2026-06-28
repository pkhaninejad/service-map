import { LICENSE_SERVER_URL } from "./config";

/**
 * Browser-side license validation. This is a lead-capture / honor-system gate
 * (the app is open source — it is not a security boundary). It mirrors the
 * contract and grace semantics of the WordPress plugin and the MCP server.
 *
 * A `free` tier with `valid: true` is a *real* license (issued by the free
 * product) and counts as active. Only `valid: false` or an expired (>7d) cache
 * locks the UI behind the activation screen.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_MS = 7 * DAY_MS;

export const STORAGE_KEY = "service-map-license";
export const KEY_STORAGE_KEY = "service-map-license-key";

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

/** POST {key, domain} to the license server. Null on network/parse failure. */
export async function validateRemote(
  key: string,
  domain: string,
  fetchFn: typeof fetch = fetch,
): Promise<ValidationResult | null> {
  try {
    const res = await fetchFn(LICENSE_SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, domain, product: "service-map" }),
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
 * Resolve the effective entitlement from a cached result. Within the 7-day
 * grace window a valid cache stays active; past it we downgrade (locked).
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

// ── localStorage persistence ─────────────────────────────────────────────────

export function readCache(): LicenseCache | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as LicenseCache;
  } catch {
    return null;
  }
}

export function writeCache(result: ValidationResult, now: number): void {
  const cache: LicenseCache = { ...result, cachedAt: now };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

export function readKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeKey(key: string): void {
  localStorage.setItem(KEY_STORAGE_KEY, key);
}

export function clearLicense(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(KEY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
