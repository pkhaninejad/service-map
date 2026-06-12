import { useState } from "react";
import { useLicense } from "./LicenseProvider";
import { FREE_URL, ENTERPRISE_URL } from "./config";

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export function ActivationScreen() {
  const { activate, status, checking, error, reason } = useLicense();
  const [input, setInput] = useState("");

  const showError = !!error || status === "invalid";
  const message = error
    ? error
    : status === "invalid"
      ? `License not valid${reason ? ` — ${reason}` : ""}.`
      : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%)",
        fontFamily: FONT,
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
          padding: 32,
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>
          Service&nbsp;Map
        </div>
        <p style={{ fontSize: 13.5, color: "#6b7280", lineHeight: 1.55, marginTop: 8 }}>
          Activate your license to continue. Personal & community use is{" "}
          <strong>free</strong>; enterprise/production use requires a commercial license.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!checking) void activate(input);
          }}
          style={{ marginTop: 20 }}
        >
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#9ca3af",
              marginBottom: 6,
            }}
          >
            License key
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="SM-XXXX-XXXX-XXXX"
            autoFocus
            style={{
              width: "100%",
              boxSizing: "border-box",
              fontSize: 14,
              fontFamily: "monospace",
              padding: "10px 12px",
              border: `1px solid ${showError ? "#fca5a5" : "#d1d5db"}`,
              borderRadius: 9,
              outline: "none",
            }}
          />
          {showError && message && (
            <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 8 }}>{message}</div>
          )}

          <button
            type="submit"
            disabled={checking}
            style={{
              all: "unset",
              boxSizing: "border-box",
              marginTop: 16,
              width: "100%",
              textAlign: "center",
              cursor: checking ? "default" : "pointer",
              background: checking ? "#93c5fd" : "#2563eb",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              padding: "11px 0",
              borderRadius: 9,
            }}
          >
            {checking ? "Verifying…" : "Verify & activate"}
          </button>
        </form>

        <div
          style={{
            marginTop: 22,
            paddingTop: 18,
            borderTop: "1px solid #f3f4f6",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <a href={FREE_URL} target="_blank" rel="noreferrer" style={linkStyle}>
            → Get a free license
          </a>
          <a href={ENTERPRISE_URL} target="_blank" rel="noreferrer" style={linkStyle}>
            → Buy an enterprise license
          </a>
        </div>
      </div>
    </div>
  );
}

const linkStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#2563eb",
  textDecoration: "none",
  fontWeight: 500,
};
