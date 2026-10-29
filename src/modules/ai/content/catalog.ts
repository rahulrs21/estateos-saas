/**
 * AI Content Studio catalog (docs/AI_CONTENT_STUDIO.md). Pure data shared by
 * the server, the browser and tests: content types, their purposes, the
 * editable output fields of each type, languages, tones, audiences and the
 * source records each purpose needs.
 */

export const CONTENT_TYPES = ["PROPERTY_DESCRIPTION", "PROJECT_MARKETING", "WHATSAPP_MESSAGE", "EMAIL", "SOCIAL_MEDIA", "ADVERTISING", "CLIENT_PROPOSAL"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_LANGUAGES = ["EN", "AR", "EN_AR"] as const;
export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number];
export type ContentLocale = "en" | "ar";

export const CONTENT_TONES = ["PROFESSIONAL", "FRIENDLY", "LUXURY", "CONCISE", "PERSUASIVE", "INFORMATIVE"] as const;
export type ContentTone = (typeof CONTENT_TONES)[number];

export const CONTENT_AUDIENCES = ["GENERAL", "BUYERS", "TENANTS", "INVESTORS", "FAMILIES", "PROFESSIONALS", "FIRST_TIME_BUYERS", "LUXURY_BUYERS"] as const;
export type ContentAudience = (typeof CONTENT_AUDIENCES)[number];

export const CONTENT_LENGTHS = ["SHORT", "STANDARD", "LONG"] as const;
export type ContentLength = (typeof CONTENT_LENGTHS)[number];

