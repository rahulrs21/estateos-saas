import "server-only";

import { Readable } from "node:stream";
import { getFirebaseAdminStorageBucket } from "@/lib/firebase/admin";
import { parseByteRange } from "../uploads";

/**
 * The response body for a stored website image or video. Images are sent
 * whole. Videos are streamed and honour a single byte range (206), which
 * Safari needs to play them and every browser uses to seek and loop,
 * without holding the file in memory. Throws when the object is missing.
 */
export async function storedMediaResponse(storagePath: string, contentType: string, range: string | null, headers: Record<string, string>) {
  const file = getFirebaseAdminStorageBucket().file(storagePath);
  if (!contentType.startsWith("video/")) {
    const [bytes] = await file.download();
    const body = new Uint8Array(bytes.byteLength);
    body.set(bytes);
    return new Response(body, {headers: {...headers, "Content-Type": contentType, "Content-Length": String(bytes.byteLength)}});
  }
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size);
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error("The stored video has no size.");
  const base = {...headers, "Content-Type": contentType, "Accept-Ranges": "bytes"};
  const byteRange = parseByteRange(range, size);
  if (byteRange === "unsatisfiable") return new Response(null, {status: 416, headers: {...base, "Content-Range": `bytes */${size}`}});
  const {start, end} = byteRange ?? {start: 0, end: size - 1};
  const stream = Readable.toWeb(file.createReadStream(byteRange ? {start, end, validation: false} : {})) as unknown as ReadableStream<Uint8Array>;
  return new Response(stream, {
    status: byteRange ? 206 : 200,
    headers: {...base, "Content-Length": String(end - start + 1), ...(byteRange ? {"Content-Range": `bytes ${start}-${end}/${size}`} : {})},
  });
}
