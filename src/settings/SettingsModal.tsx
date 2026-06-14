import { useState, useEffect, useRef } from "react";
import { AREAS, KINDS, STATUSES, EDGE_KINDS } from "../schema";
import { useLicense } from "../license/LicenseProvider";
import { FREE_URL, ENTERPRISE_URL } from "../license/config";

// ── localStorage ─────────────────────────────────────────────────────────────

const LS_KEY = "service-map-settings";

interface Settings {
  mcpUrl: string;
  githubToken: string;
  repos: string; // newline-separated
}

function loadSettings(): Settings {
  const defaults = { mcpUrl: __MCP_URL__, githubToken: "", repos: "" };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...JSON.parse(raw), mcpUrl: __MCP_URL__ };
  } catch {
    /* corrupt localStorage — fall back to defaults */
  }
  return defaults;
}

const T = "```"; // triple-backtick — can't be used literally inside a template literal

function saveSettings(s: Settings) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

// ── Sync types ────────────────────────────────────────────────────────────────

interface SyncResult {
  repo: string;
  status: "cloned" | "pulled" | "error";
  path: string;
  error?: string;
}

// ── Prompt generation ─────────────────────────────────────────────────────────

function buildPrompt(repos: string[], syncResults: SyncResult[]): string {
  const repoLines = repos
    .filter(Boolean)
    .map((r) => {
      const result = syncResults.find((s) => s.repo === r || s.repo.includes(r.split("/")[1] ?? r));
      const localPath = result?.path ? `\n     Local path: ${result.path}` : "";
      return `  - ${r}${localPath}`;
    })
    .join("\n");

  return `You are helping populate a service dependency graph.

## Your task
Analyze the repositories listed below and create YAML service definition files for the service-map tool.
Place each YAML file in the \`data/services/\` directory of the service-map project.

## Repositories to analyze
${repoLines || "  (no repos configured — add repos in the Setup tab first)"}

## YAML schema
${T}yaml
id: my-service           # kebab-case (lowercase, numbers, hyphens), unique across all services
name: My Service         # human-readable display name
area: ${AREAS[0] ?? "platform"}              # one of: ${AREAS.join(", ")}
kind: backend            # one of: ${KINDS.join(", ")}
status: In Progress      # one of: ${STATUSES.join(", ")}
summary: |
  Short description of what this service does.

# Optional fields:
owner: Platform
maintainedBy: [Platform]
developedBy: [TeamName]
tech: [TypeScript, PostgreSQL]
runtime: Node.js (ECS)
github: github_repo_name    # just the repo name (not the full URL)

depends_on:
  - target: other-service-id   # must match an existing id in data/services/
    kind: sync-http             # one of: ${EDGE_KINDS.join(", ")}
    via: "HTTPS (REST)"         # optional: human description of the connection
${T}

## Real example
${T}yaml
id: order-service
name: Order Service
area: ${AREAS[0] ?? "platform"}
kind: backend
status: In Progress
owner: Platform
maintainedBy: [Platform]
developedBy: [Orders]
tech: [TypeScript, PostgreSQL]
runtime: Node.js (ECS)
github: order-service
summary: Owns order creation, state transitions, and history.
depends_on:
  - target: payment-gateway
    via: HTTPS (REST)
    kind: sync-http
${T}

## Workflow — follow these steps in order

### Step 1 — Inventory what already exists
Run: \`ls data/services/\` and read \`data/externals.yml\` (if it exists).
Collect every \`id\` that is already defined. You will use this list in Step 4.

### Step 2 — Analyse each repository
For each repo: examine README, package.json / go.mod / pom.xml, Dockerfile, k8s configs, CI workflows.
Identify every distinct deployable unit (API, worker, frontend, library, etc.).

### Step 3 — Write service YAML files
Create \`data/services/<id>.yml\` for each service you found.
- Use only the allowed enum values for \`area\`, \`kind\`, \`status\`, \`depends_on.kind\`
- If unsure about a value, omit that field
- For \`depends_on\`, write the targets you know — you will fix any missing ones in Step 4

### Step 4 — Mandatory gap-fill (do not skip)
This step is required. Do not finish without completing it.

a) Collect every \`depends_on.target\` value across **all** files in \`data/services/\` (both pre-existing and ones you just created).
b) Compare against the full ID inventory from Step 1 plus every ID you created in Step 3.
c) For every target that is still missing, add it to \`data/externals.yml\` as a YAML array entry with \`kind: external\`, \`area: External\`, \`external: true\`.
d) Read \`data/externals.yml\` first (it may already have entries), merge, and write the whole file back.

${T}yaml
# data/externals.yml — YAML array, one entry per external/unknown service
- id: stripe
  name: Stripe
  area: External
  kind: external
  external: true
  status: In Progress
  summary: Third-party payment platform.

- id: legacy-billing
  name: Legacy Billing
  area: External
  kind: external
  external: true
  status: In Progress
  summary: Referenced dependency not found in analysed repos.
${T}

### Step 5 — Verify
Run: \`grep -r "target:" data/services/ | awk '{print $NF}' | sort -u\`
Cross-check every target against \`ls data/services/\` and \`data/externals.yml\`.
If anything is still missing, add it to \`data/externals.yml\` now before finishing.
`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "repos" | "prompt" | "license";
type SyncState = "idle" | "syncing" | "done" | "error";
type RunState = "idle" | "running" | "done" | "error";

export function SettingsModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("repos");
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [promptCopied, setPromptCopied] = useState(false);
  const [runState, setRunState] = useState<RunState>("idle");
  const [runOutput, setRunOutput] = useState("");
  const outputRef = useRef<HTMLPreElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const repoList = settings.repos.split("\n").map((r) => r.trim()).filter(Boolean);

  function handleSave() {
    saveSettings(settings);
  }

  async function handleSync() {
    handleSave();
    setSyncState("syncing");
    setSyncResults([]);
    try {
      const res = await fetch(`${settings.mcpUrl}/api/repos/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repos: repoList,
          token: settings.githubToken || undefined,
        }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json() as { results: SyncResult[] };
      setSyncResults(data.results);
      setSyncState("done");
    } catch (err) {
      setSyncResults([{ repo: "—", status: "error", path: "", error: String(err) }]);
      setSyncState("error");
    }
  }

  function handleCopyPrompt() {
    const prompt = buildPrompt(repoList, syncResults);
    navigator.clipboard.writeText(prompt).then(() => {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    });
  }

  async function handleRunClaude() {
    setRunState("running");
    setRunOutput("");
    try {
      const res = await fetch(`${settings.mcpUrl}/api/run-claude`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildPrompt(repoList, syncResults) }),
      });
      if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setRunOutput((prev) => {
          const next = prev + decoder.decode(value);
          // Auto-scroll terminal
          setTimeout(() => {
            if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
          }, 0);
          return next;
        });
      }
      setRunState("done");
    } catch (err) {
      setRunOutput((prev) => prev + `\n[error] ${String(err)}`);
      setRunState("error");
    }
  }

  const statusIcon = (s: SyncResult["status"]) =>
    s === "cloned" ? "✦" : s === "pulled" ? "↑" : "✕";
  const statusColor = (s: SyncResult["status"]) =>
    s === "error" ? "#dc2626" : "#16a34a";

  return (
    // Backdrop
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Card */}
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          width: 560,
          maxWidth: "calc(100vw - 40px)",
          maxHeight: "calc(100vh - 80px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px 0",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>
            Setup
          </span>
          <button
            onClick={onClose}
            style={{
              all: "unset",
              cursor: "pointer",
              color: "#9ca3af",
              fontSize: 18,
              lineHeight: 1,
              padding: "2px 6px",
              borderRadius: 6,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: "12px 20px 0",
            borderBottom: "1px solid #f3f4f6",
          }}
        >
          {(["repos", "prompt", "license"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                all: "unset",
                cursor: "pointer",
                padding: "6px 12px",
                fontSize: 12.5,
                fontWeight: 600,
                color: tab === t ? "#2563eb" : "#6b7280",
                borderBottom: tab === t ? "2px solid #2563eb" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {t === "repos" ? "Repositories" : t === "prompt" ? "Generate Prompt" : "License"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px" }}>

          {tab === "repos" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              <Field label="MCP Server URL">
                <input
                  type="text"
                  value={settings.mcpUrl}
                  onChange={(e) => setSettings((s) => ({ ...s, mcpUrl: e.target.value }))}
                  style={inputStyle}
                  placeholder={__MCP_URL__}
                />
              </Field>

              <Field label="GitHub Token" hint="Required for private repos — stored in your browser only">
                <input
                  type="password"
                  value={settings.githubToken}
                  onChange={(e) => setSettings((s) => ({ ...s, githubToken: e.target.value }))}
                  style={inputStyle}
                  placeholder="ghp_••••••••••••••••"
                />
              </Field>

              <Field label="Repositories" hint="One per line — owner/repo or full GitHub URL">
                <textarea
                  value={settings.repos}
                  onChange={(e) => setSettings((s) => ({ ...s, repos: e.target.value }))}
                  rows={6}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
                  placeholder={"your-org/my-service\nyour-org/another-repo"}
                />
              </Field>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={handleSave} style={secondaryBtn}>
                  Save
                </button>
                <button
                  onClick={handleSync}
                  disabled={repoList.length === 0 || syncState === "syncing"}
                  style={{
                    ...primaryBtn,
                    opacity: repoList.length === 0 || syncState === "syncing" ? 0.6 : 1,
                  }}
                >
                  {syncState === "syncing" ? "Syncing…" : "↓ Sync repos"}
                </button>
                {syncState === "done" && (
                  <span style={{ fontSize: 12, color: "#16a34a" }}>Done</span>
                )}
                {syncState === "error" && (
                  <span style={{ fontSize: 12, color: "#dc2626" }}>Error — see below</span>
                )}
              </div>

              {/* Sync results */}
              {syncResults.length > 0 && (
                <div
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                  }}
                >
                  {syncResults.map((r, i) => (
                    <div key={i} style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: statusColor(r.status), fontWeight: 700, flexShrink: 0 }}>
                        {statusIcon(r.status)}
                      </span>
                      <span style={{ color: "#374151" }}>
                        <strong>{r.repo}</strong>
                        {" — "}
                        {r.status}
                        {r.error && (
                          <span style={{ color: "#dc2626", marginLeft: 4 }}>{r.error}</span>
                        )}
                        {r.path && !r.error && (
                          <span style={{ color: "#9ca3af", fontFamily: "monospace", fontSize: 11, display: "block" }}>
                            {r.path}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "prompt" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 12.5, color: "#6b7280", lineHeight: 1.5 }}>
                Run Claude automatically or copy the prompt manually.
                {repoList.length === 0 && (
                  <strong style={{ color: "#b45309" }}>
                    {" "}Add repositories in the Repositories tab first.
                  </strong>
                )}
              </p>

              {/* Primary action */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  onClick={handleRunClaude}
                  disabled={repoList.length === 0 || runState === "running"}
                  style={{
                    ...primaryBtn,
                    opacity: repoList.length === 0 || runState === "running" ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 14 }}>▶</span>
                  {runState === "running" ? "Running…" : "Run with Claude"}
                </button>
                <button onClick={handleCopyPrompt} style={secondaryBtn}>
                  {promptCopied ? "✓ Copied!" : "Copy prompt"}
                </button>
                {runState === "done" && (
                  <span style={{ fontSize: 12, color: "#16a34a" }}>
                    Done — <button onClick={() => window.location.reload()} style={{ all: "unset", cursor: "pointer", color: "#2563eb", fontWeight: 600, fontSize: 12 }}>reload graph</button>
                  </span>
                )}
              </div>

              {/* Streaming terminal output */}
              {runOutput && (
                <pre
                  ref={outputRef}
                  style={{
                    margin: 0,
                    background: "#0f172a",
                    color: "#e2e8f0",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 11,
                    fontFamily: "monospace",
                    maxHeight: 260,
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    lineHeight: 1.6,
                  }}
                >
                  {runOutput}
                </pre>
              )}

              {/* Prompt preview (collapsed) */}
              <details>
                <summary style={{ fontSize: 12, color: "#6b7280", cursor: "pointer", userSelect: "none" }}>
                  View prompt
                </summary>
                <textarea
                  readOnly
                  value={buildPrompt(repoList, syncResults)}
                  rows={14}
                  style={{
                    ...inputStyle,
                    fontFamily: "monospace",
                    fontSize: 11.5,
                    resize: "vertical",
                    color: "#374151",
                    background: "#f9fafb",
                    marginTop: 8,
                  }}
                />
              </details>
            </div>
          )}

          {tab === "license" && <LicensePanel />}
        </div>
      </div>
    </div>
  );
}

// ── License panel ─────────────────────────────────────────────────────────────

function LicensePanel() {
  const { status, tier, expires, reason, licenseKey, activate, deactivate, checking, error } = useLicense();
  const [input, setInput] = useState("");

  const active = status === "valid";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          borderRadius: 10,
          background: active ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${active ? "#bbf7d0" : "#fecaca"}`,
        }}
      >
        <span style={{ fontSize: 18 }}>{active ? "✓" : "✕"}</span>
        <div style={{ fontSize: 12.5, color: "#374151" }}>
          <div style={{ fontWeight: 600 }}>
            {active ? `Active — ${tier} tier` : "Not activated"}
          </div>
          {active && expires && <div style={{ color: "#6b7280" }}>Expires {expires}</div>}
          {!active && reason && <div style={{ color: "#b91c1c" }}>{reason}</div>}
        </div>
      </div>

      <Field label="License key" hint="Personal & community use is free; enterprise/production is paid.">
        <input
          type="text"
          value={input || licenseKey}
          onChange={(e) => setInput(e.target.value)}
          placeholder="SM-XXXX-XXXX-XXXX"
          style={{ ...inputStyle, fontFamily: "monospace" }}
        />
      </Field>

      {error && <div style={{ fontSize: 12, color: "#b91c1c" }}>{error}</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => activate(input || licenseKey)}
          disabled={checking}
          style={{ ...secondaryBtn, opacity: checking ? 0.6 : 1 }}
        >
          {checking ? "Verifying…" : active ? "Re-verify" : "Activate"}
        </button>
        {licenseKey && (
          <button onClick={() => { deactivate(); setInput(""); }} style={secondaryBtn}>
            Remove key
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 6, borderTop: "1px solid #f3f4f6" }}>
        <a href={FREE_URL} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "#2563eb", textDecoration: "none" }}>
          → Get a free license
        </a>
        <a href={ENTERPRISE_URL} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "#2563eb", textDecoration: "none" }}>
          → Buy an enterprise license
        </a>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
        {label}
        {hint && (
          <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 6 }}>{hint}</span>
        )}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  all: "unset",
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #d1d5db",
  borderRadius: 7,
  padding: "7px 10px",
  fontSize: 13,
  color: "#111827",
  background: "#fff",
  lineHeight: 1.5,
};

const primaryBtn: React.CSSProperties = {
  all: "unset",
  cursor: "pointer",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 600,
  fontSize: 12.5,
  padding: "7px 16px",
  borderRadius: 7,
  display: "inline-block",
};

const secondaryBtn: React.CSSProperties = {
  all: "unset",
  cursor: "pointer",
  background: "#f3f4f6",
  color: "#374151",
  fontWeight: 600,
  fontSize: 12.5,
  padding: "7px 16px",
  borderRadius: 7,
  border: "1px solid #e5e7eb",
  display: "inline-block",
};
