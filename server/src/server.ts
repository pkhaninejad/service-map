import "dotenv/config";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import http from "node:http";
import path from "node:path";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { loadGraphFs } from "./graph/loadGraphFs.js";
import { listServices, getService, traceDependencies } from "./tools/graphTools.js";
import { searchCode, readFile, listRecentCommits } from "./tools/codeTools.js";
import { listProbes, callService } from "./tools/probeTools.js";
import { createGitHubClient } from "./github.js";
import { createLocalFsClient, hasLocalRepos } from "./localFs.js";
import { createProbeClient, saveProbeSecret, configuredProfiles, type Profile } from "./probe.js";
import { syncRepos, REPOS_DIR } from "./api/syncRepos.js";
import { runClaude } from "./api/runClaude.js";
import { saveService } from "./api/saveService.js";
import { resolveLicense } from "./license.js";

const config = loadConfig();

// ── License gate ──────────────────────────────────────────────────────────────
// Real enforcement point: the server an enterprise deploys refuses to run
// without a valid license. Personal/community use is free but still needs a
// (free) key. A valid cached license keeps working for up to 7 days offline.
const LICENSE_CACHE = path.resolve(".license-cache.json");
const license = await resolveLicense({
  key: config.licenseKey,
  domain: config.licenseDomain,
  cacheFile: LICENSE_CACHE,
});

if (!license.active) {
  console.error(
    [
      "",
      "  ✖ service-map MCP server — no valid license.",
      `    Reason: ${license.reason ?? "unlicensed"}`,
      "",
      "    This server requires a license to run.",
      "    Personal & community use is free; enterprise/production use is paid.",
      "",
      "      1. Get a license (free or enterprise):",
      "         https://wallstrdev.com/product/service-map-interactive-microservice-dependency-visualization-tool/",
      "      2. Set LICENSE_KEY (and optionally LICENSE_DOMAIN) in server/.env",
      "      3. Restart the server.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(`[license] active — ${license.tier} tier`);

const dataDir = path.resolve(config.dataDir);
const graph = loadGraphFs(dataDir);
if (graph.errors.length > 0) {
  console.warn(`[graph] ${graph.errors.length} validation issue(s):\n` + graph.errors.join("\n"));
}

const usingLocalRepos = hasLocalRepos();
const github = usingLocalRepos
  ? createLocalFsClient()
  : createGitHubClient(config.githubToken);
if (usingLocalRepos) {
  console.log(`[code] using local repos at ${REPOS_DIR}`);
} else {
  console.log(`[code] no local repos found — using GitHub API`);
}

const probeClient = createProbeClient();

// ── MCP server factory (one instance per session) ─────────────────────────────

function createMcpServer() {
  const server = new McpServer({ name: "service-map-bug-triage", version: "1.0.0" });

  server.tool(
    "list_services",
    "List services in the dependency graph, optionally filtered by area, kind, status, or a search query (q) matched against id and name.",
    { area: z.string().optional(), kind: z.string().optional(), status: z.string().optional(), q: z.string().optional() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(listServices(graph.nodes, args), null, 2) }] }),
  );

  server.tool(
    "get_service",
    "Get full details for a single service including its dependencies and reverse dependencies (dependents).",
    { id: z.string() },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(getService(graph.nodes, graph.edges, args.id), null, 2) }] }),
  );

  server.tool(
    "trace_dependencies",
    "Trace the dependency subgraph (blast radius) from a service via BFS. direction: downstream=what it calls, upstream=what calls it, both=all connected.",
    { id: z.string(), direction: z.enum(["downstream", "upstream", "both"]), depth: z.number().int().min(1).max(10).optional().default(2) },
    async (args) => ({
      content: [{ type: "text", text: JSON.stringify(traceDependencies(graph.nodes, graph.edges, args.id, args.direction, args.depth), null, 2) }],
    }),
  );

  server.tool(
    "search_code",
    "Search GitHub code in a specific service's repo (serviceId) or across all mapped repos. Returns file paths and snippets.",
    { query: z.string(), serviceId: z.string().optional() },
    async (args) => ({
      content: [{ type: "text", text: JSON.stringify(await searchCode(graph.nodes, github, config.githubOwner, args), null, 2) }],
    }),
  );

  server.tool(
    "read_file",
    "Read the contents of a file from a service's GitHub repo. Specify path relative to repo root. Optionally provide a git ref (branch, tag, sha).",
    { serviceId: z.string(), path: z.string(), ref: z.string().optional() },
    async (args) => ({
      content: [{ type: "text", text: JSON.stringify(await readFile(graph.nodes, github, config.githubOwner, args), null, 2) }],
    }),
  );

  server.tool(
    "list_recent_commits",
    "List recent commits in a service's GitHub repo. Optionally scope to a file path.",
    { serviceId: z.string(), path: z.string().optional(), limit: z.number().int().min(1).max(100).optional().default(20) },
    async (args) => ({
      content: [{ type: "text", text: JSON.stringify(await listRecentCommits(graph.nodes, github, config.githubOwner, args), null, 2) }],
    }),
  );

  server.tool(
    "list_probes",
    "List services that are live-callable for debugging (have a probe block), their operations, and whether the credential profile each needs is configured on this server. Use before call_service to discover what can be called.",
    {},
    async () => ({
      content: [{ type: "text", text: JSON.stringify(listProbes(graph.nodes, configuredProfiles()), null, 2) }],
    }),
  );

  server.tool(
    "call_service",
    "Call a live service endpoint (dev) to fetch real runtime data while debugging. Resolves the operation from the service's probe block, applies credentials server-side, and returns the response. To localize a bug, call an internal service AND the external API it depends on, then diff the results. Mutating (write) operations require allowWrite: true.",
    {
      serviceId: z.string(),
      operation: z.string(),
      params: z.record(z.string(), z.string()).optional(),
      query: z.record(z.string(), z.string()).optional(),
      body: z.unknown().optional(),
      allowWrite: z.boolean().optional(),
    },
    async (args) => ({
      content: [{ type: "text", text: JSON.stringify(await callService(graph.nodes, probeClient, args), null, 2) }],
    }),
  );

  server.tool(
    "graph_health",
    "Report any YAML validation errors detected when loading the service graph at startup.",
    {},
    async () => ({
      content: [{ type: "text", text: JSON.stringify({ errorCount: graph.errors.length, errors: graph.errors }, null, 2) }],
    }),
  );

  return server;
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id",
};

