import { storedMediaResponse } from "@/modules/websites/server/media-stream";
import { publicMediaObject } from "@/modules/websites/server/public";

type Context = {params: Promise<{publicationId: string; mediaId: string}>};

const notFound = () => new Response("Not found", {status: 404, headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}});

/**
 * Images and videos of live landing pages. Only media IDs in the ACTIVE
 * publication's allowlist are served; every other file stays private. The
 * short cache lifetime means an unpublished page's media stop being served
 * within minutes, and the URL changes with every publication. Videos are
 * streamed with byte-range support.
 */
export async function GET(request: Request, context: Context) {
  try {
    const {publicationId, mediaId} = await context.params;
    const asset = await publicMediaObject(publicationId, mediaId);
    if (!asset || !/^(image\/(jpeg|png|webp)|video\/(mp4|webm))$/.test(asset.contentType)) return notFound();
    return await storedMediaResponse(asset.storagePath, asset.contentType, request.headers.get("range"), {
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    });
  } catch {
    return notFound();
  }
}
