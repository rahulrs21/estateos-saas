import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "react-dom/server";
import { createElement, type ReactElement } from "react";
import { presentBranding } from "../src/modules/ai/content/facts";
import { mapGeneratedPage, pageFactWarnings, pageGenerationZod, clip, PAGE_GENERATION_JSON, AI_SECTION_TYPES, type PageGenerationOutput } from "../src/modules/websites/ai";
import { buildChecklist, missingAttestations } from "../src/modules/websites/checklist";
import { PageRenderer } from "../src/modules/websites/components/page-renderer";
import {
  advertisedListings, agentsShown, buildLinkedData, publicPageData, resolveImage, resolvedStats, stockMediaUsed, uploadIdsOf, usedUploadIds, fingerprintSource, linkedDataChanges, sectionAvailability, unknownImageRefs, usedMediaIds,
  type LinkedSources, type ListingSource, type ProjectSource,
} from "../src/modules/websites/linked";
import { libraryTemplate, parseLibrarySection } from "../src/modules/websites/library";
import { agentCardSchema, sectionTemplateSchema, createPageSchema, generatePageSchema, publishSchema, savePageSchema } from "../src/modules/websites/policy";
import { factsPrompt } from "../src/modules/ai/content/prompt";
import {
  DEFAULT_ELEMENT_STYLE, ROW_DEFAULTS, columnWidths, type CustomRow, isDefaultElementStyle, PageDataError, SECTION_DEFINITIONS, SECTION_TYPES, createSection, defaultProps, defaultWidget, sectionWidgets, defaultTheme, isReservedSlug, newSectionId, pageDataSchema, parsePageData, slugify,
  type PageData, type PageSection, type SectionOf,
} from "../src/modules/websites/registry";
import { isPublicSlug, parseSnapshot, sourcesStillEligible } from "../src/modules/websites/snapshot";
import { addToSection, createWidget, duplicateWidget, insertWidget, moveWidget, newRow, pageElementIds, relocateWidget, removeWidget, setColumnWidth, setRowLayout, widgetAt, withFreshIds } from "../src/modules/websites/custom-ops";
import { cleanUploadName, imageDimensions, matchesImageSignature } from "../src/modules/websites/uploads";
import { PAGE_TEMPLATES, TEMPLATE_KEYS, blankPage, pageFromTemplate } from "../src/modules/websites/templates";
import { deviceClasses, elementCss, mobileSize } from "../src/modules/websites/theme";

// --- Synthetic fixtures (no real customer or company data) ---------------------

const TODAY = "2026-10-29";
const READ_AT = `${TODAY}T08:00:00.000Z`;
const branding = presentBranding({
  companyName: "Synthetic Realty LLC", companyPhone: "+971 4 555 0100", companyEmail: "hello@synthetic-realty.example",
  profile: {useCompanyPhone: true, useCompanyEmail: true, whatsappNumber: "+971 50 555 0101", marketingDisclaimer: "Synthetic disclaimer. Information subject to change.", tagline: "Homes, simply"},
});
const noContacts = presentBranding({companyName: "No Contact Co", profile: null});
const EXACT = {latitude: 25.080512, longitude: 55.140231};

function project(extra: Partial<ProjectSource> = {}): ProjectSource {
  return {
    id: "11111111-1111-4111-8111-111111111111", projectName: "Marina Test Towers", projectStatus: "ACTIVE", constructionStatus: "UNDER_CONSTRUCTION",
    developer: {id: "d", name: "Test Developer"}, emirate: "DUBAI", city: "Dubai", community: "Dubai Marina", area: "Marina Walk", ...EXACT,
    googlePlaceId: "ChIJ_secret", mapDisplayMode: "EXACT", launchDate: "2027-02-01", expectedHandoverDate: "2028-12-31", startingPriceMinor: "125000000", currency: "AED",
    totalUnits: 240, permitNumber: "PRJ-7788", permitExpiryDate: "2027-06-30", permitReferenceUrl: "https://verify.example/permit/PRJ-7788",
    projectAmenities_on_project: [{amenity: {name: "Infinity pool"}}, {amenity: {name: "Gym"}}], marketingDescription: "A synthetic waterfront tower.", ...extra,
  };
}

function listing(id: string, extra: Partial<ListingSource> = {}, property: Partial<ListingSource["property"]> = {}): ListingSource {
  return {
    id, title: `Listing ${id.slice(0, 4)}`, listingPurpose: "SALE", listingStatus: "ACTIVE", publicationStatus: "PUBLISHED", askingPriceMinor: "250000000", currency: "AED",
    advertisingPermitNumber: "7112345678", permitExpiryDate: "2027-01-01", permitVerificationUrl: "https://verify.example/7112345678", ...extra,
    property: {id: `p-${id}`, propertyType: "APARTMENT", bedrooms: 2, bathrooms: 2, builtUpArea: 1200, areaUnit: "SQFT", inventoryStatus: "AVAILABLE", emirate: "DUBAI", city: "Dubai", community: "Dubai Marina", area: "Marina Gate", ...EXACT, googlePlaceId: "ChIJ_secret", mapDisplayMode: "EXACT", ...property},
  };
}

const photo = (id: string, isCover = false) => ({id, contentType: "image/jpeg", mediaKind: "PROPERTY_PHOTO", isCover});
const MEDIA_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MEDIA_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function linkedFor(sources: LinkedSources, brand = branding) {
  return buildLinkedData(sources, brand, {readAt: READ_AT, mediaUrl: id => `/media/${id}`});
}

const fullSources: LinkedSources = {
  project: project(),
  units: {rows: [{propertyType: "APARTMENT", bedrooms: 1, referencePriceMinor: "125000000"}, {propertyType: "APARTMENT", bedrooms: 2, referencePriceMinor: "210000000"}], complete: true},
  paymentPlans: [{name: "60/40", isActive: true, bookingPercentageBps: 1000, handoverPercentageBps: 4000, paymentPlanInstallments_on_paymentPlan: [{position: 1, percentageBps: 5000, dueTrigger: "CONSTRUCTION_MILESTONE", constructionMilestonePercent: 50}]}],
  floorPlans: [{id: "f1", name: "Type A", propertyType: "APARTMENT", bedrooms: 1, builtUpArea: 750, areaUnit: "SQFT", inventoryMedias_on_floorPlan: []}],
  media: [photo(MEDIA_A, true), photo(MEDIA_B), {id: "doc", contentType: "application/pdf", mediaKind: "BROCHURE"}],
};

function generated(sections: Array<Partial<PageGenerationOutput["sections"][number]> & {type: string}>): PageGenerationOutput {
  return pageGenerationZod.parse({
    title: "Marina Test Towers launch", seoTitle: "Marina Test Towers", seoDescription: "Register your interest.", style: "PREMIUM_DARK", accent: "GOLD",
    sections: sections.map(section => ({variant: "", eyebrow: "", heading: "", subheading: "", body: "", ctaLabel: "", ctaAction: "ENQUIRE", items: [], ...section})),
    missingInformation: [], claimsToReview: [],
  });
}

const render = (data: PageData, linked = linkedFor(fullSources), mode: "editor" | "public" = "public", form = true) => renderToString(createElement(PageRenderer, {
  mode, today: TODAY, page: {title: "Test page", data, linked, form: form ? {fields: [{key: "FULL_NAME", label: "Full name", required: true}, {key: "EMAIL", label: "Email", required: false}], consentText: "I agree to be contacted.", privacyPolicyUrl: "https://synthetic-realty.example/privacy", successMessage: "Thanks"} : null},
  publicContext: mode === "public" ? {enquiryEndpoint: "/api/public/sites/synthetic/test/enquiries", pageTitle: "Test page"} : null,
}));

// --- 1, 3, 5: registry, templates and section editing ---------------------------

test("every template and the blank page validate against the registry", () => {
  assert.equal(TEMPLATE_KEYS.length, 8);
  for (const key of TEMPLATE_KEYS) {
    const page = pageFromTemplate(key);
    assert.equal(page.theme.style, PAGE_TEMPLATES[key].style);
    assert.equal(page.sections[0].type, "NAVBAR");
    assert.equal(page.sections[1].type, "HERO");
    assert.ok(page.sections.length >= 6, `${key} is a complete page`);
    assert.equal(page.sections.at(-1)!.type, "FOOTER");
    assert.ok(pageDataSchema.safeParse(page).success, key);
  }
  assert.ok(pageDataSchema.safeParse(blankPage()).success);
});

test("every section type has defaults that validate, and 20 types are registered", () => {
  assert.equal(SECTION_TYPES.length, 27);
  const sections = SECTION_TYPES.map((type, index) => createSection(type, `${type.toLowerCase().replaceAll("_", "-")}-${index}`));
  assert.ok(pageDataSchema.safeParse({schemaVersion: 1, theme: defaultTheme(), sections}).success);
  for (const type of SECTION_TYPES) assert.ok(SECTION_DEFINITIONS[type].variants.length >= 1);
});

test("unknown types, unknown props, bad variants, duplicate IDs and duplicate single sections are rejected", () => {
  const base = blankPage();
  const hero = base.sections[0];
  const cases: unknown[] = [
    {...base, sections: [...base.sections, {...hero, id: "x-123", type: "CUSTOM_HTML"}]},
    {...base, sections: [{...hero, props: {...hero.props, html: "<b>x</b>"}}]},
    {...base, sections: [{...hero, variant: "rainbow"}]},
    {...base, sections: [hero, {...base.sections[1], id: hero.id}]},
    {...base, sections: [hero, {...hero, id: "hero-two"}]},
    {...base, theme: {...base.theme, accent: "#ff0000"}},
    {...base, theme: {...base.theme, css: "body{display:none}"}},
    {...base, organizationId: "11111111-1111-4111-8111-111111111111"},
  ];
  for (const value of cases) assert.equal(pageDataSchema.safeParse(value).success, false, JSON.stringify(value).slice(0, 80));
  assert.throws(() => parsePageData(cases[0]), PageDataError);
});

test("reordering, duplicating and hiding sections keeps the page valid; new section IDs are unique", () => {
  const page = pageFromTemplate("OFF_PLAN_LAUNCH");
  const ids = new Set(page.sections.map(section => section.id));
  for (let index = 0; index < 50; index += 1) {
    const id = newSectionId("FEATURE_SPLIT", ids);
    assert.ok(!ids.has(id));
    ids.add(id);
  }
  const reordered = [...page.sections].reverse();
  const feature = page.sections.find(section => section.type === "FEATURE_SPLIT")!;
  const copy = {...structuredClone(feature), id: newSectionId("FEATURE_SPLIT", page.sections.map(section => section.id))};
  const next = {...page, sections: [...reordered.map(section => section.type === "GALLERY" ? {...section, visible: false} : section), copy]};
  assert.ok(pageDataSchema.safeParse(next).success);
});

// --- 4: no HTML, scripts, URLs, CSS or handlers ------------------------------------

test("HTML, scripts, event handlers, script URLs and CSS are rejected in every text field", () => {
  const hero = createSection("HERO", "hero-main");
  const attacks = ["<script>alert(1)</script>", "<img src=x onerror=alert(1)>", "javascript:alert(1)", "Click <a href='https://evil.example'>here</a>", "data:text/html;base64,PHNjcmlwdD4=", "text\u0000null"];
  for (const attack of attacks) {
    for (const field of ["headline", "subheadline", "eyebrow"] as const) {
      const section = {...hero, props: {...hero.props, [field]: attack}};
      assert.equal(pageDataSchema.safeParse({schemaVersion: 1, theme: defaultTheme(), sections: [section]}).success, false, `${field}: ${attack}`);
    }
  }
  const withUrl = {...hero, props: {...hero.props, primaryCta: {label: "Go", action: "https://evil.example"}}};
  assert.equal(pageDataSchema.safeParse({schemaVersion: 1, theme: defaultTheme(), sections: [withUrl]}).success, false);
  const withHandler = {...hero, props: {...hero.props, onClick: "steal()"}};
  assert.equal(pageDataSchema.safeParse({schemaVersion: 1, theme: defaultTheme(), sections: [withHandler]}).success, false);
  const withStyle = {...hero, layout: {...hero.layout, style: "position:fixed"}};
  assert.equal(pageDataSchema.safeParse({schemaVersion: 1, theme: defaultTheme(), sections: [withStyle]}).success, false);
  // Plain text with symbols is fine.
  const plain = {...hero, props: {...hero.props, headline: "Waterfront living & 2-bed homes — 50% sold"}};
  assert.ok(pageDataSchema.safeParse({schemaVersion: 1, theme: defaultTheme(), sections: [plain]}).success);
});