export const DRAFT_STATUSES = ["DRAFT", "IN_REVIEW", "APPROVED", "ARCHIVED"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const MAX_PROPOSAL_LISTINGS = 5;

export type SourceKind = "property" | "listing" | "project" | "lead";

/**
 * Sources a purpose needs. `oneOf` groups mean at least one of the kinds is
 * required; `lead` means a lead is required; `listings` means 1–5 listings.
 */
export interface SourceRule {
  oneOf?: SourceKind[];
  lead?: boolean;
  listings?: boolean;
  /** Kinds the purpose can use at all; anything else is rejected. */
  allowed: SourceKind[];
}

export interface PurposeDefinition { label: string; sources: SourceRule }

export type FieldKind = "line" | "text" | "list" | "adVariants" | "proposalProperties";

export interface FieldDefinition {
  key: string;
  label: string;
  kind: FieldKind;
  /** Upper bound enforced by Zod on generated and edited content. */
  max: number;
  description: string;
}

export interface ContentTypeDefinition {
  label: string;
  description: string;
  purposes: Record<string, PurposeDefinition>;
  fields: FieldDefinition[];
  /** Roles without inventory access (managers) can use the type when it needs no inventory. */
  needsInventory: boolean;
}

const ANY_SOURCE: SourceKind[] = ["property", "listing", "project", "lead"];
const inventory = (...kinds: SourceKind[]): SourceRule => ({oneOf: kinds, allowed: kinds});

const line = (key: string, label: string, description: string, max = 300): FieldDefinition => ({key, label, kind: "line", max, description});
const text = (key: string, label: string, description: string, max = 6000): FieldDefinition => ({key, label, kind: "text", max, description});
const list = (key: string, label: string, description: string, max = 400): FieldDefinition => ({key, label, kind: "list", max, description});

export const CONTENT_CATALOG: Record<ContentType, ContentTypeDefinition> = {
  PROPERTY_DESCRIPTION: {
    label: "Property description",
    description: "Listing title, descriptions, highlights and a call to action from one property or listing.",
    needsInventory: true,
    purposes: {LISTING_DESCRIPTION: {label: "Listing description", sources: inventory("listing", "property")}},
    fields: [
      line("listingTitle", "Listing title", "A factual listing headline."),
      text("shortDescription", "Short description", "Two or three sentences.", 1200),
      text("detailedDescription", "Detailed description", "Several paragraphs built only from the verified facts."),
      list("keyHighlights", "Key highlights", "Short factual bullet points."),
      text("amenitiesSummary", "Amenities summary", "Only amenities listed in the facts; say none are recorded if the list is empty.", 1500),
      text("locationDescription", "Location description", "Community, area and emirate from the facts. No distances, travel times or nearby attractions.", 1500),
      line("callToAction", "Call to action", "For buyers or renters, using approved contact details only."),
    ],
  },
  PROJECT_MARKETING: {
    label: "Project marketing",
    description: "Brochure-ready project copy, payment plan and handover summaries from a project record.",
    needsInventory: true,
    purposes: {PROJECT_OVERVIEW: {label: "Project marketing pack", sources: {oneOf: ["project"], allowed: ["project"]}}},
    fields: [
      text("projectIntroduction", "Project introduction", "An opening overview.", 2500),
      text("developerOverview", "Developer overview", "Only from the developer record; say it is not recorded otherwise.", 2000),
      list("projectHighlights", "Project highlights", "Factual bullet points."),
      text("propertyTypes", "Property types", "Unit types, bedrooms and price ranges exactly as in the facts.", 2000),
      text("paymentPlanOverview", "Payment plan overview", "Only recorded percentages and triggers; never invent a plan.", 2500),
      text("handoverInformation", "Handover information", "Only recorded dates and construction status.", 1500),
      text("brochureText", "Brochure-ready text", "Longer marketing copy for a brochure (text only)."),
      text("launchAnnouncement", "Launch announcement", "A short announcement; no invented launch dates or offers.", 2500),
    ],
  },
  WHATSAPP_MESSAGE: {
    label: "WhatsApp draft",
    description: "Editable message drafts in short, professional and friendly versions. Nothing is sent.",
    needsInventory: false,
    purposes: {
      NEW_LEAD_INTRODUCTION: {label: "New lead introduction", sources: {lead: true, allowed: ANY_SOURCE}},
      PROPERTY_RECOMMENDATION: {label: "Property recommendation", sources: {oneOf: ["listing", "property"], allowed: ANY_SOURCE}},
      ENQUIRY_FOLLOW_UP: {label: "Follow-up after enquiry", sources: {lead: true, allowed: ANY_SOURCE}},
      VIEWING_CONFIRMATION: {label: "Viewing confirmation", sources: {lead: true, allowed: ANY_SOURCE}},
      VIEWING_REMINDER: {label: "Viewing reminder", sources: {lead: true, allowed: ANY_SOURCE}},
      POST_VIEWING_FOLLOW_UP: {label: "Post-viewing follow-up", sources: {lead: true, allowed: ANY_SOURCE}},
      PROJECT_LAUNCH: {label: "Project launch announcement", sources: {oneOf: ["project"], allowed: ANY_SOURCE}},
      RE_ENGAGEMENT: {label: "Customer re-engagement", sources: {lead: true, allowed: ANY_SOURCE}},
    },
    fields: [
      text("shortVersion", "Short version", "One or two short sentences.", 700),
      text("professionalVersion", "Professional version", "Polite and businesslike.", 1500),
      text("friendlyVersion", "Friendly version", "Warm and conversational, still professional.", 1500),
    ],
  },
  EMAIL: {
    label: "Email draft",
    description: "Subject, preview text, body and call to action. Nothing is sent.",
    needsInventory: false,
    purposes: {
      ENQUIRY_RESPONSE: {label: "Property enquiry response", sources: {lead: true, allowed: ANY_SOURCE}},
      PROPERTY_RECOMMENDATION: {label: "Property recommendation", sources: {oneOf: ["listing", "property"], allowed: ANY_SOURCE}},
      VIEWING_CONFIRMATION: {label: "Viewing confirmation", sources: {lead: true, allowed: ANY_SOURCE}},
      FOLLOW_UP: {label: "Follow-up email", sources: {lead: true, allowed: ANY_SOURCE}},
      PROJECT_LAUNCH: {label: "Project launch email", sources: {oneOf: ["project"], allowed: ANY_SOURCE}},
      CLIENT_PROPOSAL: {label: "Client property proposal email", sources: {oneOf: ["listing", "property"], allowed: ANY_SOURCE}},
    },
    fields: [
      line("subject", "Subject", "A clear subject line.", 200),
      line("previewText", "Preview text", "Inbox preview text.", 250),
      text("body", "Body", "Plain-text email body with paragraphs."),
      line("callToAction", "Call to action", "One action using approved contact details only."),
    ],
  },
  SOCIAL_MEDIA: {
    label: "Social media",
    description: "Captions, a LinkedIn update, a short video script and hashtags.",
    needsInventory: true,
    purposes: {
      PROPERTY_ANNOUNCEMENT: {label: "Property announcement", sources: inventory("listing", "property")},
      PROJECT_UPDATE: {label: "Project update", sources: inventory("project")},
    },
    fields: [
      text("instagramCaption", "Instagram caption", "Caption without hashtags.", 2200),
      text("facebookCaption", "Facebook caption", "Caption without hashtags.", 2500),
      text("linkedinUpdate", "LinkedIn update", "Professional update.", 3000),
      text("reelScript", "Short video / reel script", "Scene-by-scene script with on-screen text and voice-over.", 3000),
      text("propertyAnnouncement", "Announcement post", "A short general announcement.", 1500),
      list("hashtags", "Hashtags", "Relevant hashtags, each starting with #.", 60),
    ],
  },
  ADVERTISING: {
    label: "Advertising copy",
    description: "Editable ad copy variants. No campaign is created or published.",
    needsInventory: true,
    purposes: {
      META: {label: "Meta ads (Facebook and Instagram)", sources: inventory("listing", "property", "project")},
      GOOGLE_SEARCH: {label: "Google Search ads", sources: inventory("listing", "property", "project")},
      TIKTOK: {label: "TikTok ads", sources: inventory("listing", "property", "project")},
      LINKEDIN: {label: "LinkedIn ads", sources: inventory("listing", "property", "project")},
    },
    fields: [{key: "variants", label: "Ad variants", kind: "adVariants", max: 600, description: "Distinct copy variants."}],
  },
  CLIENT_PROPOSAL: {
    label: "Client proposal",
    description: "Compare up to five listings for a client, with verified references.",
    needsInventory: true,
    purposes: {PROPOSAL: {label: "Client property proposal", sources: {listings: true, allowed: ["listing", "lead"]}}},
    fields: [
      text("introduction", "Introduction", "A short opening.", 2000),
      text("comparisonSummary", "Comparison summary", "How the options compare, using only verified facts.", 4000),
      {key: "properties", label: "Properties", kind: "proposalProperties", max: 2000, description: "One entry per listing, in the given order."},
      text("nextSteps", "Suggested next steps", "Practical next steps such as arranging viewings.", 2000),
    ],
  },
};

export const AD_VARIANT_FIELDS = ["primaryText", "headlines", "descriptions", "callToAction"] as const;
export const PROPOSAL_PROPERTY_FIELDS = ["reference", "summary", "priceAndSpecifications", "locationHighlights", "advantages"] as const;

export const TONE_LABELS: Record<ContentTone, string> = {
  PROFESSIONAL: "Professional", FRIENDLY: "Friendly", LUXURY: "Luxury", CONCISE: "Concise", PERSUASIVE: "Persuasive", INFORMATIVE: "Informative",
};
export const AUDIENCE_LABELS: Record<ContentAudience, string> = {
  GENERAL: "General", BUYERS: "Buyers", TENANTS: "Tenants", INVESTORS: "Investors", FAMILIES: "Families", PROFESSIONALS: "Working professionals",
  FIRST_TIME_BUYERS: "First-time buyers", LUXURY_BUYERS: "Luxury buyers",
};
export const LANGUAGE_LABELS: Record<ContentLanguage, string> = {EN: "English", AR: "Arabic", EN_AR: "English + Arabic"};
export const LENGTH_LABELS: Record<ContentLength, string> = {SHORT: "Short", STANDARD: "Standard", LONG: "Long"};
export const STATUS_LABELS: Record<DraftStatus, string> = {DRAFT: "Draft", IN_REVIEW: "In review", APPROVED: "Approved internally", ARCHIVED: "Archived"};

export function localesFor(language: ContentLanguage): ContentLocale[] {
  return language === "EN" ? ["en"] : language === "AR" ? ["ar"] : ["en", "ar"];
}

export function isContentType(value: unknown): value is ContentType {
  return typeof value === "string" && (CONTENT_TYPES as readonly string[]).includes(value);
}

export function purposeFor(type: ContentType, purpose: string): PurposeDefinition | null {
  return Object.hasOwn(CONTENT_CATALOG[type].purposes, purpose) ? CONTENT_CATALOG[type].purposes[purpose] : null;
}

export interface SourceSelection { propertyId?: string; listingId?: string; projectId?: string; leadId?: string; listingIds?: string[] }

/** Checks a selection against the purpose's rule; returns a user-facing problem or null. */
export function sourceProblem(type: ContentType, purpose: string, selection: SourceSelection): string | null {
  const definition = purposeFor(type, purpose);
  if (!definition) return "Choose a valid purpose for this content type.";
  const rule = definition.sources;
  const chosen: SourceKind[] = [];
  if (selection.propertyId) chosen.push("property");
  if (selection.listingId) chosen.push("listing");
  if (selection.projectId) chosen.push("project");
  if (selection.leadId) chosen.push("lead");
  const listingCount = selection.listingIds?.length ?? 0;
  if (rule.listings) {
    if (listingCount < 1 || listingCount > MAX_PROPOSAL_LISTINGS) return `Choose between 1 and ${MAX_PROPOSAL_LISTINGS} listings for a proposal.`;
    if (selection.listingId || selection.propertyId || selection.projectId) return "A proposal uses the selected listings only.";
  } else if (listingCount) {
    return "Multiple listings can only be used for client proposals.";
  }
  const disallowed = chosen.find(kind => !rule.allowed.includes(kind));
  if (disallowed) return `A ${disallowed} cannot be used for ${definition.label.toLowerCase()}.`;
  if (rule.lead && !selection.leadId) return `Choose a lead for ${definition.label.toLowerCase()}.`;
  if (rule.oneOf && !rule.oneOf.some(kind => chosen.includes(kind))) {
    return `Choose a ${rule.oneOf.join(" or ")} for ${definition.label.toLowerCase()}.`;
  }
  if (selection.propertyId && selection.listingId) return "Choose either a property or one of its listings, not both.";
  return null;
}
