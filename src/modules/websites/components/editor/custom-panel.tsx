"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ChevronRight, Copy, Plus, Trash2 } from "lucide-react";
import {
  cloneRow, columnWidgets, createWidget, duplicateWidget, insertWidget, isInnerColumn, moveWidget, newRow, parseWidgetPath, removeWidget, setColumnWidth, setRowLayout, updateWidget, widgetAt,
} from "../../custom-ops";
import type { LinkedData } from "../../linked";
import {
  ANIMATIONS, COLUMN_LAYOUTS, HIGHLIGHT_ICONS, MAX_BOX, MAX_EXTRA_ROWS, MAX_ROWS, MAX_WIDGETS_PER_COLUMN, ROW_ALIGNS, SIMPLE_WIDGET_TYPES, STAT_SOURCES, STAT_SOURCE_LABELS, WIDGET_ALIGNS, WIDGET_DEFINITIONS, WIDGET_TYPES,
  DEFAULT_ELEMENT_STYLE, columnWidths, isDefaultElementStyle, type ColumnLayout, type CustomColumn, type CustomRow, type InnerColumn, type PageSection, type Widget, type WidgetOf, type WidgetStyle, type WidgetType,
} from "../../registry";
import { BoxControl, ColorControl, Group, OptionalSlider, Segmented, SelectControl, Slider, Toggle, humanize } from "./controls";
import { useEditorServices } from "./editor-context";
import { ElementStyleControls } from "./element-panel";
import { ImagePicker } from "./media-picker";
import { WIDGET_ICONS } from "./panels";
// Only ContentField is used from section-panel, and only while rendering: the two modules import each other.
import { ContentField, type Spec } from "./section-panel";

/** Widgets whose text, image or button takes an element style (typography, colours, radius). */
const TEXT_STYLE_KINDS: Partial<Record<WidgetType, "text" | "button" | "image" | "card">> = {HEADING: "text", TEXT: "text", ICON_BOX: "text", ICON_LIST: "text", BUTTON: "button", IMAGE: "image", FORM: "card"};

/*
 * Rows → columns → widgets (Elementor-style): the structure editor of a
 * custom section or of content added to a built-in section, column widths
 * and device behaviour, container styling, inner sections, and the settings
 * of one widget (Content / Style / Advanced). Everything is plain data
 * validated by the registry.
 */

export const LAYOUT_LABELS: Record<ColumnLayout, string> = {
  "1": "100", "1-1": "50 / 50", "1-2": "33 / 67", "2-1": "67 / 33", "1-3": "25 / 75", "3-1": "75 / 25", "1-1-1": "33 × 3", "1-2-1": "25 / 50 / 25",
  "1-1-1-1": "25 × 4", "1-1-1-1-1": "20 × 5", "1-1-1-1-1-1": "16 × 6",
};
const small = "rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-30";

/** A thumbnail of a column layout or of custom widths. */
export function LayoutIcon({layout, widths, className = "h-5 w-9"}: {layout: ColumnLayout; widths?: number[] | null; className?: string}) {
  const parts = widths ?? layout.split("-").map(Number);
  return <span aria-hidden="true" className={`flex gap-0.5 ${className}`}>{parts.map((part, index) => <span key={index} className="rounded-[2px] bg-current" style={{flex: part}} />)}</span>;
}

export function LayoutPicker({value, onChange, columns = 3}: {value: ColumnLayout | null; onChange: (layout: ColumnLayout) => void; columns?: 3 | 4}) {
  return <div className={`grid gap-1.5 ${columns === 4 ? "grid-cols-4" : "grid-cols-3"}`} role="radiogroup" aria-label="Column layout">
    {COLUMN_LAYOUTS.map(layout => <button key={layout} type="button" role="radio" aria-checked={value === layout} title={LAYOUT_LABELS[layout]} aria-label={`${LAYOUT_LABELS[layout]} columns`} onClick={() => onChange(layout)}
      className={`flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[10px] tabular-nums ${value === layout ? "border-sky-400 bg-sky-500/15 text-sky-200" : "border-white/10 text-zinc-400 hover:border-white/30 hover:text-white"}`}>
      <LayoutIcon layout={layout} />{LAYOUT_LABELS[layout]}
    </button>)}
  </div>;
}

