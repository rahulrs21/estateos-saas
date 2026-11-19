import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { presentBranding } from "../src/modules/ai/content/facts";
import { PAGE_GENERATION_JSON, mapGeneratedPage, pageGenerationZod, pageTaskPrompt, type PageGenerationOutput } from "../src/modules/websites/ai";
import { PageRenderer } from "../src/modules/websites/components/page-renderer";
import { buildLinkedData, type LinkedSources } from "../src/modules/websites/linked";
import { generatePageSchema, generationRequestProblem, regeneratePageSchema } from "../src/modules/websites/policy";
import {
  CLASSIC_DESIGN_STYLES, DEFAULT_ELEMENT_STYLE, DESIGN_STYLES, NEW_DESIGN_STYLES, SECTION_DEFINITIONS, VARIANT_LABELS, defaultTheme, pageDataSchema, type PageData,
} from "../src/modules/websites/registry";
import { SAMPLE_TODAY, sampleMiniature, samplePage } from "../src/modules/websites/style-samples";
import { PAGE_STRUCTURES, STRUCTURE_DEFINITIONS, STYLE_STRUCTURES, resolveStructure, structureAllows } from "../src/modules/websites/structures";
import { blankPage } from "../src/modules/websites/templates";
import { STYLE_LOOKS, STYLE_TOKENS, pageLook } from "../src/modules/websites/theme";

// --- Synthetic fixtures (no real customer or company data) ---------------------

const READ_AT = "2026-11-18T08:00:00.000Z";
const branding = presentBranding({companyName: "Synthetic Realty LLC", companyPhone: "+971 4 555 0100", profile: {useCompanyPhone: true, whatsappNumber: "+971 50 555 0101"}});
const MEDIA_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sources: LinkedSources = {
  project: {
    id: "11111111-1111-4111-8111-111111111111", projectName: "Marina Test Towers", projectStatus: "ACTIVE", constructionStatus: "UNDER_CONSTRUCTION",
    developer: {name: "Test Developer"}, emirate: "DUBAI", city: "Dubai", community: "Dubai Marina", latitude: 25.08, longitude: 55.14, mapDisplayMode: "EXACT",
    launchDate: "2027-02-01", expectedHandoverDate: "2028-12-31", startingPriceMinor: "125000000", currency: "AED", totalUnits: 240,
    projectAmenities_on_project: [{amenity: {name: "Infinity pool"}}, {amenity: {name: "Gym"}}],
  },
  units: {rows: [{propertyType: "APARTMENT", bedrooms: 1, referencePriceMinor: "125000000"}], complete: true},
  paymentPlans: [{name: "60/40", isActive: true, bookingPercentageBps: 1000, handoverPercentageBps: 4000, paymentPlanInstallments_on_paymentPlan: [{position: 1, percentageBps: 5000, dueTrigger: "CONSTRUCTION_MILESTONE", constructionMilestonePercent: 50}]}],
  media: [{id: MEDIA_A, contentType: "image/jpeg", mediaKind: "PROPERTY_PHOTO", isCover: true}],
};
const linked = () => buildLinkedData(sources, branding, {readAt: READ_AT, mediaUrl: id => `/media/${id}`});

function output(types: string[], extra: Partial<PageGenerationOutput> = {}): PageGenerationOutput {
  return pageGenerationZod.parse({
    title: "Marina Test Towers", seoTitle: "Marina Test Towers", seoDescription: "Register your interest.", style: "PREMIUM_DARK", accent: "GOLD",
    sections: types.map(type => ({type, variant: "", eyebrow: "", heading: `${type} heading`, subheading: "", body: "Some words.", ctaLabel: "", ctaAction: "ENQUIRE", items: [{title: "A point", text: "Text", icon: "STAR"}]})),
    missingInformation: [], claimsToReview: [], ...extra,
  });
}
const types = (data: PageData) => data.sections.map(section => section.type);
const render = (page: ReturnType<typeof samplePage>) => renderToString(createElement(PageRenderer, {page, mode: "public", today: SAMPLE_TODAY}));

