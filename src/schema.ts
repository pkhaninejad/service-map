import { z } from "zod";
import { AREAS, KINDS, STATUSES, EDGE_KINDS } from "virtual:viz-config";

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
