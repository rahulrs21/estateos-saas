import { presentBranding } from "../ai/content/facts";
import { mapGeneratedPage, pageGenerationZod, type PageGenerationOutput } from "./ai";
import { buildLinkedData, type LinkedSources } from "./linked";
import { defaultTheme, type DesignStyle, type SectionType } from "./registry";
import { stockImage, stockImageUrl } from "./stock";
import { STRUCTURE_DEFINITIONS, type PageStructure } from "./structures";
import type { RenderablePage } from "./types";

/**
 * Sample pages for the style and structure pickers (docs/AI_PAGE_BUILDER.md#style-gallery).
 *
 * A fictional project ("Azure Bay Residences") with sample copy is run
 * through the same mapping Claude's pages use (mapGeneratedPage), so a
 * preview shows exactly the layout, variants and look a generated page gets;
 * only the words differ. Everything is synthetic and built in the browser: no
 * company record, lead or contact is read, nothing is stored, and the photos
 * are the curated stock catalogue standing in for project photos.
 */

const SAMPLE_READ_AT = "2026-11-01T08:00:00.000Z";
export const SAMPLE_TODAY = SAMPLE_READ_AT.slice(0, 10);

/** Sample "project photos": stock catalogue photos under fixed sample IDs (the first is the cover). */
const SAMPLE_PHOTOS: Array<[string, string]> = [
  ["5a3e0000-0000-4000-8000-000000000001", "marina-towers-sea"],
  ["5a3e0000-0000-4000-8000-000000000002", "living-window-view"],
  ["5a3e0000-0000-4000-8000-000000000003", "pool-infinity-bay"],
  ["5a3e0000-0000-4000-8000-000000000004", "bedroom-city-view"],
  ["5a3e0000-0000-4000-8000-000000000005", "kitchen-island"],
  ["5a3e0000-0000-4000-8000-000000000006", "architecture-curves"],
  ["5a3e0000-0000-4000-8000-000000000007", "living-marble"],
  ["5a3e0000-0000-4000-8000-000000000008", "gym-city-view"],
  ["5a3e0000-0000-4000-8000-000000000009", "bathroom-marble"],
  ["5a3e0000-0000-4000-8000-000000000010", "beach-loungers"],
];
const PHOTO_STOCK = new Map(SAMPLE_PHOTOS);

const SAMPLE_SOURCES: LinkedSources = {
  project: {
    id: "5a3e0000-0000-4000-8000-0000000000a1", projectName: "Azure Bay Residences", projectStatus: "ACTIVE", constructionStatus: "UNDER_CONSTRUCTION",
    developer: {name: "Sample Developments"}, emirate: "DUBAI", city: "Dubai", community: "Dubai Creek Harbour", area: "Creek Beach",
    latitude: 25.2003, longitude: 55.3472, mapDisplayMode: "APPROXIMATE", launchDate: "2027-03-01", expectedHandoverDate: "2029-06-30",
    startingPriceMinor: "185000000", currency: "AED", totalUnits: 320,
    projectAmenities_on_project: ["Infinity pool", "Fitness studio", "Spa", "Kids' play area", "Landscaped gardens", "Concierge"].map(name => ({amenity: {name}})),
    marketingDescription: "A sample waterfront residence used to preview page styles.",
  },
  developer: {name: "Sample Developments", description: "A fictional developer used only for style previews."},
  units: {complete: true, rows: [
    {propertyType: "APARTMENT", bedrooms: 1, referencePriceMinor: "185000000"}, {propertyType: "APARTMENT", bedrooms: 1, referencePriceMinor: "199000000"},
    {propertyType: "APARTMENT", bedrooms: 2, referencePriceMinor: "265000000"}, {propertyType: "APARTMENT", bedrooms: 3, referencePriceMinor: "390000000"},
    {propertyType: "PENTHOUSE", bedrooms: 4, referencePriceMinor: "960000000"},
  ]},
  paymentPlans: [{name: "60/40 payment plan", isActive: true, bookingPercentageBps: 1000, handoverPercentageBps: 4000, paymentPlanInstallments_on_paymentPlan: [
    {position: 1, percentageBps: 2000, dueTrigger: "CONSTRUCTION_MILESTONE", constructionMilestonePercent: 30},
    {position: 2, percentageBps: 3000, dueTrigger: "CONSTRUCTION_MILESTONE", constructionMilestonePercent: 70},
  ]}],
  floorPlans: [
    {id: "5a3e0000-0000-4000-8000-0000000000f1", name: "Residence A", propertyType: "APARTMENT", bedrooms: 1, builtUpArea: 780, areaUnit: "SQFT"},
    {id: "5a3e0000-0000-4000-8000-0000000000f2", name: "Residence B", propertyType: "APARTMENT", bedrooms: 2, builtUpArea: 1240, areaUnit: "SQFT"},
    {id: "5a3e0000-0000-4000-8000-0000000000f3", name: "Residence C", propertyType: "APARTMENT", bedrooms: 3, builtUpArea: 1810, areaUnit: "SQFT"},
  ],
  media: SAMPLE_PHOTOS.map(([id], index) => ({id, contentType: "image/jpeg", mediaKind: "PROPERTY_PHOTO", isCover: index === 0})),
};

