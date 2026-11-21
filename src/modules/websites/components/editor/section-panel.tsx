"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CopyPlus, Database, Monitor, Plus, Shapes, Smartphone, Tablet, Trash2 } from "lucide-react";
import { canDeleteElement, canDuplicateElement, deleteElement, duplicateElement, withOwnFacts } from "../../element-ops";
import { convertBlocker } from "../../convert";
import { SourcePicker } from "@/modules/ai/content/components/source-picker";
import { sectionAvailability, statValue, type LinkedData } from "../../linked";
import { STOCK_IMAGES } from "../../stock";
import {
  acceptsExtra, ALIGNMENTS, ANIMATIONS, BACKGROUNDS, CONTENT_VERTICALS, MAX_BOX, MAX_OFFSET, BACKGROUND_TYPES, COUNTDOWN_TARGETS, CTA_ACTIONS, CTA_ACTION_LABELS, DEVICE_SPACINGS, HEIGHTS, HIGHLIGHT_ICONS, LANDMARK_CATEGORIES,
  OVERLAY_TONES, SECTION_DEFINITIONS, SPACINGS, STAT_SOURCES, STAT_SOURCE_LABELS, TEXT_TONES, WIDTHS,
  DEFAULT_ELEMENT_STYLE, VARIANT_LABELS, isDefaultElementStyle, withStyleDefaults, type Box, type Cta, type ElementStyle, type CustomLocation, type DeviceBox, type ImageRef, type Offset, type PageSection, type SectionStyle, type SectionType, type StatSource, type VideoRef, HERO_DEFAULT_FACTS,
} from "../../registry";
import { boxValue, presetPaddingPx, type ElementKind } from "../../theme";
import { BoxControl, ColorControl, Field, OffsetControl, Group, SelectControl, Segmented, Slider, TextControl, Toggle, humanize, inputClass, textareaClass } from "./controls";
import { AgentControl, ContactDetailsControl, LeadFormControl } from "./connections";
import { StructureControl, WidgetPanel } from "./custom-panel";
import { useEditorServices } from "./editor-context";
import { ElementPanel, ELEMENT_KIND_LABELS, type ElementText } from "./element-panel";
import { LocationControl } from "./location-control";
import { ImagePicker, VideoPicker } from "./media-picker";

/*
 * The section settings panel (Elementor-style Content / Style / Advanced).
 * Every control maps to a registry field with the same limits; nothing here
 * accepts HTML, CSS, URLs or code. CRM values are labelled "From CRM" and
 * change only in the CRM.
 */

export type Spec =
  | {key: string; label: string; kind: "text" | "textarea"; max: number; hint?: string}
  | {key: string; label: string; kind: "dropdown"; options: readonly string[]; labels?: Record<string, string>}
  | {key: string; label: string; kind: "number"; min: number; max: number; unit?: string}
  | {key: string; label: string; kind: "toggle"; hint?: string}
  | {key: string; label: string; kind: "select"; options: readonly string[]; labels?: Record<string, string>}
  | {key: string; label: string; kind: "cta" | "ctaOptional" | "image" | "images" | "video" | "highlights" | "faq" | "landmarks" | "testimonials" | "listings" | "columns" | "stats" | "heroFacts" | "strings" | "leadForm" | "contactDetails" | "agent" | "location" | "iconItems" | "videoRequired" | "navLinks"; hint?: string; max?: number};

export const t = (key: string, label: string, max: number, hint?: string): Spec => ({key, label, kind: "text", max, hint});
export const ta = (key: string, label: string, max: number, hint?: string): Spec => ({key, label, kind: "textarea", max, hint});
const heading = t("heading", "Heading", 120);
const eyebrow = t("eyebrow", "Eyebrow", 60, "The small label above the heading.");
const intro = ta("intro", "Introduction", 400);

