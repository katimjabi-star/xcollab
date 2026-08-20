const DEFAULT_ISSUER = "http://localhost:8081/realms/xcollab";
const CACHE_TTL_MS = 30_000;
const MAX_USERS = 200;

/** The only user fields the API ever exposes — everything else is stripped. */
export interface RealmUser {
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

let cache: { fetchedAt: number; users: RealmUser[] } | null = null;

/** Test hook: drop the in-process cache. */
export function clearUserCache(): void {
  cache = null;
}

function keycloakConfig(): { origin: string; realm: string } {
  const issuer = new URL(process.env.KEYCLOAK_ISSUER ?? DEFAULT_ISSUER);
  const realm = issuer.pathname.split("/").filter(Boolean).at(-1) ?? "xcollab";
  return { origin: issuer.origin, realm };
}

/** Password-grant admin token against the master realm (admin-cli client). */
async function adminToken(origin: string): Promise<string> {
  const res = await fetch(`${origin}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "admin-cli",
      username: process.env.KEYCLOAK_ADMIN_USER ?? "admin",
      password: process.env.KEYCLOAK_ADMIN_PASSWORD ?? "admin_dev_only",
    }),
  });
  if (!res.ok) throw new Error(`keycloak admin token request failed: ${res.status}`);
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("keycloak admin token response missing access_token");
  return body.access_token;
}

/**
 * Lists the realm's users via the Keycloak admin REST API, stripped to the
 * four public fields and cached in-process for 30 seconds.
 */
export async function listRealmUsers(): Promise<RealmUser[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.users;

  const { origin, realm } = keycloakConfig();
  const token = await adminToken(origin);
  const res = await fetch(`${origin}/admin/realms/${realm}/users?max=${MAX_USERS}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`keycloak user listing failed: ${res.status}`);
  const raw = (await res.json()) as {
    username?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  }[];

  const users: RealmUser[] = raw
    .filter((u): u is { username: string } & typeof u => typeof u.username === "string")
    .map((u) => ({
      username: u.username,
      ...(u.firstName === undefined ? {} : { firstName: u.firstName }),
      ...(u.lastName === undefined ? {} : { lastName: u.lastName }),
      ...(u.email === undefined ? {} : { email: u.email }),
    }));

  cache = { fetchedAt: Date.now(), users };
  return users;
}
