import type { Service } from "../schema";
import type { GitHubClient, CodeSearchResult, Commit } from "../github";

type ErrorResult = { error: string };

function resolveRepo(
  nodes: Service[],
  owner: string,
  serviceId: string,
): { repo: string } | ErrorResult {
  const node = nodes.find((n) => n.id === serviceId);
  if (!node) {
    const sample = nodes
      .slice(0, 5)
      .map((n) => n.id)
      .join(", ");
    return { error: `Unknown service id "${serviceId}". Some valid ids: ${sample}` };
  }
  if (!node.github) {
    return {
      error: `Service "${serviceId}" has no repo mapped (no github field) — it is likely an external or unmapped node.`,
    };
  }
  return { repo: `${owner}/${node.github}` };
}

function mapGitHubError(err: unknown): ErrorResult {
  const e = err as { status?: number; message?: string; response?: { headers?: Record<string, string> } };
  if (e.status === 404) return { error: `404: File or resource not found.` };
  if (e.status === 401) return { error: `401: Bad GitHub credentials — check GITHUB_TOKEN.` };
  if (e.status === 403) {
    const reset = e.response?.headers?.["x-ratelimit-reset"];
    const resetTime = reset ? new Date(parseInt(reset, 10) * 1000).toISOString() : "unknown";
    return { error: `GitHub rate limit exceeded. Resets at ${resetTime}.` };
  }
  return { error: `GitHub error: ${e.message ?? String(err)}` };
}

// ── searchCode ────────────────────────────────────────────────────────────────

type SearchCodeArgs = { query: string; serviceId?: string };
type SearchCodeResult = CodeSearchResult[] | ErrorResult;

export async function searchCode(
  nodes: Service[],
  client: GitHubClient,
  owner: string,
  args: SearchCodeArgs,
): Promise<SearchCodeResult> {
  if (args.serviceId) {
    const resolved = resolveRepo(nodes, owner, args.serviceId);
    if ("error" in resolved) return resolved;
    try {
      return await client.searchCode(args.query, resolved.repo);
    } catch (err) {
      return mapGitHubError(err);
    }
  }

  // No serviceId: search across all repos that have a github field
  const repos = [...new Set(nodes.filter((n) => n.github).map((n) => `${owner}/${n.github!}`))];
  const results: CodeSearchResult[] = [];
  for (const repo of repos) {
    try {
      const hits = await client.searchCode(args.query, repo);
      results.push(...hits);
    } catch {
      // skip repos that fail; don't abort the whole search
    }
  }
  return results;
}

// ── readFile ──────────────────────────────────────────────────────────────────

type ReadFileArgs = { serviceId: string; path: string; ref?: string };
type ReadFileResult = { content: string; repo: string; path: string } | ErrorResult;

export async function readFile(
  nodes: Service[],
  client: GitHubClient,
  owner: string,
  args: ReadFileArgs,
): Promise<ReadFileResult> {
  const resolved = resolveRepo(nodes, owner, args.serviceId);
  if ("error" in resolved) return resolved;
  try {
    const content = await client.readFile(resolved.repo, args.path, args.ref);
    return { content, repo: resolved.repo, path: args.path };
  } catch (err) {
    return mapGitHubError(err);
  }
}

// ── listRecentCommits ─────────────────────────────────────────────────────────

type ListCommitsArgs = { serviceId: string; path?: string; limit?: number };
type ListCommitsResult = Commit[] | ErrorResult;

export async function listRecentCommits(
  nodes: Service[],
  client: GitHubClient,
  owner: string,
  args: ListCommitsArgs,
): Promise<ListCommitsResult> {
  const resolved = resolveRepo(nodes, owner, args.serviceId);
  if ("error" in resolved) return resolved;
  try {
    return await client.listCommits(resolved.repo, args.path, args.limit ?? 20);
  } catch (err) {
    return mapGitHubError(err);
  }
}