test("rendered pages escape text and never contain scripts, inline handlers or javascript: URLs", () => {
  const page = pageFromTemplate("LUXURY_APARTMENT");
  const html = render(page, linkedFor({...fullSources, listing: listing("cccccccc-cccc-4ccc-8ccc-cccccccccccc")}));
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /\son[a-z]+=/i);
  assert.doesNotMatch(html, /javascript:/i);
});

// --- 2: Claude output mapping ----------------------------------------------------------

test("the structured-output schema has no optional or nullable fields and only AI-writable section types", () => {
  const sectionSchema = (PAGE_GENERATION_JSON.properties as Record<string, {items: {required: string[]; properties: Record<string, unknown>}}>).sections.items;
  assert.deepEqual([...sectionSchema.required].sort(), Object.keys(sectionSchema.properties).sort());
  assert.ok(!AI_SECTION_TYPES.includes("TESTIMONIALS") && !AI_SECTION_TYPES.includes("LANDMARKS") && !AI_SECTION_TYPES.includes("COMPARISON"));
  assert.doesNotMatch(JSON.stringify(PAGE_GENERATION_JSON), /"nullable"|"null"/);
});

test("generated output is mapped to registry sections: unsupported, duplicate and data-less sections are removed", () => {
  const linked = linkedFor({project: project(), media: [photo(MEDIA_A, true)]}, noContacts);
  const output = generated([
    {type: "FOOTER"},
    {type: "PRICING", heading: "Pricing"},
    {type: "HERO", heading: "Waterfront <b>living</b>", subheading: "Register now", ctaLabel: "Chat", ctaAction: "WHATSAPP"},
    {type: "HERO", heading: "Second hero"},
    {type: "TESTIMONIALS", heading: "Reviews", items: [{title: "Great!", text: "Five stars", icon: "STAR"}]},
    {type: "SCRIPT", heading: "x"},
    {type: "PAYMENT_PLANS", heading: "Payment plan"},
    {type: "HIGHLIGHTS", heading: "Why buy", items: [{title: "Sea views", text: "From the upper floors", icon: "WAVES"}]},
  ]);
  const mapped = mapGeneratedPage(output, linked, {hasForm: false, fallbackTitle: "Fallback"});
  const types = mapped.data.sections.map(section => section.type);
  assert.equal(types[0], "NAVBAR");
  assert.equal(types[1], "HERO");
  assert.equal(types.at(-1), "FOOTER");
  assert.ok(types.includes("ENQUIRY_FORM"), "an enquiry form is always added");
  assert.ok(!types.includes("TESTIMONIALS"));
  assert.equal(types.filter(type => type === "HERO").length, 1);
  assert.ok(!types.includes("PAYMENT_PLANS"), "no payment plan recorded");
  assert.ok(mapped.omitted.some(item => item.startsWith("Payment plans")));
  assert.ok(mapped.removed.some(item => item.includes("SCRIPT")));
  assert.ok(mapped.removed.some(item => item.includes("TESTIMONIALS")));
  assert.equal(mapped.data.sections[0].type, "NAVBAR");
  const hero = mapped.data.sections[1] as Extract<PageSection, {type: "HERO"}>;
  assert.equal(hero.props.headline, "Waterfront bliving/b");
  assert.equal(hero.props.primaryCta.action, "ENQUIRE", "WhatsApp falls back when no number is approved");
  const background = hero.style.backgroundImage;
  assert.equal(hero.style.backgroundType, "IMAGE");
  assert.ok(background && "mediaId" in background && background.mediaId === MEDIA_A, "the cover photo comes from linked media, not from Claude");
  assert.ok(pageDataSchema.safeParse(mapped.data).success);
});

test("generated text is clipped to registry limits and stripped of markup", () => {
  assert.equal(clip("<script>x</script> hello", 100), "scriptx/script hello");
  assert.equal(clip("javascript:alert(1)", 100), "alert(1)");
  assert.ok(clip("word ".repeat(100), 60).length <= 60);
});

test("fact check flags figures that are not in the linked CRM data", () => {
  const linked = linkedFor(fullSources);
  const page = pageFromTemplate("INVESTMENT_ENQUIRY");
  const hero = (page.sections.find(section => section.type === "HERO") as Extract<PageSection, {type: "HERO"}>);
  hero.props.subheadline = "Guaranteed 17% annual returns, 3 minutes to the metro.";
  const warnings = pageFactWarnings(page, linked, branding);
  assert.ok(warnings.some(warning => warning.code === "UNVERIFIED_NUMBER" && /17/.test(warning.text)));
  assert.ok(warnings.some(warning => warning.code === "SENSITIVE_CLAIM"));
  hero.props.subheadline = "Handover expected in December 2028, 240 residences.";
  assert.ok(!pageFactWarnings(page, linked, branding).some(warning => warning.code === "UNVERIFIED_NUMBER"));
});

// --- 10, 13, 18: linked data, map privacy, missing images ----------------------------

test("linked data comes only from the records: units, plans, floor plans, amenities and image-only media", () => {
  const linked = linkedFor(fullSources);
  assert.equal(linked.project?.startingPrice?.display, "AED 1,250,000");
  assert.equal(linked.unitTypes?.groups.length, 2);
  assert.equal(linked.paymentPlans[0].booking, "10%");
  assert.equal(linked.paymentPlans[0].installments[0].due, "At 50% construction");
  assert.deepEqual(linked.amenities, ["Infinity pool", "Gym"]);
  assert.deepEqual(linked.media.map(media => media.id), [MEDIA_A, MEDIA_B], "brochures and documents are never page media");
  assert.equal(linked.developer?.name, "Test Developer");
  const page = pageFromTemplate("OFF_PLAN_LAUNCH");
  for (const section of page.sections.filter(item => item.type !== "HIGHLIGHTS" && item.type !== "FAQ")) assert.equal(sectionAvailability(section, linked, {hasForm: true, today: TODAY, mode: "public"}).ok, true, section.type);
});

test("map privacy: EXACT keeps the point, APPROXIMATE is generalised, HIDDEN has no coordinates anywhere", () => {
  const exact = linkedFor({project: project()});
  assert.equal(exact.location?.display.precision, "EXACT");
  assert.equal(exact.location?.display.latitude, EXACT.latitude);
  const approximate = linkedFor({project: project({mapDisplayMode: "APPROXIMATE"})});
  assert.equal(approximate.location?.display.precision, "APPROXIMATE");
  assert.notEqual(approximate.location?.display.latitude, EXACT.latitude);
  assert.equal(approximate.location?.display.placeId, null);
  const hidden = linkedFor({project: project({mapDisplayMode: "HIDDEN"})});
  assert.equal(hidden.location?.display.latitude, null);
  assert.equal(hidden.location?.display.longitude, null);
  for (const [linked, mode] of [[hidden, "HIDDEN"], [approximate, "APPROXIMATE"]] as const) {
    const serialized = JSON.stringify(linked) + render(pageFromTemplate("OFF_PLAN_LAUNCH"), linked);
    assert.doesNotMatch(serialized, /25\.080512|55\.140231/, `${mode}: exact coordinates leaked`);
    assert.doesNotMatch(serialized, /ChIJ_secret/, `${mode}: place ID leaked`);
  }
  assert.doesNotMatch(JSON.stringify(linkedFor({listing: listing("dddddddd-dddd-4ddd-8ddd-dddddddddddd", {}, {mapDisplayMode: "HIDDEN"})})), /25\.08|55\.14/);
});

test("public output carries no internal CRM fields", () => {
  const source = {...listing("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"), internalNotes: "Motivated seller", propertyReference: "INT-REF-9", unitNumber: "2304", ownershipReference: "OWN-1", address: "Marina Gate 1, Unit 2304"};
  const linked = linkedFor({listing: source as ListingSource});
  const output = JSON.stringify(linked) + render(pageFromTemplate("LUXURY_APARTMENT"), linked);
  for (const secret of ["Motivated seller", "INT-REF-9", "2304", "OWN-1", "Marina Gate 1"]) assert.ok(!output.includes(secret), secret);
});

test("missing images: a CRM-only gallery is unavailable, templates fall back to labelled stock media and the checklist warns", () => {
  const linked = linkedFor({project: project()});
  const page = pageFromTemplate("LUXURY_APARTMENT");
  const crmGallery = createSection("GALLERY", "gallery-crm", {...defaultProps("GALLERY"), images: []});
  assert.equal(sectionAvailability(crmGallery, linked, {hasForm: true, today: TODAY, mode: "public"}).ok, false);
  const gallery = page.sections.find(section => section.type === "GALLERY")!;
  assert.equal(sectionAvailability(gallery, linked, {hasForm: true, today: TODAY, mode: "public"}).ok, true, "the template gallery uses stock photos");
  const html = render(page, linked);
  assert.match(html, /images\.unsplash\.com\/photo-/);
  assert.match(html, /illustrative stock media/);
  assert.match(html, /<h1/);
  const checklist = buildChecklist({page: {title: "T", slug: "t", seoTitle: null, seoDescription: null}, data: page, linked, form: {status: "ACTIVE", consentText: "ok", privacyPolicyUrl: "https://x.example"}, contentWarnings: 0, today: TODAY});
  assert.ok(checklist.items.some(item => item.id === "photos" && item.status === "WARN"));
});

test("unknown or removed image references are detected and only used images are allowlisted", () => {
  const linked = linkedFor(fullSources);
  const page = pageFromTemplate("LUXURY_APARTMENT");
  const hero = (page.sections.find(section => section.type === "HERO") as Extract<PageSection, {type: "HERO"}>);
  hero.props.image = {mediaId: "99999999-9999-4999-8999-999999999999", alt: "Gone"};
  hero.style = {...hero.style, backgroundType: "NONE"};
  assert.deepEqual(unknownImageRefs(page, linked), ["99999999-9999-4999-8999-999999999999"]);
  hero.props.image = {mediaId: MEDIA_B, alt: "Pool"};
  assert.deepEqual(unknownImageRefs(page, linked), []);
  assert.deepEqual(new Set(usedMediaIds(page, linked)), new Set([MEDIA_B]), "stock photos are never in the CRM media allowlist");
});

// --- 19: permits and UAE advertising checks ------------------------------------------------

function checklistFor(sources: LinkedSources, page = pageFromTemplate("LUXURY_APARTMENT"), brand = branding, form: {status: string} | null = {status: "ACTIVE"}) {
  return buildChecklist({page: {title: "Test", slug: "test", seoTitle: "Test", seoDescription: "Desc"}, data: page, linked: linkedFor(sources, brand),
    form: form ? {...form, consentText: "I agree", privacyPolicyUrl: "https://x.example/privacy"} : null, contentWarnings: 0, today: TODAY});
}

test("a published, permitted listing passes; missing, expired or unpublished listings block publication", () => {
  const ok = checklistFor({listing: listing("11111111-aaaa-4aaa-8aaa-111111111111"), media: [photo(MEDIA_A)]});
  assert.equal(ok.blockers, 0, JSON.stringify(ok.items.filter(item => item.blocking)));
  assert.deepEqual(ok.attestations, ["CONTENT_REVIEWED", "ADVERTISING_PERMITS_VERIFIED", "STOCK_MEDIA_ILLUSTRATIVE"]);
  for (const extra of [{advertisingPermitNumber: null}, {permitExpiryDate: "2026-10-01"}, {publicationStatus: "NOT_PUBLISHED"}, {listingStatus: "PAUSED"}]) {
    const blocked = checklistFor({listing: listing("22222222-aaaa-4aaa-8aaa-222222222222", extra as Partial<ListingSource>)});
    assert.ok(blocked.blockers > 0, JSON.stringify(extra));
  }
});

test("Dubai projects need a recorded, unexpired permit; other emirates get a warning; inactive projects block", () => {
  assert.equal(checklistFor({project: project()}, pageFromTemplate("OFF_PLAN_LAUNCH")).blockers, 0);
  assert.ok(checklistFor({project: project({permitNumber: null})}, pageFromTemplate("OFF_PLAN_LAUNCH")).items.some(item => item.id === "project-permit" && item.status === "FAIL"));
  assert.ok(checklistFor({project: project({permitExpiryDate: "2026-01-01"})}, pageFromTemplate("OFF_PLAN_LAUNCH")).blockers > 0);
  assert.ok(checklistFor({project: project({emirate: "SHARJAH", permitNumber: null})}, pageFromTemplate("OFF_PLAN_LAUNCH")).items.some(item => item.id === "project-permit" && item.status === "WARN"));
  assert.ok(checklistFor({project: project({projectStatus: "DRAFT"})}, pageFromTemplate("OFF_PLAN_LAUNCH")).blockers > 0);
});

