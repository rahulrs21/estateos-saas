"use client";

interface ApiResult<T> { data?: T; error?: { code?: string; message?: string } }

export async function companyRequest<T>(path: string, method: "POST" | "PATCH", input: unknown, organizationId?: string): Promise<T> {
  const preparation = await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
  const security: ApiResult<never> & { csrfToken?: string } = await preparation.json();
  if (!preparation.ok || !security.csrfToken) throw new Error(security.error?.message || "Could not prepare a secure request. Reload and try again.");
  const response = await fetch(path, {
    method, credentials: "same-origin", cache: "no-store",
    headers: {
      "Content-Type": "application/json", "X-CSRF-Token": security.csrfToken,
      ...(organizationId ? { "X-EstateOS-Organization": organizationId } : {}),
    },
    body: JSON.stringify(input),
  });
  const result: ApiResult<T> = await response.json();
  if (!response.ok || result.data === undefined) throw new Error(result.error?.message || "Your change could not be saved. Please try again.");
  return result.data;
}
