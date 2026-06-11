import fs from "node:fs";
import path from "node:path";

// ── Connection profiles (secret — never committed) ────────────────────────────
//
// Profiles bundle the environment-specific base URL with the credential needed
// to call it. They live in a gitignored JSON file (default ./probes.local.json,
// override with PROBES_FILE) so URLs + tokens never enter git or tool output.
// Service YAML references a profile only by name (see Probe.profile in schema).

export type Auth =
  | { kind: "none" }
  | { kind: "api-key"; header: string; value: string }
  | { kind: "bearer"; token: string }
  | {
      kind: "oauth-client-credentials";
      tokenUrl: string;
      // Pre-encoded base64 "client_id:secret" for the Basic header …
      basic?: string;
      // … or supply the parts and we encode them.
      clientId?: string;
      clientSecret?: string;
      grantType?: string;
    };

export type Profile = {
  baseUrl: string;
  auth: Auth;
};

export type ProbeSecrets = Record<string, Profile>;

const PROBES_FILE = process.env.PROBES_FILE ?? path.resolve("probes.local.json");

let secrets: ProbeSecrets = loadProbeSecrets();

export function loadProbeSecrets(): ProbeSecrets {
  try {
    if (!fs.existsSync(PROBES_FILE)) return {};
    return JSON.parse(fs.readFileSync(PROBES_FILE, "utf8")) as ProbeSecrets;
  } catch (err) {
    console.warn(`[probe] could not read ${PROBES_FILE}: ${String(err)}`);
    return {};
  }
}

/** Upsert one profile and persist. Used by the UI's secret-entry endpoint. */
export function saveProbeSecret(name: string, profile: Profile): void {
  secrets = { ...loadProbeSecrets(), [name]: profile };
  fs.writeFileSync(PROBES_FILE, JSON.stringify(secrets, null, 2));
  tokenCache.delete(name); // force re-mint with new credentials
}

/** Names of configured profiles — safe to expose (no secret values). */
export function configuredProfiles(): string[] {
  return Object.keys(secrets);
}

// ── OAuth token cache ─────────────────────────────────────────────────────────

type CachedToken = { token: string; expiresAt: number };
const tokenCache = new Map<string, CachedToken>();

async function mintToken(profileName: string, auth: Extract<Auth, { kind: "oauth-client-credentials" }>): Promise<string> {
  const cached = tokenCache.get(profileName);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const basic =
    auth.basic ??
    Buffer.from(`${auth.clientId ?? ""}:${auth.clientSecret ?? ""}`).toString("base64");

  const res = await fetch(auth.tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: auth.grantType ?? "client_credentials" }),
  });
  if (!res.ok) {
    throw new Error(`token endpoint returned ${res.status} for profile "${profileName}"`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error(`token endpoint response had no access_token`);

  // Refresh 30s early to avoid races with expiry.
  const ttl = (data.expires_in ?? 300) - 30;
  tokenCache.set(profileName, { token: data.access_token, expiresAt: Date.now() + ttl * 1000 });
  return data.access_token;
}

async function authHeaders(profileName: string, auth: Auth): Promise<Record<string, string>> {
  switch (auth.kind) {
    case "none":
      return {};
    case "api-key":
      return { [auth.header]: auth.value };
    case "bearer":
      return { Authorization: `Bearer ${auth.token}` };
    case "oauth-client-credentials":
      return { Authorization: `Bearer ${await mintToken(profileName, auth)}` };
  }
}

// ── Probe client ───────────────────────────────────────────────────────────────

export type ProbeRequest = {
  profile: string;
  method: string;
  /** Path relative to the profile's baseUrl, with params already substituted. */
  path: string;
  query?: Record<string, string>;
  body?: unknown;
};

export type ProbeResponse = {
  status: number;
  ok: boolean;
  durationMs: number;
  body: unknown;
};

/** Config error (missing/unknown profile) — distinct from an HTTP failure. */
export class ProbeConfigError extends Error {}

export type ProbeClient = {
  request(req: ProbeRequest): Promise<ProbeResponse>;
};

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 256 * 1024;

export function createProbeClient(): ProbeClient {
  return {
    async request(req: ProbeRequest): Promise<ProbeResponse> {
      const profile = secrets[req.profile];
      if (!profile) {
        const known = configuredProfiles();
        throw new ProbeConfigError(
          `No credentials configured for profile "${req.profile}". ` +
            (known.length ? `Configured profiles: ${known.join(", ")}.` : `No profiles are configured yet.`),
        );
      }

      const url = new URL(profile.baseUrl.replace(/\/$/, "") + "/" + req.path.replace(/^\//, ""));
      for (const [k, v] of Object.entries(req.query ?? {})) url.searchParams.set(k, v);

      const headers: Record<string, string> = await authHeaders(req.profile, profile.auth);
      let bodyInit: string | undefined;
      if (req.body !== undefined && req.method !== "GET") {
        headers["Content-Type"] = "application/json";
        bodyInit = JSON.stringify(req.body);
      }

      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method: req.method,
          headers,
          body: bodyInit,
          signal: controller.signal,
        });

        const text = await res.text();
        const capped = text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) + "\n…[truncated]" : text;
        let parsed: unknown = capped;
        try {
          parsed = JSON.parse(capped);
        } catch {
          // leave as text
        }

        return { status: res.status, ok: res.ok, durationMs: Date.now() - started, body: parsed };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
