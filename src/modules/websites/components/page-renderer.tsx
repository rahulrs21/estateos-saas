/* eslint-disable @next/next/no-img-element -- Landing page images are CRM photos behind an authorized route or stock photos with their own responsive srcset; next/image optimisation would cache unpublished images. */
import { Fragment, type ClipboardEvent, type CSSProperties, type ElementType, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import {
  ArrowDown, Menu, Building2, CalendarDays, Car, Check, ChevronDown, Clock, Dumbbell, KeyRound, Mail, MapPin, MessageCircle, Phone, ShieldCheck, Sparkles, Star, Trees, Wallet, Waves,
} from "lucide-react";
import {
  advertisedListings, agentById, comparisonListings, contactAgent, contactItems, countdownDate, resolveImages, sectionLocation, widgetAvailability, widgetLocation, galleryImages, resolveImage, resolveVideo, resolvedStats, sectionAvailability, statValue, stockMediaUsed,
  type LinkedData, type LinkedListing, type ResolvedImage,
} from "../linked";
import { HERO_DEFAULT_FACTS, SECTION_DEFINITIONS, WIDGET_DEFINITIONS, columnWidths, withStyleDefaults, type Box, type ColumnLayout, type CustomColumn, type CustomRow, type InnerColumn, type Cta, type ElementStyle, type Widget, type WidgetStyle, type Offset, type PageSection, type SectionOf, type SectionType, type StatSource } from "../registry";
import { amenityStockTag, stockImageSrcSet, stockImageUrl, stockImagesFor } from "../stock";
import {
  ANIMATION_CLASSES, CONTENT_VERTICAL_CLASSES, elementCss, pageLook, panelStyle, readableOn, type ElementKind, type ElementLook, HEADING_CLASSES, boxLayout, offsetStyle, HEADLINE_CLASSES, HEIGHT_CLASSES, WIDTH_CLASSES, deviceClasses, overlayStyle, pageThemeStyle, sectionBackgroundStyle, spacingClasses,
} from "../theme";
import type { PublicPageContext, RenderMode, RenderablePage } from "../types";
import { PageCarousel, PageCoverflow } from "./page-carousels";
import { PageCountdown, PageEnquiryForm, PageLightbox, PageLocationMap } from "./page-islands";

/**
 * Renders validated page data with the registered components only. Every
 * value is plain text rendered by React (escaped); links are built here from
 * approved contacts and fixed anchors; nothing from the page data is used as
 * HTML, CSS, a URL or an event handler. Sections without the CRM data they
 * need are left out of public pages and labelled in the editor.
 *
 * In the editor the same components render text as plain-text
 * contentEditable regions (inline editing) and wrap each section with the
 * editor's chrome; on public pages nothing interactive is added.
 */

export interface EditBindings {
  onText: (sectionId: string, path: string, value: string) => void;
  /** Editor chrome around each section (selection outline, toolbar, drop zones). */
  wrapSection: (section: PageSection, element: ReactElement, state: {available: boolean; reason: string | null}) => ReactNode;
}

interface RendererProps {
  page: RenderablePage;
  mode: RenderMode;
  today: string;
  publicContext?: PublicPageContext | null;
  edit?: EditBindings;
  /** Leaves out the "internal preview" notice (the style gallery's labelled sample pages). */
  hideNotice?: boolean;
}

interface Ctx {
  page: RenderablePage; mode: RenderMode; hasForm: boolean; publicContext?: PublicPageContext | null; headline: string;
  text?: (path: string, value: string) => void; anchors: Array<{href: string; label: string}>;
  /** The section's moved and styled elements, keyed by prop path. */
  offsets?: Record<string, Offset>;
  styles?: Record<string, ElementStyle>;
  /** The order of element groups chosen in the Navigator (section style `elementOrder`). */
  order?: Record<string, string[]>;
  /** Links to every section shown on the page, by section ID (navigation menus). */
  sectionLinks?: Record<string, string>;
}

/**
 * Props for an element that can be moved and styled on its own: its saved
 * offset and style, and in the editor the key and kind the canvas uses to
 * select it. `extra` holds the element's own classes.
 */
/** In the editor, marks a container whose elements can be reordered in the Navigator. */
const orderGroup = (ctx: Ctx, group: string) => ctx.text ? {"data-order-group": group} : {};

/** A group's elements in the order chosen in the Navigator (unlisted ones keep their place at the end). */
function ordered(ctx: Ctx, group: string, items: Array<[string, ReactNode]>): ReactNode[] {
  const order = ctx.order?.[group] ?? [];
  return items.map(([key, node], index) => ({key, node, rank: order.includes(key) ? order.indexOf(key) : order.length + index}))
    .sort((a, b) => a.rank - b.rank).map(item => <Fragment key={item.key}>{item.node}</Fragment>);
}

function movable(ctx: Ctx, key: string, kind: ElementKind = "block", extra = "") {
  const look = elementCss(ctx.styles?.[key], kind, ctx.mode === "editor");
  return {
    style: {...look.style, ...offsetStyle(ctx.offsets?.[key])}, className: `${extra} ${look.className} ${kind === "button" ? "" : look.sizeClass}`.trim(),
    ...(ctx.text ? {"data-move-key": key, "data-element-kind": kind} : {}),
  };
}

const ICONS = {STAR: Star, BUILDING: Building2, KEY: KeyRound, WALLET: Wallet, CALENDAR: CalendarDays, MAP_PIN: MapPin, SHIELD: ShieldCheck, SPARKLES: Sparkles, WAVES: Waves, TREES: Trees, DUMBBELL: Dumbbell, CAR: Car};
const COLUMNS = {2: "@3xl:grid-cols-2", 3: "@3xl:grid-cols-2 @5xl:grid-cols-3", 4: "@3xl:grid-cols-2 @5xl:grid-cols-4"} as const;
const LANDMARK_LABELS = {TRANSPORT: "Transport", SCHOOL: "School", HEALTHCARE: "Healthcare", SHOPPING: "Shopping", LEISURE: "Leisure", BUSINESS: "Business", BEACH: "Beach", OTHER: "Nearby"} as const;
const NAV_LABELS: Partial<Record<SectionType, string>> = {PROJECT_OVERVIEW: "Overview", AMENITIES: "Amenities", GALLERY: "Gallery", PAYMENT_PLANS: "Payment plan", FLOOR_PLANS: "Floor plans", UNIT_TYPES: "Units", LOCATION: "Location", FAQ: "FAQ"};

const digits = (value: string) => value.replace(/[^\d+]/g, "");
const dubaiDate = (iso: string) => new Intl.DateTimeFormat("en-GB", {day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dubai"}).format(new Date(iso));
const dateLabel = (date: string | null) => date ? new Intl.DateTimeFormat("en-GB", {month: "long", year: "numeric", timeZone: "UTC"}).format(new Date(`${date}T00:00:00Z`)) : null;
const bedrooms = (value: number | null) => value == null ? null : value === 0 ? "Studio" : `${value} bed${value === 1 ? "" : "s"}`;
const priceText = (listing: LinkedListing) => listing.price.rentalPeriod ? `${listing.price.display} / ${listing.price.rentalPeriod === "MONTHLY" ? "month" : "year"}` : listing.price.display;
const percentNumber = (value: string | null) => value ? Number.parseFloat(value) : 0;

export function anchorFor(section: PageSection) {
  const named: Partial<Record<SectionType, string>> = {ENQUIRY_FORM: "enquire", LOCATION: "location", PROJECT_OVERVIEW: "overview", AMENITIES: "amenities", PAYMENT_PLANS: "payment-plan", FLOOR_PLANS: "floor-plans", UNIT_TYPES: "units", FAQ: "faq"};
  return named[section.type] ?? (section.type === "GALLERY" ? `gallery-${section.id}` : `s-${section.id}`);
}

/** Inline-editable plain text in the editor; plain escaped text everywhere else. */
/**
 * What was typed in an inline editor. innerText keeps line breaks but also applies the
 * element's CSS letter case (uppercase labels and eyebrows), so that is switched off while reading.
 */
function typedText(element: HTMLElement) {
  const previous = element.style.textTransform;
  element.style.textTransform = "none";
  const text = element.innerText;
  element.style.textTransform = previous;
  return text.replace(/ /g, " ");
}

function T({value, path, ctx, as: Tag = "span", className = "", multiline = false, placeholder, move = true, look}: {value: string; path: string; ctx: Ctx; as?: ElementType; className?: string; multiline?: boolean; placeholder?: string; move?: boolean; look?: ElementLook}) {
  const position = move ? movable(ctx, path, "text", className) : look ? {style: look.style, className: `${className} ${look.className} ${look.sizeClass}`.trim()} : {className};
  if (!ctx.text) return value ? <Tag {...position}>{value}</Tag> : null;
  if (!value && !placeholder) return null;
  const commit = ctx.text;
  return <Tag key={value} {...position} className={`${position.className} cursor-text rounded-sm outline-none transition-shadow hover:shadow-[0_0_0_1px_rgba(59,130,246,.55)] focus:shadow-[0_0_0_2px_rgba(59,130,246,.9)] empty:before:text-current/40 empty:before:content-[attr(data-placeholder)]`}
    contentEditable="plaintext-only" suppressContentEditableWarning spellCheck data-placeholder={placeholder} data-edit-path={path}
    onBlur={(event: {currentTarget: HTMLElement}) => { const next = typedText(event.currentTarget); if (next !== value) commit(path, multiline ? next : next.replace(/\s*\n\s*/g, " ")); }}
    onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "Escape") { event.currentTarget.innerText = value; event.currentTarget.blur(); }
      if (event.key === "Enter" && !multiline) { event.preventDefault(); event.currentTarget.blur(); }
    }}
    onPaste={(event: ClipboardEvent<HTMLElement>) => { event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain")); }}>
    {value}
  </Tag>;
}

function ctaHref(cta: Cta, linked: LinkedData, hasForm: boolean, anchors: Ctx["anchors"], message = ""): string | null {
  switch (cta.action) {
    case "ENQUIRE": return hasForm ? "#enquire" : null;
    case "WHATSAPP": return linked.company.whatsapp ? `https://wa.me/${digits(linked.company.whatsapp).replace(/^\+/, "")}${message ? `?text=${encodeURIComponent(message)}` : ""}` : null;
    case "CALL": return linked.company.phone ? `tel:${digits(linked.company.phone)}` : null;
    case "EMAIL": return linked.company.email ? `mailto:${linked.company.email}` : null;
    case "GALLERY": return anchors.find(anchor => anchor.href.startsWith("#gallery"))?.href ?? null;
    case "LOCATION": return "#location";
  }
}

function CtaButton({cta, ctx, path, secondary = false, large = false, look}: {cta: Cta; ctx: Ctx; path: string; secondary?: boolean; large?: boolean; look?: ElementLook}) {
  const href = ctaHref(cta, ctx.page.linked, ctx.hasForm, ctx.anchors);
  if (!href && !ctx.text) return null;
  const external = href?.startsWith("https://");
  const size = large ? "h-14 px-8 text-base" : "h-12 px-7 text-sm";
  const element = look ? {style: look.style, className: look.className} : movable(ctx, path, "button");
  const sizeClass = look ? look.sizeClass : elementCss(ctx.styles?.[path], "button").sizeClass;
  return <a href={href ?? "#"} {...(external ? {target: "_blank", rel: "noreferrer"} : {})} aria-disabled={!href || undefined} {...element}
    className={`${element.className} pg-btn ${secondary ? "pg-btn-secondary" : "pg-btn-primary"} group/cta inline-flex items-center justify-center gap-2 rounded-[var(--pg-button-radius)] font-semibold tracking-wide transition-all duration-300 ${size} ${secondary
      ? "border border-current/40 bg-white/5 backdrop-blur-sm hover:bg-white/15"
      : "bg-[var(--pg-accent)] text-[var(--pg-accent-fg)] shadow-[0_10px_30px_-10px_var(--pg-accent)] hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-12px_var(--pg-accent)]"} ${!href ? "opacity-60" : ""}`}>
    <T value={cta.label} path={`${path}.label`} ctx={ctx} move={false} className={sizeClass} />
  </a>;
}

function Img({image, sizes, eager = false, className = "", imgClassName = "", element, look}: {image: ResolvedImage; sizes: string; eager?: boolean; className?: string; imgClassName?: string; element?: {ctx: Ctx; key: string}; look?: ElementLook}) {
  const frame = element ? movable(element.ctx, element.key, "image", className) : {style: look?.style, className: `${className} ${look?.className ?? ""}`};
  return <div {...frame} className={`pg-media relative overflow-hidden bg-[var(--pg-muted)] ${frame.className}`}>
    <img src={image.url} srcSet={image.srcSet ?? undefined} sizes={image.srcSet ? sizes : undefined} alt={image.alt} loading={eager ? "eager" : "lazy"} decoding="async"
      fetchPriority={eager ? "high" : "auto"} className={`absolute inset-0 h-full w-full object-cover transition-transform duration-700 ${imgClassName}`} />
  </div>;
}

const JUSTIFY_ALIGN = {LEFT: "justify-start", CENTER: "justify-center", RIGHT: "justify-end"} as const;
/**
 * A gallery photo as a link to the image, which the photo viewer opens
 * full screen. In the editor a click selects instead, so photos are not links.
 */
function Zoom({on, group, index, total, image, children}: {on: boolean; group: string; index: number; total: number; image: ResolvedImage; children: ReactNode}) {
  if (!on) return <>{children}</>;
  return <a href={image.url} data-lightbox-group={group} data-lightbox-index={index} aria-label={`Open photo ${index + 1} of ${total} full screen`} className="relative block h-full cursor-zoom-in">{children}</a>;
}
const lightboxImages = (images: ResolvedImage[]) => images.map(image => ({url: image.url, srcSet: image.srcSet, alt: image.alt}));

function Eyebrow({value, path, ctx, center = false}: {value: string; path: string; ctx: Ctx; center?: boolean}) {
  if (!value && !ctx.text) return null;
  const own = ctx.styles?.[path];
  // The marker and the words are one element: they are selected, styled and moved together.
  const element = movable(ctx, path, "text", `pg-eyebrow mb-4 items-center gap-3 text-xs font-semibold tracking-[0.28em] text-[var(--pg-accent)] [text-transform:var(--pg-eyebrow-case)] ${own?.align ? JUSTIFY_ALIGN[own.align] : center ? "justify-center" : ""}`);
  return <p {...element} style={{...element.style, display: "flex"}}>
    <span aria-hidden="true" className="h-px w-8 bg-current" /><T value={value} path={path} ctx={ctx} placeholder="Add an eyebrow" move={false} />
  </p>;
}

function Heading({value, path, ctx, center = false, size}: {value: string; path: string; ctx: Ctx; center?: boolean; size?: string}) {
  return <h2 className={`pg-h2 font-[family-name:var(--pg-heading-font)] font-semibold leading-[1.08] tracking-[var(--pg-heading-tracking)] ${size ?? HEADING_CLASSES[ctx.page.data.theme.scale]} ${center ? "text-center" : ""}`}>
    <T value={value} path={path} ctx={ctx} placeholder="Add a heading" />
  </h2>;
}

function Intro({value, path, ctx, center = false, className = ""}: {value: string; path: string; ctx: Ctx; center?: boolean; className?: string}) {
  if (!value && !ctx.text) return null;
  return <p className={`pg-intro mt-5 max-w-3xl whitespace-pre-line text-base leading-8 text-[var(--pg-muted-fg)] @3xl:text-lg ${center ? "mx-auto text-center" : ""} ${className}`}>
    <T value={value} path={path} ctx={ctx} multiline placeholder="Add text" />
  </p>;
}

function Header({eyebrow, heading, intro, ctx, center, paths = {eyebrow: "eyebrow", heading: "heading", intro: "intro"}}: {eyebrow?: string; heading: string; intro?: string; ctx: Ctx; center: boolean; paths?: {eyebrow: string; heading: string; intro: string}}) {
  return <div {...orderGroup(ctx, "header")} className={center ? "pg-header pg-header-center mx-auto max-w-3xl text-center" : "pg-header max-w-3xl"}>{ordered(ctx, "header", [
    [paths.eyebrow, eyebrow !== undefined && <Eyebrow value={eyebrow} path={paths.eyebrow} ctx={ctx} center={center} />],
    [paths.heading, <Heading key="heading" value={heading} path={paths.heading} ctx={ctx} center={center} />],
    [paths.intro, intro !== undefined && <Intro value={intro} path={paths.intro} ctx={ctx} center={center} />],
  ])}</div>;
}

/**
 * The label or value of a key fact, as its own element ("facts.2.value"),
 * styled and moved on its own. `tint` is its default colour, left out when
 * the whole fact has a colour of its own so that colour reaches it.
 */
function factPart(ctx: Ctx, factKey: string | undefined, part: "label" | "value", className: string, tint = "") {
  const colour = factKey && ctx.styles?.[factKey]?.color ? "" : tint;
  return factKey ? movable(ctx, `${factKey}.${part}`, "text", `${className} ${colour}`) : {className: `${className} ${tint}`};
}

function Fact({label, value, attrs, factKey, ctx}: {label: ReactNode; value: ReactNode; attrs?: ReturnType<typeof movable>; factKey?: string; ctx?: Ctx}) {
  const key = ctx ? factKey : undefined;
  return <div {...attrs} className={`border-t border-[var(--pg-border)] pt-4 ${attrs?.className ?? ""}`}><dt {...(ctx ? factPart(ctx, key, "label", "text-[11px] font-medium uppercase tracking-[0.2em]", "text-[var(--pg-muted-fg)]") : {className: "text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--pg-muted-fg)]"})}>{label}</dt><dd {...(ctx ? factPart(ctx, key, "value", "mt-1.5 font-[family-name:var(--pg-heading-font)] text-xl font-semibold") : {className: "mt-1.5 font-[family-name:var(--pg-heading-font)] text-xl font-semibold"})}>{value}</dd></div>;
}

function heroPrice(linked: LinkedData) {
  if (linked.listing) return priceText(linked.listing);
  if (linked.project?.startingPrice) return `From ${linked.project.startingPrice.display}`;
  return null;
}

const FIGURE_LABELS: Partial<Record<StatSource, string>> = {UNITS: "Residences", HANDOVER: "Expected handover", STARTING_PRICE: "Starting price", PAYMENT_PLAN: "Payment plan"};

/** The menu button for phones and tablets: the section links, the phone and the button. */
function navMenu(props: SectionOf<"NAVBAR">["props"], links: Ctx["anchors"], phone: string | null | undefined, ctx: Ctx) {
  if (props.mobileMenu === false || !(links.length > 0 || props.cta || phone)) return null;
  return <details className="relative @5xl:hidden">
    <summary aria-label="Menu" className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-current/25 [&::-webkit-details-marker]:hidden"><Menu className="size-5" aria-hidden="true" /></summary>
    <div className="absolute right-0 top-full z-40 mt-3 w-72 max-w-[calc(100vw-2.5rem)] space-y-1 rounded-[var(--pg-radius)] border border-[var(--pg-border)] p-3 text-[var(--pg-fg)] shadow-2xl" style={{backgroundColor: "var(--pg-bg)"}}>
      {links.map(anchor => <a key={anchor.href + anchor.label} href={anchor.href} className="block rounded-md px-3 py-2.5 text-sm font-medium hover:bg-[var(--pg-muted)]">{anchor.label}</a>)}
      {phone && <a href={`tel:${digits(phone)}`} className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-[var(--pg-muted)]"><Phone className="size-4" aria-hidden="true" />{phone}</a>}
      {props.cta && <div className="pt-2 [&>a]:w-full"><CtaButton cta={props.cta} ctx={{...ctx, text: undefined}} path="cta" /></div>}
    </div>
  </details>;
}

function SectionBody({section, ctx}: {section: PageSection; ctx: Ctx}) {
  const {linked} = ctx.page;
  const center = section.layout.align === "CENTER";
  switch (section.type) {
    case "NAVBAR": {
      const {props} = section;
      const brand = props.brandText || linked.company.name;
      const logo = resolveImage(props.logo, linked, 640);
      // Own links point only at sections shown on the page; otherwise the automatic list.
      const own = props.links ?? [];
      const links = !props.showLinks ? [] : own.length
        ? own.flatMap(link => ctx.sectionLinks?.[link.sectionId] ? [{href: ctx.sectionLinks[link.sectionId], label: link.label}] : [])
        : ctx.anchors.slice(0, 6);
      const phone = props.showPhone ? linked.company.phone : null;
      const nav = links.length > 0 && <nav aria-label="Page sections" {...movable(ctx, "links", "block", `hidden items-center gap-7 text-sm font-medium @5xl:flex ${props.linksAlign === "LEFT" ? "ml-10 mr-auto" : props.linksAlign === "RIGHT" ? "ml-auto" : "mx-auto"}`)}>
        {links.map(anchor => <a key={anchor.href + anchor.label} href={anchor.href} className="opacity-80 transition-opacity hover:opacity-100">{anchor.label}</a>)}
      </nav>;
      const brandLink = <a href="#top" aria-label={logo ? brand : undefined} className="pg-brand flex min-w-0 items-center font-[family-name:var(--pg-heading-font)] text-lg font-semibold tracking-[var(--pg-heading-tracking)] @3xl:shrink-0 @3xl:text-xl">
        {logo ? <img src={logo.url} alt={logo.alt || brand} {...movable(ctx, "logo", "image", "w-auto max-w-[55cqi] object-contain object-left @3xl:max-w-none")} style={{...movable(ctx, "logo", "image").style, height: props.logoHeight ?? 40}} />
          : <span className="truncate">{props.brandText ? <T value={brand} path="brandText" ctx={ctx} /> : brand}</span>}
      </a>;
      const phoneLink = phone && <a href={`tel:${digits(phone)}`} className="hidden items-center gap-2 text-sm font-medium opacity-90 hover:opacity-100 @3xl:inline-flex"><Phone className="size-4" aria-hidden="true" />{phone}</a>;
      const ctaButton = props.cta && <span className={props.mobileMenu !== false ? "hidden @md:inline-flex" : "inline-flex"}><CtaButton cta={props.cta} ctx={ctx} path="cta" /></span>;
      if (section.variant === "centered") {
        // The brand in the middle with the links either side (desktop); phones keep the brand left and the menu right.
        const half = Math.ceil(links.length / 2);
        const linkRow = (items: typeof links, label: string, extra: string) => <nav aria-label={label} className={`pg-nav-links hidden items-center gap-8 text-xs font-medium uppercase tracking-[0.18em] @5xl:flex ${extra}`}>
          {items.map(anchor => <a key={anchor.href + anchor.label} href={anchor.href} className="opacity-80 transition-opacity hover:opacity-100">{anchor.label}</a>)}
        </nav>;
        return <div className="flex h-16 items-center gap-3 @3xl:h-20 @5xl:grid @5xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] @5xl:gap-8">
          {linkRow(links.slice(0, half), "Page sections", "")}
          <div className="min-w-0 @5xl:justify-self-center [&>a]:@5xl:justify-center">{brandLink}</div>
          <div className="ml-auto flex shrink-0 items-center gap-2 @md:gap-4 @5xl:ml-0 @5xl:justify-self-end">
            {links.length > 1 && linkRow(links.slice(half), "More page sections", "mr-2")}
            {phoneLink}{ctaButton}{navMenu(props, links, phone, ctx)}
          </div>
        </div>;
      }
      // Phones and tablets: the brand on the left (shortened if it is long), the button and menu on the right.
      return <div className="flex h-16 items-center gap-3 @3xl:h-20 @3xl:gap-6">
        {brandLink}
        {nav || <span className="flex-1" />}
        {/* The menu links show from desktop width; below it the buttons always sit at the right end. */}
        <div className={`ml-auto flex shrink-0 items-center gap-2 @md:gap-4 ${nav && props.linksAlign !== "RIGHT" ? "@5xl:ml-0" : ""}`}>
          {phoneLink}{ctaButton}{navMenu(props, links, phone, ctx)}
        </div>
      </div>;
    }
    case "HERO": {
      const {props} = section;
      const style = section.style;
      const backgroundMedia = style.backgroundType === "IMAGE" || style.backgroundType === "VIDEO";
      const image = backgroundMedia ? null : resolveImage(props.image, linked, 1920);
      const price = props.showPrice ? heroPrice(linked) : null;
      const location = props.showLocation ? linked.location?.text : null;
      // The hero's own facts, or the automatic four; CRM facts without a value are left out (kept in the editor as placeholders).
      const facts = props.showFacts ? (props.facts ?? HERO_DEFAULT_FACTS).flatMap((fact, index) => {
        const value = fact.source === "CUSTOM" ? fact.value.trim() : statValue({source: fact.source, value: ""}, linked);
        return value ? [{source: `${fact.source}-${index}`, label: fact.label, value, index}] : ctx.text && props.facts ? [{source: `${fact.source}-${index}`, label: fact.label, value: "–", index}] : [];
      }) : [];
      // In the editor a fact's label and value are typed on the canvas (a typed CRM value becomes the fact's own text).
      const factLabel = (fact: {label: string; index: number}) => ctx.text ? <T value={fact.label} path={`facts.${fact.index}.label`} ctx={ctx} move={false} placeholder="Label" /> : fact.label;
      const factValue = (fact: {value: string; index: number}) => ctx.text ? <T value={fact.value === "–" ? "" : fact.value} path={`facts.${fact.index}.value`} ctx={ctx} move={false} placeholder="–" /> : fact.value;
      const fullBleed = section.variant === "fullBleed" || backgroundMedia;
      const centered = section.variant === "centered";
      const text = <div {...orderGroup(ctx, "heroText")} className={`pg-hero-text space-y-7 ${centered ? "mx-auto max-w-4xl text-center" : "max-w-3xl"}`}>{ordered(ctx, "heroText", [
        ["badgeBox", (props.badge || ctx.text) && <p {...movable(ctx, "badgeBox", "block", `inline-flex items-center gap-2 rounded-full border border-current/25 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] backdrop-blur ${centered ? "mx-auto" : ""}`)}>
          <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--pg-accent)]" /><T value={props.badge} path="badge" ctx={ctx} placeholder="Add a badge" /></p>],
        ["eyebrow", <Eyebrow key="eyebrow" value={props.eyebrow} path="eyebrow" ctx={ctx} center={centered} />],
        ["headline", <h1 key="headline" className={`pg-h1 font-[family-name:var(--pg-heading-font)] font-semibold leading-[1.02] tracking-[var(--pg-heading-tracking)] ${HEADLINE_CLASSES[ctx.page.data.theme.scale]}`}>
          <T value={ctx.headline} path="headline" ctx={ctx} />
        </h1>],
        ["subheadline", (props.subheadline || ctx.text) && <p className="max-w-2xl whitespace-pre-line text-lg leading-8 opacity-85 @3xl:text-xl"><T value={props.subheadline} path="subheadline" ctx={ctx} multiline placeholder="Add a subheadline" /></p>],
        ["priceLine", (price || location) && <p {...movable(ctx, "priceLine", "block", `flex flex-wrap items-center gap-x-6 gap-y-2 text-sm ${centered ? "justify-center" : ""}`)}>
          {price && <span {...movable(ctx, "price", "text", "font-[family-name:var(--pg-heading-font)] text-2xl font-semibold")}>{price}</span>}
          {location && <span {...movable(ctx, "location", "text", "inline-flex items-center gap-1.5 opacity-85")}><MapPin className="size-4" aria-hidden="true" />{location}</span>}
        </p>],
        ["buttons", <div key="buttons" {...movable(ctx, "buttons", "block", `pg-hero-buttons flex flex-wrap gap-3 pt-2 ${centered ? "justify-center" : ""}`)} {...orderGroup(ctx, "heroButtons")}>{ordered(ctx, "heroButtons", [
          ["primaryCta", <CtaButton key="primaryCta" cta={props.primaryCta} ctx={ctx} path="primaryCta" large />],
          ["secondaryCta", props.secondaryCta && <CtaButton cta={props.secondaryCta} ctx={ctx} path="secondaryCta" secondary large />],
        ])}</div>],
      ])}</div>;
      const factStrip = facts.length > 0 && <dl {...movable(ctx, "facts", "block", "pg-hero-facts mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--pg-radius)] border border-current/15 bg-current/10 backdrop-blur-md @3xl:grid-cols-4")}>
        {facts.map(fact => <div key={fact.source} {...movable(ctx, `facts.${fact.index}`, "block", "pg-hero-fact bg-black/10 px-5 py-4 backdrop-blur-md")}><dt {...factPart(ctx, `facts.${fact.index}`, "label", "text-[11px] uppercase tracking-[0.2em] opacity-75")}>{factLabel(fact)}</dt><dd {...factPart(ctx, `facts.${fact.index}`, "value", "mt-1 font-[family-name:var(--pg-heading-font)] text-lg font-semibold @3xl:text-xl")}>{factValue(fact)}</dd></div>)}
      </dl>;
      if (section.variant === "wordmark") {
        // The name, large, along the bottom of the photo; its size follows its length so it always fits on one line.
        const name = (linked.project?.name ?? linked.listing?.title ?? linked.company.name).replace(/\s*\([^)]*\)\s*/g, " ").trim();
        const mark = props.wordmark || name;
        // Long names take two balanced lines; the size follows the longer line so it always fits.
        const words = mark.split(/\s+/).filter(Boolean);
        const lines = words.length > 1 && mark.length > 12
          ? words.slice(1).map((_, index) => [words.slice(0, index + 1).join(" "), words.slice(index + 1).join(" ")]).reduce((best, pair) => Math.max(pair[0].length, pair[1].length) < Math.max(best[0].length, best[1].length) ? pair : best)
          : [mark];
        const size = Math.min(17, Math.max(6.5, 150 / Math.max(5, ...lines.map(line => line.length))));
        const handover = statValue({source: "HANDOVER", value: ""}, linked);
        const lastLine = handover ? `Handover ${handover}` : heroPrice(linked);
        return <div className={`pg-wordmark-hero flex flex-col ${style.height === "SCREEN" ? "min-h-[calc(100svh-10rem)]" : "min-h-[36rem]"}`}>
          <div className="grid gap-8 @5xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] @5xl:items-start">
            <div className="max-w-xl space-y-5">
              {(props.badge || ctx.text) && <p {...movable(ctx, "badgeBox", "block", "text-xs font-medium tracking-[0.08em] opacity-80")}><T value={props.badge} path="badge" ctx={ctx} placeholder="Add a badge" /></p>}
              <h1 className="pg-h1 font-[family-name:var(--pg-heading-font)] text-2xl font-normal leading-[1.3] @3xl:text-[2rem]"><T value={ctx.headline} path="headline" ctx={ctx} /></h1>
            </div>
            <div className="space-y-5 @5xl:justify-self-end">
              {(props.subheadline || ctx.text) && <p className="whitespace-pre-line text-sm leading-6 opacity-85"><T value={props.subheadline} path="subheadline" ctx={ctx} multiline placeholder="Add a subheadline" /></p>}
              <div {...movable(ctx, "buttons", "block", "pg-hero-buttons flex flex-wrap gap-3")}>
                <CtaButton cta={props.primaryCta} ctx={ctx} path="primaryCta" />
                {props.secondaryCta && <CtaButton cta={props.secondaryCta} ctx={ctx} path="secondaryCta" secondary />}
              </div>
            </div>
          </div>
          <p className="pg-wordmark mt-auto pt-12 font-[family-name:var(--pg-heading-font)] font-light leading-[0.86] tracking-[-0.045em]" style={{fontSize: `${size}cqi`}}>
            {ctx.text ? <T value={props.wordmark} path="wordmark" ctx={ctx} placeholder={name} /> : lines.map((line, index) => <span key={index} className="block whitespace-nowrap">{line}</span>)}
          </p>
          <div {...movable(ctx, "meta", "block", "pg-hero-meta mt-6 grid gap-2 border-t border-current/30 pt-4 text-sm opacity-80 @3xl:grid-cols-3")}>
            <span>{linked.location?.text ?? ""}</span>
            <a href={ctx.anchors[0]?.href ?? "#enquire"} className="inline-flex items-center gap-3 @3xl:justify-self-center"><span aria-hidden="true" className="h-4 w-px bg-current" />Scroll to explore</a>
            {lastLine && <span className="@3xl:justify-self-end">{lastLine}</span>}
          </div>
        </div>;
      }
      if (section.variant === "panel") {
        return <div className={`flex flex-col justify-end gap-5 ${style.height === "SCREEN" ? "min-h-[calc(100svh-11rem)]" : "min-h-[32rem]"}`}>
          <div {...movable(ctx, "panel", "card", "pg-hero-panel max-w-xl rounded-[calc(var(--pg-radius)*1.3)] border border-white/15 bg-[#0f1720]/55 p-7 text-white shadow-2xl backdrop-blur-xl @3xl:p-10")}>
            {location && <p {...movable(ctx, "location", "text", "mb-5 text-xs font-semibold uppercase tracking-[0.22em] opacity-80")}>{location}</p>}
            {(props.badge || ctx.text) && <p {...movable(ctx, "badgeBox", "block", "mb-4 inline-flex rounded-full border border-white/25 px-3 py-1 text-xs font-medium")}><T value={props.badge} path="badge" ctx={ctx} placeholder="Add a badge" /></p>}
            <h1 className="pg-h1 font-[family-name:var(--pg-heading-font)] text-4xl font-semibold leading-[1.02] tracking-[var(--pg-heading-tracking)] @3xl:text-6xl"><T value={ctx.headline} path="headline" ctx={ctx} /></h1>
            {price && <p className="mt-5 text-xl font-semibold">{price}</p>}
            {(props.subheadline || ctx.text) && <p className="mt-4 whitespace-pre-line leading-7 opacity-85"><T value={props.subheadline} path="subheadline" ctx={ctx} multiline placeholder="Add a subheadline" /></p>}
            <div {...movable(ctx, "buttons", "block", "pg-hero-buttons mt-7 flex flex-wrap gap-3")}>
              <CtaButton cta={props.primaryCta} ctx={ctx} path="primaryCta" />
              {props.secondaryCta && <CtaButton cta={props.secondaryCta} ctx={ctx} path="secondaryCta" secondary />}
            </div>
          </div>
          {facts.length > 0 && <dl {...movable(ctx, "facts", "block", "pg-hero-factbar grid grid-cols-2 overflow-hidden rounded-[calc(var(--pg-radius)*1.3)] border border-white/15 bg-[#0f1720]/55 text-center text-white backdrop-blur-xl @3xl:grid-cols-4")}>
            {facts.map(fact => <div key={fact.source} {...movable(ctx, `facts.${fact.index}`, "block", "border-white/15 px-4 py-4 @3xl:border-l @3xl:first:border-l-0")}><dt {...factPart(ctx, `facts.${fact.index}`, "label", "text-[11px] font-semibold uppercase tracking-[0.2em] opacity-75")}>{factLabel(fact)}</dt><dd {...factPart(ctx, `facts.${fact.index}`, "value", "mt-1 text-lg font-semibold")}>{factValue(fact)}</dd></div>)}
          </dl>}
        </div>;
      }
      if (section.variant === "editorial") {
        return <div>
          <div className="grid gap-10 @5xl:grid-cols-12 @5xl:items-end">
            <div className="@5xl:col-span-8">
              {(props.badge || ctx.text) && <p {...movable(ctx, "badgeBox", "block", "mb-6 inline-flex items-center gap-2 rounded-full border border-current/25 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em]")}>
                <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--pg-accent)]" /><T value={props.badge} path="badge" ctx={ctx} placeholder="Add a badge" /></p>}
              <Eyebrow value={props.eyebrow} path="eyebrow" ctx={ctx} />
              <h1 className="pg-h1 font-[family-name:var(--pg-heading-font)] text-5xl font-semibold leading-[0.98] tracking-[var(--pg-heading-tracking)] @3xl:text-7xl @5xl:text-8xl"><T value={ctx.headline} path="headline" ctx={ctx} /></h1>
            </div>
            <div className="space-y-6 @5xl:col-span-4 @5xl:pb-3">
              {(props.subheadline || ctx.text) && <p className="whitespace-pre-line text-lg leading-8 text-[var(--pg-muted-fg)]"><T value={props.subheadline} path="subheadline" ctx={ctx} multiline placeholder="Add a subheadline" /></p>}
              {(price || location) && <p {...movable(ctx, "priceLine", "block", "flex flex-wrap items-center gap-x-6 gap-y-2 text-sm")}>
                {price && <span className="font-[family-name:var(--pg-heading-font)] text-2xl font-semibold">{price}</span>}
                {location && <span className="inline-flex items-center gap-1.5 opacity-85"><MapPin className="size-4" aria-hidden="true" />{location}</span>}
              </p>}
              <div {...movable(ctx, "buttons", "block", "flex flex-wrap gap-3")}>
                <CtaButton cta={props.primaryCta} ctx={ctx} path="primaryCta" large />
                {props.secondaryCta && <CtaButton cta={props.secondaryCta} ctx={ctx} path="secondaryCta" secondary large />}
              </div>
            </div>
          </div>
          {image && <Img image={image} sizes="100vw" eager className="pg-hero-wide mt-12 aspect-[4/3] rounded-[var(--pg-radius)] @3xl:aspect-[16/9] @5xl:aspect-[21/9]" imgClassName="pg-ken-burns" element={{ctx, key: "image"}} />}
          {facts.length > 0 && <dl {...movable(ctx, "facts", "block", "mt-10 grid grid-cols-2 gap-x-8 gap-y-6 @3xl:grid-cols-4")}>{facts.map(fact => <Fact key={fact.source} label={factLabel(fact)} value={factValue(fact)} attrs={movable(ctx, `facts.${fact.index}`, "block")} factKey={`facts.${fact.index}`} ctx={ctx} />)}</dl>}
        </div>;
      }
      if (section.variant === "showcase" || section.variant === "showcaseImage") {
        const chips = facts.slice(0, 3);
        // "Showcase with image" frames the hero's own image while the background photo, video or colour stays behind it.
        const framed = section.variant === "showcaseImage" ? resolveImage(props.image, linked, 1600) : image;
        return <div className="grid items-center gap-16 @5xl:grid-cols-[1fr_1.05fr]">
          <div>{text}</div>
          <div className="pg-tilt-stage relative mx-auto w-full max-w-xl">
            <div aria-hidden="true" className="absolute -inset-12 -z-10 rounded-full bg-[radial-gradient(closest-side,var(--pg-accent),transparent)] opacity-35 blur-3xl" />
            {!framed && ctx.text && section.variant === "showcaseImage" && <div {...movable(ctx, "image", "image", "pg-tilt flex aspect-[4/5] items-center justify-center rounded-[var(--pg-radius)] border-2 border-dashed border-current/30 p-8 text-center text-sm opacity-70")}>Choose the showcase image in the Content tab</div>}
            {framed && <Img image={framed} sizes="(min-width: 1024px) 45vw, 100vw" eager className="pg-tilt aspect-[4/5] rounded-[var(--pg-radius)] shadow-[0_60px_120px_-40px_rgba(0,0,0,.65)]" element={{ctx, key: "image"}} />}
            {chips.length > 0 && <dl {...movable(ctx, "facts", "block", "pointer-events-none absolute inset-0")}>{chips.map((fact, index) => { const chip = movable(ctx, `facts.${fact.index}`, "block", `pg-chip pg-card pg-panel absolute rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] px-5 py-4 shadow-2xl backdrop-blur-xl ${ctx.text ? "pointer-events-auto" : ""} ${["-left-4 bottom-12 @3xl:-left-10", "-right-3 top-10 @3xl:-right-8", "bottom-1/2 -right-2 @3xl:-right-12"][index]}`); return <div key={fact.source} {...chip} style={{...chip.style, animationDelay: `${index * -2}s`}}>
              <dt {...factPart(ctx, `facts.${fact.index}`, "label", "text-[11px] uppercase tracking-[0.2em]", "text-[var(--pg-muted-fg)]")}>{factLabel(fact)}</dt>
              <dd {...factPart(ctx, `facts.${fact.index}`, "value", "mt-1 font-[family-name:var(--pg-heading-font)] text-xl font-semibold", backgroundMedia ? "" : "text-[var(--pg-accent)]")}>{factValue(fact)}</dd>
            </div>; })}</dl>}
          </div>
        </div>;
      }
      if (section.variant === "splitForm" && (ctx.page.form || ctx.mode === "editor")) {
        // The form panel keeps the theme's colours over a photo, video or dark hero; its own style can change them.
        const panel = movable(ctx, "form", "card", "rounded-[var(--pg-radius)] p-1 shadow-2xl");
        return <div className="grid items-center gap-12 @5xl:grid-cols-[1.15fr_1fr]">
          <div>{text}{factStrip}</div>
          <div {...panel} style={{...panelStyle(ctx.page.data.theme), ...panel.style}}>
            {ctx.page.form ? <PageEnquiryForm form={ctx.page.form} endpoint={ctx.mode === "public" ? ctx.publicContext?.enquiryEndpoint ?? null : null} submitLabel={props.primaryCta.label} pageTitle={ctx.publicContext?.pageTitle ?? ctx.page.title} />
              : <SampleEnquiryForm submitLabel={props.primaryCta.label} />}
          </div>
        </div>;
      }
      if (fullBleed || centered) {
        return <div className={`flex flex-col ${section.style.height === "SCREEN" && (section.style.contentVertical ?? "AUTO") === "AUTO" ? "min-h-[calc(100svh-10rem)] justify-end" : ""}`}>
          {image && fullBleed && <div aria-hidden="true" className="absolute inset-0 -z-20"><img src={image.url} srcSet={image.srcSet ?? undefined} sizes="100vw" alt="" className="pg-ken-burns h-full w-full object-cover" fetchPriority="high" /></div>}
          {image && fullBleed && <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />}
          <div className={image && fullBleed ? "text-white" : ""}>{text}{factStrip}</div>
          {section.style.height === "SCREEN" && <a href={ctx.anchors[0]?.href ?? "#enquire"} aria-label="Scroll down" className="mx-auto mt-12 hidden animate-bounce opacity-70 @3xl:block"><ArrowDown className="size-6" /></a>}
          {centered && image && !fullBleed && <Img image={image} sizes="100vw" eager className="mt-12 aspect-[16/7] rounded-[var(--pg-radius)]" element={{ctx, key: "image"}} />}
        </div>;
      }
      return <div className="grid items-center gap-12 @5xl:grid-cols-[1.05fr_1fr]">
        <div>{text}{factStrip}</div>
        {image ? <Img image={image} sizes="(min-width: 1024px) 50vw, 100vw" eager className="pg-portrait pg-side-right aspect-[4/5] rounded-[var(--pg-radius)] shadow-2xl" imgClassName="pg-ken-burns" element={{ctx, key: "image"}} /> : null}
      </div>;
    }
    case "STATS": {
      const items = resolvedStats(section, linked);
      const strip = section.variant === "strip";
      if (section.variant === "marquee") {
        // A moving ticker; the second copy only fills the loop (hidden from screen readers). Reduced motion shows one still row.
        const row = (copy: boolean) => items.map((item, index) => <div key={`${copy ? "copy" : "own"}-${index}`} aria-hidden={copy || undefined} data-marquee-copy={copy || undefined}
          className="flex shrink-0 items-baseline gap-4 whitespace-nowrap pe-16">
          <dt className="order-2 text-sm uppercase tracking-[0.18em] text-[var(--pg-muted-fg)]">{copy || item.linked ? item.label : <T value={item.label} path={`items.${item.index}.label`} ctx={ctx} />}</dt>
          <dd className="font-[family-name:var(--pg-heading-font)] text-3xl font-semibold tracking-[var(--pg-heading-tracking)] text-[var(--pg-accent)] @3xl:text-5xl">{copy || item.linked ? item.value : <T value={item.value} path={`items.${item.index}.value`} ctx={ctx} />}</dd>
          <span aria-hidden="true" className="order-3 ps-12 text-2xl text-[var(--pg-accent)]">✦</span>
        </div>);
        return <div className="pg-marquee overflow-hidden border-y border-[var(--pg-border)] py-7">
          {(section.props.heading || ctx.text) && <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.28em] text-[var(--pg-muted-fg)]"><T value={section.props.heading} path="heading" ctx={ctx} placeholder="Add a heading" /></p>}
          <dl className="pg-marquee-track flex w-max">{row(false)}{row(true)}</dl>
        </div>;
      }
      return <div>
        {(section.props.heading || ctx.text) && <div className="mb-10"><Heading value={section.props.heading} path="heading" ctx={ctx} center={center} /></div>}
        <dl className={`grid gap-6 ${items.length >= 4 ? "grid-cols-2 @5xl:grid-cols-4" : items.length === 3 ? "grid-cols-1 @3xl:grid-cols-3" : "grid-cols-2"} ${strip ? "divide-[var(--pg-border)] @5xl:divide-x" : ""}`}>
          {items.map((item, index) => <div key={index} {...movable(ctx, `items.${item.index}`, "block", strip ? "pg-stat px-2 @5xl:px-8 first:@5xl:pl-0" : "pg-stat pg-card rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] p-7")}>
            <dd className="font-[family-name:var(--pg-heading-font)] text-4xl font-semibold tracking-[var(--pg-heading-tracking)] text-[var(--pg-accent)] @3xl:text-5xl">{item.linked ? item.value : <T value={item.value} path={`items.${item.index}.value`} ctx={ctx} />}</dd>
            <dt className="mt-3 text-sm uppercase tracking-[0.18em] text-[var(--pg-muted-fg)]"><T value={item.label} path={`items.${item.index}.label`} ctx={ctx} /></dt>
          </div>)}
        </dl>
      </div>;
    }
    case "PROJECT_OVERVIEW": {
      const body = section.props.body || linked.project?.description || "";
      const image = resolveImage(section.props.image, linked, 1280);
      const facts: Array<[string, ReactNode]> = [];
      if (section.props.showFacts) {
        if (linked.project?.developerName) facts.push(["Developer", linked.project.developerName]);
        if (linked.project?.constructionStatus) facts.push(["Construction", linked.project.constructionStatus]);
        if (linked.project?.handoverDate) facts.push(["Expected handover", dateLabel(linked.project.handoverDate)]);
        if (linked.project?.totalUnits) facts.push(["Total units", linked.project.totalUnits.toLocaleString("en-US")]);
        const unit = linked.listing ?? null;
        const type = unit?.propertyType ?? linked.property?.type;
        if (type) facts.push(["Property type", type]);
        const beds = bedrooms(unit?.bedrooms ?? linked.property?.bedrooms ?? null);
        if (beds) facts.push(["Bedrooms", beds]);
        const size = unit?.size ?? linked.property?.size;
        if (size) facts.push(["Built-up area", size]);
        if (linked.property?.view) facts.push(["View", linked.property.view]);
        if (linked.location?.text) facts.push(["Location", linked.location.text]);
      }
      const textBlock = <div>
        <Eyebrow value={section.props.eyebrow} path="eyebrow" ctx={ctx} />
        <Heading value={section.props.heading} path="heading" ctx={ctx} />
        <p className="pg-body mt-6 whitespace-pre-line text-base leading-8 text-[var(--pg-muted-fg)] @3xl:text-lg">
          {section.props.body || ctx.text ? <T value={section.props.body} path="body" ctx={ctx} multiline placeholder={body ? body.slice(0, 120) : "Add the overview text"} /> : body}
        </p>
        {facts.length > 0 && <dl {...movable(ctx, "facts", "block", "mt-10 grid grid-cols-2 gap-x-8 gap-y-6 @3xl:grid-cols-3")}>{facts.slice(0, 9).map(([label, value], index) => <Fact key={label} label={label} value={value} attrs={movable(ctx, `facts.${index}`, "block")} />)}</dl>}
      </div>;
      if (section.variant === "statement") {
        const figures = (["UNITS", "HANDOVER", "STARTING_PRICE", "PAYMENT_PLAN"] as StatSource[])
          .flatMap(source => { const value = statValue({source, value: ""}, linked); return value ? [{source, value}] : []; }).slice(0, 3);
        return <div className="space-y-14 @5xl:space-y-20">
          <div className="grid gap-6 @5xl:grid-cols-[13rem_minmax(0,1fr)]">
            <div><Eyebrow value={section.props.eyebrow} path="eyebrow" ctx={ctx} /></div>
            <h2 className="pg-h2 pg-statement font-[family-name:var(--pg-heading-font)] text-3xl font-normal leading-[1.2] tracking-[var(--pg-heading-tracking)] @3xl:text-5xl"><T value={section.props.heading} path="heading" ctx={ctx} placeholder="Add a statement" /></h2>
          </div>
          <div className="grid gap-10 @5xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] @5xl:gap-16">
            {image ? <Img image={image} sizes="(min-width: 1024px) 60vw, 100vw" className="aspect-[4/3] rounded-[var(--pg-radius)]" element={{ctx, key: "image"}} /> : null}
            <div className="space-y-10">
              <p className="pg-body whitespace-pre-line text-base leading-8 @3xl:text-lg">
                {section.props.body || ctx.text ? <T value={section.props.body} path="body" ctx={ctx} multiline placeholder={body ? body.slice(0, 120) : "Add the overview text"} /> : body}
              </p>
              {figures.length > 0 && <dl className="space-y-8">{figures.map((figure, index) => <div key={figure.source} {...movable(ctx, `figures.${index}`, "block", "pg-figure border-t border-[var(--pg-border)] pt-6")}>
                <dd className="break-words font-[family-name:var(--pg-heading-font)] text-4xl font-light tracking-[-0.03em] @3xl:text-5xl">{figure.value}</dd>
                <dt className="mt-3 text-sm text-[var(--pg-muted-fg)]">{FIGURE_LABELS[figure.source]}</dt>
              </div>)}</dl>}
            </div>
          </div>
        </div>;
      }
      if (section.variant === "imageRight" && image) {
        return <div className="grid items-center gap-14 @5xl:grid-cols-2">{textBlock}
          <div className="relative"><div aria-hidden="true" className="absolute -right-4 -bottom-4 h-full w-full rounded-[var(--pg-radius)] border border-[var(--pg-accent)]/50" />
            <Img image={image} sizes="(min-width: 1024px) 45vw, 100vw" className="pg-portrait relative aspect-[4/5] rounded-[var(--pg-radius)]" element={{ctx, key: "image"}} /></div>
        </div>;
      }
      return textBlock;
    }
    case "FEATURE_SPLIT": {
      const {props} = section;
      const image = resolveImage(props.image, linked, 1280);
      const text = <div className={section.variant === "overlap" ? "pg-card pg-panel relative z-10 rounded-[var(--pg-radius)] bg-[var(--pg-card)] p-8 shadow-2xl @3xl:p-12" : ""}>
        <Eyebrow value={props.eyebrow} path="eyebrow" ctx={ctx} />
        <Heading value={props.heading} path="heading" ctx={ctx} />
        <Intro value={props.body} path="body" ctx={ctx} />
        {props.bullets.length > 0 && <ul className="mt-8 space-y-3">{props.bullets.map((bullet, index) => <li key={index} className="flex items-start gap-3">
          <span className="pg-icon pg-bullet mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--pg-accent)] text-[var(--pg-accent-fg)]"><Check className="size-3" aria-hidden="true" /></span>
          <T value={bullet} path={`bullets.${index}`} ctx={ctx} />
        </li>)}</ul>}
        {props.cta && <div className="mt-9"><CtaButton cta={props.cta} ctx={ctx} path="cta" /></div>}
      </div>;
      const picture = image ? <Img image={image} sizes="(min-width: 1024px) 55vw, 100vw" className={`rounded-[var(--pg-radius)] ${section.variant === "overlap" ? "aspect-[16/10]" : "pg-portrait aspect-[4/5] @5xl:aspect-[5/6]"} ${props.imageSide === "LEFT" ? "pg-side-left" : "pg-side-right"}`} imgClassName="hover:scale-105" element={{ctx, key: "image"}} /> : null;
      if (section.variant === "overlap" && picture) {
        return <div className="grid items-center @5xl:grid-cols-12">
          <div className={`@5xl:col-span-8 ${props.imageSide === "LEFT" ? "" : "@5xl:col-start-5 @5xl:row-start-1"}`}>{picture}</div>
          <div className={`-mt-16 px-4 @5xl:mt-0 @5xl:px-0 @5xl:row-start-1 @5xl:col-span-5 ${props.imageSide === "LEFT" ? "@5xl:col-start-8" : "@5xl:col-start-1"}`}>{text}</div>
        </div>;
      }
      return <div className="grid items-center gap-12 @5xl:grid-cols-2 @5xl:gap-20">
        {props.imageSide === "LEFT" ? <>{picture}{text}</> : <>{text}{picture}</>}
      </div>;
    }
    case "DEVELOPER": {
      const developer = linked.developer!;
      return <div className={`pg-card grid gap-8 rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] p-8 @3xl:p-12 ${section.variant === "banner" ? "@5xl:grid-cols-[1fr_2fr] @5xl:items-center" : ""}`}>
        <div><p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--pg-accent)]"><T value={section.props.heading} path="heading" ctx={ctx} /></p>
          <h2 {...movable(ctx, "developerName", "text", "mt-3 font-[family-name:var(--pg-heading-font)] text-3xl font-semibold @3xl:text-4xl")}>{developer.name}</h2></div>
        <p className="whitespace-pre-line text-base leading-8 text-[var(--pg-muted-fg)]">{section.props.body || ctx.text ? <T value={section.props.body} path="body" ctx={ctx} multiline placeholder={developer.description ?? "Add the developer profile"} /> : developer.description}</p>
      </div>;
    }
    case "HIGHLIGHTS": if (section.variant === "rows") return <div>
      <Header eyebrow={section.props.eyebrow} heading={section.props.heading} intro={section.props.intro} ctx={ctx} center={center} />
      <ol className="pg-rows mt-14 border-t border-[var(--pg-border)]">{section.props.items.map((item, index) => <li key={index} {...movable(ctx, `items.${index}`, "block", "grid gap-3 border-b border-[var(--pg-border)] py-8 @3xl:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1.3fr)] @3xl:items-baseline @3xl:gap-8")}>
        <span className="text-sm tabular-nums text-[var(--pg-muted-fg)]">{`(${String(index + 1).padStart(2, "0")})`}</span>
        <h3 className="font-[family-name:var(--pg-heading-font)] text-2xl font-normal tracking-[var(--pg-heading-tracking)] @3xl:text-3xl"><T value={item.title} path={`items.${index}.title`} ctx={ctx} /></h3>
        {(item.text || ctx.text) && <p className="leading-7 text-[var(--pg-muted-fg)]"><T value={item.text} path={`items.${index}.text`} ctx={ctx} multiline placeholder="Add a description" /></p>}
      </li>)}</ol>
    </div>;
    if (section.variant === "stack") return <div>
      <Header eyebrow={section.props.eyebrow} heading={section.props.heading} intro={section.props.intro} ctx={ctx} center={center} />
      <ol className="mt-14 space-y-6">{section.props.items.map((item, index) => {
        const Icon = ICONS[item.icon];
        return <li key={index} {...movable(ctx, `items.${index}`, "block", "pg-card pg-panel pg-stack-card sticky grid items-center gap-6 rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] p-8 shadow-[0_-24px_60px_-34px_rgba(0,0,0,.45)] @3xl:grid-cols-[auto_1fr_auto] @3xl:gap-10 @3xl:p-12")}
          style={{...movable(ctx, `items.${index}`, "block").style, top: `calc(6rem + ${index * 1.25}rem)`}}>
          <span aria-hidden="true" className="font-[family-name:var(--pg-heading-font)] text-5xl font-semibold text-[var(--pg-accent)] @3xl:text-7xl">{String(index + 1).padStart(2, "0")}</span>
          <div><h3 className="font-[family-name:var(--pg-heading-font)] text-2xl font-semibold @3xl:text-3xl"><T value={item.title} path={`items.${index}.title`} ctx={ctx} /></h3>
            {(item.text || ctx.text) && <p className="mt-3 max-w-2xl leading-8 text-[var(--pg-muted-fg)]"><T value={item.text} path={`items.${index}.text`} ctx={ctx} multiline placeholder="Add a description" /></p>}</div>
          <span className="hidden size-16 items-center justify-center rounded-full bg-[var(--pg-accent)] text-[var(--pg-accent-fg)] @3xl:flex"><Icon className="size-7" aria-hidden="true" /></span>
        </li>;
      })}</ol>
    </div>;
    return <div>
      <Header eyebrow={section.props.eyebrow} heading={section.props.heading} intro={section.props.intro} ctx={ctx} center={center} />
      <ul className={`mt-14 grid gap-5 ${section.variant === "list" ? "@3xl:grid-cols-2" : COLUMNS[section.props.columns]}`}>
        {section.props.items.map((item, index) => {
          const Icon = ICONS[item.icon];
          return <li key={index} {...movable(ctx, `items.${index}`, "block", "pg-card group/card rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl")}>
            <span className="pg-icon flex size-12 items-center justify-center rounded-full bg-[var(--pg-accent)]/12 text-[var(--pg-accent)] transition-colors group-hover/card:bg-[var(--pg-accent)] group-hover/card:text-[var(--pg-accent-fg)]"><Icon className="size-5" aria-hidden="true" /></span>
            <h3 className="mt-5 font-[family-name:var(--pg-heading-font)] text-xl font-semibold"><T value={item.title} path={`items.${index}.title`} ctx={ctx} /></h3>
            {(item.text || ctx.text) && <p className="mt-2 text-sm leading-7 text-[var(--pg-muted-fg)]"><T value={item.text} path={`items.${index}.text`} ctx={ctx} multiline placeholder="Add a description" /></p>}
          </li>;
        })}
      </ul>
    </div>;
    case "GALLERY": {
      const images = galleryImages(section, linked);
      const head = (section.props.heading || section.props.intro || ctx.text) && <div className="mb-12"><Header eyebrow={section.props.eyebrow} heading={section.props.heading} intro={section.props.intro} ctx={ctx} center={center} /></div>;
      const zoom = section.props.lightbox && !ctx.text && images.length > 0;
      const viewer = zoom && <PageLightbox group={section.id} images={lightboxImages(images)} />;
      const z = (index: number, child: ReactNode) => <Zoom on={zoom} group={section.id} index={index} total={images.length} image={images[index]}>{child}</Zoom>;
      // A 3D carousel that rotates by dragging, the buttons or the arrow keys.
      if (section.variant === "coverflow") return <div>{head}<PageCoverflow label="Photo gallery">
        {images.map((image, index) => <div key={`${image.id}-${index}`} className="h-full w-full">{z(index, <Img image={image} sizes="(min-width: 1024px) 30vw, 72vw" className="h-full rounded-[var(--pg-radius)] shadow-2xl" />)}</div>)}
      </PageCoverflow>{viewer}</div>;
      // A strip of photos with previous and next buttons and dragging; no scrollbar.
      if (section.variant === "carousel") return <div>{head}<PageCarousel label="Photo gallery">
        {images.map((image, index) => <li key={`${image.id}-${index}`} className="w-[85%] shrink-0 snap-start @3xl:w-[46%] @5xl:w-[38%]">{z(index, <Img image={image} sizes="(min-width: 1024px) 40vw, 85vw" className="aspect-[4/5] rounded-[var(--pg-radius)]" imgClassName="hover:scale-105" />)}</li>)}
      </PageCarousel>{viewer}</div>;
      if (section.variant === "bento") {
        // Seven tiles; with the viewer, the last tile shows how many more photos there are.
        const more = zoom ? images.length - 7 : 0;
        return <div>{head}<ul className="grid auto-rows-[11rem] grid-cols-2 gap-3 @3xl:auto-rows-[14rem] @5xl:grid-cols-4" aria-label="Photo gallery">
          {images.slice(0, 7).map((image, index) => <li key={`${image.id}-${index}`} className={index === 0 ? "col-span-2 row-span-2" : index === 3 ? "@5xl:col-span-2" : ""}>
            {z(index, <>
              <Img image={image} sizes={index === 0 ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"} className="h-full rounded-[var(--pg-radius)]" imgClassName="hover:scale-105" element={{ctx, key: `photos.${index}`}} />
              {index === 6 && more > 0 && <span className="absolute inset-0 grid place-items-center rounded-[var(--pg-radius)] bg-black/55 font-[family-name:var(--pg-heading-font)] text-3xl font-semibold text-white">{`+${more}`}</span>}
            </>)}
          </li>)}
        </ul>{viewer}</div>;
      }
      return <div>{head}<ul className={`grid grid-cols-1 gap-4 ${COLUMNS[section.props.columns]}`} aria-label="Photo gallery">
        {images.map((image, index) => <li key={`${image.id}-${index}`}>{z(index, <Img image={image} sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" className="aspect-[4/3] rounded-[var(--pg-radius)]" imgClassName="hover:scale-105" element={{ctx, key: `photos.${index}`}} />)}</li>)}
      </ul>{viewer}</div>;
    }
    case "VIDEO_SHOWCASE": {
      const video = resolveVideo(section.props.video, linked);
      const poster = resolveImage(section.props.poster, linked, 1600)?.url ?? video?.poster ?? undefined;
      return <div>
        {(section.props.heading || section.props.body || ctx.text) && <div className="mb-12"><Header eyebrow={section.props.eyebrow} heading={section.props.heading} intro={section.props.body} ctx={ctx} center={center} paths={{eyebrow: "eyebrow", heading: "heading", intro: "body"}} /></div>}
        {video && <div {...movable(ctx, "video", "image", `overflow-hidden rounded-[var(--pg-radius)] shadow-2xl ${section.variant === "contained" ? "mx-auto max-w-4xl" : ""}`)}>
          <video className="aspect-video w-full object-cover" src={video.url} poster={poster} autoPlay muted loop playsInline preload="metadata" controls aria-label={video.title} />
        </div>}
      </div>;
    }
    case "UNIT_TYPES": {
      const units = linked.unitTypes!;
      return <div>
        <Header heading={section.props.heading} intro={section.props.intro} ctx={ctx} center={center} />
        {section.variant === "cards"
          ? <ul className="mt-12 grid gap-5 @3xl:grid-cols-2 @5xl:grid-cols-3">{units.groups.map((group, index) => <li key={index} {...movable(ctx, `cards.${index}`, "block", "pg-card rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] p-7 transition-shadow hover:shadow-xl")}>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--pg-muted-fg)]">{group.type}</p>
            <h3 className="mt-2 font-[family-name:var(--pg-heading-font)] text-3xl font-semibold">{bedrooms(group.bedrooms) ?? group.type}</h3>
            <div className="mt-6 flex items-end justify-between gap-3 border-t border-[var(--pg-border)] pt-5">
              <div><p className="text-xs text-[var(--pg-muted-fg)]">Indicative from</p><p className="text-lg font-semibold text-[var(--pg-accent)]">{group.priceFrom ?? "On request"}</p></div>
              <p className="text-sm text-[var(--pg-muted-fg)]">{group.availableUnits} available</p>
            </div>
          </li>)}</ul>
          : <div className="mt-12 overflow-x-auto rounded-[var(--pg-radius)] border border-[var(--pg-border)]"><table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">Available unit types</caption>
            <thead className="bg-[var(--pg-muted)]"><tr><th scope="col" className="px-5 py-4">Type</th><th scope="col" className="px-5 py-4">Bedrooms</th><th scope="col" className="px-5 py-4">Available</th><th scope="col" className="px-5 py-4">Indicative price</th></tr></thead>
            <tbody>{units.groups.map((group, index) => <tr key={index} className="border-t border-[var(--pg-border)]"><td className="px-5 py-4">{group.type}</td><td className="px-5 py-4">{bedrooms(group.bedrooms) ?? "–"}</td><td className="px-5 py-4">{group.availableUnits}</td>
              <td className="px-5 py-4">{group.priceFrom ? (group.priceTo && group.priceTo !== group.priceFrom ? `${group.priceFrom} – ${group.priceTo}` : group.priceFrom) : "On request"}</td></tr>)}</tbody>
          </table></div>}
        <p className="mt-4 text-xs text-[var(--pg-muted-fg)]">Availability and indicative prices as recorded on {dubaiDate(linked.readAt)}{units.complete ? "" : " (partial list)"}. Subject to change.</p>
      </div>;
    }
    case "PRICING": {
      const cards: Array<{title: string; price: string; detail: string | null}> = [];
      if (linked.listing) cards.push({title: linked.listing.title, price: priceText(linked.listing), detail: [linked.listing.purpose === "RENT" ? "For rent" : "For sale", bedrooms(linked.listing.bedrooms), linked.listing.size].filter(Boolean).join(" · ")});
      if (linked.project?.startingPrice) cards.push({title: linked.project.name, price: `From ${linked.project.startingPrice.display}`, detail: "Starting price"});
      for (const listing of linked.comparison) if (listing.id !== linked.listing?.id) cards.push({title: listing.title, price: priceText(listing), detail: [bedrooms(listing.bedrooms), listing.size].filter(Boolean).join(" · ")});
      const banner = section.variant === "banner";
      return <div className={banner ? "text-center" : ""}>
        <Header heading={section.props.heading} intro={section.props.intro} ctx={ctx} center={banner || center} />
        <ul className={`mt-12 grid gap-5 ${banner ? "mx-auto max-w-xl" : "@3xl:grid-cols-2 @5xl:grid-cols-3"}`}>{cards.slice(0, 6).map((card, index) => <li key={index} {...movable(ctx, `cards.${index}`, "block", "pg-card rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] p-8")}>
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--pg-muted-fg)]">{card.title}</p><p className="mt-3 font-[family-name:var(--pg-heading-font)] text-4xl font-semibold text-[var(--pg-accent)]">{card.price}</p>{card.detail && <p className="mt-2 text-sm text-[var(--pg-muted-fg)]">{card.detail}</p>}
        </li>)}</ul>
        <p className="mt-4 text-xs text-[var(--pg-muted-fg)]"><T value={section.props.note || "Prices as recorded"} path="note" ctx={ctx} /> (recorded on {dubaiDate(linked.readAt)}).</p>
      </div>;
    }
    case "PAYMENT_PLANS": return <div>
      <Header eyebrow={section.props.eyebrow} heading={section.props.heading} intro={section.props.intro} ctx={ctx} center={center} />
      <div className="mt-12 space-y-10">{linked.paymentPlans.map((plan, index) => {
        const construction = plan.installments.reduce((sum, item) => sum + percentNumber(item.share), 0);
        if (section.variant === "milestones") {
          const steps = [{value: plan.booking, label: "Down payment", note: "On booking"}, {value: construction ? `${construction.toLocaleString("en-US")}%` : null, label: "During construction", note: `${plan.installments.length} instalment${plan.installments.length === 1 ? "" : "s"}`}, {value: plan.handover, label: "On handover", note: "Balance"}].filter(step => step.value);
          return <article key={index}>
            <h3 className="mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--pg-muted-fg)]">{plan.name}</h3>
            <ol className="grid gap-4 @3xl:grid-cols-3">{steps.map((step, position) => <li key={step.label} {...movable(ctx, `steps.${position}`, "block", "pg-card relative overflow-hidden rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] p-8")}>
              <span aria-hidden="true" className="absolute right-6 top-4 font-[family-name:var(--pg-heading-font)] text-7xl font-semibold opacity-[0.06]">{position + 1}</span>
              <p className="font-[family-name:var(--pg-heading-font)] text-5xl font-semibold text-[var(--pg-accent)] @3xl:text-6xl">{step.value}</p>
              <p className="mt-3 text-lg font-semibold">{step.label}</p><p className="text-sm text-[var(--pg-muted-fg)]">{step.note}</p>
            </li>)}</ol>
          </article>;
        }
        return <article key={index} {...movable(ctx, `plans.${index}`, "block", "pg-card rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] p-7")}>
          <h3 className="font-semibold">{plan.name}</h3>
          <ol className="mt-4 space-y-2 text-sm">
            {plan.booking && <li className="flex justify-between gap-3 border-b border-[var(--pg-border)] pb-2"><span>On booking</span><span className="font-semibold">{plan.booking}</span></li>}
            {plan.installments.map((item, position) => <li key={position} className="flex justify-between gap-3 border-b border-[var(--pg-border)] pb-2"><span>{item.due}{item.note ? ` – ${item.note}` : ""}</span><span className="font-semibold">{item.share}</span></li>)}
            {plan.handover && <li className="flex justify-between gap-3"><span>On handover</span><span className="font-semibold">{plan.handover}</span></li>}
          </ol>
        </article>;
      })}</div>
      <p className="mt-5 text-xs text-[var(--pg-muted-fg)]">Payment plans as recorded on {dubaiDate(linked.readAt)}. Final terms are set out in the sale agreement.</p>
    </div>;
    case "FLOOR_PLANS": {
      const media = new Map(linked.media.map(item => [item.id, item]));
      return <div>
        <Header heading={section.props.heading} intro={section.props.intro} ctx={ctx} center={center} />
        <ul className={`mt-12 grid gap-5 ${section.variant === "list" ? "" : "@3xl:grid-cols-2 @5xl:grid-cols-3"}`}>{linked.floorPlans.map((plan, index) => {
          const image = plan.mediaId ? media.get(plan.mediaId) : undefined;
          return <li key={plan.id} {...movable(ctx, `cards.${index}`, "block", "pg-card overflow-hidden rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)]")}>
            {image && <Img image={{id: image.id, url: image.url, srcSet: null, alt: `${plan.name} floor plan`, stock: false, credit: null}} sizes="(min-width: 1024px) 33vw, 100vw" className="aspect-[4/3] bg-white" imgClassName="!object-contain" />}
            <div className="p-5"><h3 className="font-[family-name:var(--pg-heading-font)] text-xl font-semibold">{plan.name}</h3><p className="text-sm text-[var(--pg-muted-fg)]">{[plan.type, bedrooms(plan.bedrooms), plan.size].filter(Boolean).join(" · ")}</p></div>
          </li>;
        })}</ul>
      </div>;
    }
    case "AMENITIES": {
      const head = <Header eyebrow={section.props.eyebrow} heading={section.props.heading} intro={section.props.intro} ctx={ctx} center={center} />;
      if (section.variant === "imageCards") {
        const used = new Map<string, number>();
        return <div>{head}<ul className={`mt-12 grid grid-cols-1 gap-4 ${COLUMNS[section.props.columns]}`}>{linked.amenities.slice(0, 12).map((name, index) => {
          const tag = amenityStockTag(name);
          const offset = used.get(tag) ?? 0;
          used.set(tag, offset + 1);
          const item = stockImagesFor(tag, 1, offset)[0];
          return <li key={name} {...movable(ctx, `cards.${index}`, "image", "pg-media pg-tile group/amenity relative aspect-[4/3] overflow-hidden rounded-[var(--pg-radius)]")}>
            {item && <img src={stockImageUrl(item, 900)} srcSet={stockImageSrcSet(item)} sizes="(min-width: 1024px) 33vw, 100vw" alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover/amenity:scale-110" />}
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <p className="absolute inset-x-0 bottom-0 p-5 font-[family-name:var(--pg-heading-font)] text-xl font-semibold text-white">{name}</p>
          </li>;
        })}</ul></div>;
      }
      return <div>{head}<ul className={`mt-12 grid grid-cols-1 gap-3 ${section.variant === "list" ? "@3xl:grid-cols-2" : COLUMNS[section.props.columns]}`}>{linked.amenities.map((name, index) => <li key={name} {...movable(ctx, `cards.${index}`, "block", "pg-card flex items-center gap-4 rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] px-5 py-4")}>
        <span className="pg-icon flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--pg-accent)]/12 text-[var(--pg-accent)]"><Check className="size-4" aria-hidden="true" /></span>{name}</li>)}</ul></div>;
    }
    case "LOCATION": {
      const location = sectionLocation(section, linked)!;
      const text = <div><Eyebrow value={section.props.eyebrow} path="eyebrow" ctx={ctx} /><Heading value={section.props.heading} path="heading" ctx={ctx} /><Intro value={section.props.body} path="body" ctx={ctx} /></div>;
      const map = <div {...movable(ctx, "map", "block")}><PageLocationMap location={location} showMap={section.props.showMap} title={ctx.headline} /></div>;
      return section.variant === "mapTop" ? <div className="space-y-8">{text}{map}</div> : <div className="grid gap-12 @5xl:grid-cols-2 @5xl:items-center">{text}{map}</div>;
    }
    case "LANDMARKS": return <div>
      <Header heading={section.props.heading} intro={section.props.intro} ctx={ctx} center={center} />
      <ul className={`mt-10 grid gap-3 ${section.variant === "grid" ? "@3xl:grid-cols-2 @5xl:grid-cols-3" : ""}`}>{section.props.items.map((item, index) => <li key={index} className="pg-card rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] px-5 py-4">
        <p className="text-xs uppercase tracking-wider text-[var(--pg-muted-fg)]">{LANDMARK_LABELS[item.category]}</p><p className="font-medium"><T value={item.name} path={`items.${index}.name`} ctx={ctx} /></p>{item.note && <p className="text-sm text-[var(--pg-muted-fg)]">{item.note}</p>}
      </li>)}</ul>
    </div>;
    case "COMPARISON": {
      const listings = comparisonListings(section, linked);
      const rows: Array<[string, (listing: LinkedListing) => ReactNode]> = [
        ["Price", priceText], ["Type", listing => listing.propertyType ?? "–"], ["Bedrooms", listing => bedrooms(listing.bedrooms) ?? "–"], ["Bathrooms", listing => listing.bathrooms ?? "–"],
        ["Built-up area", listing => listing.size ?? "–"], ["Location", listing => listing.locationText || "–"], ["Advertising permit", listing => listing.permitNumber ?? "–"],
      ];
      return <div>
        <Header heading={section.props.heading} intro={section.props.intro} ctx={ctx} center={center} />
        <div className="mt-10 overflow-x-auto rounded-[var(--pg-radius)] border border-[var(--pg-border)]"><table className="w-full min-w-[36rem] text-left text-sm">
          <caption className="sr-only">Property comparison</caption>
          <thead className="bg-[var(--pg-muted)]"><tr><th scope="col" className="px-5 py-4"><span className="sr-only">Detail</span></th>{listings.map(listing => <th key={listing.id} scope="col" className="px-5 py-4">{listing.title}</th>)}</tr></thead>
          <tbody>{rows.map(([label, value]) => <tr key={label} className="border-t border-[var(--pg-border)]"><th scope="row" className="px-5 py-4 font-medium">{label}</th>{listings.map(listing => <td key={listing.id} className="px-5 py-4">{value(listing)}</td>)}</tr>)}</tbody>
        </table></div>
      </div>;
    }
    case "BANNER": {
      const {props} = section;
      const left = section.variant === "left";
      return <div className={left ? "max-w-3xl" : "mx-auto max-w-4xl text-center"}>
        <Eyebrow value={props.eyebrow} path="eyebrow" ctx={ctx} center={!left} />
        <h2 className={`pg-h2 pg-display font-[family-name:var(--pg-heading-font)] font-semibold leading-[1.05] tracking-[var(--pg-heading-tracking)] ${HEADLINE_CLASSES[ctx.page.data.theme.scale]}`}><T value={props.heading} path="heading" ctx={ctx} /></h2>
        {(props.body || ctx.text) && <p className="mt-6 whitespace-pre-line text-lg leading-8 opacity-85"><T value={props.body} path="body" ctx={ctx} multiline placeholder="Add text" /></p>}
        {(props.cta || props.secondaryCta) && <div className={`mt-10 flex flex-wrap gap-3 ${left ? "" : "justify-center"}`}>
          {props.cta && <CtaButton cta={props.cta} ctx={ctx} path="cta" large />}
          {props.secondaryCta && <CtaButton cta={props.secondaryCta} ctx={ctx} path="secondaryCta" secondary large />}
        </div>}
      </div>;
    }
    case "ENQUIRY_FORM": {
      const {props} = section;
      const form = <div {...movable(ctx, "form", "card")}>{!ctx.page.form ? <SampleEnquiryForm submitLabel={props.submitLabel} /> : <PageEnquiryForm form={ctx.page.form} endpoint={ctx.mode === "public" ? ctx.publicContext?.enquiryEndpoint ?? null : null} submitLabel={props.submitLabel} pageTitle={ctx.publicContext?.pageTitle ?? ctx.page.title} />}</div>;
      const points = (props.points.length > 0) && <ul className="mt-8 space-y-3">{props.points.map((point, index) => <li key={index} className="flex items-center gap-3"><Check className="size-5 text-[var(--pg-accent)]" aria-hidden="true" /><T value={point} path={`points.${index}`} ctx={ctx} /></li>)}</ul>;
      const image = resolveImage(props.image, linked, 1280);
      if (section.variant === "imageSplit") {
        return <div className="pg-card grid overflow-hidden rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] shadow-2xl @5xl:grid-cols-2">
          <div className="relative isolate flex min-h-[22rem] flex-col justify-end p-8 text-white @3xl:p-12">
            {image ? <img src={image.url} srcSet={image.srcSet ?? undefined} sizes="(min-width: 1024px) 50vw, 100vw" alt="" loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover" /> : <div className="absolute inset-0 -z-20 bg-[var(--pg-accent)]" />}
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
            <h2 className="font-[family-name:var(--pg-heading-font)] text-3xl font-semibold leading-tight @3xl:text-4xl"><T value={props.heading} path="heading" ctx={ctx} /></h2>
            {(props.intro || ctx.text) && <p className="mt-4 text-white/85"><T value={props.intro} path="intro" ctx={ctx} multiline placeholder="Add text" /></p>}
            {points}
          </div>
          <div className="p-2 @3xl:p-6">{form}</div>
        </div>;
      }
      const text = <div><Heading value={props.heading} path="heading" ctx={ctx} center={section.variant !== "split"} /><Intro value={props.intro} path="intro" ctx={ctx} center={section.variant !== "split"} />{points}</div>;
      return section.variant === "split"
        ? <div className="grid gap-12 @5xl:grid-cols-[1fr_1.2fr] @5xl:items-start">{text}{form}</div>
        : <div className="mx-auto max-w-2xl space-y-10">{text}{form}</div>;
    }
    case "CONTACT": return <ContactBody section={section} ctx={ctx} />;
    case "CUSTOM": return <CustomBody section={section} ctx={ctx} />;
    case "WHATSAPP_CTA": case "CALL_CTA": {
      const whatsapp = section.type === "WHATSAPP_CTA";
      const href = whatsapp ? ctaHref({label: "", action: "WHATSAPP"}, linked, ctx.hasForm, ctx.anchors, section.props.prefilledMessage) : ctaHref({label: "", action: "CALL"}, linked, ctx.hasForm, ctx.anchors);
      const Icon = whatsapp ? MessageCircle : Phone;
      return <div className={`flex flex-col items-center gap-6 text-center ${section.variant === "card" ? "pg-card mx-auto max-w-3xl rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] p-10" : ""}`}>
        <span className="flex size-14 items-center justify-center rounded-full bg-[var(--pg-accent)] text-[var(--pg-accent-fg)]"><Icon className="size-6" aria-hidden="true" /></span>
        <Heading value={section.props.heading} path="heading" ctx={ctx} center />
        {(section.props.body || ctx.text) && <p className="max-w-2xl text-lg text-[var(--pg-muted-fg)]"><T value={section.props.body} path="body" ctx={ctx} multiline placeholder="Add text" /></p>}
        {href && <a href={href} {...(whatsapp ? {target: "_blank", rel: "noreferrer"} : {})} className="pg-btn pg-btn-primary inline-flex h-14 items-center gap-2 rounded-[var(--pg-button-radius)] bg-[var(--pg-accent)] px-8 text-base font-semibold text-[var(--pg-accent-fg)] transition-transform hover:-translate-y-0.5"><Icon className="size-4" aria-hidden="true" /><T value={section.props.buttonLabel} path="buttonLabel" ctx={ctx} /></a>}
      </div>;
    }
    case "TESTIMONIALS": return <div>
      <Heading value={section.props.heading} path="heading" ctx={ctx} center={center} />
      <ul className={`mt-12 grid gap-5 ${section.variant === "quote" ? "" : "@3xl:grid-cols-2 @5xl:grid-cols-3"}`}>{section.props.items.map((item, index) => <li key={index}><figure className="pg-card h-full rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] p-8">
        <span aria-hidden="true" className="font-[family-name:var(--pg-heading-font)] text-6xl leading-none text-[var(--pg-accent)]">“</span>
        <blockquote className="whitespace-pre-line text-lg leading-8"><T value={item.quote} path={`items.${index}.quote`} ctx={ctx} multiline /></blockquote>
        <figcaption className="mt-6 text-sm"><span className="font-semibold">{item.author}</span>{item.context && <span className="text-[var(--pg-muted-fg)]"> · {item.context}</span>}</figcaption>
      </figure></li>)}</ul>
    </div>;
    case "FAQ": return <div className="pg-faq mx-auto max-w-3xl">
      <Heading value={section.props.heading} path="heading" ctx={ctx} center />
      <div className="mt-12 divide-y divide-[var(--pg-border)] border-y border-[var(--pg-border)]">{section.props.items.map((item, index) => section.variant === "accordion"
        ? <details key={index} {...movable(ctx, `items.${index}`, "block", "group/faq py-6")} open={Boolean(ctx.text) || undefined}><summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-[family-name:var(--pg-heading-font)] text-lg font-semibold marker:hidden">
          <T value={item.question} path={`items.${index}.question`} ctx={ctx} /><ChevronDown className="size-5 shrink-0 transition-transform group-open/faq:rotate-180" aria-hidden="true" /></summary>
          <p className="mt-4 whitespace-pre-line leading-8 text-[var(--pg-muted-fg)]"><T value={item.answer} path={`items.${index}.answer`} ctx={ctx} multiline /></p></details>
        : <div key={index} className="py-6"><h3 className="font-[family-name:var(--pg-heading-font)] text-lg font-semibold"><T value={item.question} path={`items.${index}.question`} ctx={ctx} /></h3><p className="mt-3 whitespace-pre-line leading-8 text-[var(--pg-muted-fg)]"><T value={item.answer} path={`items.${index}.answer`} ctx={ctx} multiline /></p></div>)}</div>
    </div>;
    case "COUNTDOWN": return <div className="space-y-6 text-center">
      <Heading value={section.props.heading} path="heading" ctx={ctx} center />{(section.props.body || ctx.text) && <p className="mx-auto max-w-2xl text-lg text-[var(--pg-muted-fg)]"><T value={section.props.body} path="body" ctx={ctx} multiline placeholder="Add text" /></p>}
      <PageCountdown date={countdownDate(section, linked)!} />
    </div>;
    case "FOOTER": return null;
  }
}

/** Company identity, approved contacts, permits, disclaimer and stock credits. Always shown, with or without a footer section. */
function ComplianceFooter({page, footer, anchors, ctx}: {page: RenderablePage; footer: SectionOf<"FOOTER"> | null; anchors: Ctx["anchors"]; ctx: Ctx}) {
  const {linked, data} = page;
  const listings = advertisedListings(data, linked);
  const disclaimer = footer?.props.disclaimer.trim() || linked.company.disclaimer;
  const showContacts = footer?.props.showContacts ?? true;
  const stock = stockMediaUsed(data);
  const contacts = [
    linked.company.phone && <a key="phone" href={`tel:${digits(linked.company.phone)}`} className="hover:underline">{linked.company.phone}</a>,
    linked.company.whatsapp && linked.company.whatsapp !== linked.company.phone && <a key="wa" href={`https://wa.me/${digits(linked.company.whatsapp).replace(/^\+/, "")}`} target="_blank" rel="noreferrer" className="hover:underline">WhatsApp {linked.company.whatsapp}</a>,
    linked.company.email && <a key="email" href={`mailto:${linked.company.email}`} className="hover:underline">{linked.company.email}</a>,
    linked.company.website && <a key="web" href={linked.company.website} target="_blank" rel="noreferrer" className="hover:underline">{new URL(linked.company.website).host}</a>,
  ].filter(Boolean);
  const permits: ReactNode[] = [
    ...listings.filter(listing => listing.permitNumber).map(listing => <li key={listing.id}>Advertising permit {listing.permitNumber}{listing.permitVerificationUrl && <> · <a href={listing.permitVerificationUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">Verify permit</a></>}</li>),
    linked.project?.permitNumber ? <li key="project">Project permit {linked.project.permitNumber}{linked.project.permitVerificationUrl && <> · <a href={linked.project.permitVerificationUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">Verify permit</a></>}</li> : null,
  ].filter(Boolean);
  const detailed = footer?.variant !== "simple";
  const footerElement = <footer className="relative px-5 pb-10 pt-16 text-sm @3xl:px-12" style={sectionBackgroundStyle(footer?.layout.background ?? "DARK", data.theme)} data-section-id={footer?.id}>
    <div className="mx-auto max-w-6xl">
      <div className={`gap-12 border-b border-[var(--pg-border)] pb-12 ${detailed ? "grid @3xl:grid-cols-[1.4fr_1fr_1fr]" : "space-y-4"}`}>
        <div className="space-y-3">
          <p className="font-[family-name:var(--pg-heading-font)] text-2xl font-semibold">{linked.company.name}</p>
          {linked.company.tagline && <p className="max-w-sm text-[var(--pg-muted-fg)]">{linked.company.tagline}</p>}
        </div>
        {detailed && anchors.length > 0 && <nav aria-label="Footer"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--pg-muted-fg)]">Explore</p><ul className="space-y-2">{anchors.slice(0, 6).map(anchor => <li key={anchor.href}><a href={anchor.href} className="hover:underline">{anchor.label}</a></li>)}</ul></nav>}
        {showContacts && contacts.length > 0 && <div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--pg-muted-fg)]">Contact</p><div className="flex flex-col gap-2">{contacts}</div></div>}
      </div>
      <div className="space-y-3 pt-8 text-xs leading-6 text-[var(--pg-muted-fg)]">
        {permits.length > 0 && <ul className="space-y-1">{permits}</ul>}
        {(disclaimer || ctx.text) && <p className="whitespace-pre-line">{footer && ctx.text && (footer.props.disclaimer || !disclaimer) ? <T value={footer.props.disclaimer} path="disclaimer" ctx={ctx} multiline placeholder="Add a disclaimer" /> : disclaimer}</p>}
        {stock.any && <p>Some images and videos on this page are illustrative stock media and do not show the advertised property. Stock media from Unsplash and Pexels.</p>}
        <p>Prices, availability and payment terms as recorded on {dubaiDate(linked.readAt)} and subject to change. © {new Date(linked.readAt).getUTCFullYear()} {linked.company.name}.</p>
      </div>
    </div>
  </footer>;
  return footerElement;
}

/** Editor only: the enquiry form before a CRM lead form is connected. It cannot submit. */
function SampleEnquiryForm({submitLabel}: {submitLabel: string}) {
  const field = "h-12 w-full rounded-[calc(var(--pg-radius)*0.6)] border border-[var(--pg-border)] bg-[var(--pg-bg)] px-4 text-sm text-[var(--pg-muted-fg)]";
  return <div className="pg-card relative rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] p-6 text-[var(--pg-fg)] @3xl:p-8" aria-label="Sample form (not connected)">
    <span className="absolute -top-3 right-5 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-950">Sample · connect a lead form</span>
    <div className="grid gap-4 @3xl:grid-cols-2">
      <div className={field} aria-hidden="true"><span className="leading-[3rem]">Full name</span></div>
      <div className={field} aria-hidden="true"><span className="leading-[3rem]">Phone number</span></div>
      <div className={`${field} @3xl:col-span-2`} aria-hidden="true"><span className="leading-[3rem]">Email address</span></div>
      <div className={`${field} h-28 @3xl:col-span-2`} aria-hidden="true"><span className="block pt-3">How can we help?</span></div>
    </div>
    <span className="mt-5 flex h-14 w-full items-center justify-center rounded-[var(--pg-button-radius)] bg-[var(--pg-accent)] text-base font-semibold text-[var(--pg-accent-fg)] opacity-80">{submitLabel}</span>
  </div>;
}

const CONTACT_ICONS = {PHONE: Phone, WHATSAPP: MessageCircle, EMAIL: Mail, ADDRESS: MapPin, HOURS: Clock} as const;

/** Links are built only from approved company or agent records. */
function contactHref(kind: keyof typeof CONTACT_ICONS, value: string) {
  if (kind === "PHONE") return `tel:${digits(value)}`;
  if (kind === "WHATSAPP") return `https://wa.me/${digits(value).replace(/^\+/, "")}`;
  if (kind === "EMAIL") return `mailto:${value}`;
  if (kind === "ADDRESS") return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
  return null;
}

const AGENT_LINK = "flex items-center gap-3 rounded-[calc(var(--pg-radius)*0.6)] border border-[var(--pg-border)] px-4 py-3 text-sm font-medium transition-colors hover:border-[var(--pg-accent)]";

function contactLink(kind: keyof typeof CONTACT_ICONS, value: string, className: string, children: ReactNode) {
  const href = contactHref(kind, value);
  return href ? <a href={href} {...(href.startsWith("https://") ? {target: "_blank", rel: "noreferrer"} : {})} className={className}>{children}</a> : <div className={className}>{children}</div>;
}
const link = contactLink;

function AgentCard({agent}: {agent: NonNullable<ReturnType<typeof agentById>>}) {
  return <div className="pg-card rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] p-7 text-left text-[var(--pg-fg)] shadow-[0_30px_60px_-30px_rgba(0,0,0,.35)]">
    <div className="flex items-center gap-4">
      <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[var(--pg-accent)] font-[family-name:var(--pg-heading-font)] text-2xl font-semibold text-[var(--pg-accent-fg)]">
        {agent.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase()}
      </span>
      <div className="min-w-0"><p className="font-[family-name:var(--pg-heading-font)] text-xl font-semibold">{agent.name}</p>{agent.title && <p className="text-sm text-[var(--pg-muted-fg)]">{agent.title}</p>}</div>
    </div>
    <div className="mt-6 grid gap-2">
      {agent.phone && contactLink("PHONE", agent.phone, AGENT_LINK, <><Phone className="size-4 text-[var(--pg-accent)]" aria-hidden="true" />{agent.phone}</>)}
      {agent.whatsapp && contactLink("WHATSAPP", agent.whatsapp, AGENT_LINK, <><MessageCircle className="size-4 text-[var(--pg-accent)]" aria-hidden="true" />WhatsApp {agent.whatsapp}</>)}
      {agent.email && contactLink("EMAIL", agent.email, AGENT_LINK, <><Mail className="size-4 text-[var(--pg-accent)]" aria-hidden="true" /><span className="truncate">{agent.email}</span></>)}
    </div>
  </div>;
}

function ContactBody({section, ctx}: {section: SectionOf<"CONTACT">; ctx: Ctx}) {
  const {props} = section;
  const items = contactItems(section, ctx.page.linked);
  const agent = contactAgent(section, ctx.page.linked);
  const center = section.variant === "cards" || section.layout.align === "CENTER";
  const head = <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
    <Eyebrow value={props.eyebrow} path="eyebrow" ctx={ctx} center={center} />
    <Heading value={props.heading} path="heading" ctx={ctx} center={center} />
    <Intro value={props.intro} path="intro" ctx={ctx} center={center} />
  </div>;
  const agentCard = agent && <div {...movable(ctx, "agent", "block")}><AgentCard agent={agent} /></div>;
  const button = props.cta && <div className={center ? "flex justify-center" : ""}><CtaButton cta={props.cta} ctx={ctx} path="cta" large /></div>;
  if (section.variant === "minimal") {
    return <div className="space-y-8">{head}
      <ul className={`flex flex-wrap gap-x-10 gap-y-4 ${center ? "justify-center" : ""}`}>{items.map(item => { const Icon = CONTACT_ICONS[item.kind]; return <li key={item.kind}>
        {link(item.kind, item.value, "flex items-center gap-2.5 text-base hover:text-[var(--pg-accent)]", <><Icon className="size-5 text-[var(--pg-accent)]" aria-hidden="true" />{item.value}</>)}
      </li>; })}</ul>
      {agentCard && <div className={center ? "mx-auto max-w-md" : "max-w-md"}>{agentCard}</div>}
      {button}
    </div>;
  }
  const cards = <ul className={`grid gap-4 ${section.variant === "split" ? "@3xl:grid-cols-2" : items.length >= 4 ? "@3xl:grid-cols-2 @5xl:grid-cols-4" : "@3xl:grid-cols-3"}`}>
    {items.map(item => { const Icon = CONTACT_ICONS[item.kind]; return <li key={item.kind}>
      {link(item.kind, item.value, "pg-card flex h-full flex-col gap-4 rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--pg-accent)]", <>
        <span className="flex size-11 items-center justify-center rounded-full bg-[var(--pg-muted)] text-[var(--pg-accent)]"><Icon className="size-5" aria-hidden="true" /></span>
        <span><span className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--pg-muted-fg)]">{item.label}</span><span className="mt-1 block break-words text-base font-medium">{item.value}</span></span>
      </>)}
    </li>; })}
  </ul>;
  if (section.variant === "split") {
    return <div className="grid gap-12 @5xl:grid-cols-[1.1fr_1fr] @5xl:items-start">
      <div className="space-y-8">{head}{cards}{button}</div>
      {agentCard ?? null}
    </div>;
  }
  return <div className="space-y-12">{head}{cards}{agentCard && <div className="mx-auto max-w-md">{agentCard}</div>}{button}</div>;
}

// --- Custom sections ---------------------------------------------------------------------

/**
 * The column grid of a row or inner section. Widths are whole percentages
 * validated by the registry, written as grid tracks in custom properties
 * (literal class names, so Tailwind generates them). Phones stack the
 * columns (optionally in reverse order) or keep them side by side; tablets
 * use the columns unless the row starts them at desktop width; layouts of
 * four or more equal columns use two columns on tablets.
 */
function columnGrid(container: {layout: ColumnLayout; widths: number[] | null; stackOnTablet: boolean; mobile: "STACK" | "KEEP"; reverseOnMobile: boolean; gap: "SM" | "MD" | "LG"}) {
  const widths = columnWidths(container);
  const template = widths.map(width => `minmax(0,${width}fr)`).join(" ");
  const tablet = !container.widths && widths.length >= 4 ? "repeat(2,minmax(0,1fr))" : template;
  const keep = container.mobile === "KEEP";
  const reverse = container.reverseOnMobile && !keep;
  const base = keep ? "grid grid-cols-[var(--pg-cols)]" : reverse ? `flex flex-col-reverse ${container.stackOnTablet ? "@5xl:grid" : "@3xl:grid"}` : "grid grid-cols-1";
  const larger = keep ? "" : container.stackOnTablet ? "@5xl:grid-cols-[var(--pg-cols)]" : "@3xl:grid-cols-[var(--pg-cols-t)] @5xl:grid-cols-[var(--pg-cols)]";
  return {className: `${base} ${larger} ${ROW_GAPS[container.gap]}`, style: {"--pg-cols": template, "--pg-cols-t": tablet} as CSSProperties};
}
const ROW_ITEMS = {STRETCH: "items-stretch", START: "items-start", CENTER: "items-center", END: "items-end"} as const;
const ROW_JUSTIFY = {STRETCH: "justify-start", START: "justify-start", CENTER: "justify-center", END: "justify-end"} as const;
const ROW_GAPS = {SM: "gap-4", MD: "gap-8", LG: "gap-10 @5xl:gap-16"} as const;
const JUSTIFY = {START: "justify-start", CENTER: "justify-center", END: "justify-end"} as const;
const TEXT_ALIGN = {START: "text-left", CENTER: "text-center", END: "text-right"} as const;
const ITEMS_ALIGN = {START: "items-start", CENTER: "items-center", END: "items-end"} as const;
const HEADING_SIZES = {SM: "text-2xl", MD: "text-3xl @3xl:text-4xl", LG: "text-4xl @3xl:text-5xl", XL: "text-5xl @3xl:text-7xl"} as const;
const TEXT_SIZES = {SM: "text-sm leading-6", MD: "text-base leading-7 @3xl:text-lg @3xl:leading-8", LG: "text-lg leading-8 @3xl:text-xl"} as const;
const RATIOS = {AUTO: "aspect-[4/3]", SQUARE: "aspect-square", PORTRAIT: "aspect-[4/5]", LANDSCAPE: "aspect-[3/2]", WIDE: "aspect-video"} as const;
const GALLERY_COLUMNS = {2: "grid-cols-2", 3: "grid-cols-2 @3xl:grid-cols-3", 4: "grid-cols-2 @3xl:grid-cols-4"} as const;

/** Inline px from a validated box (whole numbers within the registry limits). */
function boxPx(box: Box | null, property: "padding" | "margin") {
  if (!box) return {};
  const side = (value: number | null) => `${value ?? 0}px`;
  return {[property]: `${side(box.top)} ${side(box.right)} ${side(box.bottom)} ${side(box.left)}`};
}

function widgetFrameStyle(style: WidgetStyle) {
  return {...boxPx(style.padding, "padding"), ...boxPx(style.margin, "margin"), ...(style.color ? {color: style.color} : {})};
}

function WidgetBody({widget, path, ctx}: {widget: Widget; path: string; ctx: Ctx}) {
  const {linked} = ctx.page;
  const t = (key: string) => `${path}.props.${key}`;
  const align = widget.style.align;
  // Device visibility belongs to the widget frame; the text style changes only the widget's own text, image or button.
  const textStyle = widget.style.text ? {...widget.style.text, devices: {desktop: true, tablet: true, mobile: true}} : undefined;
  const look = (kind: ElementKind) => textStyle ? elementCss(textStyle, kind, ctx.mode === "editor") : undefined;
  switch (widget.type) {
    case "HEADING": {
      const Tag = widget.props.level === "H1" ? "h1" : widget.props.level === "H2" ? "h2" : widget.props.level === "H3" ? "h3" : "h4";
      return <div>
        {(widget.props.eyebrow || ctx.text) && <p className={`mb-3 flex items-center gap-3 text-xs font-semibold tracking-[0.28em] text-[var(--pg-accent)] [text-transform:var(--pg-eyebrow-case)] ${align === "CENTER" ? "justify-center" : align === "END" ? "justify-end" : ""}`}>
          <span aria-hidden="true" className="h-px w-8 bg-current" /><T value={widget.props.eyebrow} path={t("eyebrow")} ctx={ctx} placeholder="Label" move={false} /></p>}
        <Tag className={`font-[family-name:var(--pg-heading-font)] font-semibold leading-[1.08] tracking-[var(--pg-heading-tracking)] ${HEADING_SIZES[widget.props.size]}`}><T value={widget.props.text} path={t("text")} ctx={ctx} move={false} look={look("text")} /></Tag>
      </div>;
    }
    case "TEXT": return <p className={`whitespace-pre-line ${TEXT_SIZES[widget.props.size]} ${widget.props.muted ? "text-[var(--pg-muted-fg)]" : ""}`}><T value={widget.props.text} path={t("text")} ctx={ctx} multiline placeholder="Add text" move={false} look={look("text")} /></p>;
    case "IMAGE": {
      const image = resolveImage(widget.props.image, linked, 1280);
      if (!image) return <div className={`grid place-items-center rounded-[var(--pg-radius)] border border-dashed border-[var(--pg-border)] text-sm text-[var(--pg-muted-fg)] ${RATIOS[widget.props.ratio]}`}>Choose an image</div>;
      return <figure>
        <Img image={image} sizes="(min-width: 1024px) 50vw, 100vw" className={`${RATIOS[widget.props.ratio]} ${widget.props.rounded ? "rounded-[var(--pg-radius)]" : ""}`} look={look("image")} />
        {(widget.props.caption || ctx.text) && <figcaption className="mt-3 text-sm text-[var(--pg-muted-fg)]"><T value={widget.props.caption} path={t("caption")} ctx={ctx} placeholder="Add a caption" move={false} /></figcaption>}
      </figure>;
    }
    case "BUTTON": return <div className={`flex ${widget.props.full ? "[&>a]:w-full" : ""} ${JUSTIFY[align]}`}><CtaButton cta={widget.props.cta} ctx={ctx} path={t("cta")} secondary={widget.props.variant === "OUTLINE"} large look={look("button") ?? {style: {}, className: "", sizeClass: ""}} /></div>;
    case "ICON_LIST": return <ul className="space-y-3">{widget.props.items.map((item, index) => { const Icon = ICONS[item.icon]; return <li key={index} className={`flex items-center gap-3 ${JUSTIFY[align]}`}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--pg-muted)] text-[var(--pg-accent)]"><Icon className="size-4" aria-hidden="true" /></span>
      <span className="text-base"><T value={item.text} path={t(`items.${index}.text`)} ctx={ctx} move={false} look={look("text")} /></span>
    </li>; })}</ul>;
    case "ICON_BOX": {
      const Icon = ICONS[widget.props.icon];
      return <div className={`flex flex-col gap-4 ${ITEMS_ALIGN[align]} ${widget.props.boxed ? "h-full rounded-[var(--pg-radius)] border border-[var(--pg-border)] bg-[var(--pg-card)] p-7" : ""}`}>
        <span className="flex size-12 items-center justify-center rounded-full bg-[var(--pg-accent)] text-[var(--pg-accent-fg)]"><Icon className="size-5" aria-hidden="true" /></span>
        <p className="font-[family-name:var(--pg-heading-font)] text-xl font-semibold"><T value={widget.props.title} path={t("title")} ctx={ctx} move={false} look={look("text")} /></p>
        {(widget.props.text || ctx.text) && <p className="text-[var(--pg-muted-fg)]"><T value={widget.props.text} path={t("text")} ctx={ctx} multiline placeholder="Add text" move={false} /></p>}
      </div>;
    }
    case "COUNTER": {
      const value = statValue(widget.props, linked);
      const crm = widget.props.source !== "CUSTOM";
      return <div>
        {/* The widget's own text style (size, colour, font) applies to the value. */}
        <p className="font-[family-name:var(--pg-heading-font)] text-4xl font-semibold tracking-[var(--pg-heading-tracking)] text-[var(--pg-accent)] @3xl:text-5xl">{crm
          ? (() => { const own = look("text"); return own ? <span style={own.style} className={`${own.className} ${own.sizeClass}`.trim()}>{value ?? "–"}</span> : (value ?? "–"); })()
          : <T value={widget.props.value} path={t("value")} ctx={ctx} placeholder="Value" move={false} look={look("text")} />}</p>
        <p className="mt-2 text-sm uppercase tracking-[0.18em] text-[var(--pg-muted-fg)]"><T value={widget.props.label} path={t("label")} ctx={ctx} move={false} /></p>
      </div>;
    }
    case "VIDEO": {
      const video = resolveVideo(widget.props.video, linked);
      if (!video) return null;
      const poster = resolveImage(widget.props.poster, linked, 1280)?.url ?? video.poster ?? undefined;
      const ratio = widget.props.ratio === "SQUARE" ? "aspect-square" : widget.props.ratio === "WIDE" ? "aspect-[21/9]" : "aspect-video";
      return <div className="overflow-hidden rounded-[var(--pg-radius)] shadow-xl"><video className={`${ratio} w-full object-cover`} src={video.url} poster={poster} autoPlay muted loop playsInline preload="metadata" controls aria-label={video.title} /></div>;
    }
    case "SPACER": return <div aria-hidden="true" style={{height: widget.props.height}} />;
    case "DIVIDER": return <hr className={`border-[var(--pg-border)] ${widget.props.width === "SHORT" ? `w-20 border-t-2 border-[var(--pg-accent)] ${align === "CENTER" ? "mx-auto" : align === "END" ? "ml-auto" : ""}` : "w-full"}`} />;
    case "MAP": {
      const location = widgetLocation(widget, linked);
      return location ? <PageLocationMap location={location} showMap={widget.props.showMap} title={ctx.headline} /> : null;
    }
    case "FORM": {
      const panel = look("card");
      return <div style={panel?.style} className={panel?.className}>{ctx.page.form
        ? <PageEnquiryForm form={ctx.page.form} endpoint={ctx.mode === "public" ? ctx.publicContext?.enquiryEndpoint ?? null : null} submitLabel={widget.props.submitLabel} pageTitle={ctx.publicContext?.pageTitle ?? ctx.page.title} />
        : <SampleEnquiryForm submitLabel={widget.props.submitLabel} />}</div>;
    }
    case "CONTACT_CARD": {
      const agent = agentById(widget.props.agentId, linked);
      const company = linked.company;
      const items = widget.props.showCompany ? ([["PHONE", company.phone], ["WHATSAPP", company.whatsapp], ["EMAIL", company.email], ["ADDRESS", company.address ?? null], ["HOURS", company.hours ?? null]] as const)
        .flatMap(([kind, value]) => value ? [{kind, value}] : []) : [];
      return <div className="space-y-4">
        {agent && <AgentCard agent={agent} />}
        {items.length > 0 && <ul className="space-y-2.5">{items.map(item => { const Icon = CONTACT_ICONS[item.kind]; return <li key={item.kind}>
          {contactLink(item.kind, item.value, `flex items-center gap-3 text-base hover:text-[var(--pg-accent)] ${JUSTIFY[align]}`, <><Icon className="size-5 shrink-0 text-[var(--pg-accent)]" aria-hidden="true" /><span className="break-words">{item.value}</span></>)}
        </li>; })}</ul>}
      </div>;
    }
    case "INNER_SECTION": {
      const grid = columnGrid(widget.props);
      return <div className={grid.className} style={grid.style}>
        {widget.props.columns.map((column, index) => <ColumnView key={column.id} column={column} path={`${path}.props.columns.${index}`} ctx={ctx} inner />)}
      </div>;
    }
    case "GALLERY": {
      const images = resolveImages(widget.props.images, linked, 900);
      const zoom = widget.props.lightbox && !ctx.text && images.length > 0;
      return <>
        <ul className={`grid gap-3 ${GALLERY_COLUMNS[widget.props.columns]}`} aria-label="Image grid">{images.map((image, index) => <li key={`${image.id}-${index}`}>
          <Zoom on={zoom} group={widget.id} index={index} total={images.length} image={image}><Img image={image} sizes="(min-width: 1024px) 25vw, 50vw" className="aspect-square rounded-[var(--pg-radius)]" imgClassName="hover:scale-105" /></Zoom>
        </li>)}</ul>
        {zoom && <PageLightbox group={widget.id} images={lightboxImages(images)} />}
      </>;
    }
  }
}

