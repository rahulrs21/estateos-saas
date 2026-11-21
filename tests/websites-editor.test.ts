import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { presentBranding } from "../src/modules/ai/content/facts";
import { canDeleteElement, canDuplicateElement, copyElement, deleteElement, duplicateElement, isListElement, moveElement, pasteElement, setElementHidden, setElementOrder, withOwnFacts } from "../src/modules/websites/element-ops";
import { PageRenderer } from "../src/modules/websites/components/page-renderer";
import { buildLinkedData } from "../src/modules/websites/linked";
import { blankPage } from "../src/modules/websites/templates";
import { convertBlocker, convertToCustom } from "../src/modules/websites/convert";
import { formPublicIdFrom } from "../src/modules/websites/form-embed";
import { newRow } from "../src/modules/websites/custom-ops";
import { DEFAULT_ELEMENT_STYLE, HERO_DEFAULT_FACTS, createSection, defaultProps, pageDataSchema, sectionWidgets, type PageSection } from "../src/modules/websites/registry";

const highlights = (count: number) => createSection("HIGHLIGHTS", "highlights-1", {...defaultProps("HIGHLIGHTS"), items: Array.from({length: count}, (_, index) => ({title: `Point ${index + 1}`, text: "", icon: "STAR" as const}))});
const red = {...DEFAULT_ELEMENT_STYLE, color: "#ff0000"};
const LINKED = buildLinkedData({}, presentBranding({companyName: "Synthetic Realty", profile: null}), {readAt: "2026-11-19T08:00:00.000Z", mediaUrl: id => `/media/${id}`});
const valid = (section: PageSection) => pageDataSchema.shape.sections.element.safeParse(section).success;

test("a list item is duplicated right after itself, with its style; later items keep theirs", () => {
  const section = {...highlights(3), style: {...highlights(3).style, elementStyles: {"items.0": red, "items.1.title": red, "items.2": {...DEFAULT_ELEMENT_STYLE, color: "#0000ff"}}, elementOffsets: {"items.2": {x: 4, y: 0}}}} as PageSection;
  assert.equal(canDuplicateElement(section, "items.1"), true);
  const result = duplicateElement(section, "items.1");
  assert.ok(result.ok);
  const props = result.section.props as {items: Array<{title: string}>};
  assert.deepEqual(props.items.map(item => item.title), ["Point 1", "Point 2", "Point 2", "Point 3"]);
  assert.deepEqual(result.section.style.elementStyles["items.2.title"], red, "the copy has the original's style");
  assert.equal(result.section.style.elementStyles["items.3"].color, "#0000ff", "the next item's style moved with it");
  assert.deepEqual(result.section.style.elementOffsets["items.3"], {x: 4, y: 0});
  assert.ok(valid(result.section));
});

test("a full list refuses a duplicate; a required list keeps its last item", () => {
  const full = highlights(8);
  const refused = duplicateElement(full, "items.0");
  assert.equal(refused.ok, false);
  assert.match(refused.message, /full/);
  assert.equal(canDuplicateElement(full, "headline"), false, "single elements are not duplicated");
  assert.equal(duplicateElement(full, "heading").ok, false);
});

test("deleting a list item removes it and moves later styles back; the deleted item's style goes with it", () => {
  const section = {...highlights(3), style: {...highlights(3).style, elementStyles: {"items.1": red, "items.2": {...DEFAULT_ELEMENT_STYLE, color: "#0000ff"}}}} as PageSection;
  const result = deleteElement(section, "items.1");
  assert.ok(result.ok);
  assert.deepEqual((result.section.props as {items: Array<{title: string}>}).items.map(item => item.title), ["Point 1", "Point 3"]);
  assert.equal(result.section.style.elementStyles["items.1"].color, "#0000ff");
  assert.equal(result.section.style.elementStyles["items.2"], undefined);
});

test("the hero's automatic key facts become its own list on the first duplicate or delete", () => {
  const hero = createSection("HERO", "hero-1", {...defaultProps("HERO"), showFacts: true});
  assert.equal((hero.props as {facts: unknown}).facts, null);
  const added = duplicateElement(hero, "facts.0");
  assert.ok(added.ok);
  assert.deepEqual((added.section.props as {facts: Array<{source: string}>}).facts.map(fact => fact.source), ["STARTING_PRICE", "STARTING_PRICE", "BEDROOMS", "PAYMENT_PLAN", "HANDOVER"]);
  const removed = deleteElement(hero, "facts.3");
  assert.ok(removed.ok);
  assert.deepEqual((removed.section.props as {facts: unknown[]}).facts, HERO_DEFAULT_FACTS.slice(0, 3));
});