export const FIELD_SPECS: Record<SectionType, Spec[]> = {
  NAVBAR: [{key: "logo", label: "Logo", kind: "image", hint: "Upload your logo (PNG or WebP with a transparent background works best). Without a logo the brand name is shown."},
    {key: "logoHeight", label: "Logo height", kind: "number", min: 20, max: 96, unit: " px"}, t("brandText", "Brand name", 80, "Leave empty to use the company name."),
    {key: "showLinks", label: "Show menu links", kind: "toggle"}, {key: "links", label: "Menu links", kind: "navLinks", hint: "Choose the sections the menu links to. Leave empty to list the main sections automatically."},
    {key: "linksAlign", label: "Menu position", kind: "select", options: ["LEFT", "CENTER", "RIGHT"]}, {key: "cta", label: "Button", kind: "ctaOptional"},
    {key: "showPhone", label: "Show the company phone", kind: "toggle", hint: "The approved company phone, beside the button."},
    {key: "mobileMenu", label: "Menu button on phones and tablets", kind: "toggle", hint: "Opens the links, phone and button on small screens."},
    {key: "sticky", label: "Stick to the top (solid style)", kind: "toggle"}],
  HERO: [t("badge", "Badge", 40), eyebrow, t("headline", "Headline", 120), ta("subheadline", "Subheadline", 300), {key: "primaryCta", label: "Main button", kind: "cta"},
    {key: "secondaryCta", label: "Second button", kind: "ctaOptional"}, {key: "image", label: "Image (split and centred layouts)", kind: "image", hint: "Full-screen heroes use the background in the Style tab."},
    {key: "showFacts", label: "Show key facts", kind: "toggle", hint: "Price, bedrooms, payment plan and handover when recorded, or your own facts below."}, {key: "facts", label: "Key facts", kind: "heroFacts"}, {key: "showPrice", label: "Show the recorded price", kind: "toggle"}, {key: "showLocation", label: "Show the location", kind: "toggle"}],
  STATS: [t("heading", "Heading", 120), {key: "items", label: "Facts", kind: "stats", hint: "CRM facts are filled in from the records; custom items show your own text."}],
  PROJECT_OVERVIEW: [eyebrow, heading, ta("body", "Text", 2000, "Leave empty to use the description recorded on the project."), {key: "image", label: "Image", kind: "image"}, {key: "showFacts", label: "Show key facts from the CRM", kind: "toggle"}],
  FEATURE_SPLIT: [eyebrow, heading, ta("body", "Text", 1200), {key: "bullets", label: "Bullet points", kind: "strings", max: 6}, {key: "image", label: "Image", kind: "image"},
    {key: "imageSide", label: "Image side", kind: "select", options: ["LEFT", "RIGHT"]}, {key: "cta", label: "Button", kind: "ctaOptional"}],
  DEVELOPER: [t("heading", "Label", 120), ta("body", "Text", 1000, "Leave empty to use the developer profile recorded in the CRM.")],
  HIGHLIGHTS: [eyebrow, heading, intro, {key: "columns", label: "Columns on desktop", kind: "columns"}, {key: "items", label: "Highlights", kind: "highlights"}],
  GALLERY: [eyebrow, t("heading", "Heading", 120), ta("intro", "Introduction", 300), {key: "columns", label: "Columns (grid layout)", kind: "columns"}, {key: "images", label: "Photos", kind: "images", hint: "Choose none to show all approved project photos."},
    {key: "lightbox", label: "Open photos full screen", kind: "toggle", hint: "Visitors click a photo to see it large, with next and previous (arrow keys and swiping work too)."}],
  VIDEO_SHOWCASE: [eyebrow, t("heading", "Heading", 120), ta("body", "Text", 600), {key: "video", label: "Video", kind: "video"}, {key: "poster", label: "Poster image", kind: "image"}],
  UNIT_TYPES: [heading, intro],
  PRICING: [heading, intro, ta("note", "Price note", 300)],
  PAYMENT_PLANS: [eyebrow, heading, intro],
  FLOOR_PLANS: [heading, intro],
  AMENITIES: [eyebrow, heading, intro, {key: "columns", label: "Columns on desktop", kind: "columns"}],
  LOCATION: [{key: "custom", label: "Location", kind: "location"}, eyebrow, heading, ta("body", "Text", 800), {key: "showMap", label: "Offer an interactive map (loads only when a visitor asks)", kind: "toggle"}],
  LANDMARKS: [heading, intro, {key: "items", label: "Nearby places", kind: "landmarks", hint: "Only places your team has checked. Distances and travel times are not supported."}, {key: "verified", label: "Verified by our team", kind: "toggle"}],
  COMPARISON: [heading, intro, {key: "listingIds", label: "Listings to compare", kind: "listings", hint: "Choose 2–4 published listings. They appear after you save."}],
  BANNER: [eyebrow, t("heading", "Heading", 160), ta("body", "Text", 400), {key: "cta", label: "Button", kind: "ctaOptional"}, {key: "secondaryCta", label: "Second button", kind: "ctaOptional"}],
  ENQUIRY_FORM: [{key: "form", label: "Lead form", kind: "leadForm"}, heading, intro, t("submitLabel", "Button label", 40), {key: "points", label: "Benefits", kind: "strings", max: 4}, {key: "image", label: "Image (image layout)", kind: "image"}],
  WHATSAPP_CTA: [heading, ta("body", "Text", 300), t("buttonLabel", "Button label", 40), ta("prefilledMessage", "Pre-filled message", 300)],
  CALL_CTA: [heading, ta("body", "Text", 300), t("buttonLabel", "Button label", 40)],
  CONTACT: [eyebrow, heading, intro, {key: "contacts", label: "Company contacts", kind: "contactDetails"}, {key: "agentId", label: "Agent", kind: "agent"}, {key: "cta", label: "Button", kind: "ctaOptional"}],
  TESTIMONIALS: [heading, {key: "items", label: "Testimonials", kind: "testimonials", hint: "Only genuine quotes you have permission to publish. Claude never writes testimonials."}, {key: "consentConfirmed", label: "Consent confirmed", kind: "toggle"}],
  FAQ: [heading, {key: "items", label: "Questions", kind: "faq"}],
  CUSTOM: [],
  COUNTDOWN: [heading, ta("body", "Text", 300), {key: "target", label: "Count down to", kind: "select", options: COUNTDOWN_TARGETS, labels: {LAUNCH_DATE: "Recorded launch date", HANDOVER_DATE: "Recorded handover date"}}],
  FOOTER: [ta("disclaimer", "Disclaimer", 1000, "Leave empty to use the disclaimer in your brand settings."), {key: "showContacts", label: "Show approved contact details", kind: "toggle"}],
};

function CtaControl({label, value, onChange, optional, linked}: {label: string; value: Cta | null; onChange: (value: Cta | null) => void; optional?: boolean; linked: LinkedData}) {
  if (!value) return <Field label={label}><button type="button" onClick={() => onChange({label: "Enquire now", action: "ENQUIRE"})} className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-white/20 px-3 py-1.5 text-xs text-zinc-300 hover:border-sky-400 hover:text-white"><Plus className="size-3.5" aria-hidden="true" />Add button</button></Field>;
  const unavailable = (value.action === "WHATSAPP" && !linked.company.whatsapp) || (value.action === "CALL" && !linked.company.phone) || (value.action === "EMAIL" && !linked.company.email);
  return <Field label={label} aside={optional ? <button type="button" onClick={() => onChange(null)} className="text-[11px] text-zinc-400 hover:text-white">Remove</button> : null}>
    <div className="space-y-2 rounded-md border border-white/10 p-2">
      <input value={value.label} maxLength={40} aria-label={`${label} text`} onChange={event => onChange({...value, label: event.target.value})} className={inputClass} />
      <select value={value.action} aria-label={`${label} action`} onChange={event => onChange({...value, action: event.target.value as Cta["action"]})} className={`${inputClass} [&>option]:bg-zinc-900`}>
        {CTA_ACTIONS.map(action => <option key={action} value={action}>{CTA_ACTION_LABELS[action]}</option>)}
      </select>
      {unavailable && <p className="text-[11px] text-amber-300">No approved contact for this action, so the button is hidden. Approve it in the brand settings.</p>}
    </div>
  </Field>;
}

