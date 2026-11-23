const REQUIRED_VARIABLES = ["DATABASE_URL", "JWT_SECRET", "VITE_APP_ID", "OAUTH_SERVER_URL"];

export function validateProductionConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== "production") return;
  const missing = REQUIRED_VARIABLES.filter((name) => !env[name]?.trim());
  if (missing.length) {
    throw new Error(`Missing production variables: ${missing.join(", ")}`);
  }
  if (env.JWT_SECRET!.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters in production");
  }
  if (new URL(env.OAUTH_SERVER_URL!).protocol !== "https:") {
    throw new Error("OAUTH_SERVER_URL must use HTTPS in production");
  }
}

export function parseServerPort(value: string | undefined): number {
  const text = value ?? "3000";
  const port = Number(text);
  if (!/^\d+$/.test(text) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}
