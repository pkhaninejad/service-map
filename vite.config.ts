import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import { vizPlugin } from "./src/viz-plugin";

// Read the MCP server's PORT from server/.env (if present) so the web app's
// __MCP_URL__ default points at the same port the server actually runs on.
function loadServerEnv(): Record<string, string> {
  const envPath = path.resolve(__dirname, "server/.env");
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, "utf-8")
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("#"))
      .map((l) => l.split("=").map((p) => p.trim()) as [string, string])
  );
}

const serverEnv = loadServerEnv();
const mcpPort = serverEnv.PORT ?? "47821";

export default defineConfig({
  plugins: [react(), vizPlugin()],
  base: "./",
  define: {
    __MCP_URL__: JSON.stringify(process.env.MCP_URL ?? `http://localhost:${mcpPort}`),
  },
  resolve: {
    alias: {
      elkjs: path.resolve(__dirname, "node_modules/elkjs/lib/elk.bundled.js"),
    },
  },
  server: {
    fs: {
      allow: [".."],
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
