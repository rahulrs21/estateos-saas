import { newElementId, pageElementIds } from "./custom-ops";
import {
  DEFAULT_ELEMENT_STYLE, HERO_DEFAULT_FACTS, ROW_DEFAULTS, WIDGET_ALIGNS, createSection, defaultWidget, emptyColumn, pageDataSchema, withStyleDefaults,
  type ColumnLayout, type Cta, type CustomColumn, type CustomRow, type ElementStyle, type ImageRef, type PageData, type PageSection, type SectionType,
  type SimpleWidget, type SimpleWidgetType, type StatSource, type Widget, type WidgetOf, type WidgetProps,
} from "./registry";

type WidgetAlign = (typeof WIDGET_ALIGNS)[number];

/*
 * "Convert to custom section" (docs/AI_PAGE_BUILDER.md#convert-to-custom-section).
 * A built-in section becomes a custom section of rows, columns and widgets
 * that look and read the same, so every element can then be moved freely.
 * Texts, buttons and images are copied; CRM facts become counters, which
 * keep reading the CRM. Element styles move to their widgets. Sections whose
 * content is drawn from CRM records (units, prices, plans…) are not
 * converted: no widget reproduces them. The result is validated with the
 * whole page, like any other edit.
 */

export type ConvertResult = {ok: true; section: PageSection; notes: string[]} | {ok: false; message: string};

const CONVERTIBLE = ["HERO", "FEATURE_SPLIT", "HIGHLIGHTS", "STATS", "PROJECT_OVERVIEW", "BANNER", "ENQUIRY_FORM", "WHATSAPP_CTA", "CALL_CTA", "VIDEO_SHOWCASE", "GALLERY"] as const satisfies readonly SectionType[];
const REASONS: Partial<Record<SectionType, string>> = {
  NAVBAR: "The navigation bar stays a built-in section.",
  FOOTER: "The footer stays a built-in section.",
  CUSTOM: "This is already a custom section.",
  FAQ: "Questions open and close as an accordion, which no widget does yet.",
  TESTIMONIALS: "Testimonials have no widget yet.",
  LANDMARKS: "Nearby places have no widget yet.",
  COUNTDOWN: "The countdown has no widget yet.",
  CONTACT: "Contact details come from the approved company contacts; use a contact card widget in a custom section instead.",
};

/** Null when the section can be converted, otherwise why not. */
export function convertBlocker(section: PageSection): string | null {
  if ((CONVERTIBLE as readonly string[]).includes(section.type)) {
    if (section.type === "GALLERY" && !section.props.images.length) return "This gallery shows the linked records' photos. Choose its photos first, then convert it.";
    return null;
  }
  return REASONS[section.type] ?? "This section shows CRM records (units, prices, plans or the map) that widgets cannot reproduce.";
}

type Build = {taken: Set<string>; styles: Record<string, ElementStyle>; notes: string[]};

function widget<T extends SimpleWidgetType>(build: Build, type: T, props: WidgetProps<T>, options: {styleKey?: string; align?: WidgetAlign; size?: number} = {}): SimpleWidget {
  const base = defaultWidget(type, newElementId("w", build.taken)) as SimpleWidget;
  const own = options.styleKey ? build.styles[options.styleKey] ?? null : null;
  // A size close to the original element, unless it had a size of its own.
  const text = options.size ? {...(own ?? DEFAULT_ELEMENT_STYLE), size: own?.size ?? options.size} : own;
  return {...base, props, style: {...base.style, ...(text ? {text} : {}), ...(options.align ? {align: options.align} : {})}} as SimpleWidget;
}

function column(build: Build, widgets: Widget[], verticalAlign: CustomColumn["verticalAlign"] = "START"): CustomColumn {
  return {...emptyColumn(newElementId("col", build.taken)), widgets, verticalAlign};
}

function row(build: Build, layout: ColumnLayout, columns: CustomColumn[], extra: Partial<CustomRow> = {}): CustomRow {
  return {id: newElementId("row", build.taken), layout, ...ROW_DEFAULTS, gap: "LG", columns, ...extra};
}

/** "1", "1-1", … up to six equal columns. */
const equalLayout = (count: number) => (["1", "1-1", "1-1-1", "1-1-1-1", "1-1-1-1-1", "1-1-1-1-1-1"] as const)[Math.max(1, Math.min(6, count)) - 1];

