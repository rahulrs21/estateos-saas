/*
 * The hosted-environment guard (docs/STAGING_DEPLOYMENT.md#start-up-guard). A staging or production server refuses to
 * start when its configuration could point it at the wrong place: an emulator, another Firebase project, the developer
 * tools, a test fake, or (on staging) real WhatsApp customers. Only variable NAMES are reported, never values.
 *
 * ESTATEOS_ENVIRONMENT unset (or "local") means local development and the browser tests: nothing is checked, so
 * `npm run dev:local` and the emulators keep working unchanged.
 */

export type EstateOsEnvironment = "local" | "staging" | "production";
type Env = Record<string, string | undefined>;

const EMULATOR_VARIABLES = ["DATA_CONNECT_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "FIREBASE_DATABASE_EMULATOR_HOST"] as const;
/** Local-only switches that must never reach a hosted server. */
const LOCAL_ONLY_VARIABLES = ["ESTATEOS_DEV_TOOLS", "INBOX_WHATSAPP_GRAPH_BASE", "ESTATEOS_NEXT_DIST_DIR", "ESTATEOS_TSCONFIG_PATH"] as const;

const present = (env: Env, name: string) => Boolean(env[name]?.trim());

/** Which environment this server says it is; an unknown value is a problem, not a silent "local". */
export function estateOsEnvironment(env: Env): EstateOsEnvironment | null {
  const value = env.ESTATEOS_ENVIRONMENT?.trim();
  if (!value || value === "local") return "local";
  return value === "staging" || value === "production" ? value : null;
}

/** Everything wrong with a hosted server's configuration (empty when it may start). */
export function hostedEnvironmentProblems(env: Env): string[] {
  const environment = estateOsEnvironment(env);
  if (environment === null) return ["ESTATEOS_ENVIRONMENT must be local, staging or production."];
  if (environment === "local") return [];
  const problems: string[] = [];
  for (const name of EMULATOR_VARIABLES) if (present(env, name)) problems.push(`${name} is set: a hosted server never uses an emulator.`);
  for (const name of LOCAL_ONLY_VARIABLES) if (present(env, name)) problems.push(`${name} is set: it is for local development and tests only.`);

  const serverProject = env.FIREBASE_PROJECT_ID?.trim() ?? "";
  const browserProject = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? "";
  const adminProject = env.FIREBASE_ADMIN_PROJECT_ID?.trim() ?? "";
  if (!serverProject) problems.push("FIREBASE_PROJECT_ID is not set.");
  if (!browserProject) problems.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set.");
  if (serverProject && browserProject && serverProject !== browserProject) problems.push("FIREBASE_PROJECT_ID and NEXT_PUBLIC_FIREBASE_PROJECT_ID name different projects.");
  if (serverProject && adminProject && serverProject !== adminProject) problems.push("FIREBASE_ADMIN_PROJECT_ID names a different project from FIREBASE_PROJECT_ID.");
  if ([serverProject, browserProject].some(project => project.startsWith("demo-"))) problems.push("The Firebase project is an emulator demo project (demo-…).");

  const origin = env.APP_ORIGIN?.trim() ?? "";
  if (!/^https:\/\/[^/\s]+$/i.test(origin)) problems.push("APP_ORIGIN must be the server's https origin (for example https://staging.example.com), without a path.");
  else if (/^https:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin)) problems.push("APP_ORIGIN points at this computer, not the hosted server.");

  // apphosting.<environment>.yaml ships with REPLACE_ME placeholders until the environment's own values are filled in.
  const unfilled = Object.entries(env).filter(([, value]) => value?.includes("REPLACE_ME")).map(([name]) => name).sort();
  if (unfilled.length) problems.push(`Placeholder values are still set (${unfilled.join(", ")}): fill them in apphosting.${environment}.yaml.`);

  if (environment === "staging" && env.INBOX_WHATSAPP_LIVE_SENDING?.trim() === "enabled") problems.push("INBOX_WHATSAPP_LIVE_SENDING is enabled: staging never sends WhatsApp messages to real customers.");
  return problems;
}

/** Stops a hosted server from starting with a wrong configuration. Called once at start-up (src/instrumentation.ts). */
export function assertHostedEnvironment(env: Env = process.env): void {
  const problems = hostedEnvironmentProblems(env);
  if (!problems.length) return;
  const environment = env.ESTATEOS_ENVIRONMENT?.trim() || "unknown";
  console.error(JSON.stringify({event: "estateos.environment_rejected", environment, problems}));
  throw new Error(`EstateOS will not start (${environment}): ${problems.join(" ")}`);
}
