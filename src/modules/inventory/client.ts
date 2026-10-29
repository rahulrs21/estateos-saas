"use client";

import { leadRequest } from "@/modules/leads/client";

interface ApiError { error?: {message?: string} }

export async function uploadInventoryFile(file: File, input: {organizationId: string; parentType: "properties" | "projects" | "floor-plans"; parentId: string; mediaKind: "PROPERTY_PHOTO" | "FLOOR_PLAN" | "BROCHURE" | "DOCUMENT"}) {
  const securityResponse = await fetch("/api/auth/csrf", {credentials: "same-origin", cache: "no-store"});
  const security: ApiError & {csrfToken?: string} = await securityResponse.json();
  if (!securityResponse.ok || !security.csrfToken) throw new Error(security.error?.message || "Could not prepare a secure upload. Reload and try again.");
  const response = await fetch("/api/inventory/media", {
    method: "POST", credentials: "same-origin", cache: "no-store", body: file,
    headers: {
      "Content-Type": file.type, "X-CSRF-Token": security.csrfToken,
      "X-EstateOS-Organization": input.organizationId,
      "X-Inventory-Parent-Type": input.parentType, "X-Inventory-Parent-Id": input.parentId,
      "X-Inventory-Media-Kind": input.mediaKind, "X-File-Name": file.name,
    },
  });
  const result: ApiError & {data?: unknown} = await response.json();
  if (!response.ok || result.data === undefined) throw new Error(result.error?.message || "The file could not be uploaded.");
  return result.data;
}

export function updateInventoryMedia(id: string, input: {organizationId: string; sortOrder: number; isCover: boolean}) {
  return leadRequest(`/api/inventory/media/${id}`, "PATCH", {sortOrder: input.sortOrder, isCover: input.isCover}, input.organizationId);
}

export function deleteInventoryMedia(id: string, organizationId: string) {
  return leadRequest(`/api/inventory/media/${id}`, "POST", {action: "delete"}, organizationId);
}
