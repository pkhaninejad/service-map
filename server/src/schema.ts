import { z } from "zod";

/**
 * Server-side service schema.
 *
 * The web app's schema (src/schema.ts) validates `area`/`kind`/`status` against
 * the enums generated from viz.config.yml via a Vite virtual module — which is
 * unavailable in this plain-Node (tsx/vitest) runtime. The server therefore
 * keeps a config-agnostic copy that treats those fields as free strings, so it
 * can read whatever data set the repo is configured with. The probe shape is
 * the part the MCP server actually cares about and is kept identical.
 */

export const DependencySchema = z.object({
  target: z.string(),
  via: z.string().optional(),
  kind: z.string(),
});

export const PROBE_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

/**
 * A single callable operation on a service. Holds only the non-secret *shape*
 * (method + path template). The base URL and credentials live in the server's
 * gitignored probes.local.json, referenced indirectly via `Probe.profile`.
 */
export const ProbeOperationSchema = z.object({
  method: z.enum(PROBE_METHODS),
  path: z.string(),
  description: z.string().optional(),
  // Mutating operations are gated — callers must opt in explicitly.
  write: z.boolean().optional(),
});

/**
 * Marks a service node as live-callable for debugging. `profile` names a
 * connection profile (baseUrl + auth) stored server-side, never committed.
 */
export const ProbeSchema = z.object({
  profile: z.string(),
  operations: z.record(z.string(), ProbeOperationSchema).default({}),
});

export const ServiceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id must be kebab-case"),
  name: z.string(),
  area: z.string(),
  kind: z.string(),
  status: z.string().optional(),
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
  probe: ProbeSchema.optional(),
});

export type Service = z.infer<typeof ServiceSchema>;
export type Dependency = z.infer<typeof DependencySchema>;
export type Probe = z.infer<typeof ProbeSchema>;
export type ProbeOperation = z.infer<typeof ProbeOperationSchema>;