test("a property without a listing, a missing contact, a missing form or unconfirmed testimonials block publication", () => {
  const property = {id: "p1", propertyType: "VILLA", inventoryStatus: "AVAILABLE", emirate: "DUBAI", mapDisplayMode: "HIDDEN"};
  assert.ok(checklistFor({property}).items.some(item => item.id === "property-listing" && item.blocking));
  assert.ok(checklistFor({project: project()}, pageFromTemplate("OFF_PLAN_LAUNCH"), noContacts).items.some(item => item.id === "contact" && item.blocking));
  assert.ok(checklistFor({project: project()}, pageFromTemplate("OFF_PLAN_LAUNCH"), branding, null).items.some(item => item.id === "form" && item.blocking));
  assert.ok(checklistFor({project: project()}, pageFromTemplate("OFF_PLAN_LAUNCH"), branding, {status: "DRAFT"}).items.some(item => item.id === "form" && item.blocking));
  const page = pageFromTemplate("COMING_SOON");
  page.sections.splice(1, 0, createSection("TESTIMONIALS", "testimonials-1", {...defaultProps("TESTIMONIALS"), items: [{quote: "Great service", author: "A. Client", context: ""}]}));
  const blocked = checklistFor({}, page);
  assert.ok(blocked.items.some(item => item.id === "testimonials" && item.blocking));
  (page.sections[1] as Extract<PageSection, {type: "TESTIMONIALS"}>).props.consentConfirmed = true;
  const confirmed = checklistFor({}, page);
  assert.ok(confirmed.attestations.includes("TESTIMONIALS_CONSENT"));
  assert.deepEqual(missingAttestations(confirmed, ["CONTENT_REVIEWED"]), ["TESTIMONIALS_CONSENT", "STOCK_MEDIA_ILLUSTRATIVE"]);
});

test("live eligibility takes a page offline when a listing expires, is withdrawn or a source disappears", () => {
  const expected = {listingIds: ["l1"], projectIds: ["p1"], propertyIds: []};
  const okListing = {listingStatus: "ACTIVE", publicationStatus: "PUBLISHED", advertisingPermitNumber: "711", permitExpiryDate: "2027-01-01", archivedAt: null, property: {archivedAt: null}};
  const okProject = {projectStatus: "ACTIVE", archivedAt: null, permitExpiryDate: null};
  assert.equal(sourcesStillEligible({listings: [okListing], projects: [okProject], properties: [], expected, today: TODAY}), true);
  assert.equal(sourcesStillEligible({listings: [{...okListing, permitExpiryDate: "2026-10-28"}], projects: [okProject], properties: [], expected, today: TODAY}), false);
  assert.equal(sourcesStillEligible({listings: [{...okListing, listingStatus: "SOLD"}], projects: [okProject], properties: [], expected, today: TODAY}), false);
  assert.equal(sourcesStillEligible({listings: [], projects: [okProject], properties: [], expected, today: TODAY}), false);
  assert.equal(sourcesStillEligible({listings: [okListing], projects: [{...okProject, projectStatus: "INACTIVE"}], properties: [], expected, today: TODAY}), false);
});

// --- Outdated published content ---------------------------------------------------------

test("changes to linked CRM data are detected and described; media URLs do not count as changes", () => {
  const before = linkedFor(fullSources);
  const after = linkedFor({...fullSources, project: project({startingPriceMinor: "135000000"})});
  assert.notEqual(fingerprintSource(before), fingerprintSource(after));
  assert.ok(linkedDataChanges(before, after).some(change => change.includes("starting price")));
  const publicUrls = buildLinkedData(fullSources, branding, {readAt: "2026-11-01T00:00:00Z", mediaUrl: id => `/public/${id}`});
  assert.equal(fingerprintSource(before), fingerprintSource(publicUrls));
  assert.deepEqual(linkedDataChanges(before, publicUrls), []);
  const sold = linkedFor({listing: listing("33333333-aaaa-4aaa-8aaa-333333333333", {listingStatus: "SOLD"})});
  const live = linkedFor({listing: listing("33333333-aaaa-4aaa-8aaa-333333333333")});
  assert.ok(linkedDataChanges(live, sold).some(change => change.includes("can no longer be advertised")));
});

// --- 8, 9: preview isolation and responsive rendering -------------------------------------

test("editor previews are marked internal and never submit; public pages have one h1 and responsive container classes", () => {
  const page = pageFromTemplate("OFF_PLAN_LAUNCH");
  const preview = render(page, linkedFor(fullSources), "editor");
  assert.match(preview, /Internal preview/);
  assert.match(preview, /Preview only: this form does not send enquiries/);
  const live = render(page);
  assert.doesNotMatch(live, /Internal preview/);
  assert.equal((live.match(/<h1/g) ?? []).length, 1);
  assert.match(live, /@container/);
  assert.match(live, /@3xl:grid-cols-2/);
  assert.match(live, /Project permit (<!-- -->)?PRJ-7788/);
  assert.match(live, /Synthetic disclaimer/);
});

test("device visibility uses container breakpoints", () => {
  assert.equal(deviceClasses({desktop: true, tablet: true, mobile: true}), "");
  assert.equal(deviceClasses({desktop: true, tablet: true, mobile: false}), "hidden @3xl:block @5xl:block");
  assert.equal(deviceClasses({desktop: false, tablet: false, mobile: true}), "block @3xl:hidden @5xl:hidden");
  const page = blankPage();
  page.sections[1] = {...page.sections[1], devices: {desktop: true, tablet: true, mobile: false}};
  assert.match(render(page), /hidden @3xl:block @5xl:block/);
});

test("comparison shows only accessible listings and every advertised listing is checked", () => {
  const a = listing("44444444-aaaa-4aaa-8aaa-444444444444");
  const b = listing("55555555-aaaa-4aaa-8aaa-555555555555", {advertisingPermitNumber: null});
  const linked = linkedFor({comparison: [a, b]});
  const page = blankPage();
  page.sections.splice(1, 0, createSection("COMPARISON", "comparison-1", {...defaultProps("COMPARISON"), listingIds: [a.id, b.id, "66666666-aaaa-4aaa-8aaa-666666666666"]}));
  assert.equal(advertisedListings(page, linked).length, 2);
  const checklist = buildChecklist({page: {title: "T", slug: "t", seoTitle: null, seoDescription: null}, data: page, linked, form: {status: "ACTIVE", consentText: "ok", privacyPolicyUrl: "https://x.example"}, contentWarnings: 0, today: TODAY});
  assert.ok(checklist.items.some(item => item.id === `listing-${b.id}` && item.blocking));
});

// --- Requests, slugs and snapshots -----------------------------------------------------------

test("request schemas reject organization IDs, roles, statuses and snapshots from the browser", () => {
  const injected = {organizationId: "11111111-1111-4111-8111-111111111111", role: "OWNER"};
  assert.equal(createPageSchema.safeParse({mode: "BLANK", title: "A", ...injected}).success, false);
  assert.equal(generatePageSchema.safeParse({title: "A", brief: "b", status: "PUBLISHED"}).success, false);
  assert.equal(savePageSchema.safeParse({expectedRevision: 1, title: "A", slug: "a", description: null, seoTitle: null, seoDescription: null, data: {}, snapshot: "x"}).success, false);
  assert.equal(publishSchema.safeParse({expectedRevision: 1, attestations: ["EVERYTHING_IS_FINE"]}).success, false);
  assert.equal(publishSchema.safeParse({expectedRevision: 1, attestations: ["CONTENT_REVIEWED"]}).success, true);
  assert.equal(generatePageSchema.safeParse({title: "A", brief: "<script>x</script>"}).success, false);
  assert.equal(createPageSchema.safeParse({mode: "BLANK", title: "A", propertyId: "11111111-1111-4111-8111-111111111111", listingId: "21111111-1111-4111-8111-111111111111"}).success, false);
});

test("slugs: generated from titles, reserved names refused, public slug format strict", () => {
  assert.equal(slugify("Marina Heights — Launch 2027!"), "marina-heights-launch-2027");
  assert.equal(slugify("مرحبا"), "landing-page");
  assert.ok(isReservedSlug("api") && isReservedSlug("preview"));
  for (const bad of ["../etc", "Upper", "a--b", "-a", "a b", "%2e%2e", ""]) assert.equal(isPublicSlug(bad), false, bad);
  assert.equal(isPublicSlug("marina-heights-2027"), true);
});

test("snapshots with invalid page data are rejected", () => {
  const linked = linkedFor(fullSources);
  const good = {schemaVersion: 1, versionNumber: 1, publishedAt: READ_AT, title: "T", description: null, seoTitle: null, seoDescription: null, data: blankPage(), linked, assets: {}, sources: {listingIds: [], projectIds: [], propertyIds: []}, ogImageMediaId: null};
  assert.ok(parseSnapshot(JSON.stringify(good)));
  const tampered = {...good, data: {...good.data, sections: [{...good.data.sections[0], props: {...good.data.sections[0].props, headline: "<script>"}}]}};
  assert.equal(parseSnapshot(JSON.stringify(tampered)), null);
  assert.equal(parseSnapshot("not json"), null);
});

// --- Phase 6D design upgrade: stock media, styles, stats, templates, inline editing -----------

test("pages saved before the design upgrade still validate, with defaults for new fields", () => {
  const old = {schemaVersion: 1, theme: {style: "CONTEMPORARY", accent: "TEAL", font: "SANS", scale: "COMFORTABLE", radius: "ROUND"}, sections: [
    {id: "hero-main", type: "HERO", visible: true, devices: {desktop: true, tablet: true, mobile: true}, layout: {spacing: "NORMAL", background: "DEFAULT", align: "START"}, variant: "split",
      props: {eyebrow: "", headline: "Old page", subheadline: "", primaryCta: {label: "Enquire", action: "ENQUIRE"}, secondaryCta: null, image: null, showPrice: true, showLocation: true}},
  ]};
  const parsed = parsePageData(old);
  const hero = parsed.sections[0] as Extract<PageSection, {type: "HERO"}>;
  assert.equal(hero.style.backgroundType, "NONE");
  assert.equal(hero.props.showFacts, false);
  assert.equal(parsed.theme.customAccent, null);
});

test("stock media and colours are validated: only catalogue IDs and #rrggbb values", () => {
  const hero = createSection("HERO", "hero-main");
  const page = (section: unknown) => pageDataSchema.safeParse({schemaVersion: 1, theme: defaultTheme(), sections: [section]}).success;
  assert.equal(page({...hero, props: {...hero.props, image: {stockId: "skyline-sunset", alt: "Skyline"}}}), true);
  assert.equal(page({...hero, props: {...hero.props, image: {stockId: "https://evil.example/x.jpg", alt: ""}}}), false);
  assert.equal(page({...hero, props: {...hero.props, image: {url: "https://evil.example/x.jpg", alt: ""}}}), false);
  assert.equal(page({...hero, style: {...hero.style, backgroundType: "VIDEO", backgroundVideo: {stockId: "video-dubai-shore"}}}), true);
  assert.equal(page({...hero, style: {...hero.style, backgroundVideo: {stockId: "video-unknown"}}}), false);
  for (const colour of ["#12AB9f", "#000000"]) assert.equal(page({...hero, style: {...hero.style, backgroundColor: colour}}), true, colour);
  for (const colour of ["red", "#fff", "#12345g", "url(javascript:alert(1))", "#123456;display:none"]) assert.equal(page({...hero, style: {...hero.style, backgroundColor: colour}}), false, colour);
  assert.equal(pageDataSchema.safeParse({schemaVersion: 1, theme: {...defaultTheme(), customAccent: "expression(alert(1))"}, sections: []}).success, false);
});

