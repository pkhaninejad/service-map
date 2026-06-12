import fs from "node:fs";
import path from "node:path";
import { buildGraph, type Graph, type RawFile } from "./buildGraph";

function readDir(dir: string): RawFile[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yml"))
    .map((f) => {
      const filePath = path.join(dir, f);
      return { path: filePath, raw: fs.readFileSync(filePath, "utf8") };
    });
}

export function loadGraphFs(dataDir: string): Graph {
  const serviceFiles = readDir(path.join(dataDir, "services"));
  const externalsPath = path.join(dataDir, "externals.yml");
  const externalFiles: RawFile[] = fs.existsSync(externalsPath)
    ? [{ path: externalsPath, raw: fs.readFileSync(externalsPath, "utf8") }]
    : [];
  return buildGraph(serviceFiles, externalFiles);
}
