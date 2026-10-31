import { z } from "zod";
import { isWithinUae, roundCoordinate } from "../maps/geo";
import { isStockImageId, isStockVideoId } from "./stock";

/**
 * The landing page component registry (docs/PAGE_COMPONENT_REGISTRY.md).
 *
 * A page is structured data, never markup: a theme chosen from design tokens
 * and an ordered list of sections. Each section has a registered type, a
 * variant from that type's list, layout, style and device options from fixed
 * enums (plus validated #rrggbb colours), and props validated by the type's
 * strict Zod schema. Unknown types, unknown keys, HTML, scripts, URLs, CSS
 * and event handlers are rejected: text fields are plain text, buttons name an
 * action (never a URL), and images and videos are either media IDs of the
 * page's CRM records or IDs from the curated stock catalogue (stock.ts).
 *
 * CRM values (prices, availability, payment plans, unit types, permits,
 * locations, CRM photos) are not props. They are linked data resolved from
 * the source records with the viewer's permissions (see linked.ts).
 *
 * Fields added after the first release carry defaults, so stored pages from
 * earlier versions still validate (PAGE_SCHEMA_VERSION stays 1).
 */

export const PAGE_SCHEMA_VERSION = 1;
export const MAX_SECTIONS = 40;

// Plain text only: no angle brackets (so no HTML or script tags), no control
// characters other than tab and newlines, no script-like URL schemes.
const UNSAFE_TEXT = /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|(?:java|vb)script\s*:|data\s*:\s*text\/html/i;
export const isSafeText = (value: string) => !UNSAFE_TEXT.test(value);

export const plainText = (max: number, min = 0) => z.string().trim().min(min).max(max)
  .refine(isSafeText, "Use plain text only. HTML, scripts and links cannot be added to a page.");

/** A colour is only ever a validated #rrggbb value, applied through React style objects. */
export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #1a2b3c.").transform(value => value.toLowerCase());

export const DESIGN_STYLES = ["LUXURY_MINIMALIST", "PREMIUM_DARK", "MODERN_CORPORATE", "ELEGANT_LIGHT", "CONTEMPORARY", "HIGH_CONVERSION"] as const;
export type DesignStyle = (typeof DESIGN_STYLES)[number];
export const DESIGN_STYLE_LABELS: Record<DesignStyle, string> = {
  LUXURY_MINIMALIST: "Luxury Minimalist", PREMIUM_DARK: "Premium Dark", MODERN_CORPORATE: "Modern Corporate",
  ELEGANT_LIGHT: "Elegant Light", CONTEMPORARY: "Contemporary Real Estate", HIGH_CONVERSION: "High-Conversion Campaign",
};

export const ACCENTS = ["GOLD", "NAVY", "EMERALD", "TEAL", "TERRACOTTA", "SLATE", "ROSE", "INDIGO"] as const;
export type Accent = (typeof ACCENTS)[number];
export const FONTS = ["SANS", "SERIF", "DISPLAY"] as const;
/** Self-hosted web fonts (next/font, downloaded at build time; no third-party requests from visitors). */
export const FONT_FAMILIES = ["PLAYFAIR", "CORMORANT", "DM_SERIF", "INTER", "MANROPE", "MONTSERRAT", "POPPINS", "SYSTEM"] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];
export const FONT_FAMILY_LABELS: Record<FontFamily, string> = {
  PLAYFAIR: "Playfair Display", CORMORANT: "Cormorant Garamond", DM_SERIF: "DM Serif Display", INTER: "Inter", MANROPE: "Manrope",
  MONTSERRAT: "Montserrat", POPPINS: "Poppins", SYSTEM: "System default",
};
export const SCALES = ["COMPACT", "COMFORTABLE", "LARGE"] as const;
export const RADII = ["NONE", "SOFT", "ROUND"] as const;
export const BUTTON_SHAPES = ["ROUNDED", "PILL", "SQUARE"] as const;

export const themeSchema = z.strictObject({
  style: z.enum(DESIGN_STYLES),
  accent: z.enum(ACCENTS),
  font: z.enum(FONTS),
  scale: z.enum(SCALES),
  radius: z.enum(RADII),
  customAccent: hexColor.nullable().default(null),
  headingFont: z.enum(FONT_FAMILIES).nullable().default(null),
  bodyFont: z.enum(FONT_FAMILIES).nullable().default(null),
  /** Global button shape (Site style). */
  buttonShape: z.enum(BUTTON_SHAPES).default("ROUNDED"),
});
export type PageTheme = z.infer<typeof themeSchema>;

export const CTA_ACTIONS = ["ENQUIRE", "WHATSAPP", "CALL", "EMAIL", "GALLERY", "LOCATION"] as const;
export type CtaAction = (typeof CTA_ACTIONS)[number];
export const CTA_ACTION_LABELS: Record<CtaAction, string> = {
  ENQUIRE: "Scroll to the enquiry form", WHATSAPP: "Open WhatsApp (approved company number)", CALL: "Call (approved company phone)",
  EMAIL: "Email (approved company email)", GALLERY: "Scroll to the gallery", LOCATION: "Scroll to the location",
};
export const ctaSchema = z.strictObject({label: plainText(40, 1), action: z.enum(CTA_ACTIONS)});
export type Cta = z.infer<typeof ctaSchema>;

/** A CRM photo of the page's linked records, a photo from the stock catalogue, or an image uploaded to the company's website library. */
export const imageRefSchema = z.union([
  z.strictObject({mediaId: z.uuid(), alt: plainText(160)}),
  z.strictObject({stockId: z.string().max(60).refine(isStockImageId, "Choose a photo from the stock library."), alt: plainText(160)}),
  z.strictObject({uploadId: z.uuid(), alt: plainText(160)}),
]);
export type ImageRef = z.infer<typeof imageRefSchema>;
export type CrmImageRef = {mediaId: string; alt: string};
export const isStockImageRef = (ref: ImageRef): ref is {stockId: string; alt: string} => "stockId" in ref;
export const isUploadImageRef = (ref: ImageRef): ref is {uploadId: string; alt: string} => "uploadId" in ref;
export const isCrmImageRef = (ref: ImageRef): ref is CrmImageRef => "mediaId" in ref;

export const CUSTOM_LOCATION_MODES = ["EXACT", "APPROXIMATE"] as const;
const coordinate = z.number().finite().transform(roundCoordinate);
export const customLocationSchema = z.strictObject({
  label: plainText(120), address: plainText(300), latitude: coordinate, longitude: coordinate,
  mode: z.enum(CUSTOM_LOCATION_MODES),
}).refine(location => isWithinUae(location.latitude, location.longitude), "Place the pin inside the UAE.");
export type CustomLocation = z.infer<typeof customLocationSchema>;

export const videoRefSchema = z.strictObject({stockId: z.string().max(60).refine(isStockVideoId, "Choose a video from the stock library.")});
export type VideoRef = z.infer<typeof videoRefSchema>;

export const HIGHLIGHT_ICONS = ["STAR", "BUILDING", "KEY", "WALLET", "CALENDAR", "MAP_PIN", "SHIELD", "SPARKLES", "WAVES", "TREES", "DUMBBELL", "CAR"] as const;
export const LANDMARK_CATEGORIES = ["TRANSPORT", "SCHOOL", "HEALTHCARE", "SHOPPING", "LEISURE", "BUSINESS", "BEACH", "OTHER"] as const;
export const COUNTDOWN_TARGETS = ["LAUNCH_DATE", "HANDOVER_DATE"] as const;
/** Stats either copy a CRM value (resolved at render time, never typed) or show staff text. */
export const STAT_SOURCES = ["CUSTOM", "STARTING_PRICE", "HANDOVER", "PAYMENT_PLAN", "BEDROOMS", "UNITS", "SIZE", "DEVELOPER", "LOCATION", "PROPERTY_TYPE", "CONSTRUCTION"] as const;
export type StatSource = (typeof STAT_SOURCES)[number];
export const STAT_SOURCE_LABELS: Record<StatSource, string> = {
  CUSTOM: "Custom text", STARTING_PRICE: "Starting / asking price (CRM)", HANDOVER: "Handover date (CRM)", PAYMENT_PLAN: "Payment plan (CRM)",
  BEDROOMS: "Bedrooms (CRM)", UNITS: "Total units (CRM)", SIZE: "Built-up area (CRM)", DEVELOPER: "Developer (CRM)", LOCATION: "Location (CRM)",
  PROPERTY_TYPE: "Property types (CRM)", CONSTRUCTION: "Construction status (CRM)",
};

