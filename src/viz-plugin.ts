import type { Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const VIRTUAL_CONFIG = "virtual:viz-config";
const VIRTUAL_DATA = "virtual:viz-data";
const RESOLVED_CONFIG = "\0virtual:viz-config";
const RESOLVED_DATA = "\0virtual:viz-data";

const PALETTE = [
  { bg: "#eff6ff", border: "#2563eb", text: "#1d4ed8", pill: "#dbeafe" },
  { bg: "#f5f3ff", border: "#7c3aed", text: "#6d28d9", pill: "#ede9fe" },
  { bg: "#ecfeff", border: "#0891b2", text: "#0e7490", pill: "#cffafe" },
  { bg: "#fdf2f8", border: "#db2777", text: "#be185d", pill: "#fce7f3" },
  { bg: "#f0fdf4", border: "#16a34a", text: "#15803d", pill: "#dcfce7" },
  { bg: "#fff7ed", border: "#ea580c", text: "#c2410c", pill: "#fed7aa" },
  { bg: "#fef9c3", border: "#ca8a04", text: "#854d0e", pill: "#fef08a" },
  { bg: "#fce7f3", border: "#9d174d", text: "#831843", pill: "#fbcfe8" },
  { bg: "#dcfce7", border: "#15803d", text: "#14532d", pill: "#bbf7d0" },
  { bg: "#e0f2fe", border: "#0369a1", text: "#075985", pill: "#bae6fd" },
  { bg: "#fef3c7", border: "#d97706", text: "#92400e", pill: "#fde68a" },
  { bg: "#f3e8ff", border: "#7e22ce", text: "#6b21a8", pill: "#e9d5ff" },
];

interface AreaConfig {
  id: string;
  label: string;
  color?: { bg: string; border: string; text: string; pill: string };
}

interface KindConfig {
  id: string;
  label: string;
  icon?: string;
}

interface EdgeKindConfig {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
  animated?: boolean;
}

interface VizConfig {
  dataDir: string;
  areas: AreaConfig[];
  kinds: KindConfig[];
  statuses: string[];
  edgeKinds: EdgeKindConfig[];
}

function readConfig(root: string): VizConfig {
  const configPath = path.resolve(root, "viz.config.yml");
  const examplePath = path.resolve(root, "viz.config.example.yml");

  let usedPath: string;
  if (fs.existsSync(configPath)) {
    usedPath = configPath;
  } else if (fs.existsSync(examplePath)) {
    console.warn(
      "[viz-plugin] viz.config.yml not found, falling back to viz.config.example.yml"
    );
    usedPath = examplePath;
  } else {
    throw new Error(
      "Neither viz.config.yml nor viz.config.example.yml found.\nCreate viz.config.yml by copying viz.config.example.yml."
    );
  }

  const config = yaml.load(fs.readFileSync(usedPath, "utf-8")) as VizConfig;
  if (!config.areas?.length)
    throw new Error(`${path.basename(usedPath)}: 'areas' must have at least one entry.`);
  if (!config.kinds?.length)
    throw new Error(`${path.basename(usedPath)}: 'kinds' must have at least one entry.`);
  if (!config.statuses?.length)
    throw new Error(`${path.basename(usedPath)}: 'statuses' must have at least one entry.`);
  if (!config.edgeKinds?.length)
    throw new Error(`${path.basename(usedPath)}: 'edgeKinds' must have at least one entry.`);
  return config;
}

function buildConfigModule(config: VizConfig): string {
  const AREAS = config.areas.map((a) => a.id);
  const KINDS = config.kinds.map((k) => k.id);
  const STATUSES = config.statuses;
  const EDGE_KINDS = config.edgeKinds.map((e) => e.id);

  const AREA_COLORS: Record<string, object> = {};
  config.areas.forEach((area, i) => {
    AREA_COLORS[area.id] = area.color ?? PALETTE[i % PALETTE.length];
  });

  const KIND_ICONS: Record<string, string> = {};
  const KIND_LABELS: Record<string, string> = {};
  config.kinds.forEach((kind) => {
    KIND_ICONS[kind.id] = kind.icon ?? "◯";
    KIND_LABELS[kind.id] = kind.label;
  });

  const EDGE_STYLES: Record<string, object> = {};
  config.edgeKinds.forEach((edge) => {
    EDGE_STYLES[edge.id] = {
      stroke: edge.color,
      label: edge.label,
      ...(edge.dashed ? { strokeDasharray: "6 3" } : {}),
      ...(edge.animated ? { animated: true } : {}),
    };
  });

  return [
    `export const AREAS = ${JSON.stringify(AREAS)};`,
    `export const KINDS = ${JSON.stringify(KINDS)};`,
    `export const STATUSES = ${JSON.stringify(STATUSES)};`,
    `export const EDGE_KINDS = ${JSON.stringify(EDGE_KINDS)};`,
    `export const AREA_COLORS = ${JSON.stringify(AREA_COLORS)};`,
    `export const KIND_ICONS = ${JSON.stringify(KIND_ICONS)};`,
    `export const KIND_LABELS = ${JSON.stringify(KIND_LABELS)};`,
    `export const EDGE_STYLES = ${JSON.stringify(EDGE_STYLES)};`,
  ].join("\n");
}

function buildDataModule(config: VizConfig, root: string): string {
  const dataDir = path.resolve(root, config.dataDir);
  if (!fs.existsSync(dataDir)) {
    throw new Error(
      `viz.config.yml: dataDir '${config.dataDir}' does not exist.\nResolved to: ${dataDir}`
    );
  }

  const servicesDir = path.join(dataDir, "services");
  const serviceFiles: Record<string, unknown> = {};
  if (fs.existsSync(servicesDir)) {
    for (const file of fs.readdirSync(servicesDir)) {
      if (!file.endsWith(".yml")) continue;
      serviceFiles[file] = yaml.load(
        fs.readFileSync(path.join(servicesDir, file), "utf-8")
      );
    }
  }

  const externalsPath = path.join(dataDir, "externals.yml");
  let externalsData: unknown[] = [];
  if (fs.existsSync(externalsPath)) {
    const parsed = yaml.load(fs.readFileSync(externalsPath, "utf-8"));
    externalsData = Array.isArray(parsed) ? parsed : [];
  }

  return [
    `export const serviceFiles = ${JSON.stringify(serviceFiles)};`,
    `export const externalsData = ${JSON.stringify(externalsData)};`,
  ].join("\n");
}

export function vizPlugin(): Plugin {
  let root = process.cwd();

  return {
    name: "viz-plugin",

    configResolved(config) {
      root = config.root;
    },

    buildStart() {
      readConfig(root);
    },

    resolveId(id) {
      if (id === VIRTUAL_CONFIG) return RESOLVED_CONFIG;
      if (id === VIRTUAL_DATA) return RESOLVED_DATA;
    },

    load(id) {
      if (id === RESOLVED_CONFIG) {
        const config = readConfig(root);
        return buildConfigModule(config);
      }
      if (id === RESOLVED_DATA) {
        const config = readConfig(root);
        return buildDataModule(config, root);
      }
    },

    configureServer(server) {
      const configPath = path.resolve(root, "viz.config.yml");
      server.watcher.add(configPath);

      try {
        const config = readConfig(root);
        const dataDir = path.resolve(root, config.dataDir);
        server.watcher.add(path.join(dataDir, "services"));
        server.watcher.add(path.join(dataDir, "externals.yml"));
      } catch {
        // config may not be valid yet; watched when it becomes valid
      }

      server.watcher.on("change", (changedPath) => {
        if (changedPath === configPath || changedPath.endsWith(".yml")) {
          const configMod = server.moduleGraph.getModuleById(RESOLVED_CONFIG);
          const dataMod = server.moduleGraph.getModuleById(RESOLVED_DATA);
          if (configMod) server.moduleGraph.invalidateModule(configMod);
          if (dataMod) server.moduleGraph.invalidateModule(dataMod);
          server.ws.send({ type: "full-reload" });
        }
      });
    },
  };
}
