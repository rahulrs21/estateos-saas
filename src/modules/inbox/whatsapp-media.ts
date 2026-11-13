/*
 * Downloading WhatsApp media (Phase 7B.2, docs/WHATSAPP_INTEGRATION_PLAN.md#media). Pure rules,
 * unit-tested: the download URL Meta returns must be https on Meta's own media hosts
 * (the token is sent to it, so nothing else is ever fetched), tries back off, and
 * media older than Meta keeps it is not tried at all.
 */

export const MEDIA_MAX_ATTEMPTS = 5;
/** Meta keeps media for about 30 days; EstateOS stops trying a little earlier. */
export const MEDIA_MAX_AGE_MS = 25 * 86_400_000;
const MEDIA_HOSTS = /(^|\.)(fbsbx\.com|whatsapp\.net|facebook\.com|fbcdn\.net)$/i;

/** Whether EstateOS may fetch this URL with the WhatsApp token: Meta's https media hosts only (or the local test server). */
export function mediaUrlAllowed(value: string | null | undefined, testOrigin: string | null = null) {
  let url: URL;
  try { url = new URL(value ?? ""); } catch { return false; }
  if (url.username || url.password) return false;
  if (testOrigin && url.origin === testOrigin) return true;
  return url.protocol === "https:" && (url.port === "" || url.port === "443") && MEDIA_HOSTS.test(url.hostname);
}

/** The wait before the next try: a minute, then four times longer each time, at most six hours. */
export const mediaBackoffMs = (attempts: number) => Math.min(6 * 3_600_000, 60_000 * 4 ** Math.max(0, attempts));

/** Shown under a file that is not stored. */
export const MEDIA_ERROR_LABELS: Record<string, string> = {
  EXPIRED: "no longer available from WhatsApp",
  TYPE_NOT_ALLOWED: "file type not allowed",
  TOO_LARGE: "too large (over 25 MB)",
  URL_NOT_ALLOWED: "refused: not a WhatsApp media address",
  NO_TOKEN: "waiting for the channel's access token",
};
