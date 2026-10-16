import { cookies } from "next/headers";
import { connection } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { recordAuthEvent } from "@/modules/auth/server/audit";
import { authCookies, getAppOrigin } from "@/modules/auth/server/config";
import { authErrorResponse, authJson } from "@/modules/auth/server/http";
import { parseSessionRequest, validateMutationRequest } from "@/modules/auth/server/request-policy";
import { exchangeSessionToken, revokeAuthenticationSession } from "@/modules/auth/server/session-core";
import { getSession } from "@/modules/auth/server/session";
import { SessionPolicyError } from "@/modules/auth/server/session-policy";

export async function GET() {
  // Keep Next.js prerender control flow outside application error handling.
  await connection();
  try {
    const user = await getSession();
    if (!user) throw new SessionPolicyError("UNAUTHENTICATED", 401, "Sign in to continue.");
    return authJson({ user });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const config = authCookies();
    const cookieStore = await cookies();
    validateMutationRequest(request, {
      origin: getAppOrigin(), csrfToken: cookieStore.get(config.csrf.name)?.value,
    });
    const { idToken } = await parseSessionRequest(request);
    const { cookie, user } = await exchangeSessionToken(idToken, getFirebaseAdminAuth());
    const response = authJson({ user });
    response.cookies.set(config.session.name, cookie, config.session.options);
    response.cookies.set(config.csrf.name, "", { ...config.csrf.options, maxAge: 0 });
    recordAuthEvent("auth.session.created", { uid: user.uid, outcome: "success" });
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const config = authCookies();
    const cookieStore = await cookies();
    validateMutationRequest(request, {
      origin: getAppOrigin(), csrfToken: cookieStore.get(config.csrf.name)?.value,
    });
    const cookie = cookieStore.get(config.session.name)?.value;
    // An absent cookie needs neither credentials nor a Firebase request.
    const user = cookie ? await revokeAuthenticationSession(cookie, getFirebaseAdminAuth()) : null;
    const response = authJson({ success: true });
    response.cookies.set(config.session.name, "", { ...config.session.options, maxAge: 0 });
    response.cookies.set(config.csrf.name, "", { ...config.csrf.options, maxAge: 0 });
    recordAuthEvent("auth.session.logout", { outcome: "success", ...(user ? { uid: user.uid } : {}) });
    return response;
  } catch (error) {
    // Preserve the cookie on a service failure so the user can retry revocation.
    return authErrorResponse(error);
  }
}