function WidgetAdder({onAdd, disabled, inner = false}: {onAdd: (type: WidgetType) => void; disabled: boolean; inner?: boolean}) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-md border border-dashed border-white/20 px-2 py-1 text-[11px] text-zinc-300 hover:border-sky-400 hover:text-white disabled:opacity-40"><Plus className="size-3" aria-hidden="true" />Add widget</button>;
  return <div className="grid grid-cols-3 gap-1 rounded-md border border-white/10 bg-zinc-950 p-1.5">
    {(inner ? SIMPLE_WIDGET_TYPES : WIDGET_TYPES).map(type => { const Icon = WIDGET_ICONS[type]; return <button key={type} type="button" onClick={() => { onAdd(type); setOpen(false); }}
      className="flex flex-col items-center gap-1 rounded px-1 py-1.5 text-[10px] text-zinc-300 hover:bg-sky-500/15 hover:text-white"><Icon className="size-4" aria-hidden="true" />{WIDGET_DEFINITIONS[type].label}</button>; })}
    <button type="button" onClick={() => setOpen(false)} className="col-span-3 py-1 text-[10px] text-zinc-500 hover:text-white">Cancel</button>
  </div>;
}

function Collapsible({title, children, defaultOpen = false}: {title: string; children: ReactNode; defaultOpen?: boolean}) {
  const [open, setOpen] = useState(defaultOpen);
  return <div className="rounded border border-white/10">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-white">
      {title}<ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>
    {open && <div className="space-y-3 border-t border-white/10 p-2">{children}</div>}
  </div>;
}

type ColumnSettings = {layout: ColumnLayout; widths: number[] | null; stackOnTablet: boolean; mobile: "STACK" | "KEEP"; reverseOnMobile: boolean; gap: "SM" | "MD" | "LG"; columns: Array<CustomColumn | InnerColumn>};

/** Layout, column widths (in percent, adding up to 100) and how the columns behave on tablets and phones. */
export function ColumnLayoutControl<T extends ColumnSettings>({value, onChange}: {value: T; onChange: (value: T) => void}) {
  const {elementIds} = useEditorServices();
  const widths = columnWidths(value);
  return <div className="space-y-3">
    <LayoutPicker value={value.widths ? null : value.layout} onChange={layout => onChange(setRowLayout(value, layout, elementIds()))} />
    {value.columns.length > 1 && <div className="space-y-2 rounded-md border border-white/10 p-2" role="group" aria-label="Column widths">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-zinc-200">Column widths</p>
        {value.widths && <button type="button" onClick={() => onChange({...value, widths: null})} className="text-[11px] text-zinc-400 hover:text-white">Use the layout</button>}
      </div>
      <LayoutIcon layout={value.layout} widths={widths} className="h-3 w-full text-sky-400/70" />
      {widths.map((width, index) => <label key={index} className="flex items-center gap-2 text-[11px] text-zinc-300">
        <span className="w-16 shrink-0">Column {index + 1}</span>
        <input type="range" min={5} max={95} value={width} aria-label={`Column ${index + 1} width`} onChange={event => onChange({...value, widths: setColumnWidth(widths, index, Number(event.target.value))})} className="min-w-0 flex-1 accent-sky-500" />
        <input type="number" min={5} max={95} value={width} aria-label={`Column ${index + 1} width in percent`} onChange={event => { const number = Number(event.target.value); if (Number.isFinite(number)) onChange({...value, widths: setColumnWidth(widths, index, number)}); }}
          className="h-7 w-12 rounded border border-white/10 bg-white/5 px-1 text-center tabular-nums text-zinc-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
        <span className="w-3 text-zinc-500">%</span>
      </label>)}
      <p className="text-[10px] leading-4 text-zinc-500">Changing a column takes the difference from the column next to it, so the row always adds up to 100%.</p>
    </div>}
    <div className="grid grid-cols-2 gap-2">
      <SelectControl label="Gap" value={value.gap} options={["SM", "MD", "LG"] as const} labels={{SM: "Small", MD: "Medium", LG: "Large"}} onChange={gap => onChange({...value, gap})} />
      <SelectControl label="Tablet" value={value.stackOnTablet ? "STACK" : "COLUMNS"} options={["COLUMNS", "STACK"] as const} labels={{COLUMNS: "Columns", STACK: "Stacked"}}
        onChange={choice => onChange({...value, stackOnTablet: choice === "STACK"})} />
    </div>
    <Segmented label="Phone" value={value.mobile} options={["STACK", "KEEP"] as const} labels={{STACK: "Stack columns", KEEP: "Side by side"}} onChange={mobile => onChange({...value, mobile})} />
    {value.mobile === "STACK" && value.columns.length > 1 && <Toggle label="Reverse order on phones" checked={value.reverseOnMobile} onChange={reverseOnMobile => onChange({...value, reverseOnMobile})} hint="For example, show the image above its text." />}
  </div>;
}

