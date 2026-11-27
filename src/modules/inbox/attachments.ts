/*
 * Inbox attachment rules (docs/INBOX_SECURITY.md#attachments). A file is
 * accepted only when its content matches an allowed type: the name and the
 * declared type are never trusted. Office documents are ZIP or OLE containers,
 * so for those the extension must agree with the container as well.
 * Malware scanning is an integration point only in Phase 7A (NOT_SCANNED).
 */

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** Types shown in the chat, not only downloaded (as EstateOS's content check found them, never the sender's claim). Phase 7G.1 adds players for voice notes, audio and video. */
export const INLINE_TYPES = {
  image: ["image/jpeg", "image/png", "image/webp"],
  audio: ["audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav"],
  video: ["video/mp4"],
} as const;
export const isInlineType = (mimeType: string) => Object.values(INLINE_TYPES).some(types => (types as readonly string[]).includes(mimeType));

export interface AttachmentType { mimeType: string; extension: string; label: string }

const ZIP_OFFICE: Record<string, AttachmentType> = {
  docx: {mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: "docx", label: "Word document"},
  xlsx: {mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx", label: "Excel workbook"},
  pptx: {mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", extension: "pptx", label: "PowerPoint presentation"},
};
const OLE_OFFICE: Record<string, AttachmentType> = {
  doc: {mimeType: "application/msword", extension: "doc", label: "Word document"},
  xls: {mimeType: "application/vnd.ms-excel", extension: "xls", label: "Excel workbook"},
};

const starts = (bytes: Uint8Array, signature: readonly number[], offset = 0) => bytes.length >= offset + signature.length && signature.every((value, index) => bytes[offset + index] === value);
const ascii = (bytes: Uint8Array, start: number, end: number) => bytes.length >= end ? String.fromCharCode(...bytes.subarray(start, end)) : "";

/** The attachment type its content proves, or null (rejected). */
export function sniffAttachment(bytes: Uint8Array, fileName: string): AttachmentType | null {
  const extension = fileName.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1] ?? "";
  if (starts(bytes, [0xff, 0xd8, 0xff])) return {mimeType: "image/jpeg", extension: "jpg", label: "JPEG image"};
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return {mimeType: "image/png", extension: "png", label: "PNG image"};
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return {mimeType: "image/webp", extension: "webp", label: "WebP image"};
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") return {mimeType: "image/gif", extension: "gif", label: "GIF image"};
  if (ascii(bytes, 0, 5) === "%PDF-") return {mimeType: "application/pdf", extension: "pdf", label: "PDF document"};
  if (starts(bytes, [0x50, 0x4b, 0x03, 0x04])) return ZIP_OFFICE[extension] ?? null;
  if (starts(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return OLE_OFFICE[extension] ?? null;
  if (ascii(bytes, 0, 4) === "OggS") return {mimeType: "audio/ogg", extension: "ogg", label: "Voice note"};
  if (ascii(bytes, 0, 3) === "ID3" || starts(bytes, [0xff, 0xfb]) || starts(bytes, [0xff, 0xf3]) || starts(bytes, [0xff, 0xf2])) return {mimeType: "audio/mpeg", extension: "mp3", label: "Audio"};
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WAVE") return {mimeType: "audio/wav", extension: "wav", label: "Audio"};
  if (ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12);
    return brand.startsWith("M4A") ? {mimeType: "audio/mp4", extension: "m4a", label: "Audio"} : {mimeType: "video/mp4", extension: "mp4", label: "Video"};
  }
  return null;
}

/** A display name only (never a path): no separators or control characters, bounded, with the proven extension. */
export function attachmentFileName(name: string | null | undefined, type: AttachmentType) {
  const base = (name ?? "").replace(/[\\/\u0000-\u001f\u007f<>:"|?*]/g, " ").replace(/\s+/g, " ").trim().replace(/\.[a-z0-9]{1,5}$/i, "").slice(0, 150);
  return `${base && base !== "." && base !== ".." ? base : "attachment"}.${type.extension}`;
}

/** Private bucket path, built here from IDs only. */
export const attachmentPath = (organizationId: string, attachmentId: string, extension: string) => `organizations/${organizationId}/inbox/attachments/${attachmentId}.${extension}`;
