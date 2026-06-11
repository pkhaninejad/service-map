import { describe, expect, test, vi } from "vitest";
import { buildGraph } from "../src/graph/buildGraph";
import { listProbes, callService } from "../src/tools/probeTools";
import { ProbeConfigError, type ProbeClient } from "../src/probe";

// ── Minimal test graph ────────────────────────────────────────────────────────

const { nodes } = buildGraph(
  [
    [
      "id: svc-acl",
      "name: ACL",
      "area: ACL",
      "kind: backend",
      "probe:",
      "  profile: acl-classified",
      "  operations:",
      "    get_classified:",
      "      method: GET",
      '      path: "/classifieds/{id}"',
      "      description: read",
      "    delete_classified:",
      "      method: DELETE",
      '      path: "/classifieds/{id}"',
      "      write: true",
    ].join("\n"),
    "id: svc-plain\nname: Plain\narea: Mobile\nkind: backend",
  ].map((raw, i) => ({ path: `s${i}.yml`, raw })),
  [],
);

function makeClient(overrides: Partial<ProbeClient> = {}): ProbeClient {
  return {
    request: vi.fn().mockResolvedValue({ status: 200, ok: true, durationMs: 5, body: { id: "x" } }),
    ...overrides,
  };
}

describe("listProbes", () => {
  test("lists only probeable nodes with operations and profile-configured flag", () => {
    const result = listProbes(nodes, ["acl-classified"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ serviceId: "svc-acl", profile: "acl-classified", profileConfigured: true });
    expect(result[0].operations.map((o) => o.operation).sort()).toEqual(["delete_classified", "get_classified"]);
  });

  test("flags profile as not configured when missing", () => {
    expect(listProbes(nodes, [])[0].profileConfigured).toBe(false);
  });
});

describe("callService", () => {
  test("substitutes path params and delegates to client", async () => {
    const client = makeClient();
    const result = await callService(nodes, client, {
      serviceId: "svc-acl",
      operation: "get_classified",
      params: { id: "abc-123" },
    });
    expect(client.request).toHaveBeenCalledWith({
      profile: "acl-classified",
      method: "GET",
      path: "/classifieds/abc-123",
      query: undefined,
      body: undefined,
    });
    expect(result).toMatchObject({ serviceId: "svc-acl", operation: "get_classified", ok: true });
  });

  test("errors on missing required path param", async () => {
    const client = makeClient();
    const result = await callService(nodes, client, { serviceId: "svc-acl", operation: "get_classified" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("id");
    expect(client.request).not.toHaveBeenCalled();
  });

  test("blocks write operations unless allowWrite is set", async () => {
    const client = makeClient();
    const blocked = await callService(nodes, client, {
      serviceId: "svc-acl",
      operation: "delete_classified",
      params: { id: "abc" },
    });
    expect((blocked as { error: string }).error).toContain("allowWrite");
    expect(client.request).not.toHaveBeenCalled();

    await callService(nodes, client, {
      serviceId: "svc-acl",
      operation: "delete_classified",
      params: { id: "abc" },
      allowWrite: true,
    });
    expect(client.request).toHaveBeenCalledOnce();
  });

  test("errors for a node without a probe block", async () => {
    const result = await callService(nodes, makeClient(), { serviceId: "svc-plain", operation: "x" });
    expect((result as { error: string }).error).toContain("not live-callable");
  });

  test("errors for unknown operation", async () => {
    const result = await callService(nodes, makeClient(), { serviceId: "svc-acl", operation: "nope" });
    expect((result as { error: string }).error).toContain("Unknown operation");
  });

  test("maps a missing-profile config error to a structured error", async () => {
    const client = makeClient({
      request: vi.fn().mockRejectedValue(new ProbeConfigError("No credentials configured for profile \"acl-classified\".")),
    });
    const result = await callService(nodes, client, {
      serviceId: "svc-acl",
      operation: "get_classified",
      params: { id: "1" },
    });
    expect((result as { error: string }).error).toContain("No credentials configured");
  });
});
