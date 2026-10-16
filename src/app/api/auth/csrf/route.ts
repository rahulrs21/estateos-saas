import { randomBytes } from "node:crypto";
import { connection } from "next/server";
import { authCookies, getAppOrigin } from "@/modules/auth/server/config";
import { authErrorResponse, authJson } from "@/modules/auth/server/http";
import { validateCsrfRequest } from "@/modules/auth/server/request-policy";

export async function GET(request: Request) {
  await connection();
  try {
    validateCsrfRequest(request, getAppOrigin());
    const csrfToken = randomBytes(32).toString("base64url");
    const response = authJson({ csrfToken });
    const config = authCookies().csrf;
    response.cookies.set(config.name, csrfToken, config.options);
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
