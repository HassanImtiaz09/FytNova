import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platform: { OS: "android" },
  config: { scheme: ["fytnova", "manus20260312102054"] as string | string[] | undefined },
  createURL: vi.fn((_path: string, options: { scheme: string }) =>
    `${options.scheme}://oauth/callback`),
}));

vi.mock("react-native", () => ({ Platform: mocks.platform }));
vi.mock("expo-constants", () => ({ default: { expoConfig: mocks.config } }));
vi.mock("expo-linking", () => ({ createURL: mocks.createURL }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
  mocks.platform.OS = "android";
  mocks.config.scheme = ["fytnova", "manus20260312102054"];
});

describe("OAuth redirect for installed previews", () => {
  it("uses a registered Manus callback even when the branded scheme is first", async () => {
    const { getRedirectUri } = await import("../constants/oauth");
    expect(getRedirectUri()).toBe("manus20260312102054://oauth/callback");
  });

  it("supports an Expo configuration with a single Manus scheme", async () => {
    mocks.config.scheme = "manus20260312102054";
    const { getRedirectUri } = await import("../constants/oauth");
    expect(getRedirectUri()).toBe("manus20260312102054://oauth/callback");
  });

  it("does not send an unregistered or rejected scheme to Manus", async () => {
    mocks.config.scheme = ["fytnova", "exp+peakpulse-mobile"];
    const { getRedirectUri } = await import("../constants/oauth");
    expect(() => getRedirectUri()).toThrow("Please update FytNova before signing in.");
    expect(mocks.createURL).not.toHaveBeenCalled();
  });

  it("does not invent an unregistered callback when Expo config is missing", async () => {
    mocks.config.scheme = undefined;
    const { getRedirectUri } = await import("../constants/oauth");
    expect(() => getRedirectUri()).toThrow("Please update FytNova before signing in.");
  });

  it("keeps the hosted web callback on the configured backend", async () => {
    mocks.platform.OS = "web";
    mocks.config.scheme = "fytnova";
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "https://api.example.com/");
    const { getRedirectUri } = await import("../constants/oauth");
    expect(getRedirectUri()).toBe("https://api.example.com/api/oauth/callback");
    expect(mocks.createURL).not.toHaveBeenCalled();
  });

  it("sends the matching redirect and state to the configured login portal", async () => {
    vi.stubEnv("EXPO_PUBLIC_OAUTH_PORTAL_URL", "https://manus.im");
    vi.stubEnv("EXPO_PUBLIC_APP_ID", "preview-project");
    const { getLoginUrl } = await import("../constants/oauth");
    const url = new URL(getLoginUrl());
    expect(url.origin).toBe("https://manus.im");
    expect(url.searchParams.get("appId")).toBe("preview-project");
    const redirectUri = url.searchParams.get("redirectUri")!;
    expect(redirectUri).toBe("manus20260312102054://oauth/callback");
    expect(new URL(redirectUri).protocol).toMatch(/^manus/);
    expect(atob(url.searchParams.get("state")!)).toBe(redirectUri);
  });
});
