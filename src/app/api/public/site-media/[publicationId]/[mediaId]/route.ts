import { getFirebaseAdminStorageBucket } from "@/lib/firebase/admin";
import { publicMediaObject } from "@/modules/websites/server/public";

type Context = {params: Promise<{publicationId: string; mediaId: string}>};

const notFound = () => new Response("Not found", {status: 404, headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}});

/**
 * Images of live landing pages. Only media IDs in the ACTIVE publication's
 * image allowlist are served; every other inventory file stays private. The
 * short cache lifetime means an unpublished page's images stop being served
 * within minutes, and the URL changes with every publication.
 */
export async function GET(_request: Request, context: Context) {
  try {
    const {publicationId, mediaId} = await context.params;
    const asset = await publicMediaObject(publicationId, mediaId);
    if (!asset || !/^image\/(jpeg|png|webp)$/.test(asset.contentType)) return notFound();
    let bytes: Buffer;
    try { [bytes] = await getFirebaseAdminStorageBucket().file(asset.storagePath).download(); } catch { return notFound(); }
    const body = new Uint8Array(bytes.byteLength);
    body.set(bytes);
    return new Response(body, {headers: {
      "Content-Type": asset.contentType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    }});
  } catch {
    return notFound();
  }
}