// --- Styles -----------------------------------------------------------------------

test("the six signature styles keep their place; every style has tokens, a look and a structure of its own", () => {
  assert.deepEqual([...CLASSIC_DESIGN_STYLES], ["LUXURY_MINIMALIST", "PREMIUM_DARK", "MODERN_CORPORATE", "ELEGANT_LIGHT", "CONTEMPORARY", "HIGH_CONVERSION"]);
  assert.deepEqual(DESIGN_STYLES.slice(0, 6), [...CLASSIC_DESIGN_STYLES]);
  assert.equal(NEW_DESIGN_STYLES.length, 7);
  for (const style of DESIGN_STYLES) {
    assert.ok(STYLE_TOKENS[style] && STYLE_LOOKS[style], style);
    assert.notEqual(STYLE_STRUCTURES[style], "SIGNATURE", `${style} has its own structure`);
    assert.ok(pageDataSchema.shape.theme.safeParse(defaultTheme(style)).success, `${style} has a valid default theme`);
    assert.ok(pageDataSchema.safeParse(blankPage(style)).success, `a blank page in ${style}`);
  }
  // The signature styles no longer share one layout or one look.
  assert.equal(new Set(CLASSIC_DESIGN_STYLES.map(style => STYLE_STRUCTURES[style])).size, 6);
  assert.equal(new Set(CLASSIC_DESIGN_STYLES.map(style => STYLE_LOOKS[style])).size, 6);
  assert.deepEqual(defaultTheme("LUXURY_MINIMALIST"), {style: "LUXURY_MINIMALIST", accent: "GOLD", font: "SERIF", scale: "LARGE", radius: "NONE", customAccent: null, headingFont: "JOST", bodyFont: "JOST", buttonShape: "SQUARE", edition: 2});
  assert.deepEqual(defaultTheme("DEPTH_3D"), {style: "DEPTH_3D", accent: "ONYX", font: "DISPLAY", scale: "LARGE", radius: "NONE", customAccent: null, headingFont: "INTER_TIGHT", bodyFont: "INTER_TIGHT", buttonShape: "SQUARE", edition: 2});
});

test("pages saved before the signature looks (edition 1) render exactly as before; new pages get the look", () => {
  // A stored theme has no edition: it parses as edition 1.
  const stored = pageDataSchema.shape.theme.parse({style: "CONTEMPORARY", accent: "TEAL", font: "SANS", scale: "LARGE", radius: "ROUND", customAccent: null, headingFont: "MONTSERRAT", bodyFont: "INTER", buttonShape: "ROUNDED"});
  assert.equal(stored.edition, 1);
  assert.equal(pageLook(stored), undefined);
  const page = samplePage("CONTEMPORARY", "SIGNATURE");
  assert.doesNotMatch(render({...page, data: {...page.data, theme: stored}}), /data-pg-look/, "an edition 1 page has no look");
  assert.match(render(page), /data-pg-look="panel"/, "a new page in the same style has its look");
  // The newer styles always have theirs, whatever the edition.
  assert.equal(pageLook({...defaultTheme("BENTO_GRID"), edition: 1}), "bento");
  assert.match(render(samplePage("DEPTH_3D", "SHOWCASE_3D")), /data-pg-look="depth"/);
});

// --- Structures -------------------------------------------------------------------

