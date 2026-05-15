# Productization Design — Issues 1–4

**Date:** 2026-05-15  
**Issues:** #1 Generic schema, #2 Configurable data dir, #3 LICENSES, #4 Buyer README  
**Status:** Approved, pending implementation

---

## Overview

Transform the service-map viz tool from a DTP-specific internal tool into a configurable product that any engineering team can clone, configure with a single YAML file, and deploy with zero source-code edits.

Four GitHub issues form a single "productization" release:
- **#1** Move hardcoded schema values (areas, kinds, statuses, edge kinds) into `viz.config.yml`
- **#2** Make the data directory path configurable (remove hardcoded glob paths)
- **#3** Add `LICENSES` file covering all runtime dependencies
- **#4** Write buyer-facing `README.md`

---

## Architecture

### Single source of truth: `viz.config.yml`

A YAML file at the repo root. Buyers edit this file only — no source code changes needed.

```yaml
# viz.config.yml

dataDir: ./data   # path to directory containing service YAML files

areas:
  - id: frontend
    label: Frontend
    # color is optional — auto-assigned from palette if omitted
  - id: backend
    label: Backend
  - id: external
    label: External
    color:
      bg: "#f8fafc"
      border: "#94a3b8"
      text: "#64748b"
      pill: "#f1f5f9"

kinds:
  - id: frontend
    label: Frontend
    icon: "⬡"
  - id: backend
    label: Backend
    icon: "λ"
  - id: external
    label: External
    icon: "○"

statuses:
  - Planning
  - "In Progress"
  - Done
  - Deprecated

edgeKinds:
  - id: sync-http
    label: HTTP
    color: "#1e293b"
  - id: async-event
    label: Async Event
    color: "#7c3aed"
    dashed: true
    animated: true
```

`viz.config.yml` is added to `.gitignore`. The DTP values ship as `viz.config.example.yml` — buyers copy it and customise.

### Vite plugin: `src/viz-plugin.ts`

A single plugin registered in `vite.config.ts` that reads `viz.config.yml` at build time and exposes two virtual modules.

```
vizPlugin()
├── reads viz.config.yml via Node fs at buildStart
├── auto-assigns palette colors to areas without explicit color
├── watches viz.config.yml + dataDir/**/*.yml for HMR
│
├── virtual:viz-config
│   exports: AREAS, KINDS, STATUSES, EDGE_KINDS (readonly string[])
│             AREA_COLORS, KIND_ICONS, KIND_LABELS, EDGE_STYLES
│
└── virtual:viz-data
    reads *.yml from dataDir/services/ via Node fs
    reads dataDir/externals.yml via Node fs
    parses both with js-yaml inside the plugin
    exports: serviceFiles (Record<filename, unknown>)
              externalsData (unknown[])
```

**Auto-color palette** (12 colours, wraps around if more areas than colours):
```
#eff6ff/#2563eb, #f5f3ff/#7c3aed, #ecfeff/#0891b2, #fdf2f8/#db2777,
#f0fdf4/#16a34a, #fff7ed/#ea580c, #fef9c3/#ca8a04, #fce7f3/#9d174d,
#dcfce7/#15803d, #e0f2fe/#0369a1, #fef3c7/#d97706, #f3e8ff/#7e22ce
```

### TypeScript declarations: `src/virtual.d.ts`

```ts
declare module 'virtual:viz-config' {
  import type { AreaStyle, EdgeStyle } from './graph/styles';
  export const AREAS: readonly string[];
  export const KINDS: readonly string[];
  export const STATUSES: readonly string[];
  export const EDGE_KINDS: readonly string[];
  export const AREA_COLORS: Record<string, AreaStyle>;
  export const KIND_ICONS: Record<string, string>;
  export const KIND_LABELS: Record<string, string>;
  export const EDGE_STYLES: Record<string, EdgeStyle>;
}

declare module 'virtual:viz-data' {
  export const serviceFiles: Record<string, unknown>;
  export const externalsData: unknown[];
}
```

---

## File Changes

