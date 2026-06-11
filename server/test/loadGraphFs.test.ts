import { describe, expect, test } from "vitest";
import path from "node:path";
import { loadGraphFs } from "../src/graph/loadGraphFs";

const dataDir = path.resolve("../data");

describe("loadGraphFs", () => {
  test("loads at least one node from the real data directory", () => {
    const { nodes } = loadGraphFs(dataDir);
    expect(nodes.length).toBeGreaterThan(0);
    // Known service from data/services/
    expect(nodes.some((n) => n.id === "order-service")).toBe(true);
  });

  test("produces no fatal errors on the real data", () => {
    const { errors } = loadGraphFs(dataDir);
    // Unknown-target warnings are expected (external deps not in YAML);
    // schema errors would be a real problem
    const schemaErrors = errors.filter((e) => !e.includes("depends_on unknown"));
    expect(schemaErrors).toEqual([]);
  });

  test("builds edges between known nodes", () => {
    const { edges } = loadGraphFs(dataDir);
    expect(edges.length).toBeGreaterThan(0);
  });
});