test("the signature structure keeps Claude's sections and order with the original variants", () => {
  const order = ["HERO", "STATS", "FAQ", "PROJECT_OVERVIEW", "GALLERY", "ENQUIRY_FORM", "FOOTER"];
  const mapped = mapGeneratedPage(output(order), linked(), {hasForm: false, fallbackTitle: "x", style: "PREMIUM_DARK", structure: "SIGNATURE"});
  assert.equal(mapped.structure, "SIGNATURE");
  assert.deepEqual(types(mapped.data), ["NAVBAR", ...order]);
  const [navbar, hero] = mapped.data.sections;
  assert.equal(navbar.variant, "transparent");
  assert.equal(navbar.type === "NAVBAR" && navbar.props.sticky, false);
  assert.equal(hero.variant, "fullBleed");
  assert.equal(hero.style.backgroundType, "IMAGE", "the CRM photo stays the hero background");
  assert.equal(mapped.data.sections.find(section => section.type === "GALLERY")?.variant, "bento");
  // Without a structure from staff or Claude, the signature structure applies (older outputs have none).
  const legacy = mapGeneratedPage(output(order), linked(), {hasForm: false, fallbackTitle: "x"});
  assert.deepEqual(legacy.data, mapped.data);
});

test("a structure fixes the sections, their order and variants, even when Claude strays", () => {
  // Claude returns the sections in its own order, with one the structure does not have.
  const mapped = mapGeneratedPage(output(["FAQ", "GALLERY", "BANNER", "HIGHLIGHTS", "STATS", "HERO", "UNIT_TYPES"]), linked(), {hasForm: false, fallbackTitle: "x", style: "BENTO_GRID", structure: "BENTO"});
  assert.deepEqual(types(mapped.data), ["NAVBAR", "HERO", "STATS", "HIGHLIGHTS", "GALLERY", "UNIT_TYPES", "FAQ", "ENQUIRY_FORM", "FOOTER"]);
  assert.ok(mapped.removed.some(message => message.includes("Banner") && message.includes("Bento grid")), mapped.removed.join(" | "));
  const variant = (type: string) => mapped.data.sections.find(section => section.type === type)?.variant;
  assert.equal(variant("HERO"), "split");
  assert.equal(variant("GALLERY"), "bento");
  assert.equal(variant("ENQUIRY_FORM"), "split", "the added enquiry form uses the structure's variant");
  // The hero photo moves from the background into the layout, so the navigation bar is solid.
  const hero = mapped.data.sections.find(section => section.type === "HERO")!;
  assert.equal(hero.style.backgroundType, "NONE");
  assert.equal(hero.type === "HERO" && hero.props.image && "mediaId" in hero.props.image && hero.props.image.mediaId, MEDIA_A, "the CRM cover photo moves into the hero layout");
  const navbar = mapped.data.sections[0];
  assert.equal(navbar.variant, "solid");
  assert.equal(navbar.type === "NAVBAR" && navbar.props.sticky, true);
  assert.equal(mapped.data.theme.style, "BENTO_GRID");
});

test("the cinematic showcase (3D Depth): a wordmark hero over the photo, a floating menu, a statement overview, numbered rows and dark bands", () => {
  const mapped = mapGeneratedPage(output(["HERO", "PROJECT_OVERVIEW", "UNIT_TYPES", "FEATURE_SPLIT", "HIGHLIGHTS", "GALLERY", "LOCATION", "FAQ", "FOOTER"]), linked(), {hasForm: false, fallbackTitle: "x", style: "DEPTH_3D", structure: "SHOWCASE_3D"});
  const section = (type: string) => mapped.data.sections.find(item => item.type === type)!;
  assert.equal(mapped.data.sections[0].variant, "floating");
  assert.equal(section("HERO").variant, "wordmark");
  assert.equal(section("HERO").style.backgroundType, "IMAGE", "the photo stays behind the name");
  assert.equal(section("PROJECT_OVERVIEW").variant, "statement");
  assert.equal(section("HIGHLIGHTS").variant, "rows");
  assert.equal(section("UNIT_TYPES").layout.background, "DARK");
  const html = render(samplePage("DEPTH_3D", "SHOWCASE_3D"));
  assert.match(html, /class="pg-wordmark [^"]*"[^>]*style="font-size:[\d.]+cqi"[^>]*><span class="block whitespace-nowrap">Azure Bay<\/span><span class="block whitespace-nowrap">Residences<\/span>/, "the record's name is the wordmark, on two balanced lines, sized to fit");
  assert.match(html, /pg-nav-floating sticky top-0/);
  assert.match(html, /pg-statement/);
  assert.match(html, /\(01\)/, "numbered rows");
  assert.match(html, /Scroll to explore/);
});