const columns = z.union([z.literal(2), z.literal(3), z.literal(4)]);
const optionalImage = imageRefSchema.nullable().default(null);

export const SECTION_TYPES = [
  "NAVBAR", "HERO", "STATS", "PROJECT_OVERVIEW", "FEATURE_SPLIT", "DEVELOPER", "HIGHLIGHTS", "GALLERY", "VIDEO_SHOWCASE", "UNIT_TYPES", "PRICING",
  "PAYMENT_PLANS", "FLOOR_PLANS", "AMENITIES", "LOCATION", "LANDMARKS", "COMPARISON", "BANNER", "ENQUIRY_FORM", "WHATSAPP_CTA", "CALL_CTA",
  "CONTACT", "TESTIMONIALS", "FAQ", "COUNTDOWN", "CUSTOM", "FOOTER",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

const PROPS = {
  NAVBAR: z.strictObject({brandText: plainText(80), showLinks: z.boolean(), cta: ctaSchema.nullable(), sticky: z.boolean(),
    /** A logo image instead of the brand text, shown at this height in px. */
    logo: optionalImage, logoHeight: z.number().int().min(20).max(96).default(40),
    /** Menu links to sections of this page; empty uses the automatic list. Only sections shown on the page are linked. */
    links: z.array(z.strictObject({label: plainText(40, 1), sectionId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,40}$/, "Invalid section.")})).max(8).default([]),
    linksAlign: z.enum(["LEFT", "CENTER", "RIGHT"]).default("CENTER"),
    /** The approved company phone beside the button. */
    showPhone: z.boolean().default(false),
    /** A menu button on phones and tablets that opens the links. */
    mobileMenu: z.boolean().default(true)}),
  HERO: z.strictObject({
    eyebrow: plainText(60), headline: plainText(120, 1), subheadline: plainText(300),
    primaryCta: ctaSchema, secondaryCta: ctaSchema.nullable(), image: imageRefSchema.nullable(),
    showPrice: z.boolean(), showLocation: z.boolean(),
    badge: plainText(40).default(""), showFacts: z.boolean().default(false),
  }),
  STATS: z.strictObject({
    heading: plainText(120).default(""),
    items: z.array(z.strictObject({source: z.enum(STAT_SOURCES), value: plainText(40), label: plainText(60, 1)})).max(6),
  }),
  PROJECT_OVERVIEW: z.strictObject({heading: plainText(120, 1), body: plainText(2000), showFacts: z.boolean(), eyebrow: plainText(60).default(""), image: optionalImage}),
  FEATURE_SPLIT: z.strictObject({
    eyebrow: plainText(60), heading: plainText(120, 1), body: plainText(1200), bullets: z.array(plainText(120, 1)).max(6),
    image: imageRefSchema.nullable(), imageSide: z.enum(["LEFT", "RIGHT"]), cta: ctaSchema.nullable(),
  }),
  DEVELOPER: z.strictObject({heading: plainText(120, 1), body: plainText(1000)}),
  HIGHLIGHTS: z.strictObject({
    heading: plainText(120, 1), intro: plainText(400), columns,
    items: z.array(z.strictObject({title: plainText(60, 1), text: plainText(200), icon: z.enum(HIGHLIGHT_ICONS)})).max(8),
    eyebrow: plainText(60).default(""),
  }),
  GALLERY: z.strictObject({heading: plainText(120), intro: plainText(300), columns, images: z.array(imageRefSchema).max(24), eyebrow: plainText(60).default(""),
    /** Clicking a photo opens a full-screen viewer. */
    lightbox: z.boolean().default(true)}),
  VIDEO_SHOWCASE: z.strictObject({eyebrow: plainText(60), heading: plainText(120), body: plainText(600), video: videoRefSchema.nullable(), poster: imageRefSchema.nullable()}),
  UNIT_TYPES: z.strictObject({heading: plainText(120, 1), intro: plainText(400)}),
  PRICING: z.strictObject({heading: plainText(120, 1), intro: plainText(400), note: plainText(300)}),
  PAYMENT_PLANS: z.strictObject({heading: plainText(120, 1), intro: plainText(400), eyebrow: plainText(60).default("")}),
  FLOOR_PLANS: z.strictObject({heading: plainText(120, 1), intro: plainText(400)}),
  AMENITIES: z.strictObject({heading: plainText(120, 1), intro: plainText(400), columns, eyebrow: plainText(60).default("")}),
  LOCATION: z.strictObject({heading: plainText(120, 1), body: plainText(800), showMap: z.boolean(), eyebrow: plainText(60).default(""),
    /** A location set on the page itself, used instead of the linked record's. APPROXIMATE points are generalized before publication. */
    custom: customLocationSchema.nullable().default(null)}),
  // Staff-entered and verified; Claude never writes landmarks. No distance field: distances are not stored data.
  LANDMARKS: z.strictObject({
    heading: plainText(120, 1), intro: plainText(400), verified: z.boolean(),
    items: z.array(z.strictObject({name: plainText(80, 1), category: z.enum(LANDMARK_CATEGORIES), note: plainText(120)})).max(12),
  }),
  COMPARISON: z.strictObject({heading: plainText(120, 1), intro: plainText(400), listingIds: z.array(z.uuid()).max(4)}),
  BANNER: z.strictObject({eyebrow: plainText(60), heading: plainText(160, 1), body: plainText(400), cta: ctaSchema.nullable(), secondaryCta: ctaSchema.nullable()}),
  ENQUIRY_FORM: z.strictObject({heading: plainText(120, 1), intro: plainText(400), submitLabel: plainText(40, 1), image: optionalImage, points: z.array(plainText(80, 1)).max(4).default([])}),
  WHATSAPP_CTA: z.strictObject({heading: plainText(120, 1), body: plainText(300), buttonLabel: plainText(40, 1), prefilledMessage: plainText(300)}),
  CALL_CTA: z.strictObject({heading: plainText(120, 1), body: plainText(300), buttonLabel: plainText(40, 1)}),
  /** Approved company contacts and, optionally, a company member's agent card (resolved on the server; only the membership ID is stored). */
  CONTACT: z.strictObject({
    eyebrow: plainText(60), heading: plainText(120, 1), intro: plainText(400),
    showPhone: z.boolean(), showEmail: z.boolean(), showWhatsapp: z.boolean(), showAddress: z.boolean(), showHours: z.boolean(),
    agentId: z.uuid().nullable(), cta: ctaSchema.nullable(),
  }),
  // Staff-entered only, published only after the publisher confirms consent; Claude never writes testimonials.
  TESTIMONIALS: z.strictObject({
    heading: plainText(120, 1), consentConfirmed: z.boolean(),
    items: z.array(z.strictObject({quote: plainText(500, 1), author: plainText(80, 1), context: plainText(80)})).max(6),
  }),
  FAQ: z.strictObject({heading: plainText(120, 1), items: z.array(z.strictObject({question: plainText(200, 1), answer: plainText(1000, 1)})).max(12)}),
  COUNTDOWN: z.strictObject({heading: plainText(120, 1), body: plainText(300), target: z.enum(COUNTDOWN_TARGETS)}),
  /** Rows of up to four columns of widgets, built in the editor (docs/PAGE_COMPONENT_REGISTRY.md#custom-sections). */
  CUSTOM: z.strictObject({rows: z.lazy(() => customRowsSchema)}),
  FOOTER: z.strictObject({disclaimer: plainText(1000), showContacts: z.boolean()}),
} satisfies Record<SectionType, z.ZodType>;

