"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import {
  AlignLeft, ArrowDown, ArrowUp, Building2, Contact as ContactIcon, Grid2x2, Hash, Heading, Image as ImageIcon, LayoutGrid, List, Map as MapIcon, Minus, MousePointerClick, MoveVertical, Rows3, SquareStack, Video, CalendarClock, ChartNoAxesColumn, Columns2, Copy, Eye, EyeOff, Film, GalleryHorizontal, GripVertical, HelpCircle, Images, LayoutPanelTop, Landmark,
  Contact, ListChecks, MapPin, Megaphone, MessageCircle, Navigation, PanelBottom, Phone, Quote, Ruler, Search, Sparkles, Table, Trash2, Wallet, Waves, type LucideIcon,
} from "lucide-react";
import type { LinkedData } from "../../linked";
import {
  ACCENTS, BUTTON_SHAPES, DESIGN_STYLES, DESIGN_STYLE_LABELS, FONT_FAMILIES, FONT_FAMILY_LABELS, MAX_SECTIONS, RADII, SCALES, SECTION_DEFINITIONS, SECTION_GROUPS, SECTION_TYPES, defaultTheme,
  WIDGET_DEFINITIONS, WIDGET_TYPES, sectionWidgets, type PageSection, type PageTheme, type SectionType, type WidgetType,
} from "../../registry";
import { ACCENT_COLORS, FONT_STACKS, STYLE_TOKENS, accentColor } from "../../theme";
import { ColorControl, Group, Segmented, SelectControl, TextControl } from "./controls";

export const DRAG_NEW = "application/x-estateos-new-section";
export const DRAG_MOVE = "application/x-estateos-move-section";
export const DRAG_WIDGET = "application/x-estateos-new-widget";
/** Moving a widget that is already on the page: {sectionId, path} as JSON. */
export const DRAG_PLACED = "application/x-estateos-move-widget";

/** "rows.0.columns.1.widgets.2" → "R1 · C2"; added content and inner columns are marked. */
function navigatorTrail(path: string) {
  const match = /(?:^|\.)rows\.(\d+)\.columns\.(\d+)/.exec(path);
  const inner = /\.props\.columns\.(\d+)\./.exec(path);
  return `${path.startsWith("extra.") ? "+ " : ""}R${Number(match?.[1] ?? 0) + 1} · C${Number(match?.[2] ?? 0) + 1}${inner ? ` · inner C${Number(inner[1]) + 1}` : ""}`;
}

export const WIDGET_ICONS: Record<WidgetType, LucideIcon> = {
  HEADING: Heading, TEXT: AlignLeft, IMAGE: ImageIcon, BUTTON: MousePointerClick, ICON_LIST: List, ICON_BOX: SquareStack, COUNTER: Hash, VIDEO: Video,
  SPACER: MoveVertical, DIVIDER: Minus, MAP: MapIcon, FORM: Rows3, CONTACT_CARD: ContactIcon, GALLERY: Grid2x2, INNER_SECTION: Columns2,
};

export const SECTION_ICONS: Record<SectionType, LucideIcon> = {
  NAVBAR: Navigation, HERO: LayoutPanelTop, STATS: ChartNoAxesColumn, PROJECT_OVERVIEW: Building2, FEATURE_SPLIT: Columns2, DEVELOPER: Landmark, HIGHLIGHTS: Sparkles,
  GALLERY: Images, VIDEO_SHOWCASE: Film, UNIT_TYPES: Table, PRICING: Wallet, PAYMENT_PLANS: CalendarClock, FLOOR_PLANS: Ruler, AMENITIES: Waves, LOCATION: MapPin,
  LANDMARKS: ListChecks, COMPARISON: GalleryHorizontal, BANNER: Megaphone, ENQUIRY_FORM: MessageCircle, WHATSAPP_CTA: MessageCircle, CALL_CTA: Phone, CONTACT: Contact,
  TESTIMONIALS: Quote, FAQ: HelpCircle, COUNTDOWN: CalendarClock, CUSTOM: LayoutGrid, FOOTER: PanelBottom,
};

