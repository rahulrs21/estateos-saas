"use client";

import type { Checklist } from "./checklist";

interface ApiError { error?: {code?: string; message?: string; checklist?: Checklist} }

export class WebsiteRequestError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number, public readonly checklist: Checklist | null = null) { super(message); }
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  let body: ApiError & {data?: T} = {};
  try { body = await response.json(); } catch { /* non-JSON error page */ }
  if (!response.ok || body.data === undefined) {
    throw new WebsiteRequestError(body.error?.message || fallback, body.error?.code || "REQUEST_FAILED", response.status, body.error?.checklist ?? null);
  }
  return body.data;
}

async function csrfToken() {
  const response = await fetch("/api/auth/csrf", {credentials: "same-origin", cache: "no-store"});
  const body: ApiError & {csrfToken?: string} = await response.json().catch(() => ({}));
  if (!response.ok || !body.csrfToken) throw new WebsiteRequestError(body.error?.message || "Could not prepare a secure request. Reload and try again.", "CSRF_UNAVAILABLE", response.status);
  return body.csrfToken;
}

export async function websitesGet<T>(path: string, fallback = "The website builder could not be loaded.") {
  return readJson<T>(await fetch(path, {credentials: "same-origin", cache: "no-store"}), fallback);
}

/** Mutations carry the CSRF token and the company the page was opened for; the server checks both. */
export async function websitesSend<T>(path: string, organizationId: string, method: "POST" | "PUT", body: unknown = {}, fallback = "The request could not be completed.", signal?: AbortSignal) {
  const token = await csrfToken();
  return readJson<T>(await fetch(path, {
    method, credentials: "same-origin", cache: "no-store", body: JSON.stringify(body), signal,
    headers: {"X-CSRF-Token": token, "X-EstateOS-Organization": organizationId, "Content-Type": "application/json"},
  }), fallback);
}

export const errorMessage = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft", IN_REVIEW: "In review", APPROVED: "Approved", PUBLISHED: "Published", UNPUBLISHED: "Unpublished", ARCHIVED: "Archived",
};

/** Uploads an image to the company's website library (raw body; the server checks type, size and signature). */
export async function websitesUpload<T>(file: File, organizationId: string, signal?: AbortSignal) {
  const token = await csrfToken();
  return readJson<T>(await fetch("/api/websites/media", {
    method: "POST", credentials: "same-origin", cache: "no-store", body: file, signal,
    headers: {"X-CSRF-Token": token, "X-EstateOS-Organization": organizationId, "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name.slice(0, 160))},
  }), "The image could not be uploaded.");
}

export async function websitesDelete<T>(path: string, organizationId: string, fallback = "The request could not be completed.") {
  const token = await csrfToken();
  return readJson<T>(await fetch(path, {
    method: "DELETE", credentials: "same-origin", cache: "no-store", body: "{}",
    headers: {"X-CSRF-Token": token, "X-EstateOS-Organization": organizationId, "Content-Type": "application/json"},
  }), fallback);
}