export type SectionProps<T extends SectionType> = z.infer<(typeof PROPS)[T]>;

export const SECTION_GROUPS = ["Layout", "Introduction", "Property & project", "Media", "Location", "Conversion", "Trust", "Footer"] as const;
interface SectionDefinition {
  label: string;
  description: string;
  group: (typeof SECTION_GROUPS)[number];
  variants: readonly [string, ...string[]];
  /** Claude may create this section. Testimonials and landmarks need verified, staff-entered content. */
  aiAllowed: boolean;
  /** At most one per page. */
  single: boolean;
  /** CRM data this section shows; editors label it "From CRM". */
  linked: string | null;
}

export const SECTION_DEFINITIONS: Record<SectionType, SectionDefinition> = {
  NAVBAR: {label: "Navigation bar", description: "Brand, section links and a call to action.", group: "Layout", variants: ["transparent", "solid"], aiAllowed: true, single: true, linked: "Company name"},
  HERO: {label: "Hero", description: "Headline, call to action, photo or video.", group: "Introduction", variants: ["fullBleed", "split", "splitForm", "centered"], aiAllowed: true, single: true, linked: "Price, location and key facts (optional)"},
  STATS: {label: "Key facts", description: "Big numbers: price, handover, payment plan or your own.", group: "Introduction", variants: ["strip", "cards"], aiAllowed: true, single: false, linked: "CRM values for linked items"},
  PROJECT_OVERVIEW: {label: "Project overview", description: "Introduction with key project facts.", group: "Property & project", variants: ["withFacts", "imageRight", "text"], aiAllowed: true, single: true, linked: "Developer, status, handover date, units"},
  FEATURE_SPLIT: {label: "Feature with image", description: "Image beside a heading, text and bullet points.", group: "Media", variants: ["split", "overlap"], aiAllowed: true, single: false, linked: null},
  DEVELOPER: {label: "Developer", description: "The developer's name and profile.", group: "Property & project", variants: ["card", "banner"], aiAllowed: true, single: true, linked: "Developer name and profile"},
  HIGHLIGHTS: {label: "Highlights", description: "Short selling points with icons.", group: "Property & project", variants: ["grid", "list"], aiAllowed: true, single: false, linked: null},
  GALLERY: {label: "Gallery", description: "Project photos or stock photos.", group: "Media", variants: ["bento", "grid", "carousel"], aiAllowed: true, single: false, linked: "Approved photos"},
  VIDEO_SHOWCASE: {label: "Video", description: "A stock video with a heading.", group: "Media", variants: ["wide", "contained"], aiAllowed: true, single: false, linked: null},
  UNIT_TYPES: {label: "Available unit types", description: "Available units grouped by type and bedrooms.", group: "Property & project", variants: ["cards", "table"], aiAllowed: true, single: true, linked: "Available units and reference prices"},
  PRICING: {label: "Pricing", description: "Recorded starting or asking prices.", group: "Property & project", variants: ["cards", "banner"], aiAllowed: true, single: true, linked: "Recorded prices"},
  PAYMENT_PLANS: {label: "Payment plans", description: "Active payment plans recorded on the project.", group: "Property & project", variants: ["milestones", "timeline", "table"], aiAllowed: true, single: true, linked: "Active payment plans"},
  FLOOR_PLANS: {label: "Floor plans", description: "Floor plans recorded on the project.", group: "Property & project", variants: ["grid", "list"], aiAllowed: true, single: true, linked: "Floor plans"},
  AMENITIES: {label: "Amenities", description: "Amenities recorded on the project or property.", group: "Property & project", variants: ["imageCards", "icons", "list"], aiAllowed: true, single: true, linked: "Recorded amenities"},
  LOCATION: {label: "Location and map", description: "Location text and a map that respects the record's map privacy.", group: "Location", variants: ["mapRight", "mapTop"], aiAllowed: true, single: true, linked: "Location (exact, approximate or hidden)"},
  LANDMARKS: {label: "Nearby landmarks", description: "Places your team has verified. No distances.", group: "Location", variants: ["list", "grid"], aiAllowed: false, single: true, linked: null},
  COMPARISON: {label: "Property comparison", description: "Compare up to four published listings.", group: "Property & project", variants: ["table"], aiAllowed: false, single: true, linked: "Selected listings"},
  BANNER: {label: "Banner", description: "Large statement with a background photo or video.", group: "Conversion", variants: ["centered", "left"], aiAllowed: true, single: false, linked: null},
  ENQUIRY_FORM: {label: "Enquiry form", description: "Your connected CRM lead form.", group: "Conversion", variants: ["imageSplit", "card", "split"], aiAllowed: true, single: true, linked: "Connected lead form"},
  WHATSAPP_CTA: {label: "WhatsApp call to action", description: "Opens WhatsApp with the approved company number.", group: "Conversion", variants: ["banner", "card"], aiAllowed: true, single: true, linked: "Approved WhatsApp number"},
  CONTACT: {label: "Contact details", description: "Company phone, email, WhatsApp, office and an agent card.", group: "Conversion", variants: ["cards", "split", "minimal"], aiAllowed: false, single: false, linked: "Approved company contacts and the chosen agent"},
  CALL_CTA: {label: "Call call to action", description: "Calls the approved company phone.", group: "Conversion", variants: ["banner", "card"], aiAllowed: true, single: true, linked: "Approved company phone"},
  TESTIMONIALS: {label: "Testimonials", description: "Genuine client quotes you have permission to publish.", group: "Trust", variants: ["cards", "quote"], aiAllowed: false, single: true, linked: null},
  FAQ: {label: "FAQ", description: "Questions and answers.", group: "Trust", variants: ["accordion", "list"], aiAllowed: true, single: true, linked: null},
  CUSTOM: {label: "Custom section", description: "Your own layout: rows, columns and widgets.", group: "Layout", variants: ["default"], aiAllowed: false, single: false, linked: null},
  COUNTDOWN: {label: "Countdown / launch", description: "Counts down to the recorded launch or handover date.", group: "Conversion", variants: ["banner"], aiAllowed: true, single: true, linked: "Recorded launch or handover date"},
  FOOTER: {label: "Footer", description: "Company identity, approved contacts, permits and disclaimer.", group: "Footer", variants: ["detailed", "simple"], aiAllowed: true, single: true, linked: "Company identity, contacts and permits"},
};

export const SPACINGS = ["NONE", "COMPACT", "NORMAL", "SPACIOUS"] as const;
export const DEVICE_SPACINGS = ["INHERIT", ...SPACINGS] as const;
export const BACKGROUNDS = ["DEFAULT", "MUTED", "ACCENT", "DARK"] as const;
export const ALIGNMENTS = ["START", "CENTER"] as const;
export const BACKGROUND_TYPES = ["NONE", "COLOR", "IMAGE", "VIDEO"] as const;
export const OVERLAY_TONES = ["DARK", "LIGHT", "ACCENT"] as const;
export const TEXT_TONES = ["AUTO", "LIGHT", "DARK"] as const;
export const HEIGHTS = ["AUTO", "MEDIUM", "TALL", "SCREEN"] as const;
export const WIDTHS = ["BOXED", "WIDE", "FULL"] as const;
export const ANIMATIONS = ["NONE", "FADE_UP", "FADE", "ZOOM", "SLIDE_LEFT"] as const;