test("optional parts are removed, texts emptied, CRM values only hidden", () => {
  const hero = createSection("HERO", "hero-1", {...defaultProps("HERO"), secondaryCta: {label: "Chat", action: "WHATSAPP"}, eyebrow: "New"});
  assert.equal(canDeleteElement(hero, "secondaryCta"), true);
  const noButton = deleteElement(hero, "secondaryCta");
  assert.ok(noButton.ok && (noButton.section.props as {secondaryCta: unknown}).secondaryCta === null);
  const noEyebrow = deleteElement(hero, "eyebrow");
  assert.ok(noEyebrow.ok && (noEyebrow.section.props as {eyebrow: string}).eyebrow === "");
  assert.equal(deleteElement(hero, "headline").ok, false, "the headline is required: hide it instead");
  assert.equal(canDeleteElement(hero, "price"), false, "the price comes from the CRM");
  assert.equal(deleteElement(hero, "price").ok, false);
  const hidden = setElementHidden(hero, "price", true, DEFAULT_ELEMENT_STYLE);
  assert.deepEqual(hidden.style.elementStyles.price.devices, {desktop: false, tablet: false, mobile: false});
  assert.ok(valid(hidden));
});

test("a list item moves before or after another item; styles follow their item", () => {
  const section = {...highlights(3), style: {...highlights(3).style, elementStyles: {"items.0.title": red}}} as PageSection;
  const moved = moveElement(section, "items.0", "items.2", true);
  assert.ok(moved.ok);
  assert.deepEqual((moved.section.props as {items: Array<{title: string}>}).items.map(item => item.title), ["Point 2", "Point 3", "Point 1"]);
  assert.deepEqual(moved.section.style.elementStyles["items.2.title"], red, "the style moved with its item");
  const back = moveElement(moved.section, "items.2", "items.0", false);
  assert.ok(back.ok);
  assert.deepEqual((back.section.props as {items: Array<{title: string}>}).items.map(item => item.title), ["Point 1", "Point 2", "Point 3"]);
  assert.equal(moveElement(section, "items.0", "heading", false).ok, false, "only within the list");
  assert.equal(isListElement(section, "items.1"), true);
  assert.equal(isListElement(section, "heading"), false);
});

test("the hero's automatic facts can be reordered (they become the hero's own list)", () => {
  const hero = createSection("HERO", "hero-1", {...defaultProps("HERO"), showFacts: true});
  const moved = moveElement(hero, "facts.3", "facts.0", false);
  assert.ok(moved.ok);
  assert.deepEqual((moved.section.props as {facts: Array<{source: string}>}).facts.map(fact => fact.source), ["HANDOVER", "STARTING_PRICE", "BEDROOMS", "PAYMENT_PLAN"]);
  assert.deepEqual((withOwnFacts(hero).props as {facts: unknown[]}).facts, HERO_DEFAULT_FACTS);
});

test("an element order is stored per group and the renderer follows it; pages without one are unchanged", () => {
  const page = blankPage();
  const index = page.sections.findIndex(section => section.type === "HERO");
  const hero = {...page.sections[index], props: {...page.sections[index].props, subheadline: "Sea views from every room"}} as PageSection;
  const html = (section: PageSection) => { const data = {...page, sections: page.sections.map((item, at) => at === index ? section : item)}; return renderToString(createElement(PageRenderer, {page: {title: "T", data, linked: LINKED, form: null}, mode: "public", today: "2026-11-19"})); };
  const before = html(hero);
  const result = setElementOrder(hero, "heroText", ["badgeBox", "eyebrow", "subheadline", "headline", "priceLine", "buttons"]);
  assert.ok(result.ok);
  const after = html(result.section);
  assert.ok(after.indexOf("Sea views from every room") < after.indexOf("<h1"), "the subheadline now comes first");
  assert.ok(before.indexOf("Sea views from every room") > before.indexOf("<h1"));
  assert.doesNotMatch(before, /data-order-group/, "public pages carry no editor attributes");
  assert.equal(setElementOrder(hero, "Bad Group!", ["headline"]).ok, false, "group names are checked");
  assert.equal(setElementOrder(hero, "heroText", ["<script>"]).ok, false, "element keys are checked");
});

