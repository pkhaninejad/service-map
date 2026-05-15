import { useState } from "react";
import { AREAS, KINDS } from "../schema";
import {
  AREA_COLORS,
  KIND_ICONS,
  KIND_LABELS,
  STATUS_STYLES,
} from "../graph/styles";
import type { Filters } from "../types";
import {
  emptyFilters,
  activeFilterCount,
  collectTechs,
  collectStatuses,
  collectDeveloperTeams,
  collectMaintainerTeams,
} from "../types";
import type { Graph } from "../loader";
import type { Area } from "../schema";

interface Props {
  graph: Graph;
  filters: Filters;
  onChange: (f: Filters) => void;
  onSelectGroup: (area: Area) => void;
}

function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid #f3f4f6" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          all: "unset",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "9px 14px",
          cursor: "pointer",
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "#9ca3af",
          }}
        >
          {title}
        </span>
        <span style={{ color: "#d1d5db", fontSize: 9 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div style={{ padding: "2px 14px 10px" }}>{children}</div>}
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onToggle,
  accent,
  icon,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  accent?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "3px 0",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          width: 15,
          height: 15,
          borderRadius: 4,
          border: `1.5px solid ${checked ? (accent ?? "#3b82f6") : "#d1d5db"}`,
          background: checked ? (accent ?? "#3b82f6") : "#fff",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.1s",
        }}
      >
        {checked && (
          <svg width="9" height="7" viewBox="0 0 9 7">
            <polyline
              points="1,3.5 3.5,6 8,1"
              fill="none"
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      {icon && (
        <span style={{ fontSize: 13, color: accent ?? "#6b7280", width: 16, textAlign: "center" }}>
          {icon}
        </span>
      )}
      <span style={{ fontSize: 12, color: checked ? "#111827" : "#6b7280" }}>
        {label}
      </span>
    </label>
  );
}

export function FilterSidebar({ graph, filters, onChange, onSelectGroup }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const count = activeFilterCount(filters);
  const allTechs = collectTechs(graph.nodes);
  const allStatuses = collectStatuses(graph.nodes);
  const allDeveloperTeams = collectDeveloperTeams(graph.nodes);
  const allMaintainerTeams = collectMaintainerTeams(graph.nodes);

  return (
    <div
      style={{
        width: collapsed ? 40 : 220,
        flexShrink: 0,
        height: "100vh",
        background: "#fff",
        borderRight: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "width 0.2s ease",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        position: "relative",
        zIndex: 5,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          padding: collapsed ? "12px 0" : "12px 14px",
          borderBottom: "1px solid #f3f4f6",
          flexShrink: 0,
          gap: 6,
        }}
      >
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
              Filters
            </span>
            {count > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: "#3b82f6",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "1px 6px",
                }}
              >
                {count}
              </span>
            )}
          </div>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand filters" : "Collapse filters"}
          style={{
            all: "unset",
            cursor: "pointer",
            color: "#9ca3af",
            fontSize: 14,
            lineHeight: 1,
            padding: 2,
          }}
        >
          {collapsed ? "▶" : "◀"}
        </button>
      </div>

      {/* Active filter badge + clear (visible when collapsed) */}
      {collapsed && count > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "8px 0",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              background: "#3b82f6",
              color: "#fff",
              borderRadius: 10,
              padding: "2px 6px",
            }}
          >
            {count}
          </span>
        </div>
      )}

      {/* Filter sections (hidden when collapsed) */}
      {!collapsed && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Clear all */}
          {count > 0 && (
            <div style={{ padding: "8px 14px 0" }}>
              <button
                onClick={() => onChange(emptyFilters())}
                style={{
                  all: "unset",
                  fontSize: 11,
                  color: "#3b82f6",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                ✕ Clear all filters
              </button>
            </div>
          )}

          {/* Area */}
          <Section title="Product Area">
            {AREAS.map((area) => {
              const style = AREA_COLORS[area];
              return (
                <div
                  key={area}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <CheckRow
                    label={area}
                    checked={filters.areas.has(area)}
                    onToggle={() =>
                      onChange({ ...filters, areas: toggle(filters.areas, area) })
                    }
                    accent={style.border}
                  />
                  {area !== "External" && (
                    <button
                      onClick={() => onSelectGroup(area as Area)}
                      title={`Select all ${area} nodes to drag as a group`}
                      style={{
                        all: "unset",
                        cursor: "pointer",
                        color: "#9ca3af",
                        fontSize: 11,
                        padding: "2px 4px",
                        borderRadius: 4,
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.color = style.border)
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.color = "#9ca3af")
                      }
                    >
                      ⊹
                    </button>
                  )}
                </div>
              );
            })}
          </Section>

          {/* Kind */}
          <Section title="Service Kind">
            {KINDS.filter((k) => k !== "external").map((kind) => (
              <CheckRow
                key={kind}
                label={KIND_LABELS[kind]}
                checked={filters.kinds.has(kind)}
                onToggle={() =>
                  onChange({ ...filters, kinds: toggle(filters.kinds, kind) })
                }
                icon={KIND_ICONS[kind]}
                accent="#6b7280"
              />
            ))}
          </Section>

          {/* Status */}
          <Section title="Status">
            {allStatuses.map((status) => {
              const s = STATUS_STYLES[status];
              return (
                <CheckRow
                  key={status}
                  label={status}
                  checked={filters.statuses.has(status)}
                  onToggle={() =>
                    onChange({
                      ...filters,
                      statuses: toggle(filters.statuses, status),
                    })
                  }
                  accent={s?.color ?? "#6b7280"}
                />
              );
            })}
          </Section>

          {/* Tech */}
          <Section title="Technology" defaultOpen={false}>
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {allTechs.map((tech) => (
                <CheckRow
                  key={tech}
                  label={tech}
                  checked={filters.techs.has(tech)}
                  onToggle={() =>
                    onChange({
                      ...filters,
                      techs: toggle(filters.techs, tech),
                    })
                  }
                  accent="#0891b2"
                />
              ))}
            </div>
          </Section>

          {/* Developed By */}
          <Section title="Developed By" defaultOpen={false}>
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {allDeveloperTeams.map((team) => (
                <CheckRow
                  key={team}
                  label={team}
                  checked={filters.developedBy.has(team)}
                  onToggle={() =>
                    onChange({
                      ...filters,
                      developedBy: toggle(filters.developedBy, team),
                    })
                  }
                  accent="#6b7280"
                />
              ))}
            </div>
          </Section>

          {/* Maintained By */}
          <Section title="Maintained By" defaultOpen={false}>
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {allMaintainerTeams.map((team) => (
                <CheckRow
                  key={team}
                  label={team}
                  checked={filters.maintainedBy.has(team)}
                  onToggle={() =>
                    onChange({
                      ...filters,
                      maintainedBy: toggle(filters.maintainedBy, team),
                    })
                  }
                  accent="#6b7280"
                />
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