export function ElementsPanel({sections, onAdd, onAddWidget, onDragStart, library}: {sections: PageSection[]; onAdd: (type: SectionType) => void; onAddWidget: (type: WidgetType) => void; onDragStart: () => void; library?: ReactNode}) {
  const [query, setQuery] = useState("");
  const used = new Set(sections.filter(section => SECTION_DEFINITIONS[section.type].single).map(section => section.type));
  const full = sections.length >= MAX_SECTIONS;
  const matches = (type: SectionType) => `${SECTION_DEFINITIONS[type].label} ${SECTION_DEFINITIONS[type].description}`.toLowerCase().includes(query.trim().toLowerCase());
  return <div className="p-4">
    <div className="relative mb-4"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search elements" aria-label="Search elements" className="h-9 w-full rounded-md border border-white/10 bg-white/5 pl-8 pr-2 text-sm text-zinc-100 outline-none focus:border-sky-400" /></div>
    <p className="mb-4 text-[11px] leading-4 text-zinc-500">Drag an element onto the page, or click it to add it after the selected section.</p>
    {!query.trim() && library}
    {(() => {
      const widgets = WIDGET_TYPES.filter(type => `${WIDGET_DEFINITIONS[type].label} ${WIDGET_DEFINITIONS[type].description}`.toLowerCase().includes(query.trim().toLowerCase()));
      if (!widgets.length) return null;
      return <div className="mb-5"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Widgets</p>
        <p className="mb-2 text-[10px] leading-4 text-zinc-500">Drop on a column of a custom section, or anywhere else to start a new custom section.</p>
        <ul className="grid grid-cols-3 gap-1.5">{widgets.map(type => {
          const Icon = WIDGET_ICONS[type];
          return <li key={type}><button type="button" draggable onClick={() => onAddWidget(type)} title={WIDGET_DEFINITIONS[type].description}
            onDragStart={(event: DragEvent) => { event.dataTransfer.setData(DRAG_WIDGET, type); event.dataTransfer.effectAllowed = "copy"; onDragStart(); }}
            className="flex h-16 w-full cursor-grab flex-col items-center justify-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1 text-center text-[11px] text-zinc-200 transition-colors hover:border-sky-400 hover:bg-sky-400/10 active:cursor-grabbing">
            <Icon className="size-4 text-zinc-300" aria-hidden="true" /><span className="leading-tight">{WIDGET_DEFINITIONS[type].label}</span>
          </button></li>;
        })}</ul></div>;
    })()}
    {SECTION_GROUPS.map(group => {
      const types = SECTION_TYPES.filter(type => SECTION_DEFINITIONS[type].group === group && matches(type));
      if (!types.length) return null;
      return <div key={group} className="mb-5"><p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{group}</p>
        <ul className="grid grid-cols-2 gap-2">{types.map(type => {
          const Icon = SECTION_ICONS[type];
          const disabled = full || used.has(type);
          return <li key={type}><button type="button" disabled={disabled} draggable={!disabled} onClick={() => onAdd(type)}
            onDragStart={(event: DragEvent) => { event.dataTransfer.setData(DRAG_NEW, type); event.dataTransfer.effectAllowed = "copy"; onDragStart(); }}
            title={disabled && used.has(type) ? `${SECTION_DEFINITIONS[type].label} is already on the page` : SECTION_DEFINITIONS[type].description}
            className="relative flex h-20 w-full cursor-grab flex-col items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 text-center text-xs text-zinc-200 transition-colors hover:border-sky-400 hover:bg-sky-400/10 active:cursor-grabbing disabled:cursor-not-allowed disabled:text-zinc-500">
            <Icon className={`size-5 ${disabled ? "text-zinc-600" : "text-zinc-300"}`} aria-hidden="true" /><span className="leading-tight">{SECTION_DEFINITIONS[type].label}</span>
            {used.has(type) && <span className="absolute right-1.5 top-1.5 rounded bg-emerald-500/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-300">On page</span>}
          </button></li>;
        })}</ul></div>;
    })}
  </div>;
}

