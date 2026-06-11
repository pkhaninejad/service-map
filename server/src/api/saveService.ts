import { Octokit } from "octokit";
import yaml from "js-yaml";

export async function saveService(
  token: string,
  owner: string,
  repo: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const octokit = new Octokit({ auth: token });
  const filePath = `data/services/${id}.yml`;

  const { data: current } = await octokit.rest.repos.getContent({ owner, repo, path: filePath });
  if (Array.isArray(current) || current.type !== "file") {
    throw new Error(`${filePath} is not a file`);
  }

  const existing = yaml.load(Buffer.from(current.content, "base64").toString("utf-8")) as Record<string, unknown>;
  const merged = { ...existing, ...patch };

  for (const key of Object.keys(patch)) {
    if (patch[key] === null || patch[key] === undefined || patch[key] === "") {
      delete merged[key];
    }
  }

  const newContent = yaml.dump(merged, { lineWidth: 120, noRefs: true, flowLevel: 1 });

  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message: `chore: update ${id} service definition`,
    content: Buffer.from(newContent).toString("base64"),
    sha: current.sha,
  });
}
