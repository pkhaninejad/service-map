import { Octokit } from "octokit";

export type CodeSearchResult = {
  path: string;
  repo: string;
  snippet: string;
};

export type Commit = {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
};

/** Interface used by code tools — can be swapped with a mock in tests. */
export type GitHubClient = {
  searchCode(query: string, repo: string): Promise<CodeSearchResult[]>;
  readFile(repo: string, path: string, ref?: string): Promise<string>;
  listCommits(repo: string, path?: string, limit?: number): Promise<Commit[]>;
};

export function createGitHubClient(token: string): GitHubClient {
  const octokit = new Octokit({ auth: token });

  return {
    async searchCode(query: string, repo: string): Promise<CodeSearchResult[]> {
      const response = await octokit.rest.search.code({
        q: `${query} repo:${repo}`,
        per_page: 10,
      });
      return response.data.items.map((item) => ({
        path: item.path,
        repo,
        snippet: item.name,
      }));
    },

    async readFile(repo: string, path: string, ref?: string): Promise<string> {
      const [owner, repoName] = repo.split("/");
      const response = await octokit.rest.repos.getContent({
        owner,
        repo: repoName,
        path,
        ...(ref ? { ref } : {}),
      });
      const data = response.data;
      if (Array.isArray(data) || data.type !== "file") {
        throw Object.assign(new Error(`${path} is not a file`), { status: 404 });
      }
      return Buffer.from(data.content, "base64").toString("utf8");
    },

    async listCommits(repo: string, path?: string, limit = 20): Promise<Commit[]> {
      const [owner, repoName] = repo.split("/");
      const response = await octokit.rest.repos.listCommits({
        owner,
        repo: repoName,
        ...(path ? { path } : {}),
        per_page: limit,
      });
      return response.data.map((c) => ({
        sha: c.sha,
        message: c.commit.message.split("\n")[0],
        author: c.commit.author?.name ?? "unknown",
        date: c.commit.author?.date ?? "",
        url: c.html_url,
      }));
    },
  };
}