export const CONTENT_VERTICALS = ["AUTO", "TOP", "CENTER", "BOTTOM"] as const;
export const MAX_BOX = 400;
export const MAX_OFFSET = 600;
export const MAX_ELEMENT_OFFSETS = 40;
export const BOX_SIDES = ["top", "right", "bottom", "left"] as const;
export const DEVICES = ["desktop", "tablet", "mobile"] as const;
/** A prop path such as "headline", "primaryCta" or "items.2.title". */
export const ELEMENT_KEY = /^[A-Za-z][A-Za-z0-9]{0,40}(\.[A-Za-z0-9]{1,40}){0,3}$/;
const boxSide = (min: number) => z.number().int().min(min).max(MAX_BOX).nullable().default(null);
const boxSchema = (min: number) => z.strictObject({top: boxSide(min), right: boxSide(min), bottom: boxSide(min), left: boxSide(min)});
function deviceBoxSchema(min: number) {
  const box = boxSchema(min).nullable().default(null);
  return z.strictObject({desktop: box, tablet: box, mobile: box});
}
const offsetAxis = z.number().int().min(-MAX_OFFSET).max(MAX_OFFSET);
const offsetSchema = z.strictObject({x: offsetAxis, y: offsetAxis});
export type BoxSide = typeof BOX_SIDES[number];
export type Device = typeof DEVICES[number];
export type Box = Record<BoxSide, number | null>;
export type DeviceBox = Record<Device, Box | null>;
export type Offset = {x: number; y: number};

/*
 * The style of one element (a heading, eyebrow, paragraph, button or image) or
 * of a widget's text. Every value is an enum, a bounded number or a validated
 * colour; the renderer turns them into fixed inline properties. Null keeps the
 * section or theme value.
 */
export const ELEMENT_ALIGNS = ["LEFT", "CENTER", "RIGHT"] as const;
export const ELEMENT_FONTS = ["HEADING", "BODY"] as const;
export const ELEMENT_WEIGHTS = ["LIGHT", "REGULAR", "MEDIUM", "SEMIBOLD", "BOLD"] as const;
export const ELEMENT_CASES = ["NONE", "UPPERCASE", "LOWERCASE", "CAPITALIZE"] as const;
export const MAX_ELEMENT_STYLES = 40;
const nullableInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable().default(null);
export const elementStyleSchema = z.strictObject({
  color: hexColor.nullable().default(null),
  /** Button fill, a highlight behind text, or the background of a group or panel. */
  background: hexColor.nullable().default(null),
  /** A panel's button and focus colour (forms). */
  accent: hexColor.nullable().default(null),
  align: z.enum(ELEMENT_ALIGNS).nullable().default(null),
  font: z.enum(ELEMENT_FONTS).nullable().default(null),
  /** Font size in px; on phones `sizeMobile`, or a smaller size worked out from it. */
  size: nullableInt(10, 120),
  sizeMobile: nullableInt(10, 96),
  weight: z.enum(ELEMENT_WEIGHTS).nullable().default(null),
  italic: z.boolean().default(false),
  textCase: z.enum(ELEMENT_CASES).nullable().default(null),
  /** Letter spacing in hundredths of an em, line height in percent. */
  letterSpacing: nullableInt(-10, 50),
  lineHeight: nullableInt(80, 250),
  opacity: z.number().int().min(10).max(100).default(100),
  /** Corner radius (images and buttons) and maximum width, in px. */
  radius: nullableInt(0, 80),
  maxWidth: nullableInt(80, 1600),
  /** Space above and below, in px. */
  spaceBefore: nullableInt(-MAX_BOX, MAX_BOX),
  spaceAfter: nullableInt(-MAX_BOX, MAX_BOX),
  devices: z.strictObject({desktop: z.boolean(), tablet: z.boolean(), mobile: z.boolean()}).default({desktop: true, tablet: true, mobile: true}),
});
export type ElementStyle = z.infer<typeof elementStyleSchema>;
export const DEFAULT_ELEMENT_STYLE: ElementStyle = elementStyleSchema.parse({});
/** True when an element style changes nothing (it is then left out of the page data). */
export const isDefaultElementStyle = (style: ElementStyle) => JSON.stringify(style) === JSON.stringify(DEFAULT_ELEMENT_STYLE);

/** Section style (the editor's Style and Advanced tabs, plus per-element styles). Every value is an enum, a bounded number or a validated colour. */
export const sectionStyleSchema = z.strictObject({
  backgroundType: z.enum(BACKGROUND_TYPES).default("NONE"),
  backgroundColor: hexColor.nullable().default(null),
  backgroundImage: imageRefSchema.nullable().default(null),
  backgroundVideo: videoRefSchema.nullable().default(null),
  overlay: z.number().int().min(0).max(90).default(45),
  overlayTone: z.enum(OVERLAY_TONES).default("DARK"),
  textTone: z.enum(TEXT_TONES).default("AUTO"),
  textColor: hexColor.nullable().default(null),
  height: z.enum(HEIGHTS).default("AUTO"),
  width: z.enum(WIDTHS).default("BOXED"),
  animation: z.enum(ANIMATIONS).default("FADE_UP"),
  spacingTablet: z.enum(DEVICE_SPACINGS).default("INHERIT"),
  spacingMobile: z.enum(DEVICE_SPACINGS).default("INHERIT"),
  /** Custom padding and margin in px per device; null keeps the spacing preset. */
  padding: deviceBoxSchema(0).nullable().default(null),
  margin: deviceBoxSchema(-MAX_BOX).nullable().default(null),
  /** Where the content sits in a section taller than its content. */
  contentVertical: z.enum(CONTENT_VERTICALS).default("AUTO"),
  /** Moves all of the section's content together. */
  contentOffset: offsetSchema.default({x: 0, y: 0}),
  /** Moves single elements, keyed by their prop path (for example "headline" or "primaryCta"). */
  elementOffsets: z.record(z.string().regex(ELEMENT_KEY, "Invalid element."), offsetSchema)
    .refine(offsets => Object.keys(offsets).length <= MAX_ELEMENT_OFFSETS, `Up to ${MAX_ELEMENT_OFFSETS} moved elements per section.`).default({}),
  /** Styles single elements, keyed like `elementOffsets`. */
  elementStyles: z.record(z.string().regex(ELEMENT_KEY, "Invalid element."), elementStyleSchema)
    .refine(styles => Object.keys(styles).length <= MAX_ELEMENT_STYLES, `Up to ${MAX_ELEMENT_STYLES} styled elements per section.`).default({}),
});
export type SectionStyle = z.infer<typeof sectionStyleSchema>;
export const DEFAULT_STYLE: SectionStyle = sectionStyleSchema.parse({});

// --- Custom sections: rows → columns → widgets --------------------------------------------

export const SIMPLE_WIDGET_TYPES = ["HEADING", "TEXT", "IMAGE", "BUTTON", "ICON_LIST", "ICON_BOX", "COUNTER", "VIDEO", "SPACER", "DIVIDER", "MAP", "FORM", "CONTACT_CARD", "GALLERY"] as const;
export type SimpleWidgetType = (typeof SIMPLE_WIDGET_TYPES)[number];
/** An inner section holds columns of simple widgets (one level of nesting, as in Elementor). */
export const WIDGET_TYPES = [...SIMPLE_WIDGET_TYPES, "INNER_SECTION"] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];
export const COLUMN_LAYOUTS = ["1", "1-1", "1-2", "2-1", "1-3", "3-1", "1-1-1", "1-2-1", "1-1-1-1", "1-1-1-1-1", "1-1-1-1-1-1"] as const;
export type ColumnLayout = (typeof COLUMN_LAYOUTS)[number];
export const columnCount = (layout: ColumnLayout) => layout.split("-").length;
export const MAX_COLUMNS = 6;
/** Column widths in percent: the row's own widths, or its layout's proportions. */
export function columnWidths(row: {layout: ColumnLayout; widths: number[] | null}) {
  if (row.widths) return row.widths;
  const parts = row.layout.split("-").map(Number);
  const total = parts.reduce((sum, part) => sum + part, 0);
  const widths = parts.map(part => Math.round(part / total * 100));
  widths[widths.length - 1] += 100 - widths.reduce((sum, width) => sum + width, 0);
  return widths;
}
export const WIDGET_ALIGNS = ["START", "CENTER", "END"] as const;
export const MAX_ROWS = 6;
export const MAX_WIDGETS_PER_COLUMN = 12;