/** A heading with its small label (eyebrow) above, and the intro below. */
function header(build: Build, input: {eyebrow?: string; heading: string; intro?: string; level?: "H1" | "H2"; size?: "LG" | "XL"; align?: WidgetAlign}, keys: {heading?: string; intro?: string} = {}) {
  const items: SimpleWidget[] = [];
  if (input.heading) items.push(widget(build, "HEADING", {text: input.heading, level: input.level ?? "H2", size: input.size ?? "LG", eyebrow: input.eyebrow ?? ""}, {styleKey: keys.heading ?? "heading", align: input.align}));
  if (input.intro) items.push(widget(build, "TEXT", {text: input.intro, size: "MD", muted: true}, {styleKey: keys.intro ?? "intro", align: input.align}));
  return items;
}

const button = (build: Build, cta: Cta | null, variant: "SOLID" | "OUTLINE", key: string, align?: WidgetAlign) => cta ? [widget(build, "BUTTON", {cta, variant, full: false}, {styleKey: key, align})] : [];
const image = (build: Build, ref: ImageRef | null, ratio: WidgetProps<"IMAGE">["ratio"], key = "image") => ref ? [widget(build, "IMAGE", {image: ref, ratio, rounded: true, caption: ""}, {styleKey: key})] : [];

/** CRM facts as counters (they keep reading the CRM), in a row of their own columns. */
function counters(build: Build, facts: Array<{source: StatSource; value: string; label: string}>, keyOf: (index: number) => string | undefined, size?: number): Widget[] {
  if (!facts.length) return [];
  const inner = defaultWidget("INNER_SECTION", newElementId("w", build.taken));
  const shown = facts.slice(0, 6);
  return [{...inner, props: {...inner.props, layout: equalLayout(shown.length), gap: "MD",
    columns: shown.map((fact, index) => ({...emptyColumn(newElementId("col", build.taken)), widgets: [widget(build, "COUNTER", {source: fact.source, value: fact.value, label: fact.label}, {styleKey: keyOf(index), size}) as WidgetOf<"COUNTER">]}))}}];
}

/** Items in rows of `perRow` columns (a grid that reads left to right on every device). */
function grid(build: Build, items: SimpleWidget[], perRow: number): CustomRow[] {
  const rows: CustomRow[] = [];
  for (let start = 0; start < items.length; start += perRow) {
    const slice = items.slice(start, start + perRow);
    rows.push(row(build, equalLayout(perRow), Array.from({length: perRow}, (_, index) => column(build, slice[index] ? [slice[index]] : []))));
  }
  return rows;
}

/** Text beside media: two columns, the media first when it sits on the left. */
function split(build: Build, text: Widget[], media: Widget[], mediaFirst = false): CustomRow {
  if (!media.length) return row(build, "1", [column(build, text)]);
  const columns = [column(build, text, "CENTER"), column(build, media, "CENTER")];
  return row(build, "1-1", mediaFirst ? columns.reverse() : columns);
}

