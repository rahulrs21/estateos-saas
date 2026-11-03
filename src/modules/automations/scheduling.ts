import type { WorkflowDefinition } from "./definition";

/*
 * Schedules, business hours and quiet hours in the workflow's IANA timezone
 * (default Asia/Dubai). Every stored time is UTC; local times are only used to
 * decide whether a moment is allowed. Searching minute by minute in UTC means
 * daylight-saving gaps never produce an invalid timestamp.
 */

type Timing = Pick<WorkflowDefinition, "timeZone" | "businessHours" | "quietHours" | "schedule">;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SEARCH_MINUTES = 8 * 24 * 60;

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return {day: DAYS.indexOf(get("weekday")), time: `${get("hour")}:${get("minute")}`};
}

/** Whether a moment is inside business hours (when set) and outside quiet hours (when set). */
export function withinHours(timing: Timing, at: Date): boolean {
  const {day, time} = localParts(at, timing.timeZone);
  const business = timing.businessHours, quiet = timing.quietHours;
  if (business && (!business.weekdays.includes(day) || time < business.start || time >= business.end)) return false;
  if (quiet && quiet.start !== quiet.end && (quiet.start < quiet.end ? time >= quiet.start && time < quiet.end : time >= quiet.start || time < quiet.end)) return false;
  return true;
}

const nextMinute = (date: Date) => new Date(Math.floor(date.getTime() / 60_000) * 60_000 + 60_000);

/** The first allowed moment at or after a time (within eight days), or null when hours never allow one. */
export function nextAllowedTime(timing: Timing, after: Date): Date | null {
  if (withinHours(timing, after)) return after;
  let candidate = nextMinute(after);
  for (let minute = 0; minute < SEARCH_MINUTES; minute += 1, candidate = nextMinute(candidate)) if (withinHours(timing, candidate)) return candidate;
  return null;
}

/** The next run of a scheduled workflow after a time, or null (a one-time schedule in the past, or no allowed time). */
export function nextScheduledTime(timing: Timing, after: Date): Date | null {
  const schedule = timing.schedule;
  if (!schedule) return null;
  if (schedule.kind === "ONCE") {
    const at = new Date(schedule.at);
    return at.getTime() > after.getTime() ? nextAllowedTime(timing, at) : null;
  }
  let candidate = nextMinute(after);
  for (let minute = 0; minute < SEARCH_MINUTES; minute += 1, candidate = nextMinute(candidate)) {
    const parts = localParts(candidate, timing.timeZone);
    if (parts.time === schedule.time && (schedule.kind === "DAILY" || schedule.weekdays.includes(parts.day)) && withinHours(timing, candidate)) return candidate;
  }
  return null;
}
