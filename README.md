# Service Map

An interactive visualization of inter-service dependencies. Clone, configure, and deploy — no source code changes required.

---

## Prerequisites

- **Node.js** >= 20 ([nodejs.org](https://nodejs.org))
- **pnpm** >= 9 — install with `npm install -g pnpm`

---

## Quick start

```bash
# 1. Clone the repo
git clone <your-private-repo-url> service-map
cd service-map

# 2. Install dependencies
pnpm install

# 3. Create your config from the example
cp viz.config.example.yml viz.config.yml

# 4. Start the dev server
pnpm dev
```

Open `http://localhost:5173`. You'll see the example services. Edit `viz.config.yml` and your YAML files to describe your own architecture.

---

## Configuration reference

All configuration lives in `viz.config.yml` at the repo root. This file is gitignored — only `viz.config.example.yml` is tracked, so your team's config stays private.

### dataDir

```yaml
dataDir: ./data
```

Path (relative to repo root) to the directory containing your service YAML files. The directory must contain:

- `services/` — one `.yml` file per service
- `externals.yml` — (optional) list of external systems your services depend on

### areas

```yaml
areas:
  - id: Backend         # used in service YAML files — must match exactly
    label: Backend      # displayed in the UI
    # color is optional — auto-assigned from a palette if omitted
    color:
      bg: "#eff6ff"
      border: "#2563eb"
      text: "#1d4ed8"
      pill: "#dbeafe"
```

Each service's `area` field must match one of these `id` values.

### kinds

```yaml
kinds:
  - id: backend
    label: Backend
    icon: "λ"    # single character shown on the node card
```

Each service's `kind` field must match one of these `id` values.

### statuses

```yaml
statuses:
  - Planning
  - "In Progress"
  - Done
  - Deprecated
```

Each service's optional `status` field must match one of these strings exactly.

### edgeKinds

```yaml
edgeKinds:
  - id: sync-http
    label: HTTP
    color: "#1e293b"
    dashed: false    # optional, default false
    animated: false  # optional, default false
```

Each `depends_on` entry's `kind` field must match one of these `id` values.

---

## Adding services

Create `<dataDir>/services/<kebab-id>.yml`:

```yaml
id: payments-api          # required — kebab-case, unique across all services
name: Payments API        # display name shown on the node card
area: Backend             # must match an area id in viz.config.yml
kind: backend             # must match a kind id in viz.config.yml
status: In Progress       # optional — must match a status in viz.config.yml
owner: Platform Team      # optional, free text
tech: [Go, PostgreSQL]    # optional list of technologies
summary: >                # optional, shown in the detail drawer
  Handles payment processing and subscription billing.
github: payments-api      # optional, GitHub repo name (used for links)
depends_on:
  - target: auth-service        # must be the id of another known service
    kind: sync-http             # must match an edgeKind id
    via: REST / JWT             # optional, describes the interface
  - target: billing-events-sns
    kind: async-event
related:
  - billing-dashboard           # ids of related services (shown in the drawer)
```

The file is picked up automatically on the next dev server reload or build. No restarts required — save the file and the graph updates.

---

## Adding external systems

Edit `<dataDir>/externals.yml`. Each entry follows the same YAML schema as a service, with `kind` matching your external kind id, the appropriate area id, and `external: true`:

```yaml
- id: stripe
  name: Stripe
  area: External        # must match an area id in viz.config.yml
  kind: external        # must match a kind id in viz.config.yml
  external: true
  summary: Payment gateway for card processing.
  depends_on: []

- id: sendgrid
  name: SendGrid
  area: External
  kind: external
  external: true
  summary: Transactional email delivery.
  depends_on: []
```

---

## Deploying

```bash
pnpm build
```

This produces a `dist/` directory of static files — no server required. Host it anywhere:

| Platform | How |
|----------|-----|
| **Netlify** | Drag `dist/` into the Netlify dashboard, or connect the repo: build command `pnpm build`, publish dir `dist` |
| **Vercel** | Import the repo; set framework to "Vite", output dir to `dist` |
| **GitHub Pages** | Push `dist/` contents to the `gh-pages` branch, or use a GitHub Actions workflow |
| **S3 / CloudFront** | Upload `dist/` to an S3 bucket configured for static website hosting |

The build uses relative asset paths (`base: "./"`) so it works at any subdirectory URL.

---

## Updating

Pull changes from the upstream repo:

```bash
git pull origin main
pnpm install          # pick up any new or updated dependencies
pnpm build            # verify the build still passes with your config
```

Your `viz.config.yml` and data files are never modified by upstream changes.

---

## License & activation

Service Map is **source-available** under the Business Source License 1.1 (BUSL-1.1). It is free for personal, educational, evaluation, and non-production community use. Enterprise and production use requires a commercial license. The license converts to Apache-2.0 on 2030-06-12.

> Source-available is not the same as open source (OSI definition). Review [LICENSE](./LICENSE) before commercial use.

### Get a license key

Every install — free or paid — needs a license key for activation (this doubles as lead capture so we can support you).

| Tier | Link |
|---|---|
| **Community / personal (free)** | <https://wallstrdev.com/product/service-map-interactive-microservice-dependency-visualization-tool-community-version/> |
| **Enterprise / production (paid)** | <https://wallstrdev.com/product/service-map-interactive-microservice-dependency-visualization-tool/> |

### Activate the web UI

1. Open the app in your browser.
2. You will see the activation screen on first load.
3. Paste your license key and click **Verify**.
4. The app unlocks immediately. The key is cached locally; background re-validation happens every 24 hours with a 7-day offline grace period.

To change or remove your key later: open **Settings → License**.

### Activate the MCP server

Set the following in `server/.env`:

```dotenv
LICENSE_KEY=your-key-here
# LICENSE_DOMAIN=your-company.com   # defaults to GITHUB_OWNER if unset
```

The server validates the key on startup. With a valid cached result it keeps running for up to 7 days without network access. An invalid or missing key causes the server to exit with activation instructions.

---

See [LICENSES](./LICENSES) for third-party dependency licences, including the EPL-2.0 notice for elkjs.
