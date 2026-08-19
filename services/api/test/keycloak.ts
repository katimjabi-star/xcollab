const TOKEN_URL =
  (process.env.KEYCLOAK_ISSUER ?? "http://localhost:8081/realms/xcollab") +
  "/protocol/openid-connect/token";

/** Obtains a real access token from the dev Keycloak via the password grant. */
export async function getAccessToken(username = "jabbir", password = "xcollab-dev"): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "xcollab-web",
      username,
      password,
    }),
  });
  if (!res.ok) {
    throw new Error(`keycloak token request failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("keycloak response missing access_token");
  return body.access_token;
}
