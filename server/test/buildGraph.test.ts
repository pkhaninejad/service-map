import { describe, expect, test } from "vitest";
import { buildGraph } from "../src/graph/buildGraph";

const svc = (path: string, raw: string) => ({ path, raw });

describe("buildGraph", () => {
  test("parses valid service files into nodes", () => {
    const { nodes, errors } = buildGraph(
      [
        svc(
          "a.yml",
          `id: alpha\nname: Alpha\narea: Mobile\nkind: bff\ndepends_on: []`,
        ),
      ],
      [],
    );
    expect(errors).toEqual([]);
    expect(nodes.map((n) => n.id)).toEqual(["alpha"]);
  });

  test("builds edges from depends_on between known nodes", () => {
    const { edges, errors } = buildGraph(
      [
        svc(
          "a.yml",
          `id: alpha\nname: Alpha\narea: Mobile\nkind: bff\ndepends_on:\n  - target: beta\n    via: HTTPS\n    kind: sync-http`,
        ),
        svc(
          "b.yml",
          `id: beta\nname: Beta\narea: Mobile\nkind: backend\ndepends_on: []`,
        ),
      ],
      [],
    );
    expect(errors).toEqual([]);
    expect(edges).toEqual([
      {
        id: "alpha->beta:sync-http",
        source: "alpha",
        target: "beta",
        kind: "sync-http",
        via: "HTTPS",
      },
    ]);
  });

  test("collects an error for a depends_on target that is not a known id", () => {
    const { edges, errors } = buildGraph(
      [
        svc(
          "a.yml",
          `id: alpha\nname: Alpha\narea: Mobile\nkind: bff\ndepends_on:\n  - target: ghost\n    kind: sync-http`,
        ),
      ],
      [],
    );
    expect(edges).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("ghost");
  });

  test("loads external nodes from the externals array file", () => {
    const { nodes, edges, errors } = buildGraph(
      [
        svc(
          "a.yml",
          `id: alpha\nname: Alpha\narea: Mobile\nkind: bff\ndepends_on:\n  - target: ext-pay\n    kind: sync-http`,
        ),
      ],
      [
        svc(
          "externals.yml",
          `- id: ext-pay\n  name: External Pay\n  area: External\n  kind: external\n  external: true`,
        ),
      ],
    );
    expect(errors).toEqual([]);
    expect(nodes.map((n) => n.id).sort()).toEqual(["alpha", "ext-pay"]);
    expect(edges.map((e) => e.target)).toEqual(["ext-pay"]);
  });

  test("collects an error for a file that fails schema validation", () => {
    const { nodes, errors } = buildGraph(
      [svc("bad.yml", `id: "Not Kebab Case"\nname: Bad\narea: Mobile\nkind: bff`)],
      [],
    );
    expect(nodes).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("bad.yml");
  });
});
