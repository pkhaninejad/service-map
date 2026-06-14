import { describe, expect, test } from "vitest";
import {
  normalizeDomain,
  validateRemote,
  computeStatus,
  isStale,
} from "./licenseClient";
import type { LicenseCache, ValidationResult } from "./licenseClient";

const DAY = 24 * 60 * 60 * 1000;

describe("normalizeDomain", () => {
  test("lowercases, strips scheme and www", () => {
    expect(normalizeDomain("https://www.Example.COM")).toBe("example.com");
    expect(normalizeDomain("localhost")).toBe("localhost");
    expect(normalizeDomain("WWW.foo.io")).toBe("foo.io");
  });
});

describe("validateRemote", () => {
  test("posts key+domain and normalizes the result", async () => {
    let body: unknown = null;
    const fetchFn = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return { ok: true, json: async () => ({ valid: true, tier: "pro" }) } as Response;
    }) as unknown as typeof fetch;

    const result = await validateRemote("K", "acme.com", fetchFn);
    expect(result).toEqual({ valid: true, tier: "pro", expires: null, reason: null });
    expect(body).toEqual({ key: "K", domain: "acme.com" });
  });

  test("returns null on network failure", async () => {
    const fetchFn = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await validateRemote("k", "d", fetchFn)).toBeNull();
  });
});

describe("isStale", () => {
  const cache = (cachedAt: number): LicenseCache => ({
    valid: true,
    tier: "pro",
    expires: null,
    reason: null,
    cachedAt,
  });
  test("under 24h is fresh", () => {
    expect(isStale(cache(1000 * DAY - 1000), 1000 * DAY)).toBe(false);
  });
  test("over 24h is stale", () => {
    expect(isStale(cache(1000 * DAY - 2 * DAY), 1000 * DAY)).toBe(true);
  });
});

describe("computeStatus", () => {
  const now = 1000 * DAY;
  const r = (valid: boolean, tier: "free" | "pro" = "pro"): ValidationResult => ({
    valid,
    tier,
    expires: null,
    reason: null,
  });
  const c = (res: ValidationResult, age: number): LicenseCache => ({ ...res, cachedAt: now - age });

  test("no cache → inactive", () => {
    expect(computeStatus(null, now)).toEqual({ active: false, tier: "free" });
  });
  test("fresh valid free is active (free is a real license)", () => {
    expect(computeStatus(c(r(true, "free"), 1000), now)).toEqual({ active: true, tier: "free" });
  });
  test("valid within 7-day grace → active", () => {
    expect(computeStatus(c(r(true, "pro"), 5 * DAY), now)).toEqual({ active: true, tier: "pro" });
  });
  test("valid past 7 days → downgraded", () => {
    expect(computeStatus(c(r(true, "pro"), 8 * DAY), now)).toEqual({ active: false, tier: "free" });
  });
  test("cached invalid → inactive", () => {
    expect(computeStatus(c(r(false), 1000), now)).toEqual({ active: false, tier: "free" });
  });
});
