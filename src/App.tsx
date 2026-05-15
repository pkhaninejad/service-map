import { useMemo, useState, useEffect, useCallback } from "react";
import { loadGraph } from "./loader";
import { Canvas } from "./graph/Canvas";
import { FilterSidebar } from "./ui/FilterSidebar";
import { DetailDrawer } from "./ui/DetailDrawer";
import type { Filters } from "./types";
import type { Service } from "./schema";
import type { Area } from "./schema";

// ─── URL state helpers ────────────────────────────────────────────────────────

function readUrl(nodes: Service[]): {
  filters: Filters;
  query: string;
  selectedService: Service | null;
} {
  const p = new URLSearchParams(window.location.search);
  const split = (key: string) =>
    new Set(p.get(key)?.split(",").filter(Boolean) ?? []);
  const nodeId = p.get("node");
  const legacyTeams = split("teams");
  const maintainedBy = split("maintainedBy");
  const combinedMaintainedBy = new Set([...legacyTeams, ...maintainedBy]);
  return {
    query: p.get("q") ?? "",
    filters: {
      areas: split("areas"),
      kinds: split("kinds"),
      statuses: split("statuses"),
      techs: split("techs"),
      developedBy: split("developedBy"),
      maintainedBy: combinedMaintainedBy,
    },
    selectedService: nodeId
      ? (nodes.find((n) => n.id === nodeId) ?? null)
      : null,
  };
}

function writeUrl(
  filters: Filters,
  query: string,
  selectedService: Service | null,
) {
  const p = new URLSearchParams();
  if (query) p.set("q", query);
  if (filters.areas.size) p.set("areas", [...filters.areas].join(","));
  if (filters.kinds.size) p.set("kinds", [...filters.kinds].join(","));
  if (filters.statuses.size) p.set("statuses", [...filters.statuses].join(","));
  if (filters.techs.size) p.set("techs", [...filters.techs].join(","));
  if (filters.developedBy.size) p.set("developedBy", [...filters.developedBy].join(","));
  if (filters.maintainedBy.size) p.set("maintainedBy", [...filters.maintainedBy].join(","));
  if (selectedService) p.set("node", selectedService.id);
  const qs = p.toString();
  window.history.replaceState(
    null,
    "",
    qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const graph = useMemo(() => loadGraph(), []);

  const initial = useMemo(() => readUrl(graph.nodes), [graph.nodes]);
  const [filters, setFilters] = useState<Filters>(initial.filters);
  const [query, setQuery] = useState(initial.query);
  const [selectedService, setSelectedService] = useState<Service | null>(
    initial.selectedService,
  );
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  // {area, v} — v increments on each click so the same area can be re-selected
  const [groupSelect, setGroupSelect] = useState<{
    area: Area;
    v: number;
  } | null>(null);

  // Sync URL whenever filter/query/selection changes
  useEffect(() => {
    writeUrl(filters, query, selectedService);
  }, [filters, query, selectedService]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";
      if (e.key === "Escape" && selectedService) {
        setSelectedService(null);
        e.preventDefault();
      }
      if (e.key === "/" && !isInput) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>("[data-search-input]")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedService]);

  const handleNodeSelect = useCallback((svc: Service | null) => {
    setSelectedService(svc);
  }, []);

  const handleSelectGroup = useCallback((area: Area) => {
    setGroupSelect({ area, v: Date.now() });
  }, []);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <FilterSidebar
        graph={graph}
        filters={filters}
        onChange={setFilters}
        onSelectGroup={handleSelectGroup}
      />

      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {graph.errors.length > 0 && <DataErrors errors={graph.errors} />}
        <Canvas
          graph={graph}
          filters={filters}
          query={query}
          onQueryChange={setQuery}
          onNodeSelect={handleNodeSelect}
          selectedNodeId={selectedService?.id ?? null}
          showEdgeLabels={showEdgeLabels}
          onToggleEdgeLabels={() => setShowEdgeLabels((v) => !v)}
          groupSelect={groupSelect}
        />
      </div>

      {selectedService && (
        <DetailDrawer
          service={selectedService}
          allServices={graph.nodes}
          onClose={() => setSelectedService(null)}
        />
      )}
    </div>
  );
}

function DataErrors({ errors }: { errors: string[] }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        background: "#fef2f2",
        border: "1px solid #fecaca",
        color: "#991b1b",
        padding: "10px 14px",
        borderRadius: 8,
        maxWidth: 500,
        fontSize: 11.5,
        fontFamily: "monospace",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <strong>Data errors ({errors.length}):</strong>
        <button
          onClick={() => setDismissed(true)}
          style={{
            all: "unset",
            cursor: "pointer",
            color: "#9ca3af",
            fontFamily: "inherit",
          }}
        >
          ✕
        </button>
      </div>
      <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
        {errors.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </div>
  );
}
