import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const resultPath = "preview-result.json";
const bin = name => join(process.cwd(), "node_modules", ".bin", name);
const runJson = (name, args) => JSON.parse(execFileSync(bin(name), args, {
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
  stdio: ["ignore", "pipe", "inherit"],
}));

function saveResult(build) {
  const config = JSON.parse(readFileSync("app.json", "utf8")).expo;
  const previous = existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, "utf8")) : {};
  const owner = build.project?.ownerAccount?.name ?? config.owner;
  const slug = build.project?.slug ?? config.slug;
  const buildUrl = owner
    ? `https://expo.dev/accounts/${encodeURIComponent(owner)}/projects/${encodeURIComponent(slug)}/builds/${build.id}`
    : `https://expo.dev/builds/${build.id}`;
  const result = {
    ...previous,
    projectId: config.extra?.eas?.projectId,
    owner,
    slug,
    buildId: build.id,
    status: build.status,
    buildUrl,
    apkUrl: build.artifacts?.buildUrl ?? null,
    error: build.error?.message ?? null,
    queuePosition: build.queuePosition ?? null,
    estimatedWaitTimeLeftSeconds: build.estimatedWaitTimeLeftSeconds ?? null,
  };
  writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Android preview: ${result.status} — ${buildUrl}`);
  return result;
}

async function captureDiagnostics(build) {
  const reports = [];
  for (const [index, url] of (build.logFiles ?? []).entries()) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.text();
      const lines = raw.split(/\r?\n/).map(line => {
        try {
          const entry = JSON.parse(line);
          return String(entry.msg ?? entry.message ?? line);
        } catch { return line; }
      });
      const selected = new Set();
      lines.forEach((line, i) => {
        if (/\berror\b|^e: |^FAILURE|What went wrong|Execution failed|Caused by:|Could not resolve|CMake Error|ninja: error/i.test(line)) {
          for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 5); j++) selected.add(j);
        }
      });
      const excerpt = selected.size
        ? [...selected].sort((a, b) => a - b).slice(-300).map(i => lines[i]).join("\n")
        : lines.slice(-50).join("\n");
      const redacted = excerpt.replace(/https?:\/\/\S+/g, "[URL]")
        .replaceAll(process.env.EXPO_TOKEN || "__NO_EXPO_TOKEN__", "[REDACTED]");
      reports.push(`Log ${index + 1}\n${redacted}`);
    } catch (error) {
      reports.push(`Log ${index + 1}: could not retrieve diagnostics (${error.message})`);
    }
  }
  writeFileSync("preview-diagnostics.txt", reports.join("\n\n"));
}

const mode = process.argv[2];
if (mode === "request") {
  const request = JSON.parse(readFileSync(".github/android-preview-request.json", "utf8"));
  const selectedMode = process.env.REQUEST_MODE || request.mode || "build";
  const buildId = process.env.REQUEST_MODE ? process.env.REQUEST_BUILD_ID : request.buildId;
  if (!["build", "inspect"].includes(selectedMode)) throw new Error("Invalid preview request mode");
  if (selectedMode === "inspect" && !/^[a-f0-9-]{36}$/i.test(buildId ?? "")) throw new Error("A valid Expo build ID is required");
  appendFileSync(process.env.GITHUB_OUTPUT, `mode=${selectedMode}\nbuild_id=${buildId ?? ""}\n`);
} else if (mode === "link") {
  // EAS cannot edit app.config.ts automatically. Materialize its evaluated public
  // config only inside this disposable CI checkout, then let EAS write projectId.
  const config = runJson("expo", ["config", "--type", "public", "--json"]);
  delete config._internal;
  renameSync("app.config.ts", join(process.env.RUNNER_TEMP, "fytnova-app.config.ts"));
  writeFileSync("app.json", `${JSON.stringify({ expo: config }, null, 2)}\n`);
  execFileSync(bin("eas"), ["init", "--force", "--non-interactive"], { stdio: "inherit" });
  const linked = JSON.parse(readFileSync("app.json", "utf8")).expo;
  if (!linked.extra?.eas?.projectId) throw new Error("EAS project linking did not return a project ID");
  writeFileSync(resultPath, `${JSON.stringify({ projectId: linked.extra.eas.projectId, slug: linked.slug }, null, 2)}\n`);
} else if (mode === "build") {
  const builds = runJson("eas", ["build", "--platform", "android", "--profile", "android-preview", "--non-interactive", "--no-wait", "--json"]);
  if (!Array.isArray(builds) || builds.length !== 1 || !builds[0].id) {
    throw new Error("Expected exactly one Android build");
  }
  const result = saveResult(builds[0]);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Android build: [Open in Expo](${result.buildUrl})\n\n`);
  }
} else if (mode === "inspect") {
  const build = runJson("eas", ["build:view", process.env.PREVIEW_BUILD_ID, "--json"]);
  saveResult(build);
  await captureDiagnostics(build);
} else if (mode === "wait") {
  const { buildId } = JSON.parse(readFileSync(resultPath, "utf8"));
  if (!buildId) throw new Error("No Android build ID to monitor");
  const deadline = Date.now() + 75 * 60 * 1000;
  while (Date.now() < deadline) {
    const build = runJson("eas", ["build:view", buildId, "--json"]);
    const result = saveResult(build);
    if (result.status === "FINISHED") {
      if (!result.apkUrl) throw new Error("Finished Android build did not include an APK URL");
      if (process.env.GITHUB_STEP_SUMMARY) {
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, `APK ready: [Install FytNova](${result.apkUrl})\n`);
      }
      process.exit(0);
    }
    if (["ERRORED", "CANCELED"].includes(result.status)) {
      if (result.status === "ERRORED") await captureDiagnostics(build);
      throw new Error(result.error ?? `Android build ${result.status.toLowerCase()}`);
    }
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
  throw new Error("Build is still pending; use the saved Expo link to check its status");
} else {
  throw new Error("Expected request, link, build, inspect or wait");
}
