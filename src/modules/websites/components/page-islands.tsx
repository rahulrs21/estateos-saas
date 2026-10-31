"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, LoaderCircle, MapPin, Send } from "lucide-react";
import type { CaptureFieldKey } from "../../lead-capture/validation";
import { MapCanvas } from "../../maps/components/map-canvas";
import type { LinkedData } from "../linked";
import type { PageFormView } from "../types";

/*
 * Interactive parts of a landing page. They receive only the public-safe
 * shapes the renderer gets (never CRM records) and make no CRM API calls;
 * the enquiry form posts to the page's own public endpoint, which resolves
 * the company and the lead form on the server.
 */

const inputClass = "h-11 w-full rounded-[calc(var(--pg-radius)*0.6)] border border-[var(--pg-border)] bg-[var(--pg-bg)] px-3 text-sm text-[var(--pg-fg)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--pg-accent)]";

export function PageEnquiryForm({form, endpoint, submitLabel, pageTitle}: {form: PageFormView; endpoint: string | null; submitLabel: string; pageTitle: string}) {
  const prefix = useId();
  const startedAt = useRef(0);
  const idempotencyKey = useRef("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(false);
  useEffect(() => { startedAt.current = Date.now(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!endpoint) { setMessage("This is a preview. Enquiries are sent only from the published page."); return; }
    if (pending || completed) return;
    setPending(true); setMessage("");
    try {
      const data = new FormData(event.currentTarget);
      const values: Record<string, string | number> = {};
      for (const field of form.fields) {
        const value = String(data.get(field.key) ?? "").trim();
        if (!value && !field.required) continue;
        values[field.key] = field.key === "BUDGET_MIN" || field.key === "BUDGET_MAX" ? Number(value) : value;
      }
      const url = new URL(window.location.href);
      const pick = (key: string) => url.searchParams.get(key) || undefined;
      idempotencyKey.current ||= crypto.randomUUID().replaceAll("-", "");
      const response = await fetch(endpoint, {
        method: "POST", credentials: "omit", cache: "no-store",
        headers: {"Content-Type": "application/json", "Idempotency-Key": idempotencyKey.current},
        body: JSON.stringify({
          fields: values, consent: data.get("consent") === "on", honeypot: String(data.get("companyWebsite") ?? ""),
          elapsedMs: startedAt.current ? Math.max(0, Date.now() - startedAt.current) : 0,
          attribution: {utmSource: pick("utm_source"), utmMedium: pick("utm_medium"), utmCampaign: pick("utm_campaign"), utmContent: pick("utm_content"), utmTerm: pick("utm_term")},
        }),
      });
      const result = await response.json().catch(() => ({})) as {data?: {message?: string}; error?: {message?: string}};
      if (!response.ok) throw new Error(result.error?.message || "We couldn’t send your enquiry. Please try again.");
      setCompleted(true);
      setMessage(result.data?.message || form.successMessage);
      idempotencyKey.current = "";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn’t send your enquiry. Please try again.");
    } finally { setPending(false); }
  }

  const field = (item: PageFormView["fields"][number]) => {
    const id = `${prefix}-${item.key.toLowerCase()}`;
    const label = <label htmlFor={id} className="text-sm font-medium">{item.label}{item.required ? <span aria-hidden="true"> *</span> : null}</label>;
    const common = {id, name: item.key, required: item.required, "aria-required": item.required};
    const wide = item.key === "MESSAGE" || item.key === "PROPERTY_INTEREST" || item.key === "FULL_NAME";
    let control;
    if (item.key === "MESSAGE" || item.key === "PROPERTY_INTEREST") control = <textarea {...common} maxLength={item.key === "MESSAGE" ? 4000 : 500} className={`${inputClass} min-h-24 py-2`} />;
    else if (item.key === "TRANSACTION_TYPE") control = <select {...common} className={inputClass}><option value="">Choose one</option><option value="BUY">Buy</option><option value="RENT">Rent</option><option value="INVEST">Invest</option></select>;
    else {
      const type = item.key === "EMAIL" ? "email" : item.key === "PHONE" ? "tel" : item.key.startsWith("BUDGET") ? "number" : "text";
      const autoComplete: Partial<Record<CaptureFieldKey, string>> = {FULL_NAME: "name", EMAIL: "email", PHONE: "tel"};
      control = <input {...common} type={type} autoComplete={autoComplete[item.key]} maxLength={item.key === "EMAIL" ? 254 : item.key === "PHONE" ? 32 : 160} min={type === "number" ? 0 : undefined} className={inputClass} />;
    }
    return <div key={item.key} className={`space-y-1.5 ${wide ? "@xl:col-span-2" : ""}`}>{label}{control}</div>;
  };

  if (completed) return <div role="status" className="rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] p-6 text-sm leading-6">{message}</div>;
  return <form onSubmit={submit} aria-busy={pending} aria-label={`Enquiry about ${pageTitle}`} className="@container space-y-4 rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] p-5 text-[var(--pg-fg)] @md:p-7">
    <div className="grid gap-4 @xl:grid-cols-2">{form.fields.map(field)}</div>
    <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true"><label htmlFor={`${prefix}-website`}>Company website</label><input id={`${prefix}-website`} name="companyWebsite" type="text" tabIndex={-1} autoComplete="off" /></div>
    <label className="flex items-start gap-3 text-sm leading-5"><input className="mt-0.5 size-4 shrink-0 accent-[var(--pg-accent)]" type="checkbox" name="consent" required /><span>{form.consentText} <a href={form.privacyPolicyUrl} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">Privacy policy</a></span></label>
    {message && <p role="alert" className="rounded-md border border-[var(--pg-border)] p-3 text-sm">{message}</p>}
    <button type="submit" disabled={pending} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--pg-button-radius)] bg-[var(--pg-accent)] px-5 text-sm font-semibold text-[var(--pg-accent-fg)] transition-opacity hover:opacity-90 disabled:opacity-60">
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}{submitLabel}
    </button>
    {!endpoint && <p className="text-center text-xs opacity-70">Preview only: this form does not send enquiries.</p>}
  </form>;
}