function heroRows(build: Build, section: Extract<PageSection, {type: "HERO"}>, data: PageData, style: ReturnType<typeof withStyleDefaults>): {rows: CustomRow[]; style: Partial<ReturnType<typeof withStyleDefaults>>} {
  const {props, variant} = section;
  const centered = variant === "centered";
  const align: WidgetAlign | undefined = centered ? "CENTER" : undefined;
  const text: Widget[] = [];
  if (props.badge) text.push(widget(build, "TEXT", {text: props.badge, size: "SM", muted: false}, {styleKey: "badgeBox", align}));
  // The hero headline stays the page's main heading.
  text.push(...header(build, {eyebrow: props.eyebrow, heading: props.headline, intro: props.subheadline, level: "H1", size: "XL", align}, {heading: "headline", intro: "subheadline"}));
  const priceLine: Array<{source: StatSource; value: string; label: string}> = [];
  if (props.showPrice) priceLine.push({source: "STARTING_PRICE", value: "", label: "Price"});
  if (props.showLocation) priceLine.push({source: "LOCATION", value: "", label: "Location"});
  text.push(...counters(build, priceLine, index => priceLine[index].source === "STARTING_PRICE" ? "price" : "location", 22));
  text.push(...button(build, props.primaryCta, "SOLID", "primaryCta", align), ...button(build, props.secondaryCta, "OUTLINE", "secondaryCta", align));
  const facts = props.showFacts ? (props.facts ?? HERO_DEFAULT_FACTS) : [];
  const factRow = counters(build, facts, index => `facts.${index}`, 22);
  const media: Widget[] = [];
  const nextStyle: Partial<ReturnType<typeof withStyleDefaults>> = {};
  const backgroundMedia = style.backgroundType === "IMAGE" || style.backgroundType === "VIDEO";
  if (variant === "splitForm") {
    // One lead form per page: the form widget replaces the hero's form unless the page also has an enquiry form section.
    if (data.sections.some(item => item.type === "ENQUIRY_FORM")) build.notes.push("The form stays in the enquiry form section (a page shows the lead form once).");
    else media.push(widget(build, "FORM", {submitLabel: props.primaryCta.label}, {styleKey: "form"}));
  }
  // The hero's image: framed (showcase with image), the background it already was, the background of a full-screen hero, or beside the text.
  if (variant === "showcaseImage") media.push(...image(build, props.image, "PORTRAIT"));
  else if (style.backgroundType === "IMAGE") {
    if (!style.backgroundImage && props.image) nextStyle.backgroundImage = props.image;
  } else if (!backgroundMedia && props.image) {
    if (variant === "fullBleed" || variant === "wordmark") Object.assign(nextStyle, {backgroundType: "IMAGE", backgroundImage: props.image, overlay: Math.max(style.overlay, 45)});
    else if (variant !== "splitForm") media.push(...image(build, props.image, variant === "showcase" ? "PORTRAIT" : "LANDSCAPE"));
  }
  if (variant === "wordmark" && props.wordmark) text.unshift(widget(build, "HEADING", {text: props.wordmark, level: "H2", size: "XL", eyebrow: ""}));
  const rows = centered ? [row(build, "1", [column(build, [...text, ...media])])] : [split(build, text, media)];
  if (factRow.length) rows.push(row(build, "1", [column(build, factRow)]));
  return {rows, style: nextStyle};
}

