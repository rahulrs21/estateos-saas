"use client";

import { useSyncExternalStore } from "react";

/*
 * One shared one-second ticker for every live clock on the page. It renders
 * nothing on the server (null) so server and client markup always match;
 * the time appears right after hydration and then updates every second.
 */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) timer = setInterval(() => listeners.forEach(notify => notify()), 1000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) { clearInterval(timer); timer = undefined; }
  };
}

const currentSecond = () => Math.floor(Date.now() / 1000);
const serverSnapshot = () => null;

/** The current time, updated every second; null during server rendering. */
export function useLiveClock(): Date | null {
  const second = useSyncExternalStore(subscribe, currentSecond, serverSnapshot);
  return second === null ? null : new Date(second * 1000);
}

export const WORKSPACE_TIME_ZONE = "Asia/Dubai";
export const clockDate = new Intl.DateTimeFormat("en-AE", {timeZone: WORKSPACE_TIME_ZONE, weekday: "short", day: "numeric", month: "short"});
export const clockTime = new Intl.DateTimeFormat("en-GB", {timeZone: WORKSPACE_TIME_ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false});
