import "server-only";

import { getAuthCookieConfig } from "./cookie-policy";
import { resolveAppOrigin } from "./configuration-policy";

export function authCookies() {
  return getAuthCookieConfig(process.env.NODE_ENV === "production");
}

/** Explicit configuration avoids trusting attacker-controlled Host/forwarded headers. */
export function getAppOrigin(): string {
  return resolveAppOrigin(process.env.APP_ORIGIN, process.env.NODE_ENV === "production");
}
