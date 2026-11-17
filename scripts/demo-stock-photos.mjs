import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { STOCK_IMAGES } from "../src/modules/websites/stock.ts";

/*
 * Luxury stock photos for the sample-data properties on STAGING (scripts/seed-demo.mjs --photos stock).
 *
 * The photos come from the website builder's curated library (src/modules/websites/stock.ts): free-license Unsplash
 * photos of UAE residences, interiors and skylines. They are illustrative only (the properties are fictional).
 * Files are fetched from Unsplash's fixed image host only, must be real JPEGs within a size limit, and are cached
 * under .tmp/ so repeated runs download nothing.
 */

export const STOCK_HOST = "https://images.unsplash.com";
const MAX_BYTES = 8 * 1024 * 1024;
const PHOTOS_PER_PROPERTY = 3;

const byTag = tag => STOCK_IMAGES.filter(item => item.tags.includes(tag));
/** Exterior, living space, and a third room or amenity, per kind of home. */
const PLAN = {
  VILLA: [byTag("VILLA"), byTag("POOL"), byTag("LIVING_ROOM")],
  TOWNHOUSE: [byTag("VILLA"), byTag("LIVING_ROOM"), [...byTag("KITCHEN"), ...byTag("POOL")]],
  APARTMENT: [[...byTag("SKYLINE"), ...byTag("MARINA")], byTag("LIVING_ROOM"), [...byTag("BEDROOM"), ...byTag("KITCHEN")]],
};

/** Three photos for a property, chosen deterministically from its type and position (same input, same photos). */
export function stockPhotosFor(propertyType, index) {
  const groups = PLAN[propertyType] ?? PLAN.APARTMENT;
  return groups.slice(0, PHOTOS_PER_PROPERTY).map((group, slot) => {
    if (!group.length) throw new Error(`No stock photos tagged for ${propertyType}, slot ${slot + 1}.`);
    return group[(index + slot * 2) % group.length];
  });
}

/** The fixed-host JPEG address of a catalog photo in landscape 3:2 (never an address from data). */
export function stockPhotoUrl(item, width = 1600) {
  if (!/^[0-9]{10,16}-[0-9a-f]{8,16}$/.test(item.photo)) throw new Error(`Unexpected stock photo id ${item.photo}.`);
  return `${STOCK_HOST}/photo-${item.photo}?auto=format&fit=crop&crop=entropy&w=${width}&h=${Math.round(width * 2 / 3)}&q=80&fm=jpg`;
}

/** True for JPEG bytes (FF D8 FF). */
export const isJpeg = bytes => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

/** Downloads (or reads from the cache) one catalog photo as checked JPEG bytes. */
export async function stockPhotoBytes(item, cacheDir, fetchImpl = fetch) {
  mkdirSync(cacheDir, { recursive: true });
  const cached = join(cacheDir, `${item.id}.jpg`);
  if (existsSync(cached)) {
    const bytes = readFileSync(cached);
    if (isJpeg(bytes)) return bytes;
  }
  const url = stockPhotoUrl(item);
  const response = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Stock photo ${item.id}: HTTP ${response.status}.`);
  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("image/jpeg")) throw new Error(`Stock photo ${item.id}: expected a JPEG, got ${type || "no type"}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) throw new Error(`Stock photo ${item.id}: larger than 8 MB.`);
  if (!isJpeg(bytes)) throw new Error(`Stock photo ${item.id}: the file is not a JPEG.`);
  writeFileSync(cached, bytes);
  return bytes;
}
