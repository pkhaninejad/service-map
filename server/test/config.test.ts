import { describe, expect, test } from "vitest";

describe("loadConfig", () => {
  function withEnv(
    env: Record<string, string | undefined>,
    fn: () => unknown,
  ) {
    const keys = ["GITHUB_TOKEN", "GITHUB_OWNER", "PORT", "DATA_DIR"];
    const saved: Record<string, string | undefined> = {};
    for (const k of keys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      return fn();
    } finally {
      for (const k of keys) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
  }

  async function getLoadConfig() {
    const mod = await import("../src/config.ts?t=" + Date.now());
    return mod.loadConfig;
  }

  const valid = {
    GITHUB_TOKEN: "ghp_test",
    GITHUB_OWNER: "my-org",
  };

  test("returns config when all required env vars are present", async () => {
    const loadConfig = await getLoadConfig();
    const cfg = withEnv(valid, () => loadConfig());
    expect(cfg).toMatchObject({
      githubToken: "ghp_test",
      githubOwner: "my-org",
      port: 47821,
    });
  });

  test("throws when GITHUB_TOKEN is missing", async () => {
    const loadConfig = await getLoadConfig();
    expect(() =>
      withEnv({ ...valid, GITHUB_TOKEN: undefined }, () => loadConfig()),
    ).toThrow("GITHUB_TOKEN");
  });

  test("throws when GITHUB_OWNER is missing", async () => {
    const loadConfig = await getLoadConfig();
    expect(() =>
      withEnv({ ...valid, GITHUB_OWNER: undefined }, () => loadConfig()),
    ).toThrow("GITHUB_OWNER");
  });

  test("accepts custom PORT from env", async () => {
    const loadConfig = await getLoadConfig();
    const cfg = withEnv({ ...valid, PORT: "8080" }, () => loadConfig());
    expect((cfg as { port: number }).port).toBe(8080);
  });

  test("uses DATA_DIR from env when provided", async () => {
    const loadConfig = await getLoadConfig();
    const cfg = withEnv({ ...valid, DATA_DIR: "/custom/data" }, () =>
      loadConfig(),
    );
    expect((cfg as { dataDir: string }).dataDir).toBe("/custom/data");
  });
});
