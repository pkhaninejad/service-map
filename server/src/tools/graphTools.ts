import type { Service } from "../schema";
import type { GraphEdge } from "../graph/buildGraph";

// ── listServices ─────────────────────────────────────────────────────────────

type ListFilter = {
  area?: string;
  kind?: string;
  status?: string;
  q?: string;
};

type ServiceSummary = Pick<
  Service,
  "id" | "name" | "area" | "kind" | "status" | "github" | "summary"
>;

export function listServices(nodes: Service[], filter: ListFilter): ServiceSummary[] {
  return nodes
    .filter((n) => {
      if (filter.area && n.area !== filter.area) return false;
      if (filter.kind && n.kind !== filter.kind) return false;
      if (filter.status && n.status !== filter.status) return false;
      if (filter.q) {
        const q = filter.q.toLowerCase();
        if (!n.id.includes(q) && !n.name.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .map(({ id, name, area, kind, status, github, summary }) => ({
      id,
      name,
      area,
      kind,
      status,
      github,
      summary,
    }));
}

// ── getService ────────────────────────────────────────────────────────────────

type GetServiceResult =
  | {
      service: Service;
      depends_on: (GraphEdge & { targetHasRepo: boolean })[];
      dependents: GraphEdge[];
    }
  | { error: string };

export function getService(
  nodes: Service[],
  edges: GraphEdge[],
  id: string,
): GetServiceResult {
  const service = nodes.find((n) => n.id === id);
  if (!service) {
    const sample = nodes
      .slice(0, 5)
      .map((n) => n.id)
      .join(", ");
    return { error: `Unknown service id "${id}". Some valid ids: ${sample}` };
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const depends_on = edges
    .filter((e) => e.source === id)
    .map((e) => ({
      ...e,
      targetHasRepo: !!nodeById.get(e.target)?.github,
    }));

  const dependents = edges.filter((e) => e.target === id);

  return { service, depends_on, dependents };
}

// ── traceDependencies ─────────────────────────────────────────────────────────

type TraceResult =
  | { nodes: Service[]; edges: GraphEdge[] }
  | { error: string };

export function traceDependencies(
  nodes: Service[],
  edges: GraphEdge[],
  id: string,
  direction: "downstream" | "upstream" | "both",
  depth: number,
): TraceResult {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  if (!nodeMap.has(id)) {
    return { error: `Unknown service id "${id}"` };
  }

  const visited = new Set<string>();
  const collectedEdges = new Set<GraphEdge>();
  const queue: Array<{ id: string; d: number }> = [{ id, d: 0 }];

  while (queue.length > 0) {
    const { id: current, d } = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    if (d >= depth) continue;

    if (direction === "downstream" || direction === "both") {
      for (const e of edges) {
        if (e.source === current && !visited.has(e.target)) {
          collectedEdges.add(e);
          queue.push({ id: e.target, d: d + 1 });
        }
      }
    }

    if (direction === "upstream" || direction === "both") {
      for (const e of edges) {
        if (e.target === current && !visited.has(e.source)) {
          collectedEdges.add(e);
          queue.push({ id: e.source, d: d + 1 });
        }
      }
    }
  }

  return {
    nodes: [...visited].map((nid) => nodeMap.get(nid)!),
    edges: [...collectedEdges],
  };
}