test("copy and paste: a fact pastes as a new fact after the target; text replaces text; other kinds are refused", () => {
  const hero = createSection("HERO", "hero-1", {...defaultProps("HERO"), showFacts: true, eyebrow: "Launch", headline: "Waterfront homes"});
  const styled = {...hero, style: {...hero.style, elementStyles: {"facts.0": red}}} as PageSection;
  const fact = copyElement(styled, "facts.0");
  assert.deepEqual(fact.value, HERO_DEFAULT_FACTS[0]);
  assert.deepEqual(fact.style, red);
  const pasted = pasteElement(styled, "facts.2", fact);
  assert.ok(pasted.ok);
  assert.deepEqual((pasted.section.props as {facts: Array<{source: string}>}).facts.map(item => item.source), ["STARTING_PRICE", "BEDROOMS", "PAYMENT_PLAN", "STARTING_PRICE", "HANDOVER"]);
  assert.deepEqual(pasted.section.style.elementStyles["facts.3"], red, "with the copied style");
  const text = pasteElement(hero, "eyebrow", copyElement(hero, "headline"));
  assert.ok(text.ok);
  assert.equal((text.section.props as {eyebrow: string}).eyebrow, "Waterfront homes");
  assert.equal(pasteElement(hero, "primaryCta", copyElement(hero, "headline")).ok, false, "text does not replace a button");
  assert.equal(pasteElement(hero, "facts.0", copyElement(hero, "headline")).ok, false, "text is not a fact");
  assert.equal(copyElement(hero, "buttons").value, undefined, "a group has no content of its own");
  assert.equal(pasteElement(hero, "headline", copyElement(hero, "buttons")).ok, false);
});

// --- Convert to custom section ------------------------------------------------------------------

const widgetsOf = (section: PageSection) => sectionWidgets(section).map(item => item.widget);
const pageWith = (...sections: PageSection[]) => pageDataSchema.parse({schemaVersion: 1, theme: blankPage().theme, sections});

test("a split hero becomes rows of widgets: the headline stays the page's H1, facts become CRM counters, styles move to their widgets", () => {
  const hero = createSection("HERO", "hero-main", {...defaultProps("HERO"), eyebrow: "Launch", headline: "Waterfront homes", subheadline: "Sea views", badge: "New",
    secondaryCta: {label: "Chat", action: "WHATSAPP"}, image: {stockId: "marina-yacht", alt: "Marina"}, showFacts: true}, "split");
  const styled = {...hero, style: {...hero.style, elementStyles: {headline: red}, elementOffsets: {headline: {x: 10, y: 0}}}} as PageSection;
  const result = convertToCustom(styled, pageWith(styled));
  assert.ok(result.ok, result.ok ? "" : result.message);
  assert.equal(result.section.type, "CUSTOM");
  assert.equal(result.section.id, "hero-main", "links to the section keep working");
  const widgets = widgetsOf(result.section);
  const heading = widgets.find(item => item.type === "HEADING");
  assert.ok(heading?.type === "HEADING" && heading.props.level === "H1" && heading.props.text === "Waterfront homes" && heading.props.eyebrow === "Launch");
  assert.deepEqual(heading.style.text, red, "the headline's style moved to its widget");
  assert.deepEqual(widgets.filter(item => item.type === "BUTTON").map(item => item.type === "BUTTON" && item.props.variant), ["SOLID", "OUTLINE"]);
  assert.ok(widgets.some(item => item.type === "IMAGE"));
  assert.deepEqual(widgets.filter(item => item.type === "COUNTER").map(item => item.type === "COUNTER" && item.props.source), ["STARTING_PRICE", "LOCATION", ...HERO_DEFAULT_FACTS.map(fact => fact.source)]);
  assert.deepEqual(result.section.style.elementStyles, {});
  const counter = widgets.find(item => item.type === "COUNTER");
  assert.equal(counter?.style.text?.size, 22, "converted facts keep a size close to the hero's");
  // One counter with your own text (the test page links no CRM record, so CRM counters are not shown publicly).
  const coloured = JSON.parse(JSON.stringify(result.section).replace('"source":"STARTING_PRICE","value":""', '"source":"CUSTOM","value":"Sea view"')) as PageSection;
  const counterHtml = renderToString(createElement(PageRenderer, {page: {title: "T", data: pageWith(coloured), linked: LINKED, form: null}, mode: "public", today: "2026-11-19"}));
  assert.match(counterHtml, /<span style="[^"]*--pg-el-fs:22px[^>]*>Sea view/, "a counter's value follows its widget's text style");
  assert.ok(result.notes.some(note => /Moved elements/.test(note)));
  const html = renderToString(createElement(PageRenderer, {page: {title: "T", data: pageWith(result.section), linked: LINKED, form: null}, mode: "public", today: "2026-11-19"}));
  assert.match(html, /<h1[^>]*>.*Waterfront homes/);
});

