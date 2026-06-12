import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ServerResponse } from "node:http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const VIZ_ROOT = path.resolve(__dirname, "../../..");

export function runClaude(prompt: string, res: ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Transfer-Encoding": "chunked",
    "Cache-Control": "no-cache",
  });

  const proc = spawn(
    "claude",
    ["--print", "--dangerously-skip-permissions", prompt],
    { cwd: VIZ_ROOT, stdio: ["ignore", "pipe", "pipe"] },
  );

  proc.stdout.on("data", (chunk: Buffer) => res.write(chunk));
  proc.stderr.on("data", (chunk: Buffer) => res.write(`[stderr] ${chunk}`));

  proc.on("error", (err) => {
    res.write(`[error] ${err.message}\n`);
    res.end();
  });

  proc.on("close", (code) => {
    res.write(`\n[done] exit ${code}\n`);
    res.end();
  });
}