test("stats show CRM values (never typed) and custom text; missing facts are hidden", () => {
  const linked = linkedFor(fullSources);
  const stats = createSection("STATS", "stats-1", {heading: "", items: [
    {source: "STARTING_PRICE", value: "AED 1", label: "Price"}, {source: "HANDOVER", value: "", label: "Handover"}, {source: "PAYMENT_PLAN", value: "", label: "Plan"},
    {source: "SIZE", value: "", label: "Size"}, {source: "CUSTOM", value: "Waterfront", label: "Setting"},
  ]});
  const values = resolvedStats(stats, linked).map(item => item.value);
  assert.deepEqual(values, ["AED 1,250,000", "Dec 2028", "60/40", "Waterfront"], "a typed value for a CRM fact is ignored, and an unrecorded size is hidden");
});

test("templates are rich, use CRM photos when the records have them and stock media otherwise", () => {
  const stockPage = pageFromTemplate("OFF_PLAN_LAUNCH");
  assert.ok(stockPage.sections.length >= 15);
  const stockHero = stockPage.sections[1] as Extract<PageSection, {type: "HERO"}>;
  assert.equal(stockHero.style.backgroundType, "VIDEO");
  assert.ok(stockMediaUsed(stockPage).any);
  const crmPage = pageFromTemplate("OFF_PLAN_LAUNCH", {crmPhotoIds: [MEDIA_A, MEDIA_B]});
  const crmHero = crmPage.sections[1] as Extract<PageSection, {type: "HERO"}>;
  assert.equal(crmHero.style.backgroundType, "IMAGE");
  assert.deepEqual(crmHero.style.backgroundImage, {mediaId: MEDIA_A, alt: ""});
  const gallery = crmPage.sections.find(section => section.type === "GALLERY") as Extract<PageSection, {type: "GALLERY"}>;
  assert.deepEqual(gallery.props.images, [], "the gallery shows the records' photos");
});

test("generated pages get a navigation bar, a stock video hero and stock gallery when the records have no photos", () => {
  const linked = linkedFor({project: project()}, branding);
  const mapped = mapGeneratedPage(generated([
    {type: "HERO", heading: "Island life", imageTag: "MARINA"}, {type: "GALLERY", heading: "Gallery"},
    {type: "FEATURE_SPLIT", heading: "Wellness", body: "Calm spaces.", imageTag: "SPA", items: [{title: "Quiet rooms", text: "", icon: "STAR"}]},
    {type: "STATS", statSources: ["STARTING_PRICE", "HANDOVER"]},
  ]), linked, {hasForm: false, fallbackTitle: "T"});
  const [navbar, hero] = mapped.data.sections;
  assert.equal(navbar.type, "NAVBAR");
  assert.equal(hero.type === "HERO" && hero.style.backgroundType, "VIDEO");
  const gallery = mapped.data.sections.find(section => section.type === "GALLERY") as Extract<PageSection, {type: "GALLERY"}>;
  assert.ok(gallery.props.images.length >= 5 && gallery.props.images.every(image => "stockId" in image));
  const feature = mapped.data.sections.find(section => section.type === "FEATURE_SPLIT") as Extract<PageSection, {type: "FEATURE_SPLIT"}>;
  assert.ok(feature.props.image && "stockId" in feature.props.image);
  assert.deepEqual(feature.props.bullets, ["Quiet rooms"]);
});

test("the editor renders plain-text inline editing; public pages never contain editable regions", () => {
  const page = pageFromTemplate("OFF_PLAN_LAUNCH");
  const linked = linkedFor(fullSources);
  const edited: string[] = [];
  const editor = renderToString(createElement(PageRenderer, {mode: "editor", today: TODAY, page: {title: "T", data: page, linked, form: null},
    edit: {onText: (id: string, path: string, value: string) => { edited.push(`${id}:${path}=${value}`); }, wrapSection: (_section: PageSection, element: ReactElement) => element}}));
  assert.match(editor, /contenteditable="plaintext-only"/i);
  assert.match(editor, /data-edit-path="headline"/);
  assert.doesNotMatch(render(page, linked), /contenteditable/i);
});

// --- Editor layout: padding, margin, content position and moved elements ------------------

test("layout fields default for older pages and are bounded: padding, margin, content position and offsets", () => {
  const hero = createSection("HERO", "hero-main");
  assert.equal(hero.style.padding, null);
  assert.equal(hero.style.margin, null);
  assert.equal(hero.style.contentVertical, "AUTO");
  assert.deepEqual(hero.style.contentOffset, {x: 0, y: 0});
  assert.deepEqual(hero.style.elementOffsets, {});
  const ok = (style: Record<string, unknown>) => pageDataSchema.safeParse({schemaVersion: 1, theme: defaultTheme(), sections: [{...hero, style: {...hero.style, ...style}}]}).success;
  assert.equal(ok({padding: {desktop: {top: 40, right: 0, bottom: null, left: 24}, tablet: null, mobile: {top: 0, right: null, bottom: null, left: null}}}), true);
  assert.equal(ok({padding: {desktop: {top: -10, right: 0, bottom: 0, left: 0}, tablet: null, mobile: null}}), false, "negative padding");
  assert.equal(ok({padding: {desktop: {top: 401, right: 0, bottom: 0, left: 0}, tablet: null, mobile: null}}), false, "padding above the limit");
  assert.equal(ok({padding: {desktop: {top: "40px", right: 0, bottom: 0, left: 0}, tablet: null, mobile: null}}), false, "CSS strings are not accepted");
  assert.equal(ok({margin: {desktop: {top: -120, right: null, bottom: null, left: null}, tablet: null, mobile: null}}), true, "negative margins overlap the section above");
  assert.equal(ok({contentVertical: "CENTER", contentOffset: {x: -40, y: 120}}), true);
  assert.equal(ok({contentOffset: {x: 0, y: 601}}), false);
  assert.equal(ok({contentOffset: {x: 1.5, y: 0}}), false);
  assert.equal(ok({elementOffsets: {headline: {x: 12, y: -8}, "items.2.title": {x: 0, y: 4}, primaryCta: {x: 20, y: 0}}}), true);
  for (const key of ["", "__proto__x;", "a b", "headline}{color:red", "a.b.c.d.e"]) assert.equal(ok({elementOffsets: {[key]: {x: 1, y: 1}}}), false, key);
  const many = Object.fromEntries(Array.from({length: 41}, (_, index) => [`item${index}`, {x: 1, y: 0}]));
  assert.equal(ok({elementOffsets: many}), false, "at most 40 moved elements");
});

test("custom padding and margin render per device through CSS variables; unset sides keep the preset and inherit downwards", () => {
  const page = blankPage();
  const index = page.sections.findIndex(section => section.type === "HERO");
  const hero = page.sections[index];
  page.sections[index] = {...hero, layout: {...hero.layout, spacing: "NORMAL"}, style: {...hero.style,
    padding: {desktop: {top: 160, right: null, bottom: null, left: 32}, tablet: null, mobile: {top: 24, right: null, bottom: null, left: null}},
    margin: {desktop: {top: -40, right: null, bottom: null, left: null}, tablet: null, mobile: null}}} as PageSection;
  const html = render(page);
  const heroTag = html.match(/<section[^>]*data-section-type="HERO"[^>]*>/)![0];
  assert.match(heroTag, /--pg-pt-d:160px/);
  assert.match(heroTag, /--pg-pt-t:160px/, "tablet inherits desktop");
  assert.match(heroTag, /--pg-pt-m:24px/);
  assert.match(heroTag, /--pg-pb-d:96px/, "an unset bottom keeps the NORMAL preset");
  assert.match(heroTag, /--pg-pl-m:32px/, "mobile inherits the desktop left padding");
  assert.match(heroTag, /--pg-mt-d:-40px/);
  assert.match(heroTag, /@5xl:pt-\[var\(--pg-pt-d\)\]/);
  assert.doesNotMatch(heroTag, /@5xl:py-24/, "the preset class is replaced, not combined");
  const plain = render(blankPage()).match(/<section[^>]*data-section-type="HERO"[^>]*>/)![0];
  assert.doesNotMatch(plain, /--pg-pt|--pg-mt/, "pages without custom spacing are unchanged");
});

test("content position and moved elements render as offsets; only the editor marks elements as movable", () => {
  const page = pageFromTemplate("OFF_PLAN_LAUNCH");
  const index = page.sections.findIndex(section => section.type === "HERO");
  const hero = page.sections[index];
  page.sections[index] = {...hero, style: {...hero.style, height: "SCREEN", contentVertical: "CENTER", contentOffset: {x: 0, y: -60},
    elementOffsets: {headline: {x: 24, y: -12}, primaryCta: {x: 0, y: 16}}}} as PageSection;
  const linked = linkedFor(fullSources);
  const html = render(page, linked);
  assert.match(html, /data-section-type="HERO"[^>]*class="[^"]*flex flex-col justify-center/);
  assert.doesNotMatch(html, /min-h-\[calc\(100svh-10rem\)\] justify-end/, "a chosen position replaces the bottom-aligned hero default");
  assert.match(html, /position:relative;left:0(px)?;top:-60px/);
  assert.match(html, /<span style="position:relative;left:24px;top:-12px" class="">Waterfront living/);
  assert.match(html, /<a href="#enquire"[^>]*style="position:relative;left:0(px)?;top:16px"/);
  assert.doesNotMatch(html, /data-move-key/, "public pages carry no editor attributes");
  const editor = render(page, linked, "editor");
  assert.doesNotMatch(editor, /data-move-key/, "a preview without edit bindings is not movable");
  const editable = renderToString(createElement(PageRenderer, {mode: "editor", today: TODAY, page: {title: "T", data: page, linked, form: null},
    edit: {onText: () => undefined, wrapSection: (_section: PageSection, element: ReactElement) => element}}));
  assert.match(editable, /data-move-key="headline"/);
  assert.match(editable, /data-move-key="primaryCta"/);
  assert.doesNotMatch(editable, /data-move-key="primaryCta\.label"/, "a button moves as a whole");
});

// --- Editor upgrade M1: lead form in the editor, contact details and agent cards --------------

const AGENT_ID = "77777777-7777-4777-8777-777777777777";
const officeBrand = presentBranding({
  companyName: "Synthetic Realty LLC", companyPhone: "+971 4 555 0100", companyEmail: "hello@synthetic-realty.example",
  profile: {useCompanyPhone: true, useCompanyEmail: true, whatsappNumber: "+971 50 555 0101", officeAddress: "Office 1201, Synthetic Tower, Business Bay, Dubai", officeHours: "Mon–Sat, 9:00–18:00"},
});
const agentSource = {id: AGENT_ID, email: "agent@synthetic-realty.example", websiteTitle: "Senior consultant", websitePhone: "+971 50 555 0199", websiteWhatsapp: null, userProfile: {displayName: "Sara Example"}};

function contactPage(props: Partial<SectionOf<"CONTACT">["props"]> = {}, variant = "cards") {
  const page = blankPage();
  const contact = createSection("CONTACT", "contact-main", {...defaultProps("CONTACT"), ...props}, variant);
  page.sections.splice(page.sections.length - 1, 0, contact);
  return page;
}

test("contact sections show only approved company contacts and the chosen active agent, with links built from those records", () => {
  const linked = linkedFor({project: project(), agents: [agentSource]}, officeBrand);
  const html = render(contactPage({agentId: AGENT_ID}), linked);
  assert.match(html, /href="tel:\+97145550100"/);
  assert.match(html, /href="https:\/\/wa\.me\/971505550101"/);
  assert.match(html, /href="mailto:hello@synthetic-realty\.example"/);
  assert.match(html, /Office 1201, Synthetic Tower/);
  assert.match(html, /google\.com\/maps\/search\/\?api=1&amp;query=Office%201201/);
  assert.match(html, /Mon–Sat, 9:00–18:00/);
  assert.match(html, /Sara Example/);
  assert.match(html, /Senior consultant/);
  assert.match(html, /href="tel:\+971505550199"/);
  // An agent who is not active (not in the linked data) is never shown, even if the page names them.
  const withoutAgent = render(contactPage({agentId: AGENT_ID}), linkedFor({project: project()}, officeBrand));
  assert.doesNotMatch(withoutAgent, /Sara Example/);
  // Without approved contacts or an agent, the section is left off the public page.
  const empty = contactPage();
  assert.equal(sectionAvailability(empty.sections.find(section => section.type === "CONTACT")!, linkedFor({project: project()}, noContacts), {hasForm: true, today: TODAY, mode: "public"}).ok, false);
  assert.doesNotMatch(render(empty, linkedFor({project: project()}, noContacts)), /data-section-type="CONTACT"/);
  // Switching a contact off removes it.
  const contactOnly = (html: string) => html.match(/<section[^>]*data-section-type="CONTACT"[\s\S]*?<\/section>/)![0];
  assert.match(contactOnly(render(contactPage(), linkedFor({project: project()}, officeBrand))), /mailto:/);
  assert.doesNotMatch(contactOnly(render(contactPage({showEmail: false}), linkedFor({project: project()}, officeBrand))), /mailto:/);
});

