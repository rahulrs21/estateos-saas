import "server-only";

import { NextResponse } from "next/server";
import { recordAuthEvent } from "./audit";
import { AuthRequestError } from "./request-policy";
import { SessionPolicyError } from "./session-policy";
import { classifyAuthConfigurationError } from "./configuration-error";

export const AUTH_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Pragma": "no-cache",
  "X-Content-Type-Options": "nosniff",
};

export function authJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: AUTH_RESPONSE_HEADERS });
}

export function authErrorResponse(error: unknown): NextResponse {
  const configurationError = classifyAuthConfigurationError(error);
  const safeError = configurationError ?? (error instanceof AuthRequestError || error instanceof SessionPolicyError ? error : null);
  const status = safeError?.status ?? 503;
  recordAuthEvent("auth.session.rejected", {
    outcome: status === 401 ? "unauthorized" : status === 403 ? "forbidden" :
      status === 503 ? "unavailable" : "invalid-request",
    ...(configurationError ? { reason: configurationError.reason } : {}),
  });
  return authJson({ error: {
    code: safeError?.code ?? "AUTH_UNAVAILABLE",
    message: safeError?.message ?? "Authentication is temporarily unavailable. Please try again.",
  } }, status);
}
