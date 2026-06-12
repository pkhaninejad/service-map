import { describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  normalizeDomain,
  validateRemote,
  computeStatus,
  isStale,
  readCache,
  writeCache,
  resolveLicense,
  type LicenseCache,
  type ValidationResult,
} from "../src/license";

const DAY = 24 * 60 * 60 * 1000;

function fakeFetch(body: unknown, opts: { ok?: boolean; throws?: boolean } = {}) {
  return async () => {
    if (opts.throws) throw new Error("network down");
    return {
      ok: opts.ok ?? true,
      json: async () => body,
    } as Response;
  };
}

describe("normalizeDomain", () => {
  test("lowercases, strips scheme and www", () => {
    expect(normalizeDomain("https://www.Example.COM/path")).toBe("example.com");
    expect(normalizeDomain("example.com")).toBe("example.com");
    expect(normalizeDomain("WWW.foo.io")).toBe("foo.io");
  });
});

describe("validateRemote", () => {
  test("posts key+domain and parses the result", async () => {
    let captured: { url: string; body: string } | null = null;
    const fetchFn = (async (url: string, init: RequestInit) => {
      captured = { url, body: String(init.body) };
      return {
        ok: true,
        json: async () => ({ valid: true, tier: "pro", expires: "2030-01-01" }),
      } as Response;
    }) as unknown as typeof fetch;

    const result = await validateRemote("KEY-123", "acme.com", fetchFn);

    expect(result).toEqual({
      valid: true,
      tier: "pro",
      expires: "2030-01-01",
      reason: null,
    });
    expect(captured!.url).toContain("/wds-license/v1/validate");
    expect(JSON.parse(captured!.body)).toEqual({ key: "KEY-123", domain: "acme.com" });
  });

  test("defaults tier to free and missing fields to null", async () => {
    const result = await validateRemote("k", "d", fakeFetch({ valid: false, reason: "expired" }) as unknown as typeof fetch);
    expect(result).toEqual({ valid: false, tier: "free", expires: null, reason: "expired" });
  });

  test("returns null on network failure", async () => {
    const result = await validateRemote("k", "d", fakeFetch({}, { throws: true }) as unknown as typeof fetch);
    expect(result).toBeNull();
  });

  test("returns null on non-object body", async () => {
    const result = await validateRemote("k", "d", fakeFetch("nope") as unknown as typeof fetch);
    expect(result).toBeNull();
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

  test("fresh cache (<24h) is not stale", () => {
    const now = 1_000 * DAY;
    expect(isStale(cache(now - 1000), now)).toBe(false);
  });

  test("cache older than 24h is stale", () => {
    const now = 1_000 * DAY;
    expect(isStale(cache(now - 2 * DAY), now)).toBe(true);
  });
});

describe("computeStatus", () => {
  const now = 1_000 * DAY;
  const result = (valid: boolean, tier: "free" | "pro" = "pro"): ValidationResult => ({
    valid,
    tier,
    expires: null,
    reason: null,
  });
  const cached = (r: ValidationResult, ageMs: number): LicenseCache => ({
    ...r,
    cachedAt: now - ageMs,
  });

  test("no cache → inactive", () => {
    expect(computeStatus(null, now)).toEqual({ active: false, tier: "free" });
  });

  test("fresh valid pro → active pro", () => {
    expect(computeStatus(cached(result(true, "pro"), 1000), now)).toEqual({ active: true, tier: "pro" });
  });

  test("fresh valid free license is still active (free is a real license)", () => {
    expect(computeStatus(cached(result(true, "free"), 1000), now)).toEqual({ active: true, tier: "free" });
  });

  test("valid within 7-day offline grace → still active", () => {
    expect(computeStatus(cached(result(true, "pro"), 5 * DAY), now)).toEqual({ active: true, tier: "pro" });
  });

  test("valid but older than 7 days → downgraded inactive", () => {
    expect(computeStatus(cached(result(true, "pro"), 8 * DAY), now)).toEqual({ active: false, tier: "free" });
  });

  test("cached invalid → inactive", () => {
    expect(computeStatus(cached(result(false), 1000), now)).toEqual({ active: false, tier: "free" });
  });
});

describe("cache read/write", () => {
  test("round-trips through disk", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lic-")), "cache.json");
    const r: ValidationResult = { valid: true, tier: "pro", expires: "2030-01-01", reason: null };
    writeCache(file, r, 12345);
    expect(readCache(file)).toEqual({ ...r, cachedAt: 12345 });
  });

  test("readCache returns null when file is missing", () => {
    expect(readCache(path.join(os.tmpdir(), "does-not-exist-xyz.json"))).toBeNull();
  });

  test("readCache returns null on corrupt JSON", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lic-")), "cache.json");
    fs.writeFileSync(file, "{ not json");
    expect(readCache(file)).toBeNull();
  });
});

describe("resolveLicense", () => {
  const now = 1_000 * DAY;
  const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lic-")), "cache.json");

  test("no key → inactive without calling the server", async () => {
    let called = false;
    const fetchFn = (async () => {
      called = true;
      return {} as Response;
    }) as unknown as typeof fetch;

    const status = await resolveLicense({ key: "", domain: "d", cacheFile: tmpFile(), fetchFn, now });
    expect(status).toMatchObject({ active: false, tier: "free", reason: "no-key" });
    expect(called).toBe(false);
  });

  test("fresh cache is used without re-validating", async () => {
    const file = tmpFile();
    writeCache(file, { valid: true, tier: "pro", expires: null, reason: null }, now - 1000);
    let called = false;
    const fetchFn = (async () => {
      called = true;
      return {} as Response;
    }) as unknown as typeof fetch;

    const status = await resolveLicense({ key: "k", domain: "d", cacheFile: file, fetchFn, now });
    expect(status).toMatchObject({ active: true, tier: "pro" });
    expect(called).toBe(false);
  });

  test("stale cache triggers re-validation and persists the new result", async () => {
    const file = tmpFile();
    writeCache(file, { valid: true, tier: "free", expires: null, reason: null }, now - 2 * DAY);
    const fetchFn = fakeFetch({ valid: true, tier: "pro", expires: "2030-01-01" }) as unknown as typeof fetch;

    const status = await resolveLicense({ key: "k", domain: "d", cacheFile: file, fetchFn, now });
    expect(status).toMatchObject({ active: true, tier: "pro" });
    expect(readCache(file)).toMatchObject({ tier: "pro", cachedAt: now });
  });

  test("stale cache + network failure falls back to cache within grace", async () => {
    const file = tmpFile();
    writeCache(file, { valid: true, tier: "pro", expires: null, reason: null }, now - 3 * DAY);
    const fetchFn = fakeFetch({}, { throws: true }) as unknown as typeof fetch;

    const status = await resolveLicense({ key: "k", domain: "d", cacheFile: file, fetchFn, now });
    expect(status).toMatchObject({ active: true, tier: "pro" });
  });

  test("no cache + valid remote → active and cached", async () => {
    const file = tmpFile();
    const fetchFn = fakeFetch({ valid: true, tier: "pro" }) as unknown as typeof fetch;

    const status = await resolveLicense({ key: "k", domain: "d", cacheFile: file, fetchFn, now });
    expect(status).toMatchObject({ active: true, tier: "pro" });
    expect(readCache(file)).not.toBeNull();
  });
});
