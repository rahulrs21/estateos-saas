import type { DesignStyle, PageSection, SectionStyle, SectionType } from "./registry";

/**
 * Page structures (docs/AI_PAGE_BUILDER.md#page-structures): the shape of a
 * generated page, separate from its design style. A structure fixes which
 * sections a page has, in which order, and which variant and layout each one
 * uses, so two pages about the same project can look completely different.
 *
 * SIGNATURE is the original EstateOS layout and changes nothing: Claude
 * chooses the sections and their order as before, and the mapping keeps its
 * original variants. Every other structure is applied by the server after
 * Claude answers (ai.ts applyStructure): sections outside the structure are
 * left out and the rest are put in the structure's order, so a structure
 * holds even if Claude strays from it.
 */

export const PAGE_STRUCTURES = ["SIGNATURE", "STORY", "SHOWCASE_3D", "BENTO", "GALLERY_FIRST", "MINIMAL", "QUICK_LAUNCH", "INVESTOR", "PRESTIGE", "NOIR", "BOUTIQUE", "LISTING", "CAMPAIGN"] as const;
export type PageStructure = (typeof PAGE_STRUCTURES)[number];

type Layout = Partial<PageSection["layout"]>;

export interface StructureDefinition {
  label: string;
  description: string;
  /** Sections in order (a type listed twice may appear twice). Null keeps Claude's own choice and order (SIGNATURE). */
  order: SectionType[] | null;
  /** Variant per section type; a list is used in turn by repeated sections. */
  variants: Partial<Record<SectionType, string | string[]>>;
  /** How the hero shows its photo: as the section background (as before), or as a picture beside or below the text. */
  hero: "BACKGROUND" | "IMAGE";
  heroStyle?: Partial<SectionStyle>;
  /** false hides the hero's fact strip, for structures whose next section already shows the key facts. */
  heroFacts?: boolean;
  /** Section style and layout per type, on top of the mapping's own. */
  styles?: Partial<Record<SectionType, Partial<SectionStyle>>>;
  layouts?: Partial<Record<SectionType, Layout>>;
  /** PLAIN keeps every section on the page background (bento tiles, minimal pages); ALTERNATE keeps the mapping's muted bands. */
  backgrounds: "ALTERNATE" | "PLAIN";
  navbar: "transparent" | "solid" | "floating" | "centered";
  footer: "detailed" | "simple";
  /** Wireframe blocks for the structure picker: [label, relative height]. */
  wireframe: Array<[string, number]>;
}

