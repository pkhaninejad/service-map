declare module "virtual:viz-config" {
  export type AreaStyle = {
    bg: string;
    border: string;
    text: string;
    pill: string;
  };
  export type EdgeStyle = {
    stroke: string;
    strokeDasharray?: string;
    animated?: boolean;
    label: string;
  };
  export const AREAS: readonly string[];
  export const KINDS: readonly string[];
  export const STATUSES: readonly string[];
  export const EDGE_KINDS: readonly string[];
  export const AREA_COLORS: Record<string, AreaStyle>;
  export const KIND_ICONS: Record<string, string>;
  export const KIND_LABELS: Record<string, string>;
  export const EDGE_STYLES: Record<string, EdgeStyle>;
}

declare module "virtual:viz-data" {
  export const serviceFiles: Record<string, unknown>;
  export const externalsData: unknown[];
}