/** The columns of a row or inner section, each with its widgets and settings. */
function ColumnsList({section, columns, path, onChange, onWidget}: {section: PageSection; columns: Array<CustomColumn | InnerColumn>; path: string; onChange: (section: PageSection) => void; onWidget: (path: string) => void}) {
  const {elementIds} = useEditorServices();
  return <>{columns.map((column, columnIndex) => {
    const columnPath = `${path}.${columnIndex}`;
    const inner = isInnerColumn(columnPath);
    const setColumn = (patch: Partial<CustomColumn>) => onChange(writeColumn(section, columnPath, {...column, ...patch}));
    return <div key={column.id} className="space-y-1.5 rounded border border-white/10 p-1.5">
      <p className="flex items-center justify-between text-[11px] font-medium text-zinc-400"><span>Column {columnIndex + 1}</span><span>{column.widgets.length}/{MAX_WIDGETS_PER_COLUMN}</span></p>
      <ul className="space-y-1">{column.widgets.map((widget, widgetIndex) => <li key={widget.id}>
        <button type="button" onClick={() => onWidget(`${columnPath}.widgets.${widgetIndex}`)}
          className="flex w-full items-center justify-between gap-2 rounded bg-white/5 px-2 py-1.5 text-left text-xs text-zinc-200 hover:bg-sky-500/15">
          <span className="flex min-w-0 items-center gap-1.5">{(() => { const Icon = WIDGET_ICONS[widget.type]; return <Icon className="size-3.5 shrink-0 text-zinc-400" aria-hidden="true" />; })()}<span className="truncate">{widgetSummary(widget as Widget)}</span></span>
          <ChevronRight className="size-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
        </button>
      </li>)}</ul>
      <WidgetAdder inner={inner} disabled={column.widgets.length >= MAX_WIDGETS_PER_COLUMN} onAdd={type => {
        const inserted = insertWidget(section, columnPath, createWidget(type, elementIds()));
        if (inserted) { onChange(inserted.section); onWidget(inserted.path); }
      }} />
      <Collapsible title="Column style">
        <ColorControl label="Background" value={column.background} onChange={background => setColumn({background})} />
        <BoxControl label="Padding" value={column.padding} min={0} max={MAX_BOX} inherited={{top: 0, right: 0, bottom: 0, left: 0}} onChange={padding => setColumn({padding})} />
        <Segmented label="Content position" value={column.verticalAlign} options={WIDGET_ALIGNS} labels={{START: "Top", CENTER: "Middle", END: "Bottom"}} onChange={verticalAlign => setColumn({verticalAlign})} />
      </Collapsible>
    </div>;
  })}</>;
}

/** Replaces a column at a path (relative to the props of a custom section, or to the section for added content). */
function writeColumn(section: PageSection, path: string, column: CustomColumn | InnerColumn): PageSection {
  const keys = path.split(".");
  const extra = keys[0] === "extra";
  const set = (target: unknown, rest: string[]): unknown => {
    const [head, ...tail] = rest;
    const copy: Record<string, unknown> | unknown[] = Array.isArray(target) ? [...target] : {...(target as Record<string, unknown>)};
    (copy as Record<string, unknown>)[head] = tail.length ? set((target as Record<string, unknown>)[head], tail) : column;
    return copy;
  };
  return (extra ? set(section, keys) : {...section, props: set(section.props, keys)}) as PageSection;
}

/**
 * Rows of columns: a custom section's rows ("rows") or the content added to
 * a built-in section ("extra.rows"). Each row is a container with its own
 * layout, widths, device behaviour and style.
 */
