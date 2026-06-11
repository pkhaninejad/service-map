import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  ControlButton,
  MiniMap,
  MarkerType,
  Panel,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from "reactflow";
import ELK from "elkjs";
import "reactflow/dist/style.css";
import type { Graph, GraphEdge } from "../loader";
import type { Service } from "../schema";
import type { Area } from "../schema";
import type { Filters } from "../types";
import { matchesFilters } from "../types";
import { AREA_COLORS, EDGE_STYLES } from "./styles";
import { ServiceNode } from "./ServiceNode";
import { Legend } from "./Legend";
import { SettingsModal } from "../settings/SettingsModal";

const elk = new ELK();
const nodeTypes = { service: ServiceNode };

const NODE_W = 250;
const NODE_H = 120;

async function elkLayout(
  services: Service[],
  graphEdges: GraphEdge[],
): Promise<{ nodes: Node<Service>[]; edges: Edge[] }> {
  const elkGraph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "30",
      "elk.layered.spacing.nodeNodeBetweenLayers": "100",
      "elk.layered.spacing.edgeNodeBetweenLayers": "30",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.padding": "[top=40,left=40,bottom=40,right=40]",
    },
    children: services.map((s) => ({ id: s.id, width: NODE_W, height: NODE_H })),
    edges: graphEdges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const layout = await elk.layout(elkGraph);
  const posMap = new Map(
    (layout.children ?? []).map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]),
  );

  const rfNodes: Node<Service>[] = services.map((s) => ({
    id: s.id,
    type: "service",
    position: posMap.get(s.id) ?? { x: 0, y: 0 },
    data: s,
    draggable: true,
  }));

  const rfEdges: Edge[] = graphEdges.map((e) => {
    const style = EDGE_STYLES[e.kind];
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      animated: style.animated ?? false,
      label: e.via ?? style.label,
      labelStyle: { fontSize: 9.5, fill: "#6b7280", fontFamily: "inherit" },
      labelBgStyle: { fill: "rgba(255,255,255,0.9)" },
      labelBgPadding: [4, 3] as [number, number],
      labelBgBorderRadius: 4,
      style: {
        stroke: style.stroke,
        strokeDasharray: style.strokeDasharray,
        strokeWidth: 1.5,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: style.stroke,
        width: 14,
        height: 14,
      },
    };
  });

  return { nodes: rfNodes, edges: rfEdges };
}

// BFS both directions — returns node + all ancestors + all descendants
function getConnectedChain(nodeId: string, graphEdges: GraphEdge[]): Set<string> {
  const result = new Set<string>([nodeId]);
  const fwd = [nodeId];
  while (fwd.length) {
    const curr = fwd.shift()!;
    for (const e of graphEdges) {
      if (e.source === curr && !result.has(e.target)) {
        result.add(e.target);
        fwd.push(e.target);
      }
    }
  }
  const bwd = [nodeId];
  const seen = new Set([nodeId]);
  while (bwd.length) {
    const curr = bwd.shift()!;
    for (const e of graphEdges) {
      if (e.target === curr && !seen.has(e.source)) {
        seen.add(e.source);
        result.add(e.source);
        bwd.push(e.source);
      }
    }
  }
  return result;
}

// BFS upstream only — the node plus every node that can reach it (its ancestors)
function getUpstreamChain(nodeId: string, graphEdges: GraphEdge[]): Set<string> {
  const result = new Set<string>([nodeId]);
  const queue = [nodeId];
  while (queue.length) {
    const curr = queue.shift()!;
    for (const e of graphEdges) {
      if (e.target === curr && !result.has(e.source)) {
        result.add(e.source);
        queue.push(e.source);
      }
    }
  }
  return result;
}


interface Props {
  graph: Graph;
  filters: Filters;
  query: string;
  onQueryChange: (q: string) => void;
  onNodeSelect: (service: Service | null) => void;
  selectedNodeId: string | null;
  showEdgeLabels: boolean;
  onToggleEdgeLabels: () => void;
  groupSelect: { area: Area; v: number } | null;
}

