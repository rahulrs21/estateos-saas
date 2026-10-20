import * as React from "react"

// Use the same query as the desktop CSS; its inverse has no fractional-width gap.
const DESKTOP_MEDIA_QUERY = "(min-width: 768px)"

function subscribe(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY)
  mediaQuery.addEventListener("change", onStoreChange)
  return () => mediaQuery.removeEventListener("change", onStoreChange)
}

function getSnapshot() {
  return !window.matchMedia(DESKTOP_MEDIA_QUERY).matches
}

function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
