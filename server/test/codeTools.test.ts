import { describe, expect, test, vi } from "vitest";
import { buildGraph } from "../src/graph/buildGraph";
import { searchCode, readFile, listRecentCommits } from "../src/tools/codeTools";
import type { GitHubClient, CodeSearchResult } from "../src/github";

// ── Minimal test graph ────────────────────────────────────────────────────────

const { nodes } = buildGraph(
  [
    "id: svc-a\nname: Service A\narea: Mobile\nkind: bff\ngithub: repo-a\ndepends_on: []",
    "id: svc-b\nname: Service B\narea: Mobile\nkind: backend\ndepends_on: []",
  ].map((raw, i) => ({ path: `s${i}.yml`, raw })),
  [],
);

// ── Mock GitHubClient ─────────────────────────────────────────────────────────

function makeClient(overrides: Partial<GitHubClient> = {}): GitHubClient {
  return {
    searchCode: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue("file contents"),
    listCommits: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

// ── searchCode ────────────────────────────────────────────────────────────────

describe("searchCode", () => {
  test("calls GitHub search scoped to repo when serviceId given", async () => {
    const client = makeClient({
      searchCode: vi.fn().mockResolvedValue([
        { path: "src/foo.ts", repo: "my-org/repo-a", snippet: "const x = 1" },
      ]),
    });
    const result = await searchCode(nodes, client, "my-org", {
      query: "createClassified",
      serviceId: "svc-a",
    });
    expect(client.searchCode).toHaveBeenCalledWith("createClassified", "my-org/repo-a");
    expect(result).toHaveLength(1);
    const hits = result as CodeSearchResult[];
    expect(hits[0].repo).toBe("my-org/repo-a");
  });

  test("searches all repos with a github field when no serviceId given", async () => {
    const client = makeClient();
    await searchCode(nodes, client, "my-org", { query: "foo" });
    // svc-a has github, svc-b does not → only one call
    expect(client.searchCode).toHaveBeenCalledTimes(1);
    expect(client.searchCode).toHaveBeenCalledWith("foo", "my-org/repo-a");
  });

  test("returns error when serviceId is unknown", async () => {
    const client = makeClient();
    const result = await searchCode(nodes, client, "my-org", {
      query: "foo",
      serviceId: "ghost",
    });
    expect(result).toHaveProperty("error");
  });

  test("returns error when service has no github field", async () => {
    const client = makeClient();
    const result = await searchCode(nodes, client, "my-org", {
      query: "foo",
      serviceId: "svc-b",
    });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("no repo mapped");
  });
});

// ── readFile ──────────────────────────────────────────────────────────────────

describe("readFile", () => {
  test("returns file contents for a known service with a repo", async () => {
    const client = makeClient({
      readFile: vi.fn().mockResolvedValue("export const x = 1;"),
    });
    const result = await readFile(nodes, client, "my-org", {
      serviceId: "svc-a",
      path: "src/index.ts",
    });
    expect(client.readFile).toHaveBeenCalledWith("my-org/repo-a", "src/index.ts", undefined);
    expect(result).toMatchObject({ content: "export const x = 1;" });
  });

  test("returns error when service has no github field", async () => {
    const client = makeClient();
    const result = await readFile(nodes, client, "my-org", {
      serviceId: "svc-b",
      path: "src/index.ts",
    });
    expect(result).toHaveProperty("error");
  });

  test("maps 404 from GitHub client to structured error", async () => {
    const client = makeClient({
      readFile: vi.fn().mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 })),
    });
    const result = await readFile(nodes, client, "my-org", {
      serviceId: "svc-a",
      path: "no/such/file.ts",
    });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("404");
  });

  test("maps 403 rate-limit to structured error with hint", async () => {
    const err = Object.assign(new Error("rate limit"), {
      status: 403,
      response: { headers: { "x-ratelimit-reset": "9999999999" } },
    });
    const client = makeClient({ readFile: vi.fn().mockRejectedValue(err) });
    const result = await readFile(nodes, client, "my-org", {
      serviceId: "svc-a",
      path: "src/index.ts",
    });
    expect((result as { error: string }).error).toContain("rate limit");
  });

  test("maps 401 to structured auth error", async () => {
    const client = makeClient({
      readFile: vi.fn().mockRejectedValue(Object.assign(new Error("Bad credentials"), { status: 401 })),
    });
    const result = await readFile(nodes, client, "my-org", {
      serviceId: "svc-a",
      path: "src/index.ts",
    });
    expect((result as { error: string }).error).toContain("401");
  });
});

// ── listRecentCommits ─────────────────────────────────────────────────────────

describe("listRecentCommits", () => {
  const fakeCommits = [
    { sha: "abc123", message: "fix: something", author: "dev", date: "2026-01-01", url: "https://github.com/abc123" },
  ];

  test("returns commits for a service with a repo", async () => {
    const client = makeClient({ listCommits: vi.fn().mockResolvedValue(fakeCommits) });
    const result = await listRecentCommits(nodes, client, "my-org", { serviceId: "svc-a" });
    expect(client.listCommits).toHaveBeenCalledWith("my-org/repo-a", undefined, 20);
    expect(result).toEqual(fakeCommits);
  });

  test("passes path and limit through", async () => {
    const client = makeClient({ listCommits: vi.fn().mockResolvedValue([]) });
    await listRecentCommits(nodes, client, "my-org", {
      serviceId: "svc-a",
      path: "src/handler.ts",
      limit: 5,
    });
    expect(client.listCommits).toHaveBeenCalledWith("my-org/repo-a", "src/handler.ts", 5);
  });

  test("returns error when service has no github field", async () => {
    const client = makeClient();
    const result = await listRecentCommits(nodes, client, "my-org", { serviceId: "svc-b" });
    expect(result).toHaveProperty("error");
  });
});
