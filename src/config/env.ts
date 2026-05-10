/**
 * Centralised, build-time runtime configuration for the React Native app.
 *
 * Why this file exists
 * --------------------
 * Previously `webClientId`, `API_BASE_URL` and similar values were
 * hardcoded inline (e.g. inside `src/firebase/auth.ts`). That made it:
 *   * impossible to ship a different config per environment (dev /
 *     staging / production) without code edits, and
 *   * far too easy to accidentally commit a value that should not be
 *     committed.
 *
 * Solution
 * --------
 * Every environment-specific value is exported from this module. By
 * default the values come from a checked-in development config; teams
 * that want to override them locally drop a `runtime.local.ts` file
 * (gitignored) next to this one and re-export the overrides. CI and
 * production builds inject the values via a generated
 * `runtime.generated.ts` that the build pipeline writes before
 * bundling.
 *
 * Notes on the Google OAuth web-client ID
 * ---------------------------------------
 * The OAuth `webClientId` is technically a *public* identifier: the
 * client cannot mint tokens with it; only Google can. It is treated as
 * config-rather-than-secret. We still externalise it from source files
 * so we can switch projects without code changes and so `git grep`-able
 * literals don't end up scattered across the codebase.
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Optional overrides
// ---------------------------------------------------------------------------
//
// `runtime.local.ts` and `runtime.generated.ts` are both optional. We
// `require` them defensively so a missing file does not crash the
// bundler. The `try/catch` is necessary because Metro evaluates the
// require at runtime.
//
// TypeScript's strict moduleResolution would otherwise force these into
// the build graph; `// @ts-expect-error` keeps them optional.

type RuntimeOverrides = Partial<RuntimeConfig>;

function loadOverrides(): RuntimeOverrides {
  // The two override files are intentionally optional; we suppress the
  // bundler's "module not found" error at runtime via require + try/catch.
  // We deliberately avoid `import` so the bundler doesn't try to resolve
  // them at build time when they are absent.
  const dynamicRequire: ((id: string) => unknown) = require;
  const overrides: RuntimeOverrides = {};
  try {
    const generated = dynamicRequire('./runtime.generated') as { default?: RuntimeOverrides } & RuntimeOverrides;
    Object.assign(overrides, generated.default ?? generated);
  } catch {
    // ignore - production builds may not have it
  }
  try {
    const local = dynamicRequire('./runtime.local') as { default?: RuntimeOverrides } & RuntimeOverrides;
    Object.assign(overrides, local.default ?? local);
  } catch {
    // ignore - normal in CI
  }
  return overrides;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface RuntimeConfig {
  /** Firebase Google OAuth web-client ID used by `@react-native-google-signin`. */
  googleWebClientId: string;
  /** Base URL of the FastAPI backend. */
  apiBaseUrl: string;
  /** When true, the API client will reject HTTP URLs to enforce TLS. */
  requireHttps: boolean;
  /** When true, verbose request/response logging is emitted. */
  enableApiDebugLogs: boolean;
}

// ---------------------------------------------------------------------------
// Defaults — checked into git, never include real secrets.
// ---------------------------------------------------------------------------
//
// These are the dev-only values the project shipped with. Production
// builds MUST override them via `runtime.generated.ts`.

const DEFAULTS: RuntimeConfig = {
  googleWebClientId:
    '996258236172-49328nk2f3vhe9ejufq125mis22b18n4.apps.googleusercontent.com',
  apiBaseUrl: 'http://192.168.1.9:8000', // Laptop IP for external device access
  requireHttps: false,
  enableApiDebugLogs: __DEV__,
};

// ---------------------------------------------------------------------------
// Exported config (defaults overlaid with overrides)
// ---------------------------------------------------------------------------

const overrides = loadOverrides();

export const RUNTIME_CONFIG: RuntimeConfig = {
  ...DEFAULTS,
  ...overrides,
};

export const GOOGLE_WEB_CLIENT_ID = RUNTIME_CONFIG.googleWebClientId;
export const API_BASE_URL = RUNTIME_CONFIG.apiBaseUrl;
export const REQUIRE_HTTPS = RUNTIME_CONFIG.requireHttps;
export const ENABLE_API_DEBUG_LOGS = RUNTIME_CONFIG.enableApiDebugLogs;

if (REQUIRE_HTTPS && API_BASE_URL.startsWith('http://')) {
  // Bail out loudly in production rather than silently sending traffic
  // in clear text. This is intentional.
  throw new Error(
    `[config] REQUIRE_HTTPS is true but API_BASE_URL=${API_BASE_URL} is plain HTTP. ` +
      'Provide an https:// URL via runtime.generated.ts.',
  );
}
