import { Panel } from "reactflow";
import { AREA_COLORS, KIND_ICONS, KIND_LABELS, EDGE_STYLES } from "./styles";
import type { EdgeKind } from "../schema";
import type { Service } from "../schema";

const SHOWN_EDGES: EdgeKind[] = [
  "sync-http",
  "async-event",
  "database-write",
  "database-read",
  "shared-lib",
  "replaces",
  "deprecates",
];

export function Legend({ open, nodes }: { open: boolean; nodes: Service[] }) {
  if (!open) return null;

  // Derive the legend from the areas/kinds actually present in the data, so it
  // stays in sync with whatever data set the repo is configured with.
  const areas = [...new Set(nodes.map((n) => n.area))].sort((a, b) =>
    a === "external" ? 1 : b === "external" ? -1 : a.localeCompare(b),
  );
  const kinds = [...new Set(nodes.map((n) => n.kind))]
    .filter((k) => k !== "external")
    .sort();

  return (
    // Offset above the Controls bar (≈5 buttons × 34px + 15px base + 10px gap)
    <Panel position="bottom-left" style={{ bottom: 210 }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: 11,
          minWidth: 200,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "8px 12px 4px", borderBottom: "1px solid #f3f4f6" }}>
          <span style={{ fontWeight: 600, color: "#111827", fontSize: 11.5 }}>Legend</span>
        </div>

        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Areas */}
          <section>
            <div style={{ fontWeight: 600, color: "#6b7280", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
              Product Area
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {areas.map((area) => {
                const s = AREA_COLORS[area] ?? AREA_COLORS["external"];
                return (
                  <div key={area} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        background: s.border,
                        flexShrink: 0,
                        display: "inline-block",
                        opacity: area === "external" ? 0.6 : 1,
                      }}
                    />
                    <span style={{ color: "#374151" }}>{area}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Service kinds */}
          <section>
            <div style={{ fontWeight: 600, color: "#6b7280", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
              Service Kind
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 8px" }}>
              {kinds.map((kind) => (
                <div key={kind} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 12, color: "#6b7280", width: 14, textAlign: "center" }}>
                    {KIND_ICONS[kind]}
                  </span>
                  <span style={{ color: "#374151" }}>{KIND_LABELS[kind] ?? kind}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Edge kinds */}
          <section>
            <div style={{ fontWeight: 600, color: "#6b7280", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
              Connection Type
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {SHOWN_EDGES.filter((kind) => EDGE_STYLES[kind]).map((kind) => {
                const s = EDGE_STYLES[kind];
                return (
                  <div key={kind} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <svg width={28} height={10} style={{ flexShrink: 0, overflow: "visible" }}>
                      <line
                        x1={0} y1={5} x2={28} y2={5}
                        stroke={s.stroke}
                        strokeWidth={1.5}
                        strokeDasharray={s.strokeDasharray}
                      />
                      <polygon
                        points="24,2 28,5 24,8"
                        fill={s.stroke}
                      />
                    </svg>
                    <span style={{ color: "#374151" }}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </Panel>
  );
}
