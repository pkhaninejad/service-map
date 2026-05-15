export type { AreaStyle, EdgeStyle } from "virtual:viz-config";

export {
  AREA_COLORS,
  KIND_ICONS,
  KIND_LABELS,
  EDGE_STYLES,
} from "virtual:viz-config";

export type StatusStyle = { bg: string; color: string };

export const STATUS_STYLES: Record<string, StatusStyle> = {
  "In Progress":         { bg: "#dcfce7", color: "#15803d" },
  Planning:              { bg: "#fef9c3", color: "#a16207" },
  "On Hold":             { bg: "#ffedd5", color: "#c2410c" },
  "Done / Maintenance":  { bg: "#f3f4f6", color: "#4b5563" },
  Done:                  { bg: "#f3f4f6", color: "#4b5563" },
  Deprecated:            { bg: "#f1f5f9", color: "#94a3b8" },
  "Being Migrated":      { bg: "#fef3c7", color: "#d97706" },
};

export const DEFAULT_STATUS_STYLE: StatusStyle = {
  bg: "#f3f4f6",
  color: "#6b7280",
};
