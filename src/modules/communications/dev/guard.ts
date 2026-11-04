/*
 * Developer tools (docs/COMMUNICATION_TESTING.md) exist only when ALL of these
 * hold, so a single mistaken variable cannot expose them:
 * - NODE_ENV is not "production" (checked first, whatever else is set);
 * - ESTATEOS_DEV_TOOLS is exactly "1";
 * - the SQL Connect emulator is in use on a loopback address;
 * - the Firebase project is a local demo project ("demo-…").
 * Hosted environments never run the emulator or a demo project.
 */
export function devToolsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.NODE_ENV === "production") return false;
  if (env.ESTATEOS_DEV_TOOLS !== "1") return false;
  const host = env.DATA_CONNECT_EMULATOR_HOST;
  if (!host || !/^(127\.0\.0\.1|localhost|\[::1\]):\d{2,5}$/.test(host)) return false;
  return /^demo-[a-z0-9-]{1,40}$/.test(env.GCLOUD_PROJECT ?? "");
}
