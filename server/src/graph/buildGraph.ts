import yaml from "js-yaml";
import { z } from "zod";
import { ServiceSchema, type Service } from "../schema";

const ExternalsFile = z.array(ServiceSchema);

/** A YAML file as a raw string plus the path it came from (for error messages). */
export type RawFile = { path: string; raw: string };

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

/**
 * Pure, framework-agnostic graph builder.
 *
 * `serviceFiles` are parsed each as a single `ServiceSchema`; `externalFiles`
 * are parsed each as an array of `ServiceSchema`. Validation errors are
 * non-fatal: valid nodes are still returned, and problems are collected in
 * `errors`. A `depends_on` target that is not a known node id is also recorded
 * as an error and its edge is dropped.
 */
export function buildGraph(
  serviceFiles: RawFile[],
  externalFiles: RawFile[],
): Graph {
  const errors: string[] = [];
  const nodes: Service[] = [];

  for (const { path, raw } of serviceFiles) {
    try {
      const validated = ServiceSchema.parse(yaml.load(raw));
      nodes.push(validated);
    } catch (err) {
      errors.push(`${path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const { path, raw } of externalFiles) {
    try {
      const validated = ExternalsFile.parse(yaml.load(raw));
      nodes.push(...validated);
    } catch (err) {
      errors.push(`${path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const ids = new Set(nodes.map((n) => n.id));
  const edges: GraphEdge[] = [];

  for (const node of nodes) {
    for (const dep of node.depends_on) {
      if (!ids.has(dep.target)) {
        errors.push(`${node.id}: depends_on unknown target "${dep.target}"`);
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
