import { SignJWT, jwtVerify } from "jose";

/**
 * Local session tokens for the X4Auth (Katim ID) login door — the Mahara
 * model: the upstream IdP approves the person, then THIS service mints its
 * own short-lived session token. HS256 with a server-side secret; the
 * Keycloak JWKS path in auth.ts is untouched and remains the primary issuer.
 */
export const LOCAL_ISSUER = "xcollab-x4auth";
const TOKEN_TTL_SECONDS = 8 * 60 * 60;

export interface LocalProfile {
  username: string;
  fullName: string;
  email: string;
}

function secretBytes(): Uint8Array {
  // Dev default mirrors the other *_dev_only credentials; production sets
  // AUTH_LOCAL_SECRET in the xcollab-api Secret.
  const secret = process.env.AUTH_LOCAL_SECRET ?? "xcollab-local-dev-secret";
  return new TextEncoder().encode(secret);
}

export async function signLocalToken(profile: LocalProfile): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const accessToken = await new SignJWT({
    preferred_username: profile.username,
    name: profile.fullName,
    email: profile.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(LOCAL_ISSUER)
    .setSubject(profile.username)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secretBytes());
  return { accessToken, expiresIn: TOKEN_TTL_SECONDS };
}

/** Returns the verified username, or null for anything that is not a valid
    local session token (the caller then falls through to the realm JWKS). */
export async function verifyLocalToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretBytes(), {
      issuer: LOCAL_ISSUER,
      algorithms: ["HS256"],
    });
    const username =
      typeof payload.preferred_username === "string" && payload.preferred_username !== ""
        ? payload.preferred_username
        : payload.sub;
    return username ?? null;
  } catch {
    return null;
  }
}