const SAMPLE_BRANDING = presentBranding({
  companyName: "Your Agency", companyPhone: "+971 4 555 0100",
  profile: {useCompanyPhone: true, whatsappNumber: "+971 50 555 0101", tagline: "Sample preview", marketingDisclaimer: "Sample preview with illustrative content. Not an advertisement."},
});

type Copy = Partial<Omit<PageGenerationOutput["sections"][number], "type">>;
const item = (title: string, text: string, icon: PageGenerationOutput["sections"][number]["items"][number]["icon"] = "SPARKLES") => ({title, text, icon});

/** Sample copy per section type; a repeated type takes the next entry. */
const COPY: Partial<Record<SectionType, Copy[]>> = {
  HERO: [{eyebrow: "Now launching", heading: "Life on the water, refined", subheading: "Waterfront residences with open views, resort amenities and a beach at your door.", ctaLabel: "Register your interest", imageTag: "MARINA"}],
  STATS: [{heading: "", statSources: ["STARTING_PRICE", "PAYMENT_PLAN", "HANDOVER", "UNITS"]}],
  PROJECT_OVERVIEW: [{eyebrow: "The residence", heading: "A calm address by the creek", body: "Set where the city meets the water, Azure Bay is a collection of light-filled homes designed around views, space and quiet.\n\nGenerous terraces, natural materials and thoughtful layouts make every residence feel like a retreat, minutes from the heart of the city.", imageTag: "ARCHITECTURE"}],
  FEATURE_SPLIT: [
    {eyebrow: "Interiors", heading: "Rooms that open to the horizon", body: "Floor-to-ceiling glazing frames the water, while warm finishes and open plans bring a sense of ease to everyday living.", items: [item("Full-height windows", ""), item("Private terraces", ""), item("Premium finishes", "")], imageTag: "LIVING_ROOM"},
    {eyebrow: "Wellbeing", heading: "Resort living, every day", body: "Begin the morning with a swim, unwind in the spa and end the day watching the sunset from the pool deck.", items: [item("Infinity pool", ""), item("Spa and steam rooms", ""), item("Fitness studio", "")], imageTag: "POOL"},
    {eyebrow: "Community", heading: "Space to gather and grow", body: "Shaded gardens, play areas and waterfront walks make it easy to slow down and connect with neighbours.", items: [item("Landscaped gardens", ""), item("Kids' play area", ""), item("Waterfront promenade", "")], imageTag: "PARK"},
  ],
  HIGHLIGHTS: [{eyebrow: "Why Azure Bay", heading: "Designed around you", body: "", items: [
    item("Waterfront views", "Open aspects over the creek and skyline.", "WAVES"), item("Flexible payment plan", "Spread payments through construction.", "WALLET"),
    item("Resort amenities", "Pool, spa and fitness on site.", "SPARKLES"), item("Connected location", "Close to the city, by the water.", "MAP_PIN"),
  ]}],
  GALLERY: [{eyebrow: "Gallery", heading: "A closer look", body: "", imageTag: "LIVING_ROOM"}, {eyebrow: "Details", heading: "Made for slow mornings", body: "", imageTag: "BEDROOM"}],
  VIDEO_SHOWCASE: [{eyebrow: "Film", heading: "See the lifestyle", body: "A glimpse of waterfront living.", imageTag: "POOL"}],
  UNIT_TYPES: [{heading: "Residences available", body: "One to four bedroom homes and penthouses."}],
  PRICING: [{heading: "Prices", body: "Indicative starting prices as recorded."}],
  PAYMENT_PLANS: [{eyebrow: "Payment plan", heading: "Own it step by step", body: "A simple plan spread over construction and handover."}],
  FLOOR_PLANS: [{heading: "Floor plans", body: "Layouts for every way of living."}],
  AMENITIES: [{eyebrow: "Amenities", heading: "Everything close at hand", body: ""}],
  LOCATION: [{eyebrow: "Location", heading: "By the water, near the city", body: "Moments from the creek promenade with easy access to the rest of the city."}],
  DEVELOPER: [{heading: "About the developer", body: "A sample developer profile used for previews."}],
  BANNER: [{eyebrow: "Limited release", heading: "Be first in line", body: "Register now to receive the brochure and floor plans.", ctaLabel: "Register your interest", imageTag: "SKYLINE"}],
  WHATSAPP_CTA: [{heading: "Questions? Chat with us", body: "Our advisors reply on WhatsApp.", ctaLabel: "Chat on WhatsApp", ctaAction: "WHATSAPP"}],
  FAQ: [{heading: "Frequently asked questions", items: [
    item("How do I register my interest?", "Complete the enquiry form and an advisor will contact you."),
    item("Can I receive the floor plans?", "Yes. We will share the latest floor plans and payment plan."),
    item("Can I arrange a call?", "Yes. Tell us a time that suits you in the enquiry form."),
  ]}],
  ENQUIRY_FORM: [{heading: "Register your interest", body: "Leave your details and an advisor will be in touch.", ctaLabel: "Send enquiry", items: [item("Brochure and floor plans", ""), item("Latest availability", "")], imageTag: "ADVISOR"}],
  FOOTER: [{}],
};