test("the signature styles each have their own layout: centred logo, noir statement, grid, boutique, property card and campaign form", () => {
  const html = (style: Parameters<typeof samplePage>[0]) => render(samplePage(style, STYLE_STRUCTURES[style]));
  const quiet = html("LUXURY_MINIMALIST");
  assert.match(quiet, /data-pg-look="quiet"/);
  assert.match(quiet, /data-section-variant="centered"/, "the logo sits between the menu links");
  assert.match(quiet, /aria-label="More page sections"/);
  assert.match(html("PREMIUM_DARK"), /data-pg-look="noir"[\s\S]*data-section-variant="overlap"/);
  assert.match(html("MODERN_CORPORATE"), /data-pg-look="grid"/);
  assert.match(html("ELEGANT_LIGHT"), /data-pg-look="boutique"[\s\S]*data-section-type="HERO" data-section-variant="centered"/);
  const card = html("CONTEMPORARY");
  assert.match(card, /pg-hero-panel/, "the details sit on a frosted card over the photo");
  assert.match(card, /pg-hero-factbar/);
  assert.match(html("HIGH_CONVERSION"), /data-section-type="HERO" data-section-variant="splitForm"/, "the form is in the first screen");
});

test("repeated sections take their places and variants in turn; the footer follows the structure", () => {
  const mapped = mapGeneratedPage(output(["HERO", "FEATURE_SPLIT", "FEATURE_SPLIT", "FEATURE_SPLIT", "FEATURE_SPLIT", "PROJECT_OVERVIEW", "FOOTER"]), linked(), {hasForm: false, fallbackTitle: "x", style: "EDITORIAL", structure: "STORY"});
  const features = mapped.data.sections.filter(section => section.type === "FEATURE_SPLIT");
  assert.equal(features.length, 3, "the story structure has three chapters");
  assert.deepEqual(features.map(section => section.variant), ["overlap", "split", "overlap"]);
  assert.deepEqual(types(mapped.data).slice(0, 3), ["NAVBAR", "HERO", "PROJECT_OVERVIEW"]);
  assert.equal(mapped.data.sections.find(section => section.type === "HERO")?.variant, "editorial");
  assert.equal(mapped.data.sections.at(-1)?.variant, "detailed");
  assert.ok(mapped.data.sections.every(section => section.layout.background !== "MUTED"), "story pages keep one background");
  assert.equal(structureAllows("STORY", "FEATURE_SPLIT"), 3);
  assert.equal(structureAllows("SIGNATURE", "FEATURE_SPLIT"), Infinity);
});

test("a style chosen by staff wins over Claude's; without one, Claude's style and structure are used", () => {
  const chosen = mapGeneratedPage(output(["HERO"], {style: "PREMIUM_DARK", structure: "SIGNATURE"}), linked(), {hasForm: false, fallbackTitle: "x", style: "BENTO_GRID", structure: "BENTO"});
  assert.equal(chosen.data.theme.style, "BENTO_GRID");
  assert.equal(chosen.structure, "BENTO");
  const claude = mapGeneratedPage(output(["HERO", "STATS"], {style: "SWISS_MINIMAL", structure: "MINIMAL"}), linked(), {hasForm: false, fallbackTitle: "x"});
  assert.equal(claude.data.theme.style, "SWISS_MINIMAL");
  assert.equal(claude.structure, "MINIMAL");
  assert.equal(claude.data.sections.find(section => section.type === "HERO")?.variant, "centered");
});

