import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  data: new Map<string, string>(), platform: { OS: "android" },
  backend: "https://fytnova-api-production.up.railway.app",
  get: vi.fn(), set: vi.fn(), remove: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: mocks.platform }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: mocks.get, setItemAsync: mocks.set, deleteItemAsync: mocks.remove,
}));
vi.mock("@/constants/oauth", () => ({
  SESSION_TOKEN_KEY: "app_session_token", USER_INFO_KEY: "manus-runtime-user-info",
  getApiBaseUrl: () => mocks.backend,
}));

const user = { id: 1, openId: "test-user", name: "Test", email: null, loginMethod: "google", lastSignedIn: new Date(0) };

beforeEach(() => {
  vi.resetModules();
  mocks.data.clear();
  mocks.platform.OS = "android";
  mocks.backend = "https://fytnova-api-production.up.railway.app";
  mocks.get.mockImplementation(async (key: string) => mocks.data.get(key) ?? null);
  mocks.set.mockImplementation(async (key: string, value: string) => { mocks.data.set(key, value); });
  mocks.remove.mockImplementation(async (key: string) => { mocks.data.delete(key); });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

function seedOldSession() {
  mocks.data.set("app_session_token", "old-token");
  mocks.data.set("manus-runtime-user-info", JSON.stringify(user));
}

describe("native credentials when changing backends", () => {
  it("retires a legacy session without displaying its cached signed-in user", async () => {
    seedOldSession();
    mocks.data.set("unrelated-local-setting", "keep");
    const auth = await import("../lib/_core/auth");
    expect(await auth.getUserInfo()).toBeNull();
    expect(await auth.getSessionToken()).toBeNull();
    expect(mocks.data.get("unrelated-local-setting")).toBe("keep");
    expect(mocks.data.get("app_session_backend")).toBe(mocks.backend);
  });

  it("does not reuse a token issued by the previous backend", async () => {
    seedOldSession();
    mocks.data.set("app_session_backend", "https://old-manus-api.example.com");
    const auth = await import("../lib/_core/auth");
    expect(await auth.getSessionToken()).toBeNull();
    expect(await auth.getUserInfo()).toBeNull();
  });

  it("preserves a session already bound to the current backend", async () => {
    seedOldSession();
    mocks.data.set("app_session_backend", mocks.backend);
    const auth = await import("../lib/_core/auth");
    expect(await auth.getSessionToken()).toBe("old-token");
    expect(await auth.getUserInfo()).toMatchObject({ id: 1 });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("keeps a newly saved login during concurrent startup checks", async () => {
    seedOldSession();
    const auth = await import("../lib/_core/auth");
    await Promise.all([auth.getUserInfo(), auth.setSessionToken("new-token"), auth.setUserInfo(user)]);
    expect(await auth.getSessionToken()).toBe("new-token");
    expect(await auth.getUserInfo()).toMatchObject({ id: 1 });
    expect(mocks.remove).toHaveBeenCalledTimes(2);
    const logs = JSON.stringify(vi.mocked(console.log).mock.calls);
    expect(logs).not.toContain("new-token");
  });

  it("does not return credentials if backend verification fails", async () => {
    seedOldSession();
    mocks.get.mockRejectedValue(new Error("SecureStore unavailable"));
    const auth = await import("../lib/_core/auth");
    expect(await auth.getSessionToken()).toBeNull();
    expect(await auth.getUserInfo()).toBeNull();
  });

  it("does not return credentials when the API address is unconfigured", async () => {
    seedOldSession(); mocks.backend = "";
    const auth = await import("../lib/_core/auth");
    expect(await auth.getSessionToken()).toBeNull();
    expect(await auth.getUserInfo()).toBeNull();
  });

  it("leaves web cookie-based authentication unchanged", async () => {
    mocks.platform.OS = "web";
    vi.stubGlobal("window", { localStorage: { getItem: () => JSON.stringify(user) } });
    const auth = await import("../lib/_core/auth");
    expect(await auth.getUserInfo()).toMatchObject({ id: 1 });
    expect(await auth.getSessionToken()).toBeNull();
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
