import { describe, expect, it } from "vitest";
import { keycloakBase } from "../src/users.ts";

describe("keycloakBase (issuer → admin/token base)", () => {
  it("keeps a path prefix like /auth (KC_HTTP_RELATIVE_PATH behind a gateway)", () => {
    expect(keycloakBase("https://service8.nexedge.ae/auth/realms/xcollab")).toEqual({
      base: "https://service8.nexedge.ae/auth",
      realm: "xcollab",
    });
  });

  it("handles a prefix-less issuer (local dev)", () => {
    expect(keycloakBase("http://localhost:8081/realms/xcollab")).toEqual({
      base: "http://localhost:8081",
      realm: "xcollab",
    });
  });

  it("tolerates a trailing slash", () => {
    expect(keycloakBase("http://localhost:8081/realms/xcollab/")).toEqual({
      base: "http://localhost:8081",
      realm: "xcollab",
    });
  });
});