test("the structure for a generation: chosen, else the style's own, else Claude's choice", () => {
  assert.equal(resolveStructure("CONTEMPORARY", null), "LISTING", "each signature style has its own structure");
  assert.equal(resolveStructure("CONTEMPORARY", "SIGNATURE"), "SIGNATURE", "the original layout can still be chosen");
  assert.equal(resolveStructure("BOLD_STATEMENT", undefined), "QUICK_LAUNCH");
  assert.equal(resolveStructure("BOLD_STATEMENT", "INVESTOR"), "INVESTOR");
  assert.equal(resolveStructure(null, "STORY"), "STORY");
  assert.equal(resolveStructure(null, null), null);
});

test("Claude is asked for a structure from a fixed list, with the style's tone and the structure's sections", () => {
  const properties = PAGE_GENERATION_JSON.properties as Record<string, {enum?: string[]}>;
  assert.deepEqual(properties.structure.enum, [...PAGE_STRUCTURES]);
  assert.ok((PAGE_GENERATION_JSON.required as string[]).includes("structure"));
  const fixed = pageTaskPrompt({brief: "", style: "SWISS_MINIMAL", templateHint: null, structure: "MINIMAL"});
  assert.match(fixed, /SWISS_MINIMAL \(Swiss Minimal\)/);
  assert.match(fixed, /Copy tone: short, precise/);
  assert.match(fixed, /Use exactly these sections in this order: HERO, STATS, PROJECT_OVERVIEW/);
  const open = pageTaskPrompt({brief: "", style: null, templateHint: null, structure: null});
  assert.match(open, /Choose the design style/);
  assert.match(open, /- QUICK_LAUNCH \(Quick launch\)/);
  assert.match(open, /- WARM_ORGANIC \(Warm Organic\)/);
});

test("generation requests take a structure from the list only", () => {
  const base = {title: "Launch", brief: ""};
  assert.equal(generatePageSchema.safeParse({...base, structure: "BENTO"}).success, true);
  assert.equal(generatePageSchema.safeParse({...base, structure: null, style: "GLASS_AURORA"}).success, true);
  assert.equal(generatePageSchema.safeParse({...base, structure: "CUSTOM_HTML"}).success, false);
  assert.equal(regeneratePageSchema.safeParse({expectedRevision: 1, brief: "", structure: "STORY"}).success, true);
  assert.equal(regeneratePageSchema.safeParse({expectedRevision: 1, brief: "", structure: "<b>"}).success, false);
});

// --- Sample pages and new variants ------------------------------------------------

test("every style and structure builds a valid sample page that renders", () => {
  for (const style of DESIGN_STYLES) for (const structure of PAGE_STRUCTURES) {
    const page = samplePage(style, structure, 640);
    assert.ok(pageDataSchema.safeParse(page.data).success, `${style} / ${structure}`);
    const order = STRUCTURE_DEFINITIONS[structure].order;
    if (order) {
      // Every listed section shows (the sample record has the data), in the structure's order.
      const shown = types(page.data).filter(type => type !== "NAVBAR");
      assert.deepEqual(shown, order, `${style} / ${structure}`);
    }
    const html = render(page);
    assert.match(html, /Azure Bay/);
    assert.doesNotMatch(html, /<script/i);
  }
  const miniature = sampleMiniature("EDITORIAL", "STORY");
  assert.ok(miniature.data.sections.length <= 4);
  assert.ok(miniature.data.sections.every(section => section.type !== "VIDEO_SHOWCASE"), "miniatures play no video");
});