const elementId = z.string().regex(/^[a-z0-9][a-z0-9-]{2,40}$/, "Invalid ID.");
export const widgetStyleSchema = z.strictObject({
  align: z.enum(WIDGET_ALIGNS).default("START"),
  color: hexColor.nullable().default(null),
  padding: boxSchema(0).nullable().default(null),
  margin: boxSchema(-MAX_BOX).nullable().default(null),
  animation: z.enum(ANIMATIONS).default("NONE"),
  devices: z.strictObject({desktop: z.boolean(), tablet: z.boolean(), mobile: z.boolean()}).default({desktop: true, tablet: true, mobile: true}),
  /** Typography and finish of the widget's text, image or button; null keeps the widget's presets. */
  text: elementStyleSchema.nullable().default(null),
});
export type WidgetStyle = z.infer<typeof widgetStyleSchema>;

const WIDGET_PROPS = {
  HEADING: z.strictObject({text: plainText(200, 1), level: z.enum(["H2", "H3", "H4"]), size: z.enum(["SM", "MD", "LG", "XL"]), eyebrow: plainText(60).default("")}),
  TEXT: z.strictObject({text: plainText(3000), size: z.enum(["SM", "MD", "LG"]), muted: z.boolean()}),
  IMAGE: z.strictObject({image: imageRefSchema.nullable(), ratio: z.enum(["AUTO", "SQUARE", "PORTRAIT", "LANDSCAPE", "WIDE"]), rounded: z.boolean(), caption: plainText(160)}),
  BUTTON: z.strictObject({cta: ctaSchema, variant: z.enum(["SOLID", "OUTLINE"]), full: z.boolean()}),
  ICON_LIST: z.strictObject({items: z.array(z.strictObject({text: plainText(160, 1), icon: z.enum(HIGHLIGHT_ICONS)})).max(12)}),
  ICON_BOX: z.strictObject({icon: z.enum(HIGHLIGHT_ICONS), title: plainText(80, 1), text: plainText(400), boxed: z.boolean()}),
  /** CRM sources show the recorded value (a typed value is ignored); CUSTOM shows staff text. */
  COUNTER: z.strictObject({source: z.enum(STAT_SOURCES), value: plainText(40), label: plainText(60, 1)}),
  VIDEO: z.strictObject({video: videoRefSchema, poster: imageRefSchema.nullable(), ratio: z.enum(["LANDSCAPE", "WIDE", "SQUARE"])}),
  SPACER: z.strictObject({height: z.number().int().min(8).max(240)}),
  DIVIDER: z.strictObject({width: z.enum(["SHORT", "FULL"])}),
  /** Null uses the linked record's location (with its privacy mode). */
  MAP: z.strictObject({custom: customLocationSchema.nullable(), showMap: z.boolean()}),
  /** The page's connected lead form. */
  FORM: z.strictObject({submitLabel: plainText(40, 1)}),
  CONTACT_CARD: z.strictObject({agentId: z.uuid().nullable(), showCompany: z.boolean()}),
  GALLERY: z.strictObject({images: z.array(imageRefSchema).min(1).max(12), columns: z.union([z.literal(2), z.literal(3), z.literal(4)]), lightbox: z.boolean().default(true)}),
} satisfies Record<SimpleWidgetType, z.ZodType>;
export type WidgetProps<T extends SimpleWidgetType> = z.infer<(typeof WIDGET_PROPS)[T]>;

function widgetSchema<T extends SimpleWidgetType>(type: T) {
  return z.strictObject({id: elementId, type: z.literal(type), props: WIDGET_PROPS[type], style: widgetStyleSchema.default(widgetStyleSchema.parse({}))});
}
export const widgetSchemas = Object.fromEntries(SIMPLE_WIDGET_TYPES.map(type => [type, widgetSchema(type)])) as {[K in SimpleWidgetType]: ReturnType<typeof widgetSchema<K>>};
export const simpleWidgetSchema = z.discriminatedUnion("type", [
  widgetSchemas.HEADING, widgetSchemas.TEXT, widgetSchemas.IMAGE, widgetSchemas.BUTTON, widgetSchemas.ICON_LIST, widgetSchemas.ICON_BOX, widgetSchemas.COUNTER,
  widgetSchemas.VIDEO, widgetSchemas.SPACER, widgetSchemas.DIVIDER, widgetSchemas.MAP, widgetSchemas.FORM, widgetSchemas.CONTACT_CARD, widgetSchemas.GALLERY,
]);
export type SimpleWidget = z.infer<typeof simpleWidgetSchema>;

/*
 * Rows and inner sections share their column settings: a layout, optional
 * widths in percent (one per column, adding up to 100), the gap, and how the
 * columns behave on tablets and phones.
 */
export const ROW_MOBILE = ["STACK", "KEEP"] as const;
export const ROW_ALIGNS = ["STRETCH", "START", "CENTER", "END"] as const;
const columnLayoutFields = {
  layout: z.enum(COLUMN_LAYOUTS),
  widths: z.array(z.number().int().min(5).max(95)).min(1).max(MAX_COLUMNS).nullable().default(null),
  /** Columns start at desktop width instead of tablet width. */
  stackOnTablet: z.boolean().default(false),
  /** Phones stack the columns, or keep them side by side. */
  mobile: z.enum(ROW_MOBILE).default("STACK"),
  /** Stacked columns show in reverse order on phones (for example an image above its text). */
  reverseOnMobile: z.boolean().default(false),
  gap: z.enum(["SM", "MD", "LG"]).default("MD"),
};
type ColumnLayoutFields = {layout: ColumnLayout; widths: number[] | null; columns: unknown[]};
const layoutMatches = (row: ColumnLayoutFields) => row.columns.length === columnCount(row.layout);
const widthsMatch = (row: ColumnLayoutFields) => !row.widths || (row.widths.length === row.columns.length && Math.abs(row.widths.reduce((sum, width) => sum + width, 0) - 100) <= 1);
const LAYOUT_MESSAGE = "Each row needs one column per part of its layout.";
const WIDTHS_MESSAGE = "Column widths need one value per column, adding up to 100%.";

function columnSchemaOf<W extends z.ZodType>(widget: W) {
  return z.strictObject({
    id: elementId,
    widgets: z.array(widget).max(MAX_WIDGETS_PER_COLUMN),
    background: hexColor.nullable().default(null),
    padding: boxSchema(0).nullable().default(null),
    verticalAlign: z.enum(WIDGET_ALIGNS).default("START"),
  });
}
export const innerColumnSchema = columnSchemaOf(simpleWidgetSchema);
export type InnerColumn = z.infer<typeof innerColumnSchema>;
export const innerSectionSchema = z.strictObject({
  id: elementId, type: z.literal("INNER_SECTION"),
  props: z.strictObject({...columnLayoutFields, columns: z.array(innerColumnSchema).min(1).max(MAX_COLUMNS)}).refine(layoutMatches, LAYOUT_MESSAGE).refine(widthsMatch, WIDTHS_MESSAGE),
  style: widgetStyleSchema.default(widgetStyleSchema.parse({})),
});
export const anyWidgetSchema = z.discriminatedUnion("type", [
  widgetSchemas.HEADING, widgetSchemas.TEXT, widgetSchemas.IMAGE, widgetSchemas.BUTTON, widgetSchemas.ICON_LIST, widgetSchemas.ICON_BOX, widgetSchemas.COUNTER,
  widgetSchemas.VIDEO, widgetSchemas.SPACER, widgetSchemas.DIVIDER, widgetSchemas.MAP, widgetSchemas.FORM, widgetSchemas.CONTACT_CARD, widgetSchemas.GALLERY, innerSectionSchema,
]);
export type Widget = z.infer<typeof anyWidgetSchema>;
export type WidgetOf<T extends WidgetType> = Extract<Widget, {type: T}>;