function ListControl<T>({label, items, max, create, render, onChange, hint, noun}: {label: string; items: T[]; max: number; create: () => T; render: (item: T, update: (item: T) => void) => ReactNode; onChange: (items: T[]) => void; hint?: string; noun: string}) {
  const move = (index: number, delta: number) => { const next = [...items]; const [item] = next.splice(index, 1); next.splice(index + delta, 0, item); onChange(next); };
  return <Field label={label} hint={hint}>
    <ol className="space-y-2">{items.map((item, index) => <li key={index} className="space-y-2 rounded-md border border-white/10 bg-white/[0.03] p-2">
      {render(item, updated => onChange(items.map((current, position) => position === index ? updated : current)))}
      <div className="flex justify-end gap-0.5">
        <button type="button" aria-label={`Move ${noun} ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)} className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
        <button type="button" aria-label={`Move ${noun} ${index + 1} down`} disabled={index === items.length - 1} onClick={() => move(index, 1)} className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
        <button type="button" aria-label={`Remove ${noun} ${index + 1}`} onClick={() => onChange(items.filter((_, position) => position !== index))} className="rounded p-1 text-zinc-400 hover:bg-red-500/20 hover:text-red-300"><Trash2 className="size-3.5" /></button>
      </div>
    </li>)}</ol>
    {items.length < max && <button type="button" onClick={() => onChange([...items, create()])} className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-white/20 px-3 py-1.5 text-xs text-zinc-300 hover:border-sky-400 hover:text-white"><Plus className="size-3.5" aria-hidden="true" />Add {noun}</button>}
  </Field>;
}

const mini = `${inputClass} h-8 text-xs`;

export function ContentField({spec, section, linked, onProps}: {spec: Spec; section: {props: unknown}; linked: LinkedData; onProps: (props: Record<string, unknown>) => void}) {
  const props = section.props as Record<string, unknown>;
  const set = (value: unknown) => onProps({...props, [spec.key]: value});
  const value = props[spec.key];
  switch (spec.kind) {
    case "text": case "textarea": return <TextControl label={spec.label} value={String(value ?? "")} max={spec.max} multiline={spec.kind === "textarea"} onChange={set} hint={spec.hint} />;
    case "toggle": return <Toggle label={spec.label} checked={Boolean(value)} onChange={set} hint={spec.hint} />;
    case "select": return <Segmented label={spec.label} value={String(value)} options={spec.options} onChange={set} labels={spec.labels} />;
    case "columns": return <Segmented label={spec.label} value={String(value)} options={["2", "3", "4"]} onChange={next => set(Number(next))} />;
    case "cta": return <CtaControl label={spec.label} value={value as Cta} onChange={next => set(next ?? {label: "Enquire now", action: "ENQUIRE"})} linked={linked} />;
    case "ctaOptional": return <CtaControl label={spec.label} value={(value as Cta | null) ?? null} onChange={set} optional linked={linked} />;
    case "image": return <ImagePicker label={spec.label} value={(value as ImageRef | null) ?? null} onChange={set} linked={linked} hint={spec.hint} />;
    case "video": return <VideoPicker label={spec.label} value={(value as VideoRef | null) ?? null} onChange={set} />;
    case "images": {
      const images = (value as ImageRef[]) ?? [];
      return <ListControl label={spec.label} hint={spec.hint} noun="photo" items={images} max={24} onChange={set} create={() => { const used = new Set(images.flatMap(image => "stockId" in image ? [image.stockId] : [])); return {stockId: (STOCK_IMAGES.find(item => !used.has(item.id)) ?? STOCK_IMAGES[0]).id, alt: ""} as ImageRef; }}
        render={(item, update) => <ImagePicker label="Photo" value={item} onChange={next => next && update(next)} linked={linked} allowNone={false} />} />;
    }
    case "strings": return <ListControl label={spec.label} noun="item" items={(value as string[]) ?? []} max={spec.max ?? 6} onChange={set} create={() => "New point"}
      render={(item, update) => <input value={item} maxLength={120} aria-label="Text" onChange={event => update(event.target.value)} className={mini} />} />;
    case "heroFacts": {
      // Null shows the automatic four; customising copies them into a list to add to, remove from, reorder and edit.
      const list = value as Array<{source: StatSource; value: string; label: string}> | null;
      if (!list) return <div className="space-y-2" data-testid="hero-facts-auto">
        <p className="text-[13px] font-medium text-zinc-200">{spec.label}</p>
        <p className="text-[11px] leading-4 text-zinc-500">Automatic: starting price, bedrooms, payment plan and handover, when recorded.</p>
        <button type="button" onClick={() => set(HERO_DEFAULT_FACTS.map(fact => ({...fact})))} className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-xs text-zinc-200 hover:border-sky-400"><Plus className="size-3.5" aria-hidden="true" />Customise the facts (add, remove, reorder)</button>
      </div>;
      return <div className="space-y-2">
        <ContentField spec={{key: spec.key, label: spec.label, kind: "stats", hint: "CRM facts are filled in from the records; custom facts show your own text. Up to six."}} section={section} linked={linked} onProps={onProps} />
        <button type="button" onClick={() => set(null)} className="text-[11px] text-zinc-400 underline-offset-2 hover:text-white hover:underline">Back to the automatic facts</button>
      </div>;
    }
    case "stats": return <ListControl label={spec.label} hint={spec.hint} noun="fact" items={(value as Array<{source: StatSource; value: string; label: string}>) ?? []} max={6} onChange={set}
      create={() => ({source: "STARTING_PRICE" as StatSource, value: "", label: "Starting price"})}
      render={(item, update) => {
        const resolved = item.source === "CUSTOM" ? null : statValue(item, linked);
        return <>
          <select value={item.source} aria-label="Fact" onChange={event => update({...item, source: event.target.value as StatSource})} className={`${mini} [&>option]:bg-zinc-900`}>{STAT_SOURCES.map(source => <option key={source} value={source}>{STAT_SOURCE_LABELS[source]}</option>)}</select>
          {/* Always a value field: a CRM value shows as its placeholder; typing makes it the fact's own text. */}
          <input value={item.source === "CUSTOM" ? item.value : ""} maxLength={40} aria-label="Value" placeholder={resolved ?? "Type a value"} onChange={event => update({...item, source: "CUSTOM", value: event.target.value})} className={mini} />
          {item.source !== "CUSTOM" && <p className={`flex items-center gap-1.5 text-[11px] ${resolved ? "text-sky-300" : "text-amber-300"}`}><Database className="size-3" aria-hidden="true" />{resolved ? `From CRM: ${resolved}. Typing replaces it.` : "Not recorded in the CRM, so hidden. Type a value to show your own."}</p>}
          <input value={item.label} maxLength={60} aria-label="Label" placeholder="Label" onChange={event => update({...item, label: event.target.value})} className={mini} />
        </>;
      }} />;
    case "highlights": return <ListControl label={spec.label} noun="highlight" items={(value as Array<{title: string; text: string; icon: string}>) ?? []} max={8} onChange={set} create={() => ({title: "New highlight", text: "", icon: "STAR"})}
      render={(item, update) => <>
        <input value={item.title} maxLength={60} aria-label="Title" onChange={event => update({...item, title: event.target.value})} className={mini} />
        <textarea value={item.text} maxLength={200} aria-label="Text" onChange={event => update({...item, text: event.target.value})} className={`${textareaClass} min-h-14 text-xs`} />
        <select value={item.icon} aria-label="Icon" onChange={event => update({...item, icon: event.target.value})} className={`${mini} [&>option]:bg-zinc-900`}>{HIGHLIGHT_ICONS.map(icon => <option key={icon} value={icon}>{humanize(icon)}</option>)}</select>
      </>} />;
    case "faq": return <ListControl label={spec.label} noun="question" items={(value as Array<{question: string; answer: string}>) ?? []} max={12} onChange={set} create={() => ({question: "New question", answer: "Answer"})}
      render={(item, update) => <>
        <input value={item.question} maxLength={200} aria-label="Question" onChange={event => update({...item, question: event.target.value})} className={mini} />
        <textarea value={item.answer} maxLength={1000} aria-label="Answer" onChange={event => update({...item, answer: event.target.value})} className={`${textareaClass} min-h-16 text-xs`} />
      </>} />;
    case "landmarks": return <ListControl label={spec.label} hint={spec.hint} noun="place" items={(value as Array<{name: string; category: string; note: string}>) ?? []} max={12} onChange={set} create={() => ({name: "Place name", category: "OTHER", note: ""})}
      render={(item, update) => <>
        <input value={item.name} maxLength={80} aria-label="Name" onChange={event => update({...item, name: event.target.value})} className={mini} />
        <select value={item.category} aria-label="Category" onChange={event => update({...item, category: event.target.value})} className={`${mini} [&>option]:bg-zinc-900`}>{LANDMARK_CATEGORIES.map(category => <option key={category} value={category}>{humanize(category)}</option>)}</select>
        <input value={item.note} maxLength={120} aria-label="Note" placeholder="Optional note" onChange={event => update({...item, note: event.target.value})} className={mini} />
      </>} />;
    case "testimonials": return <ListControl label={spec.label} hint={spec.hint} noun="testimonial" items={(value as Array<{quote: string; author: string; context: string}>) ?? []} max={6} onChange={set} create={() => ({quote: "Quote", author: "Client name", context: ""})}
      render={(item, update) => <>
        <textarea value={item.quote} maxLength={500} aria-label="Quote" onChange={event => update({...item, quote: event.target.value})} className={`${textareaClass} min-h-16 text-xs`} />
        <input value={item.author} maxLength={80} aria-label="Author" onChange={event => update({...item, author: event.target.value})} className={mini} />
        <input value={item.context} maxLength={80} aria-label="Context" placeholder="For example: Buyer, 2026" onChange={event => update({...item, context: event.target.value})} className={mini} />
      </>} />;
    case "leadForm": return <LeadFormControl />;
    case "contactDetails": return <ContactDetailsControl props={props} onProps={onProps} />;
    case "dropdown": return <SelectControl label={spec.label} value={String(value)} options={spec.options} labels={spec.labels} onChange={set} />;
    case "number": return <Slider label={spec.label} value={Number(value)} min={spec.min} max={spec.max} unit={spec.unit} onChange={set} />;
    case "videoRequired": return <VideoPicker label={spec.label} value={(value as VideoRef | null) ?? null} onChange={next => next && set(next)} allowNone={false} />;
    case "iconItems": return <ListControl label={spec.label} noun="point" items={(value as Array<{text: string; icon: string}>) ?? []} max={12} onChange={set} create={() => ({text: "New point", icon: "STAR"})}
      render={(item, update) => <>
        <input value={item.text} maxLength={160} aria-label="Text" onChange={event => update({...item, text: event.target.value})} className={mini} />
        <select value={item.icon} aria-label="Icon" onChange={event => update({...item, icon: event.target.value})} className={`${mini} [&>option]:bg-zinc-900`}>{HIGHLIGHT_ICONS.map(icon => <option key={icon} value={icon}>{humanize(icon)}</option>)}</select>
      </>} />;
    case "location": return <LocationControl value={(value as CustomLocation | null) ?? null} onChange={set} />;
    case "agent": return <AgentControl value={(value as string | null) ?? null} onChange={set} />;
    case "navLinks": return <NavLinksControl label={spec.label} hint={spec.hint} value={(value as Array<{label: string; sectionId: string}>) ?? []} onChange={set} />;
    case "listings": {
      const ids = (value as string[]) ?? [];
      const titles = new Map(linked.comparison.map(listing => [listing.id, listing.title]));
      return <div className="rounded-md bg-white p-2 text-zinc-900"><SourcePicker kind="listing" max={4} label={spec.label} hint={spec.hint}
        selected={ids.map(listingId => ({id: listingId, label: titles.get(listingId) ?? "Selected listing", detail: titles.has(listingId) ? null : "Shown after saving if you can access it"}))}
        onChange={options => set(options.map(option => option.id))} /></div>;
    }
  }
}

/** Menu links to sections of the current page (the label is the visitor's text; the target is a section ID). */
function NavLinksControl({label, hint, value, onChange}: {label: string; hint?: string; value: Array<{label: string; sectionId: string}>; onChange: (value: Array<{label: string; sectionId: string}>) => void}) {
  const {pageSections} = useEditorServices();
  const targets = pageSections().filter(section => section.type !== "NAVBAR" && section.type !== "FOOTER");
  const name = (id: string) => { const section = targets.find(item => item.id === id); return section ? SECTION_DEFINITIONS[section.type].label : "Removed section"; };
  return <ListControl label={label} hint={hint} noun="link" items={value} max={8} onChange={onChange}
    create={() => { const target = targets.find(section => !value.some(link => link.sectionId === section.id)) ?? targets[0]; return {label: target ? SECTION_DEFINITIONS[target.type].label : "Link", sectionId: target?.id ?? "section"}; }}
    render={(item, update) => <>
      <input value={item.label} maxLength={40} aria-label="Link text" onChange={event => update({...item, label: event.target.value})} className={mini} />
      <select value={item.sectionId} aria-label="Links to" onChange={event => update({...item, sectionId: event.target.value})} className={`${mini} [&>option]:bg-zinc-900`}>
        {!targets.some(section => section.id === item.sectionId) && <option value={item.sectionId}>{name(item.sectionId)}</option>}
        {targets.map(section => <option key={section.id} value={section.id}>{SECTION_DEFINITIONS[section.type].label} ({section.id})</option>)}
      </select>
    </>} />;
}

export type Device = "desktop" | "tablet" | "mobile";

const ELEMENT_NAMES: Record<string, string> = {primaryCta: "Primary button", secondaryCta: "Secondary button", cta: "Button", buttons: "Buttons", facts: "Key facts", priceLine: "Price and location", submitLabel: "Button label"};
/** "items.2.title" → "Item 3 title"; "primaryCta" → "Primary button". */
export function elementLabel(key: string) {
  if (ELEMENT_NAMES[key]) return ELEMENT_NAMES[key];
  return key.split(".").map((part, index) => /^\d+$/.test(part) ? String(Number(part) + 1) : (index ? part : part.replace(/s$/, "")).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase())
    .join(" ").replace(/^./, letter => letter.toUpperCase());
}
const SIDES = ["top", "right", "bottom", "left"] as const;
/** Sets one device's box; a box with nothing set anywhere becomes null (the preset applies). */
function withDeviceBox(current: DeviceBox | null, device: Device, box: Box | null): DeviceBox | null {
  const next = {...(current ?? {desktop: null, tablet: null, mobile: null}), [device]: box};
  return next.desktop || next.tablet || next.mobile ? next : null;
}
/** What an empty side falls back to on this device, shown as the placeholder. */
function inheritedBox(box: DeviceBox | null, device: Device, fallback: (side: typeof SIDES[number]) => number) {
  const larger = device === "mobile" ? "tablet" : device === "tablet" ? "desktop" : null;
  return Object.fromEntries(SIDES.map(side => [side, (larger ? boxValue(box, larger, side) : null) ?? fallback(side)])) as Record<typeof SIDES[number], number>;
}

export type SectionTab = "content" | "style" | "advanced";

/** Reads a nested prop by a dotted path such as "items.2.title". */
function valueAt(props: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => current && typeof current === "object" ? (current as Record<string, unknown>)[part] : undefined, props);
}
function setAt(target: unknown, path: string[], value: unknown): unknown {
  const [head, ...rest] = path;
  const copy: Record<string, unknown> | unknown[] = Array.isArray(target) ? [...target] : {...(target as Record<string, unknown>)};
  (copy as Record<string, unknown>)[head] = rest.length ? setAt((target as Record<string, unknown>)[head], rest, value) : value;
  return copy;
}
const MULTILINE = /^(body|intro|text|answer|quote|subheadline|disclaimer|note)$/;
/** The editable text of a selected element (its own text, or a button's label), with the registry's length limit where known. */
function elementText(section: PageSection, key: string, onProps: (props: Record<string, unknown>) => void): ElementText | null {
  const value = valueAt(section.props, key);
  const spec = FIELD_SPECS[section.type].find(item => item.key === key);
  const last = key.split(".").pop() ?? key;
  const update = (path: string) => (next: string) => onProps(setAt(section.props, path.split("."), next) as Record<string, unknown>);
  if (typeof value === "string") {
    const multiline = spec?.kind === "textarea" || MULTILINE.test(last);
    return {value, max: spec && (spec.kind === "text" || spec.kind === "textarea") ? spec.max : multiline ? 1000 : 200, multiline, onChange: update(key)};
  }
  const label = valueAt(value, "label");
  return typeof label === "string" ? {value: label, max: 40, multiline: false, onChange: update(`${key}.label`)} : null;
}

const ITEM_FIELD_LABELS: Record<string, string> = {title: "Title", text: "Text", question: "Question", answer: "Answer", quote: "Quote", author: "Author", context: "Context", name: "Name", note: "Note", value: "Value", label: "Label"};

/**
 * The Content tab of an element: what it says or shows. Text, a button (its
 * words and what it does), an image, the fields of a list item, the enquiry
 * form (its button; its fields come from the connected lead form), or, for a
 * group, the parts inside it. Elements that show CRM data say where to change it.
 */
function ElementContent({section, elementKey, kind, linked, onProps, onSection, onDeselect}: {
  section: PageSection; elementKey: string; kind: ElementKind; linked: LinkedData; onProps: (props: Record<string, unknown>) => void;
  /** Whole-section changes (duplicate and delete also move element styles). */
  onSection: (section: PageSection) => void; onDeselect: () => void;
}) {
  const {canvasElements, selectElement, payload} = useEditorServices();
  // A fact's label or value: the fact's own fields (the Style tab styles just that part).
  const part = /^(facts\.\d+)\.(label|value)$/.exec(elementKey);
  if (part && section.type === "HERO") return <ElementContent section={section} elementKey={part[1]} kind="block" linked={linked} onProps={onProps} onSection={onSection} onDeselect={onDeselect} />;
  // One of the hero's automatic facts is edited as an item of the hero's own list.
  const own = /^facts\.\d+$/.test(elementKey) ? withOwnFacts(section) : section;
  const value = valueAt(own.props, elementKey);
  const update = (path: string) => (next: unknown) => onProps(setAt(own.props, path.split("."), next) as Record<string, unknown>);
  const run = (result: ReturnType<typeof duplicateElement>, deleted = false) => { if (!result.ok) { toast.error(result.message); return; } onSection(result.section); toast.success(result.message); if (deleted) onDeselect(); };
  const itemActions = (canDuplicateElement(section, elementKey) || canDeleteElement(section, elementKey)) && <div className="flex gap-2 border-t border-white/10 pt-3">
    {canDuplicateElement(section, elementKey) && <button type="button" onClick={() => run(duplicateElement(section, elementKey))} data-testid="element-duplicate"
      className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-xs text-zinc-200 hover:border-sky-400 hover:text-white"><CopyPlus className="size-3.5" aria-hidden="true" />Duplicate next to it</button>}
    {canDeleteElement(section, elementKey) && <button type="button" onClick={() => run(deleteElement(section, elementKey), true)} data-testid="element-delete"
      className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-xs text-red-200 hover:border-red-400 hover:text-red-100"><Trash2 className="size-3.5" aria-hidden="true" />Delete</button>}
  </div>;
  const parts = canvasElements(section.id).filter(item => item.parent === elementKey);
  const partList = parts.length > 0 && <div className="space-y-1.5">
    <p className="text-[13px] font-medium text-zinc-200">Inside this group</p>
    <ul className="space-y-1">{parts.map(part => <li key={part.key}><button type="button" onClick={() => selectElement(section.id, part.key, part.kind)} data-testid={`element-part-${part.key}`}
      className="flex w-full items-center justify-between gap-2 rounded-md border border-white/10 px-2.5 py-2 text-left text-xs text-zinc-200 hover:border-sky-400 hover:text-white">
      <span className="truncate">{elementLabel(part.key)}</span><span className="text-[10px] uppercase tracking-wider text-zinc-500">{ELEMENT_KIND_LABELS[part.kind]}</span></button></li>)}</ul>
  </div>;
  // The hero's key facts: the list itself.
  if (section.type === "HERO" && elementKey === "facts") return <ContentField spec={{key: "facts", label: "Key facts", kind: "heroFacts"}} section={section} linked={linked} onProps={onProps} />;
  // The enquiry form: its button, and where its fields come from.
  if (elementKey === "form") {
    const labelPath = section.type === "HERO" ? "primaryCta.label" : section.type === "ENQUIRY_FORM" ? "submitLabel" : null;
    const label = labelPath ? valueAt(section.props, labelPath) : null;
    const fields = payload.form?.view?.fields ?? [];
    return <>
      {labelPath && typeof label === "string" && <TextControl label="Button text" value={label} max={40} onChange={update(labelPath)} />}
      <LeadFormControl />
      <div className="space-y-2 rounded-md border border-white/10 bg-white/[.03] p-3 text-xs text-zinc-300">
        <p className="font-semibold text-zinc-100">{fields.length ? "Fields from the connected lead form" : "Sample fields for now"}</p>
        {fields.length > 0 ? <ul className="list-disc space-y-0.5 ps-4">{fields.map(field => <li key={field.key}>{field.label}{field.required ? " (required)" : ""}</li>)}</ul>
          : <p>The canvas shows sample fields until a lead form is connected above. Visitors see the form only once one is.</p>}
        <p className="text-zinc-400">Fields, consent text and the privacy link belong to the lead form, so every page that uses it stays consistent and enquiries arrive with the right details.</p>
        <a href="/settings/lead-forms" target="_blank" rel="noreferrer" className="inline-flex font-medium text-sky-300 hover:underline">Edit lead form fields ↗</a>
      </div>
      <p className="text-[11px] text-zinc-500">Colours, corners and the button colour are in the Style tab.</p>
    </>;
  }
  // Plain text.
  const text = elementText(section, elementKey, onProps);
  if (typeof value === "string" && text) return <><TextControl label="Text" value={text.value} max={text.max} multiline={text.multiline} onChange={text.onChange} hint="You can also type on the canvas." />{partList}{itemActions}</>;
  // A button: its words and what it does.
  if (value && typeof value === "object" && "label" in value && "action" in value) {
    const cta = value as {label: string; action: string};
    return <>
      <TextControl label="Button text" value={cta.label} max={40} onChange={update(`${elementKey}.label`)} />
      <SelectControl label="When clicked" value={cta.action as (typeof CTA_ACTIONS)[number]} options={CTA_ACTIONS} labels={CTA_ACTION_LABELS} onChange={update(`${elementKey}.action`)} />
      <p className="text-[11px] text-zinc-500">Phone, WhatsApp and email use the approved company contacts.</p>
    </>;
  }
  // An image of the section's own (not a photo from a gallery or the CRM).
  if (kind === "image" && (value === null || (value && typeof value === "object" && ("stockId" in value || "mediaId" in value || "uploadId" in value)))) {
    return <ImagePicker label="Image" value={(value as ImageRef | null) ?? null} onChange={update(elementKey)} linked={linked} />;
  }
  // A list item: each of its fields.
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const item = value as Record<string, unknown>;
    return <>{Object.entries(item).map(([field, fieldValue]) => {
      if (field === "icon" && typeof fieldValue === "string") return <SelectControl key={field} label="Icon" value={fieldValue as (typeof HIGHLIGHT_ICONS)[number]} options={HIGHLIGHT_ICONS} labels={Object.fromEntries(HIGHLIGHT_ICONS.map(icon => [icon, humanize(icon)]))} onChange={update(`${elementKey}.${field}`)} />;
      if (field === "source" && typeof fieldValue === "string") return <SelectControl key={field} label="Shows" value={fieldValue as StatSource} options={STAT_SOURCES} labels={STAT_SOURCE_LABELS} onChange={update(`${elementKey}.${field}`)} />;
      if (field === "value" && "source" in item) {
        const custom = item.source === "CUSTOM";
        const resolved = custom ? null : statValue({source: item.source as StatSource, value: ""}, linked);
        return <div key={field} data-testid="element-fact-value">
          <TextControl label="Value" value={custom ? String(fieldValue ?? "") : ""} max={40} placeholder={resolved ?? "Type a value"} onChange={next => update(elementKey)({...item, source: "CUSTOM", value: next})}
            hint={custom ? "Your own text, shown as typed. To show a CRM value again, choose it under Shows." : resolved ? `From CRM: ${resolved}. Typing replaces it with your own text.` : "Not recorded in the CRM, so it is hidden on the live page. Type a value to show your own text."} />
        </div>;
      }
      if (typeof fieldValue !== "string") return null;
      const long = field === "text" || field === "answer" || field === "quote";
      return <TextControl key={field} label={ITEM_FIELD_LABELS[field] ?? humanize(field)} value={fieldValue} max={field === "label" && "source" in item ? 60 : long ? 1000 : 200} multiline={long} onChange={update(`${elementKey}.${field}`)} />;
    })}{partList}{itemActions}</>;
  }
  // A group of other elements, or content from the CRM.
  return <>
    {partList || null}
    {!parts.length && <div className="flex gap-2 rounded-md border border-sky-400/30 bg-sky-400/10 p-3 text-xs text-sky-100"><Database className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{SECTION_DEFINITIONS[section.type].linked ? `This shows CRM data (${SECTION_DEFINITIONS[section.type].linked}). Change the value in the CRM record; style and position it here.` : "This part is drawn from the section's settings. Style and position it here."}</p></div>}
  </>;
}

export function SectionPanel({section, linked, hasForm, today, device, onChange, element, elementKind, onElement, tab, onTab, widget, onWidget, onConvert}: {
  section: PageSection; linked: LinkedData; hasForm: boolean; today: string; device: Device; onChange: (section: PageSection) => void;
  /** Asks to convert this built-in section to a custom section (rows, columns and widgets). */
  onConvert?: () => void;
  /** The selected widget of a custom section ("rows.0.columns.1.widgets.2"). */
  widget: string | null; onWidget: (path: string | null) => void;
  /** The element selected on the canvas (a prop path), styled and moved on its own. */
  element: string | null; elementKind: ElementKind; onElement: (key: string | null) => void;
  tab: SectionTab; onTab: (tab: SectionTab) => void;
}) {
  const setTab = onTab;
  const definition = SECTION_DEFINITIONS[section.type];
  const availability = sectionAvailability(section, linked, {hasForm, today, mode: "public"});
  const set = (patch: Partial<PageSection>) => onChange({...section, ...patch} as PageSection);
  const style = withStyleDefaults(section.style);
  const setStyle = (patch: Partial<SectionStyle>) => set({style: {...style, ...patch}});
  const spacingKey = device === "tablet" ? "spacingTablet" : device === "mobile" ? "spacingMobile" : null;
  const DeviceIcon = device === "mobile" ? Smartphone : device === "tablet" ? Tablet : Monitor;
  const preset = presetPaddingPx(style, section.layout.spacing)[device];
  const moved = Object.keys(style.elementOffsets).length;
  const styled = Object.keys(style.elementStyles).length;
  const without = <T,>(map: Record<string, T>, key: string) => Object.fromEntries(Object.entries(map).filter(([name]) => name !== key));
  const setElementOffset = (key: string, offset: Offset) => {
    const rest = without(style.elementOffsets, key);
    setStyle({elementOffsets: offset.x || offset.y ? {...rest, [key]: offset} : rest});
  };
  const setElementStyle = (key: string, next: ElementStyle) => {
    const rest = without(style.elementStyles, key);
    setStyle({elementStyles: isDefaultElementStyle(next) ? rest : {...rest, [key]: next}});
  };
  if (widget) return <WidgetPanel section={section} path={widget} linked={linked} onChange={onChange} onWidget={onWidget} />;
  if (element) {
    return <ElementPanel key={element} label={elementLabel(element)} sectionLabel={definition.label} kind={elementKind}
      style={style.elementStyles[element] ?? DEFAULT_ELEMENT_STYLE} offset={style.elementOffsets[element] ?? {x: 0, y: 0}}
      content={<ElementContent section={section} elementKey={element} kind={elementKind} linked={linked} onProps={props => set({props} as Partial<PageSection>)} onSection={onChange} onDeselect={() => onElement(null)} />}
      onStyle={next => setElementStyle(element, next)} onOffset={offset => setElementOffset(element, offset)}
      onReset={() => setStyle({elementStyles: without(style.elementStyles, element), elementOffsets: without(style.elementOffsets, element)})}
      onBack={() => onElement(null)} />;
  }
  return <div>
    <div role="tablist" aria-label="Section settings" className="sticky top-0 z-10 grid grid-cols-3 border-b border-white/10 bg-zinc-900">
      {(["content", "style", "advanced"] as const).map(option => <button key={option} type="button" role="tab" aria-selected={tab === option} onClick={() => setTab(option)}
        className={`border-b-2 py-3 text-xs font-semibold uppercase tracking-wider ${tab === option ? "border-sky-400 text-white" : "border-transparent text-zinc-400 hover:text-white"}`}>{option}</button>)}
    </div>
    {definition.linked && <div className="m-4 flex gap-2 rounded-md border border-sky-400/30 bg-sky-400/10 p-3 text-xs text-sky-100">
      <Database className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><div><p className="font-semibold">From CRM: {definition.linked}</p><p className="text-sky-100/80">Read-only here; change these values in the CRM record.</p></div>
    </div>}
    {!availability.ok && <p className="mx-4 mb-2 rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-100">Not shown on the public page: {availability.reason}</p>}
    <div role="tabpanel">
      {tab === "content" && <div className="space-y-5 p-4">
        {section.type === "CUSTOM" && <StructureControl section={section} linked={linked} onChange={onChange} onWidget={onWidget} />}
        {FIELD_SPECS[section.type].map(spec => section.type === "HERO" && spec.key === "image" && section.variant === "showcaseImage"
          ? <div key={spec.key} className="space-y-5">
            <ImagePicker label="Showcase image" value={section.props.image} linked={linked} hint="Framed beside the text, with the key facts floating around it." onChange={image => set({props: {...section.props, image}} as Partial<PageSection>)} />
            {style.backgroundType === "IMAGE" && <ImagePicker label="Background image" value={style.backgroundImage} linked={linked} hint="The photo behind the whole hero." onChange={backgroundImage => setStyle({backgroundImage})} />}
            {style.backgroundType === "VIDEO" && <VideoPicker label="Background video" value={style.backgroundVideo} onChange={backgroundVideo => setStyle({backgroundVideo})} allowNone={false} />}
            {style.backgroundType !== "IMAGE" && style.backgroundType !== "VIDEO" && <p className="text-[11px] leading-4 text-zinc-500">For a photo or video behind the hero, choose it under Style › Background media.</p>}
          </div>
          : section.type === "HERO" && spec.key === "image" && style.backgroundType === "IMAGE"
          ? <ImagePicker key={spec.key} label="Background image" value={style.backgroundImage ?? section.props.image} linked={linked} hint="The photo behind the hero. The overlay colour and strength are in the Style tab."
            onChange={backgroundImage => set({style: {...style, backgroundImage}, ...(backgroundImage ? {} : {props: {...section.props, image: null}})} as Partial<PageSection>)} />
          : section.type === "HERO" && spec.key === "image" && style.backgroundType === "VIDEO"
          ? <VideoPicker key={spec.key} label="Background video" value={style.backgroundVideo} onChange={backgroundVideo => setStyle({backgroundVideo})} allowNone={false} />
          : <ContentField key={spec.key} spec={section.type === "HERO" && spec.key === "image" ? {...spec, label: "Image", hint: section.variant === "fullBleed" ? "The photo behind the hero." : "Shown beside the text."} as typeof spec : spec} section={section} linked={linked} onProps={props => set({props} as Partial<PageSection>)} />)}
        {acceptsExtra(section.type) && <div className="space-y-3 border-t border-white/10 pt-4">
          <div><p className="text-[13px] font-medium text-zinc-100">Columns and widgets in this section</p>
            <p className="text-[11px] leading-4 text-zinc-500">Add rows of columns with your own widgets inside this section, before or after its content. You can also drag a widget from Elements onto the section.</p></div>
          {section.extra && <Segmented label="Show them" value={section.extra.position} options={["BEFORE", "AFTER"] as const} labels={{BEFORE: "Before the content", AFTER: "After the content"}}
            onChange={position => onChange({...section, extra: {...section.extra!, position}} as PageSection)} />}
          <StructureControl section={section} prefix="extra.rows" linked={linked} onChange={onChange} onWidget={onWidget} />
        </div>}
        <p className="text-[11px] text-zinc-500">Tip: click any heading, text, button or image on the canvas to edit, style or move it on its own.</p>
      </div>}
      {tab === "style" && <div>
        <Group title="Layout">
          <Segmented label="Layout" value={section.variant} options={definition.variants} labels={VARIANT_LABELS} onChange={variant => set({variant} as Partial<PageSection>)} />
          {section.type !== "NAVBAR" && <>
            <SelectControl label="Height" value={style.height} options={HEIGHTS} onChange={height => setStyle({height})} />
            <Segmented label="Content width" value={style.width} options={WIDTHS} onChange={width => setStyle({width})} />
            <Segmented label="Alignment" value={section.layout.align} options={ALIGNMENTS} onChange={align => set({layout: {...section.layout, align}})} />
          </>}
        </Group>
        {section.type !== "NAVBAR" && <Group title="Background">
          <Segmented label="Theme background" value={section.layout.background} options={BACKGROUNDS} onChange={background => set({layout: {...section.layout, background}})} />
          <Segmented label="Background media" value={style.backgroundType} options={BACKGROUND_TYPES} onChange={backgroundType => setStyle({backgroundType})} />
          {style.backgroundType === "COLOR" && <ColorControl label="Background colour" value={style.backgroundColor} onChange={backgroundColor => setStyle({backgroundColor})} />}
          {style.backgroundType === "IMAGE" && <ImagePicker label="Background image" value={style.backgroundImage} onChange={backgroundImage => setStyle({backgroundImage})} linked={linked} />}
          {style.backgroundType === "VIDEO" && <VideoPicker label="Background video" value={style.backgroundVideo} onChange={backgroundVideo => setStyle({backgroundVideo})} allowNone={false} />}
          {(style.backgroundType === "IMAGE" || style.backgroundType === "VIDEO") && <>
            <Slider label="Overlay" value={style.overlay} min={0} max={90} step={5} unit="%" onChange={overlay => setStyle({overlay})} />
            <Segmented label="Overlay colour" value={style.overlayTone} options={OVERLAY_TONES} onChange={overlayTone => setStyle({overlayTone})} />
          </>}
        </Group>}
        <Group title="Text">
          <Segmented label="Text tone" value={style.textTone} options={TEXT_TONES} onChange={textTone => setStyle({textTone})} />
          <ColorControl label="Text colour" value={style.textColor} onChange={textColor => setStyle({textColor})} />
        </Group>
        {section.type !== "NAVBAR" && <Group title="Motion"><SelectControl label="Entrance animation" value={style.animation} options={ANIMATIONS} onChange={animation => setStyle({animation})} />
          <p className="text-[11px] text-zinc-500">Plays as the section scrolls into view; switched off for visitors who prefer reduced motion.</p></Group>}
      </div>}
      {tab === "advanced" && <div>
        {section.type !== "CUSTOM" && onConvert && (() => {
          const blocker = convertBlocker(section);
          return <Group title="Layout freedom">
            <p className="text-[11px] leading-4 text-zinc-400">Turn this section into rows, columns and widgets, so every part can be dragged anywhere (like Elementor). Undo with Ctrl+Z.</p>
            <button type="button" onClick={onConvert} disabled={Boolean(blocker)} data-testid="convert-section"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-xs font-medium text-zinc-100 hover:border-sky-400 disabled:opacity-40"><Shapes className="size-3.5" aria-hidden="true" />Convert to custom section</button>
            {blocker && <p className="text-[11px] leading-4 text-amber-200">{blocker}</p>}
          </Group>;
        })()}
        <Group title="Position">
          {section.type !== "NAVBAR" && <Segmented label="Content position (vertical)" value={style.contentVertical} options={CONTENT_VERTICALS} onChange={contentVertical => setStyle({contentVertical})}
            labels={{AUTO: "Default", TOP: "Top", CENTER: "Middle", BOTTOM: "Bottom"}} />}
          {section.type !== "NAVBAR" && style.height === "AUTO" && style.contentVertical !== "AUTO" && <p className="-mt-2 text-[11px] text-amber-200/80">Choose a height in the Style tab: the section is only as tall as its content.</p>}
          <OffsetControl label="Move all content" value={style.contentOffset} max={MAX_OFFSET} onChange={contentOffset => setStyle({contentOffset})} />
          <p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-[12px] leading-5 text-zinc-400">To style or move one item on its own, click a heading, eyebrow, text, button or image on the page.</p>
          {moved + styled > 0 && <button type="button" onClick={() => { setStyle({elementOffsets: {}, elementStyles: {}}); onElement(null); }} className="text-[11px] text-zinc-400 hover:text-white hover:underline">Reset {moved + styled} customised element{moved + styled === 1 ? "" : "s"}</button>}
        </Group>
        <Group title="Spacing">
          <p className="flex items-center gap-1.5 text-[11px] text-zinc-400"><DeviceIcon className="size-3.5" aria-hidden="true" />Editing the {device} spacing. Switch the preview device to set others.</p>
          {spacingKey
            ? <SelectControl label={`Vertical padding (${device})`} value={style[spacingKey]} options={DEVICE_SPACINGS} onChange={value => setStyle({[spacingKey]: value})} />
            : <Segmented label="Vertical padding (desktop)" value={section.layout.spacing} options={SPACINGS} onChange={spacing => set({layout: {...section.layout, spacing}})} />}
          <BoxControl label={`Padding (${device})`} value={style.padding?.[device] ?? null} min={0} max={MAX_BOX}
            inherited={inheritedBox(style.padding, device, side => side === "top" || side === "bottom" ? preset : 0)}
            onChange={box => setStyle({padding: withDeviceBox(style.padding, device, box)})} hint="Space inside the section. Empty sides use the preset above or the larger device's value." />
          <BoxControl label={`Margin (${device})`} value={style.margin?.[device] ?? null} min={-MAX_BOX} max={MAX_BOX}
            inherited={inheritedBox(style.margin, device, () => 0)}
            onChange={box => setStyle({margin: withDeviceBox(style.margin, device, box)})} hint="Space outside the section. A negative top margin overlaps the section above." />
        </Group>
        <Group title="Visibility">
          <Toggle label="Show this section" checked={section.visible} onChange={visible => set({visible} as Partial<PageSection>)} />
          {(["desktop", "tablet", "mobile"] as const).map(name => <Toggle key={name} label={`Show on ${name}`} checked={section.devices[name]} onChange={checked => set({devices: {...section.devices, [name]: checked}})} />)}
        </Group>
        <Group title="Section" defaultOpen={false}><p className="font-mono text-xs text-zinc-400">ID: {section.id}</p><p className="text-[11px] text-zinc-500">{definition.description}</p></Group>
      </div>}
    </div>
  </div>;
}
