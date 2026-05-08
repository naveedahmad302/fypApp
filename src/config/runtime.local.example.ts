/**
 * Optional local-only override for {@link ./env.ts}.
 *
 * To use:
 *   1. Copy this file to `src/config/runtime.local.ts`.
 *   2. Set the values you want to override locally.
 *   3. The generated file is gitignored so it never ends up in the repo.
 *
 * For staging/production builds, generate `src/config/runtime.generated.ts`
 * during your CI/CD pipeline (e.g. with `envsubst` or `cross-env-shell`)
 * and ship it inside the bundle.
 */

import type { RuntimeConfig } from './env';

const local: Partial<RuntimeConfig> = {
  // googleWebClientId: '<your-web-client-id>.apps.googleusercontent.com',
  // apiBaseUrl: 'http://192.168.1.10:8000', // your LAN IP for real-device testing
  // requireHttps: false,
  // enableApiDebugLogs: true,
};

export default local;