const SIGNATURE_ORDER: SectionType[] = ["HERO", "STATS", "PROJECT_OVERVIEW", "FEATURE_SPLIT", "FEATURE_SPLIT", "GALLERY", "AMENITIES", "PAYMENT_PLANS", "UNIT_TYPES", "LOCATION", "BANNER", "FAQ", "ENQUIRY_FORM", "FOOTER"];

function sampleOutput(style: DesignStyle, structure: PageStructure): PageGenerationOutput {
  const order = STRUCTURE_DEFINITIONS[structure].order ?? SIGNATURE_ORDER;
  const used = new Map<SectionType, number>();
  return pageGenerationZod.parse({
    title: "Azure Bay Residences", seoTitle: "Azure Bay Residences", seoDescription: "Sample preview.", style, structure, accent: "GOLD",
    sections: order.map(type => {
      const n = used.get(type) ?? 0;
      used.set(type, n + 1);
      const list = COPY[type] ?? [{}];
      return {type, variant: "", eyebrow: "", heading: "", subheading: "", body: "", ctaLabel: "", ctaAction: "ENQUIRE", imageTag: "NONE", statSources: [], items: [], ...list[n % list.length]};
    }),
    missingInformation: [], claimsToReview: [],
  });
}

const SAMPLE_FORM = {
  fields: [{key: "FULL_NAME" as const, label: "Full name", required: true}, {key: "PHONE" as const, label: "Phone", required: true}, {key: "EMAIL" as const, label: "Email", required: false}],
  consentText: "I agree to be contacted about this sample.", privacyPolicyUrl: "https://example.com/privacy", successMessage: "Sample only",
};

const cache = new Map<string, RenderablePage>();

/**
 * A sample page in a style and structure, as a generated page would look.
 * `photoWidth` sets the photo size (small for the picker's miniatures).
 */
export function samplePage(style: DesignStyle, structure: PageStructure, photoWidth = 1600): RenderablePage {
  const key = `${style}:${structure}:${photoWidth}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const linked = buildLinkedData(SAMPLE_SOURCES, SAMPLE_BRANDING, {
    readAt: SAMPLE_READ_AT,
    mediaUrl: id => { const photo = stockImage(PHOTO_STOCK.get(id) ?? ""); return photo ? stockImageUrl(photo, photoWidth) : ""; },
  });
  const mapped = mapGeneratedPage(sampleOutput(style, structure), linked, {hasForm: true, fallbackTitle: "Azure Bay Residences", style, structure});
  // The theme keeps the style's own accent (the sample copy does not choose one).
  const data = {...mapped.data, theme: {...mapped.data.theme, accent: defaultTheme(style).accent}};
  const page = {title: "Azure Bay Residences (sample)", data, linked, form: SAMPLE_FORM};
  cache.set(key, page);
  return page;
}


/** The first sections of a sample page, for the picker's miniatures. */
export function sampleMiniature(style: DesignStyle, structure: PageStructure, sections = 4): RenderablePage {
  const page = samplePage(style, structure, 640);
  // Videos are left out of miniatures; the full preview plays them.
  const shown = page.data.sections.filter(section => section.type !== "VIDEO_SHOWCASE").slice(0, sections);
  return {...page, data: {...page.data, sections: shown}};
}
