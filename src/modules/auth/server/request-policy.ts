import { timingSafeEqual } from "node:crypto";

export const MAX_SESSION_BODY_BYTES = 16 * 1024;
const CSRF_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export class AuthRequestError extends Error {
  constructor(public readonly code: string, public readonly status: 400 | 403 | 413 | 415, message: string) {
    super(message);
    this.name = "AuthRequestError";
  }
}

function rejectCrossOrigin(request: Request, origin: string, requireOrigin: boolean) {
  const suppliedOrigin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site" || (requireOrigin && !suppliedOrigin) ||
      (suppliedOrigin !== null && suppliedOrigin !== origin)) {
    throw new AuthRequestError("UNTRUSTED_ORIGIN", 403, "This request is not permitted. Reload the page and try again.");
  }
}

export function validateCsrfRequest(request: Request, origin: string): void {
  rejectCrossOrigin(request, origin, false);
}

export function validateMutationRequest(
  request: Request,
  options: { origin: string; csrfToken: string | undefined },
): void {
  rejectCrossOrigin(request, options.origin, true);
  const token = request.headers.get("x-csrf-token");
  if (!token || !options.csrfToken || !CSRF_TOKEN_PATTERN.test(token) ||
      !CSRF_TOKEN_PATTERN.test(options.csrfToken) ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(options.csrfToken))) {
    throw new AuthRequestError("INVALID_CSRF", 403, "Your security token has expired. Reload the page and try again.");
  }
}

/** Read incrementally so an untrusted Content-Length cannot bypass the size limit. */
export async function parseSessionRequest(request: Request): Promise<{ idToken: string }> {
  const mediaType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new AuthRequestError("INVALID_CONTENT_TYPE", 415, "Send this request as JSON.");
  }
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_SESSION_BODY_BYTES)) {
    throw new AuthRequestError("INVALID_BODY", 413, "The sign-in request is too large.");
  }

  let body = "";
  let bytesRead = 0;
  const reader = request.body?.getReader();
  if (reader) {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytesRead += value.byteLength;
        if (bytesRead > MAX_SESSION_BODY_BYTES) {
          await reader.cancel();
          throw new AuthRequestError("INVALID_BODY", 413, "The sign-in request is too large.");
        }
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
    } catch (error) {
      if (error instanceof AuthRequestError) throw error;
      throw new AuthRequestError("INVALID_BODY", 400, "The sign-in request is invalid.");
    } finally {
      reader.releaseLock();
    }
  }

  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch {
    throw new AuthRequestError("INVALID_BODY", 400, "The sign-in request is invalid.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed) ||
      Object.keys(parsed).length !== 1 || !("idToken" in parsed) ||
      typeof parsed.idToken !== "string" || !parsed.idToken.trim() ||
      parsed.idToken.length > MAX_SESSION_BODY_BYTES) {
    throw new AuthRequestError("INVALID_BODY", 400, "Only an ID token is accepted for sign-in.");
  }
  return { idToken: parsed.idToken };
}
