import { useSyncExternalStore } from "react";
import { Globe, Inbox, Mail, MessageCircle, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHANNEL_LABELS, type InboxChannel } from "../model";

/** Shared pieces of the inbox's mail-client layout: avatars, channel marks and compact dates (Dubai time, like the rest of EstateOS). */

export const CHANNEL_ICONS: Record<InboxChannel, LucideIcon> = {WHATSAPP: MessageCircle, EMAIL: Mail, WEBSITE: Globe, INTERNAL: Inbox};
/** Each channel's colour mark, used beside avatars and in the channel list. */
export const CHANNEL_TONES: Record<InboxChannel, string> = {
  WHATSAPP: "bg-emerald-500 text-white", EMAIL: "bg-sky-500 text-white", WEBSITE: "bg-violet-500 text-white", INTERNAL: "bg-slate-500 text-white",
};
export const CHANNEL_TEXT_TONES: Record<InboxChannel, string> = {
  WHATSAPP: "text-emerald-600 dark:text-emerald-400", EMAIL: "text-sky-600 dark:text-sky-400", WEBSITE: "text-violet-600 dark:text-violet-400", INTERNAL: "text-slate-500",
};

const AVATAR_TONES = [
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", "bg-sky-500/15 text-sky-700 dark:text-sky-300", "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300", "bg-rose-500/15 text-rose-700 dark:text-rose-300", "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300", "bg-orange-500/15 text-orange-700 dark:text-orange-300",
];

/** Up to two initials from a name; nothing for a bare number or address part without letters. */
export function initials(name: string | null | undefined) {
  const words = (name ?? "").replace(/[<>].*$/, "").replace(/@.*$/, "").split(/[\s._-]+/).filter(word => /\p{L}/u.test(word));
  return words.slice(0, 2).map(word => (word.match(/\p{L}/u)?.[0] ?? "").toUpperCase()).join("");
}

function tone(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/** A person's initials in a soft colour, with the channel's mark in the corner. */
export function ContactAvatar({name, channel, size = "md", className}: {name: string | null | undefined; channel?: InboxChannel | null; size?: "sm" | "md" | "lg"; className?: string}) {
  const letters = initials(name);
  const Icon = channel ? CHANNEL_ICONS[channel] : null;
  return <span className={cn("relative inline-flex shrink-0", className)}>
    <span aria-hidden className={cn("flex items-center justify-center rounded-full font-semibold", size === "lg" ? "size-10 text-sm" : size === "sm" ? "size-7 text-[11px]" : "size-9 text-xs", tone(name ?? "?"))}>
      {letters || <UserRound className={size === "sm" ? "size-3.5" : "size-4"} />}
    </span>
    {channel && Icon && <span className={cn("absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full ring-2 ring-card", CHANNEL_TONES[channel])}>
      <Icon aria-label={CHANNEL_LABELS[channel]} className="size-2.5" strokeWidth={2.5} />
    </span>}
  </span>;
}

const ZONE = "Asia/Dubai";
const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", {timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit"}).format(date);
const valid = (value: string | null | undefined) => { const date = new Date(value ?? ""); return Number.isFinite(date.getTime()) ? date : null; };

/** The time of day, "13:28". */
export function clockTime(value: string | null | undefined) {
  const date = valid(value);
  return date ? new Intl.DateTimeFormat("en-GB", {timeZone: ZONE, hour: "2-digit", minute: "2-digit"}).format(date) : "";
}

/** A list date the way mail clients show it: the time today, "Yesterday", "11 Nov" this year, otherwise "11 Nov 2025". */
export function listTime(value: string | null | undefined, now = new Date()) {
  const date = valid(value);
  if (!date) return "";
  if (dayKey(date) === dayKey(now)) return clockTime(value);
  if (dayKey(date) === dayKey(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  const sameYear = dayKey(date).slice(0, 4) === dayKey(now).slice(0, 4);
  return new Intl.DateTimeFormat("en-GB", {timeZone: ZONE, day: "numeric", month: "short", ...(sameYear ? {} : {year: "numeric"})}).format(date);
}

/** The day separator in a chat thread: "Today", "Yesterday" or "Tuesday, 10 November 2026". */
export function dayLabel(value: string | null | undefined, now = new Date()) {
  const date = valid(value);
  if (!date) return "";
  if (dayKey(date) === dayKey(now)) return "Today";
  if (dayKey(date) === dayKey(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", {timeZone: ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric"}).format(date);
}

/** The calendar day a message belongs to (for grouping). */
export const messageDay = (value: string | null | undefined) => { const date = valid(value); return date ? dayKey(date) : ""; };

/** A layout choice remembered on this device (folders collapsed, details shown, reading expanded). Off on the server and until read. */
const preferenceListeners = new Set<() => void>();
function subscribePreference(listener: () => void) {
  preferenceListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => { preferenceListeners.delete(listener); window.removeEventListener("storage", listener); };
}
export function usePreference(key: string): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(subscribePreference, () => { try { return window.localStorage.getItem(key) === "1"; } catch { return false; } }, () => false);
  const set = (next: boolean) => {
    try { window.localStorage.setItem(key, next ? "1" : "0"); } catch { /* storage unavailable */ }
    preferenceListeners.forEach(listener => listener());
  };
  return [value, set];
}
