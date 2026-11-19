/*
 * Checks for website library uploads, kept free of server imports so they
 * can be unit tested. The upload route also limits size while streaming.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const UPLOAD_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"} as const;
export type UploadType = keyof typeof UPLOAD_TYPES;

/** Background and section videos: short muted loops, played by every current browser. */
export const MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024;
export const VIDEO_UPLOAD_TYPES = {"video/mp4": "mp4", "video/webm": "webm"} as const;
export type VideoUploadType = keyof typeof VIDEO_UPLOAD_TYPES;
export type MediaUploadType = UploadType | VideoUploadType;

export const isImageUploadType = (value: string): value is UploadType => Object.hasOwn(UPLOAD_TYPES, value);
export const isVideoUploadType = (value: string): value is VideoUploadType => Object.hasOwn(VIDEO_UPLOAD_TYPES, value);
export const uploadExtension = (type: MediaUploadType) => isVideoUploadType(type) ? VIDEO_UPLOAD_TYPES[type] : UPLOAD_TYPES[type];
export const uploadByteLimit = (type: MediaUploadType) => isVideoUploadType(type) ? MAX_VIDEO_UPLOAD_BYTES : MAX_UPLOAD_BYTES;

// ISO media brands of still images (HEIF/AVIF), which share MP4's `ftyp` box.
const STILL_IMAGE_BRANDS = new Set(["avif", "avis", "heic", "heix", "heim", "heis", "mif1", "msf1"]);

/** MP4: an `ftyp` box that is not a still-image brand. WebM: an EBML header with the `webm` document type. */
export function matchesVideoSignature(bytes: Buffer, contentType: VideoUploadType) {
  if (contentType === "video/mp4") return bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp" && !STILL_IMAGE_BRANDS.has(bytes.toString("ascii", 8, 12));
  return bytes.length >= 8 && bytes.readUInt32BE(0) === 0x1a45dfa3 && bytes.subarray(0, 64).includes("webm");
}

/**
 * One byte range of a Range header for a file of `size` bytes. Null means
 * "send the whole file" (no header, another unit, several ranges or a
 * malformed value, which HTTP allows a server to ignore); "unsatisfiable"
 * means the range starts past the end (416).
 */
export function parseByteRange(header: string | null, size: number): {start: number; end: number} | "unsatisfiable" | null {
  const match = header?.trim().match(/^bytes=(\d*)-(\d*)$/i);
  if (!match || (!match[1] && !match[2])) return null;
  if (!match[1]) {
    const suffix = Number(match[2]);
    return suffix > 0 && size > 0 ? {start: Math.max(0, size - suffix), end: size - 1} : "unsatisfiable";
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : Infinity;
  if (!Number.isSafeInteger(start) || end < start) return null;
  if (start >= size) return "unsatisfiable";
  return {start, end: Math.min(end, size - 1)};
}

export function matchesImageSignature(bytes: Buffer, contentType: UploadType) {
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}

/** Width and height from the file header, without decoding the image. Null when the header is not recognised. */
export function imageDimensions(bytes: Buffer, contentType: UploadType): {width: number; height: number} | null {
  const valid = (width: number, height: number) => width > 0 && height > 0 && width <= 30_000 && height <= 30_000 ? {width, height} : null;
  try {
    if (contentType === "image/png") return bytes.length >= 24 ? valid(bytes.readUInt32BE(16), bytes.readUInt32BE(20)) : null;
    if (contentType === "image/webp") {
      const chunk = bytes.toString("ascii", 12, 16);
      if (chunk === "VP8X") return valid(1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3));
      if (chunk === "VP8 ") return valid(bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff);
      if (chunk === "VP8L") { const bits = bytes.readUInt32LE(21); return valid((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1); }
      return null;
    }
    // JPEG: walk the segments to the first start-of-frame marker.
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return valid(bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5));
      offset += 2 + length;
    }
    return null;
  } catch { return null; }
}

/** A safe display name: no path, control or markup characters. */
export function cleanUploadName(raw: string | null, contentType: MediaUploadType) {
  let decoded = "";
  try { decoded = decodeURIComponent(raw ?? ""); } catch { decoded = ""; }
  const base = decoded.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f<>"'`]/g, "").trim().slice(0, 160);
  return base || `${isVideoUploadType(contentType) ? "video" : "image"}.${uploadExtension(contentType)}`;
}
