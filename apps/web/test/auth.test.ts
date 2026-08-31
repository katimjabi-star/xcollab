import { describe, expect, it } from "vitest";
import {
  base64UrlEncode,
  buildAuthUrl,
  buildEndSessionUrl,
  buildPasswordGrantBody,
  parseTokenResponse,
  profileFromIdToken,
  randomVerifier,
  s256Challenge,
  shouldRefresh,
  tokenEndpoint,
} from "../lib/auth.ts";

const ISSUER = "http://localhost:8081/realms/xcollab";

describe("base64UrlEncode", () => {
  it("matches standard base64 for alphanumeric input, without padding", () => {
    expect(base64UrlEncode(new TextEncoder().encode("hello"))).toBe("aGVsbG8");
  });

  it("uses - and _ instead of + and /", () => {
    expect(base64UrlEncode(new Uint8Array([255, 255, 254]))).toBe("___-");
    expect(base64UrlEncode(new Uint8Array([251, 239]))).toBe("--8");
  });

  it("strips all padding", () => {
    expect(base64UrlEncode(new Uint8Array([1]))).toBe("AQ");
    expect(base64UrlEncode(new Uint8Array([1, 2]))).toBe("AQI");
    expect(base64UrlEncode(new Uint8Array([1, 2, 3]))).toBe("AQID");
  });
});

describe("randomVerifier", () => {
  it("produces 43-char base64url output for the default 32 bytes", () => {
    expect(randomVerifier()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("produces distinct values", () => {
    expect(randomVerifier()).not.toBe(randomVerifier());
  });
});

describe("s256Challenge", () => {
  it("matches the RFC 7636 appendix B vector", async () => {
    const challenge = await s256Challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("buildAuthUrl", () => {
  it("targets the realm auth endpoint with all PKCE parameters", () => {
    const url = new URL(
      buildAuthUrl(ISSUER, "xcollab-web", "http://localhost:3000/", "st-1", "ch-1"),
    );
    expect(url.origin + url.pathname).toBe(`${ISSUER}/protocol/openid-connect/auth`);
    expect(url.searchParams.get("client_id")).toBe("xcollab-web");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid profile email");
    expect(url.searchParams.get("state")).toBe("st-1");
    expect(url.searchParams.get("code_challenge")).toBe("ch-1");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

describe("buildEndSessionUrl", () => {
  it("carries client_id and post_logout_redirect_uri", () => {
    const url = new URL(buildEndSessionUrl(ISSUER, "xcollab-web", "http://localhost:3000/"));
    expect(url.pathname.endsWith("/protocol/openid-connect/logout")).toBe(true);
    expect(url.searchParams.get("client_id")).toBe("xcollab-web");
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe("http://localhost:3000/");
  });
});

describe("tokenEndpoint", () => {
  it("resolves the realm token endpoint", () => {
    expect(tokenEndpoint(ISSUER)).toBe(`${ISSUER}/protocol/openid-connect/token`);
  });
});

describe("parseTokenResponse", () => {
  it("computes expiresAt = now + expires_in * 1000 and normalizes optionals", () => {
    const tokens = parseTokenResponse(
      { access_token: "at", refresh_token: "rt", id_token: "idt", expires_in: 300 },
      1_000_000,
    );
    expect(tokens).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      idToken: "idt",
      expiresAt: 1_000_000 + 300_000,
    });
    const bare = parseTokenResponse({ access_token: "at", expires_in: 60 }, 0);
    expect(bare.refreshToken).toBeNull();
    expect(bare.idToken).toBeNull();
    expect(bare.expiresAt).toBe(60_000);
  });
});

describe("shouldRefresh", () => {
  it("is false while more than the skew remains", () => {
    expect(shouldRefresh(100_000 + 60_001, 60_000, 100_000)).toBe(false);
  });

  it("is true exactly at the skew boundary and beyond", () => {
    expect(shouldRefresh(100_000 + 60_000, 60_000, 100_000)).toBe(true);
    expect(shouldRefresh(100_000, 60_000, 100_000)).toBe(true);
    expect(shouldRefresh(50_000, 60_000, 100_000)).toBe(true);
  });

  it("defaults the skew to 60s", () => {
    expect(shouldRefresh(100_000 + 59_999, undefined, 100_000)).toBe(true);
    expect(shouldRefresh(100_000 + 60_001, undefined, 100_000)).toBe(false);
  });
});

describe("buildPasswordGrantBody", () => {
  it("builds a direct-grant body with the openid scope (id_token source)", () => {
    const body = buildPasswordGrantBody("xcollab-web", "jabbir", "s3cret+&");
    expect(body.get("grant_type")).toBe("password");
    expect(body.get("client_id")).toBe("xcollab-web");
    expect(body.get("scope")).toBe("openid profile email");
    expect(body.get("username")).toBe("jabbir");
    expect(body.get("password")).toBe("s3cret+&");
    // URLSearchParams must form-encode reserved characters safely.
    expect(body.toString()).toContain("password=s3cret%2B%26");
  });
});

describe("profileFromIdToken", () => {
  function fakeJwt(payload: Record<string, unknown>): string {
    const body = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `eyJhbGciOiJSUzI1NiJ9.${body}.sig`;
  }

  it("extracts preferred_username, name, and email", () => {
    const profile = profileFromIdToken(
      fakeJwt({ preferred_username: "jabbir", name: "Jabbir Parlapati", email: "j@example.test" }),
    );
    expect(profile).toEqual({
      username: "jabbir",
      fullName: "Jabbir Parlapati",
      email: "j@example.test",
    });
  });

  it("falls back to the username when name is absent", () => {
    const profile = profileFromIdToken(fakeJwt({ preferred_username: "sara" }));
    expect(profile.fullName).toBe("sara");
    expect(profile.email).toBe("");
  });

  it("throws on a malformed token", () => {
    expect(() => profileFromIdToken("not-a-jwt")).toThrowError();
  });
});