const BASE_STRUCTURES: Record<"SIGNATURE" | "STORY" | "SHOWCASE_3D" | "BENTO" | "GALLERY_FIRST" | "MINIMAL" | "QUICK_LAUNCH" | "INVESTOR", StructureDefinition> = {
  SIGNATURE: {
    label: "Signature", description: "The original EstateOS campaign page: full-screen hero, key facts, lifestyle features, gallery, plans, location and FAQ.",
    order: null, variants: {}, hero: "BACKGROUND", backgrounds: "ALTERNATE", navbar: "transparent", footer: "detailed",
    wireframe: [["Full-screen hero", 5], ["Key facts", 1], ["Overview", 2], ["Features", 3], ["Gallery", 2], ["Plans", 2], ["Location", 2], ["Enquire", 2]],
  },
  STORY: {
    label: "Story scroll", description: "A long, magazine-like read: a headline over a wide photo, then chapters that alternate text and imagery.",
    order: ["HERO", "PROJECT_OVERVIEW", "FEATURE_SPLIT", "FEATURE_SPLIT", "FEATURE_SPLIT", "GALLERY", "AMENITIES", "PAYMENT_PLANS", "LOCATION", "DEVELOPER", "FAQ", "ENQUIRY_FORM", "FOOTER"],
    variants: {HERO: "editorial", PROJECT_OVERVIEW: "text", FEATURE_SPLIT: ["overlap", "split", "overlap"], GALLERY: "carousel", AMENITIES: "list", PAYMENT_PLANS: "timeline", LOCATION: "mapTop", DEVELOPER: "card", FAQ: "list", ENQUIRY_FORM: "split"},
    hero: "IMAGE", heroStyle: {height: "AUTO", width: "WIDE", animation: "FADE"}, backgrounds: "PLAIN", navbar: "solid", footer: "detailed",
    layouts: {PROJECT_OVERVIEW: {spacing: "SPACIOUS"}},
    wireframe: [["Headline", 2], ["Wide photo", 3], ["Chapter 1", 3], ["Chapter 2", 3], ["Chapter 3", 3], ["Photo strip", 2], ["Enquire", 2]],
  },
  SHOWCASE_3D: {
    label: "Cinematic showcase", description: "A giant name over a full-screen photo with layered parallax, a statement overview with big figures, numbered residences, dark amenity bands and numbered services.",
    order: ["HERO", "PROJECT_OVERVIEW", "UNIT_TYPES", "FEATURE_SPLIT", "FEATURE_SPLIT", "HIGHLIGHTS", "GALLERY", "PAYMENT_PLANS", "LOCATION", "FAQ", "ENQUIRY_FORM", "FOOTER"],
    variants: {HERO: "wordmark", PROJECT_OVERVIEW: "statement", UNIT_TYPES: "cards", FEATURE_SPLIT: "split", HIGHLIGHTS: "rows", GALLERY: "carousel", PAYMENT_PLANS: "milestones", LOCATION: "mapRight", FAQ: "list", ENQUIRY_FORM: "split"},
    hero: "BACKGROUND", backgrounds: "PLAIN", navbar: "floating", footer: "detailed",
    styles: {HERO: {overlay: 35, animation: "NONE"}, GALLERY: {width: "WIDE"}},
    layouts: {HERO: {spacing: "COMPACT"}, UNIT_TYPES: {background: "DARK"}, FEATURE_SPLIT: {background: "DARK"}, GALLERY: {background: "DARK"}, LOCATION: {background: "DARK"}, PROJECT_OVERVIEW: {spacing: "SPACIOUS"}},
    wireframe: [["Giant name", 5], ["Statement", 2], ["Residences 01–04", 2], ["Dark amenities", 3], ["Services (01)", 2], ["Photos", 2], ["Enquire", 2]],
  },
  BENTO: {
    label: "Bento grid", description: "Compact tiles you can scan in seconds: facts, highlights, a mosaic gallery, amenities, units and payment plan.",
    order: ["HERO", "STATS", "HIGHLIGHTS", "GALLERY", "AMENITIES", "UNIT_TYPES", "PAYMENT_PLANS", "LOCATION", "FAQ", "ENQUIRY_FORM", "FOOTER"],
    variants: {HERO: "split", STATS: "cards", HIGHLIGHTS: "grid", GALLERY: "bento", AMENITIES: "icons", UNIT_TYPES: "cards", PAYMENT_PLANS: "milestones", LOCATION: "mapRight", FAQ: "accordion", ENQUIRY_FORM: "split"},
    hero: "IMAGE", heroStyle: {height: "AUTO", width: "BOXED", animation: "FADE"}, heroFacts: false, backgrounds: "PLAIN", navbar: "solid", footer: "simple",
    layouts: {STATS: {spacing: "COMPACT"}, HIGHLIGHTS: {spacing: "COMPACT"}, GALLERY: {spacing: "COMPACT"}, AMENITIES: {spacing: "COMPACT"}, UNIT_TYPES: {spacing: "COMPACT"}, PAYMENT_PLANS: {spacing: "COMPACT"}, LOCATION: {spacing: "COMPACT"}, FAQ: {spacing: "COMPACT"}},
    wireframe: [["Hero tile", 3], ["Fact tiles", 1], ["Highlight tiles", 2], ["Mosaic", 3], ["Amenities", 1], ["Units", 2], ["Enquire", 2]],
  },
  GALLERY_FIRST: {
    label: "Visual gallery", description: "Photo-led and immersive: a full-screen photo, a mosaic, a coverflow, video and image-card amenities. Few words.",
    order: ["HERO", "GALLERY", "FEATURE_SPLIT", "GALLERY", "VIDEO_SHOWCASE", "AMENITIES", "LOCATION", "BANNER", "ENQUIRY_FORM", "FOOTER"],
    variants: {HERO: "fullBleed", GALLERY: ["bento", "coverflow"], FEATURE_SPLIT: "overlap", VIDEO_SHOWCASE: "wide", AMENITIES: "imageCards", LOCATION: "mapTop", BANNER: "centered", ENQUIRY_FORM: "imageSplit"},
    hero: "BACKGROUND", backgrounds: "PLAIN", navbar: "transparent", footer: "simple",
    styles: {GALLERY: {width: "WIDE"}, VIDEO_SHOWCASE: {width: "WIDE"}},
    wireframe: [["Full-screen photo", 5], ["Mosaic", 3], ["Feature", 3], ["Coverflow", 2], ["Video", 3], ["Amenity photos", 2], ["Enquire", 2]],
  },
  MINIMAL: {
    label: "Minimal essentials", description: "Only what matters, with lots of space: a typographic hero, overview with facts, units and payment tables, location and FAQ.",
    order: ["HERO", "STATS", "PROJECT_OVERVIEW", "GALLERY", "UNIT_TYPES", "PAYMENT_PLANS", "LOCATION", "FAQ", "ENQUIRY_FORM", "FOOTER"],
    variants: {HERO: "centered", STATS: "strip", PROJECT_OVERVIEW: "withFacts", GALLERY: "grid", UNIT_TYPES: "table", PAYMENT_PLANS: "table", LOCATION: "mapTop", FAQ: "list", ENQUIRY_FORM: "split"},
    hero: "IMAGE", heroStyle: {height: "AUTO", width: "BOXED", animation: "FADE"}, heroFacts: false, backgrounds: "PLAIN", navbar: "solid", footer: "simple",
    layouts: {HERO: {spacing: "SPACIOUS"}, PROJECT_OVERVIEW: {spacing: "SPACIOUS"}},
    wireframe: [["Big headline", 2], ["Wide photo", 2], ["Facts", 1], ["Overview", 2], ["Photo grid", 2], ["Tables", 2], ["Enquire", 2]],
  },
  QUICK_LAUNCH: {
    label: "Quick launch", description: "A short campaign page for ads: punchy hero, a moving ticker of facts, highlights, payment plan and the form early.",
    order: ["HERO", "STATS", "HIGHLIGHTS", "ENQUIRY_FORM", "GALLERY", "PAYMENT_PLANS", "WHATSAPP_CTA", "FAQ", "FOOTER"],
    variants: {HERO: "split", STATS: "marquee", HIGHLIGHTS: "grid", ENQUIRY_FORM: "split", GALLERY: "carousel", PAYMENT_PLANS: "milestones", WHATSAPP_CTA: "banner", FAQ: "accordion"},
    hero: "IMAGE", heroStyle: {height: "AUTO", width: "WIDE", animation: "FADE"}, heroFacts: false, backgrounds: "ALTERNATE", navbar: "solid", footer: "simple",
    layouts: {STATS: {spacing: "NONE"}, WHATSAPP_CTA: {background: "ACCENT"}},
    wireframe: [["Hero + photo", 3], ["Ticker", 1], ["Highlights", 2], ["Enquire", 2], ["Photos", 2], ["Payment plan", 2], ["WhatsApp", 1]],
  },
  INVESTOR: {
    label: "Investor brief", description: "Numbers first: key facts, prices, payment plan and units up front, then the overview, developer and location.",
    order: ["HERO", "STATS", "PRICING", "PAYMENT_PLANS", "UNIT_TYPES", "PROJECT_OVERVIEW", "DEVELOPER", "LOCATION", "FAQ", "ENQUIRY_FORM", "FOOTER"],
    variants: {HERO: "split", STATS: "cards", PRICING: "cards", PAYMENT_PLANS: "milestones", UNIT_TYPES: "table", PROJECT_OVERVIEW: "imageRight", DEVELOPER: "banner", LOCATION: "mapRight", FAQ: "accordion", ENQUIRY_FORM: "split"},
    hero: "IMAGE", heroStyle: {height: "AUTO", width: "BOXED", animation: "FADE"}, heroFacts: false, backgrounds: "ALTERNATE", navbar: "solid", footer: "detailed",
    wireframe: [["Hero + photo", 3], ["Fact cards", 1], ["Prices", 2], ["Payment plan", 2], ["Units table", 2], ["Overview", 2], ["Enquire", 2]],
  },
};

