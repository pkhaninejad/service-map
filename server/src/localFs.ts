import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { REPOS_DIR } from "./api/syncRepos.js";
import type { GitHubClient, CodeSearchResult, Commit } from "./github.js";

const SEARCH_EXTENSIONS = ["ts", "tsx", "js", "jsx", "json", "yml", "yaml"];
const EXCLUDE_DIRS = ["node_modules", "dist", "build", ".git", "coverage", ".turbo"];

function repoToDir(repo: string): string {
  return path.join(REPOS_DIR, repo.replace("/", "__"));
}

function grepIncludes(): string[] {
  return SEARCH_EXTENSIONS.flatMap((ext) => ["--include", `*.${ext}`]);
}

function grepExcludes(): string[] {
  return EXCLUDE_DIRS.flatMap((dir) => ["--exclude-dir", dir]);
}

export function hasLocalRepos(): boolean {
  if (!fs.existsSync(REPOS_DIR)) return false;
  return fs.readdirSync(REPOS_DIR).some((d) =>
    fs.existsSync(path.join(REPOS_DIR, d, ".git")),
  );
}

export function createLocalFsClient(): GitHubClient {
  return {
    async searchCode(query: string, repo: string): Promise<CodeSearchResult[]> {
      const dir = repoToDir(repo);
      if (!fs.existsSync(dir)) return [];

      // grep -rn <includes> <excludes> -- <query> .
      const result = spawnSync(
        "grep",
        ["-rn", ...grepIncludes(), ...grepExcludes(), "--", query, "."],
        { cwd: dir, encoding: "utf8", maxBuffer: 5 * 1024 * 1024 },
      );

      if (result.error || !result.stdout) return [];

      const lines = result.stdout.trim().split("\n").filter(Boolean);
      const seen = new Set<string>();
      const results: CodeSearchResult[] = [];

      for (const line of lines) {
        // format: ./path/to/file.ts:42:matched content
        const match = line.match(/^\.\/(.+?):(\d+):(.*)/);
        if (!match) continue;
        const [, filePath] = match;
        if (seen.has(filePath)) continue;
        seen.add(filePath);

        // Collect up to 3 matching lines per file for context
        const fileLines = lines
          .filter((l) => l.startsWith(`./${filePath}:`))
          .slice(0, 3)
          .map((l) => l.replace(`.\/${filePath}:`, "").trim());

        results.push({ path: filePath, repo, snippet: fileLines.join(" | ") });
        if (results.length >= 20) break;
      }

      return results;
    },

    async readFile(repo: string, filePath: string): Promise<string> {
      const dir = repoToDir(repo);
      const fullPath = path.join(dir, filePath);

      if (!fs.existsSync(fullPath)) {
        throw Object.assign(new Error(`${filePath} not found in ${repo}`), { status: 404 });
      }
      if (fs.statSync(fullPath).isDirectory()) {
        // List directory contents as a convenience
        const entries = fs.readdirSync(fullPath).join("\n");
        return entries;
      }

      return fs.readFileSync(fullPath, "utf8");
    },

    async listCommits(repo: string, filePath?: string, limit = 20): Promise<Commit[]> {
      const dir = repoToDir(repo);
      if (!fs.existsSync(path.join(dir, ".git"))) {
        throw Object.assign(new Error(`${repo} not found locally`), { status: 404 });
      }

      const args = [
        "log",
        "--no-merges",
        `-n${limit}`,
        "--format=%H%x00%s%x00%an%x00%aI",
      ];
      if (filePath) args.push("--", filePath);

      const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
      if (result.error || !result.stdout?.trim()) return [];

      return result.stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [sha, message, author, date] = line.split("\x00");
          return {
            sha,
            message: message ?? "",
            author: author ?? "unknown",
            date: date ?? "",
            url: `https://github.com/${repo}/commit/${sha}`,
          };
        });
    },
  };
}
