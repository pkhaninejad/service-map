/* eslint-disable react-refresh/only-export-components -- provider + its hook are intentionally colocated */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  normalizeDomain,
  validateRemote,
  computeStatus,
  isStale,
  readCache,
  writeCache,
  readKey,
  writeKey,
  clearLicense,
} from "./licenseClient";
import type { LicenseCache, Tier } from "./licenseClient";

export type LicenseStatus =
  | "valid"        // active license — app is unlocked
  | "invalid"      // key present but not valid/expired
  | "unactivated"  // no key yet
  | "initializing"; // key present, first validation in flight (no cache yet)

export type LicenseContextValue = {
  status: LicenseStatus;
  /** A validation request is currently in flight (non-blocking). */
  checking: boolean;
  /** Last activation error (e.g. network failure), if any. */
  error: string | null;
  tier: Tier;
  expires: string | null;
  reason: string | null;
  /** The currently stored key (may be empty). */
  licenseKey: string;
  activate: (key: string) => Promise<void>;
  deactivate: () => void;
  recheck: () => Promise<void>;
};

const LicenseContext = createContext<LicenseContextValue | null>(null);

function currentDomain(): string {
  return normalizeDomain(window.location.hostname);
}

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<string>(() => readKey());
  const [cache, setCache] = useState<LicenseCache | null>(() => readCache());
  // Entitlement is computed at cache-change time (not in render) so the render
  // path stays pure — Date.now() lives only in handlers/effects.
  const [entitlement, setEntitlement] = useState(() =>
    computeStatus(readCache(), Date.now()),
  );
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyResult = useCallback((c: LicenseCache | null) => {
    setCache(c);
    setEntitlement(computeStatus(c, Date.now()));
  }, []);

  const recheck = useCallback(async () => {
    const k = readKey();
    if (!k) return;
    setChecking(true);
    setError(null);
    const result = await validateRemote(k, currentDomain());
    setChecking(false);
    if (result) {
      writeCache(result, Date.now());
      applyResult({ ...result, cachedAt: Date.now() });
    }
    // null = network failure → keep existing cache, let grace decide
  }, [applyResult]);

  const activate = useCallback(
    async (inputKey: string) => {
      const trimmed = inputKey.trim();
      if (!trimmed) {
        setError("Please enter a license key.");
        return;
      }
      setChecking(true);
      setError(null);
      const result = await validateRemote(trimmed, currentDomain());
      setChecking(false);
      if (!result) {
        setError("Couldn't reach the license server. Check your connection and try again.");
        return;
      }
      writeKey(trimmed);
      writeCache(result, Date.now());
      setKey(trimmed);
      applyResult({ ...result, cachedAt: Date.now() });
    },
    [applyResult],
  );

  const deactivate = useCallback(() => {
    clearLicense();
    setKey("");
    setError(null);
    applyResult(null);
  }, [applyResult]);

  // On mount: if we have a key with a stale/missing cache, re-validate quietly.
  useEffect(() => {
    if (key && (!cache || isStale(cache, Date.now()))) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- async revalidation on mount (fetch-on-mount is the canonical effect)
      void recheck();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<LicenseContextValue>(() => {
    const { active, tier } = entitlement;
    // An active cache always unlocks the app — even while a background recheck
    // is in flight — so background re-validation never flashes the gate.
    let status: LicenseStatus;
    if (active) status = "valid";
    else if (!key) status = "unactivated";
    else if (!cache) status = "initializing";
    else status = "invalid";

    return {
      status,
      checking,
      error,
      tier: active ? tier : (cache?.tier ?? "free"),
      expires: cache?.expires ?? null,
      reason: error ?? cache?.reason ?? null,
      licenseKey: key,
      activate,
      deactivate,
      recheck,
    };
  }, [entitlement, cache, checking, error, key, activate, deactivate, recheck]);

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicense(): LicenseContextValue {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error("useLicense must be used within a LicenseProvider");
  return ctx;
}
