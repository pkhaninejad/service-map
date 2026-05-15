# Productization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the service-map viz tool configurable via a single `viz.config.yml` file so any engineering team can deploy it without touching source code.

**Architecture:** A single Vite plugin (`src/viz-plugin.ts`) reads `viz.config.yml` at build time and exposes two virtual modules: `virtual:viz-config` (schema enums + style maps) and `virtual:viz-data` (pre-parsed YAML service files). Source files import from these virtual modules instead of hardcoding values or using `import.meta.glob`.

**Tech Stack:** Vite plugin API, Node.js `fs`, `js-yaml` (already a dep), Zod, React, TypeScript

**Spec:** `docs/superpowers/specs/2026-05-15-productization-design.md`

---

> **No test runner is configured.** Verification in this plan uses TypeScript compilation (`pnpm build`) and manual browser checks (`pnpm dev`) as the test harness. Each task ends with a compilation check and a commit.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `viz.config.example.yml` | Tracked DTP config — buyers copy this |
| Create | `src/viz-plugin.ts` | Vite plugin: reads config, serves both virtual modules |
| Create | `src/virtual.d.ts` | TypeScript declarations for virtual modules |
| Modify | `vite.config.ts` | Register the plugin |
| Modify | `src/schema.ts` | Import enums from `virtual:viz-config` |
| Modify | `src/graph/styles.ts` | Import style maps from `virtual:viz-config` |
| Modify | `src/loader.ts` | Import data from `virtual:viz-data` |
| Modify | `.gitignore` | Ignore `viz.config.yml` (buyer-local) |
| Create | `LICENSES` | All runtime dependency licences |
| Modify | `README.md` | Buyer-facing setup documentation |

---

## Task 1: Scaffold viz.config.example.yml and update .gitignore

**Files:**
- Create: `viz.config.example.yml`
- Modify: `.gitignore`

- [ ] **Step 1: Create viz.config.example.yml**

This file preserves the existing DTP values exactly (same IDs that service YAML files reference). Explicit colors are included to preserve the current visual scheme.

```yaml
# viz.config.example.yml
# Copy this file to viz.config.yml and customise it for your team.
# viz.config.yml is gitignored — only the example is tracked.

# Path to the directory containing service YAML files (relative to repo root).
# Must contain a services/ subdirectory and optionally an externals.yml file.
dataDir: ./data

# Organizational areas / teams. Each service YAML file must set `area` to one of these ids.
# `color` is optional — areas without a color are auto-assigned from a built-in palette.
areas:
  - id: WLCAF
    label: WLCAF
    color: { bg: "#eff6ff", border: "#2563eb", text: "#1d4ed8", pill: "#dbeafe" }
  - id: CAF Dispatcher
    label: CAF Dispatcher
    color: { bg: "#f5f3ff", border: "#7c3aed", text: "#6d28d9", pill: "#ede9fe" }
  - id: ACL
    label: ACL
    color: { bg: "#ecfeff", border: "#0891b2", text: "#0e7490", pill: "#cffafe" }
  - id: Delegation
    label: Delegation
    color: { bg: "#fdf2f8", border: "#db2777", text: "#be185d", pill: "#fce7f3" }
  - id: Mobile
    label: Mobile
    color: { bg: "#f0fdf4", border: "#16a34a", text: "#15803d", pill: "#dcfce7" }
  - id: Private Listings
    label: Private Listings
    color: { bg: "#fff7ed", border: "#ea580c", text: "#c2410c", pill: "#fed7aa" }
  - id: Legacy
    label: Legacy
    color: { bg: "#fafaf9", border: "#78716c", text: "#57534e", pill: "#f5f5f4" }
  - id: External
    label: External
    color: { bg: "#f8fafc", border: "#94a3b8", text: "#64748b", pill: "#f1f5f9" }

# Service kinds. Each service YAML must set `kind` to one of these ids.
kinds:
  - id: frontend
    label: Frontend
    icon: "⬡"
  - id: backend
    label: Backend
    icon: "λ"
  - id: bff
    label: BFF
    icon: "⇌"
  - id: library
    label: Library
    icon: "◈"
  - id: infra
    label: Infra
    icon: "☁"
  - id: mobile
    label: Mobile
    icon: "⬜"
  - id: test
    label: Test
    icon: "✓"
  - id: external
    label: External
    icon: "○"

# Lifecycle statuses. Each service YAML may set `status` to one of these values.
statuses:
  - Planning
  - In Progress
  - On Hold
  - Done
  - Done / Maintenance
  - Deprecated
  - Being Migrated

# Dependency edge kinds. Each depends_on entry must set `kind` to one of these ids.
edgeKinds:
  - id: sync-http
    label: HTTP
    color: "#1e293b"
  - id: async-event
    label: Async Event
    color: "#7c3aed"
    dashed: true
    animated: true
  - id: database-read
    label: DB Read
    color: "#059669"
  - id: database-write
    label: DB Write
    color: "#dc2626"
  - id: shared-lib
    label: Shared Lib
    color: "#94a3b8"
    dashed: true
  - id: replaces
    label: Replaces
    color: "#d97706"
  - id: deprecates
    label: Deprecates
    color: "#cbd5e1"
    dashed: true
  - id: consumes
    label: Consumes
    color: "#0891b2"
  - id: publishes
    label: Publishes
    color: "#0891b2"
    dashed: true
```