test("a full-screen hero's photo becomes the section background; a split form keeps the page's single lead form", () => {
  const full = createSection("HERO", "hero-main", {...defaultProps("HERO"), image: {stockId: "marina-yacht", alt: ""}}, "fullBleed", {backgroundType: "NONE"});
  const converted = convertToCustom(full, pageWith(full));
  assert.ok(converted.ok);
  assert.equal(converted.section.style.backgroundType, "IMAGE");
  assert.deepEqual(converted.section.style.backgroundImage, {stockId: "marina-yacht", alt: ""});
  const formHero = createSection("HERO", "hero-main", defaultProps("HERO"), "splitForm");
  assert.ok((() => { const alone = convertToCustom(formHero, pageWith(formHero)); return alone.ok && widgetsOf(alone.section).some(item => item.type === "FORM"); })(), "the hero's form becomes a form widget");
  const withForm = convertToCustom(formHero, pageWith(formHero, createSection("ENQUIRY_FORM", "enquiry-1")));
  assert.ok(withForm.ok && !widgetsOf(withForm.section).some(item => item.type === "FORM") && withForm.notes.some(note => /enquiry form section/.test(note)), "no second form on the page");
});

test("highlights become a header row and a grid of icon boxes; added rows are kept; CRM-record sections are not converted", () => {
  const section = {...highlights(5), props: {...highlights(5).props, columns: 3}} as PageSection;
  const result = convertToCustom(section, pageWith(section));
  assert.ok(result.ok);
  const rows = (result.section.props as {rows: Array<{layout: string}>}).rows;
  assert.deepEqual(rows.map(item => item.layout), ["1", "1-1-1", "1-1-1"]);
  assert.equal(widgetsOf(result.section).filter(item => item.type === "ICON_BOX").length, 5);
  const withExtra = {...section, extra: {position: "AFTER" as const, rows: [{...newRow("1", new Set()), id: "kept-row"}]}} as PageSection;
  const kept = convertToCustom(withExtra, pageWith(withExtra));
  assert.ok(kept.ok && (kept.section.props as {rows: Array<{id: string}>}).rows.at(-1)?.id === "kept-row", "rows added inside the section stay");
  for (const type of ["UNIT_TYPES", "PAYMENT_PLANS", "FAQ", "NAVBAR", "CUSTOM"] as const) assert.ok(convertBlocker(createSection(type, `${type.toLowerCase().replaceAll("_", "-")}-1`)), type);
  assert.match(convertBlocker(createSection("GALLERY", "gallery-1"))!, /Choose its photos/);
  assert.equal(convertBlocker(createSection("FEATURE_SPLIT", "feature-1")), null);
  const refused = convertToCustom(createSection("UNIT_TYPES", "unit-types-1"), pageWith(createSection("UNIT_TYPES", "unit-types-1")));
  assert.equal(refused.ok, false);
});

// --- Connecting a lead form by pasting its link or embed code ---------------------------------------

test("a pasted form link, embed code or ID gives the form's public ID; anything else gives none", () => {
  const id = "5o_tM64m8PP-Xws3UNqY1aBcDeFgHiJkL";
  assert.equal(formPublicIdFrom(`https://estateos-staging--estateos-staging.us-east4.hosted.app/forms/${id}`), id);
  assert.equal(formPublicIdFrom(`<iframe src="https://example.test/forms/${id}" title="Staging Test Form" width="100%" height="720" loading="lazy"></iframe>`), id);
  assert.equal(formPublicIdFrom(`  ${id}  `), id, "a bare ID");
  assert.equal(formPublicIdFrom(`https://example.test/forms/${id}?utm_source=ad#top`), id);
  assert.equal(formPublicIdFrom("<script>alert(1)</script>"), null);
  assert.equal(formPublicIdFrom("https://example.test/forms/short"), null, "too short to be a form");
  assert.equal(formPublicIdFrom(`/forms/${id} and /forms/${id.replace("5o", "6p")}`), null, "two different forms: none is chosen");
  assert.equal(formPublicIdFrom(`<iframe src="/forms/${id}"></iframe><iframe src="/forms/${id}"></iframe>`), id, "the same form twice is fine");
});