// One transport per session — keyed by the session ID assigned on first POST.
const transports = new Map<string, StreamableHTTPServerTransport>();

const httpServer = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Apply CORS to every response
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);

  const pathname = new URL(req.url ?? "/", "http://x").pathname;

  // OAuth discovery — return JSON 404 so clients skip the auth flow.
  if (pathname === "/register" || pathname.startsWith("/.well-known/")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
    return;
  }

  // REST: save service
  if (pathname === "/api/services/save" && req.method === "POST") {
    try {
      const body = await new Promise<string>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks).toString()));
        req.on("error", reject);
      });
      const { id, patch } = JSON.parse(body) as { id: string; patch: Record<string, unknown> };
      await saveService(config.githubToken, config.githubOwner, config.dataRepo, id, patch);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  // REST: run claude
  if (pathname === "/api/run-claude" && req.method === "POST") {
    try {
      const body = await new Promise<string>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks).toString()));
        req.on("error", reject);
      });
      const { prompt } = JSON.parse(body) as { prompt: string };
      runClaude(prompt, res);
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  // REST: configure a probe credential profile (written to gitignored local file)
  if (pathname === "/api/probes/secret" && req.method === "POST") {
    try {
      const body = await new Promise<string>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks).toString()));
        req.on("error", reject);
      });
      const { name, profile } = JSON.parse(body) as { name: string; profile: Profile };
      if (!name || !profile?.baseUrl || !profile?.auth) {
        throw new Error("Body must be { name, profile: { baseUrl, auth } }");
      }
      saveProbeSecret(name, profile);
      // Never echo secret values back — only confirm which profiles are configured.
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, configured: configuredProfiles() }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  // REST: call a live service operation (backs the UI "Try it" button + curl testing)
  if (pathname === "/api/probes/call" && req.method === "POST") {
    try {
      const body = await new Promise<string>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks).toString()));
        req.on("error", reject);
      });
      const args = JSON.parse(body) as Parameters<typeof callService>[2];
      const result = await callService(graph.nodes, probeClient, args);
      res.writeHead("error" in result ? 400 : 200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  // REST: which probe profiles are configured (no secret values)
  if (pathname === "/api/probes/status" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ configured: configuredProfiles() }));
    return;
  }

  // REST: sync repos
  if (pathname === "/api/repos/sync" && req.method === "POST") {
    try {
      const body = await new Promise<string>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks).toString()));
        req.on("error", reject);
      });
      const { repos, token } = JSON.parse(body) as { repos: string[]; token?: string };
      const results = await syncRepos(repos, token);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ results, reposDir: REPOS_DIR }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // Resume an existing session
    if (sessionId && transports.has(sessionId)) {
      await transports.get(sessionId)!.handleRequest(req, res);
      return;
    }

    // New session — only POST can initiate
    if (req.method !== "POST") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "New sessions must be initiated with POST" }));
      return;
    }

    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports.set(id, transport);
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) transports.delete(transport.sessionId);
    };

    await createMcpServer().connect(transport);
    await transport.handleRequest(req, res);
  } catch (err) {
    console.error("[mcp] request error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }
});

httpServer.listen(config.port, () => {
  console.log(`[service-map-bug-triage-mcp] listening on port ${config.port}`);
  console.log(`[graph] loaded ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
});
