import {
  PAGE_SCHEMA_VERSION, createSection, defaultProps, defaultTheme, pageDataSchema,
  type DesignStyle, type ImageRef, type PageData, type PageSection, type SectionProps, type SectionStyle, type SectionType,
} from "./registry";
import { stockImage } from "./stock";

/**
 * Built-in page templates (docs/AI_PAGE_BUILDER.md#templates): complete
 * campaign layouts on the same validated registry as every other page.
 *
 * Copy is aspirational but makes no factual claims: no prices, dates,
 * payment terms, unit counts, distances, amenities or testimonials. Those
 * come from linked CRM sections, which stay hidden when the records have no
 * such data. Visuals use the page's CRM photos when there are any and
 * illustrative stock media otherwise; everything is editable. Templates are
 * code shared by every company and contain no company data.
 */

export const TEMPLATE_KEYS = ["PROJECT_SHOWCASE", "OFF_PLAN_LAUNCH", "LUXURY_APARTMENT", "VILLA_TOWNHOUSE", "INVESTMENT_ENQUIRY", "RENTAL_CAMPAIGN", "DEVELOPER_SHOWCASE", "COMING_SOON"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export interface PageTemplate {
  key: TemplateKey;
  name: string;
  description: string;
  style: DesignStyle;
  /** The kind of source record the template is designed for. */
  bestFor: "project" | "listing" | "any";
  /** Section types, for Claude's layout hint. */
  sections: SectionType[];
}

export interface TemplateOptions { crmPhotoIds?: string[] }

type Part = {type: SectionType; props?: Record<string, unknown>; variant?: string; style?: Partial<SectionStyle>; layout?: Partial<PageSection["layout"]>};

const stock = (id: string): ImageRef => ({stockId: id, alt: stockImage(id)?.alt ?? ""});

function builder(options: TemplateOptions) {
  const crm = options.crmPhotoIds ?? [];
  /** The n-th CRM photo of the page's records, or an illustrative stock photo. */
  const photo = (index: number, fallback: string): ImageRef => crm[index] ? {mediaId: crm[index], alt: ""} : stock(fallback);
  const heroBackground = (fallback: string): Partial<SectionStyle> => ({backgroundType: "IMAGE", backgroundImage: photo(0, fallback), overlay: 50});
  return {photo, heroBackground, hasCrmPhotos: crm.length > 0};
}

const nav = (cta = "Enquire now"): Part => ({type: "NAVBAR", variant: "transparent", props: {brandText: "", showLinks: true, cta: {label: cta, action: "ENQUIRE"}, sticky: false}});
const footer: Part = {type: "FOOTER", variant: "detailed"};
const faq = (items: Array<[string, string]>): Part => ({type: "FAQ", variant: "accordion", props: {heading: "Frequently asked questions", items: items.map(([question, answer]) => ({question, answer}))}, layout: {background: "MUTED"}});
const COMMON_FAQ: Array<[string, string]> = [
  ["How do I register my interest?", "Complete the enquiry form on this page and one of our advisors will contact you with the latest information."],
  ["Can I receive the price list, floor plans and payment plan?", "Yes. Our team will share the latest price list, floor plans and payment plan as provided by the developer, together with current availability."],
  ["Can I arrange a call or a viewing?", "Yes. Tell us when suits you in the enquiry form, or contact our team directly, and we will arrange it."],
  ["Who will I speak to?", "A member of our licensed advisory team, who will guide you through the options and every step of the process."],
];

function templateParts(key: TemplateKey, options: TemplateOptions): Part[] {
  const {photo, heroBackground, hasCrmPhotos} = builder(options);
  const gallery = (variant: string, stockIds: string[], heading = "A closer look"): Part => ({
    type: "GALLERY", variant, props: {eyebrow: "Gallery", heading, intro: "", columns: 3, images: hasCrmPhotos ? [] : stockIds.map(stock)},
  });
  switch (key) {
    // A new-project page in the order buyers read one: hero with the enquiry form and key facts, overview,
    // amenities, investment, payment plan, floor plans, gallery, location, then a call-back form.
    case "PROJECT_SHOWCASE": return [
      {type: "NAVBAR", variant: "solid", props: {brandText: "", showLinks: true, cta: {label: "Enquire now", action: "ENQUIRE"}, sticky: true}},
      {type: "HERO", variant: "splitForm", style: {...heroBackground("pool-infinity-bay"), overlay: 55, height: "SCREEN", width: "WIDE"},
        props: {badge: "New launch", eyebrow: "New project", headline: "Resort-style living in a new community", subheadline: "Register your interest to receive the price list, floor plans and payment plan as soon as they are released.",
          primaryCta: {label: "Get project details", action: "ENQUIRE"}, secondaryCta: {label: "WhatsApp", action: "WHATSAPP"}, image: null, showPrice: true, showLocation: true, showFacts: true}},
      {type: "PROJECT_OVERVIEW", variant: "imageRight", props: {eyebrow: "Overview", heading: "About the project", body: "", showFacts: true, image: photo(1, "architecture-white-palms")}},
      {type: "AMENITIES", variant: "imageCards", props: {eyebrow: "Amenities", heading: "Lifestyle amenities", intro: "", columns: 3}, layout: {background: "MUTED"}},
      {type: "FEATURE_SPLIT", variant: "split", props: {eyebrow: "Investment", heading: "Why buyers are looking here",
        body: "A new address planned around open space and community living. Our advisors share the developer's latest information and help you compare it with similar launches before you decide.",
        bullets: ["Guidance from licensed advisors", "The developer's latest information", "Support from booking to handover"], image: photo(2, "living-window-view"), imageSide: "RIGHT", cta: {label: "Request the brochure", action: "ENQUIRE"}}},
      {type: "PAYMENT_PLANS", variant: "milestones", props: {eyebrow: "Payment plan", heading: "Payment plan", intro: ""}, layout: {background: "MUTED"}},
      {type: "FLOOR_PLANS", variant: "grid", props: {heading: "Floor plans", intro: "Layouts as provided by the developer. Ask our team for current availability."}},
      gallery("bento", ["pool-infinity-bay", "living-marble", "bedroom-city-view", "kitchen-marble", "bathroom-freestanding", "park-palms", "gym-city-view"], "Gallery"),
      {type: "LOCATION", variant: "mapRight", props: {eyebrow: "Location", heading: "Location and connectivity", body: "", showMap: true}},
      {type: "ENQUIRY_FORM", variant: "split", props: {heading: "Request a call back", intro: "Tell us what you are looking for and an advisor will contact you with the latest information.", submitLabel: "Request a call back",
        image: null, points: ["Latest price list", "Payment plan details", "Floor plans and availability"]}, layout: {background: "MUTED"}},
      {type: "BANNER", variant: "centered", style: {backgroundType: "IMAGE", backgroundImage: stock("marina-sunset-boat"), overlay: 60, height: "MEDIUM", width: "FULL"},
        props: {eyebrow: "", heading: "Not sure which home suits you?", body: "Speak to an advisor about the options, the process and the next steps.", cta: {label: "Talk to an advisor", action: "ENQUIRE"}, secondaryCta: {label: "WhatsApp", action: "WHATSAPP"}}},
      faq(COMMON_FAQ),
      footer,
    ];
    case "OFF_PLAN_LAUNCH": return [
      nav("Register interest"),
      {type: "HERO", variant: "fullBleed", style: hasCrmPhotos ? heroBackground("skyline-aerial-turquoise") : {backgroundType: "VIDEO", backgroundVideo: {stockId: "video-dubai-shore"}, overlay: 55},
        props: {badge: "New launch", eyebrow: "Off-plan residences", headline: "Waterfront living, reimagined", subheadline: "Register today to receive the price list, floor plans and payment plan before they are released to the public.",
          primaryCta: {label: "Register your interest", action: "ENQUIRE"}, secondaryCta: {label: "Chat on WhatsApp", action: "WHATSAPP"}, image: null, showPrice: false, showLocation: true, showFacts: true}},
      {type: "STATS", variant: "strip", props: {heading: "", items: [{source: "STARTING_PRICE", value: "", label: "Starting price"}, {source: "PAYMENT_PLAN", value: "", label: "Payment plan"}, {source: "HANDOVER", value: "", label: "Handover"}, {source: "BEDROOMS", value: "", label: "Bedrooms"}]}, layout: {spacing: "COMPACT"}},
      {type: "PROJECT_OVERVIEW", variant: "imageRight", props: {eyebrow: "The project", heading: "A new address with a view of everything", body: "", showFacts: true, image: photo(1, "living-window-view")}},
      {type: "FEATURE_SPLIT", variant: "split", props: {eyebrow: "Lifestyle", heading: "Designed for living well", body: "Light-filled interiors, generous proportions and considered details create homes that feel calm, open and connected to the city around them.",
        bullets: ["Open-plan living spaces", "Floor-to-ceiling glazing", "Considered, contemporary finishes"], image: photo(2, "living-sectional"), imageSide: "LEFT", cta: {label: "Request floor plans", action: "ENQUIRE"}}},
      {type: "AMENITIES", variant: "imageCards", props: {eyebrow: "Amenities", heading: "Everything close at hand", intro: "", columns: 3}, layout: {background: "MUTED"}},
      gallery("bento", ["pool-infinity-bay", "living-marble", "bedroom-city-view", "kitchen-marble", "bathroom-freestanding", "marina-night-boats", "gym-city-view"]),
      {type: "PAYMENT_PLANS", variant: "milestones", props: {eyebrow: "Investment", heading: "A clear path to ownership", intro: "Book with a down payment, pay as the project is built and settle the balance on handover."}},
      {type: "UNIT_TYPES", variant: "cards", props: {heading: "Choose your residence", intro: "Indicative starting prices for the units currently available."}, layout: {background: "MUTED"}},
      {type: "FLOOR_PLANS", variant: "grid", props: {heading: "Floor plans", intro: ""}},
      {type: "VIDEO_SHOWCASE", variant: "wide", props: {eyebrow: "The lifestyle", heading: "Life above the city", body: "", video: {stockId: "video-rooftop-pool"}, poster: null}},
      {type: "LOCATION", variant: "mapRight", props: {eyebrow: "Location", heading: "At the heart of it all", body: "Well connected to the city's business districts, beaches and leisure destinations.", showMap: true}},
      {type: "DEVELOPER", variant: "banner", props: {heading: "The developer", body: ""}},
      {type: "BANNER", variant: "centered", style: {backgroundType: "IMAGE", backgroundImage: stock("skyline-sunset"), overlay: 55, height: "MEDIUM", width: "FULL"},
        props: {eyebrow: "Limited release", heading: "Be first in line", body: "Priority access to launch availability and the widest choice of residences.", cta: {label: "Register your interest", action: "ENQUIRE"}, secondaryCta: null}},
      faq(COMMON_FAQ),
      {type: "ENQUIRY_FORM", variant: "imageSplit", props: {heading: "Get the price list and floor plans", intro: "Leave your details and an advisor will send you the latest information today.", submitLabel: "Send me the details",
        image: stock("advisor-keys"), points: ["Latest availability", "Payment plan details", "Priority booking support"]}},
      footer,
    ];
    case "LUXURY_APARTMENT": return [
      nav(),
      {type: "HERO", variant: "fullBleed", style: heroBackground("living-window-view"),
        props: {badge: "Exclusive residence", eyebrow: "", headline: "Refined living, thoughtfully designed", subheadline: "A residence of quiet luxury, with space, light and views to match.",
          primaryCta: {label: "Arrange a private viewing", action: "ENQUIRE"}, secondaryCta: {label: "View gallery", action: "GALLERY"}, image: null, showPrice: true, showLocation: true, showFacts: false}},
      {type: "STATS", variant: "strip", props: {heading: "", items: [{source: "STARTING_PRICE", value: "", label: "Asking price"}, {source: "BEDROOMS", value: "", label: "Bedrooms"}, {source: "SIZE", value: "", label: "Built-up area"}, {source: "LOCATION", value: "", label: "Community"}]}, layout: {spacing: "COMPACT"}},
      {type: "PROJECT_OVERVIEW", variant: "imageRight", props: {eyebrow: "The residence", heading: "Every detail considered", body: "", showFacts: true, image: photo(1, "bedroom-luxury")}},
      {type: "FEATURE_SPLIT", variant: "overlap", props: {eyebrow: "Interiors", heading: "Spaces that feel like home from the first day", body: "Generous rooms, natural light and a calm, contemporary palette make this a home for entertaining and for unwinding.",
        bullets: [], image: photo(2, "kitchen-marble"), imageSide: "RIGHT", cta: null}},
      gallery("bento", ["living-marble", "bedroom-city-view", "kitchen-island", "bathroom-marble", "living-neutral", "pool-ocean", "skyline-downtown-lights"]),
      {type: "AMENITIES", variant: "imageCards", props: {eyebrow: "Amenities", heading: "Building amenities", intro: "", columns: 3}, layout: {background: "MUTED"}},
      {type: "LOCATION", variant: "mapRight", props: {eyebrow: "Location", heading: "An address that keeps you connected", body: "", showMap: true}},
      {type: "BANNER", variant: "centered", style: {backgroundType: "IMAGE", backgroundImage: stock("skyline-night-trails"), overlay: 55, height: "MEDIUM", width: "FULL"},
        props: {eyebrow: "", heading: "See it for yourself", body: "Book a private viewing at a time that suits you.", cta: {label: "Book a viewing", action: "ENQUIRE"}, secondaryCta: {label: "Chat on WhatsApp", action: "WHATSAPP"}}},
      {type: "ENQUIRY_FORM", variant: "imageSplit", props: {heading: "Arrange a private viewing", intro: "Leave your details and our team will be in touch to arrange your visit.", submitLabel: "Request a viewing", image: photo(3, "living-bright"), points: []}},
      footer,
    ];
    case "VILLA_TOWNHOUSE": return [
      nav(),
      {type: "HERO", variant: "split", style: {height: "TALL", width: "WIDE"},
        props: {badge: "", eyebrow: "Family home", headline: "Space to live, room to grow", subheadline: "A home designed around family life, indoors and out.",
          primaryCta: {label: "Book a viewing", action: "ENQUIRE"}, secondaryCta: {label: "Call us", action: "CALL"}, image: photo(0, "villa-white-pool"), showPrice: true, showLocation: true, showFacts: false}},
      {type: "STATS", variant: "cards", props: {heading: "", items: [{source: "STARTING_PRICE", value: "", label: "Price"}, {source: "BEDROOMS", value: "", label: "Bedrooms"}, {source: "SIZE", value: "", label: "Built-up area"}, {source: "PROPERTY_TYPE", value: "", label: "Type"}]}, layout: {background: "MUTED", spacing: "COMPACT"}},
      {type: "HIGHLIGHTS", variant: "grid", props: {eyebrow: "Why you'll love it", heading: "Made for everyday life", intro: "", columns: 3, items: [
        {title: "Room for everyone", text: "Bedrooms and living spaces that give every member of the family their own place.", icon: "KEY"},
        {title: "Indoor-outdoor living", text: "Living areas that open onto outdoor space for relaxed gatherings.", icon: "TREES"},
        {title: "A community feel", text: "A neighbourhood setting designed for families.", icon: "SHIELD"},
      ]}},
      {type: "FEATURE_SPLIT", variant: "split", props: {eyebrow: "The home", heading: "Light, space and calm", body: "Thoughtful layouts and natural light make every room feel open and welcoming.", bullets: [], image: photo(1, "villa-palms"), imageSide: "LEFT", cta: null}},
      gallery("grid", ["villa-modern-pool", "living-bright", "kitchen-white", "bedroom-arched", "bathroom-freestanding", "park-palms"], "Gallery"),
      {type: "AMENITIES", variant: "imageCards", props: {eyebrow: "Community", heading: "Amenities", intro: "", columns: 3}, layout: {background: "MUTED"}},
      {type: "LOCATION", variant: "mapRight", props: {eyebrow: "Location", heading: "A neighbourhood to call home", body: "", showMap: true}},
      {type: "CALL_CTA", variant: "banner", props: {heading: "Prefer to talk it through?", body: "Our team is happy to answer your questions.", buttonLabel: "Call us"}, layout: {background: "ACCENT"}},
      {type: "ENQUIRY_FORM", variant: "imageSplit", props: {heading: "Book a viewing", intro: "Tell us when suits you and we will arrange your visit.", submitLabel: "Request a viewing", image: photo(2, "villa-mansion"), points: []}},
      footer,
    ];
    case "INVESTMENT_ENQUIRY": return [
      nav("Speak to an advisor"),
      {type: "HERO", variant: "splitForm", style: {backgroundType: "IMAGE", backgroundImage: photo(0, "skyline-burj-interchange"), overlay: 65, height: "SCREEN", width: "WIDE"},
        props: {badge: "Investment opportunity", eyebrow: "", headline: "Invest with clarity", subheadline: "Request the full investment details and speak with an advisor about the options that fit your goals.",
          primaryCta: {label: "Request details", action: "ENQUIRE"}, secondaryCta: null, image: null, showPrice: true, showLocation: true, showFacts: false}},
      {type: "STATS", variant: "strip", props: {heading: "", items: [{source: "STARTING_PRICE", value: "", label: "Starting price"}, {source: "PAYMENT_PLAN", value: "", label: "Payment plan"}, {source: "HANDOVER", value: "", label: "Handover"}, {source: "DEVELOPER", value: "", label: "Developer"}]}, layout: {spacing: "COMPACT"}},
      {type: "PRICING", variant: "cards", props: {heading: "Pricing", intro: "", note: "Prices are as recorded on the date shown and may change"}},
      {type: "UNIT_TYPES", variant: "table", props: {heading: "Available units", intro: ""}, layout: {background: "MUTED"}},
      {type: "PAYMENT_PLANS", variant: "milestones", props: {eyebrow: "Payment plan", heading: "Structured payments", intro: ""}},
      {type: "FEATURE_SPLIT", variant: "split", props: {eyebrow: "Advisory", heading: "Guidance at every step", body: "From shortlisting to handover, our advisors help you compare options, understand the process and move forward with confidence.",
        bullets: ["Independent comparison of options", "Support with documentation", "A single point of contact"], image: stock("advisor-table"), imageSide: "RIGHT", cta: {label: "Speak to an advisor", action: "ENQUIRE"}}},
      {type: "LOCATION", variant: "mapTop", props: {eyebrow: "Location", heading: "Location", body: "", showMap: true}},
      faq(COMMON_FAQ),
      {type: "ENQUIRY_FORM", variant: "split", props: {heading: "Request the investment details", intro: "Our advisors will contact you with the latest information.", submitLabel: "Request details", image: null, points: ["Latest pricing", "Payment plan options", "Availability"]}},
      footer,
    ];
    case "RENTAL_CAMPAIGN": return [
      nav("Book a viewing"),
      {type: "HERO", variant: "fullBleed", style: heroBackground("living-sectional"),
        props: {badge: "Available to rent", eyebrow: "", headline: "Your next home is ready", subheadline: "Move-in ready and close to everything you need.",
          primaryCta: {label: "Book a viewing", action: "ENQUIRE"}, secondaryCta: {label: "WhatsApp us", action: "WHATSAPP"}, image: null, showPrice: true, showLocation: true, showFacts: false}},
      {type: "STATS", variant: "strip", props: {heading: "", items: [{source: "STARTING_PRICE", value: "", label: "Rent"}, {source: "BEDROOMS", value: "", label: "Bedrooms"}, {source: "SIZE", value: "", label: "Size"}, {source: "LOCATION", value: "", label: "Community"}]}, layout: {spacing: "COMPACT"}},
      gallery("carousel", ["living-sectional", "bedroom-arched", "kitchen-island", "bathroom-marble", "pool-lounge", "gym-treadmills"], "Take a look inside"),
      {type: "PROJECT_OVERVIEW", variant: "withFacts", props: {eyebrow: "", heading: "About the home", body: "", showFacts: true, image: null}},
      {type: "AMENITIES", variant: "imageCards", props: {eyebrow: "", heading: "Amenities", intro: "", columns: 3}, layout: {background: "MUTED"}},
      {type: "LOCATION", variant: "mapRight", props: {eyebrow: "Location", heading: "Where you'll live", body: "", showMap: true}},
      {type: "WHATSAPP_CTA", variant: "card", props: {heading: "Questions? Chat with us", body: "We usually reply quickly.", buttonLabel: "Chat on WhatsApp", prefilledMessage: "Hello, I am interested in this rental."}},
      {type: "ENQUIRY_FORM", variant: "imageSplit", props: {heading: "Book a viewing", intro: "Leave your details and we will confirm a time that suits you.", submitLabel: "Book a viewing", image: photo(1, "living-bright"), points: []}},
      footer,
    ];
    case "DEVELOPER_SHOWCASE": return [
      nav(),
      {type: "HERO", variant: "fullBleed", style: hasCrmPhotos ? heroBackground("skyline-downtown-lights") : {backgroundType: "VIDEO", backgroundVideo: {stockId: "video-dubai-mosque-towers"}, overlay: 55},
        props: {badge: "", eyebrow: "Project showcase", headline: "Discover the project", subheadline: "Architecture, lifestyle and location brought together.",
          primaryCta: {label: "Enquire now", action: "ENQUIRE"}, secondaryCta: {label: "View gallery", action: "GALLERY"}, image: null, showPrice: false, showLocation: true, showFacts: true}},
      {type: "DEVELOPER", variant: "banner", props: {heading: "The developer", body: ""}},
      {type: "PROJECT_OVERVIEW", variant: "imageRight", props: {eyebrow: "Overview", heading: "The vision", body: "", showFacts: true, image: photo(1, "architecture-curves")}},
      {type: "VIDEO_SHOWCASE", variant: "wide", props: {eyebrow: "", heading: "", body: "", video: {stockId: "video-living-modern"}, poster: null}},
      gallery("bento", ["architecture-white-palms", "living-window-view", "pool-infinity-bay", "bedroom-luxury", "kitchen-marble", "marina-reflections", "spa-candles"]),
      {type: "UNIT_TYPES", variant: "cards", props: {heading: "Residences", intro: ""}, layout: {background: "MUTED"}},
      {type: "FLOOR_PLANS", variant: "grid", props: {heading: "Floor plans", intro: ""}},
      {type: "AMENITIES", variant: "imageCards", props: {eyebrow: "Amenities", heading: "Amenities", intro: "", columns: 3}, layout: {background: "MUTED"}},
      {type: "LOCATION", variant: "mapRight", props: {eyebrow: "Location", heading: "Location", body: "", showMap: true}},
      {type: "BANNER", variant: "centered", style: {backgroundType: "IMAGE", backgroundImage: stock("marina-sunset-boat"), overlay: 50, height: "MEDIUM", width: "FULL"},
        props: {eyebrow: "", heading: "Find your place in the story", body: "", cta: {label: "Enquire now", action: "ENQUIRE"}, secondaryCta: null}},
      {type: "ENQUIRY_FORM", variant: "imageSplit", props: {heading: "Request more information", intro: "", submitLabel: "Send enquiry", image: stock("advisor-deal"), points: []}},
      footer,
    ];
    case "COMING_SOON": return [
      nav("Register"),
      {type: "HERO", variant: "centered", style: {backgroundType: "VIDEO", backgroundVideo: {stockId: "video-infinity-pool"}, overlay: 60, height: "SCREEN", width: "FULL"},
        props: {badge: "Coming soon", eyebrow: "", headline: "Something new is coming", subheadline: "Register now to receive the details first, before the public launch.",
          primaryCta: {label: "Register your interest", action: "ENQUIRE"}, secondaryCta: null, image: null, showPrice: false, showLocation: true, showFacts: false}},
      {type: "COUNTDOWN", variant: "banner", props: {heading: "Launching soon", body: "", target: "LAUNCH_DATE"}, layout: {background: "MUTED"}},
      {type: "HIGHLIGHTS", variant: "grid", props: {eyebrow: "Why register now", heading: "Be among the first", intro: "", columns: 3, items: [
        {title: "First access", text: "Receive the details before the public release.", icon: "STAR"},
        {title: "Priority choice", text: "Early registrants hear about availability first.", icon: "KEY"},
        {title: "Expert guidance", text: "An advisor will walk you through every step.", icon: "SHIELD"},
      ]}},
      {type: "FEATURE_SPLIT", variant: "split", props: {eyebrow: "The vision", heading: "A new way to live", body: "Contemporary homes in a setting designed for the way people want to live today.", bullets: [], image: photo(0, "architecture-white-palms"), imageSide: "RIGHT", cta: null}},
      {type: "ENQUIRY_FORM", variant: "imageSplit", props: {heading: "Register your interest", intro: "Be the first to receive launch details.", submitLabel: "Register", image: photo(1, "skyline-sunset"), points: ["Launch details first", "Priority access"]}},
      footer,
    ];
  }
}

export const PAGE_TEMPLATES: Record<TemplateKey, PageTemplate> = Object.fromEntries(([
  ["PROJECT_SHOWCASE", "New project showcase", "Hero with the enquiry form and key facts, overview, amenities, investment, payment plan, floor plans, gallery, location and a call-back form.", "MODERN_CORPORATE", "project"],
  ["OFF_PLAN_LAUNCH", "Off-plan project launch", "Video hero, key facts, lifestyle, amenities, payment plan, units, floor plans and a launch banner.", "PREMIUM_DARK", "project"],
  ["LUXURY_APARTMENT", "Luxury apartment campaign", "Full-screen photo hero, interiors, bento gallery and a private-viewing enquiry.", "LUXURY_MINIMALIST", "listing"],
  ["VILLA_TOWNHOUSE", "Villa / townhouse listing", "Split hero, family highlights, gallery, community amenities and a call option.", "ELEGANT_LIGHT", "listing"],
  ["INVESTMENT_ENQUIRY", "Property investment enquiry", "Hero with the enquiry form, pricing, units, payment plan and advisory.", "MODERN_CORPORATE", "project"],
  ["RENTAL_CAMPAIGN", "Rental property campaign", "Photo hero, swipeable gallery, amenities and WhatsApp.", "CONTEMPORARY", "listing"],
  ["DEVELOPER_SHOWCASE", "Developer project showcase", "Video hero, the developer, a video showcase, residences and floor plans.", "LUXURY_MINIMALIST", "project"],
  ["COMING_SOON", "Coming soon / register interest", "Video hero, launch countdown and a short registration page.", "HIGH_CONVERSION", "any"],
] as const).map(([key, name, description, style, bestFor]) => [key, {key, name, description, style, bestFor, sections: templateParts(key, {}).map(part => part.type)}])) as Record<TemplateKey, PageTemplate>;

function build(parts: Part[], style: DesignStyle): PageData {
  const used = new Map<SectionType, number>();
  const sections = parts.map(part => {
    const count = (used.get(part.type) ?? 0) + 1;
    used.set(part.type, count);
    const id = `${part.type.toLowerCase().replaceAll("_", "-")}-${count === 1 ? "main" : count}`;
    const props = {...defaultProps(part.type), ...(part.props ?? {})} as SectionProps<typeof part.type>;
    const section = createSection(part.type, id, props, part.variant, part.style) as PageSection;
    return part.layout ? {...section, layout: {...section.layout, ...part.layout}} as PageSection : section;
  });
  return pageDataSchema.parse({schemaVersion: PAGE_SCHEMA_VERSION, theme: defaultTheme(style), sections});
}

/** A validated page built from a template; CRM photo IDs (from the linked records) replace stock photos where given. */
export function pageFromTemplate(key: TemplateKey, options: TemplateOptions = {}): PageData {
  return build(templateParts(key, options), PAGE_TEMPLATES[key].style);
}

/** A blank page: a navigation bar, a hero, an enquiry form and the footer. */
export function blankPage(style: DesignStyle = "CONTEMPORARY", options: TemplateOptions = {}): PageData {
  const {heroBackground} = builder(options);
  return build([
    nav(),
    {type: "HERO", variant: "fullBleed", style: heroBackground("skyline-sunset"), props: {...defaultProps("HERO"), showFacts: true}},
    {type: "ENQUIRY_FORM", variant: "card"},
    footer,
  ], style);
}
