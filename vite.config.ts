import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { vizPlugin } from "./src/viz-plugin";

export default defineConfig({
  plugins: [react(), vizPlugin()],
  base: "./",
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
