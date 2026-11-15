import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platform: { OS: "android" },
  config: { scheme: "fytnova" as string | string[] | undefined },
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
  mocks.config.scheme = "fytnova";
});

describe("OAuth redirect for installed previews", () => {
  it("returns to the scheme registered by the installed app", async () => {
    // A config change must not leave OAuth pointing at an old Manus scheme.
    mocks.config.scheme = "another-fytnova-build";
    const { getRedirectUri } = await import("../constants/oauth");
    expect(getRedirectUri()).toBe("another-fytnova-build://oauth/callback");
  });

  it("supports Expo configurations with multiple schemes", async () => {
    mocks.config.scheme = ["fytnova", "exp+peakpulse-mobile"];
    const { getRedirectUri } = await import("../constants/oauth");
    expect(getRedirectUri()).toBe("fytnova://oauth/callback");
  });

  it("keeps the hosted web callback on the configured backend", async () => {
    mocks.platform.OS = "web";
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
    expect(url.searchParams.get("redirectUri")).toBe("fytnova://oauth/callback");
    expect(atob(url.searchParams.get("state")!)).toBe("fytnova://oauth/callback");
  });
});
