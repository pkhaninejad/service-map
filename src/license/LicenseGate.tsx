import type { ReactNode } from "react";
import { useLicense } from "./LicenseProvider";
import { ActivationScreen } from "./ActivationScreen";

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/**
 * Renders the app only when a valid license is active. While the initial
 * background re-validation is in flight (with no cached result yet) it shows a
 * brief loading state; otherwise it shows the activation screen.
 */
export function LicenseGate({ children }: { children: ReactNode }) {
  const { status } = useLicense();

  if (status === "valid") return <>{children}</>;

  if (status === "initializing") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT,
          color: "#94a3b8",
          fontSize: 13,
        }}
      >
        Checking license…
      </div>
    );
  }

  return <ActivationScreen />;
}
