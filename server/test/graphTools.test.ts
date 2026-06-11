import { describe, expect, test } from "vitest";
import { buildGraph } from "../src/graph/buildGraph";
import {
  listServices,
  getService,
  traceDependencies,
} from "../src/tools/graphTools";

// Minimal test graph: alpha → beta → gamma, delta is isolated
const { nodes, edges } = buildGraph(
  [
    "id: alpha\nname: Alpha\narea: Mobile\nkind: bff\ngithub: repo-alpha\ndepends_on:\n  - target: beta\n    via: HTTPS\n    kind: sync-http",
    "id: beta\nname: Beta\narea: Mobile\nkind: backend\ngithub: repo-beta\ndepends_on:\n  - target: gamma\n    kind: sync-http",
    "id: gamma\nname: Gamma\narea: Mobile\nkind: backend\ndepends_on: []",
    "id: delta\nname: Delta\narea: Mobile\nkind: backend\ndepends_on: []",
  ].map((raw, i) => ({ path: `svc${i}.yml`, raw })),
  [],
);

describe("listServices", () => {
  test("returns all nodes when no filter", () => {
    const result = listServices(nodes, {});
    expect(result.map((s) => s.id).sort()).toEqual(["alpha", "beta", "delta", "gamma"]);
  });

  test("filters by kind", () => {
    const result = listServices(nodes, { kind: "bff" });
    expect(result.map((s) => s.id)).toEqual(["alpha"]);
  });

  test("filters by q (case-insensitive name match)", () => {
    const result = listServices(nodes, { q: "bet" });
    expect(result.map((s) => s.id)).toEqual(["beta"]);
  });

  test("q also matches id", () => {
    const result = listServices(nodes, { q: "gamma" });
    expect(result.map((s) => s.id)).toEqual(["gamma"]);
  });
});

describe("getService", () => {
  test("returns the service with resolved depends_on and dependents", () => {
    const result = getService(nodes, edges, "alpha");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.service.id).toBe("alpha");
    expect(result.dependents).toEqual([]);
    expect(result.depends_on.map((d) => d.target)).toEqual(["beta"]);
  });

  test("includes dependents (reverse edges)", () => {
    const result = getService(nodes, edges, "beta");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.dependents.map((d) => d.source)).toEqual(["alpha"]);
    expect(result.depends_on.map((d) => d.target)).toEqual(["gamma"]);
  });

  test("returns error object for unknown id", () => {
    const result = getService(nodes, edges, "ghost");
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("ghost");
  });
});

describe("traceDependencies", () => {
  function assertOk(r: ReturnType<typeof traceDependencies>) {
    expect("error" in r).toBe(false);
    if ("error" in r) throw new Error("unexpected error result");
    return r;
  }

  test("traces downstream from alpha at depth 1", () => {
    const result = assertOk(traceDependencies(nodes, edges, "alpha", "downstream", 1));
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["alpha", "beta"]);
    expect(result.edges).toHaveLength(1);
  });

  test("traces downstream from alpha at depth 2", () => {
    const result = assertOk(traceDependencies(nodes, edges, "alpha", "downstream", 2));
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["alpha", "beta", "gamma"]);
  });

  test("traces upstream from gamma", () => {
    const result = assertOk(traceDependencies(nodes, edges, "gamma", "upstream", 2));
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["alpha", "beta", "gamma"]);
  });

  test("traces both directions from beta", () => {
    const result = assertOk(traceDependencies(nodes, edges, "beta", "both", 2));
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["alpha", "beta", "gamma"]);
  });

  test("does not include isolated nodes", () => {
    const result = assertOk(traceDependencies(nodes, edges, "alpha", "both", 99));
    expect(result.nodes.map((n) => n.id)).not.toContain("delta");
  });

  test("handles cycles without infinite loop", () => {
    const { nodes: cn, edges: ce } = buildGraph(
      [
        "id: x\nname: X\narea: Mobile\nkind: backend\ndepends_on:\n  - target: y\n    kind: sync-http",
        "id: y\nname: Y\narea: Mobile\nkind: backend\ndepends_on:\n  - target: x\n    kind: sync-http",
      ].map((raw, i) => ({ path: `c${i}.yml`, raw })),
      [],
    );
    const result = assertOk(traceDependencies(cn, ce, "x", "downstream", 99));
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["x", "y"]);
  });

  test("returns error object for unknown id", () => {
    const result = traceDependencies(nodes, edges, "ghost", "downstream", 2);
    expect(result).toHaveProperty("error");
  });
});
