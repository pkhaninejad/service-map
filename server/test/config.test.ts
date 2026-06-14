import { describe, expect, test } from "vitest";

describe("loadConfig", () => {
  function withEnv(
    env: Record<string, string | undefined>,
    fn: () => unknown,
  ) {
    const keys = ["GITHUB_TOKEN", "GITHUB_OWNER", "PORT", "DATA_DIR", "LICENSE_KEY", "LICENSE_DOMAIN"];
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

  test("reads LICENSE_KEY from env (empty by default)", async () => {
    const loadConfig = await getLoadConfig();
    const a = withEnv(valid, () => loadConfig()) as { licenseKey: string };
    expect(a.licenseKey).toBe("");
    const b = withEnv({ ...valid, LICENSE_KEY: "LK-1" }, () => loadConfig()) as { licenseKey: string };
    expect(b.licenseKey).toBe("LK-1");
  });

  test("licenseDomain defaults to the normalized GITHUB_OWNER", async () => {
    const loadConfig = await getLoadConfig();
    const cfg = withEnv({ ...valid, GITHUB_OWNER: "My-Org" }, () => loadConfig()) as { licenseDomain: string };
    expect(cfg.licenseDomain).toBe("my-org");
  });

  test("LICENSE_DOMAIN overrides the default", async () => {
    const loadConfig = await getLoadConfig();
    const cfg = withEnv({ ...valid, LICENSE_DOMAIN: "https://www.Acme.com/" }, () => loadConfig()) as { licenseDomain: string };
    expect(cfg.licenseDomain).toBe("acme.com");
  });
});