export function StructureControl({section, prefix = "rows", linked, onChange, onWidget}: {section: PageSection; prefix?: "rows" | "extra.rows"; linked: LinkedData; onChange: (section: PageSection) => void; onWidget: (path: string | null) => void}) {
  const {elementIds} = useEditorServices();
  const [adding, setAdding] = useState(false);
  const extra = prefix === "extra.rows";
  const rows: CustomRow[] = extra ? section.extra?.rows ?? [] : section.type === "CUSTOM" ? section.props.rows : [];
  const max = extra ? MAX_EXTRA_ROWS : MAX_ROWS;
  const setRows = (next: CustomRow[]) => onChange(extra
    ? {...section, extra: next.length ? {position: section.extra?.position ?? "AFTER", rows: next} : null} as PageSection
    : {...section, props: {...section.props, rows: next}} as PageSection);
  const setRow = (index: number, row: CustomRow) => setRows(rows.map((item, position) => position === index ? row : item));
  const moveRow = (index: number, delta: number) => { const next = [...rows]; const [row] = next.splice(index, 1); next.splice(index + delta, 0, row); setRows(next); };
  return <div className="space-y-3">
    {rows.map((row, rowIndex) => <div key={row.id} className="rounded-md border border-white/10 bg-white/[0.03]">
      <div className="flex items-center justify-between border-b border-white/10 px-2 py-1.5">
        <span className="flex items-center gap-2 text-xs font-semibold text-zinc-200"><LayoutIcon layout={row.layout} widths={row.widths} />Row {rowIndex + 1}</span>
        <span className="flex gap-0.5">
          <button type="button" className={small} aria-label={`Move row ${rowIndex + 1} up`} disabled={rowIndex === 0} onClick={() => moveRow(rowIndex, -1)}><ArrowUp className="size-3.5" /></button>
          <button type="button" className={small} aria-label={`Move row ${rowIndex + 1} down`} disabled={rowIndex === rows.length - 1} onClick={() => moveRow(rowIndex, 1)}><ArrowDown className="size-3.5" /></button>
          <button type="button" className={small} aria-label={`Duplicate row ${rowIndex + 1}`} disabled={rows.length >= max} onClick={() => setRows([...rows.slice(0, rowIndex + 1), cloneRow(row, elementIds()), ...rows.slice(rowIndex + 1)])}><Copy className="size-3.5" /></button>
          <button type="button" className={`${small} hover:bg-red-500/20 hover:text-red-300`} aria-label={`Delete row ${rowIndex + 1}`} disabled={!extra && rows.length <= 1} onClick={() => setRows(rows.filter((_, index) => index !== rowIndex))}><Trash2 className="size-3.5" /></button>
        </span>
      </div>
      <div className="space-y-2.5 p-2">
        <ColumnLayoutControl value={row} onChange={next => setRow(rowIndex, next)} />
        <Collapsible title="Container style">
          <ColorControl label="Background colour" value={row.background} onChange={background => setRow(rowIndex, {...row, background})} />
          <ImagePicker label="Background image" value={row.backgroundImage} onChange={backgroundImage => setRow(rowIndex, {...row, backgroundImage})} linked={linked} />
          {row.backgroundImage && <Slider label="Dark overlay" value={row.overlay} min={0} max={90} step={5} unit="%" onChange={overlay => setRow(rowIndex, {...row, overlay})} />}
          <BoxControl label="Padding" value={row.padding} min={0} max={MAX_BOX} inherited={row.background || row.backgroundImage ? {top: 40, right: 40, bottom: 40, left: 40} : {top: 0, right: 0, bottom: 0, left: 0}} onChange={padding => setRow(rowIndex, {...row, padding})} />
          <OptionalSlider label="Corner radius" value={row.radius} min={0} max={80} unit="px" fallback={16} onChange={radius => setRow(rowIndex, {...row, radius})} />
          <OptionalSlider label="Minimum height" value={row.minHeight} min={0} max={1200} step={10} unit="px" fallback={400} onChange={minHeight => setRow(rowIndex, {...row, minHeight})} />
          <Segmented label="Align columns" value={row.align} options={ROW_ALIGNS} labels={{STRETCH: "Stretch", START: "Top", CENTER: "Middle", END: "Bottom"}} onChange={align => setRow(rowIndex, {...row, align})} />
        </Collapsible>
        <ColumnsList section={section} columns={row.columns} path={`${prefix}.${rowIndex}.columns`} onChange={onChange} onWidget={onWidget} />
      </div>
    </div>)}
    {rows.length < max && (adding
      ? <div className="space-y-2 rounded-md border border-sky-400/30 p-2"><p className="text-xs text-zinc-300">Choose the structure of the new row</p>
          <LayoutPicker value={null} onChange={layout => { setRows([...rows, newRow(layout, elementIds())]); setAdding(false); }} />
          <button type="button" onClick={() => setAdding(false)} className="text-[11px] text-zinc-500 hover:text-white">Cancel</button></div>
      : <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-white/20 px-3 py-1.5 text-xs text-zinc-300 hover:border-sky-400 hover:text-white"><Plus className="size-3.5" aria-hidden="true" />{extra && !rows.length ? "Add columns to this section" : "Add row"}</button>)}
  </div>;
}

/** A short label for the structure list and the navigator. */
export function widgetSummary(widget: Widget) {
  const label = WIDGET_DEFINITIONS[widget.type].label;
  const text = widget.type === "HEADING" || widget.type === "TEXT" ? widget.props.text : widget.type === "BUTTON" ? widget.props.cta.label : widget.type === "ICON_BOX" ? widget.props.title
    : widget.type === "COUNTER" ? widget.props.label : widget.type === "INNER_SECTION" ? `${widget.props.columns.length} columns` : "";
  return text ? `${label}: ${text.slice(0, 32)}` : label;
}

/** "rows.0.columns.1.widgets.2.props.columns.0.widgets.1" → ["Row 1", "Column 2", "Inner section", "Column 1"]. */
export function pathTrail(path: string) {
  const parts = path.split(".");
  const trail: string[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    if (parts[index] === "rows") trail.push(`Row ${Number(parts[index + 1]) + 1}`);
    if (parts[index] === "columns") trail.push(`${parts[index - 1] === "props" ? "Inner column" : "Column"} ${Number(parts[index + 1]) + 1}`);
  }
  if (parts[0] === "extra") trail.unshift("Added content");
  return trail;
}

const t = (key: string, label: string, max: number, hint?: string): Spec => ({key, label, kind: "text", max, hint});
const ta = (key: string, label: string, max: number, hint?: string): Spec => ({key, label, kind: "textarea", max, hint});
const ICON_OPTIONS = Object.fromEntries(HIGHLIGHT_ICONS.map(icon => [icon, humanize(icon)]));
const WIDGET_FIELD_SPECS: Record<WidgetType, Spec[]> = {
  HEADING: [t("eyebrow", "Small label above", 60), t("text", "Heading", 200), {key: "level", label: "Level", kind: "select", options: ["H1", "H2", "H3", "H4"]},
    {key: "size", label: "Size", kind: "select", options: ["SM", "MD", "LG", "XL"], labels: {SM: "S", MD: "M", LG: "L", XL: "XL"}}],
  TEXT: [ta("text", "Text", 3000, "Plain text. Line breaks are kept."), {key: "size", label: "Size", kind: "select", options: ["SM", "MD", "LG"], labels: {SM: "S", MD: "M", LG: "L"}}, {key: "muted", label: "Softer colour", kind: "toggle"}],
  IMAGE: [{key: "image", label: "Image", kind: "image"}, {key: "ratio", label: "Shape", kind: "dropdown", options: ["AUTO", "SQUARE", "PORTRAIT", "LANDSCAPE", "WIDE"], labels: {AUTO: "4:3", SQUARE: "Square", PORTRAIT: "Portrait 4:5", LANDSCAPE: "Landscape 3:2", WIDE: "Wide 16:9"}},
    {key: "rounded", label: "Rounded corners", kind: "toggle"}, t("caption", "Caption", 160)],
  BUTTON: [{key: "cta", label: "Button", kind: "cta"}, {key: "variant", label: "Style", kind: "select", options: ["SOLID", "OUTLINE"]}, {key: "full", label: "Full width", kind: "toggle"}],
  ICON_LIST: [{key: "items", label: "Points", kind: "iconItems"}],
  ICON_BOX: [{key: "icon", label: "Icon", kind: "dropdown", options: HIGHLIGHT_ICONS, labels: ICON_OPTIONS}, t("title", "Title", 80), ta("text", "Text", 400), {key: "boxed", label: "Card background", kind: "toggle"}],
  COUNTER: [{key: "source", label: "Value", kind: "dropdown", options: STAT_SOURCES, labels: STAT_SOURCE_LABELS}, t("value", "Custom value (custom text only)", 40, "CRM facts always show the recorded value."), t("label", "Label", 60)],
  VIDEO: [{key: "video", label: "Video", kind: "videoRequired"}, {key: "poster", label: "Poster image", kind: "image"}, {key: "ratio", label: "Shape", kind: "select", options: ["LANDSCAPE", "WIDE", "SQUARE"]}],
  SPACER: [{key: "height", label: "Height", kind: "number", min: 8, max: 240, unit: " px"}],
  DIVIDER: [{key: "width", label: "Width", kind: "select", options: ["SHORT", "FULL"]}],
  MAP: [{key: "custom", label: "Location", kind: "location"}, {key: "showMap", label: "Offer an interactive map (loads only when a visitor asks)", kind: "toggle"}],
  FORM: [{key: "form", label: "Lead form", kind: "leadForm"}, t("submitLabel", "Button label", 40)],
  CONTACT_CARD: [{key: "agentId", label: "Agent", kind: "agent"}, {key: "showCompany", label: "Show company contacts", kind: "toggle", hint: "Phone, WhatsApp, email, office and hours from the brand settings."}],
  GALLERY: [{key: "images", label: "Images", kind: "images"}, {key: "columns", label: "Columns", kind: "columns"}, {key: "lightbox", label: "Open images full screen", kind: "toggle"}],
  INNER_SECTION: [],
};

export function WidgetPanel({section, path, linked, onChange, onWidget}: {section: PageSection; path: string; linked: LinkedData; onChange: (section: PageSection) => void; onWidget: (path: string | null) => void}) {
  const {elementIds} = useEditorServices();
  const [tab, setTab] = useState<"content" | "style" | "advanced">("content");
  const widget = widgetAt(section, path);
  const address = parseWidgetPath(path);
  if (!widget || !address) return <div className="p-4 text-sm text-zinc-400">This widget no longer exists. <button type="button" className="underline" onClick={() => onWidget(null)}>Back to the section</button></div>;
  const set = (next: Widget) => onChange(updateWidget(section, path, next));
  const setStyle = (patch: Partial<WidgetStyle>) => set({...widget, style: {...widget.style, ...patch}} as Widget);
  const definition = WIDGET_DEFINITIONS[widget.type];
  const count = columnWidgets(section, address.column)?.length ?? 0;
  // An inner widget goes back to its inner section; others to the section.
  const parent = isInnerColumn(address.column) ? address.column.replace(/\.props\.columns\.\d+$/, "") : null;
  return <div>
    <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2 text-[11px] text-zinc-400">
      <button type="button" onClick={() => onWidget(parent)} aria-label={parent ? "Back to the inner section" : "Back to the section"} className="rounded p-1 hover:bg-white/10 hover:text-white"><ArrowLeft className="size-3.5" /></button>
      <span className="truncate">{pathTrail(path).join(" › ")} › <span className="font-semibold text-white">{definition.label}</span></span>
    </div>
    <div className="flex items-center justify-end gap-0.5 border-b border-white/10 px-2 py-1">
      <button type="button" className={small} aria-label="Move widget up" disabled={address.index === 0} onClick={() => { const moved = moveWidget(section, path, -1); onChange(moved.section); onWidget(moved.path); }}><ArrowUp className="size-3.5" /></button>
      <button type="button" className={small} aria-label="Move widget down" disabled={address.index >= count - 1} onClick={() => { const moved = moveWidget(section, path, 1); onChange(moved.section); onWidget(moved.path); }}><ArrowDown className="size-3.5" /></button>
      <button type="button" className={small} aria-label="Duplicate widget" disabled={count >= MAX_WIDGETS_PER_COLUMN || widget.type === "FORM"} onClick={() => { const copy = duplicateWidget(section, path, elementIds()); if (copy) { onChange(copy.section); onWidget(copy.path); } }}><Copy className="size-3.5" /></button>
      <button type="button" className={`${small} hover:bg-red-500/20 hover:text-red-300`} aria-label="Delete widget" onClick={() => { onChange(removeWidget(section, path)); onWidget(parent); }}><Trash2 className="size-3.5" /></button>
    </div>
    <div role="tablist" aria-label="Widget settings" className="grid grid-cols-3 border-b border-white/10">
      {(["content", "style", "advanced"] as const).map(option => <button key={option} type="button" role="tab" aria-selected={tab === option} onClick={() => setTab(option)}
        className={`border-b-2 py-2.5 text-xs font-semibold uppercase tracking-wider ${tab === option ? "border-sky-400 text-white" : "border-transparent text-zinc-400 hover:text-white"}`}>{option}</button>)}
    </div>
    <div role="tabpanel">
      {tab === "content" && <div className="space-y-5 p-4">
        {widget.type === "INNER_SECTION" && <InnerSectionControl section={section} path={path} widget={widget} onChange={onChange} onWidget={onWidget} />}
        {WIDGET_FIELD_SPECS[widget.type].map(spec => <ContentField key={spec.key} spec={spec} section={widget} linked={linked} onProps={props => set({...widget, props} as Widget)} />)}
        <p className="text-[11px] text-zinc-500">{definition.description}{widget.type === "INNER_SECTION" ? " Drag widgets onto its columns on the page, or add them here." : " Text can also be edited on the page."}</p>
      </div>}
      {tab === "style" && <div>
        <Group title="Layout"><Segmented label="Alignment" value={widget.style.align} options={WIDGET_ALIGNS} labels={{START: "Left", CENTER: "Centre", END: "Right"}} onChange={align => setStyle({align})} /></Group>
        {TEXT_STYLE_KINDS[widget.type] ? <ElementStyleControls widget kind={TEXT_STYLE_KINDS[widget.type]!} value={widget.style.text ?? DEFAULT_ELEMENT_STYLE}
          onChange={text => setStyle({text: isDefaultElementStyle(text) ? null : text})} />
          : <Group title="Colour"><ColorControl label="Text colour" value={widget.style.color} onChange={color => setStyle({color})} /></Group>}
        <Group title="Motion"><SelectControl label="Entrance animation" value={widget.style.animation} options={ANIMATIONS} onChange={animation => setStyle({animation})} /></Group>
      </div>}
      {tab === "advanced" && <div>
        <Group title="Spacing">
          <BoxControl label="Padding" value={widget.style.padding} min={0} max={MAX_BOX} inherited={{top: 0, right: 0, bottom: 0, left: 0}} onChange={padding => setStyle({padding})} />
          <BoxControl label="Margin" value={widget.style.margin} min={-MAX_BOX} max={MAX_BOX} inherited={{top: 0, right: 0, bottom: 0, left: 0}} onChange={margin => setStyle({margin})} hint="Negative values pull the widget towards its neighbours." />
        </Group>
        <Group title="Visibility">
          {(["desktop", "tablet", "mobile"] as const).map(name => <Toggle key={name} label={`Show on ${name}`} checked={widget.style.devices[name]} onChange={checked => setStyle({devices: {...widget.style.devices, [name]: checked}})} />)}
        </Group>
        <Group title="Widget" defaultOpen={false}><p className="font-mono text-xs text-zinc-400">ID: {widget.id}</p></Group>
      </div>}
    </div>
  </div>;
}

/** An inner section's columns: layout, widths, device behaviour and each column's widgets. */
function InnerSectionControl({section, path, widget, onChange, onWidget}: {section: PageSection; path: string; widget: WidgetOf<"INNER_SECTION">; onChange: (section: PageSection) => void; onWidget: (path: string | null) => void}) {
  return <div className="space-y-3">
    <ColumnLayoutControl value={widget.props} onChange={props => onChange(updateWidget(section, path, {...widget, props}))} />
    <ColumnsList section={section} columns={widget.props.columns} path={`${path}.props.columns`} onChange={onChange} onWidget={onWidget} />
  </div>;
}