/**
 * The location panel always works without a map. The interactive map loads
 * only when a visitor asks for it, so a page view never triggers a paid map
 * load by itself. HIDDEN locations have no coordinates here at all, and
 * APPROXIMATE ones only the generalized grid point.
 */
export function PageLocationMap({location, showMap, title}: {location: NonNullable<LinkedData["location"]>; showMap: boolean; title: string}) {
  const [open, setOpen] = useState(false);
  const {display} = location;
  const point = display.precision !== "NONE" && display.latitude != null && display.longitude != null;
  return <div className="space-y-3">
    <div className="flex items-start gap-3 rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] p-4">
      <MapPin className="mt-0.5 size-5 shrink-0 text-[var(--pg-accent)]" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{location.text || "Location available on request"}</p>
        <p className="text-sm text-[var(--pg-muted-fg)]">{display.precision === "APPROXIMATE" ? "Approximate area shown for privacy." : display.precision === "NONE" ? "The exact location is shared on request." : "Location shown on the map."}</p>
        {location.mapsUrl && <a href={location.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-2">Open in Google Maps<ExternalLink className="size-3.5" aria-hidden="true" /></a>}
      </div>
    </div>
    {showMap && point && (open
      ? <MapCanvas label={`Map of ${title}`} className="h-72 @3xl:h-96" fit="initial"
        markers={[{id: "location", latitude: display.latitude!, longitude: display.longitude!, title, precision: display.precision === "EXACT" ? "EXACT" : "APPROXIMATE", radiusMeters: display.radiusMeters}]}
        unavailable="The interactive map is unavailable. Use the location details above." />
      : <button type="button" onClick={() => setOpen(true)} className="flex h-40 w-full items-center justify-center gap-2 rounded-[var(--pg-radius)] border border-dashed border-[var(--pg-border)] bg-[var(--pg-muted)] text-sm font-medium">
        <MapPin className="size-4" aria-hidden="true" />Show interactive map
      </button>)}
  </div>;
}

const DAY = 86_400_000;

/** Counts down to midnight Dubai time (UTC+4) on the recorded date. Renders the date first, then the live count. */
export function PageCountdown({date}: {date: string}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 60_000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, []);
  const target = Date.parse(`${date}T00:00:00+04:00`);
  const label = new Intl.DateTimeFormat("en-GB", {day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dubai"}).format(new Date(target));
  if (now === null || target <= now) return <p className="text-lg font-semibold">{label}</p>;
  const remaining = target - now;
  const parts = [["Days", Math.floor(remaining / DAY)], ["Hours", Math.floor((remaining % DAY) / 3_600_000)], ["Minutes", Math.floor((remaining % 3_600_000) / 60_000)]] as const;
  return <div className="space-y-2">
    <div className="flex flex-wrap justify-center gap-3" role="timer" aria-label={`Time until ${label}`}>
      {parts.map(([name, value]) => <div key={name} className="min-w-20 rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] px-4 py-3 text-center">
        <span className="block text-3xl font-semibold tabular-nums">{value}</span><span className="text-xs uppercase tracking-wider opacity-75">{name}</span>
      </div>)}
    </div>
    <p className="text-sm opacity-80">{label}</p>
  </div>;
}

export interface LightboxImage { url: string; srcSet: string | null; alt: string }

/**
 * The full-screen photo viewer of a gallery. Gallery photos are plain links
 * to the image (so they still work without JavaScript); this island opens
 * them in a dialog with next and previous buttons, arrow keys, Escape and
 * swiping. It receives only the image URLs the page already shows.
 */
export function PageLightbox({group, images}: {group: string; images: LightboxImage[]}) {
  const [index, setIndex] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const close = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const count = images.length;
  useEffect(() => {
    const open = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const link = (event.target as HTMLElement | null)?.closest?.("[data-lightbox-group]");
      if (!link || link.getAttribute("data-lightbox-group") !== group) return;
      event.preventDefault();
      opener.current = link as HTMLElement;
      setIndex(Math.max(0, Math.min(count - 1, Number(link.getAttribute("data-lightbox-index")) || 0)));
    };
    document.addEventListener("click", open);
    return () => document.removeEventListener("click", open);
  }, [group, count]);
  useEffect(() => {
    if (index === null) return;
    close.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIndex(null);
      else if (event.key === "ArrowRight") setIndex(current => current === null ? null : (current + 1) % count);
      else if (event.key === "ArrowLeft") setIndex(current => current === null ? null : (current - 1 + count) % count);
    };
    window.addEventListener("keydown", keys);
    return () => { window.removeEventListener("keydown", keys); document.body.style.overflow = previous; };
  }, [index, count]);
  useEffect(() => { if (index === null) opener.current?.focus(); }, [index]);
  if (index === null || !images[index]) return null;
  const image = images[index];
  const go = (delta: number) => setIndex((index + delta + count) % count);
  const arrow = "absolute top-1/2 z-10 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white backdrop-blur hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white";
  // Rendered on the body: the page's container-query wrapper would otherwise contain a fixed element.
  return createPortal(<div role="dialog" aria-modal="true" aria-label={`Photo ${index + 1} of ${count}`} className="fixed inset-0 z-[200] flex flex-col bg-black/95 font-sans text-white"
    onClick={event => { if (event.target === event.currentTarget) setIndex(null); }}
    onTouchStart={event => { touchX.current = event.touches[0]?.clientX ?? null; }}
    onTouchEnd={event => { const start = touchX.current; const end = event.changedTouches[0]?.clientX; touchX.current = null; if (start !== null && end !== undefined && Math.abs(end - start) > 50) go(end < start ? 1 : -1); }}>
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span className="tabular-nums text-white/80">{index + 1} / {count}</span>
      <button ref={close} type="button" onClick={() => setIndex(null)} aria-label="Close the photo viewer" className="flex size-10 items-center justify-center rounded-full text-2xl hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white">×</button>
    </div>
    <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4 md:px-20" onClick={event => { if (event.target === event.currentTarget) setIndex(null); }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- the same approved image URLs the gallery shows */}
      <img key={image.url} src={image.url} srcSet={image.srcSet ?? undefined} sizes="100vw" alt={image.alt} className="max-h-full max-w-full rounded-md object-contain shadow-2xl" />
      {count > 1 && <>
        <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className={`${arrow} left-3`}>‹</button>
        <button type="button" onClick={() => go(1)} aria-label="Next photo" className={`${arrow} right-3`}>›</button>
      </>}
    </div>
    {image.alt && <p className="px-4 pb-4 text-center text-sm text-white/75">{image.alt}</p>}
  </div>, document.body);
}