/** One column of a row or inner section, with its widgets (widgets the public page cannot show are left out). */
function ColumnView({column, path, ctx, inner = false}: {column: CustomColumn | InnerColumn; path: string; ctx: Ctx; inner?: boolean}) {
  const editor = Boolean(ctx.text);
  const context = {hasForm: Boolean(ctx.page.form), today: ctx.page.linked.readAt.slice(0, 10), mode: ctx.mode === "editor" ? "editor" as const : "public" as const};
  const widgets = column.widgets.map((widget, index) => ({widget: widget as Widget, path: `${path}.widgets.${index}`, available: widgetAvailability(widget as Widget, ctx.page.linked, context)}))
    .filter(item => editor || item.available.ok);
  return <div className={`flex min-w-0 flex-col ${inner ? "gap-4" : "gap-6"} ${JUSTIFY[column.verticalAlign]} ${column.background ? "rounded-[var(--pg-radius)]" : ""}`}
    style={{...boxPx(column.padding, "padding"), ...(column.background ? {backgroundColor: column.background, color: readableOn(column.background)} : {})}}
    {...(editor ? {"data-column-path": path} : {})}>
    {widgets.map(({widget, path: widgetPath, available}) => <div key={widget.id} className={`relative ${TEXT_ALIGN[widget.style.align]} ${deviceClasses(widget.style.devices)} ${ANIMATION_CLASSES[widget.style.animation]}`}
      style={widgetFrameStyle(widget.style)} {...(editor ? {"data-widget-path": widgetPath, "data-widget-type": widget.type} : {})}>
      {editor && <span data-drag-widget={widgetPath} draggable title="Drag to move" aria-hidden="true"
        className="pg-drag-handle absolute -left-2 -top-2 z-20 hidden size-6 cursor-grab items-center justify-center rounded bg-sky-600 text-[11px] leading-none text-white shadow">⠿</span>}
      <WidgetBody widget={widget} path={widgetPath} ctx={ctx} />
      {editor && !available.ok && <p className="mt-2 rounded bg-amber-100 px-2 py-1 text-left text-[11px] font-medium text-amber-950">{WIDGET_DEFINITIONS[widget.type].label}: not shown publicly. {available.reason}</p>}
    </div>)}
    {editor && !widgets.length && <div className={`grid place-items-center rounded-[var(--pg-radius)] border border-dashed border-[var(--pg-border)] p-4 text-center text-sm text-[var(--pg-muted-fg)] ${inner ? "min-h-20" : "min-h-28"}`}>Drag a widget here</div>}
  </div>;
}

