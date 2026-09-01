import { describe, expect, it } from "vitest";
import {
  base64UrlDecode,
  buildPasswordGrantBody,
  decodeJwtClaims,
  tokenEndpoint,
} from "../src/lib/oidc";

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

describe("tokenEndpoint", () => {
  it("keeps the /auth path prefix (the keycloakBase bug class)", () => {
    expect(tokenEndpoint("https://service8.nexedge.ae/auth/realms/xcollab")).toBe(
      "https://service8.nexedge.ae/auth/realms/xcollab/protocol/openid-connect/token",
    );
  });
});

describe("buildPasswordGrantBody", () => {
  it("builds an ROPC form body with the openid scope", () => {
    const body = new URLSearchParams(buildPasswordGrantBody("xcollab-web", "demo", "p w"));
    expect(body.get("grant_type")).toBe("password");
    expect(body.get("client_id")).toBe("xcollab-web");
    expect(body.get("scope")).toContain("openid");
    expect(body.get("username")).toBe("demo");
    expect(body.get("password")).toBe("p w");
  });
});

describe("base64UrlDecode", () => {
  it("round-trips ASCII and UTF-8 (Arabic) payloads", () => {
    for (const text of ["hello", '{"a":1}', "مرحبا بالعالم", "naïve🙂"]) {
      expect(base64UrlDecode(b64url(text))).toBe(text);
    }
  });
});

describe("decodeJwtClaims", () => {
  it("extracts preferred_username and name from the payload", () => {
    const payload = b64url(JSON.stringify({ preferred_username: "demo", name: "Demo User" }));
    const claims = decodeJwtClaims(`${b64url('{"alg":"RS256"}')}.${payload}.sig`);
    expect(claims?.preferred_username).toBe("demo");
    expect(claims?.name).toBe("Demo User");
  });

  it("returns null for malformed tokens", () => {
    expect(decodeJwtClaims("not-a-jwt")).toBeNull();
    expect(decodeJwtClaims("a.%%%.c")).toBeNull();
  });
});