- [ ] **Step 2: Add viz.config.yml to .gitignore**

Append to `.gitignore`:

```
# Buyer-local config — copy viz.config.example.yml to create this
viz.config.yml
```

- [ ] **Step 3: Create local viz.config.yml for development**

```bash
cp viz.config.example.yml viz.config.yml
```

Confirm the file exists and is not staged (gitignored):

```bash
git status viz.config.yml
```

Expected: `viz.config.yml` does not appear in git status output.

- [ ] **Step 4: Commit**

```bash
git add viz.config.example.yml .gitignore
git commit -m "feat: add viz.config.example.yml and gitignore buyer config"
```

---

## Task 2: Write src/viz-plugin.ts

**Files:**
- Create: `src/viz-plugin.ts`

This is the core of Issues #1 and #2. The plugin reads `viz.config.yml`, validates it, auto-assigns palette colors, and serves two virtual modules.

- [ ] **Step 1: Create src/viz-plugin.ts**

```typescript
import type { Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const VIRTUAL_CONFIG = "virtual:viz-config";
const VIRTUAL_DATA = "virtual:viz-data";
const RESOLVED_CONFIG = "\0virtual:viz-config";
const RESOLVED_DATA = "\0virtual:viz-data";

const PALETTE = [
  { bg: "#eff6ff", border: "#2563eb", text: "#1d4ed8", pill: "#dbeafe" },
  { bg: "#f5f3ff", border: "#7c3aed", text: "#6d28d9", pill: "#ede9fe" },
  { bg: "#ecfeff", border: "#0891b2", text: "#0e7490", pill: "#cffafe" },
  { bg: "#fdf2f8", border: "#db2777", text: "#be185d", pill: "#fce7f3" },
  { bg: "#f0fdf4", border: "#16a34a", text: "#15803d", pill: "#dcfce7" },
  { bg: "#fff7ed", border: "#ea580c", text: "#c2410c", pill: "#fed7aa" },
  { bg: "#fef9c3", border: "#ca8a04", text: "#854d0e", pill: "#fef08a" },
  { bg: "#fce7f3", border: "#9d174d", text: "#831843", pill: "#fbcfe8" },
  { bg: "#dcfce7", border: "#15803d", text: "#14532d", pill: "#bbf7d0" },
  { bg: "#e0f2fe", border: "#0369a1", text: "#075985", pill: "#bae6fd" },
  { bg: "#fef3c7", border: "#d97706", text: "#92400e", pill: "#fde68a" },
  { bg: "#f3e8ff", border: "#7e22ce", text: "#6b21a8", pill: "#e9d5ff" },
];

interface AreaConfig {
  id: string;
  label: string;
  color?: { bg: string; border: string; text: string; pill: string };
}

interface KindConfig {
  id: string;
  label: string;
  icon?: string;
}

interface EdgeKindConfig {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
  animated?: boolean;
}

interface VizConfig {
  dataDir: string;
  areas: AreaConfig[];
  kinds: KindConfig[];
  statuses: string[];
  edgeKinds: EdgeKindConfig[];
}

function readConfig(root: string): VizConfig {
  const configPath = path.resolve(root, "viz.config.yml");
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `viz.config.yml not found — copy viz.config.example.yml and customise it.\nExpected at: ${configPath}`
    );
  }
  const config = yaml.load(fs.readFileSync(configPath, "utf-8")) as VizConfig;
  if (!config.areas?.length)
    throw new Error("viz.config.yml: 'areas' must have at least one entry.");
  if (!config.kinds?.length)
    throw new Error("viz.config.yml: 'kinds' must have at least one entry.");
  if (!config.statuses?.length)
    throw new Error("viz.config.yml: 'statuses' must have at least one entry.");
  if (!config.edgeKinds?.length)
    throw new Error(
      "viz.config.yml: 'edgeKinds' must have at least one entry."
    );
  return config;
}

function buildConfigModule(config: VizConfig): string {
  const AREAS = config.areas.map((a) => a.id);
  const KINDS = config.kinds.map((k) => k.id);
  const STATUSES = config.statuses;
  const EDGE_KINDS = config.edgeKinds.map((e) => e.id);

  const AREA_COLORS: Record<string, object> = {};
  config.areas.forEach((area, i) => {
    AREA_COLORS[area.id] = area.color ?? PALETTE[i % PALETTE.length];
  });

  const KIND_ICONS: Record<string, string> = {};
  const KIND_LABELS: Record<string, string> = {};
  config.kinds.forEach((kind) => {
    KIND_ICONS[kind.id] = kind.icon ?? "◯";
    KIND_LABELS[kind.id] = kind.label;
  });

  const EDGE_STYLES: Record<string, object> = {};
  config.edgeKinds.forEach((edge) => {
    EDGE_STYLES[edge.id] = {
      stroke: edge.color,
      label: edge.label,
      ...(edge.dashed ? { strokeDasharray: "6 3" } : {}),
      ...(edge.animated ? { animated: true } : {}),
    };
  });

  return [
    `export const AREAS = ${JSON.stringify(AREAS)};`,
    `export const KINDS = ${JSON.stringify(KINDS)};`,
    `export const STATUSES = ${JSON.stringify(STATUSES)};`,
    `export const EDGE_KINDS = ${JSON.stringify(EDGE_KINDS)};`,
    `export const AREA_COLORS = ${JSON.stringify(AREA_COLORS)};`,
    `export const KIND_ICONS = ${JSON.stringify(KIND_ICONS)};`,
    `export const KIND_LABELS = ${JSON.stringify(KIND_LABELS)};`,
    `export const EDGE_STYLES = ${JSON.stringify(EDGE_STYLES)};`,
  ].join("\n");
}

function buildDataModule(config: VizConfig, root: string): string {
  const dataDir = path.resolve(root, config.dataDir);
  if (!fs.existsSync(dataDir)) {
    throw new Error(
      `viz.config.yml: dataDir '${config.dataDir}' does not exist.\nResolved to: ${dataDir}`
    );
  }

  const servicesDir = path.join(dataDir, "services");
  const serviceFiles: Record<string, unknown> = {};
  if (fs.existsSync(servicesDir)) {
    for (const file of fs.readdirSync(servicesDir)) {
      if (!file.endsWith(".yml")) continue;
      serviceFiles[file] = yaml.load(
        fs.readFileSync(path.join(servicesDir, file), "utf-8")
      );
    }
  }

  const externalsPath = path.join(dataDir, "externals.yml");
  let externalsData: unknown[] = [];
  if (fs.existsSync(externalsPath)) {
    const parsed = yaml.load(fs.readFileSync(externalsPath, "utf-8"));
    externalsData = Array.isArray(parsed) ? parsed : [];
  }

  return [
    `export const serviceFiles = ${JSON.stringify(serviceFiles)};`,
    `export const externalsData = ${JSON.stringify(externalsData)};`,
  ].join("\n");
}

export function vizPlugin(): Plugin {
  let root = process.cwd();

  return {
    name: "viz-plugin",

    configResolved(config) {
      root = config.root;
    },

    buildStart() {
      readConfig(root);
    },

    resolveId(id) {
      if (id === VIRTUAL_CONFIG) return RESOLVED_CONFIG;
      if (id === VIRTUAL_DATA) return RESOLVED_DATA;
    },

    load(id) {
      if (id === RESOLVED_CONFIG) {
        const config = readConfig(root);
        return buildConfigModule(config);
      }
      if (id === RESOLVED_DATA) {
        const config = readConfig(root);
        return buildDataModule(config, root);
      }
    },

    configureServer(server) {
      const configPath = path.resolve(root, "viz.config.yml");
      server.watcher.add(configPath);

      try {
        const config = readConfig(root);
        const dataDir = path.resolve(root, config.dataDir);
        server.watcher.add(path.join(dataDir, "services"));
        server.watcher.add(path.join(dataDir, "externals.yml"));
      } catch {
        // config may not be valid yet; watcher added when it is
      }

      server.watcher.on("change", (changedPath) => {
        if (
          changedPath === configPath ||
          changedPath.endsWith(".yml")
        ) {
          const configMod = server.moduleGraph.getModuleById(RESOLVED_CONFIG);
          const dataMod = server.moduleGraph.getModuleById(RESOLVED_DATA);
          if (configMod) server.moduleGraph.invalidateModule(configMod);
          if (dataMod) server.moduleGraph.invalidateModule(dataMod);
          server.ws.send({ type: "full-reload" });
        }
      });
    },
  };
}
```