export function NavigatorPanel({sections, selected, onSelect, onMove, onReorder, onToggle, onDuplicate, onDelete, unavailable, selectedWidget, onSelectWidget}: {
  sections: PageSection[]; selected: string | null; onSelect: (id: string) => void; onMove: (id: string, delta: number) => void; onReorder: (id: string, toIndex: number) => void;
  onToggle: (id: string) => void; onDuplicate: (id: string) => void; onDelete: (id: string) => void; unavailable: Map<string, string>;
  selectedWidget: string | null; onSelectWidget: (sectionId: string, path: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  return <div className="p-2">
    <ol aria-label="Page sections" className="space-y-0.5">{sections.map((section, index) => {
      const Icon = SECTION_ICONS[section.type];
      const label = SECTION_DEFINITIONS[section.type].label;
      const note = unavailable.get(section.id);
      return <li key={section.id} draggable onDragStart={event => { setDragId(section.id); event.dataTransfer.setData(DRAG_MOVE, section.id); }} onDragEnd={() => setDragId(null)}
        onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData(DRAG_MOVE); if (id) onReorder(id, index); setDragId(null); }}
        className={`group flex flex-wrap items-center gap-1 rounded-md px-1.5 py-1 text-sm ${selected === section.id ? "bg-sky-500/20 text-white" : "text-zinc-300 hover:bg-white/5"} ${dragId === section.id ? "opacity-40" : ""}`}>
        <GripVertical className="size-4 shrink-0 cursor-grab text-zinc-600" aria-hidden="true" />
        <button type="button" onClick={() => onSelect(section.id)} aria-current={selected === section.id} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left">
          <Icon className="size-4 shrink-0 text-zinc-400" aria-hidden="true" />
          <span className="min-w-0"><span className={`block truncate ${section.visible ? "" : "line-through opacity-60"}`}>{label}</span>{note && section.visible && <span className="block truncate text-[10px] text-amber-300">Hidden publicly: {note}</span>}</span>
        </button>
        <span className="flex shrink-0 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100">
          <button type="button" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(section.id, -1)} className="rounded p-1 hover:bg-white/10 disabled:opacity-25"><ArrowUp className="size-3.5" /></button>
          <button type="button" aria-label={`Move ${label} down`} disabled={index === sections.length - 1} onClick={() => onMove(section.id, 1)} className="rounded p-1 hover:bg-white/10 disabled:opacity-25"><ArrowDown className="size-3.5" /></button>
          <button type="button" aria-label={`${section.visible ? "Hide" : "Show"} ${label}`} onClick={() => onToggle(section.id)} className="rounded p-1 hover:bg-white/10">{section.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}</button>
          {!SECTION_DEFINITIONS[section.type].single && <button type="button" aria-label={`Duplicate ${label}`} onClick={() => onDuplicate(section.id)} className="rounded p-1 hover:bg-white/10"><Copy className="size-3.5" /></button>}
          <button type="button" aria-label={`Delete ${label}`} onClick={() => onDelete(section.id)} className="rounded p-1 hover:bg-red-500/20 hover:text-red-300"><Trash2 className="size-3.5" /></button>
        </span>
        {sectionWidgets(section).length > 0 && <ul aria-label={`Widgets in ${label}`} className="ml-7 mt-0.5 w-full basis-full space-y-0.5 border-l border-white/10 pl-2">
          {sectionWidgets(section).map(item => { const WidgetIcon = WIDGET_ICONS[item.widget.type]; const active = selected === section.id && selectedWidget === item.path;
            return <li key={item.widget.id}><button type="button" onClick={() => onSelectWidget(section.id, item.path)} aria-current={active}
              className={`flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs ${active ? "bg-sky-500/20 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}>
              <WidgetIcon className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate" style={{paddingLeft: item.path.includes(".props.columns.") ? 12 : 0}}>{navigatorTrail(item.path)} · {WIDGET_DEFINITIONS[item.widget.type].label}</span>
            </button></li>; })}
        </ul>}
      </li>;
    })}</ol>
  </div>;
}

export function SiteStylePanel({theme, onTheme}: {theme: PageTheme; onTheme: (theme: PageTheme) => void}) {
  return <div>
    <Group title="Style presets">
      <div className="grid grid-cols-2 gap-2">{DESIGN_STYLES.map(style => {
        const tokens = STYLE_TOKENS[style];
        const preset = defaultTheme(style);
        const accent = tokens.dark ? ACCENT_COLORS[preset.accent].dark : ACCENT_COLORS[preset.accent].light;
        return <button key={style} type="button" aria-pressed={theme.style === style} onClick={() => onTheme({...preset, customAccent: theme.customAccent})}
          className={`overflow-hidden rounded-md border-2 text-left transition-colors ${theme.style === style ? "border-sky-400" : "border-white/10 hover:border-white/30"}`}>
          <div className="h-14 p-2" style={{backgroundColor: tokens.bg, color: tokens.fg}}>
            <p className="truncate text-sm font-semibold" style={{fontFamily: FONT_STACKS[preset.headingFont ?? "SYSTEM"]}}>Aa Living</p>
            <span className="mt-1.5 block h-1.5 w-10 rounded-full" style={{backgroundColor: accent}} />
          </div>
          <p className="bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-300">{DESIGN_STYLE_LABELS[style]}</p>
        </button>;
      })}</div>
    </Group>
    <Group title="Colours">
      <div className="space-y-1.5"><p className="text-[13px] font-medium text-zinc-200">Accent</p>
        <div className="flex flex-wrap gap-2">{ACCENTS.map(accent => <button key={accent} type="button" aria-label={ACCENT_COLORS[accent].label} aria-pressed={!theme.customAccent && theme.accent === accent} onClick={() => onTheme({...theme, accent, customAccent: null})}
          className={`size-7 rounded-full border-2 ${!theme.customAccent && theme.accent === accent ? "border-white ring-2 ring-sky-400" : "border-transparent"}`} style={{backgroundColor: STYLE_TOKENS[theme.style].dark ? ACCENT_COLORS[accent].dark : ACCENT_COLORS[accent].light}} />)}</div></div>
      <ColorControl label="Custom brand colour" value={theme.customAccent} onChange={customAccent => onTheme({...theme, customAccent})} />
      <p className="flex items-center gap-2 text-[11px] text-zinc-500"><span className="size-3 rounded-full" style={{backgroundColor: accentColor(theme)}} />Button text colour is chosen automatically for contrast.</p>
    </Group>
    <Group title="Typography">
      {(["headingFont", "bodyFont"] as const).map(key => <div key={key} className="space-y-1.5">
        <SelectControl label={key === "headingFont" ? "Headings" : "Body text"} value={theme[key] ?? "SYSTEM"} options={FONT_FAMILIES} labels={FONT_FAMILY_LABELS} onChange={font => onTheme({...theme, [key]: font})} />
        <p className="truncate rounded bg-white/5 px-2 py-1.5 text-zinc-200" style={{fontFamily: FONT_STACKS[theme[key] ?? "SYSTEM"], fontSize: key === "headingFont" ? 20 : 14}}>{key === "headingFont" ? "Waterfront living" : "Light-filled interiors and calm, open spaces."}</p>
      </div>)}
      <Segmented label="Type size" value={theme.scale} options={SCALES} onChange={scale => onTheme({...theme, scale})} />
      <Segmented label="Corners" value={theme.radius} options={RADII} onChange={radius => onTheme({...theme, radius})} />
      <Segmented label="Buttons" value={theme.buttonShape ?? "ROUNDED"} options={BUTTON_SHAPES} labels={{ROUNDED: "Rounded", PILL: "Pill", SQUARE: "Square"}} onChange={buttonShape => onTheme({...theme, buttonShape})} />
    </Group>
  </div>;
}

export interface PageMeta { title: string; slug: string; description: string | null; seoTitle: string | null; seoDescription: string | null }

export function PageSettingsPanel({meta, onMeta, companySlug, linked}: {meta: PageMeta; onMeta: (meta: PageMeta) => void; companySlug: string; linked: LinkedData}) {
  const nullable = (value: string) => value.trim() ? value : null;
  return <div>
    <Group title="Page">
      <TextControl label="Page title" value={meta.title} max={160} onChange={title => onMeta({...meta, title})} />
      <TextControl label="Page address" value={meta.slug} max={80} onChange={slug => onMeta({...meta, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "")})} hint={`/site/${companySlug}/${meta.slug}. A new address takes effect at the next publication.`} />
      <TextControl label="Internal description" value={meta.description ?? ""} max={500} multiline onChange={value => onMeta({...meta, description: nullable(value)})} />
    </Group>
    <Group title="Search and sharing">
      <TextControl label="Search title" value={meta.seoTitle ?? ""} max={120} onChange={value => onMeta({...meta, seoTitle: nullable(value)})} hint="About 60 characters show in search results." />
      <TextControl label="Search description" value={meta.seoDescription ?? ""} max={320} multiline onChange={value => onMeta({...meta, seoDescription: nullable(value)})} hint="About 155 characters show in search results." />
      <p className="text-[11px] text-zinc-500">The sharing image is the hero photo. Drafts and previews are never indexed.</p>
    </Group>
    <Group title="Linked CRM record">
      <p className="text-sm text-zinc-300">{linked.project ? `Project: ${linked.project.name}` : linked.listing ? `Listing: ${linked.listing.title}` : linked.property ? `Property: ${linked.property.type ?? "property"}` : "None. Create a new page from a record to link one."}</p>
      {linked.unavailable.length > 0 && <ul className="space-y-1 text-[11px] text-amber-300">{linked.unavailable.map(note => <li key={note}>{note}</li>)}</ul>}
    </Group>
  </div>;
}
