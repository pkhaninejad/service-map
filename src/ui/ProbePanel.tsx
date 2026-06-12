import { useEffect, useState } from "react";
import type { Service, ProbeOperation } from "../schema";
import { PROBE_BADGE } from "../graph/styles";

// ── shared inline styles ────────────────────────────────────────────────────

const label: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af",
};
const input: React.CSSProperties = {
  all: "unset", display: "block", width: "100%", boxSizing: "border-box",
  border: "1px solid #d1d5db", borderRadius: 6, padding: "5px 8px", fontSize: 12.5,
  color: "#111827", background: "#fff", lineHeight: 1.5,
};
const btn = (bg: string, fg: string): React.CSSProperties => ({
  all: "unset", cursor: "pointer", background: bg, color: fg, fontWeight: 600,
  fontSize: 12, padding: "6px 14px", borderRadius: 7, textAlign: "center",
});
const codeBox: React.CSSProperties = {
  fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  background: "#0f172a", color: "#e2e8f0", borderRadius: 7, padding: "8px 10px",
  whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 280, overflow: "auto", margin: 0,
};

const pathParams = (path: string): string[] =>
  [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

// ── one operation: param inputs + Try it + result ────────────────────────────

function OperationRow({ serviceId, name, op }: { serviceId: string; name: string; op: ProbeOperation }) {
  const params = pathParams(op.path);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    setIsError(false);
    try {
      const res = await fetch(`${__MCP_URL__}/api/probes/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, operation: name, params: values, allowWrite: op.write }),
      });
      const data = await res.json();
      setIsError(!res.ok || "error" in data);
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setIsError(true);
      setResult(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: op.write ? "#b91c1c" : "#0369a1", background: op.write ? "#fee2e2" : "#e0f2fe", padding: "1px 6px", borderRadius: 5 }}>
          {op.method}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{name}</span>
        {op.write && <span style={{ fontSize: 9.5, color: "#b91c1c" }}>write</span>}
      </div>
      <code style={{ fontSize: 10.5, color: "#6b7280", fontFamily: "ui-monospace, monospace" }}>{op.path}</code>
      {op.description && <p style={{ fontSize: 11.5, color: "#6b7280", margin: 0, lineHeight: 1.45 }}>{op.description}</p>}

      {params.map((p) => (
        <div key={p} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={label}>{p}</span>
          <input
            style={input}
            value={values[p] ?? ""}
            placeholder={p}
            onChange={(e) => setValues((v) => ({ ...v, [p]: e.target.value }))}
          />
        </div>
      ))}

      <button onClick={run} disabled={loading} style={{ ...btn("#2563eb", "#fff"), opacity: loading ? 0.6 : 1 }}>
        {loading ? "Calling…" : "Try it"}
      </button>

      {result && (
        <pre style={{ ...codeBox, ...(isError ? { background: "#7f1d1d" } : {}) }}>{result}</pre>
      )}
    </div>
  );
}

// ── credential entry (writes to gitignored probes.local.json) ─────────────────

type AuthKind = "api-key" | "bearer" | "oauth-client-credentials";

function CredentialForm({ profile, onSaved }: { profile: string; onSaved: () => void }) {
  const [baseUrl, setBaseUrl] = useState("");
  const [kind, setKind] = useState<AuthKind>("api-key");
  const [header, setHeader] = useState("x-api-key");
  const [value, setValue] = useState("");
  const [token, setToken] = useState("");
  const [tokenUrl, setTokenUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    const auth =
      kind === "api-key" ? { kind, header, value }
      : kind === "bearer" ? { kind, token }
      : { kind, tokenUrl, clientId, clientSecret };
    try {
      const res = await fetch(`${__MCP_URL__}/api/probes/secret`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profile, profile: { baseUrl, auth } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save failed");
      setMsg("Saved ✓ (stored locally, not committed)");
      onSaved();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={label}>Base URL</span>
        <input style={input} value={baseUrl} placeholder="https://service.dev…" onChange={(e) => setBaseUrl(e.target.value)} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={label}>Auth type</span>
        <select style={{ ...input, cursor: "pointer" }} value={kind} onChange={(e) => setKind(e.target.value as AuthKind)}>
          <option value="api-key">api-key (header)</option>
          <option value="bearer">bearer token</option>
          <option value="oauth-client-credentials">oauth client-credentials</option>
        </select>
      </div>

      {kind === "api-key" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={label}>Header name</span>
            <input style={input} value={header} onChange={(e) => setHeader(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={label}>Key value</span>
            <input style={input} type="password" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        </>
      )}
      {kind === "bearer" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={label}>Bearer token</span>
          <input style={input} type="password" value={token} onChange={(e) => setToken(e.target.value)} />
        </div>
      )}
      {kind === "oauth-client-credentials" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={label}>Token URL</span>
            <input style={input} value={tokenUrl} placeholder="https://…/oauth/token" onChange={(e) => setTokenUrl(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={label}>Client ID</span>
            <input style={input} value={clientId} onChange={(e) => setClientId(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={label}>Client secret</span>
            <input style={input} type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
          </div>
        </>
      )}

      <button onClick={save} disabled={saving} style={{ ...btn("#0f766e", "#fff"), opacity: saving ? 0.6 : 1 }}>
        {saving ? "Saving…" : `Save credentials for "${profile}"`}
      </button>
      {msg && <div style={{ fontSize: 11, color: msg.startsWith("Saved") ? "#15803d" : "#dc2626" }}>{msg}</div>}
    </div>
  );
}

// ── panel ─────────────────────────────────────────────────────────────────────

export function ProbePanel({ service }: { service: Service }) {
  const probe = service.probe;
  const [configured, setConfigured] = useState<string[] | null>(null);
  const [showCreds, setShowCreds] = useState(false);

  async function fetchStatus(): Promise<string[]> {
    try {
      const res = await fetch(`${__MCP_URL__}/api/probes/status`);
      const data = await res.json();
      return data.configured ?? [];
    } catch {
      return [];
    }
  }

  useEffect(() => {
    let active = true;
    // Fetch-on-mount: setConfigured runs after the awaited fetch, not synchronously.
    void fetchStatus().then((c) => { if (active) setConfigured(c); });
    return () => { active = false; };
  }, []);

  if (!probe) return null;
  const ops = Object.entries(probe.operations);
  const isConfigured = configured?.includes(probe.profile) ?? false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={label}>Live API ({PROBE_BADGE.label})</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: isConfigured ? "#15803d" : "#b45309" }}>
          {configured === null ? "…" : isConfigured ? "credentials set ✓" : "no credentials"}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "#9ca3af" }}>
        profile: <code style={{ fontFamily: "ui-monospace, monospace" }}>{probe.profile}</code>
      </div>

      {!isConfigured && configured !== null && (
        <div style={{ fontSize: 11.5, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 7, padding: "6px 10px" }}>
          No credentials configured for this profile — calls will fail until you set them below.
        </div>
      )}

      {ops.length === 0 && (
        <div style={{ fontSize: 11.5, color: "#9ca3af" }}>No operations defined yet.</div>
      )}
      {ops.map(([name, op]) => (
        <OperationRow key={name} serviceId={service.id} name={name} op={op} />
      ))}

      <button onClick={() => setShowCreds((s) => !s)} style={{ ...btn("#f3f4f6", "#374151"), border: "1px solid #e5e7eb" }}>
        {showCreds ? "Hide credentials" : isConfigured ? "Update credentials" : "Configure credentials"}
      </button>
      {showCreds && <CredentialForm profile={probe.profile} onSaved={() => { void fetchStatus().then(setConfigured); }} />}
    </div>
  );
}
