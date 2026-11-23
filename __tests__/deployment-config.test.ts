import { describe, expect, it } from "vitest";
import { parseServerPort, validateProductionConfig } from "../server/_core/deployment";

const validConfig = {
  NODE_ENV: "production", DATABASE_URL: "mysql://test@localhost/test",
  JWT_SECRET: "test-signing-secret-at-least-32-characters",
  VITE_APP_ID: "test-project", OAUTH_SERVER_URL: "https://api.manus.im",
} satisfies NodeJS.ProcessEnv;

describe("production deployment configuration", () => {
  it("keeps credential-free local previews available", () => {
    expect(() => validateProductionConfig({ NODE_ENV: "development" })).not.toThrow();
  });
  it("rejects a production process without its required services configured", () => {
    expect(() => validateProductionConfig({ NODE_ENV: "production" }))
      .toThrow("DATABASE_URL, JWT_SECRET, VITE_APP_ID, OAUTH_SERVER_URL");
  });
  it("accepts the configured API", () => {
    expect(() => validateProductionConfig(validConfig)).not.toThrow();
  });
  it("rejects an empty or weak session-signing key", () => {
    expect(() => validateProductionConfig({ ...validConfig, JWT_SECRET: "short" }))
      .toThrow("JWT_SECRET must contain at least 32 characters");
  });
  it("requires encrypted requests to the OAuth provider", () => {
    expect(() => validateProductionConfig({ ...validConfig, OAUTH_SERVER_URL: "http://example.com" }))
      .toThrow("OAUTH_SERVER_URL must use HTTPS");
  });
  it("uses the host's assigned port and preserves the local default", () => {
    expect(parseServerPort("8080")).toBe(8080);
    expect(parseServerPort(undefined)).toBe(3000);
  });
  it.each(["", "0", "65536", "3000abc", "1.5", "-1", "NaN"])("rejects invalid port %s", (port) => {
    expect(() => parseServerPort(port)).toThrow("PORT must be an integer");
  });
});