export const columnSchema = columnSchemaOf(anyWidgetSchema);
export type CustomColumn = z.infer<typeof columnSchema>;
/** A row is a container: columns plus its own background, padding, corners, height and alignment. */
export const rowSchema = z.strictObject({
  id: elementId,
  ...columnLayoutFields,
  columns: z.array(columnSchema).min(1).max(MAX_COLUMNS),
  background: hexColor.nullable().default(null),
  backgroundImage: imageRefSchema.nullable().default(null),
  /** A dark overlay over the background image, in percent. */
  overlay: z.number().int().min(0).max(90).default(0),
  padding: boxSchema(0).nullable().default(null),
  radius: z.number().int().min(0).max(80).nullable().default(null),
  minHeight: z.number().int().min(0).max(1200).nullable().default(null),
  align: z.enum(ROW_ALIGNS).default("STRETCH"),
}).refine(layoutMatches, LAYOUT_MESSAGE).refine(widthsMatch, WIDTHS_MESSAGE);
export type CustomRow = z.infer<typeof rowSchema>;
export type ColumnContainer = CustomRow | WidgetOf<"INNER_SECTION">["props"];
export const customRowsSchema = z.array(rowSchema).min(1).max(MAX_ROWS);
export const MAX_EXTRA_ROWS = 3;
/** Content added to a built-in section: rows of widgets shown before or after the section's own content. */
export const sectionExtraSchema = z.strictObject({position: z.enum(["BEFORE", "AFTER"]), rows: z.array(rowSchema).min(1).max(MAX_EXTRA_ROWS)});
export type SectionExtra = z.infer<typeof sectionExtraSchema>;

export const WIDGET_DEFINITIONS: Record<WidgetType, {label: string; description: string}> = {
  HEADING: {label: "Heading", description: "A title, with an optional small label above it."},
  TEXT: {label: "Text", description: "Paragraphs of plain text."},
  IMAGE: {label: "Image", description: "An uploaded, project or stock photo."},
  BUTTON: {label: "Button", description: "Enquire, call, WhatsApp, email or scroll."},
  ICON_LIST: {label: "Icon list", description: "Short points with icons."},
  ICON_BOX: {label: "Icon box", description: "An icon with a title and text."},
  COUNTER: {label: "Counter", description: "A big number: a CRM fact or your own."},
  VIDEO: {label: "Video", description: "A stock video."},
  SPACER: {label: "Spacer", description: "Empty vertical space."},
  DIVIDER: {label: "Divider", description: "A horizontal line."},
  MAP: {label: "Map", description: "The record's location or a pin you set."},
  FORM: {label: "Lead form", description: "The page's connected CRM lead form."},
  CONTACT_CARD: {label: "Contact card", description: "An agent card or the company contacts."},
  GALLERY: {label: "Image grid", description: "Several images in a grid."},
  INNER_SECTION: {label: "Inner section", description: "Columns inside a column."},
};

/** An empty column. */
export const emptyColumn = (id: string) => ({id, widgets: [], background: null, padding: null, verticalAlign: "START" as const});
const LAYOUT_DEFAULTS = {widths: null, stackOnTablet: false, mobile: "STACK" as const, reverseOnMobile: false};
/** Container settings of a new row. */
export const ROW_DEFAULTS = {...LAYOUT_DEFAULTS, background: null, backgroundImage: null, overlay: 0, padding: null, radius: null, minHeight: null, align: "STRETCH" as const};

export function defaultWidget<T extends WidgetType>(type: T, id: string): WidgetOf<T> {
  if (type === "INNER_SECTION") {
    return {id, type, props: {layout: "1-1", ...LAYOUT_DEFAULTS, gap: "MD", columns: [emptyColumn(`${id}-c1`), emptyColumn(`${id}-c2`)]}, style: widgetStyleSchema.parse({})} as unknown as WidgetOf<T>;
  }
  const props: {[K in SimpleWidgetType]: WidgetProps<K>} = {
    HEADING: {text: "Your heading", level: "H2", size: "LG", eyebrow: ""},
    TEXT: {text: "Write a short paragraph about this part of the project.", size: "MD", muted: true},
    IMAGE: {image: {stockId: "living-sectional", alt: ""}, ratio: "LANDSCAPE", rounded: true, caption: ""},
    BUTTON: {cta: {label: "Enquire now", action: "ENQUIRE"}, variant: "SOLID", full: false},
    ICON_LIST: {items: [{text: "First point", icon: "STAR"}, {text: "Second point", icon: "STAR"}, {text: "Third point", icon: "STAR"}]},
    ICON_BOX: {icon: "SPARKLES", title: "A feature", text: "Describe it in a sentence.", boxed: true},
    COUNTER: {source: "STARTING_PRICE", value: "", label: "Starting price"},
    VIDEO: {video: {stockId: "video-living-modern"}, poster: null, ratio: "LANDSCAPE"},
    SPACER: {height: 48},
    DIVIDER: {width: "FULL"},
    MAP: {custom: null, showMap: true},
    FORM: {submitLabel: "Send enquiry"},
    CONTACT_CARD: {agentId: null, showCompany: true},
    GALLERY: {images: [{stockId: "pool-infinity-bay", alt: ""}, {stockId: "living-marble", alt: ""}, {stockId: "kitchen-marble", alt: ""}], columns: 3, lightbox: true},
  };
  return {id, type, props: props[type as SimpleWidgetType], style: widgetStyleSchema.parse({})} as WidgetOf<T>;
}

/** A starter custom section: heading and text beside an image. */
export function defaultCustomRows(prefix: string): CustomRow[] {
  return [{id: `${prefix}-r1`, layout: "1-1", ...ROW_DEFAULTS, gap: "LG", columns: [
    {id: `${prefix}-c1`, background: null, padding: null, verticalAlign: "CENTER", widgets: [defaultWidget("HEADING", `${prefix}-w1`), defaultWidget("TEXT", `${prefix}-w2`), defaultWidget("BUTTON", `${prefix}-w3`)]},
    {id: `${prefix}-c2`, background: null, padding: null, verticalAlign: "START", widgets: [defaultWidget("IMAGE", `${prefix}-w4`)]},
  ]}];
}

type RowsHolder = {type: string; props: unknown; extra?: SectionExtra | null};
/**
 * The rows of a section with their path prefix: a custom section's rows
 * ("rows", inside its props) and rows added to a built-in section
 * ("extra.rows", on the section itself).
 */
export function sectionRows(section: RowsHolder): Array<{rows: CustomRow[]; prefix: "rows" | "extra.rows"}> {
  const groups: Array<{rows: CustomRow[]; prefix: "rows" | "extra.rows"}> = [];
  if (section.type === "CUSTOM") groups.push({rows: (section.props as {rows: CustomRow[]}).rows, prefix: "rows"});
  if (section.extra) groups.push({rows: section.extra.rows, prefix: "extra.rows"});
  return groups;
}

/** Every widget in a section (inner sections' widgets included), with its editor path. */
export function sectionWidgets(section: RowsHolder): Array<{widget: Widget; path: string}> {
  return sectionRows(section).flatMap(({rows, prefix}) => rows.flatMap((row, rowIndex) => row.columns.flatMap((column, columnIndex) => column.widgets.flatMap((widget, widgetIndex) => {
    const path = `${prefix}.${rowIndex}.columns.${columnIndex}.widgets.${widgetIndex}`;
    const inner = widget.type === "INNER_SECTION" ? widget.props.columns.flatMap((child, childIndex) => child.widgets.map((item, itemIndex) => ({widget: item as Widget, path: `${path}.props.columns.${childIndex}.widgets.${itemIndex}`}))) : [];
    return [{widget, path}, ...inner];
  }))));
}

