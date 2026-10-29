import { cookies } from "next/headers";
import { authJson } from "@/modules/auth/server/http";
import { authCookies, getAppOrigin } from "@/modules/auth/server/config";
import { getSession } from "@/lib/auth/session";
import { getFirebaseAdminStorageBucket } from "@/lib/firebase/admin";
import { AuthRequestError, validateMutationRequest } from "@/modules/auth/server/request-policy";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { leadErrorResponse } from "@/modules/leads/server/http";
import { createInventoryMediaRecord, updateInventoryMediaStatus } from "@/modules/inventory/server/service";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

async function readBoundedBody(request: Request) {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_UPLOAD_BYTES)) {
    throw new AuthRequestError("UPLOAD_TOO_LARGE", 413, "Files must be 20 MB or smaller.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new AuthRequestError("EMPTY_UPLOAD", 400, "Choose a file before uploading.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_UPLOAD_BYTES) {
        await reader.cancel();
        throw new AuthRequestError("UPLOAD_TOO_LARGE", 413, "Files must be 20 MB or smaller.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (!total) throw new AuthRequestError("EMPTY_UPLOAD", 400, "Choose a non-empty file before uploading.");
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), total);
}

function matchesSignature(bytes: Buffer, contentType: string) {
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (contentType === "image/webp") return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (contentType === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  return false;
}

function cleanFileName(value: string | null) {
  const name = (value ?? "").replace(/[\\/\u0000-\u001f\u007f]/g, " ").trim().slice(0, 180);
  if (!name || name === "." || name === "..") throw new AuthRequestError("INVALID_FILE_NAME", 400, "The file name is invalid.");
  return name;
}

export async function POST(request: Request) {
  let created: {id: string; storagePath: string} | null = null;
  try {
    const cookieStore = await cookies();
    validateMutationRequest(request, {origin: getAppOrigin(), csrfToken: cookieStore.get(authCookies().csrf.name)?.value});
    if (!await getSession()) throw new WorkspaceError("UNAUTHENTICATED", 401, "Sign in to continue.");
    const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(contentType)) {
      throw new AuthRequestError("INVALID_FILE_TYPE", 415, "Upload a JPEG, PNG, WebP image or PDF.");
    }
    const parentType = request.headers.get("x-inventory-parent-type");
    const parentId = request.headers.get("x-inventory-parent-id");
    const mediaKind = request.headers.get("x-inventory-media-kind");
    const fileName = cleanFileName(request.headers.get("x-file-name"));
    if (!parentId || !["properties", "projects", "floor-plans"].includes(parentType ?? "")) throw new AuthRequestError("INVALID_MEDIA_PARENT", 400, "Choose a valid inventory record for this file.");
    const image = contentType.startsWith("image/");
    const permittedKinds = parentType === "properties"
      ? ["PROPERTY_PHOTO", "BROCHURE", "DOCUMENT"]
      : parentType === "projects" ? ["BROCHURE", "FLOOR_PLAN", "DOCUMENT"] : ["FLOOR_PLAN", "DOCUMENT"];
    if (!mediaKind || !permittedKinds.includes(mediaKind) || (image && mediaKind === "DOCUMENT")) {
      throw new AuthRequestError("INVALID_MEDIA_KIND", 400, "That file type does not match the selected inventory document type.");
    }
    const bucket = getFirebaseAdminStorageBucket();
    const bytes = await readBoundedBody(request);
    if (!matchesSignature(bytes, contentType)) throw new AuthRequestError("FILE_SIGNATURE_MISMATCH", 415, "The file contents do not match the selected file type.");
    const organizationId = request.headers.get("x-estateos-organization");
    created = await createInventoryMediaRecord({parentType, parentId, fileName, contentType, byteSize: bytes.byteLength, mediaKind}, organizationId);
    try {
      await bucket.file(created.storagePath).save(bytes, {
        resumable: false,
        metadata: {contentType, cacheControl: "private, no-store", metadata: {estateosMediaId: created.id}},
      });
      await updateInventoryMediaStatus(created.id, "PENDING", "ACTIVE", organizationId);
    } catch (error) {
      try { await bucket.file(created.storagePath).delete({ignoreNotFound: true}); } catch { /* cleanup retries use the PENDING row */ }
      try { await updateInventoryMediaStatus(created.id, "PENDING", "DELETED", organizationId); } catch { /* keep the original failure */ }
      throw error;
    }
    return authJson({data: {id: created.id, fileName, mediaKind, contentUrl: `/api/inventory/media/${created.id}/content`}}, 201);
  } catch (error) { return leadErrorResponse(error); }
}