- [ ] **Step 2: Check TypeScript compiles (will fail — plugin not wired yet, that's OK)**

```bash
pnpm build 2>&1 | head -30
```

Expected: build fails because `virtual:viz-config` and `virtual:viz-data` are not yet resolved. This is expected at this step. Move on.

- [ ] **Step 3: Commit**

```bash
git add src/viz-plugin.ts
git commit -m "feat: add viz-plugin serving virtual:viz-config and virtual:viz-data"
```

---

## Task 3: Add TypeScript declarations for virtual modules

**Files:**
- Create: `src/virtual.d.ts`

TypeScript needs to know the shape of the virtual modules. The `tsconfig.app.json` already includes everything under `src/`, so this file will be picked up automatically.

- [ ] **Step 1: Create src/virtual.d.ts**

```typescript
declare module "virtual:viz-config" {
  export type AreaStyle = {
    bg: string;
    border: string;
    text: string;
    pill: string;
  };
  export type EdgeStyle = {
    stroke: string;
    strokeDasharray?: string;
    animated?: boolean;
    label: string;
  };
  export const AREAS: readonly string[];
  export const KINDS: readonly string[];
  export const STATUSES: readonly string[];
  export const EDGE_KINDS: readonly string[];
  export const AREA_COLORS: Record<string, AreaStyle>;
  export const KIND_ICONS: Record<string, string>;
  export const KIND_LABELS: Record<string, string>;
  export const EDGE_STYLES: Record<string, EdgeStyle>;
}

declare module "virtual:viz-data" {
  export const serviceFiles: Record<string, unknown>;
  export const externalsData: unknown[];
}
```

> **Note:** `AreaStyle` and `EdgeStyle` are declared here rather than imported from `styles.ts` to avoid a circular dependency (styles.ts will import from `virtual:viz-config`). The existing `AreaStyle`/`EdgeStyle` type exports in `styles.ts` will be removed in Task 6 since they'll be re-exported from here.

- [ ] **Step 2: Commit**

```bash
git add src/virtual.d.ts
git commit -m "feat: add TypeScript declarations for virtual viz modules"
```

---

## Task 4: Wire the plugin into vite.config.ts

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Update vite.config.ts**

Replace the full file contents with:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { vizPlugin } from "./src/viz-plugin";

export default defineConfig({
  plugins: [react(), vizPlugin()],
  base: "./",
  resolve: {
    alias: {
      elkjs: path.resolve(__dirname, "node_modules/elkjs/lib/elk.bundled.js"),
    },
  },
  server: {
    fs: {
      allow: [".."],
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
```

- [ ] **Step 2: Verify the plugin loads without crashing**

```bash
pnpm dev &
sleep 3
kill %1 2>/dev/null
```

Expected: Vite starts without throwing an error about missing `viz.config.yml` (the file exists because you created it in Task 1 Step 3).

If you see `viz.config.yml not found`, check that `viz.config.yml` exists at the repo root (not inside `src/`).

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat: register vizPlugin in vite.config.ts"
```

---

## Task 5: Update src/schema.ts to use virtual:viz-config

**Files:**
- Modify: `src/schema.ts`

`AREAS`, `KINDS`, `STATUSES`, `EDGE_KINDS` are removed from this file and imported from `virtual:viz-config`. Types narrow to `string`.

- [ ] **Step 1: Replace src/schema.ts**

```typescript
import { z } from "zod";
import {
  AREAS,
  KINDS,
  STATUSES,
  EDGE_KINDS,
} from "virtual:viz-config";

export { AREAS, KINDS, STATUSES, EDGE_KINDS };

export const DependencySchema = z.object({
  target: z.string(),
  via: z.string().optional(),
  kind: z.enum(EDGE_KINDS as [string, ...string[]]),
});

export const ServiceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id must be kebab-case"),
  name: z.string(),
  area: z.enum(AREAS as [string, ...string[]]),
  kind: z.enum(KINDS as [string, ...string[]]),
  status: z.enum(STATUSES as [string, ...string[]]).optional(),
  maintainerTeam: z.string().optional(),
  owner: z.string().optional(),
  developedBy: z.array(z.string()).default([]),
  maintainedBy: z.array(z.string()).default([]),
  tech: z.array(z.string()).default([]),
  runtime: z.string().optional(),
  docFile: z.string().optional(),
  github: z.string().optional(),
  summary: z.string().optional(),
  depends_on: z.array(DependencySchema).default([]),
  related: z.array(z.string()).default([]),
  external: z.literal(true).optional(),
});

export const ExternalSchema = ServiceSchema.extend({
  external: z.literal(true),
});

export type Service = z.infer<typeof ServiceSchema>;
export type Dependency = z.infer<typeof DependencySchema>;
export type Area = string;
export type Kind = string;
export type EdgeKind = string;
```

> **Why `ExternalSchema` changes:** The original had `kind: z.literal("external")` and `area: z.literal("External")` hardcoded. With configurable values these literals are removed — the base enum validation on `ServiceSchema` still enforces that area/kind are valid config entries. The `external: true` literal is kept to distinguish external services.

- [ ] **Step 2: Check TypeScript compiles**

```bash
pnpm build 2>&1 | grep -E "error|warning" | head -20
```

Expected: errors only about `virtual:viz-config` or `virtual:viz-data` imports in other files not yet updated (styles.ts and loader.ts). No errors in schema.ts itself.

- [ ] **Step 3: Commit**

```bash
git add src/schema.ts
git commit -m "feat: schema.ts reads AREAS/KINDS/STATUSES/EDGE_KINDS from virtual:viz-config"
```

---

## Task 6: Update src/graph/styles.ts to use virtual:viz-config

**Files:**
- Modify: `src/graph/styles.ts`

The hardcoded color/icon/style objects are removed. `styles.ts` becomes a thin re-export layer plus the `STATUS_STYLES` fallback (status styles are not yet configurable — they fall back gracefully for unknown status names).

- [ ] **Step 1: Replace src/graph/styles.ts**

```typescript
export type {
  AreaStyle,
  EdgeStyle,
} from "virtual:viz-config";

export {
  AREA_COLORS,
  KIND_ICONS,
  KIND_LABELS,
  EDGE_STYLES,
} from "virtual:viz-config";

export type StatusStyle = { bg: string; color: string };

export const STATUS_STYLES: Record<string, StatusStyle> = {
  "In Progress":        { bg: "#dcfce7", color: "#15803d" },
  Planning:             { bg: "#fef9c3", color: "#a16207" },
  "On Hold":            { bg: "#ffedd5", color: "#c2410c" },
  "Done / Maintenance": { bg: "#f3f4f6", color: "#4b5563" },
  Done:                 { bg: "#f3f4f6", color: "#4b5563" },
  Deprecated:           { bg: "#f1f5f9", color: "#94a3b8" },
  "Being Migrated":     { bg: "#fef3c7", color: "#d97706" },
};

export const DEFAULT_STATUS_STYLE: StatusStyle = {
  bg: "#f3f4f6",
  color: "#6b7280",
};
```

> **`DEFAULT_STATUS_STYLE`** is exported so components can fall back gracefully when a buyer defines a status name not in the built-in list. Check the callers of `STATUS_STYLES` in the next step.

- [ ] **Step 2: Verify STATUS_STYLES callers are already safe**

Both existing callers already use the `?? null` pattern, so no changes are needed:

- `src/graph/ServiceNode.tsx:8` — `STATUS_STYLES[data.status] ?? null`
- `src/ui/DetailDrawer.tsx:53` — `STATUS_STYLES[service.status] ?? null`

Run the grep to confirm no other callers exist:

```bash
grep -rn "STATUS_STYLES" src/ --include="*.tsx" --include="*.ts"
```

Expected: only the two lines above. If new callers appear, ensure they use `?? DEFAULT_STATUS_STYLE` or `?? null`.

- [ ] **Step 3: Check TypeScript compiles**

```bash
pnpm build 2>&1 | grep -E "error" | head -20
```

Expected: errors only about `virtual:viz-data` in loader.ts (not yet updated). No errors in styles.ts or its callers.

- [ ] **Step 4: Commit**

```bash
git add src/graph/styles.ts src/
git commit -m "feat: styles.ts re-exports style maps from virtual:viz-config"
```

---

## Task 7: Update src/loader.ts to use virtual:viz-data

**Files:**
- Modify: `src/loader.ts`

Remove `import.meta.glob` and `js-yaml` import. YAML parsing moves to the plugin; loader just validates with Zod.

- [ ] **Step 1: Replace src/loader.ts**

```typescript
import { z } from "zod";
import { ServiceSchema, type Service } from "./schema";
import { serviceFiles, externalsData } from "virtual:viz-data";

const ExternalsFile = z.array(ServiceSchema);

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: Service["depends_on"][number]["kind"];
  via?: string;
};

export type Graph = {
  nodes: Service[];
  edges: GraphEdge[];
  errors: string[];
};

export function loadGraph(): Graph {
  const errors: string[] = [];
  const nodes: Service[] = [];

  for (const [filename, raw] of Object.entries(serviceFiles)) {
    try {
      nodes.push(ServiceSchema.parse(raw));
    } catch (err) {
      errors.push(
        `${filename}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  try {
    nodes.push(...ExternalsFile.parse(externalsData));
  } catch (err) {
    errors.push(
      `externals.yml: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const ids = new Set(nodes.map((n) => n.id));
  const edges: GraphEdge[] = [];

  for (const node of nodes) {
    for (const dep of node.depends_on) {
      if (!ids.has(dep.target)) {
        errors.push(
          `${node.id}: depends_on unknown target "${dep.target}"`
        );
        continue;
      }
      edges.push({
        id: `${node.id}->${dep.target}:${dep.kind}`,
        source: node.id,
        target: dep.target,
        kind: dep.kind,
        via: dep.via,
      });
    }
  }

  return { nodes, edges, errors };
}
```

- [ ] **Step 2: Run full build — expect it to pass**

```bash
pnpm build
```

Expected: exit code 0, no TypeScript errors. The dist/ directory is updated.

If you see type errors, they will be about either:
- `STATUS_STYLES` usages not yet updated (go back to Task 6 Step 2)
- A `noUnusedLocals` violation — remove the unused import

- [ ] **Step 3: Start dev server and verify in browser**

```bash
pnpm dev
```

Open `http://localhost:5173`. Verify:
- [ ] The graph renders with all DTP services
- [ ] Area colours match the original (WLCAF is blue, CAF Dispatcher is purple, etc.)
- [ ] Filter sidebar shows all areas and kinds
- [ ] Clicking a node opens the detail drawer with correct edge labels
- [ ] The legend shows correct icons and edge styles

- [ ] **Step 4: Commit**

```bash
git add src/loader.ts
git commit -m "feat: loader.ts reads data from virtual:viz-data, removes import.meta.glob"
```

---

## Task 8: Verify configurable data directory end-to-end

This task confirms Issue #2 acceptance criteria: a buyer can point `dataDir` at a different location.

- [ ] **Step 1: Create a test data directory**

```bash
mkdir -p /tmp/test-services/services
cp data/services/aviv-android.yml /tmp/test-services/services/
cat > /tmp/test-services/externals.yml << 'EOF'
- id: test-external
  name: Test External
  area: External
  kind: external
  external: true
  depends_on: []
EOF
```

- [ ] **Step 2: Point viz.config.yml at the test directory**

Edit `viz.config.yml` (local, not committed):
```yaml
dataDir: /tmp/test-services
```

- [ ] **Step 3: Start dev server and confirm only the test service loads**

```bash
pnpm dev
```

Open `http://localhost:5173`. Verify:
- [ ] Only `aviv-android` and `test-external` appear in the graph
- [ ] No errors about missing services

- [ ] **Step 4: Restore viz.config.yml to use ./data**

Edit `viz.config.yml`:
```yaml
dataDir: ./data
```

- [ ] **Step 5: Confirm dev server reloads correctly**

Restart dev server. Verify all DTP services appear again.

No commit needed for this task — it's verification only.

---

## Task 9: Write the LICENSES file

**Files:**
- Create: `LICENSES`

- [ ] **Step 1: Create LICENSES at the repo root**

```
LICENSES
================================================================================

This product bundles the following open-source software packages.

================================================================================
react, react-dom
Version: 19.x
License: MIT License
Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

================================================================================
reactflow
Version: 11.x
License: MIT License
Copyright (c) 2019-2023 webkid GmbH

[Same MIT license text as above]

================================================================================
js-yaml
Version: 4.x
License: MIT License
Copyright (C) 2011-2015 by Vitaly Puzrin

[Same MIT license text as above]

================================================================================
zod
Version: 4.x
License: MIT License
Copyright (c) 2025 Colin McDonnell

[Same MIT license text as above]

================================================================================
elkjs
Version: 0.11.x
License: Eclipse Public License - v 2.0
Copyright (c) 2017-present EclipseSource and others

NOTICE: elkjs is licensed under the Eclipse Public License 2.0 (EPL-2.0).

What this means for you:
- You may use this product (which bundles elkjs) without restriction.
- If you MODIFY the elkjs source code itself (not your own service map data
  or configuration), those modifications must be made available under EPL-2.0.
- Using elkjs unmodified, as this product does, imposes NO source-sharing
  obligation on your own code or data.

The full text of the Eclipse Public License 2.0 is available at:
https://www.eclipse.org/legal/epl-2.0/

================================================================================
```

> **Note on the MIT text repetition:** Replace the `[Same MIT license text as above]` placeholders with the actual MIT license paragraph. It is identical for all four MIT packages; copy-paste it under each header.

- [ ] **Step 2: Commit**

```bash
git add LICENSES
git commit -m "docs: add LICENSES file covering all runtime dependencies (MIT + EPL-2.0)"
```

---

## Task 10: Write the buyer-facing README.md

**Files:**
- Modify: `README.md` (replaces Vite boilerplate)

- [ ] **Step 1: Replace README.md**

```markdown
# Service Map

An interactive visualization of inter-service dependencies. Clone, configure, and deploy — no source code changes required.

---

## Prerequisites

- **Node.js** ≥ 20 ([nodejs.org](https://nodejs.org))
- **pnpm** ≥ 9 — install with `npm install -g pnpm`

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

Open `http://localhost:5173`. You'll see the example services. Now edit `viz.config.yml` and your YAML files to describe your own architecture.

---

## Configuration reference

All configuration lives in `viz.config.yml` at the repo root. This file is gitignored — only `viz.config.example.yml` is tracked, so your team's config stays private.

### dataDir

```yaml
dataDir: ./data
```

Path (relative to repo root) to the directory containing your service YAML files. The directory must contain:
- `services/` — one `.yml` file per service
- `externals.yml` — (optional) list of external systems

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
    icon: "λ"    # single character shown on the node
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

Each service's `status` field must match one of these strings exactly.

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
id: payments-api          # required, kebab-case, unique
name: Payments API        # display name
area: Backend             # must match an area id in viz.config.yml
kind: backend             # must match a kind id in viz.config.yml
status: In Progress       # optional, must match a status in viz.config.yml
owner: Platform Team      # optional, free text
tech: [Go, PostgreSQL]    # optional, list of technologies
summary: >                # optional, shown in the detail drawer
  Handles payment processing and subscription billing.
github: payments-api      # optional, GitHub repo name
depends_on:
  - target: auth-service        # must be the id of another service
    kind: sync-http             # must match an edgeKind id
    via: REST / JWT             # optional, describes the interface
  - target: billing-events-sns
    kind: async-event
related:
  - billing-dashboard           # ids of related services (shown in drawer)
```

The file is picked up automatically on the next dev server reload or build.

---

## Adding external systems

Edit `<dataDir>/externals.yml`. Each entry follows the same schema as a service, with `kind: external`, `area: <your external area id>`, and `external: true`:

```yaml
- id: stripe
  name: Stripe
  area: External        # must match an area id in viz.config.yml
  kind: external        # must match a kind id in viz.config.yml
  external: true
  summary: Payment gateway for card processing.
  depends_on: []
```

---

## Deploying

```bash
pnpm build
```

This produces a `dist/` directory of static files. Host it anywhere that serves static HTML:

| Platform | How |
|----------|-----|
| **Netlify** | Drag `dist/` into the Netlify dashboard, or connect the repo and set build command `pnpm build`, publish dir `dist` |
| **Vercel** | Import the repo; set framework to "Vite", output dir to `dist` |
| **GitHub Pages** | Push `dist/` contents to the `gh-pages` branch, or use the included GitHub Actions workflow |
| **S3 / CloudFront** | Upload `dist/` to an S3 bucket with static hosting enabled |

The build uses relative paths (`base: "./"`) so it works at any subdirectory.

---

## Updating

Pull new versions from the private upstream:

```bash
git pull origin main
pnpm install          # pick up any new dependencies
pnpm build            # verify the build still passes
```

Your `viz.config.yml` and data files are unaffected by upstream changes.

---

## License

See [LICENSES](./LICENSES) for all dependency licences.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: replace Vite boilerplate README with buyer-facing setup guide"
```

---

## Task 11: Final verification and close issues

- [ ] **Step 1: Full clean build**

```bash
rm -rf dist && pnpm build
```

Expected: exit code 0. `dist/` created.

- [ ] **Step 2: Lint**

```bash
pnpm lint
```

Expected: no errors. Fix any `noUnusedLocals` violations if they appear (most likely from old imports in files touched by earlier tasks).

- [ ] **Step 3: Preview the production build**

```bash
pnpm preview
```

Open `http://localhost:4173`. Run the same visual checklist as Task 7 Step 3:
- [ ] Graph renders all DTP services
- [ ] Area colours correct
- [ ] Filter sidebar works
- [ ] Node detail drawer opens with correct edge labels
- [ ] Legend shows correct icons

- [ ] **Step 4: Test error path — rename viz.config.yml temporarily**

```bash
mv viz.config.yml viz.config.yml.bak
pnpm build 2>&1 | grep "viz.config.yml"
mv viz.config.yml.bak viz.config.yml
```

Expected: build fails with the message `viz.config.yml not found — copy viz.config.example.yml and customise it.`

- [ ] **Step 5: Close GitHub issues**

```bash
gh issue close 1 --comment "Implemented: AREAS, KINDS, STATUSES, EDGE_KINDS now driven by viz.config.yml via virtual:viz-config."
gh issue close 2 --comment "Implemented: dataDir in viz.config.yml configures the data directory; import.meta.glob removed in favour of virtual:viz-data."
gh issue close 3 --comment "Implemented: LICENSES file added at repo root covering react, react-dom, reactflow, js-yaml, zod (MIT) and elkjs (EPL-2.0)."
gh issue close 4 --comment "Implemented: README.md replaced with buyer-facing setup guide covering prerequisites, quick start, config reference, adding services, deploying, and updating."
```

- [ ] **Step 6: Final commit if any lint fixes were made**

```bash
git add -p   # review and stage only relevant changes
git commit -m "chore: fix lint warnings after productization refactor"
```
