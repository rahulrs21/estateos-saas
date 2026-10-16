import { WorkspaceError } from "./errors";

/** The Admin SDK uses DATA_CONNECT_EMULATOR_HOST, not a NEXT_PUBLIC variable. */
export function assertSafeDataConnectEnvironment(environment: {
  nodeEnv?: string;
  emulatorHost?: string;
}): void {
  if (!environment.emulatorHost) return;
  if (environment.nodeEnv === "production") {
    throw new WorkspaceError("UNSAFE_CONFIGURATION", 503, "The SQL Connect emulator cannot be used in production.");
  }
  let url: URL;
  try {
    url = new URL(`http://${environment.emulatorHost}`);
  } catch {
    throw new WorkspaceError("UNSAFE_CONFIGURATION", 503, "Configure a valid local SQL Connect emulator address.");
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || !url.port ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new WorkspaceError("UNSAFE_CONFIGURATION", 503, "Configure a valid local SQL Connect emulator address.");
  }
}