const SIGNATURE_STRUCTURES: Record<"PRESTIGE" | "NOIR" | "BOUTIQUE" | "LISTING" | "CAMPAIGN", StructureDefinition> = {
  PRESTIGE: {
    label: "Prestige", description: "Quiet luxury: a centred logo, the headline set low over a full-screen photo, an overview beside a portrait, a photo grid with captions and tables of units and plans.",
    order: ["HERO", "PROJECT_OVERVIEW", "GALLERY", "AMENITIES", "UNIT_TYPES", "PAYMENT_PLANS", "LOCATION", "DEVELOPER", "FAQ", "ENQUIRY_FORM", "FOOTER"],
    variants: {HERO: "fullBleed", PROJECT_OVERVIEW: "imageRight", GALLERY: "grid", AMENITIES: "imageCards", UNIT_TYPES: "table", PAYMENT_PLANS: "milestones", LOCATION: "mapRight", DEVELOPER: "banner", FAQ: "accordion", ENQUIRY_FORM: "split"},
    hero: "BACKGROUND", backgrounds: "ALTERNATE", navbar: "centered", footer: "detailed",
    styles: {HERO: {overlay: 40}},
    layouts: {PROJECT_OVERVIEW: {spacing: "SPACIOUS"}, GALLERY: {background: "MUTED"}, UNIT_TYPES: {background: "MUTED"}},
    wireframe: [["Centred logo · photo", 5], ["Overview + portrait", 3], ["Photo grid", 3], ["Amenities", 2], ["Units table", 2], ["Plan", 1], ["Enquire", 2]],
  },
  NOIR: {
    label: "Noir gallery", description: "Dark and cinematic: a large statement over the photo, a fact strip, an overlapping feature, a mosaic, film, a payment timeline and the location.",
    order: ["HERO", "FEATURE_SPLIT", "GALLERY", "VIDEO_SHOWCASE", "AMENITIES", "PAYMENT_PLANS", "LOCATION", "FAQ", "ENQUIRY_FORM", "FOOTER"],
    variants: {HERO: "fullBleed", FEATURE_SPLIT: "overlap", GALLERY: "bento", VIDEO_SHOWCASE: "wide", AMENITIES: "list", PAYMENT_PLANS: "timeline", LOCATION: "mapTop", FAQ: "accordion", ENQUIRY_FORM: "imageSplit"},
    hero: "BACKGROUND", backgrounds: "PLAIN", navbar: "transparent", footer: "simple",
    styles: {HERO: {overlay: 45}, GALLERY: {width: "WIDE"}, VIDEO_SHOWCASE: {width: "WIDE"}},
    wireframe: [["Statement + facts", 5], ["Overlap feature", 3], ["Mosaic", 3], ["Film", 2], ["Timeline", 2], ["Enquire", 2]],
  },
  BOUTIQUE: {
    label: "Boutique", description: "Warm and personal: a big serif headline over the photo with a line of facts, two lifestyle features, a photo carousel, amenity photos and the units.",
    order: ["HERO", "FEATURE_SPLIT", "FEATURE_SPLIT", "GALLERY", "AMENITIES", "UNIT_TYPES", "LOCATION", "FAQ", "ENQUIRY_FORM", "FOOTER"],
    variants: {HERO: "centered", FEATURE_SPLIT: ["split", "split"], GALLERY: "carousel", AMENITIES: "imageCards", UNIT_TYPES: "cards", LOCATION: "mapTop", FAQ: "accordion", ENQUIRY_FORM: "imageSplit"},
    hero: "BACKGROUND", backgrounds: "ALTERNATE", navbar: "transparent", footer: "detailed",
    styles: {HERO: {overlay: 40, height: "TALL"}},
    wireframe: [["Serif headline + facts", 5], ["Feature", 3], ["Feature", 3], ["Carousel", 2], ["Amenity photos", 2], ["Enquire", 2]],
  },
  LISTING: {
    label: "Property card", description: "A listing-style page: a frosted card with the key details over the photo and a fact bar, a mosaic, the overview with facts, amenities and floor plans.",
    order: ["HERO", "GALLERY", "PROJECT_OVERVIEW", "FEATURE_SPLIT", "AMENITIES", "FLOOR_PLANS", "PAYMENT_PLANS", "LOCATION", "FAQ", "ENQUIRY_FORM", "FOOTER"],
    variants: {HERO: "panel", GALLERY: "bento", PROJECT_OVERVIEW: "withFacts", FEATURE_SPLIT: "split", AMENITIES: "icons", FLOOR_PLANS: "grid", PAYMENT_PLANS: "milestones", LOCATION: "mapRight", FAQ: "accordion", ENQUIRY_FORM: "card"},
    hero: "BACKGROUND", backgrounds: "ALTERNATE", navbar: "transparent", footer: "simple",
    styles: {HERO: {overlay: 30}},
    layouts: {HERO: {spacing: "COMPACT"}, GALLERY: {spacing: "COMPACT"}},
    wireframe: [["Photo + detail card", 5], ["Mosaic", 3], ["Overview + facts", 2], ["Feature", 3], ["Amenities", 1], ["Floor plans", 2], ["Enquire", 2]],
  },
  CAMPAIGN: {
    label: "Campaign", description: "Built to convert: the enquiry form beside the headline and the key facts in the first screen, then highlights, photos, the payment plan, units and WhatsApp.",
    order: ["HERO", "HIGHLIGHTS", "GALLERY", "PAYMENT_PLANS", "UNIT_TYPES", "WHATSAPP_CTA", "FAQ", "ENQUIRY_FORM", "FOOTER"],
    variants: {HERO: "splitForm", HIGHLIGHTS: "grid", GALLERY: "carousel", PAYMENT_PLANS: "milestones", UNIT_TYPES: "cards", WHATSAPP_CTA: "banner", FAQ: "accordion", ENQUIRY_FORM: "card"},
    hero: "BACKGROUND", backgrounds: "ALTERNATE", navbar: "transparent", footer: "simple",
    styles: {HERO: {overlay: 50}},
    layouts: {WHATSAPP_CTA: {background: "ACCENT"}},
    wireframe: [["Headline + form + facts", 5], ["Highlights", 2], ["Photos", 2], ["Payment plan", 2], ["Units", 2], ["WhatsApp", 1]],
  },
};
export const STRUCTURE_DEFINITIONS: Record<PageStructure, StructureDefinition> = {...BASE_STRUCTURES, ...SIGNATURE_STRUCTURES};

