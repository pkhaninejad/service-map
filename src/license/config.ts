// License configuration for the web app. All values are baked in with sensible
// defaults and can be overridden at build time via Vite env vars.

const env = (import.meta.env ?? {}) as Record<string, string | undefined>;

/** License server validate endpoint (must allow CORS for this app's origin). */
export const LICENSE_SERVER_URL =
  env.VITE_LICENSE_SERVER_URL ??
  "https://wallstrdev.com/wp-json/wds-license/v1/validate";

/** Where to buy an enterprise/production license. */
export const ENTERPRISE_URL =
  env.VITE_LICENSE_ENTERPRISE_URL ??
  "https://wallstrdev.com/product/service-map-interactive-microservice-dependency-visualization-tool/";

/**
 * Where to get a free personal/community license.
 * TODO: replace with the real free-license product URL once it exists.
 */
export const FREE_URL =
  env.VITE_LICENSE_FREE_URL ??
  "https://wallstrdev.com/product/service-map-free/";