/** The IDs of rows, columns and widgets (inner ones included). */
export function rowsElementIds(rows: CustomRow[]): string[] {
  return rows.flatMap(row => [row.id, ...row.columns.flatMap(column => [column.id, ...column.widgets.flatMap(widget => [widget.id,
    ...(widget.type === "INNER_SECTION" ? widget.props.columns.flatMap(child => [child.id, ...child.widgets.map(item => item.id)]) : [])])])]);
}

/** Applies a change to every widget (inner sections' widgets included), for example to generalize map pins. */
export function mapRowsWidgets(rows: CustomRow[], change: (widget: Widget) => Widget): CustomRow[] {
  return rows.map(row => ({...row, columns: row.columns.map(column => ({...column, widgets: column.widgets.map(widget => {
    const next = change(widget);
    return next.type === "INNER_SECTION" ? {...next, props: {...next.props, columns: next.props.columns.map(child => ({...child, widgets: child.widgets.map(item => change(item) as SimpleWidget)}))}} : next;
  })}))}));
}
export function mapSectionWidgets<S extends PageSection>(section: S, change: (widget: Widget) => Widget): S {
  let next = section;
  if (next.type === "CUSTOM") next = {...next, props: {...next.props, rows: mapRowsWidgets(next.props.rows, change)}};
  if (next.extra) next = {...next, extra: {...next.extra, rows: mapRowsWidgets(next.extra.rows, change)}};
  return next;
}
/** Section types that can hold added content (all but the navigation bar, footer and custom sections, which have rows of their own). */
export const acceptsExtra = (type: string) => type !== "NAVBAR" && type !== "FOOTER" && type !== "CUSTOM";

const sectionBase = {
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,40}$/, "Invalid section ID."),
  visible: z.boolean(),
  devices: z.strictObject({desktop: z.boolean(), tablet: z.boolean(), mobile: z.boolean()}),
  layout: z.strictObject({spacing: z.enum(SPACINGS), background: z.enum(BACKGROUNDS), align: z.enum(ALIGNMENTS)}),
  style: sectionStyleSchema.default(DEFAULT_STYLE),
  /** Rows of widgets added inside a built-in section. */
  extra: sectionExtraSchema.nullable().default(null),
};

function sectionSchema<T extends SectionType>(type: T) {
  const definition = SECTION_DEFINITIONS[type];
  return z.strictObject({...sectionBase, type: z.literal(type), variant: z.enum(definition.variants as [string, ...string[]]), props: PROPS[type] as (typeof PROPS)[T]});
}

export const sectionSchemas = Object.fromEntries(SECTION_TYPES.map(type => [type, sectionSchema(type)])) as {[K in SectionType]: ReturnType<typeof sectionSchema<K>>};

export const anySectionSchema = z.discriminatedUnion("type", [
  sectionSchemas.NAVBAR, sectionSchemas.HERO, sectionSchemas.STATS, sectionSchemas.PROJECT_OVERVIEW, sectionSchemas.FEATURE_SPLIT, sectionSchemas.DEVELOPER,
  sectionSchemas.HIGHLIGHTS, sectionSchemas.GALLERY, sectionSchemas.VIDEO_SHOWCASE, sectionSchemas.UNIT_TYPES, sectionSchemas.PRICING, sectionSchemas.PAYMENT_PLANS,
  sectionSchemas.FLOOR_PLANS, sectionSchemas.AMENITIES, sectionSchemas.LOCATION, sectionSchemas.LANDMARKS, sectionSchemas.COMPARISON, sectionSchemas.BANNER,
  sectionSchemas.ENQUIRY_FORM, sectionSchemas.WHATSAPP_CTA, sectionSchemas.CALL_CTA, sectionSchemas.CONTACT, sectionSchemas.CUSTOM, sectionSchemas.TESTIMONIALS, sectionSchemas.FAQ, sectionSchemas.COUNTDOWN,
  sectionSchemas.FOOTER,
]);
export type PageSection = z.infer<typeof anySectionSchema>;
export type SectionOf<T extends SectionType> = Extract<PageSection, {type: T}>;

export const pageDataSchema = z.strictObject({
  schemaVersion: z.literal(PAGE_SCHEMA_VERSION),
  theme: themeSchema,
  sections: z.array(anySectionSchema).max(MAX_SECTIONS),
}).superRefine((page, context) => {
  const ids = new Set<string>();
  const counts = new Map<SectionType, number>();
  page.sections.forEach((section, index) => {
    if (ids.has(section.id)) context.addIssue({code: "custom", path: ["sections", index, "id"], message: "Each section needs a unique ID."});
    ids.add(section.id);
    for (const {rows} of sectionRows(section)) for (const id of rowsElementIds(rows)) {
      if (ids.has(id)) context.addIssue({code: "custom", path: ["sections", index], message: "Each row, column and widget needs a unique ID."});
      ids.add(id);
    }
    if (section.extra && !acceptsExtra(section.type)) context.addIssue({code: "custom", path: ["sections", index, "extra"], message: "This section cannot hold added content."});
    counts.set(section.type, (counts.get(section.type) ?? 0) + 1);
  });
  for (const [type, count] of counts) {
    if (count > 1 && SECTION_DEFINITIONS[type].single) context.addIssue({code: "custom", path: ["sections"], message: `A page can have only one ${SECTION_DEFINITIONS[type].label} section.`});
  }
  // One lead form per page: an enquiry form section or a form widget.
  const forms = page.sections.filter(section => section.type === "ENQUIRY_FORM").length + page.sections.flatMap(sectionWidgets).filter(item => item.widget.type === "FORM").length;
  if (forms > 1) context.addIssue({code: "custom", path: ["sections"], message: "A page can show the lead form only once: use either an enquiry form section or one form widget."});
});
export type PageData = z.infer<typeof pageDataSchema>;
/** What a browser or Claude may send (new fields optional); parsing fills the defaults. */
export type PageDataInput = z.input<typeof pageDataSchema>;

export class PageDataError extends Error {
  constructor(readonly issues: string[]) { super(issues[0] ?? "The page content is invalid."); }
}

/** Validates untrusted page data (browser, Claude or stored JSON). Throws with readable issues. */
export function parsePageData(input: unknown): PageData {
  const result = pageDataSchema.safeParse(input);
  if (result.success) return result.data;
  throw new PageDataError(result.error.issues.slice(0, 8).map(issue => `${issue.path.join(".") || "page"}: ${issue.message}`));
}

export function parseStoredPageData(raw: string): PageData {
  let json: unknown;
  try { json = JSON.parse(raw); } catch { throw new PageDataError(["The stored page content is not valid JSON."]); }
  return parsePageData(json);
}

export const DEFAULT_LAYOUT = {spacing: "NORMAL", background: "DEFAULT", align: "START"} as const;
export const ALL_DEVICES = {desktop: true, tablet: true, mobile: true} as const;

