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