### `src/schema.ts`
- Remove hardcoded `AREAS`, `KINDS`, `STATUSES`, `EDGE_KINDS` const arrays
- Import them from `virtual:viz-config`
- Build `z.enum(AREAS as [string, ...string[]])` dynamically
- Exported types `Area`, `Kind`, `EdgeKind` become `string` (cost of configurability — no specific union at compile time)
- `ServiceSchema`, `DependencySchema`, `ExternalSchema` logic unchanged

### `src/graph/styles.ts`
- Remove hardcoded `AREA_COLORS`, `KIND_ICONS`, `KIND_LABELS`, `EDGE_STYLES` objects
- Import and re-export them from `virtual:viz-config`
- `AreaStyle` and `EdgeStyle` type definitions stay in this file (referenced by `virtual.d.ts`)

### `src/loader.ts`
- Remove `import.meta.glob` calls entirely
- Remove `import yaml from 'js-yaml'` (parsing moves into the plugin)
- Import `serviceFiles`, `externalsData` from `virtual:viz-data`
- Zod validation logic unchanged — just runs on the pre-parsed objects

### `vite.config.ts`
- Import and register `vizPlugin()` in the `plugins` array
- No other changes

### New files
| File | Purpose |
|------|---------|
| `src/viz-plugin.ts` | Vite plugin — reads config, serves virtual modules |
| `src/virtual.d.ts` | TypeScript declarations for virtual modules |
| `viz.config.example.yml` | DTP values as the shipped example |
| `LICENSES` | All runtime dependency licences |
| `README.md` | Buyer-facing setup documentation (replaces Vite boilerplate) |

### `.gitignore`
- Add `viz.config.yml` (buyers create their own; the example is tracked)

---

## Issue #3 — LICENSES File

File: `LICENSES` at repo root.

Covers all runtime dependencies: `react`, `react-dom`, `reactflow`, `js-yaml`, `zod` (all MIT) and `elkjs` (EPL-2.0).

Includes full license text for each. For `elkjs` includes a plain-language note:

> EPL-2.0 requires that modifications to elkjs itself must be open-sourced under EPL-2.0. Using elkjs unmodified (as this product does) imposes no source-sharing obligation on your own service map code or data.

---

## Issue #4 — Buyer README

File: `README.md` at repo root (replaces Vite boilerplate).

Sections:
1. **What this is** — one-paragraph overview of the tool
2. **Prerequisites** — Node.js ≥ 20, pnpm
3. **Quick start** — 4 commands: clone → `cp viz.config.example.yml viz.config.yml` → edit config → `pnpm dev`
4. **Configuration reference** — every `viz.config.yml` field annotated
5. **Adding services** — full working YAML example with all fields explained
6. **Adding external systems** — `externals.yml` format with example
7. **Deploying** — `pnpm build` → `dist/` → Netlify / Vercel / GitHub Pages / S3
8. **Updating** — `git pull` from the private repo

Target: a developer unfamiliar with the codebase can be live in under 30 minutes following only this README.

---

## Error Handling

- If `viz.config.yml` is missing at build time → plugin throws a clear error: `"viz.config.yml not found — copy viz.config.example.yml and customise it."`
- If `areas`, `kinds`, `statuses`, or `edgeKinds` arrays are empty → plugin throws: `"viz.config.yml: 'areas' must have at least one entry."`
- If `dataDir` does not exist → plugin throws: `"viz.config.yml: dataDir './my-data' does not exist."`
- YAML files in `dataDir` that fail Zod validation → non-fatal, collected as `errors[]` in `loadGraph()` (existing behaviour unchanged)

---

## Testing / Acceptance Criteria

- **Issue #1:** Buyer edits `viz.config.yml` with custom areas/kinds/statuses; app builds and renders correctly with no source edits.
- **Issue #2:** Buyer sets `dataDir: ./custom-data`, places YAML files there; app loads them with no source edits.
- **Issue #3:** `LICENSES` file present, covers all 5 runtime dependencies, EPL-2.0 note included.
- **Issue #4:** Developer unfamiliar with the repo can follow README and reach `pnpm dev` in under 30 minutes.
- Existing DTP data files (`data/services/*.yml`, `data/externals.yml`) still load correctly when `viz.config.example.yml` values are used.

---

## Out of Scope

- GUI for editing `viz.config.yml`
- Multiple data directories
- Per-edge-kind icon customisation
- Any changes to filtering, focus mode, URL state, or layout engine
