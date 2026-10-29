"use client";

import type { PipelineSummaryView, SalesDashboardView, LeadIntelligenceView } from "./server/service";

interface ApiError { error?: {code?: string; message?: string} }

export class SalesRequestError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) { super(message); }
}

export type { LeadIntelligenceView, PipelineSummaryView, SalesDashboardView };

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  let body: ApiError & {data?: T} = {};
  try { body = await response.json(); } catch { /* non-JSON error page */ }
  if (!response.ok || body.data === undefined) throw new SalesRequestError(body.error?.message || fallback, body.error?.code || "REQUEST_FAILED", response.status);
  return body.data;
}

async function csrfToken() {
  const response = await fetch("/api/auth/csrf", {credentials: "same-origin", cache: "no-store"});
  const body: ApiError & {csrfToken?: string} = await response.json().catch(() => ({}));
  if (!response.ok || !body.csrfToken) throw new SalesRequestError(body.error?.message || "Could not prepare a secure request. Reload and try again.", "CSRF_UNAVAILABLE", response.status);
  return body.csrfToken;
}

export async function salesGet<T>(path: string, fallback = "Sales intelligence could not be loaded.") {
  return readJson<T>(await fetch(path, {credentials: "same-origin", cache: "no-store"}), fallback);
}

/** Mutations carry the CSRF token and the company the page was opened for; the server checks both. */
export async function salesSend<T>(path: string, organizationId: string, method: "POST" | "PUT", body: unknown = {}, fallback = "The request could not be completed.") {
  const token = await csrfToken();
  return readJson<T>(await fetch(path, {
    method, credentials: "same-origin", cache: "no-store", body: JSON.stringify(body),
    headers: {"X-CSRF-Token": token, "X-EstateOS-Organization": organizationId, "Content-Type": "application/json"},
  }), fallback);
}

export const errorMessage = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;
