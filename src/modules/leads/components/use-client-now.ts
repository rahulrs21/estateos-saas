"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};
let loadedAt = 0;

/**
 * "Now", read only in the browser after hydration (0 on the server and while
 * hydrating), so time-based styling such as "overdue" never makes the server
 * and browser markup differ.
 */
export function useClientNow() {
  return useSyncExternalStore(subscribeNever, () => (loadedAt ||= Date.now()), () => 0);
}
