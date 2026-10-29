import { getFirebaseAdminStorageBucket } from "@/lib/firebase/admin";
import { getSession } from "@/lib/auth/session";
import { getAppOrigin } from "@/modules/auth/server/config";
import { validateCsrfRequest } from "@/modules/auth/server/request-policy";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { leadErrorResponse } from "@/modules/leads/server/http";
import { getInventoryMediaRecord } from "@/modules/inventory/server/service";

type Context = {params: Promise<{id: string}>};

/** A media record can outlive its stored object (for example lost local emulator files). */
function missingFile(): never {
  throw new WorkspaceError("MEDIA_FILE_MISSING", 404, "This file is missing from storage. Delete the record and upload the file again.");
}

const isNotFound = (error: unknown) => typeof error === "object" && error !== null && "code" in error && (error as {code: unknown}).code === 404;

async function authorizedMedia(request: Request, context: Context) {
  validateCsrfRequest(request, getAppOrigin());
  if (!await getSession()) throw new WorkspaceError("UNAUTHENTICATED", 401, "Sign in to continue.");
  const {id} = await context.params;
  return (await getInventoryMediaRecord(id)).media;
}

export async function GET(request: Request, context: Context) {
  try {
    const media = await authorizedMedia(request, context);
    let bytes: Buffer;
    try { [bytes] = await getFirebaseAdminStorageBucket().file(media.storagePath).download(); }
    catch (error) { if (isNotFound(error)) missingFile(); throw error; }
    const body = new Uint8Array(bytes.byteLength);
    body.set(bytes);
    return new Response(body, {headers: {
      "Content-Type": media.contentType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${media.contentType === "application/pdf" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(media.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    }});
  } catch (error) { return leadErrorResponse(error); }
}

/** Availability check without downloading the file: 200 when stored, 404 when missing. */
export async function HEAD(request: Request, context: Context) {
  try {
    const media = await authorizedMedia(request, context);
    const [exists] = await getFirebaseAdminStorageBucket().file(media.storagePath).exists();
    if (!exists) missingFile();
    return new Response(null, {headers: {"Content-Type": media.contentType, "Cache-Control": "private, no-store"}});
  } catch (error) {
    const response = leadErrorResponse(error);
    return new Response(null, {status: response.status, headers: response.headers});
  }
}