/** Editable defaults for a new section of each type. */
export function defaultProps<T extends SectionType>(type: T): SectionProps<T> {
  const defaults: {[K in SectionType]: SectionProps<K>} = {
    NAVBAR: {brandText: "", showLinks: true, cta: {label: "Enquire now", action: "ENQUIRE"}, sticky: true, logo: null, logoHeight: 40, links: [], linksAlign: "CENTER", showPhone: false, mobileMenu: true},
    CUSTOM: {rows: defaultCustomRows("custom")},
    HERO: {eyebrow: "", headline: "Your new home starts here", subheadline: "", primaryCta: {label: "Enquire now", action: "ENQUIRE"}, secondaryCta: null, image: null, showPrice: true, showLocation: true, badge: "", showFacts: false},
    STATS: {heading: "", items: [{source: "STARTING_PRICE", value: "", label: "Starting price"}, {source: "HANDOVER", value: "", label: "Handover"}, {source: "PAYMENT_PLAN", value: "", label: "Payment plan"}]},
    PROJECT_OVERVIEW: {heading: "Overview", body: "", showFacts: true, eyebrow: "", image: null},
    FEATURE_SPLIT: {eyebrow: "", heading: "Designed around the way you live", body: "", bullets: [], image: null, imageSide: "RIGHT", cta: null},
    DEVELOPER: {heading: "About the developer", body: ""},
    HIGHLIGHTS: {heading: "Highlights", intro: "", columns: 3, items: [], eyebrow: ""},
    GALLERY: {heading: "Gallery", intro: "", columns: 3, images: [], eyebrow: "", lightbox: true},
    VIDEO_SHOWCASE: {eyebrow: "", heading: "", body: "", video: {stockId: "video-dubai-shore"}, poster: null},
    UNIT_TYPES: {heading: "Available unit types", intro: ""},
    PRICING: {heading: "Pricing", intro: "", note: "Prices are as recorded on the date shown and may change. Contact us to confirm availability."},
    PAYMENT_PLANS: {heading: "Payment plan", intro: "", eyebrow: ""},
    FLOOR_PLANS: {heading: "Floor plans", intro: ""},
    AMENITIES: {heading: "Amenities", intro: "", columns: 3, eyebrow: ""},
    LOCATION: {heading: "Location", body: "", showMap: true, eyebrow: "", custom: null},
    LANDMARKS: {heading: "Nearby", intro: "", verified: false, items: []},
    COMPARISON: {heading: "Compare properties", intro: "", listingIds: []},
    BANNER: {eyebrow: "", heading: "Be first in line", body: "", cta: {label: "Register your interest", action: "ENQUIRE"}, secondaryCta: null},
    ENQUIRY_FORM: {heading: "Register your interest", intro: "Leave your details and our team will contact you.", submitLabel: "Send enquiry", image: null, points: []},
    WHATSAPP_CTA: {heading: "Chat with us on WhatsApp", body: "", buttonLabel: "Chat on WhatsApp", prefilledMessage: ""},
    CALL_CTA: {heading: "Speak to our team", body: "", buttonLabel: "Call us"},
    CONTACT: {eyebrow: "Contact", heading: "Speak to our team", intro: "Our advisors are here to answer your questions and arrange a viewing.", showPhone: true, showEmail: true, showWhatsapp: true, showAddress: true, showHours: true, agentId: null, cta: {label: "Send an enquiry", action: "ENQUIRE"}},
    TESTIMONIALS: {heading: "What our clients say", consentConfirmed: false, items: []},
    FAQ: {heading: "Frequently asked questions", items: []},
    COUNTDOWN: {heading: "Launching soon", body: "", target: "LAUNCH_DATE"},
    FOOTER: {disclaimer: "", showContacts: true},
  };
  return structuredClone(defaults[type]);
}

/** Default style per type: the hero and banners open with a photo, footers on dark. */
/**
 * Fills style fields a section may lack, for example an editor draft loaded
 * before a newer field existed. Stored pages get the same defaults when parsed.
 */
export function withStyleDefaults(style: Partial<SectionStyle> | undefined): SectionStyle {
  return {...DEFAULT_STYLE, ...style};
}

export function defaultStyle(type: SectionType): SectionStyle {
  if (type === "HERO") return {...DEFAULT_STYLE, height: "SCREEN", width: "FULL", animation: "FADE"};
  if (type === "BANNER") return {...DEFAULT_STYLE, height: "MEDIUM", width: "FULL", backgroundType: "IMAGE", backgroundImage: {stockId: "skyline-sunset", alt: ""}, overlay: 50};
  if (type === "NAVBAR" || type === "FOOTER") return {...DEFAULT_STYLE, animation: "NONE"};
  return {...DEFAULT_STYLE};
}

export function createSection<T extends SectionType>(type: T, id: string, props?: SectionProps<T>, variant?: string, style?: Partial<SectionStyle>): SectionOf<T> {
  const definition = SECTION_DEFINITIONS[type];
  return {
    id, type, visible: true, devices: {...ALL_DEVICES},
    layout: {...DEFAULT_LAYOUT, background: type === "FOOTER" ? "DARK" : "DEFAULT", spacing: type === "NAVBAR" ? "NONE" : "NORMAL"},
    style: {...defaultStyle(type), ...style},
    variant: variant && definition.variants.includes(variant) ? variant : definition.variants[0],
    // Row, column and widget IDs are prefixed with the section ID so they stay unique on the page.
    props: props ?? (type === "CUSTOM" ? {rows: defaultCustomRows(id)} : defaultProps(type)),
    extra: null,
  } as SectionOf<T>;
}

/** Short, unique, registry-valid section IDs. */
export function newSectionId(type: SectionType, taken: Iterable<string>, random: () => number = Math.random) {
  const used = new Set(taken);
  const base = type.toLowerCase().replaceAll("_", "-");
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const id = `${base}-${Math.floor(random() * 36 ** 4).toString(36).padStart(4, "0")}`;
    if (!used.has(id)) return id;
  }
  throw new Error("Could not allocate a section ID.");
}

export function defaultTheme(style: DesignStyle = "CONTEMPORARY"): PageTheme {
  const accent: Record<DesignStyle, Accent> = {
    LUXURY_MINIMALIST: "GOLD", PREMIUM_DARK: "GOLD", MODERN_CORPORATE: "NAVY", ELEGANT_LIGHT: "ROSE", CONTEMPORARY: "TEAL", HIGH_CONVERSION: "TERRACOTTA",
  };
  const font: Record<DesignStyle, PageTheme["font"]> = {
    LUXURY_MINIMALIST: "SERIF", PREMIUM_DARK: "DISPLAY", MODERN_CORPORATE: "SANS", ELEGANT_LIGHT: "SERIF", CONTEMPORARY: "SANS", HIGH_CONVERSION: "SANS",
  };
  const headingFont: Record<DesignStyle, FontFamily> = {
    LUXURY_MINIMALIST: "CORMORANT", PREMIUM_DARK: "PLAYFAIR", MODERN_CORPORATE: "MANROPE", ELEGANT_LIGHT: "DM_SERIF", CONTEMPORARY: "MONTSERRAT", HIGH_CONVERSION: "POPPINS",
  };
  const bodyFont: Record<DesignStyle, FontFamily> = {
    LUXURY_MINIMALIST: "MANROPE", PREMIUM_DARK: "INTER", MODERN_CORPORATE: "INTER", ELEGANT_LIGHT: "MANROPE", CONTEMPORARY: "INTER", HIGH_CONVERSION: "INTER",
  };
  return {
    style, accent: accent[style], font: font[style], scale: style === "HIGH_CONVERSION" ? "COMPACT" : "LARGE",
    radius: style === "MODERN_CORPORATE" ? "SOFT" : style === "LUXURY_MINIMALIST" ? "NONE" : "ROUND",
    customAccent: null, headingFont: headingFont[style], bodyFont: bodyFont[style], buttonShape: "ROUNDED",
  };
}

// --- Slugs ---------------------------------------------------------------------

export const slugSchema = z.string().min(1).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens.");
const RESERVED_SLUGS = new Set(["api", "admin", "preview", "draft", "drafts", "site", "sitemap", "robots", "login", "edit", "new", "not-found"]);

export function slugify(value: string) {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70).replace(/-+$/g, "") || "landing-page";
}

export function isReservedSlug(slug: string) { return RESERVED_SLUGS.has(slug); }
