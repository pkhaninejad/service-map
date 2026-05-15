import { AREA_COLORS, KIND_ICONS, KIND_LABELS, STATUS_STYLES, EDGE_STYLES } from "../graph/styles";
import type { Service } from "../schema";
import { getDevelopedByTeams, getMaintainedByTeams } from "../types";

const DOC_BASE = import.meta.env.VITE_DOC_BASE_URL as string | undefined;
const GH_ORG = "axel-springer-kugawana";

interface Props {
  service: Service;
  allServices: Service[];
  onClose: () => void;
}

function Chip({ children, bg = "#f3f4f6", color = "#374151" }: { children: React.ReactNode; bg?: string; color?: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        background: bg,
        color,
        padding: "3px 8px",
        borderRadius: 6,
        display: "inline-block",
      }}
    >
      {children}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: "#9ca3af",
        }}
      >
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

export function DetailDrawer({ service, allServices, onClose }: Props) {
  const area = AREA_COLORS[service.area];
  const status = service.status ? (STATUS_STYLES[service.status] ?? null) : null;
  const icon = KIND_ICONS[service.kind];
  const developedByTeams = getDevelopedByTeams(service);
  const maintainedByTeams = getMaintainedByTeams(service);
  const serviceMap = new Map(allServices.map((s) => [s.id, s]));

  const docUrl =
    DOC_BASE && service.docFile ? `${DOC_BASE}/${service.docFile}` : null;
  const ghUrl = service.github
    ? `https://github.com/${GH_ORG}/${service.github}`
    : null;

  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        height: "100vh",
        background: "#fff",
        borderLeft: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px 12px",
          borderBottom: `3px solid ${area.border}`,
          background: area.bg,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
            <span
              style={{ fontSize: 20, color: area.border, flexShrink: 0, marginTop: 1 }}
            >
              {icon}
            </span>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#111827",
                  lineHeight: "1.3",
                  marginBottom: 5,
                }}
              >
                {service.name}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                <Chip bg={area.pill} color={area.text}>
                  {service.area}
                </Chip>
                <Chip bg={area.pill} color={area.text}>
                  {KIND_LABELS[service.kind]}
                </Chip>
                {status && (
                  <Chip bg={status.bg} color={status.color}>
                    {service.status}
                  </Chip>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close"
            style={{
              all: "unset",
              cursor: "pointer",
              color: "#9ca3af",
              fontSize: 16,
              lineHeight: 1,
              padding: 4,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {/* Summary */}
        {service.summary && (
          <p
            style={{
              fontSize: 12.5,
              color: "#4b5563",
              lineHeight: "1.55",
              margin: 0,
            }}
          >
            {service.summary}
          </p>
        )}

        {/* Links */}
        {(ghUrl || docUrl || service.docFile) && (
          <Row label="Links">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ghUrl && (
                <a
                  href={ghUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 12,
                    color: "#2563eb",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    textDecoration: "none",
                  }}
                >
                  <span style={{ fontSize: 13 }}>⎇</span>
                  {service.github}
                </a>
              )}
              {docUrl ? (
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 12,
                    color: "#2563eb",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    textDecoration: "none",
                  }}
                >
                  <span style={{ fontSize: 12 }}>📄</span>
                  {service.docFile}
                </a>
              ) : service.docFile ? (
                <span
                  style={{
                    fontSize: 11.5,
                    color: "#9ca3af",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontFamily: "monospace",
                  }}
                >
                  <span style={{ fontSize: 12 }}>📄</span>
                  {service.docFile}
                </span>
              ) : null}
            </div>
          </Row>
        )}

        {/* Runtime */}
        {service.runtime && (
          <Row label="Runtime">
            <span style={{ fontSize: 12.5, color: "#374151" }}>
              {service.runtime}
            </span>
          </Row>
        )}

        {/* Tech stack */}
        {service.tech.length > 0 && (
          <Row label="Tech Stack">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {service.tech.map((t) => (
                <Chip key={t}>{t}</Chip>
              ))}
            </div>
          </Row>
        )}

        {/* Depends on */}
        {service.depends_on.length > 0 && (
          <Row label={`Calls / Depends On (${service.depends_on.length})`}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginTop: 2,
              }}
            >
              {service.depends_on.map((dep) => {
                const edgeStyle = EDGE_STYLES[dep.kind];
                const target = serviceMap.get(dep.target);
                return (
                  <div
                    key={`${dep.target}-${dep.kind}`}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "6px 10px",
                      background: "#f9fafb",
                      borderRadius: 7,
                      borderLeft: `3px solid ${edgeStyle.stroke}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#111827",
                        }}
                      >
                        {target?.name ?? dep.target}
                      </div>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: "#9ca3af",
                          marginTop: 2,
                        }}
                      >
                        {dep.via ? `${dep.via} · ` : ""}
                        <span style={{ color: edgeStyle.stroke, fontWeight: 500 }}>
                          {edgeStyle.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Row>
        )}

        {/* Related */}
        {service.related.length > 0 && (
          <Row label="Related Services">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 2 }}>
              {service.related.map((id) => {
                const rel = serviceMap.get(id);
                return (
                  <Chip key={id} bg={rel ? AREA_COLORS[rel.area].pill : "#f3f4f6"} color={rel ? AREA_COLORS[rel.area].text : "#6b7280"}>
                    {rel?.name ?? id}
                  </Chip>
                );
              })}
            </div>
          </Row>
        )}

        {/* Developed By */}
        {developedByTeams.length > 0 && (
          <Row label="Developed By">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {developedByTeams.map((team) => (
                <Chip key={team}>{team}</Chip>
              ))}
            </div>
          </Row>
        )}

        {/* Maintained By */}
        {maintainedByTeams.length > 0 && (
          <Row label="Maintained By">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {maintainedByTeams.map((team) => (
                <Chip key={team}>{team}</Chip>
              ))}
            </div>
          </Row>
        )}
      </div>
    </div>
  );
}