export function Canvas({
  graph,
  filters,
  query,
  onQueryChange,
  onNodeSelect,
  selectedNodeId,
  showEdgeLabels,
  onToggleEdgeLabels,
  groupSelect,
}: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Service>([]);
  const [edges, setEdges] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [relayoutKey, setRelayoutKey] = useState(0);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  // Pinned by clicking an edge: the target node + everything upstream of it
  const [pinnedChain, setPinnedChain] = useState<Set<string> | null>(null);
  const [copied, setCopied] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // focusTrigger: non-null = we're in focus mode; holds the node IDs at capture time
  const [focusTrigger, setFocusTrigger] = useState<{
    ids: Set<string>;
    v: number;
  } | null>(null);

  // Which node IDs match the current filters + query
  const matchingIds = useMemo(() => {
    if (!graph) return new Set<string>();
    const set = new Set<string>();
    for (const n of graph.nodes) {
      if (matchesFilters(n, filters, query)) set.add(n.id);
    }
    return set;
  }, [graph, filters, query]);

  const hasActiveFilter = graph ? matchingIds.size < graph.nodes.length : false;
  const inFocusMode = focusTrigger !== null;

  // Mirror inFocusMode into a ref so the auto-refresh effect can read it
  // without adding focusTrigger to its deps (which would cause a loop).
  const inFocusModeRef = useRef(false);
  // eslint-disable-next-line react-hooks/refs -- intentional "latest value" ref, read only inside the effect below
  inFocusModeRef.current = inFocusMode;

  // Auto-refresh focus layout when filters/search change while in focus mode.
  // Uses a ref to check focus state so we don't need focusTrigger in deps.
  useEffect(() => {
    if (!inFocusModeRef.current) return;
    setFocusTrigger({ ids: new Set(matchingIds), v: Date.now() });
  }, [matchingIds]);

  // ELK layout — re-runs on full reset OR when focus trigger fires
  useEffect(() => {
    if (!graph) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show spinner while ELK computes the async layout
    setLoading(true);

    let nodesToLayout: Service[];
    let edgesToLayout: GraphEdge[];

    if (focusTrigger) {
      // Step 1: edges where both endpoints are in the matching set
      const candidateEdges = graph.edges.filter(
        (e) =>
          focusTrigger.ids.has(e.source) && focusTrigger.ids.has(e.target),
      );

      // Step 2: only keep nodes that participate in at least one edge.
      // Nodes with no connections to anyone else in the focus set are noise —
      // they appear because they matched the filter (e.g. "External" area)
      // but have no documented edges to the other matching services.
      // Fall back to showing all matching nodes only if there are zero edges
      // (so a completely disconnected selection still renders something).
      const participatingIds = new Set<string>();
      for (const e of candidateEdges) {
        participatingIds.add(e.source);
        participatingIds.add(e.target);
      }
      const effectiveIds =
        participatingIds.size > 0 ? participatingIds : focusTrigger.ids;

      nodesToLayout = graph.nodes.filter((n) => effectiveIds.has(n.id));
      edgesToLayout = candidateEdges;
    } else {
      nodesToLayout = graph.nodes;
      edgesToLayout = graph.edges;
    }

    elkLayout(nodesToLayout, edgesToLayout).then(({ nodes: n, edges: e }) => {
      setNodes(n);
      setEdges(e);
      setLoading(false);
    });
  }, [relayoutKey, focusTrigger, graph, setNodes, setEdges]);

  // Group-select: select all nodes of an area for drag
  useEffect(() => {
    if (!groupSelect) return;
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: (n.data as Service).area === groupSelect.area,
      })),
    );
  }, [groupSelect, setNodes]);

  // Hover: compute full connected chain
  const hoverChain = useMemo<Set<string> | null>(() => {
    if (!hoveredNodeId || !graph) return null;
    return getConnectedChain(hoveredNodeId, graph.edges);
  }, [hoveredNodeId, graph]);

  // Active trace driving dimming: live hover takes precedence, otherwise the
  // pinned upstream chain from a clicked edge persists until the pane is clicked.
  const connectedChain = hoverChain ?? pinnedChain;

  // Changing any filter / search clears the pinned selection.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset derived selection when inputs change
    setPinnedChain(null);
  }, [filters, query]);

  // Display nodes
  const displayNodes = useMemo(
    () =>
      nodes.map((n) => {
        let opacity = 1;
        let filter: string | undefined;
        let pointerEvts: React.CSSProperties["pointerEvents"] = undefined;

        if (connectedChain !== null) {
          // Hover trace overrides everything
          if (!connectedChain.has(n.id)) {
            opacity = 0.08;
            filter = "grayscale(1)";
            pointerEvts = "none";
          }
        } else if (!inFocusMode && hasActiveFilter && !matchingIds.has(n.id)) {
          // Normal filter mode — dim non-matching (not in focus mode)
          opacity = 0.13;
          pointerEvts = "none";
        }
        // In focus mode: nodes[] only contains the focused subset — all full opacity

        return {
          ...n,
          selected: n.id === selectedNodeId,
          style: {
            opacity,
            filter,
            transition: "opacity 0.15s, filter 0.15s",
            pointerEvents: pointerEvts,
          },
        };
      }),
    [nodes, connectedChain, matchingIds, hasActiveFilter, inFocusMode, selectedNodeId],
  );

  // Display edges
  const displayEdges = useMemo(
    () =>
      edges.map((e) => {
        const srcOk = connectedChain?.has(e.source) ?? true;
        const tgtOk = connectedChain?.has(e.target) ?? true;
        const edgeInChain = srcOk && tgtOk;
        const bothMatch = matchingIds.has(e.source) && matchingIds.has(e.target);

        let opacity = 1;
        let strokeWidth = 1.5;

        if (connectedChain !== null) {
          if (!edgeInChain) {
            opacity = 0.04;
          } else {
            strokeWidth = 2.5;
          }
        } else if (!inFocusMode && hasActiveFilter && !bothMatch) {
          opacity = 0.08;
        }

        return {
          ...e,
          label: showEdgeLabels ? e.label : undefined,
          animated: e.animated && (connectedChain === null || edgeInChain),
          style: {
            ...e.style,
            opacity,
            strokeWidth,
            transition: "opacity 0.15s",
          },
        };
      }),
    [edges, connectedChain, matchingIds, hasActiveFilter, inFocusMode, showEdgeLabels],
  );

  // How many nodes will be hidden in focus mode (no edges to others in the set)
  const isolatedCount = useMemo(() => {
    if (!hasActiveFilter) return 0;
    const candidateEdges = graph.edges.filter(
      (e) => matchingIds.has(e.source) && matchingIds.has(e.target),
    );
    const participating = new Set<string>();
    for (const e of candidateEdges) {
      participating.add(e.source);
      participating.add(e.target);
    }
    if (participating.size === 0) return 0;
    let count = 0;
    for (const id of matchingIds) {
      if (!participating.has(id)) count++;
    }
    return count;
  }, [graph.edges, matchingIds, hasActiveFilter]);

  // Focus mode helpers
  const enterFocus = useCallback(() => {
    // Prefer the pinned selection if one is active, otherwise the filter matches.
    const ids = pinnedChain ?? matchingIds;
    setFocusTrigger({ ids: new Set(ids), v: Date.now() });
    setPinnedChain(null);
  }, [pinnedChain, matchingIds]);

  const exitFocus = useCallback(() => {
    setFocusTrigger(null);
    setRelayoutKey((v) => v + 1);
  }, []);

  const resetLayout = useCallback(() => {
    setPinnedChain(null);
    if (inFocusMode) exitFocus();
    else setRelayoutKey((v) => v + 1);
  }, [inFocusMode, exitFocus]);

  // Handlers
  const onNodeClick: NodeMouseHandler = useCallback(
    (_evt, node) => {
      const deselecting = selectedNodeId === node.id;
      onNodeSelect(deselecting ? null : (node.data as Service));
      // Pin the node's connected chain so it stays highlighted (others faded)
      // until the pane is clicked or the view is reset. Clicking the same node
      // again clears it.
      setPinnedChain(
        deselecting ? null : getConnectedChain(node.id, graph.edges),
      );
    },
    [onNodeSelect, selectedNodeId, graph],
  );
  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
    setPinnedChain(null);
  }, [onNodeSelect]);
  // Click an edge: highlight the target node plus everything upstream that
  // reaches it. Stays pinned until the user clicks empty canvas.
  const onEdgeClick: EdgeMouseHandler = useCallback(
    (evt, edge) => {
      evt.stopPropagation();
      setPinnedChain(getUpstreamChain(edge.target, graph.edges));
    },
    [graph],
  );
  const onNodeMouseEnter: NodeMouseHandler = useCallback(
    (_evt, node) => setHoveredNodeId(node.id),
    [],
  );
  const onNodeMouseLeave: NodeMouseHandler = useCallback(
    () => setHoveredNodeId(null),
    [],
  );

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  if (!graph) return null;

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          background: "#f8fafc",
          color: "#94a3b8",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: 13,
          gap: 8,
        }}
      >
        <span
          style={{ animation: "spin 1s linear infinite", display: "inline-block" }}
        >
          ⟳
        </span>
        {inFocusMode ? "Focusing…" : "Computing layout…"}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={displayNodes}
      edges={displayEdges}
      onNodesChange={onNodesChange}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      onPaneClick={onPaneClick}
      onNodeMouseEnter={onNodeMouseEnter}
      onNodeMouseLeave={onNodeMouseLeave}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
      <Controls
        showInteractive={false}
        style={{
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        <ControlButton
          onClick={() => setLegendOpen((v) => !v)}
          title="Toggle legend"
          style={{ background: legendOpen ? "#f0f9ff" : undefined }}
        >
          <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <rect x={1} y={2} width={5} height={5} rx={1} />
            <rect x={1} y={9} width={5} height={5} rx={1} />
            <line x1={9} y1={4.5} x2={15} y2={4.5} />
            <line x1={9} y1={11.5} x2={15} y2={11.5} />
          </svg>
        </ControlButton>
      </Controls>
      <MiniMap
        nodeColor={(n) => {
          const s = n.data as Service | undefined;
          if (!s) return "#94a3b8";
          if (connectedChain !== null && !connectedChain.has(n.id)) return "#e5e7eb";
          return AREA_COLORS[s.area].border;
        }}
        nodeStrokeWidth={0}
        pannable
        zoomable
        style={{
          borderRadius: 10,
          border: "1px solid #e5e7eb",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      />

      {/* Search */}
      <Panel position="top-center" style={{ pointerEvents: "all" }}>
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 24,
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            width: 300,
            pointerEvents: "all",
          }}
        >
          <span style={{ color: "#9ca3af", fontSize: 14 }}>⌕</span>
          <input
            data-search-input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Search… (press / to focus)"
            style={{
              all: "unset",
              flex: 1,
              fontSize: 13,
              color: "#111827",
              cursor: "text",
              userSelect: "text",
              WebkitUserSelect: "text",
            }}
          />
          {query && (
            <button
              onClick={() => onQueryChange("")}
              style={{
                all: "unset",
                cursor: "pointer",
                color: "#9ca3af",
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </Panel>

      {/* Focus mode banner — appears below search when in focus */}
      {inFocusMode && (
        <Panel position="top-center">
          {/* Rendered below the search panel via CSS margin trick */}
          <div style={{ marginTop: 48 }}>
            <div
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 20,
                padding: "5px 14px",
                fontSize: 12,
                color: "#1d4ed8",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                display: "flex",
                alignItems: "center",
                gap: 10,
                boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
              }}
            >
              <span>
                Focus view — {nodes.length} service
                {nodes.length !== 1 ? "s" : ""}
                {matchingIds.size - nodes.length > 0 && (
                  <span style={{ opacity: 0.65, fontWeight: 400 }}>
                    {" "}({matchingIds.size - nodes.length} isolated hidden)
                  </span>
                )}
              </span>
              <button
                onClick={exitFocus}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 11.5,
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                ← Full graph
              </button>
            </div>
          </div>
        </Panel>
      )}

      {/* Top-right controls */}
      <Panel position="top-right">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          {/* Match count / focus entry point */}
          {hasActiveFilter && !inFocusMode && !pinnedChain && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 20,
                boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  padding: "5px 10px",
                  fontSize: 11.5,
                  color: "#374151",
                  borderRight: "1px solid #e5e7eb",
                }}
              >
                <strong style={{ color: "#111827" }}>{matchingIds.size}</strong>
                {" "}of {graph.nodes.length}
              </span>
              <button
                onClick={enterFocus}
                title={
                  isolatedCount > 0
                    ? `Focus view — ${isolatedCount} node${isolatedCount !== 1 ? "s" : ""} with no connections will be hidden`
                    : "Re-layout only the matching services so connections are clear"
                }
                style={{
                  all: "unset",
                  cursor: "pointer",
                  padding: "5px 11px",
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  background: "#eff6ff",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background = "#dbeafe")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background = "#eff6ff")
                }
              >
                ⊹ Focus view
                {isolatedCount > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      background: "#fef3c7",
                      color: "#92400e",
                      borderRadius: 8,
                      padding: "1px 5px",
                      fontWeight: 500,
                    }}
                  >
                    −{isolatedCount} isolated
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Hover / pinned trace count — with a focus entry point when pinned */}
          {connectedChain !== null && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 20,
                boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  padding: "5px 12px",
                  fontSize: 11.5,
                  color: "#374151",
                  borderRight: pinnedChain && !inFocusMode ? "1px solid #e5e7eb" : undefined,
                }}
              >
                <strong style={{ color: "#111827" }}>{connectedChain.size}</strong>{" "}
                connected
              </span>
              {pinnedChain && !inFocusMode && (
                <button
                  onClick={enterFocus}
                  title="Re-layout only the pinned services so connections are clear"
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    padding: "5px 11px",
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "#2563eb",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: "#eff6ff",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.background = "#dbeafe")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.background = "#eff6ff")
                  }
                >
                  ⊹ Focus view
                </button>
              )}
            </div>
          )}

          <IconButton title="Re-run auto-layout" active={false} onClick={resetLayout}>
            <span style={{ fontSize: 13 }}>⟳</span>
          </IconButton>

          <IconButton
            title={showEdgeLabels ? "Hide edge labels" : "Show edge labels"}
            active={showEdgeLabels}
            onClick={onToggleEdgeLabels}
          >
            <span style={{ fontSize: 12 }}>🏷</span>
          </IconButton>

          <IconButton
            title={copied ? "Copied!" : "Copy link to this view"}
            active={copied}
            onClick={copyLink}
          >
            <span style={{ fontSize: 12 }}>{copied ? "✓" : "🔗"}</span>
          </IconButton>

          <IconButton
            title="Setup — repos & Claude prompt"
            active={settingsOpen}
            onClick={() => setSettingsOpen(true)}
          >
            <svg viewBox="0 0 16 16" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx={8} cy={8} r={2.5} />
              <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M12.95 3.05l-1.06 1.06M4.11 11.89l-1.06 1.06" />
            </svg>
          </IconButton>
        </div>
      </Panel>

      <Legend open={legendOpen} nodes={graph.nodes} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </ReactFlow>
  );
}

function IconButton({
  children,
  title,
  active,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        all: "unset",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 8,
        background: active ? "#eff6ff" : "#fff",
        border: `1px solid ${active ? "#bfdbfe" : "#e5e7eb"}`,
        cursor: "pointer",
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        transition: "background 0.1s, border-color 0.1s",
      }}
    >
      {children}
    </button>
  );
}
