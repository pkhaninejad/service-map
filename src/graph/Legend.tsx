import { useState } from "react";
import { Panel } from "reactflow";
import { AREAS, KINDS } from "../schema";
import { AREA_COLORS, KIND_ICONS, KIND_LABELS, EDGE_STYLES } from "./styles";
import type { EdgeKind } from "../schema";

const SHOWN_EDGES: EdgeKind[] = [
  "sync-http",
  "async-event",
  "database-write",
  "database-read",
  "shared-lib",
  "replaces",
  "deprecates",
];

export function Legend() {
  const [open, setOpen] = useState(true);

  return (
    <Panel position="bottom-left">
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
        {/* Header */}
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            all: "unset",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "8px 12px",
            cursor: "pointer",
            background: "#f9fafb",
            borderBottom: open ? "1px solid #e5e7eb" : "none",
            boxSizing: "border-box",
          }}
        >
          <span style={{ fontWeight: 600, color: "#111827", fontSize: 11.5 }}>
            Legend
          </span>
          <span style={{ color: "#9ca3af", fontSize: 10 }}>
            {open ? "▲" : "▼"}
          </span>
        </button>

        {open && (
          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Areas */}
            <section>
              <div style={{ fontWeight: 600, color: "#6b7280", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                Product Area
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {AREAS.filter((a) => a !== "external").map((area) => {
                  const s = AREA_COLORS[area];
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
                        }}
                      />
                      <span style={{ color: "#374151" }}>{area}</span>
                    </div>
                  );
                })}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: AREA_COLORS["external"].border,
                      flexShrink: 0,
                      display: "inline-block",
                      opacity: 0.6,
                    }}
                  />
                  <span style={{ color: "#374151" }}>External</span>
                </div>
              </div>
            </section>

            {/* Service kinds */}
            <section>
              <div style={{ fontWeight: 600, color: "#6b7280", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                Service Kind
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 8px" }}>
                {KINDS.filter((k) => k !== "external").map((kind) => (
                  <div key={kind} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 12, color: "#6b7280", width: 14, textAlign: "center" }}>
                      {KIND_ICONS[kind]}
                    </span>
                    <span style={{ color: "#374151" }}>{KIND_LABELS[kind]}</span>
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
                {SHOWN_EDGES.map((kind) => {
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
        )}
      </div>
    </Panel>
  );
}
