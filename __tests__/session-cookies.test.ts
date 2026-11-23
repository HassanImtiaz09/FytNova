import { describe, expect, it, vi } from "vitest";
import express, { type Request, type Response } from "express";
import { getSessionCookieOptions } from "../server/_core/cookies";

function request(hostname: string, protocol = "https", headers = {}): Request {
  return { hostname, protocol, headers } as Request;
}

describe("session-cookie scope", () => {
  it.each([
    "fytnova-api-production.up.railway.app", "3000-sandbox.us5.manus.computer",
    "api.example.com", "localhost", "127.0.0.1",
  ])("keeps cookies host-only for %s", (hostname) => {
    const options = getSessionCookieOptions(request(hostname));
    expect(options.domain).toBeUndefined();
    const append = vi.fn();
    const response = { req: {}, append } as unknown as Response;
    express.response.cookie.call(response, "test_session", "test-token", options);
    const header = append.mock.calls[0][1] as string;
    expect(header).not.toMatch(/domain=/i);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=None");
  });

  it("keeps secure cookies behind the Railway HTTPS proxy", () => {
    const options = getSessionCookieOptions(request("api.example.com", "http", { "x-forwarded-proto": "https" }));
    expect(options.secure).toBe(true);
    expect(options.domain).toBeUndefined();
  });

  it("preserves the existing local HTTP behavior", () => {
    expect(getSessionCookieOptions(request("localhost", "http")).secure).toBe(false);
  });
});
