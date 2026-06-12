import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPOS_DIR = path.resolve(__dirname, "../../../repos");

export interface SyncResult {
  repo: string;
  status: "cloned" | "pulled" | "error";
  path: string;
  error?: string;
}

function parseSlug(input: string): string {
  // Accept "owner/repo" or full GitHub URL
  const match = input.match(/github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?$/);
  if (match) return match[1];
  if (/^[\w.-]+\/[\w.-]+$/.test(input)) return input;
  throw new Error(`Cannot parse repo slug from: ${input}`);
}

function repoDir(slug: string): string {
  return path.join(REPOS_DIR, slug.replace("/", "__"));
}

async function git(args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv }): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", args, {
      cwd: options.cwd,
      stdio: "pipe",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...options.env },
    });
    const stderr: string[] = [];
    proc.stderr.on("data", (chunk: Buffer) => stderr.push(chunk.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.join("").trim() || `git exited ${code}`));
    });
  });
}

function cloneUrl(slug: string, token?: string): string {
  if (token) return `https://${token}@github.com/${slug}.git`;
  return `https://github.com/${slug}.git`;
}

export async function syncRepos(repos: string[], token?: string): Promise<SyncResult[]> {
  fs.mkdirSync(REPOS_DIR, { recursive: true });

  return Promise.all(
    repos.map(async (repo): Promise<SyncResult> => {
      let slug: string;
      try {
        slug = parseSlug(repo.trim());
      } catch (e) {
        return { repo, status: "error", path: "", error: String(e) };
      }

      const dir = repoDir(slug);

      try {
        if (fs.existsSync(path.join(dir, ".git"))) {
          await git(["pull", "--ff-only"], { cwd: dir });
          return { repo, status: "pulled", path: dir };
        } else {
          fs.mkdirSync(dir, { recursive: true });
          await git(["clone", cloneUrl(slug, token), dir], {});
          return { repo, status: "cloned", path: dir };
        }
      } catch (err) {
        return { repo, status: "error", path: dir, error: String(err) };
      }
    }),
  );
}
