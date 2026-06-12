import path from "node:path";

export type Config = {
  githubToken: string;
  githubOwner: string;
  dataRepo: string;
  port: number;
  dataDir: string;
};

export function loadConfig(): Config {
  const missing = (
    [
      ["GITHUB_TOKEN", process.env.GITHUB_TOKEN],
      ["GITHUB_OWNER", process.env.GITHUB_OWNER],
    ] as const
  )
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  return {
    githubToken: process.env.GITHUB_TOKEN!,
    githubOwner: process.env.GITHUB_OWNER!,
    dataRepo: process.env.DATA_REPO ?? "service-map",
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 47821,
    dataDir: process.env.DATA_DIR ?? path.resolve("../data"),
  };
}
