const DEFAULT_ISSUER = "http://localhost:8081/realms/xcollab";
const CACHE_TTL_MS = 30_000;
const MAX_USERS = 200;

/** The only user fields the API ever exposes — everything else is stripped.
    Email is deliberately absent: it is PII with no consumer (assignment and
    people-picking key on username), so it never leaves this module. */
export interface RealmUser {
  username: string;
  firstName?: string;
  lastName?: string;
}

let cache: { fetchedAt: number; users: RealmUser[] } | null = null;

/** Test hook: drop the in-process cache. */
export function clearUserCache(): void {
  cache = null;
}

/**
 * Splits an issuer URL into the Keycloak base (everything before /realms/,
 * INCLUDING any path prefix such as /auth) and the realm name. Rebuilding
 * from origin alone breaks deployments where Keycloak is path-routed
 * (KC_HTTP_RELATIVE_PATH=/auth behind the shared gateway).
 */
export function keycloakBase(issuerUrl: string): { base: string; realm: string } {
  const issuer = issuerUrl.replace(/\/+$/, "");
  const match = /^(.+)\/realms\/([^/]+)$/.exec(issuer);
  if (match?.[1] !== undefined && match[2] !== undefined) {
    return { base: match[1], realm: match[2] };
  }
  return { base: issuer, realm: "xcollab" };
}

function keycloakConfig(): { base: string; realm: string } {
  return keycloakBase(process.env.KEYCLOAK_ISSUER ?? DEFAULT_ISSUER);
}

/**
 * Client-credentials grant for the confidential service client (xcollab-svc,
 * provisioned by keycloak/bootstrap-dev.sh) in the app's OWN realm. Its
 * service account holds exactly the realm-management view-users role — no
 * master-realm or admin credentials exist anywhere in this process.
 */
async function serviceToken(base: string, realm: string): Promise<string> {
  const res = await fetch(`${base}/realms/${realm}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.KEYCLOAK_SVC_CLIENT_ID ?? "xcollab-svc",
      // Dev-only default, matching the bootstrap script; real deployments
      // must set KEYCLOAK_SVC_CLIENT_SECRET.
      client_secret: process.env.KEYCLOAK_SVC_CLIENT_SECRET ?? "svc_dev_only",
    }),
  });
  if (!res.ok) throw new Error(`keycloak service token request failed: ${res.status}`);
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("keycloak service token response missing access_token");
  return body.access_token;
}

/**
 * Lists the realm's users via the Keycloak admin REST API, stripped to the
 * four public fields and cached in-process for 30 seconds.
 */
export async function listRealmUsers(): Promise<RealmUser[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.users;

  const { base, realm } = keycloakConfig();
  const token = await serviceToken(base, realm);
  const res = await fetch(`${base}/admin/realms/${realm}/users?max=${MAX_USERS}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`keycloak user listing failed: ${res.status}`);
  const raw = (await res.json()) as {
    username?: string;
    firstName?: string;
    lastName?: string;
  }[];

  const users: RealmUser[] = raw
    .filter((u): u is { username: string } & typeof u => typeof u.username === "string")
    .map((u) => ({
      username: u.username,
      ...(u.firstName === undefined ? {} : { firstName: u.firstName }),
      ...(u.lastName === undefined ? {} : { lastName: u.lastName }),
    }));

  cache = { fetchedAt: Date.now(), users };
  return users;
}