test("the new variants render: a ticker with a hidden copy, stacked cards, a coverflow, editorial and showcase heroes", () => {
  const quick = render(samplePage("BOLD_STATEMENT", "QUICK_LAUNCH"));
  assert.match(quick, /pg-marquee-track/);
  assert.match(quick, /aria-hidden="true" data-marquee-copy="true"/, "the loop copy is hidden from screen readers");
  // Variants no default structure uses any more stay available in the editor.
  const page = samplePage("CONTEMPORARY", "SIGNATURE");
  const swapped = {...page, data: {...page.data, sections: page.data.sections.map(section =>
    section.type === "HIGHLIGHTS" ? {...section, variant: "stack"} : section.type === "GALLERY" ? {...section, variant: "coverflow"} : section.type === "HERO" ? {...section, variant: "showcase", style: {...section.style, backgroundType: "NONE" as const}} : section) as PageData["sections"]}};
  const withHighlights = {...swapped, data: {...swapped.data, sections: [...swapped.data.sections.slice(0, 3), {...samplePage("DEPTH_3D", "SHOWCASE_3D").data.sections.find(section => section.type === "HIGHLIGHTS")!, id: "highlights-x", variant: "stack"}, ...swapped.data.sections.slice(3)] as PageData["sections"]}};
  const html = render(withHighlights);
  assert.match(html, /pg-stack-card sticky/);
  assert.match(html, /data-section-variant="stack"/);
  // The 3D carousel: photos on a curve, rotated by dragging, the buttons or the arrow keys; the counter says where you are.
  assert.match(html, /aria-roledescription="carousel"/);
  assert.match(html, /pg-coverflow-slot/);
  assert.match(html, /aria-label="Next photo"/);
  assert.match(html, /1 \/ \d+/);
  // The photo strip: no scrollbar, previous and next buttons instead.
  const strip = render(samplePage("EDITORIAL", "STORY"));
  assert.match(strip, /pg-carousel-track[^"]*\[scrollbar-width:none\]/);
  assert.match(strip, /aria-label="Next photos"/);
  assert.doesNotMatch(strip, /scrollbar-width:thin/);
  assert.match(render(samplePage("EDITORIAL", "STORY")), /pg-hero-wide/);
  for (const variant of ["editorial", "showcase", "wordmark", "panel"]) assert.ok((SECTION_DEFINITIONS.HERO.variants as readonly string[]).includes(variant));
});

test("sample pages are synthetic: fixed sample record, stock photos only, the preview never submits", () => {
  const page = samplePage("GLASS_AURORA", "GALLERY_FIRST");
  assert.equal(page.linked.project?.name, "Azure Bay Residences");
  assert.ok(page.linked.media.every(media => media.url.startsWith("https://images.unsplash.com/")), "sample photos come from the stock catalogue");
  const html = renderToString(createElement(PageRenderer, {page, mode: "preview", today: SAMPLE_TODAY, hideNotice: true}));
  assert.doesNotMatch(html, /Internal preview/, "the gallery hides the internal-preview notice");
  assert.match(html, /Preview only: this form does not send enquiries/);
  assert.match(renderToString(createElement(PageRenderer, {page, mode: "preview", today: SAMPLE_TODAY})), /Internal preview/, "other previews keep it");
});

test("a generation request that fails says what is wrong, including an out-of-date form", () => {
  const problem = (raw: Record<string, unknown>) => {
    const result = generatePageSchema.safeParse(raw);
    assert.equal(result.success, false, JSON.stringify(raw));
    return generationRequestProblem(result.error!.issues);
  };
  assert.match(problem({title: "", brief: ""}), /title/);
  assert.match(problem({title: "Launch", brief: "<b>bold</b>"}), /plain text/);
  assert.match(problem({title: "Launch", brief: "", style: "NEON"}), /design style/);
  assert.match(problem({title: "Launch", brief: "", structure: "WAVES"}), /page structure/);
  assert.match(problem({title: "Launch", brief: "", layout: "from an older form"}), /out of date\. Reload/);
  assert.match(problem({title: "Launch", brief: "", projectId: "not-a-record"}), /linked record/);
  assert.match(problem({title: "Launch", brief: "", propertyId: MEDIA_A, listingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}), /listing or a property/);
  assert.match(generationRequestProblem([]), /Check the supplied details/);
});

test("on phones and tablets the navigation bar keeps the brand left and the menu button at the right end", () => {
  const page = samplePage("CONTEMPORARY", "SIGNATURE");
  const html = render(page);
  const navbar = html.slice(html.indexOf('data-section-type="NAVBAR"'), html.indexOf('data-section-type="HERO"'));
  assert.match(navbar, /class="ml-auto flex shrink-0 items-center gap-2 @md:gap-4 @5xl:ml-0"/, "the buttons sit at the right end until the desktop menu shows");
  assert.match(navbar, /<span class="truncate">Your Agency<\/span>/, "a long brand name is shortened, not pushed off the screen");
  assert.match(navbar, /<summary aria-label="Menu"/);
});

test("'Showcase with image' frames the hero's own image over the background photo; the original showcase is unchanged", () => {
  const page = samplePage("CONTEMPORARY", "SIGNATURE");
  const withHero = (variant: string) => ({...page, data: {...page.data, sections: page.data.sections.map(section => section.type === "HERO"
    ? {...section, variant, props: {...section.props, image: {stockId: "marina-yacht", alt: "Living room"}}, style: {...section.style, backgroundType: "IMAGE" as const, backgroundImage: {stockId: "skyline-downtown-lights", alt: ""}}}
    : section) as PageData["sections"]}});
  const framed = render(withHero("showcaseImage"));
  const hero = framed.slice(framed.indexOf('data-section-type="HERO"'), framed.indexOf("</section>", framed.indexOf('data-section-type="HERO"')));
  assert.match(hero, /pg-tilt[^>]*>\s*<img[^>]*alt="Living room"/, "the hero's own image is framed");
  assert.equal((hero.match(/<img /g) ?? []).length >= 2, true, "and the background photo stays behind it");
  const original = render(withHero("showcase"));
  const originalHero = original.slice(original.indexOf('data-section-type="HERO"'), original.indexOf("</section>", original.indexOf('data-section-type="HERO"')));
  assert.doesNotMatch(originalHero, /alt="Living room"/, "the original showcase still leaves the image out when there is a background");
  assert.equal(VARIANT_LABELS.showcaseImage, "Showcase with image");
});

test("showcase fact cards: over a background photo the value takes the readable text colour; a fact's own colour reaches its value", () => {
  const page = samplePage("CONTEMPORARY", "SIGNATURE");
  const withHero = (style: Record<string, unknown>) => ({...page, data: {...page.data, sections: page.data.sections.map(section => section.type === "HERO"
    ? {...section, variant: "showcaseImage", props: {...section.props, showFacts: true, image: {stockId: "marina-yacht", alt: "Living room"}}, style: {...section.style, ...style}}
    : section) as PageData["sections"]}});
  // The values of the floating fact cards (other fact lists on the page use other classes).
  const chipValues = (html: string) => [...html.matchAll(/<dd[^>]*class="(mt-1 font-\[family-name:var\(--pg-heading-font\)\] text-xl font-semibold[^"]*)"/g)].map(match => match[1]);
  const overPhoto = chipValues(render(withHero({backgroundType: "IMAGE", backgroundImage: {stockId: "skyline-downtown-lights", alt: ""}})));
  assert.ok(overPhoto.length > 0 && overPhoto.every(value => !value.includes("--pg-accent")), "no dark accent on a photo");
  const plain = chipValues(render(withHero({backgroundType: "NONE"})));
  assert.ok(plain.length > 0 && plain.every(value => value.includes("text-[var(--pg-accent)]")), "the accent on the theme background, as before");
  const coloured = chipValues(render(withHero({backgroundType: "NONE", elementStyles: {"facts.0": {...DEFAULT_ELEMENT_STYLE, color: "#22c55e"}}})));
  assert.ok(!coloured[0].includes("--pg-accent"), "a colour on the fact reaches its value");
  assert.ok(coloured.slice(1).every(value => value.includes("text-[var(--pg-accent)]")), "other facts keep the accent");
});