test("contact sections validate their agent reference and never store contact values in the page", () => {
  const section = createSection("CONTACT", "contact-main");
  const page = (props: Record<string, unknown>) => pageDataSchema.safeParse({schemaVersion: 1, theme: defaultTheme(), sections: [{...section, props: {...section.props, ...props}}]}).success;
  assert.equal(page({agentId: AGENT_ID}), true);
  assert.equal(page({agentId: "not-a-member"}), false);
  assert.equal(page({phone: "+971 50 000 0000"}), false, "phone numbers come from records, not the page");
  assert.equal(page({heading: "<b>Call</b>"}), false);
});

test("an agent card on a published page needs the agent-consent attestation", () => {
  const linked = linkedFor({project: project(), agents: [agentSource]}, officeBrand);
  const checklist = buildChecklist({page: {title: "T", slug: "t", seoTitle: null, seoDescription: null}, data: contactPage({agentId: AGENT_ID}), linked,
    form: {status: "ACTIVE", consentText: "ok", privacyPolicyUrl: "https://x.example"}, contentWarnings: 0, today: TODAY});
  assert.ok(checklist.attestations.includes("AGENT_DETAILS_CONSENT"));
  assert.ok(checklist.items.some(item => item.id === "agent-consent" && item.status === "MANUAL"));
  const noAgent = buildChecklist({page: {title: "T", slug: "t", seoTitle: null, seoDescription: null}, data: contactPage(), linked,
    form: {status: "ACTIVE", consentText: "ok", privacyPolicyUrl: "https://x.example"}, contentWarnings: 0, today: TODAY});
  assert.ok(!noAgent.attestations.includes("AGENT_DETAILS_CONSENT"));
});

test("agent cards and office details are validated; office details are never sent to Claude", () => {
  assert.equal(agentCardSchema.safeParse({websiteTitle: "Consultant", websitePhone: "+971 50 555 0199", websiteWhatsapp: ""}).success, true);
  assert.equal(agentCardSchema.parse({websiteTitle: "", websitePhone: "", websiteWhatsapp: ""}).websitePhone, null);
  assert.equal(agentCardSchema.safeParse({websiteTitle: "Consultant", websitePhone: "call me", websiteWhatsapp: ""}).success, false);
  assert.equal(agentCardSchema.safeParse({websiteTitle: "<script>", websitePhone: "", websiteWhatsapp: ""}).success, false);
  assert.equal(agentCardSchema.safeParse({websiteTitle: "", websitePhone: "", websiteWhatsapp: "", organizationId: "x"}).success, false);
  assert.equal(officeBrand.office?.address, "Office 1201, Synthetic Tower, Business Bay, Dubai");
  assert.doesNotMatch(factsPrompt({readAt: READ_AT, sender: {name: null, note: ""}, properties: [], listings: []} as unknown as Parameters<typeof factsPrompt>[0], officeBrand), /Synthetic Tower|9:00/);
});

test("the editor shows a sample enquiry form until a lead form is connected; public pages never do", () => {
  const page = pageFromTemplate("OFF_PLAN_LAUNCH");
  const linked = linkedFor(fullSources);
  const editor = render(page, linked, "editor", false);
  assert.match(editor, /Sample · connect a lead form/);
  assert.doesNotMatch(editor, /<form/, "the sample cannot submit");
  const pub = render(page, linked, "public", false);
  assert.doesNotMatch(pub, /Sample · connect a lead form/);
  assert.doesNotMatch(pub, /id="enquire"/);
});

// --- Editor upgrade M2: website media library (uploads) ----------------------------------------

const UPLOAD_ID = "88888888-8888-4888-8888-888888888888";

test("uploaded images are referenced by ID only, resolve through the linked data and are never treated as CRM media", () => {
  const hero = createSection("HERO", "hero-main");
  const valid = (image: unknown) => pageDataSchema.safeParse({schemaVersion: 1, theme: defaultTheme(), sections: [{...hero, props: {...hero.props, image}}]}).success;
  assert.equal(valid({uploadId: UPLOAD_ID, alt: "Lobby"}), true);
  assert.equal(valid({uploadId: "../../etc/passwd", alt: ""}), false);
  assert.equal(valid({uploadId: UPLOAD_ID, url: "https://evil.example/x.png", alt: ""}), false);
  const linked = {...linkedFor({project: project(), uploads: [{id: UPLOAD_ID, alt: "Lobby at dusk", width: 1600, height: 900}]}), readAt: READ_AT};
  assert.deepEqual(resolveImage({uploadId: UPLOAD_ID, alt: ""}, linked), {id: UPLOAD_ID, url: `/api/websites/media/${UPLOAD_ID}/content`, srcSet: null, alt: "Lobby at dusk", stock: false, credit: null});
  assert.equal(resolveImage({uploadId: "99999999-9999-4999-8999-999999999999", alt: ""}, linked), null, "an upload of another company is not in the linked data");
  const page = blankPage();
  const index = page.sections.findIndex(section => section.type === "HERO");
  page.sections[index] = {...page.sections[index], style: {...page.sections[index].style, backgroundType: "IMAGE", backgroundImage: {uploadId: UPLOAD_ID, alt: ""}}} as PageSection;
  assert.deepEqual(uploadIdsOf(page), [UPLOAD_ID]);
  assert.deepEqual(usedUploadIds(page), [UPLOAD_ID]);
  assert.deepEqual(unknownImageRefs(page, linked), [], "uploads are not checked against the linked records' photos");
  assert.ok(!usedMediaIds(page, linked).includes(UPLOAD_ID), "uploads are not CRM media");
  assert.match(render(page, linked), new RegExp(`/api/websites/media/${UPLOAD_ID}/content`));
  page.sections[index] = {...page.sections[index], visible: false} as PageSection;
  assert.deepEqual(usedUploadIds(page), [], "hidden sections publish no uploads");
  assert.deepEqual(uploadIdsOf(page), [UPLOAD_ID], "but the editor still resolves them");
});

test("uploads are accepted only when the bytes match the declared image type; dimensions come from the header", () => {
  const png = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.write("IHDR", 12, "ascii");
  png.writeUInt32BE(1920, 16); png.writeUInt32BE(1080, 20);
  assert.equal(matchesImageSignature(png, "image/png"), true);
  assert.equal(matchesImageSignature(png, "image/jpeg"), false);
  assert.deepEqual(imageDimensions(png, "image/png"), {width: 1920, height: 1080});
  const html = Buffer.from("<html><script>alert(1)</script></html>");
  for (const type of ["image/png", "image/jpeg", "image/webp"] as const) assert.equal(matchesImageSignature(html, type), false, type);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03]);
  assert.deepEqual(imageDimensions(jpeg, "image/jpeg"), {width: 800, height: 600});
  assert.equal(imageDimensions(Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg"), null);
  assert.doesNotMatch(cleanUploadName(encodeURIComponent("../../secret/<b>lobby</b>.png"), "image/png"), /[/\\<>]/);
  assert.equal(cleanUploadName(null, "image/webp"), "image.webp");
  assert.equal(cleanUploadName("%E0%A4%A", "image/jpeg"), "image.jpg", "malformed names fall back");
});

// --- Editor upgrade M3: a location map on any page ----------------------------------------------

test("a location set on the page validates inside the UAE and replaces the record's location", () => {
  const section = createSection("LOCATION", "location-main");
  const valid = (custom: unknown) => pageDataSchema.safeParse({schemaVersion: 1, theme: defaultTheme(), sections: [{...section, props: {...section.props, custom}}]}).success;
  assert.equal(valid({label: "Dubai Marina", address: "Marina Walk, Dubai", latitude: 25.0805, longitude: 55.1403, mode: "EXACT"}), true);
  assert.equal(valid({label: "London", address: "", latitude: 51.5, longitude: -0.12, mode: "EXACT"}), false, "outside the UAE");
  assert.equal(valid({label: "X", address: "", latitude: 25.08, longitude: 55.14, mode: "HIDDEN"}), false);
  assert.equal(valid({label: "<b>x</b>", address: "", latitude: 25.08, longitude: 55.14, mode: "EXACT"}), false);
  const page = blankPage();
  page.sections.splice(2, 0, createSection("LOCATION", "location-main", {...defaultProps("LOCATION"), custom: {label: "Business Bay", address: "Business Bay, Dubai", latitude: 25.1857, longitude: 55.2721, mode: "EXACT"}}));
  const noLocation = linkedFor({}, branding);
  const location = page.sections[2] as SectionOf<"LOCATION">;
  assert.equal(sectionAvailability(location, noLocation, {hasForm: true, today: TODAY, mode: "public"}).ok, true, "available without a linked record");
  assert.match(render(page, noLocation), /Business Bay, Dubai/);
  const checklist = buildChecklist({page: {title: "T", slug: "t", seoTitle: null, seoDescription: null}, data: page, linked: noLocation, form: {status: "ACTIVE", consentText: "ok", privacyPolicyUrl: "https://x.example"}, contentWarnings: 0, today: TODAY});
  assert.ok(checklist.items.some(item => item.id === "custom-location" && item.status === "MANUAL"));
  const withoutCustom = {...location, props: {...location.props, custom: null}};
  assert.equal(sectionAvailability(withoutCustom, noLocation, {hasForm: true, today: TODAY, mode: "public"}).ok, false);
});

test("an approximate pin is generalized for publication and never rendered exactly", () => {
  const page = blankPage();
  page.sections.splice(2, 0, createSection("LOCATION", "location-main", {...defaultProps("LOCATION"), custom: {label: "Secret villa", address: "Emirates Hills, Dubai", latitude: 25.067891, longitude: 55.165432, mode: "APPROXIMATE"}}));
  const published = publicPageData(page);
  const custom = (published.sections[2] as SectionOf<"LOCATION">).props.custom!;
  assert.notEqual(custom.latitude, 25.067891);
  assert.notEqual(custom.longitude, 55.165432);
  assert.deepEqual(publicPageData(published), published, "generalizing is idempotent");
  assert.deepEqual((page.sections[2] as SectionOf<"LOCATION">).props.custom!.latitude, 25.067891, "the draft keeps the exact pin");
  const html = render(published, linkedFor({}, branding));
  assert.doesNotMatch(html, /25\.067891|55\.165432/);
  assert.doesNotMatch(render(page, linkedFor({}, branding)), /25\.067891|55\.165432/, "even before generalizing, the renderer shows only the area");
  const exact = blankPage();
  exact.sections.splice(2, 0, createSection("LOCATION", "location-main", {...defaultProps("LOCATION"), custom: {label: "Showroom", address: "", latitude: 25.067891, longitude: 55.165432, mode: "EXACT"}}));
  assert.deepEqual(publicPageData(exact), exact, "exact pins chosen by staff are published as set");
});

// --- Editor upgrade M4: custom sections (rows → columns → widgets) ------------------------------

function customPage(rows?: SectionOf<"CUSTOM">["props"]["rows"]) {
  const page = blankPage();
  const custom = createSection("CUSTOM", "custom-main", rows ? {rows} : undefined);
  page.sections.splice(2, 0, custom);
  return page;
}
const parses = (page: unknown) => pageDataSchema.safeParse(page);

