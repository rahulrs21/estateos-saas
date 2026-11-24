/*
 * First-touch attribution in the visitor's browser (docs/LEAD_ATTRIBUTION_PLAN.md#2-capture-on-every-path).
 * EstateOS's hosted forms and landing pages remember how a visitor first arrived (UTM tags, click IDs, landing page,
 * referring site) for 30 days in this site's own storage, so an enquiry made later or on another page keeps its
 * campaign. Nothing is sent anywhere until the visitor submits an enquiry; there is no third-party tracking.
 * Storage can be blocked or unavailable: every read and write is guarded, and the current page is the fallback.
 */

const KEY = "estateos.first_touch.v1";
const TTL_MS = 30 * 86_400_000;
const PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid", "ttclid"] as const;
type Param = (typeof PARAMS)[number];

export interface Touch {
  utmSource?: string; utmMedium?: string; utmCampaign?: string; utmContent?: string; utmTerm?: string;
  gclid?: string; fbclid?: string; ttclid?: string;
  landingPageUrl?: string; referrer?: string;
}
interface Stored extends Touch { at: number }

const FIELD: Record<Param, keyof Touch> = {
  utm_source: "utmSource", utm_medium: "utmMedium", utm_campaign: "utmCampaign", utm_content: "utmContent", utm_term: "utmTerm",
  gclid: "gclid", fbclid: "fbclid", ttclid: "ttclid",
};
const short = (value: string | null, max = 512) => value ? value.slice(0, max) : undefined;
const hasCampaign = (touch: Touch) => Boolean(touch.utmSource || touch.utmCampaign || touch.gclid || touch.fbclid || touch.ttclid);

/** How the visitor arrived at this page: its URL's tags and click IDs, the page itself (no query) and the referrer. */
export function touchFromLocation(href: string, referrer: string, embedReferrer?: string | null): Touch {
  const url = new URL(href);
  const touch: Touch = {};
  for (const param of PARAMS) { const value = short(url.searchParams.get(param)); if (value) touch[FIELD[param]] = value; }
  // A form embedded with the EstateOS embed code is told the parent page (eo_page) and its referrer (eo_ref).
  const parentPage = url.searchParams.get("eo_page");
  touch.landingPageUrl = short(parentPage && /^https?:\/\//.test(parentPage) ? parentPage : `${url.origin}${url.pathname}`, 2048);
  const ref = embedReferrer ?? url.searchParams.get("eo_ref") ?? referrer;
  if (ref && /^https?:\/\//.test(ref)) touch.referrer = short(ref, 2048);
  return touch;
}

function read(): Stored | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored;
    return stored && typeof stored.at === "number" && Date.now() - stored.at < TTL_MS ? stored : null;
  } catch { return null; }
}

/**
 * Remembers this visit as the first touch if there is none yet (or the stored one has expired), or if this visit came
 * from a campaign and the stored one did not. Returns the touch now in force.
 */
export function recordFirstTouch(): Touch {
  let current: Touch;
  try { current = touchFromLocation(window.location.href, document.referrer); } catch { return {}; }
  const stored = read();
  if (stored && (hasCampaign(stored) || !hasCampaign(current))) return stored;
  try { window.localStorage.setItem(KEY, JSON.stringify({...current, at: Date.now()})); } catch { /* Storage blocked: the current page is used. */ }
  return current;
}

/** What to send with an enquiry: the first touch, or this page when nothing was remembered. */
export function attributionForEnquiry(): Touch {
  const {at: _at, ...touch} = read() ?? {at: 0, ...recordFirstTouch()};
  void _at;
  return touch;
}