/** A row: a container (background, padding, corners, height, alignment) around a column grid. */
function RowView({row, path, ctx}: {row: CustomRow; path: string; ctx: Ctx}) {
  const editor = Boolean(ctx.text);
  const grid = columnGrid(row);
  const image = row.backgroundImage ? resolveImage(row.backgroundImage, ctx.page.linked, 1600) : null;
  const columns = <div className={`${grid.className} ${ROW_ITEMS[row.align]}`} style={grid.style} {...(editor ? {"data-row-path": path} : {})}>
    {row.columns.map((column, index) => <ColumnView key={column.id} column={column} path={`${path}.columns.${index}`} ctx={ctx} />)}
  </div>;
  const boxed = Boolean(row.background || image || row.padding || row.radius !== null || row.minHeight);
  if (!boxed) return columns;
  const color = row.background && !image ? readableOn(row.background) : image ? "#ffffff" : undefined;
  return <div className={`relative isolate flex flex-col overflow-hidden ${ROW_JUSTIFY[row.align]} ${row.padding ? "" : row.background || image ? "p-6 @3xl:p-10" : ""}`}
    style={{...boxPx(row.padding, "padding"), ...(row.background ? {backgroundColor: row.background} : {}), ...(color ? {color} : {}), ...(row.radius !== null ? {borderRadius: row.radius} : {}), ...(row.minHeight ? {minHeight: row.minHeight} : {})}}>
    {image && <img src={image.url} srcSet={image.srcSet ?? undefined} sizes="100vw" alt="" loading="lazy" aria-hidden="true" className="absolute inset-0 -z-20 h-full w-full object-cover" />}
    {image && row.overlay > 0 && <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black" style={{opacity: row.overlay / 100}} />}
    {columns}
  </div>;
}

function RowsView({rows, prefix, ctx}: {rows: CustomRow[]; prefix: string; ctx: Ctx}) {
  return <div className="space-y-12 @3xl:space-y-16">{rows.map((row, index) => <RowView key={row.id} row={row} path={`${prefix}.${index}`} ctx={ctx} />)}</div>;
}

function CustomBody({section, ctx}: {section: SectionOf<"CUSTOM">; ctx: Ctx}) {
  return <RowsView rows={section.props.rows} prefix="rows" ctx={ctx} />;
}

/** A built-in section's body with the rows added before or after its own content. */
function SectionContent({section, ctx}: {section: PageSection; ctx: Ctx}) {
  const extra = section.extra && section.type !== "CUSTOM" ? section.extra : null;
  if (!extra) return <SectionBody section={section} ctx={ctx} />;
  const rows = <div className={extra.position === "BEFORE" ? "mb-12 @3xl:mb-16" : "mt-12 @3xl:mt-16"} data-section-extra={ctx.text ? extra.position : undefined}><RowsView rows={extra.rows} prefix="extra.rows" ctx={ctx} /></div>;
  return extra.position === "BEFORE" ? <>{rows}<SectionBody section={section} ctx={ctx} /></> : <><SectionBody section={section} ctx={ctx} />{rows}</>;
}

function SectionShell({section, ctx, children}: {section: PageSection; ctx: Ctx; children: ReactNode}) {
  const {theme} = ctx.page.data;
  const style = withStyleDefaults(section.style);
  // A hero without its own background photo uses its image, except "Showcase with image", which frames that image instead.
  const image = style.backgroundType === "IMAGE" ? resolveImage(style.backgroundImage ?? (section.type === "HERO" && section.variant !== "showcaseImage" ? section.props.image : null), ctx.page.linked, 1920) : null;
  const video = style.backgroundType === "VIDEO" ? resolveVideo(style.backgroundVideo, ctx.page.linked) : null;
  const media = Boolean(image || video);
  const navbar = section.type === "NAVBAR";
  const overlayNav = navbar && section.variant === "transparent";
  // Floating: sticky over the hero (which slides under it) and solid once the page scrolls (page-looks.css).
  const floatingNav = navbar && section.variant === "floating";
  // A chosen content position replaces the height preset's centring.
  const heightClass = style.contentVertical === "AUTO" ? HEIGHT_CLASSES[style.height] : `${HEIGHT_CLASSES[style.height].replace(/ ?flex flex-col justify-center/, "")} ${CONTENT_VERTICAL_CLASSES[style.contentVertical]}`;
  const box = boxLayout(style, section.layout.spacing);
  const className = navbar
    ? `${overlayNav ? "absolute inset-x-0 top-0 z-30 text-white" : floatingNav ? "pg-nav-floating sticky top-0 z-30 -mb-16 border-b border-transparent text-white @3xl:-mb-20" : `${section.props.sticky ? "sticky top-0" : "relative"} z-30 border-b border-[var(--pg-border)] bg-[var(--pg-bg)]/85 backdrop-blur-xl`} ${box.className} ${deviceClasses(section.devices)}`
    : `relative isolate overflow-hidden scroll-mt-20 ${box.padding ? "" : spacingClasses(section.layout.spacing, style.spacingTablet, style.spacingMobile)} ${box.className} ${heightClass} ${deviceClasses(section.devices)}`;
  const sectionStyle = {...sectionBackgroundStyle(section.layout.background, theme, style), ...box.vars};
  const inner = <div className={`pg-inner ${WIDTH_CLASSES[navbar ? "WIDE" : style.width]} ${navbar ? "" : ANIMATION_CLASSES[style.animation]} ${section.type === "HERO" && style.height === "SCREEN" ? "pt-16" : ""}`} style={offsetStyle(style.contentOffset)}>{children}</div>;
  return <section id={anchorFor(section)} aria-label={section.type === "HERO" ? undefined : SECTION_DEFINITIONS[section.type].label} data-section-id={section.id} data-section-type={section.type} data-section-variant={section.variant} data-section-bg={media ? "media" : style.backgroundType === "COLOR" && style.backgroundColor ? "color" : section.layout.background} data-pg-spacing={box.padding ? "custom" : section.layout.spacing} className={`pg-section ${className}`} style={sectionStyle}>
    {image && <div aria-hidden="true" className="absolute inset-0 -z-20"><img src={image.url} srcSet={image.srcSet ?? undefined} sizes="100vw" alt="" loading={section.type === "HERO" ? "eager" : "lazy"} fetchPriority={section.type === "HERO" ? "high" : "auto"} className={`h-full w-full object-cover ${section.type === "HERO" ? "pg-ken-burns" : ""}`} /></div>}
    {video && <video aria-hidden="true" className="absolute inset-0 -z-20 h-full w-full object-cover" src={video.url} poster={video.poster ?? undefined} autoPlay muted loop playsInline preload="auto" />}
    {media && <div aria-hidden="true" className="absolute inset-0 -z-10" style={overlayStyle(style, theme)} />}
    {inner}
  </section>;
}

export function PageRenderer({page, mode, today, publicContext, edit, hideNotice = false}: RendererProps) {
  const {data, linked} = page;
  const hasForm = Boolean(page.form);
  const context = {hasForm, today, mode: mode === "editor" ? "editor" as const : "public" as const};
  const hero = data.sections.find(section => section.type === "HERO" && section.visible);
  const headline = hero?.type === "HERO" ? hero.props.headline : page.title;
  const footer = data.sections.find((section): section is SectionOf<"FOOTER"> => section.type === "FOOTER") ?? null;
  const availability = new Map(data.sections.map(section => [section.id, sectionAvailability(section, linked, context)]));
  const anchors = data.sections.flatMap(section => {
    const label = NAV_LABELS[section.type];
    return label && section.visible && availability.get(section.id)?.ok ? [{href: `#${anchorFor(section)}`, label}] : [];
  }).filter((anchor, index, list) => list.findIndex(item => item.label === anchor.label) === index);
  const sectionLinks = Object.fromEntries(data.sections.flatMap(section => section.visible && section.type !== "NAVBAR" && section.type !== "FOOTER" && availability.get(section.id)?.ok ? [[section.id, `#${anchorFor(section)}`]] : []));
  const baseCtx = {page, mode, hasForm, publicContext, headline, anchors, sectionLinks};
  return <div id="top" className="pg-root @container relative min-h-full antialiased" style={pageThemeStyle(data.theme)} data-page-mode={mode} data-pg-look={pageLook(data.theme)}>
    {mode !== "public" && !hideNotice && <p role="note" className="relative z-40 bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-950">Internal preview – not approved for public advertising. Linked data as recorded on {dubaiDate(linked.readAt)}.</p>}
    <main className="relative">
      {!hero && <h1 className="sr-only">{page.title}</h1>}
      {data.sections.map(section => {
        if (section.type === "FOOTER") return null;
        const available = availability.get(section.id)!;
        const ctx: Ctx = {...baseCtx, text: edit ? (path, value) => edit.onText(section.id, path, value) : undefined, offsets: section.style.elementOffsets, styles: section.style.elementStyles, order: section.style.elementOrder};
        if (mode !== "editor" && (!section.visible || !available.ok)) return null;
        // The editor shows an enquiry form section with a sample form until a lead form is connected.
        const sampleForm = mode === "editor" && section.visible && ((section.type === "ENQUIRY_FORM" && !hasForm) || section.type === "CUSTOM");
        if (mode === "editor" && (!section.visible || !available.ok) && !sampleForm) {
          const placeholder = <div className="border-y border-dashed border-[var(--pg-border)] bg-[var(--pg-muted)] px-6 py-5 text-sm text-[var(--pg-muted-fg)]" data-section-id={section.id}>
            <span className="font-semibold text-[var(--pg-fg)]">{SECTION_DEFINITIONS[section.type].label}</span> – {!section.visible ? "hidden" : `not shown publicly: ${available.ok ? "" : available.reason}`}
          </div>;
          return edit ? <div key={section.id}>{edit.wrapSection(section, placeholder, {available: false, reason: !section.visible ? "Hidden" : available.ok ? null : available.reason})}</div> : <div key={section.id}>{placeholder}</div>;
        }
        const element = <SectionShell section={section} ctx={ctx}><SectionContent section={section} ctx={ctx} /></SectionShell>;
        return edit ? <div key={section.id} className="contents">{edit.wrapSection(section, element, {available: true, reason: null})}</div> : <div key={section.id} className="contents">{element}</div>;
      })}
    </main>
    {(() => {
      const ctx: Ctx = {...baseCtx, text: edit && footer ? (path, value) => edit.onText(footer.id, path, value) : undefined, offsets: footer?.style.elementOffsets, styles: footer?.style.elementStyles, order: footer?.style.elementOrder};
      const element = <ComplianceFooter page={page} footer={footer} anchors={anchors} ctx={ctx} />;
      return edit && footer ? edit.wrapSection(footer, element, {available: true, reason: null}) : element;
    })()}
  </div>;
}
