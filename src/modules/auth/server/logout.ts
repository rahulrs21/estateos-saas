import "server-only";

import { cookies } from "next/headers";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { recordAuthEvent } from "./audit";
import { authCookies, getAppOrigin } from "./config";
import { authErrorResponse, authJson } from "./http";
import { validateMutationRequest } from "./request-policy";
import { revokeAuthenticationSession } from "./session-core";

/** Both logout endpoints share revocation, CSRF and cookie clearing behavior. */
export async function logoutResponse(request: Request) {
  try {
    const config = authCookies();
    const cookieStore = await cookies();
    validateMutationRequest(request, { origin: getAppOrigin(), csrfToken: cookieStore.get(config.csrf.name)?.value });
    const cookie = cookieStore.get(config.session.name)?.value;
    const user = cookie ? await revokeAuthenticationSession(cookie, getFirebaseAdminAuth()) : null;
    const response = authJson({ success: true });
    response.cookies.set(config.session.name, "", { ...config.session.options, maxAge: 0 });
    response.cookies.set(config.csrf.name, "", { ...config.csrf.options, maxAge: 0 });
    recordAuthEvent("auth.session.logout", { outcome: "success", ...(user ? { uid: user.uid } : {}) });
    return response;
  } catch (error) {
    // Do not claim revocation succeeded during a provider outage; allow a retry.
    return authErrorResponse(error);
  }
}
