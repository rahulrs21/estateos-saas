import { SESSION_MAX_AGE_SECONDS } from "./session-policy";

export const CSRF_MAX_AGE_SECONDS = 60 * 10;

export function getAuthCookieConfig(isProduction: boolean) {
  const base = { httpOnly: true, secure: isProduction, path: "/", sameSite: "strict" } as const;
  return {
    session: {
      name: isProduction ? "__Host-estateos_session" : "estateos_session",
      options: { ...base, maxAge: SESSION_MAX_AGE_SECONDS },
    },
    csrf: {
      name: isProduction ? "__Host-estateos_csrf" : "estateos_csrf",
      options: { ...base, maxAge: CSRF_MAX_AGE_SECONDS },
    },
  };
}