test("custom sections validate their structure, widget props and IDs", () => {
  const page = customPage();
  assert.equal(parses(page).success, true, "the starter layout is valid");
  const custom = page.sections[2] as SectionOf<"CUSTOM">;
  const withRows = (rows: unknown) => ({...page, sections: page.sections.map(section => section.id === "custom-main" ? {...section, props: {rows}} : section)});
  assert.equal(parses(withRows([{...custom.props.rows[0], layout: "1-1-1"}])).success, false, "three-column layout with two columns");
  assert.equal(parses(withRows([])).success, false, "at least one row");
  const heading = custom.props.rows[0].columns[0].widgets[0];
  const withWidget = (widget: unknown) => withRows([{...custom.props.rows[0], columns: [{...custom.props.rows[0].columns[0], widgets: [widget]}, custom.props.rows[0].columns[1]]}]);
  assert.equal(parses(withWidget({...heading, props: {...heading.props, text: "<img src=x onerror=alert(1)>"}})).success, false, "no HTML in widgets");
  assert.equal(parses(withWidget({...heading, type: "SCRIPT"})).success, false, "unknown widget types");
  assert.equal(parses(withWidget({...heading, props: {...heading.props, html: "<b>x</b>"}})).success, false, "no extra props");
  assert.equal(parses(withWidget({...heading, style: {...heading.style, color: "red; background:url(x)"}})).success, false, "colours are #rrggbb only");
  assert.equal(parses(withWidget({id: "w-image", type: "IMAGE", props: {image: {url: "https://evil.example/x.png", alt: ""}, ratio: "SQUARE", rounded: true, caption: ""}})).success, false, "images are references, not URLs");
  assert.equal(parses(withWidget({id: "w-spacer", type: "SPACER", props: {height: 5000}})).success, false);
  assert.equal(parses(withWidget({...heading, id: "custom-main"})).success, false, "IDs are unique across the page");
  const twoForms = withRows([{...custom.props.rows[0], columns: [{...custom.props.rows[0].columns[0], widgets: [defaultWidget("FORM", "w-form-1"), defaultWidget("FORM", "w-form-2")]}, custom.props.rows[0].columns[1]]}]);
  assert.equal(parses(twoForms).success, false, "one lead form per page");
  const formAndSection = withRows([{...custom.props.rows[0], columns: [{...custom.props.rows[0].columns[0], widgets: [defaultWidget("FORM", "w-form-1")]}, custom.props.rows[0].columns[1]]}]);
  assert.equal(parses(formAndSection).success, false, "the blank page already has an enquiry form section");
});

