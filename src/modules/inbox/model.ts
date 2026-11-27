/*
 * Unified inbox vocabulary (docs/UNIFIED_INBOX.md). Mirrors the enums in
 * dataconnect/schema/inbox.gql; labels are what members see.
 */

export const INBOX_CHANNELS = ["WHATSAPP", "EMAIL", "WEBSITE", "INTERNAL"] as const;
export type InboxChannel = (typeof INBOX_CHANNELS)[number];
export const CHANNEL_LABELS: Record<InboxChannel, string> = {WHATSAPP: "WhatsApp", EMAIL: "Email", WEBSITE: "Website enquiry", INTERNAL: "Internal"};

export const CONVERSATION_STATUSES = ["OPEN", "PENDING", "RESOLVED", "CLOSED"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];
export const STATUS_LABELS: Record<ConversationStatus, string> = {OPEN: "Open", PENDING: "Waiting for the customer", RESOLVED: "Resolved", CLOSED: "Closed"};

export const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<Priority, string> = {LOW: "Low", NORMAL: "Normal", HIGH: "High", URGENT: "Urgent"};

export const MESSAGE_TYPES = ["TEXT", "IMAGE", "DOCUMENT", "AUDIO", "VIDEO", "TEMPLATE", "SYSTEM", "UNKNOWN", "LOCATION", "CONTACTS"] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const DELIVERY_STATUSES = ["DRAFT", "QUEUED", "SENT", "DELIVERED", "READ", "FAILED", "RECEIVED", "UNKNOWN"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
  DRAFT: "Draft", QUEUED: "Queued", SENT: "Sent", DELIVERED: "Delivered", READ: "Read", FAILED: "Failed", RECEIVED: "Received", UNKNOWN: "Unknown status",
};

export const CHANNEL_PROVIDERS = ["WHATSAPP_CLOUD", "GMAIL", "MICROSOFT_365", "WEBSITE_FORM", "INTERNAL", "DEVELOPMENT_SIMULATOR"] as const;
export type ChannelProvider = (typeof CHANNEL_PROVIDERS)[number];
export const PROVIDER_LABELS: Record<ChannelProvider, string> = {
  WHATSAPP_CLOUD: "WhatsApp Business Cloud", GMAIL: "Gmail", MICROSOFT_365: "Microsoft 365", WEBSITE_FORM: "Website forms", INTERNAL: "EstateOS", DEVELOPMENT_SIMULATOR: "Developer simulator",
};
export const PROVIDER_CHANNEL: Record<ChannelProvider, InboxChannel> = {
  WHATSAPP_CLOUD: "WHATSAPP", GMAIL: "EMAIL", MICROSOFT_365: "EMAIL", WEBSITE_FORM: "WEBSITE", INTERNAL: "INTERNAL", DEVELOPMENT_SIMULATOR: "WHATSAPP",
};

/** The list views of the left panel. */
export const INBOX_VIEWS = ["ALL", "UNREAD", "MINE", "UNASSIGNED", "NEEDS_MATCHING", "OPEN", "PENDING", "RESOLVED"] as const;
export type InboxView = (typeof INBOX_VIEWS)[number];
export const VIEW_LABELS: Record<InboxView, string> = {
  ALL: "All conversations", UNREAD: "Unread", MINE: "Assigned to me", UNASSIGNED: "Unassigned", NEEDS_MATCHING: "Needs matching", OPEN: "Open", PENDING: "Pending", RESOLVED: "Resolved",
};

export type Role = "OWNER" | "ADMIN" | "MANAGER" | "AGENT";
