import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiCall, exchangeOAuthCode } from "../lib/_core/api";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), getSessionToken: vi.fn() }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("@/constants/oauth", () => ({ getApiBaseUrl: () => "https://api.example.com" }));
vi.mock("@/lib/_core/auth", () => ({ getSessionToken: mocks.getSessionToken }));

beforeEach(() => {
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.getSessionToken.mockResolvedValue(null);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe("API responses during sign-in", () => {
  it.each([502, 503, 504])("turns a %s sandbox HTML page into a readable server error", async (status) => {
    mocks.fetch.mockResolvedValue(new Response(
      '<!doctype html><html><title>Manus Sandbox</title><body>Unavailable</body></html>',
      { status, headers: { "Content-Type": "text/html" } },
    ));
    await expect(exchangeOAuthCode("test-code", "test-state")).rejects.toMatchObject({
      name: "ApiError", status,
      message: "FytNova's server is temporarily unavailable. Please try again shortly.",
    });
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain("test-code");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("does not expose HTML returned with an HTTP 200 status", async () => {
    mocks.fetch.mockResolvedValue(new Response("<!doctype html><html>Proxy page</html>", { status: 200 }));
    await expect(apiCall("/api/auth/me")).rejects.toMatchObject({
      status: 200,
      message: "FytNova's server returned an unexpected response. Please try again.",
    });
  });

  it("preserves a short JSON validation message", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ error: "code and state are required" }, { status: 400 }));
    await expect(apiCall("/api/oauth/mobile")).rejects.toMatchObject({
      status: 400, message: "code and state are required",
    });
  });

  it("does not expose markup embedded in a JSON error", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ error: "<html>Proxy error</html>" }, { status: 500 }));
    await expect(apiCall("/api/oauth/mobile")).rejects.toMatchObject({
      status: 500, message: "FytNova's server is temporarily unavailable. Please try again shortly.",
    });
  });

  it("reports a network failure without exposing the request URL or authorization code", async () => {
    mocks.fetch.mockRejectedValue(new TypeError("Network request failed for test-code"));
    await expect(exchangeOAuthCode("test-code", "test-state")).rejects.toMatchObject({
      status: 0, message: "Could not connect to FytNova's server. Check your connection and try again.",
    });
  });

  it("still returns a successful OAuth token exchange without logging credentials or cookies", async () => {
    const result = { app_session_id: "test-session-token", user: { id: 123, name: "Test" } };
    mocks.fetch.mockResolvedValue(Response.json(result, { headers: { "Set-Cookie": "private-cookie" } }));
    await expect(exchangeOAuthCode("test-code", "test-state")).resolves.toEqual({
      sessionToken: "test-session-token", user: result.user,
    });
    const logs = JSON.stringify(vi.mocked(console.log).mock.calls);
    for (const secret of ["test-code", "test-state", "test-session-token", "private-cookie"]) {
      expect(logs).not.toContain(secret);
    }
  });

  it("supports an empty successful response", async () => {
    mocks.fetch.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiCall("/api/auth/logout", { method: "POST" })).resolves.toEqual({});
  });
});
