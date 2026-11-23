import { Platform } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "./auth";

const SERVER_UNAVAILABLE = "FytNova's server is temporarily unavailable. Please try again shortly.";
const UNEXPECTED_RESPONSE = "FytNova's server returned an unexpected response. Please try again.";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

function responseErrorMessage(data: unknown, status: number): string {
  if ([502, 503, 504].includes(status)) return SERVER_UNAVAILABLE;
  if (data && typeof data === "object") {
    const body = data as Record<string, unknown>;
    const message = typeof body.error === "string" ? body.error : body.message;
    if (typeof message === "string" && message.trim() && message.length <= 300 &&
      !/<[!\/a-z]/i.test(message)) {
      return message;
    }
  }
  return status >= 500 ? SERVER_UNAVAILABLE : UNEXPECTED_RESPONSE;
}

export async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  // Determine the auth method:
  // - Native platform: use stored session token as Bearer auth
  // - Web (including iframe): use cookie-based auth (browser handles automatically)
  //   Cookie is set on backend domain via POST /api/auth/session after receiving token via postMessage
  if (Platform.OS !== "web") {
    const sessionToken = await Auth.getSessionToken();
    console.log("[API] apiCall:", {
      endpoint: endpoint.split("?")[0],
      hasToken: !!sessionToken,
      method: options.method || "GET",
    });
    if (sessionToken) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
      console.log("[API] Authorization header added");
    }
  } else {
    console.log("[API] apiCall:", { endpoint: endpoint.split("?")[0], platform: "web", method: options.method || "GET" });
  }

  const baseUrl = getApiBaseUrl();
  // Ensure no double slashes between baseUrl and endpoint
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = baseUrl ? `${cleanBaseUrl}${cleanEndpoint}` : endpoint;

  try {
    console.log("[API] Making request...");
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    console.log("[API] Response status:", response.status, response.statusText);
    // Proxies can return an HTML error page instead of the API's JSON. Never
    // propagate that body to the sign-in screen or logs, even for HTTP 200.
    const text = await response.text();
    if (response.ok && !text.trim()) return {} as T;
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError(responseErrorMessage(null, response.status), response.status);
    }
    if (!response.ok) {
      throw new ApiError(responseErrorMessage(data, response.status), response.status);
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Could not connect to FytNova's server. Check your connection and try again.", 0);
  }
}

// OAuth callback handler - exchange code for session token
// Calls /api/oauth/mobile endpoint which returns JSON with app_session_id and user
export async function exchangeOAuthCode(
  code: string,
  state: string,
): Promise<{ sessionToken: string; user: any }> {
  console.log("[API] exchangeOAuthCode called");
  // Use GET with query params
  const params = new URLSearchParams({ code, state });
  const endpoint = `/api/oauth/mobile?${params.toString()}`;
  const result = await apiCall<{ app_session_id: string; user: any }>(endpoint);

  // Convert app_session_id to sessionToken for compatibility
  const sessionToken = result.app_session_id;
  console.log("[API] OAuth exchange result:", {
    hasSessionToken: !!sessionToken,
    hasUser: !!result.user,
  });

  return {
    sessionToken,
    user: result.user,
  };
}

// Logout
export async function logout(): Promise<void> {
  await apiCall<void>("/api/auth/logout", {
    method: "POST",
  });
}

// Get current authenticated user (web uses cookie-based auth)
export async function getMe(): Promise<{
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: string;
} | null> {
  try {
    const result = await apiCall<{ user: any }>("/api/auth/me");
    return result.user || null;
  } catch (error) {
    console.error("[API] getMe failed:", error);
    return null;
  }
}

// Establish session cookie on the backend (3000-xxx domain)
// Called after receiving token via postMessage to get a proper Set-Cookie from the backend
export async function establishSession(token: string): Promise<boolean> {
  try {
    console.log("[API] establishSession: setting cookie on backend...");
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/api/auth/session`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include", // Important: allows Set-Cookie to be stored
    });

    if (!response.ok) {
      console.error("[API] establishSession failed:", response.status);
      return false;
    }

    console.log("[API] establishSession: cookie set successfully");
    return true;
  } catch (error) {
    console.error("[API] establishSession error:", error);
    return false;
  }
}
