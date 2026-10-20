import { z } from "zod";
import { canonicalUuid } from "../../modules/organizations/server/identifiers";
import { WorkspaceError } from "../../modules/organizations/server/errors";

export const MAX_WORKSPACE_BODY_BYTES = 16 * 1024;

/** A submitted company is only a stale-form guard; it never grants membership. */
export function assertExpectedOrganization(expected: string | null, trustedOrganizationId: string): void {
  if (!expected || !z.uuid().safeParse(canonicalUuid(expected)).success) {
    throw new WorkspaceError("INVALID_INPUT", 400, "Reload this company workspace before saving changes.");
  }
  if (canonicalUuid(expected) !== canonicalUuid(trustedOrganizationId)) {
    throw new WorkspaceError("ORGANIZATION_CHANGED", 409, "Your selected company changed. Reload the page before saving.");
  }
}

/** Bounded streaming reads also protect requests with a missing/forged length. */
export async function parseWorkspaceJsonRequest(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new WorkspaceError("INVALID_CONTENT_TYPE", 415, "Send this request as JSON.");
  }
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_WORKSPACE_BODY_BYTES)) {
    throw new WorkspaceError("BODY_TOO_LARGE", 413, "This request is too large.");
  }
  let content = "";
  let length = 0;
  const reader = request.body?.getReader();
  if (reader) {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > MAX_WORKSPACE_BODY_BYTES) {
          await reader.cancel();
          throw new WorkspaceError("BODY_TOO_LARGE", 413, "This request is too large.");
        }
        content += decoder.decode(part.value, { stream: true });
      }
      content += decoder.decode();
    } catch (error) {
      if (error instanceof WorkspaceError) throw error;
      throw new WorkspaceError("INVALID_BODY", 400, "The request body is invalid.");
    } finally {
      reader.releaseLock();
    }
  }
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch {
    throw new WorkspaceError("INVALID_BODY", 400, "The request body is invalid.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new WorkspaceError("INVALID_BODY", 400, "Send a JSON object.");
  }
  return parsed as Record<string, unknown>;
}
