import type { PortalConnectionStatusCode } from "./types";

export const connectionStatusLabels: Record<PortalConnectionStatusCode, string> = {
  NOT_CONFIGURED: "Not configured", PENDING_APPROVAL: "Pending approval", CONNECTED: "Connected", ERROR: "Error", DISABLED: "Disabled",
};
export const connectionStatusDescriptions: Record<PortalConnectionStatusCode, string> = {
  NOT_CONFIGURED: "No integration has been requested for this portal.",
  PENDING_APPROVAL: "Integration access has been requested and is awaiting the provider's approval.",
  CONNECTED: "A server-side check verified the connection.",
  ERROR: "The last server-side verification failed.",
  DISABLED: "Exports to this portal are turned off for your company.",
};
export const connectionStatusClassName: Record<PortalConnectionStatusCode, string> = {
  NOT_CONFIGURED: "border-border text-muted-foreground",
  PENDING_APPROVAL: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  CONNECTED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  ERROR: "border-destructive/40 bg-destructive/10 text-destructive",
  DISABLED: "border-border bg-muted text-muted-foreground",
};
export const mappingKeyLabels: Record<string, string> = {
  PROPERTY_TYPE: "Property type", LISTING_PURPOSE: "Transaction type", FURNISHING: "Furnishing", EMIRATE: "Emirate", AGENT_ID: "Agent portal ID",
};
export const publicationStateLabels: Record<string, string> = {
  NOT_PUBLISHED: "Not published", VALIDATION_FAILED: "Validation failed", READY: "Ready to export", QUEUED: "Queued",
  PUBLISHED: "Published", FAILED: "Failed", REMOVAL_REQUESTED: "Removal requested", REMOVED: "Removed",
};
export const humanize = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^./, character => character.toUpperCase());