/**
 * The structure each design style uses unless another one is chosen. Each
 * signature style has its own; the original layout stays available as SIGNATURE.
 */
export const STYLE_STRUCTURES: Record<DesignStyle, PageStructure> = {
  LUXURY_MINIMALIST: "PRESTIGE", PREMIUM_DARK: "NOIR", MODERN_CORPORATE: "INVESTOR", ELEGANT_LIGHT: "BOUTIQUE", CONTEMPORARY: "LISTING", HIGH_CONVERSION: "CAMPAIGN",
  DEPTH_3D: "SHOWCASE_3D", SWISS_MINIMAL: "MINIMAL", EDITORIAL: "STORY", BENTO_GRID: "BENTO", GLASS_AURORA: "GALLERY_FIRST", BOLD_STATEMENT: "QUICK_LAUNCH", WARM_ORGANIC: "STORY",
};

/** How many sections of a type a structure allows. */
export function structureAllows(structure: PageStructure, type: SectionType): number {
  const order = STRUCTURE_DEFINITIONS[structure].order;
  return order ? order.filter(item => item === type).length : Infinity;
}

/** The variant for the n-th section of a type in a structure, or null to keep the mapping's own. */
export function structureVariant(structure: PageStructure, type: SectionType, occurrence: number): string | null {
  const variant = STRUCTURE_DEFINITIONS[structure].variants[type];
  if (!variant) return null;
  return Array.isArray(variant) ? variant[occurrence % variant.length] : variant;
}

/** For Claude: each structure's sections in order. */
export function structureCatalogue() {
  return PAGE_STRUCTURES.map(key => {
    const definition = STRUCTURE_DEFINITIONS[key];
    return `- ${key} (${definition.label}): ${definition.description} ${definition.order ? `Sections: ${definition.order.join(", ")}.` : "Sections: your choice, in the typical order."}`;
  }).join("\n");
}

/**
 * The page structure for a generation: the one chosen, else the chosen
 * style's own (the signature styles keep the signature structure), else
 * null, so Claude chooses it together with the style.
 */
export function resolveStructure(style: DesignStyle | null, structure: PageStructure | null | undefined): PageStructure | null {
  return structure ?? (style ? STYLE_STRUCTURES[style] : null);
}
