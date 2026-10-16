"use client";

interface ApiError { error?: { code?: string; message?: string } }

/** Mutations use the existing HttpOnly session and same-origin CSRF exchange. */
export async function leadRequest<T>(path: string, method: "POST" | "PATCH", body: unknown, organizationId: string): Promise<T> {
  const securityResponse = await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
  const security: ApiError & { csrfToken?: string } = await securityResponse.json();
  if (!securityResponse.ok || !security.csrfToken) {
    throw new Error(security.error?.message || "Could not prepare a secure request. Reload and try again.");
  }
  const response = await fetch(path, {
    method, credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": security.csrfToken, "X-EstateOS-Organization": organizationId },
    body: JSON.stringify(body),
  });
  const result: ApiError & { data?: T } = await response.json();
  if (!response.ok || result.data === undefined) {
    throw new Error(result.error?.message || "The change could not be saved. Please try again.");
  }
  return result.data;
}