test("custom sections render rows as container-query grids; public pages drop widgets without data and carry no editor attributes", () => {
  const rows: SectionOf<"CUSTOM">["props"]["rows"] = [{id: "row-a", layout: "1-2", ...ROW_DEFAULTS, gap: "LG", columns: [
    {id: "col-a", background: "#0f6b64", padding: {top: 24, right: 24, bottom: 24, left: 24}, verticalAlign: "CENTER", widgets: [
      {...defaultWidget("HEADING", "w-heading"), props: {text: "Why invest here", level: "H2", size: "LG", eyebrow: "Investment"}},
      {...defaultWidget("COUNTER", "w-counter"), props: {source: "STARTING_PRICE", value: "AED 1", label: "Starting price"}},
      {...defaultWidget("COUNTER", "w-size"), props: {source: "SIZE", value: "", label: "Size"}},
    ]},
    {id: "col-b", background: null, padding: null, verticalAlign: "START", widgets: [
      {...defaultWidget("ICON_LIST", "w-list"), props: {items: [{text: "Waterfront promenade", icon: "WAVES"}]}},
      {...defaultWidget("BUTTON", "w-button"), style: {...defaultWidget("BUTTON", "w-button").style, align: "CENTER", padding: {top: 8, right: 0, bottom: 8, left: 0}}},
      defaultWidget("VIDEO", "w-video"),
    ]},
  ]}];
  const page = customPage(rows);
  const linked = linkedFor(fullSources);
  const html = render(page, linked);
  assert.match(html, /--pg-cols:minmax\(0,33fr\) minmax\(0,67fr\)/, "a 1/3 + 2/3 layout becomes 33 % and 67 % columns");
  assert.match(html, /@3xl:grid-cols-\[var\(--pg-cols-t\)\] @5xl:grid-cols-\[var\(--pg-cols\)\]/);
  assert.match(html, /Why invest here/);
  assert.match(html, /AED 1,250,000/, "a CRM counter shows the recorded value, not the typed one");
  assert.doesNotMatch(html, />AED 1</);
  assert.doesNotMatch(html, />Size</, "an unrecorded CRM fact is left off");
  assert.match(html, /background-color:#0f6b64/);
  assert.match(html, /padding:8px 0px 8px 0px/);
  assert.match(html, /Waterfront promenade/);
  assert.match(html, /videos\.pexels\.com/);
  assert.doesNotMatch(html, /data-widget-path|data-column-path|contenteditable/);
  assert.ok(stockMediaUsed(page).videos.includes("video-living-modern"), "widget videos need the stock attestation");
  const editable = renderToString(createElement(PageRenderer, {mode: "editor", today: TODAY, page: {title: "T", data: page, linked, form: null},
    edit: {onText: () => undefined, wrapSection: (_section: PageSection, element: ReactElement) => element}}));
  assert.match(editable, /data-widget-path="rows\.0\.columns\.0\.widgets\.0"/);
  assert.match(editable, /data-column-path="rows\.0\.columns\.1"/);
  assert.match(editable, /data-edit-path="rows\.0\.columns\.0\.widgets\.0\.props\.text"/);
  assert.match(editable, /not shown publicly/, "the editor labels widgets that are hidden publicly");
});

test("custom-section edits keep IDs unique and widgets in place", () => {
  const page = customPage();
  const section = page.sections[2] as SectionOf<"CUSTOM">;
  const taken = pageElementIds(page);
  const inserted = insertWidget(section, "rows.0.columns.1", createWidget("SPACER", taken), 0)!;
  assert.equal(inserted.path, "rows.0.columns.1.widgets.0");
  assert.equal(widgetAt(inserted.section, inserted.path)?.type, "SPACER");
  const moved = moveWidget(inserted.section, "rows.0.columns.0.widgets.0", 1);
  assert.equal(moved.path, "rows.0.columns.0.widgets.1");
  assert.equal(widgetAt(moved.section, moved.path)?.type, "HEADING");
  const copy = duplicateWidget(moved.section, moved.path, taken)!;
  assert.notEqual(widgetAt(copy.section, copy.path)!.id, widgetAt(moved.section, moved.path)!.id);
  const removed = removeWidget(copy.section, copy.path) as SectionOf<"CUSTOM">;
  assert.equal(removed.props.rows[0].columns[0].widgets.length, 3);
  const narrowed = setRowLayout(removed.props.rows[0], "1", taken);
  assert.equal(narrowed.columns.length, 1);
  assert.equal(narrowed.columns[0].widgets.length, 3 + removed.props.rows[0].columns[1].widgets.length, "widgets of removed columns move into the last column");
  const widened = setRowLayout(narrowed, "1-1-1", taken);
  assert.equal(widened.columns.length, 3);
  const fresh = withFreshIds(section, "custom-copy", taken);
  const doubled = {...page, sections: [...page.sections, fresh]};
  assert.equal(parses(doubled).success, true, "a duplicated custom section gets new row, column and widget IDs");
});

test("widgets share the page's privacy, agent, upload and form rules", () => {
  const map = {...defaultWidget("MAP", "w-map"), props: {showMap: true, custom: {label: "Villa", address: "Al Barari, Dubai", latitude: 25.098765, longitude: 55.312345, mode: "APPROXIMATE" as const}}};
  const card = {...defaultWidget("CONTACT_CARD", "w-card"), props: {agentId: AGENT_ID, showCompany: false}};
  const gallery = {...defaultWidget("GALLERY", "w-gallery"), props: {images: [{uploadId: UPLOAD_ID, alt: "Lobby"}], columns: 2 as const, lightbox: true}};
  const page = customPage([{id: "row-a", layout: "1", ...ROW_DEFAULTS, gap: "MD", columns: [{id: "col-a", background: null, padding: null, verticalAlign: "START", widgets: [map, card, gallery]}]}]);
  const published = publicPageData(page);
  const publishedMap = sectionWidgets(published.sections[2]).find(item => item.widget.type === "MAP")!.widget as typeof map;
  assert.notEqual(publishedMap.props.custom.latitude, 25.098765, "approximate widget pins are generalized");
  const linked = linkedFor({project: project(), agents: [agentSource], uploads: [{id: UPLOAD_ID, alt: "Lobby"}]}, officeBrand);
  assert.doesNotMatch(render(published, linked), /25\.098765|55\.312345/);
  assert.deepEqual(agentsShown(page, linked), [AGENT_ID]);
  assert.ok(buildChecklist({page: {title: "T", slug: "t", seoTitle: null, seoDescription: null}, data: page, linked, form: {status: "ACTIVE", consentText: "ok", privacyPolicyUrl: "https://x.example"}, contentWarnings: 0, today: TODAY})
    .attestations.includes("AGENT_DETAILS_CONSENT"));
  assert.deepEqual(usedUploadIds(page), [UPLOAD_ID], "uploads inside widgets are published");
  assert.match(render(page, linked), /Sara Example/);
  const formOnly = customPage([{id: "row-a", layout: "1", ...ROW_DEFAULTS, gap: "MD", columns: [{id: "col-a", background: null, padding: null, verticalAlign: "START", widgets: [defaultWidget("FORM", "w-form")]}]}]);
  const custom = formOnly.sections[2];
  assert.equal(sectionAvailability(custom, linked, {hasForm: false, today: TODAY, mode: "public"}).ok, false, "a section with only a form widget needs a connected form");
  assert.equal(sectionAvailability(custom, linked, {hasForm: true, today: TODAY, mode: "public"}).ok, true);
});

// --- Editor upgrade M5: saved sections library --------------------------------------------------

test("saved sections are validated, keep uploads and stock media, and drop CRM photos", () => {
  const feature = createSection("FEATURE_SPLIT", "feature-main", {...defaultProps("FEATURE_SPLIT"), heading: "Spa and wellness", image: {mediaId: MEDIA_A, alt: "Spa"}});
  const saved = libraryTemplate(feature)!;
  assert.equal(saved.section.type, "FEATURE_SPLIT");
  assert.equal((saved.section as SectionOf<"FEATURE_SPLIT">).props.image, null, "CRM photos belong to one record and are removed");
  assert.match(saved.data, /Spa and wellness/);
  const withUpload = createSection("FEATURE_SPLIT", "feature-two", {...defaultProps("FEATURE_SPLIT"), image: {uploadId: UPLOAD_ID, alt: "Lobby"}});
  assert.deepEqual((libraryTemplate(withUpload)!.section as SectionOf<"FEATURE_SPLIT">).props.image, {uploadId: UPLOAD_ID, alt: "Lobby"});
  const custom = createSection("CUSTOM", "custom-saved");
  assert.equal(libraryTemplate(custom)!.section.type, "CUSTOM");
  assert.equal(libraryTemplate({...feature, props: {...feature.props, heading: "<script>alert(1)</script>"}}), null);
  assert.equal(libraryTemplate({...feature, type: "IFRAME"}), null);
  const crmOnlyGallery = createSection("CUSTOM", "custom-gallery", {rows: [{id: "row-g", layout: "1", ...ROW_DEFAULTS, gap: "MD", columns: [{id: "col-g", background: null, padding: null, verticalAlign: "START",
    widgets: [{...defaultWidget("GALLERY", "w-g"), props: {images: [{mediaId: MEDIA_A, alt: ""}], columns: 2, lightbox: true}}]}]}]});
  assert.equal(libraryTemplate(crmOnlyGallery), null, "a widget left without images cannot be saved");
  assert.deepEqual(parseLibrarySection(saved.data), saved.section);
  assert.equal(parseLibrarySection("{not json"), null);
  assert.equal(parseLibrarySection(JSON.stringify({...feature, props: {html: "<b>"}})), null, "stored rows are validated again when read");
  assert.equal(sectionTemplateSchema.safeParse({name: "Spa", category: "Features", section: feature}).success, true);
  assert.equal(sectionTemplateSchema.safeParse({name: "Spa", category: "Secret", section: feature}).success, false);
  assert.equal(sectionTemplateSchema.safeParse({name: "", section: feature}).success, false);
});

// --- Per-element styling and fixing checklist items in the editor ----------------------------

test("element styles are bounded enums, numbers and colours keyed by element; older pages default to none", () => {
  const hero = createSection("HERO", "hero-main");
  assert.deepEqual(hero.style.elementStyles, {});
  const ok = (elementStyles: Record<string, unknown>) => pageDataSchema.safeParse({schemaVersion: 1, theme: defaultTheme(), sections: [{...hero, style: {...hero.style, elementStyles}}]}).success;
  assert.equal(ok({headline: {color: "#B03A0B", size: 64, sizeMobile: 40, weight: "BOLD", align: "CENTER", textCase: "UPPERCASE", letterSpacing: 4, lineHeight: 110}, image: {radius: 24, maxWidth: 520, align: "RIGHT", opacity: 80}}), true);
  for (const bad of [{color: "red"}, {color: "#fff;background:url(x)"}, {size: 200}, {size: "64px"}, {weight: "900"}, {align: "JUSTIFY"}, {opacity: 5}, {radius: 81}, {spaceBefore: 401}, {font: "Comic Sans"}, {unknown: 1}]) {
    assert.equal(ok({headline: bad}), false, JSON.stringify(bad));
  }
  for (const key of ["headline}{color:red", "a b", "a.b.c.d.e"]) assert.equal(ok({[key]: {}}), false, key);
  assert.equal(ok(Object.fromEntries(Array.from({length: 41}, (_, index) => [`item${index}`, {color: "#111111"}]))), false, "at most 40 styled elements");
  const stored = pageDataSchema.parse({schemaVersion: 1, theme: defaultTheme(), sections: [{...hero, style: {...hero.style, elementStyles: {headline: {color: "#B03A0B"}}}}]});
  assert.equal(stored.sections[0].style.elementStyles.headline.color, "#b03a0b", "colours are normalised");
  assert.equal(isDefaultElementStyle(stored.sections[0].style.elementStyles.headline), false);
  assert.equal(isDefaultElementStyle(DEFAULT_ELEMENT_STYLE), true);
});

test("element styles become fixed inline properties: phone sizes, alignment, device visibility (faded in the editor)", () => {
  const style = {...DEFAULT_ELEMENT_STYLE, size: 72, align: "CENTER" as const, color: "#112233", devices: {desktop: true, tablet: true, mobile: false}};
  const text = elementCss(style, "text");
  assert.equal(text.style.color, "#112233");
  assert.equal(text.style.textAlign, "center");
  assert.equal(text.style.display, "block", "inline text becomes a block to align");
  assert.equal((text.style as Record<string, string>)["--pg-el-fs"], "72px");
  assert.equal((text.style as Record<string, string>)["--pg-el-fs-m"], `${mobileSize(72)}px`);
  assert.ok(mobileSize(72) < 72 && mobileSize(16) === 16, "large type is reduced on phones, small type is kept");
  assert.match(text.sizeClass, /@3xl:text-\[length:var\(--pg-el-fs\)\]/);
  assert.match(text.className, /@max-3xl:hidden/);
  assert.match(elementCss(style, "text", true).className, /@max-3xl:opacity-30/);
  assert.doesNotMatch(elementCss(style, "text", true).className, /hidden/, "the editor keeps hidden elements selectable");
  const block = elementCss({...DEFAULT_ELEMENT_STYLE, align: "RIGHT"}, "block");
  assert.equal(block.style.justifyContent, "flex-end");
  const image = elementCss({...DEFAULT_ELEMENT_STYLE, radius: 0, maxWidth: 400, align: "CENTER"}, "image");
  assert.equal(image.style.borderRadius, 0);
  assert.equal(image.style.marginLeft, "auto");
  assert.deepEqual(elementCss(undefined, "text"), {style: {}, className: "", sizeClass: ""});
});

test("styled headings, eyebrows, images and buttons render on public pages without editor attributes; the editor marks their kind", () => {
  const page = pageFromTemplate("OFF_PLAN_LAUNCH");
  const index = page.sections.findIndex(section => section.type === "HERO");
  const hero = page.sections[index];
  page.sections[index] = {...hero, variant: "split", props: {...hero.props, image: {stockId: "skyline-sunset", alt: "Skyline"}}, style: {...hero.style, backgroundType: "NONE", elementStyles: {
    headline: {...DEFAULT_ELEMENT_STYLE, color: "#b03a0b", size: 60, weight: "LIGHT"},
    eyebrow: {...DEFAULT_ELEMENT_STYLE, align: "RIGHT", color: "#0f6b64"},
    primaryCta: {...DEFAULT_ELEMENT_STYLE, background: "#111111", radius: 0, size: 18},
    image: {...DEFAULT_ELEMENT_STYLE, radius: 40, opacity: 90},
  }}} as PageSection;
  const linked = linkedFor({...fullSources, media: [photo(MEDIA_A)]});
  const html = render(page, linked);
  assert.match(html, /style="color:#b03a0b;--pg-el-fs:60px;--pg-el-fs-m:43px;font-weight:300"[^>]*>Waterfront living/);
  assert.match(html, /justify-end[^"]*" style="color:#0f6b64"/, "the eyebrow line and label align together");
  assert.match(html, /<a href="#enquire" style="background-color:#111111;--pg-el-fs:18px;--pg-el-fs-m:18px;border-radius:0(px)?"/);
  assert.match(html, /style="opacity:0.9;border-radius:40px"/);
  assert.doesNotMatch(html, /data-move-key|data-element-kind/);
  const editable = renderToString(createElement(PageRenderer, {mode: "editor", today: TODAY, page: {title: "T", data: page, linked, form: null},
    edit: {onText: () => undefined, wrapSection: (_section: PageSection, element: ReactElement) => element}}));
  assert.match(editable, /data-move-key="image" data-element-kind="image"/);
  assert.match(editable, /data-move-key="primaryCta" data-element-kind="button"/);
  assert.match(editable, /data-move-key="headline" data-element-kind="text"/);
});

test("widgets take a text style for their own text, image or button", () => {
  const heading = createWidget("HEADING", new Set<string>());
  const styled = {...heading, style: {...heading.style, text: {...DEFAULT_ELEMENT_STYLE, color: "#7d5f1e", size: 44, italic: true}}};
  const row = {id: "custom-1-r1", layout: "1" as const, gap: "MD" as const, ...ROW_DEFAULTS, columns: [{id: "custom-1-c1", padding: null, background: null, verticalAlign: "START" as const, widgets: [styled]}]};
  const page = blankPage();
  page.sections.splice(1, 0, createSection("CUSTOM", "custom-1", {rows: [row]}));
  assert.equal(pageDataSchema.safeParse(page).success, true);
  const unsafe = {...styled, style: {...styled.style, text: {color: "javascript:alert(1)"}}};
  assert.equal(pageDataSchema.safeParse({...page, sections: page.sections.map(section => section.type === "CUSTOM" ? {...section, props: {rows: [{...row, columns: [{...row.columns[0], widgets: [unsafe]}]}]}} : section)}).success, false);
  assert.match(render(page), /style="color:#7d5f1e;--pg-el-fs:44px;--pg-el-fs-m:32px;font-style:italic"/);
});

test("checklist items say where they are fixed, so the editor can fix them in place", () => {
  const missing = checklistFor({project: project({permitNumber: null})}, pageFromTemplate("OFF_PLAN_LAUNCH"), noContacts, null);
  const fixOf = (id: string) => missing.items.find(item => item.id === id)?.fix;
  assert.deepEqual(fixOf("contact"), {kind: "BRAND", focus: "contacts"});
  assert.deepEqual(fixOf("disclaimer"), {kind: "BRAND", focus: "disclaimer"});
  assert.deepEqual(fixOf("form"), {kind: "LEAD_FORM"});
  assert.deepEqual(fixOf("project-permit"), {kind: "RECORD", record: "project", id: "11111111-1111-4111-8111-111111111111"});
  const passing = checklistFor({project: project()}, pageFromTemplate("OFF_PLAN_LAUNCH"));
  assert.ok(passing.items.filter(item => item.status === "PASS").every(item => !item.fix), "passed items offer no fix");
  const page = pageFromTemplate("COMING_SOON");
  page.sections.splice(1, 0, createSection("TESTIMONIALS", "testimonials-1", {...defaultProps("TESTIMONIALS"), items: [{quote: "Great service", author: "A. Client", context: ""}]}));
  assert.deepEqual(checklistFor({project: project()}, page).items.find(item => item.id === "testimonials")?.fix, {kind: "SECTION", sectionId: "testimonials-1"});
});

// --- Form panels and the new project showcase template ----------------------------------------

test("the hero's form panel keeps the theme colours over a video or photo, and its own style recolours fields and button", () => {
  const page = pageFromTemplate("PROJECT_SHOWCASE");
  const index = page.sections.findIndex(section => section.type === "HERO");
  const hero = page.sections[index];
  page.sections[index] = {...hero, style: {...hero.style, backgroundType: "VIDEO", backgroundVideo: {stockId: "video-dubai-shore"}}} as PageSection;
  const linked = linkedFor(fullSources);
  const html = render(page, linked);
  const panel = (markup: string) => markup.match(/<div style="([^"]*)" class="rounded-\[var\(--pg-radius\)\] p-1 shadow-2xl[^"]*"/)?.[1] ?? "";
  assert.match(panel(html), /--pg-fg:#0f172a/, "the panel resets the text colour the video background turned white");
  assert.match(panel(html), /background-color:#ffffff/);
  page.sections[index] = {...page.sections[index], style: {...page.sections[index].style, elementStyles: {form: {...DEFAULT_ELEMENT_STYLE, background: "#0b0b0e", accent: "#c9a35b", radius: 8}}}} as PageSection;
  const styled = panel(render(page, linked));
  for (const part of ["--pg-bg:#0b0b0e", "--pg-card:#0b0b0e", "--pg-fg:#ffffff", "--pg-muted-fg:#ffffffb3", "--pg-border:#ffffff33", "--pg-accent:#c9a35b", "--pg-radius:8px", "color:#ffffff"]) assert.ok(styled.includes(part), part);
  assert.match(styled, /background-color:#0b0b0e/);
  const card = elementCss({...DEFAULT_ELEMENT_STYLE, color: "#7d5f1e"}, "card");
  assert.equal((card.style as Record<string, string>)["--pg-fg"], "#7d5f1e", "a text colour alone overrides the panel's labels");
});

test("the editor shows the split-form hero with a sample form before a lead form is connected; public pages fall back to the split layout", () => {
  const page = pageFromTemplate("PROJECT_SHOWCASE");
  const linked = linkedFor(fullSources);
  const editor = renderToString(createElement(PageRenderer, {mode: "editor", today: TODAY, page: {title: "T", data: page, linked, form: null},
    edit: {onText: () => undefined, wrapSection: (_section: PageSection, element: ReactElement) => element}}));
  assert.match(editor, /data-move-key="form" data-element-kind="card"/);
  assert.match(editor, /Sample · connect a lead form/);
  assert.match(editor, /data-move-key="badgeBox"/);
  assert.doesNotMatch(render(page, linked, "public", false), /data-move-key|Sample · connect/);
});

test("the new project showcase follows a buyer's reading order and makes no factual claims of its own", () => {
  const page = pageFromTemplate("PROJECT_SHOWCASE");
  assert.deepEqual(page.sections.map(section => section.type), ["NAVBAR", "HERO", "PROJECT_OVERVIEW", "AMENITIES", "FEATURE_SPLIT", "PAYMENT_PLANS", "FLOOR_PLANS", "GALLERY", "LOCATION", "ENQUIRY_FORM", "BANNER", "FAQ", "FOOTER"]);
  const hero = page.sections[1];
  assert.equal(hero.variant, "splitForm");
  assert.equal(hero.type === "HERO" && hero.props.showFacts, true, "price, payment plan and handover come from the CRM");
  assert.doesNotMatch(JSON.stringify(page), /AED|\d+\s?(min|minutes|km)|\d+%|20\d\d/i, "no prices, distances, percentages or dates in template copy");
});

// --- Columns, containers, inner sections, content inside built-in sections and the navigation bar ---

function rowOf(id: string, layout: CustomRow["layout"], columns: CustomRow["columns"], extra: Partial<CustomRow> = {}): CustomRow {
  return {id, layout, ...ROW_DEFAULTS, gap: "MD", columns, ...extra};
}
const col = (id: string, widgets: CustomRow["columns"][number]["widgets"] = []) => ({id, widgets, background: null, padding: null, verticalAlign: "START" as const});
function withCustom(rows: CustomRow[]) {
  const page = blankPage();
  // No enquiry form section, so form widgets can be tested (one lead form per page).
  page.sections = page.sections.filter(section => section.type !== "ENQUIRY_FORM");
  page.sections.splice(1, 0, createSection("CUSTOM", "custom-x", {rows}));
  return page;
}

test("column widths are whole percentages, one per column, adding up to 100; up to six columns; phones stack, keep or reverse", () => {
  const ok = (row: CustomRow) => pageDataSchema.safeParse(withCustom([row])).success;
  assert.equal(ok(rowOf("row-a", "1-1", [col("col-a"), col("col-b")], {widths: [40, 60]})), true);
  assert.equal(ok(rowOf("row-a", "1-1", [col("col-a"), col("col-b")], {widths: [40, 50]})), false, "widths must add up to 100");
  assert.equal(ok(rowOf("row-a", "1-1", [col("col-a"), col("col-b")], {widths: [100]})), false, "one width per column");
  assert.equal(ok(rowOf("row-a", "1-1", [col("col-a"), col("col-b")], {widths: [2, 98]})), false, "columns are at least 5 %");
  assert.equal(ok(rowOf("row-a", "1-1-1-1-1-1", ["a", "b", "c", "d", "e", "f"].map(letter => col(`col-${letter}`)))), true);
  assert.deepEqual(columnWidths({layout: "1-2-1", widths: null}), [25, 50, 25]);
  assert.deepEqual(setColumnWidth([50, 50], 0, 70), [70, 30], "the neighbour takes the difference");
  assert.deepEqual(setColumnWidth([20, 30, 50], 2, 90), [20, 5, 75], "never below 5 %");
  const keep = render(withCustom([rowOf("row-a", "1-1", [col("col-a", [defaultWidget("TEXT", "w-a")]), col("col-b", [defaultWidget("TEXT", "w-b")])], {widths: [30, 70], mobile: "KEEP"})]));
  assert.match(keep, /class="grid grid-cols-\[var\(--pg-cols\)\][^"]*" style="--pg-cols:minmax\(0,30fr\) minmax\(0,70fr\)/, "side by side on phones too");
  const reverse = render(withCustom([rowOf("row-a", "1-1", [col("col-a", [defaultWidget("TEXT", "w-a")]), col("col-b", [defaultWidget("TEXT", "w-b")])], {reverseOnMobile: true})]));
  assert.match(reverse, /flex flex-col-reverse @3xl:grid/);
});

test("a row is a container: background colour or image with an overlay, padding, corners and height", () => {
  const row = rowOf("row-a", "1", [col("col-a", [defaultWidget("TEXT", "w-a")])], {background: "#0b0b0e", backgroundImage: {stockId: "pool-infinity-bay", alt: ""}, overlay: 40, radius: 24, minHeight: 420, align: "CENTER"});
  const page = withCustom([row]);
  assert.equal(pageDataSchema.safeParse(page).success, true);
  const html = render(page);
  assert.match(html, /background-color:#0b0b0e;color:#ffffff;border-radius:24px;min-height:420px/);
  assert.match(html, /style="opacity:0.4"/);
  assert.ok(stockMediaUsed(page).images.includes("pool-infinity-bay"), "row images count as stock media");
  assert.equal(pageDataSchema.safeParse(withCustom([{...row, overlay: 95}])).success, false);
});

test("inner sections hold columns of simple widgets; their widgets share every page rule", () => {
  const map = {...defaultWidget("MAP", "w-map"), props: {showMap: true, custom: {label: "Villa", address: "Al Barari, Dubai", latitude: 25.098765, longitude: 55.312345, mode: "APPROXIMATE" as const}}};
  const inner = defaultWidget("INNER_SECTION", "w-inner");
  const nested = {...inner, props: {...inner.props, columns: [col("w-inner-c1", [map]), col("w-inner-c2", [defaultWidget("FORM", "w-form")])]}};
  const page = withCustom([rowOf("row-a", "1", [col("col-a", [nested as never])])]);
  assert.equal(pageDataSchema.safeParse(page).success, true);
  const section = page.sections[1];
  assert.deepEqual(sectionWidgets(section).map(item => item.path), ["rows.0.columns.0.widgets.0", "rows.0.columns.0.widgets.0.props.columns.0.widgets.0", "rows.0.columns.0.widgets.0.props.columns.1.widgets.0"]);
  const published = JSON.stringify(publicPageData(page));
  assert.doesNotMatch(published, /25\.098765|55\.312345/, "approximate pins inside inner sections are generalized");
  const twoForms = withCustom([rowOf("row-a", "1-1", [col("col-a", [nested as never]), col("col-b", [defaultWidget("FORM", "w-form-2")])])]);
  assert.equal(pageDataSchema.safeParse(twoForms).success, false, "one lead form per page, inner sections included");
  const deep = {...inner, props: {...inner.props, columns: [col("w-inner-c1", [defaultWidget("INNER_SECTION", "w-deep")] as never), col("w-inner-c2")]}};
  assert.equal(pageDataSchema.safeParse(withCustom([rowOf("row-a", "1", [col("col-a", [deep as never])])])).success, false, "inner sections do not nest");
  const duplicateIds = {...inner, props: {...inner.props, columns: [col("col-a"), col("w-inner-c2")]}};
  assert.equal(pageDataSchema.safeParse(withCustom([rowOf("row-a", "1", [col("col-a", [duplicateIds as never])])])).success, false, "inner IDs are unique on the page");
  const taken = pageElementIds(page);
  assert.equal(insertWidget(section, "rows.0.columns.0.widgets.0.props.columns.1", createWidget("INNER_SECTION", taken)), null);
  const added = insertWidget(section, "rows.0.columns.0.widgets.0.props.columns.1", createWidget("HEADING", taken), 0)!;
  assert.equal(widgetAt(added.section, added.path)?.type, "HEADING");
  const editable = renderToString(createElement(PageRenderer, {mode: "editor", today: TODAY, page: {title: "T", data: page, linked: linkedFor(fullSources), form: null},
    edit: {onText: () => undefined, wrapSection: (_section: PageSection, element: ReactElement) => element}}));
  assert.match(editable, /data-column-path="rows\.0\.columns\.0\.widgets\.0\.props\.columns\.1"/);
  assert.match(editable, /data-drag-widget="rows\.0\.columns\.0\.widgets\.0\.props\.columns\.0\.widgets\.0"/);
});

test("widgets can be added inside built-in sections, before or after their content, but not to the navigation bar or footer", () => {
  const page = pageFromTemplate("OFF_PLAN_LAUNCH");
  const index = page.sections.findIndex(section => section.type === "PROJECT_OVERVIEW");
  const taken = pageElementIds(page);
  const added = addToSection(page.sections[index], createWidget("BUTTON", taken), "BEFORE", taken)!;
  assert.equal(added.path, "extra.rows.0.columns.0.widgets.0");
  page.sections[index] = added.section;
  assert.equal(pageDataSchema.safeParse(page).success, true);
  const html = render(page);
  const overview = html.slice(html.indexOf('data-section-type="PROJECT_OVERVIEW"'));
  assert.ok(overview.indexOf("Enquire now") < overview.indexOf("A new address with a view of everything"), "added before the section's own content");
  assert.equal(addToSection(page.sections[0], createWidget("TEXT", taken), "AFTER", taken), null, "not in the navigation bar");
  const navbar = {...page.sections[0], extra: {position: "AFTER", rows: [newRow("1", taken)]}};
  assert.equal(pageDataSchema.safeParse({...page, sections: [navbar, ...page.sections.slice(1)]}).success, false);
  const upload = {...createWidget("IMAGE", taken), props: {image: {uploadId: "abcdef01-2345-4678-9abc-def012345678", alt: ""}, ratio: "WIDE" as const, rounded: true, caption: ""}};
  const withUpload = insertWidget(page.sections[index], "extra.rows.0.columns.0", upload as never)!;
  assert.deepEqual(uploadIdsOf({...page, sections: page.sections.map((section, position) => position === index ? withUpload.section : section)}), ["abcdef01-2345-4678-9abc-def012345678"], "images in added content are published through the allowlist");
});

test("placed widgets move between columns and sections; a widget never moves into itself", () => {
  const page = customPage();
  const section = page.sections[2];
  const moved = relocateWidget(section, "rows.0.columns.0.widgets.0", section, "rows.0.columns.1", 0)!;
  assert.equal(widgetAt(moved.to, moved.path)?.type, "HEADING");
  assert.equal(moved.path, "rows.0.columns.1.widgets.0");
  const within = relocateWidget(section, "rows.0.columns.0.widgets.0", section, "rows.0.columns.0", 3)!;
  assert.equal(within.path, "rows.0.columns.0.widgets.2", "moving down in the same column accounts for the removal");
  const inner = createWidget("INNER_SECTION", pageElementIds(page));
  const holder = insertWidget(section, "rows.0.columns.0", inner, 0)!;
  assert.equal(relocateWidget(holder.section, holder.path, holder.section, `${holder.path}.props.columns.0`, 0), null);
  const other = createSection("BANNER", "banner-x");
  const target = addToSection(other, createWidget("SPACER", new Set()), "AFTER", new Set())!.section;
  const across = relocateWidget(section, "rows.0.columns.0.widgets.0", target, "extra.rows.0.columns.0", 0)!;
  assert.equal(widgetAt(across.to, across.path)?.type, "HEADING");
  assert.equal((across.from as SectionOf<"CUSTOM">).props.rows[0].columns[0].widgets.some(widget => widget.type === "HEADING" && widget.props.text === "Waterfront living"), false);
});

test("the navigation bar shows a logo, the menu links you choose (only to sections on the page), the phone and a menu for phones", () => {
  const page = pageFromTemplate("OFF_PLAN_LAUNCH");
  const navbar = page.sections[0] as SectionOf<"NAVBAR">;
  page.sections[0] = {...navbar, props: {...navbar.props, logo: {stockId: "skyline-sunset", alt: "Synthetic Realty"}, logoHeight: 48, showPhone: true, linksAlign: "RIGHT",
    links: [{label: "The project", sectionId: "project-overview-main"}, {label: "Gone", sectionId: "missing-section"}]}};
  const html = render(page);
  assert.match(html, /<img[^>]*alt="Synthetic Realty"[^>]*style="height:48px"/);
  assert.match(html, /<a href="#overview" class="opacity-80[^"]*">The project<\/a>/);
  assert.doesNotMatch(html, />Gone</, "links to missing sections are left out");
  assert.match(html, /href="tel:\+97145550100"/);
  assert.match(html, /<details class="relative @5xl:hidden"><summary aria-label="Menu"/);
  assert.equal(pageDataSchema.safeParse(page).success, true);
  const older = JSON.parse(JSON.stringify(pageFromTemplate("OFF_PLAN_LAUNCH")));
  for (const key of ["logo", "logoHeight", "links", "linksAlign", "showPhone", "mobileMenu"]) delete older.sections[0].props[key];
  assert.equal(pageDataSchema.parse(older).sections[0].type === "NAVBAR" && (pageDataSchema.parse(older).sections[0] as SectionOf<"NAVBAR">).props.mobileMenu, true, "older navigation bars get the new defaults");
});

test("gallery photos open in a full-screen viewer on public pages; the editor keeps clicks for selecting", () => {
  const page = pageFromTemplate("OFF_PLAN_LAUNCH");
  const index = page.sections.findIndex(section => section.type === "GALLERY");
  const gallery = page.sections[index] as SectionOf<"GALLERY">;
  const nine = ["pool-infinity-bay", "living-marble", "bedroom-city-view", "kitchen-marble", "bathroom-freestanding", "marina-night-boats", "gym-city-view", "skyline-sunset", "park-palms"].map(id => ({stockId: id, alt: ""}));
  page.sections[index] = {...gallery, variant: "bento", props: {...gallery.props, images: nine}};
  const html = render(page);
  assert.match(html, /<a href="https:\/\/images\.unsplash\.com[^"]*" data-lightbox-group="gallery-main" data-lightbox-index="0" aria-label="Open photo 1 of 9 full screen"/);
  assert.match(html, />\+2<\/span>/, "the last bento tile shows how many more photos there are");
  const editable = renderToString(createElement(PageRenderer, {mode: "editor", today: TODAY, page: {title: "T", data: page, linked: linkedFor(fullSources), form: null},
    edit: {onText: () => undefined, wrapSection: (_section: PageSection, element: ReactElement) => element}}));
  assert.doesNotMatch(editable, /data-lightbox-group/, "no viewer links while editing");
  page.sections[index] = {...page.sections[index], props: {...(page.sections[index] as SectionOf<"GALLERY">).props, lightbox: false}} as PageSection;
  assert.doesNotMatch(render(page), /data-lightbox-group|>\+2</, "the viewer can be switched off");
  const older = JSON.parse(JSON.stringify(pageFromTemplate("OFF_PLAN_LAUNCH")));
  delete older.sections.find((section: {type: string}) => section.type === "GALLERY").props.lightbox;
  assert.equal((pageDataSchema.parse(older).sections.find(section => section.type === "GALLERY") as SectionOf<"GALLERY">).props.lightbox, true, "older galleries get the viewer");
});
