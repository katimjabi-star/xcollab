/** Build-time endpoints, EXPO_PUBLIC_* baked into the bundle at build. */
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "https://service8.nexedge.ae";

/** Keycloak realm behind the same host (VirtualService routes /auth/*). */
export const KEYCLOAK_ISSUER =
  process.env.EXPO_PUBLIC_KEYCLOAK_ISSUER ?? `${API_BASE}/auth/realms/xcollab`;

/** Public client with direct-access grants — same one the web bundle uses. */
export const KEYCLOAK_CLIENT_ID = process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID ?? "xcollab-web";

export const WORKSPACE = "hq";

/** Demo prefill, mirroring the web login gate. */
export const DEMO_USERNAME = "demo";
