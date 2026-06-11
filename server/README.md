# Service Map Bug Triage MCP Server

An [MCP](https://modelcontextprotocol.io) server that lets an AI client (Claude Code, Claude Desktop, etc.) trace inter-service bugs across the service-map service graph and read GitHub source code — all addressed by service id, never by raw repo names.

## Tools

| Tool | What it does |
|---|---|
| `list_services` | Browse services, filter by area/kind/status/q |
| `get_service` | Full service record + who it calls + who calls it |
| `trace_dependencies` | BFS blast radius (downstream / upstream / both) |
| `search_code` | GitHub code search scoped to a service or all repos |
| `read_file` | Read a file from a service's GitHub repo |
| `list_recent_commits` | Recent commits — useful for "did something change here?" |
| `graph_health` | YAML validation errors detected at startup |

## Intended bug-triage workflow

1. Paste the customer bug report into your AI client.
2. AI calls `list_services(q=<keywords>)` to find the entry service.
3. AI calls `trace_dependencies` to see the connected service subgraph.
4. AI calls `search_code` / `read_file` across that narrow set.
5. AI calls `list_recent_commits` on suspect services.
6. AI outputs a root-cause hypothesis with file/commit citations.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GITHUB_TOKEN` | yes | — | Fine-grained PAT or GitHub App token. Read-only Contents + Metadata on the org's repos. |
| `GITHUB_OWNER` | yes | — | GitHub org/owner (e.g. `your-org`). |
| `PORT` | no | `47821` | HTTP port. |
| `DATA_DIR` | no | `../data` | Path to the directory containing `services/` and `externals.yml`. |

The server exits immediately on startup if any required variable is missing.

## Running locally

```bash
cd server
cp .env.example .env   # fill in GITHUB_TOKEN and GITHUB_OWNER
pnpm install
pnpm dev
```

## Running with Docker

```bash
# From the repo root
docker build -f server/Dockerfile -t service-map-bug-triage-mcp .

docker run -p 47821:47821 \
  -e GITHUB_TOKEN=ghp_xxx \
  -e GITHUB_OWNER=your-org \
  service-map-bug-triage-mcp
```

## Connecting Claude Code / Claude Desktop

Add to your MCP client config (e.g. `~/.claude/mcp_servers.json` for Claude Code):

```json
{
  "mcpServers": {
    "service-map-bug-triage": {
      "url": "http://<host>:47821"
    }
  }
}
```

Replace `<host>` with `localhost` for local dev or your deployment address for the shared instance.

## Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

Open `http://localhost:6274`, set transport to **Streamable HTTP**, URL to `http://localhost:47821`, and connect.

## Running tests

```bash
cd server
pnpm test
```

## Graph data

The server reads `data/services/*.yml` and `data/externals.yml` at startup. A graph update requires a redeploy. Use `graph_health` to check for YAML validation issues.
