"use client";

import type { CallHistoryView, CallView } from "./server/calls";

interface ApiError { error?: {code?: string; message?: string} }

export class CommunicationsRequestError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) { super(message); }
}

export type { CallHistoryView, CallView };

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  let body: ApiError & {data?: T} = {};
  try { body = await response.json(); } catch { /* non-JSON error page */ }
  if (!response.ok || body.data === undefined) throw new CommunicationsRequestError(body.error?.message || fallback, body.error?.code || "REQUEST_FAILED", response.status);
  return body.data;
}

export async function communicationsGet<T>(path: string, fallback = "Communications could not be loaded.") {
  return readJson<T>(await fetch(path, {credentials: "same-origin", cache: "no-store"}), fallback);
}

/** Mutations carry the CSRF token and the company the page was opened for; the server checks both. */
export async function communicationsSend<T>(path: string, organizationId: string, method: "POST" | "PUT", body: unknown = {}, fallback = "The request could not be completed.") {
  const csrf = await fetch("/api/auth/csrf", {credentials: "same-origin", cache: "no-store"});
  const token = ((await csrf.json().catch(() => ({}))) as {csrfToken?: string}).csrfToken;
  if (!csrf.ok || !token) throw new CommunicationsRequestError("Could not prepare a secure request. Reload and try again.", "CSRF_UNAVAILABLE", csrf.status);
  return readJson<T>(await fetch(path, {
    method, credentials: "same-origin", cache: "no-store", body: JSON.stringify(body),
    headers: {"X-CSRF-Token": token, "X-EstateOS-Organization": organizationId, "Content-Type": "application/json"},
  }), fallback);
}

export const errorMessage = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60), rest = seconds % 60;
  return minutes ? `${minutes} min ${rest.toString().padStart(2, "0")} s` : `${rest} s`;
}
