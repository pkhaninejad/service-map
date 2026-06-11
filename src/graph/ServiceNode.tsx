import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { Service } from "../schema";
import { AREA_COLORS, KIND_ICONS, STATUS_STYLES, PROBE_BADGE } from "./styles";

export const ServiceNode = memo(({ data, selected }: NodeProps<Service>) => {
  const area = AREA_COLORS[data.area];
  const status = data.status ? (STATUS_STYLES[data.status] ?? null) : null;
  const icon = KIND_ICONS[data.kind];
  const isExternal = data.kind === "external";

  return (
    <div
      style={{
        position: "relative",
        background: area.bg,
        border: `1.5px solid ${selected ? "#3b82f6" : area.border}`,
        borderLeft: `5px solid ${area.border}`,
        borderRadius: 10,
        padding: "10px 12px 10px 10px",
        width: 230,
        boxShadow: selected
          ? `0 0 0 3px rgba(59,130,246,0.25), 0 6px 20px rgba(0,0,0,0.13)`
          : "0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.05)",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        cursor: "grab",
        opacity: data.status === "Deprecated" ? 0.55 : 1,
        ...(isExternal
          ? { borderStyle: "dashed", borderLeftStyle: "solid" }
          : {}),
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: area.border,
          width: 8,
          height: 8,
          border: "2px solid #fff",
          left: -5,
        }}
      />

      {/* Header: icon + name + status */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
        <span
          style={{
            fontSize: 16,
            lineHeight: 1,
            color: area.border,
            flexShrink: 0,
            marginTop: 2,
            userSelect: "none",
          }}
        >
          {icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "#111827",
              lineHeight: "1.35",
              marginBottom: 4,
            }}
          >
            {data.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 500,
                background: area.pill,
                color: area.text,
                padding: "1px 6px",
                borderRadius: 10,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}
            >
              {data.area}
            </span>
            {status && (
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 500,
                  background: status.bg,
                  color: status.color,
                  padding: "1px 6px",
                  borderRadius: 10,
                  letterSpacing: "0.02em",
                }}
              >
                {data.status}
              </span>
            )}
            {data.probe && (
              <span
                title="Live-callable for debugging"
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  background: PROBE_BADGE.bg,
                  color: PROBE_BADGE.color,
                  padding: "1px 6px",
                  borderRadius: 10,
                  letterSpacing: "0.02em",
                }}
              >
                {PROBE_BADGE.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      {data.summary && (
        <p
          style={{
            fontSize: 10.5,
            color: "#6b7280",
            margin: "7px 0 0",
            lineHeight: 1.45,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {data.summary}
        </p>
      )}

      {/* Tech chips */}
      {data.tech.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 3,
            marginTop: 7,
          }}
        >
          {data.tech.slice(0, 4).map((t) => (
            <span
              key={t}
              style={{
                fontSize: 9,
                fontWeight: 500,
                background: "rgba(0,0,0,0.06)",
                color: "#374151",
                padding: "1.5px 5px",
                borderRadius: 4,
              }}
            >
              {t}
            </span>
          ))}
          {data.tech.length > 4 && (
            <span style={{ fontSize: 9, color: "#9ca3af", alignSelf: "center" }}>
              +{data.tech.length - 4}
            </span>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: area.border,
          width: 8,
          height: 8,
          border: "2px solid #fff",
          right: -5,
        }}
      />
    </div>
  );
});

ServiceNode.displayName = "ServiceNode";