function rowsOf(build: Build, section: PageSection, data: PageData, style: ReturnType<typeof withStyleDefaults>): {rows: CustomRow[]; style?: Partial<ReturnType<typeof withStyleDefaults>>} {
  switch (section.type) {
    case "HERO": return heroRows(build, section, data, style);
    case "FEATURE_SPLIT": {
      const {props} = section;
      const text: Widget[] = [...header(build, {eyebrow: props.eyebrow, heading: props.heading, intro: props.body}, {intro: "body"})];
      if (props.bullets.length) text.push(widget(build, "ICON_LIST", {items: props.bullets.map(bullet => ({text: bullet, icon: "STAR" as const}))}, {styleKey: "bullets"}));
      text.push(...button(build, props.cta, "SOLID", "cta"));
      return {rows: [split(build, text, image(build, props.image, "PORTRAIT"), props.imageSide === "LEFT")]};
    }
    case "HIGHLIGHTS": {
      const {props} = section;
      const boxes = props.items.map((item, index) => widget(build, "ICON_BOX", {icon: item.icon, title: item.title, text: item.text, boxed: true}, {styleKey: `items.${index}`}));
      return {rows: [row(build, "1", [column(build, header(build, {eyebrow: props.eyebrow, heading: props.heading, intro: props.intro}))]), ...grid(build, boxes, props.columns)]};
    }
    case "STATS": {
      const {props} = section;
      const rows = props.heading ? [row(build, "1", [column(build, header(build, {heading: props.heading}))])] : [];
      return {rows: [...rows, row(build, "1", [column(build, counters(build, props.items, index => `items.${index}`))])]};
    }
    case "PROJECT_OVERVIEW": {
      const {props} = section;
      const text: Widget[] = [...header(build, {eyebrow: props.eyebrow, heading: props.heading, intro: props.body}, {intro: "body"})];
      if (props.showFacts) text.push(...counters(build, [
        {source: "STARTING_PRICE", value: "", label: "Starting price"}, {source: "HANDOVER", value: "", label: "Handover"}, {source: "PAYMENT_PLAN", value: "", label: "Payment plan"},
      ], () => undefined));
      return {rows: [split(build, text, image(build, props.image, "LANDSCAPE"))]};
    }
    case "BANNER": {
      const {props} = section;
      const items = [...header(build, {eyebrow: props.eyebrow, heading: props.heading, intro: props.body, align: "CENTER"}, {intro: "body"}),
        ...button(build, props.cta, "SOLID", "cta", "CENTER"), ...button(build, props.secondaryCta, "OUTLINE", "secondaryCta", "CENTER")];
      return {rows: [row(build, "1", [column(build, items)])]};
    }
    case "ENQUIRY_FORM": {
      const {props} = section;
      const text: Widget[] = [...header(build, {heading: props.heading, intro: props.intro})];
      if (props.points.length) text.push(widget(build, "ICON_LIST", {items: props.points.map(point => ({text: point, icon: "STAR" as const}))}, {styleKey: "points"}));
      text.push(...image(build, props.image, "LANDSCAPE"));
      return {rows: [split(build, text, [widget(build, "FORM", {submitLabel: props.submitLabel}, {styleKey: "form"})])]};
    }
    case "WHATSAPP_CTA": case "CALL_CTA": {
      const {props} = section;
      if (section.type === "WHATSAPP_CTA" && section.props.prefilledMessage) build.notes.push("The WhatsApp button opens a chat without the prefilled message.");
      const items = [...header(build, {heading: props.heading, intro: props.body, align: "CENTER"}, {intro: "body"}),
        ...button(build, {label: props.buttonLabel, action: section.type === "WHATSAPP_CTA" ? "WHATSAPP" : "CALL"}, "SOLID", "buttonLabel", "CENTER")];
      return {rows: [row(build, "1", [column(build, items)])]};
    }
    case "VIDEO_SHOWCASE": {
      const {props} = section;
      const items: Widget[] = [...header(build, {eyebrow: props.eyebrow, heading: props.heading, intro: props.body}, {intro: "body"})];
      if (props.video) items.push(widget(build, "VIDEO", {video: props.video, poster: props.poster, ratio: "LANDSCAPE"}, {styleKey: "video"}));
      return {rows: [row(build, "1", [column(build, items)])]};
    }
    case "GALLERY": {
      const {props} = section;
      if (props.images.length > 12) build.notes.push("An image grid holds up to 12 photos, so the first 12 were kept.");
      return {rows: [row(build, "1", [column(build, [...header(build, {eyebrow: props.eyebrow, heading: props.heading, intro: props.intro}),
        widget(build, "GALLERY", {images: props.images.slice(0, 12), columns: props.columns, lightbox: true})])])]};
    }
    default: return {rows: []};
  }
}

/**
 * The custom section for a built-in one: same ID (links to it keep working),
 * visibility, devices, background and spacing; its content as widgets.
 */
export function convertToCustom(section: PageSection, data: PageData): ConvertResult {
  const blocker = convertBlocker(section);
  if (blocker) return {ok: false, message: blocker};
  const style = withStyleDefaults(section.style);
  const build: Build = {taken: pageElementIds(data), styles: style.elementStyles, notes: []};
  const converted = rowsOf(build, section, data, style);
  // Rows added inside the built-in section stay where they were.
  const extra = section.extra?.rows ?? [];
  const rows = section.extra?.position === "BEFORE" ? [...extra, ...converted.rows] : [...converted.rows, ...extra];
  if (!rows.length) return {ok: false, message: "This section has no content to convert."};
  if (rows.length > 6) return {ok: false, message: "This section would need more than six rows. Remove some items first."};
  if (Object.keys(style.elementOffsets).length) build.notes.push("Moved elements start at their normal place; arrange them with drag and drop.");
  const base = createSection("CUSTOM", section.id, {rows});
  const next = {...base, visible: section.visible, devices: section.devices, layout: section.layout,
    style: {...style, ...converted.style, elementStyles: {}, elementOffsets: {}, elementOrder: {}}} as PageSection;
  const page = pageDataSchema.safeParse({...data, sections: data.sections.map(item => item.id === section.id ? next : item)});
  if (!page.success) return {ok: false, message: page.error.issues[0]?.message ?? "The converted section is not valid."};
  return {ok: true, section: page.data.sections.find(item => item.id === section.id)!, notes: build.notes};
}

