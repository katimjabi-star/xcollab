import { createRemoteJWKSet, jwtVerify } from "jose";
import type { MiddlewareHandler } from "hono";

export interface AuthEnv {
  Variables: { username: string };
}

const DEFAULT_ISSUER = "http://localhost:8081/realms/xcollab";

/**
 * Bearer-token auth against the Keycloak realm: RS256 verification via the
 * realm JWKS with an issuer check (audience checked only when configured).
 * On success the verified preferred_username (or sub) becomes the request
 * identity, exposed as c.get("username").
 */
export function createAuthMiddleware(): MiddlewareHandler<AuthEnv> {
  const issuer = process.env.KEYCLOAK_ISSUER ?? DEFAULT_ISSUER;
  const audience = process.env.KEYCLOAK_AUDIENCE;
  const jwks = createRemoteJWKSet(
    new URL(`${issuer.replace(/\/+$/, "")}/protocol/openid-connect/certs`),
  );

  return async (c, next) => {
    const header = c.req.header("authorization");
    if (!header?.startsWith("Bearer ")) return c.json({ error: "unauthorized" }, 401);
    try {
      const { payload } = await jwtVerify(header.slice("Bearer ".length), jwks, {
        issuer,
        // Pinned: a JWKS that ever grows a non-RS256 key must not widen what
        // this middleware accepts (ASVS V3 algorithm-confusion guard).
        algorithms: ["RS256"],
        ...(audience ? { audience } : {}),
      });
      const username =
        typeof payload.preferred_username === "string" && payload.preferred_username !== ""
          ? payload.preferred_username
          : payload.sub;
      if (!username) return c.json({ error: "unauthorized" }, 401);
      c.set("username", username);
    } catch {
      return c.json({ error: "unauthorized" }, 401);
    }
    return next();
  };
}
