import { z } from "zod";

/*
 * Meetings (docs/COMMUNICATION_HUB.md#meetings). EstateOS records a meeting
 * and its link; the video call happens in the provider's own app. A link is
 * accepted only over https and on the chosen provider's own hosts (OTHER: any
 * public https host). In-person and phone meetings have no link.
 */

export const MEETING_PROVIDERS = ["GOOGLE_MEET", "MICROSOFT_TEAMS", "ZOOM", "WEBEX", "IN_PERSON", "PHONE", "OTHER"] as const;
export type MeetingProvider = (typeof MEETING_PROVIDERS)[number];
export const MEETING_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const MEETING_PROVIDER_LABELS: Record<MeetingProvider, string> = {
  GOOGLE_MEET: "Google Meet", MICROSOFT_TEAMS: "Microsoft Teams", ZOOM: "Zoom", WEBEX: "Webex", IN_PERSON: "In person", PHONE: "Phone", OTHER: "Other video service",
};
export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {SCHEDULED: "Scheduled", COMPLETED: "Held", CANCELLED: "Cancelled", NO_SHOW: "Customer did not attend"};

/** Hosts per provider: exact names, or a parent domain for its subdomains (".zoom.us"). */
const HOSTS: Partial<Record<MeetingProvider, readonly string[]>> = {
  GOOGLE_MEET: ["meet.google.com"],
  MICROSOFT_TEAMS: ["teams.microsoft.com", "teams.live.com"],
  ZOOM: ["zoom.us", ".zoom.us"],
  WEBEX: [".webex.com"],
};
export const needsLink = (provider: MeetingProvider) => provider !== "IN_PERSON" && provider !== "PHONE";

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|\d{1,3}(\.\d{1,3}){3}|\[.*\])$/i;

/** A problem with a meeting link for the provider, or null when it is acceptable. */
export function meetingLinkProblem(provider: MeetingProvider, link: string | null): string | null {
  if (!needsLink(provider)) return link ? "In-person and phone meetings have no link." : null;
  if (!link) return "Add the meeting link from the provider.";
  let url: URL;
  try { url = new URL(link); } catch { return "Enter a full meeting link, starting with https://."; }
  if (url.protocol !== "https:") return "Meeting links must start with https://.";
  if (url.username || url.password) return "Meeting links cannot contain a user name or password.";
  if (link.length > 490) return "The meeting link is too long.";
  const host = url.hostname.toLowerCase();
  if (PRIVATE_HOST.test(host) || !host.includes(".")) return "Use the provider's public meeting link.";
  const allowed = HOSTS[provider];
  if (allowed && !allowed.some(entry => entry.startsWith(".") ? host.endsWith(entry) : host === entry)) {
    return `This is not a ${MEETING_PROVIDER_LABELS[provider]} link. Check the provider or the link.`;
  }
  return null;
}

const text = (max: number) => z.string().trim().max(max).transform(value => value || null).nullable().optional();
export const meetingInputSchema = z.strictObject({
  title: z.string().trim().min(1).max(160),
  provider: z.enum(MEETING_PROVIDERS),
  meetingUrl: text(500),
  location: text(200),
  startsAt: z.iso.datetime({offset: true}),
  endsAt: z.iso.datetime({offset: true}),
  agenda: text(2000),
}).superRefine((value, context) => {
  const problem = meetingLinkProblem(value.provider, value.meetingUrl ?? null);
  if (problem) context.addIssue({code: "custom", path: ["meetingUrl"], message: problem});
  const start = Date.parse(value.startsAt), end = Date.parse(value.endsAt);
  if (!(end > start)) context.addIssue({code: "custom", path: ["endsAt"], message: "The meeting must end after it starts."});
  else if (end - start > 12 * 3_600_000) context.addIssue({code: "custom", path: ["endsAt"], message: "A meeting can last at most 12 hours."});
});
export type MeetingInput = z.output<typeof meetingInputSchema>;

/** Accepting a meeting suggestion records it once; decisions are kept by suggestion index. */
export type MeetingDecisions = Record<string, {status: "ACCEPTED" | "DISMISSED"; followUpId?: string | null; decidedAt: string}>;
export function parseDecisions(value: string | null | undefined): MeetingDecisions {
  try { const parsed = JSON.parse(value ?? "{}") as unknown; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as MeetingDecisions : {}; } catch { return {}; }
}

export const MEETING_SUMMARY_TASK = `Summarise the notes of this meeting with the customer (written by the agent) in the required JSON format. "Call" in the field names means this meeting. Quote the notes exactly, with their line references.`;
