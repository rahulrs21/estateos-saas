"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type DragEvent, type MouseEvent as ReactMouseEvent, type ReactElement } from "react";
import {
  ArrowDown, ArrowLeft, ArrowUp, BookmarkPlus, ClipboardPaste, Copy, Eye, EyeOff, GripVertical, Layers, LayoutGrid, Loader2, Monitor, Paintbrush, PanelLeftClose, PanelLeftOpen, Plus,
  Keyboard, Redo2, Rocket, Save, Settings2, Smartphone, Sparkles, Tablet, Trash2, Undo2, X,
} from "lucide-react";
import { toast } from "sonner";
import { STATUS_LABELS, WebsiteRequestError, errorMessage, websitesGet, websitesSend } from "../../client";
import { sectionAvailability } from "../../linked";
import { MAX_BRIEF_CHARS } from "../../policy";
import {
  acceptsExtra, DESIGN_STYLES, DESIGN_STYLE_LABELS, MAX_OFFSET, MAX_SECTIONS, SECTION_DEFINITIONS, WIDGET_DEFINITIONS, WIDGET_TYPES, sectionWidgets, withStyleDefaults, type WidgetType, createSection, newSectionId, pageDataSchema,
  type PageData, type PageSection, type SectionType,
} from "../../registry";
import type { EditorPayload } from "../../server/service";
import type { ElementKind } from "../../theme";
import { PageRenderer, type EditBindings } from "../page-renderer";
import { PublishPanel } from "../publish-panel";
import { addToSection, createWidget, duplicateWidget, formWidgetCount, insertWidget, isColumnPath, newRow, pageElementIds, parseWidgetPath, relocateWidget, removeWidget, widgetAt, withFreshIds } from "../../custom-ops";
import { DRAG_MOVE, DRAG_NEW, DRAG_PLACED, DRAG_WIDGET, ElementsPanel, NavigatorPanel, PageSettingsPanel, SECTION_ICONS, SiteStylePanel, type PageMeta } from "./panels";
import { BrandContactsDrawer } from "./connections";
import { EditorServicesContext, type EditorServices } from "./editor-context";
import { MySections, SaveSectionDialog } from "./library";
import { ChecklistFixAction } from "./publish-fixes";
import { StructurePicker } from "./structure-picker";
import { ShortcutSheet } from "./shortcuts";
import { SectionPanel, elementLabel, type Device, type SectionTab } from "./section-panel";

interface Draft { data: PageData; meta: PageMeta }
type LeftTab = "elements" | "navigator" | "style" | "page" | "publish";
const HISTORY_LIMIT = 80;
type MenuKey = "edit" | "duplicate" | "copy" | "paste" | "save" | "up" | "down" | "toggle" | "delete";
const MENU_ITEMS = [["edit", "Edit section", Settings2], ["duplicate", "Duplicate", Copy], ["copy", "Copy style", Paintbrush], ["paste", "Paste style", ClipboardPaste], ["save", "Save to library", BookmarkPlus],
  ["up", "Move up", ArrowUp], ["down", "Move down", ArrowDown], ["toggle", "Hide", EyeOff], ["delete", "Delete", Trash2]] as const satisfies ReadonlyArray<readonly [MenuKey, string, unknown]>;
const DEVICE_WIDTHS: Record<Device, string> = {desktop: "100%", tablet: "820px", mobile: "390px"};

/** Below 1024 px the editor panel becomes a drawer and a bottom bar holds the main actions. */
const NARROW = "(max-width: 1023px)";
const subscribeNarrow = (change: () => void) => { const query = window.matchMedia(NARROW); query.addEventListener("change", change); return () => query.removeEventListener("change", change); };
const useNarrow = () => useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);

/** Fills defaults for fields added after the page was saved (older pages, or a server still running older code). */
function normalized(data: PageData): PageData {
  const parsed = pageDataSchema.safeParse(data);
  return parsed.success ? parsed.data : data;
}

function draftOf(payload: EditorPayload): Draft {
  return {data: normalized(payload.data), meta: {title: payload.page.title, slug: payload.page.slug, description: payload.page.description, seoTitle: payload.page.seoTitle, seoDescription: payload.page.seoDescription}};
}
const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

/** Sets a nested prop by a dotted path such as "items.2.title" (inline editing). */
function setPath(target: Record<string, unknown>, path: string, value: string): Record<string, unknown> {
  const [head, ...rest] = path.split(".");
  const container = Array.isArray(target) ? [...target] as unknown as Record<string, unknown> : {...target};
  const key = Array.isArray(target) ? Number(head) : head;
  (container as Record<string | number, unknown>)[key] = rest.length ? setPath((target as Record<string | number, unknown>)[key] as Record<string, unknown>, rest.join("."), value) : value;
  return container;
}

export function EditorShell({organizationId, pageId, fontClassName}: {organizationId: string; pageId: string; fontClassName: string}) {
  const [payload, setPayload] = useState<EditorPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [past, setPast] = useState<Draft[]>([]);
  const [future, setFuture] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [brandOpen, setBrandOpen] = useState(false);
  const [saveSection, setSaveSection] = useState<PageSection | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [zoom, setZoom] = useState<1 | 0.75>(1);
  /** An element clicked on the canvas (its prop path), only while its section is selected. */
  const [elementPick, setElementPick] = useState<{sectionId: string; key: string; kind: ElementKind} | null>(null);
  const [sectionTab, setSectionTab] = useState<SectionTab>("content");
  const element = elementPick && elementPick.sectionId === selected ? elementPick.key : null;
  /** A widget of the selected custom section ("rows.0.columns.1.widgets.2"). */
  const [widgetPick, setWidgetPick] = useState<{sectionId: string; path: string} | null>(null);
  const widget = widgetPick && widgetPick.sectionId === selected ? widgetPick.path : null;
  const [dropColumn, setDropColumn] = useState<{sectionId: string; path: string} | null>(null);
  /** A widget dragged over a built-in section is added inside it (before or after its content). */
  const [dropInto, setDropInto] = useState<{sectionId: string; position: "BEFORE" | "AFTER"} | null>(null);
  /** The structure picker for a new section, and where the section goes. */
  const [structureAt, setStructureAt] = useState<{index?: number} | null>(null);
  const narrow = useNarrow();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const draftRef = useRef<Draft | null>(null);
  const [leftTab, setLeftTab] = useState<LeftTab>("elements");
  const [panelOpen, setPanelOpen] = useState(true);
  const [device, setDevice] = useState<Device>("desktop");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dropAt, setDropAt] = useState<{id: string; before: boolean} | null>(null);
  const [menu, setMenu] = useState<{x: number; y: number; id: string} | null>(null);
  const [styleClipboard, setStyleClipboard] = useState<Pick<PageSection, "style" | "layout"> | null>(null);
  const [generating, setGenerating] = useState<{brief: string; style: string} | null>(null);
  const [generateBusy, setGenerateBusy] = useState(false);
  const announce = useRef<HTMLParagraphElement>(null);
  /** Set by a canvas "+" button: the next element chosen is inserted after this section. */
  const insertAfterRef = useRef<string | null>(null);

  const load = useCallback((version: number | null = null) => websitesGet<EditorPayload>(`/api/websites/pages/${pageId}${version ? `?version=${version}` : ""}`).then(data => {
    setPayload(data);
    setLoadError(null);
    if (!version) { const next = draftOf(data); setDraft(next); setSaved(next); setPast([]); setFuture([]); }
  }, error => setLoadError(errorMessage(error, "The page could not be loaded."))), [pageId]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => { draftRef.current = draft; }, [draft]);
  const dirty = Boolean(draft && saved && !same(draft, saved));
  const viewingOldVersion = previewVersion !== null && payload?.version.versionNumber === previewVersion;
  const editable = Boolean(payload?.permissions.canEdit) && !viewingOldVersion;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const commit = useCallback((next: Draft) => {
    if (!draft || !editable) return;
    setPast(items => [...items.slice(-(HISTORY_LIMIT - 1)), draft]);
    setFuture([]);
    setDraft(next);
  }, [draft, editable]);
  const undo = useCallback(() => {
    if (!draft || !past.length) return;
    setFuture(items => [draft, ...items].slice(0, HISTORY_LIMIT)); setDraft(past[past.length - 1]); setPast(items => items.slice(0, -1));
  }, [draft, past]);
  const redo = useCallback(() => {
    if (!draft || !future.length) return;
    setPast(items => [...items, draft].slice(-HISTORY_LIMIT)); setDraft(future[0]); setFuture(items => items.slice(1));
  }, [draft, future]);

  const validationIssues = useMemo(() => {
    if (!draft) return [];
    const result = pageDataSchema.safeParse(draft.data);
    const issues = result.success ? [] : result.error.issues.slice(0, 5).map(issue => {
      const index = typeof issue.path[1] === "number" ? issue.path[1] : null;
      const section = index !== null ? draft.data.sections[index] : null;
      return `${section ? SECTION_DEFINITIONS[section.type].label : "Page"}: ${issue.message}`;
    });
    if (!draft.meta.title.trim()) issues.push("Add a page title.");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(draft.meta.slug)) issues.push("The page address must use lowercase letters, numbers and single hyphens.");
    return issues;
  }, [draft]);

  const save = useCallback(async () => {
    if (!draft || !payload || saving || !dirty || validationIssues.length) return;
    setSaving(true); setSaveError(null);
    try {
      await websitesSend(`/api/websites/pages/${pageId}`, organizationId, "PUT", {
        expectedRevision: payload.page.revision, title: draft.meta.title.trim(), slug: draft.meta.slug, description: draft.meta.description,
        seoTitle: draft.meta.seoTitle, seoDescription: draft.meta.seoDescription, data: draft.data,
      }, "The page could not be saved.");
      toast.success("Saved as a new version.");
      await load();
    } catch (error) {
      setSaveError(error instanceof WebsiteRequestError && error.status === 409 ? `${error.message} Your edits are still here: copy anything you need, then reload.` : errorMessage(error, "The page could not be saved."));
    } finally { setSaving(false); }
  }, [draft, payload, saving, dirty, validationIssues.length, pageId, organizationId, load]);

  const sections = useMemo(() => draft?.data.sections ?? [], [draft]);
  const setSections = useCallback((next: PageSection[]) => { if (draft) commit({...draft, data: {...draft.data, sections: next}}); }, [draft, commit]);
  const say = (message: string) => { if (announce.current) announce.current.textContent = message; };
  const indexOf = (id: string) => sections.findIndex(section => section.id === id);
  const label = (section: PageSection) => SECTION_DEFINITIONS[section.type].label;

  /** Places a prepared section after the selected one (or at an index), keeping the navigation bar first and the footer last. */
  const place = useCallback((section: PageSection, index?: number) => {
    const type = section.type;
    const footer = sections.findIndex(item => item.type === "FOOTER");
    const after = selected ? sections.findIndex(item => item.id === selected) + 1 : footer >= 0 ? footer : sections.length;
    const at = Math.max(type === "NAVBAR" ? 0 : sections[0]?.type === "NAVBAR" ? 1 : 0, Math.min(index ?? (after > 0 ? after : sections.length), sections.length));
    setSections([...sections.slice(0, at), section, ...sections.slice(at)]);
    setSelected(section.id);
    say(`${SECTION_DEFINITIONS[type].label} added.`);
    requestAnimationFrame(() => document.querySelector(`[data-editor-section="${section.id}"]`)?.scrollIntoView({behavior: "smooth", block: "center"}));
  }, [sections, selected, setSections]);
  const insert = useCallback((type: SectionType, index?: number) => {
    if (sections.length >= MAX_SECTIONS) return;
    if (SECTION_DEFINITIONS[type].single && sections.some(section => section.type === type)) { toast.error(`${SECTION_DEFINITIONS[type].label} is already on the page.`); return; }
    const taken = draftRef.current ? pageElementIds(draftRef.current.data) : new Set<string>();
    const section = createSection(type, newSectionId(type, taken));
    place(section, index);
  }, [sections, place]);
  const move = useCallback((id: string, delta: number) => {
    const index = sections.findIndex(section => section.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= sections.length) return;
    const next = [...sections];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setSections(next);
    say(`${SECTION_DEFINITIONS[item.type].label} moved to position ${target + 1} of ${sections.length}.`);
  }, [sections, setSections]);
  const reorder = useCallback((id: string, toIndex: number) => {
    const from = sections.findIndex(section => section.id === id);
    if (from < 0 || from === toIndex) return;
    const next = [...sections];
    const [item] = next.splice(from, 1);
    next.splice(from < toIndex ? toIndex - 1 : toIndex, 0, item);
    setSections(next);
  }, [sections, setSections]);
  const update = useCallback((section: PageSection) => setSections(sections.map(item => item.id === section.id ? section : item)), [sections, setSections]);
  const duplicate = useCallback((id: string) => {
    const section = sections.find(item => item.id === id);
    if (!section || SECTION_DEFINITIONS[section.type].single || sections.length >= MAX_SECTIONS) return;
    const taken = draftRef.current ? pageElementIds(draftRef.current.data) : new Set(sections.map(item => item.id));
    const copyId = newSectionId(section.type, taken);
    const copy = withFreshIds(section, copyId, taken);
    const index = indexOf(id) + 1;
    setSections([...sections.slice(0, index), copy, ...sections.slice(index)]);
    setSelected(copy.id);
  }, [sections, setSections]); // eslint-disable-line react-hooks/exhaustive-deps
  const remove = useCallback((id: string) => {
    const section = sections.find(item => item.id === id);
    if (!section) return;
    setSections(sections.filter(item => item.id !== id));
    if (selected === id) setSelected(null);
    toast(`${SECTION_DEFINITIONS[section.type].label} deleted. Press Ctrl+Z to undo.`);
  }, [sections, selected, setSections]);
  /** Alt + arrow keys: move the selected element, or all of the section's content. */
  const nudge = useCallback((dx: number, dy: number) => {
    const section = sections.find(item => item.id === selected);
    if (!section || widget) return;
    const clamp = (value: number) => Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, value));
    const style = withStyleDefaults(section.style);
    if (element) {
      const current = style.elementOffsets[element] ?? {x: 0, y: 0};
      const next = {x: clamp(current.x + dx), y: clamp(current.y + dy)};
      const rest = Object.fromEntries(Object.entries(style.elementOffsets).filter(([key]) => key !== element));
      update({...section, style: {...style, elementOffsets: next.x || next.y ? {...rest, [element]: next} : rest}} as PageSection);
    } else update({...section, style: {...style, contentOffset: {x: clamp(style.contentOffset.x + dx), y: clamp(style.contentOffset.y + dy)}}} as PageSection);
  }, [sections, selected, element, widget, update]);
  /**
   * Adds a widget: into a given column, inside a built-in section (its added content), into the
   * selected section (after the selected widget), or as a new custom section at a position.
   */
  const addWidget = useCallback((type: WidgetType, target?: {sectionId: string; columnPath: string; index?: number} | {sectionIndex: number} | {sectionId: string; position: "BEFORE" | "AFTER"}) => {
    if (!draftRef.current) return;
    if (type === "FORM" && (formWidgetCount(draftRef.current.data) > 0 || sections.some(section => section.type === "ENQUIRY_FORM"))) {
      toast.error("This page already shows the lead form. A page can show it only once."); return;
    }
    const taken = pageElementIds(draftRef.current.data);
    const created = createWidget(type, taken);
    let into = target && "columnPath" in target ? target : null;
    let inside = target && "position" in target ? target : null;
    if (!target) {
      const current = sections.find(section => section.id === selected);
      const address = widget ? parseWidgetPath(widget) : null;
      if (current && address) into = {sectionId: current.id, columnPath: address.column, index: address.index + 1};
      else if (current?.type === "CUSTOM") into = {sectionId: current.id, columnPath: `rows.${current.props.rows.length - 1}.columns.0`};
      else if (current && acceptsExtra(current.type)) inside = {sectionId: current.id, position: current.extra?.position ?? "AFTER"};
    }
    const finish = (sectionId: string, result: {section: PageSection; path: string} | null) => {
      if (!result) { toast.error(type === "INNER_SECTION" ? "An inner section cannot go inside another inner section." : "The widget could not be added there."); return; }
      update(result.section);
      setSelected(sectionId); setWidgetPick({sectionId, path: result.path}); setLeftTab("elements");
      say(`${WIDGET_DEFINITIONS[type].label} added.`);
    };
    if (into) { const section = sections.find(item => item.id === into!.sectionId); if (section) finish(section.id, insertWidget(section, into.columnPath, created, into.index)); return; }
    if (inside) { const section = sections.find(item => item.id === inside!.sectionId); if (section) finish(section.id, addToSection(section, created, inside.position, taken)); return; }
    if (sections.length >= MAX_SECTIONS) return;
    const row = newRow("1", taken);
    const section = createSection("CUSTOM", newSectionId("CUSTOM", taken), {rows: [{...row, columns: [{...row.columns[0], widgets: [created]}]}]});
    place(section, target && "sectionIndex" in target ? target.sectionIndex : undefined);
    setWidgetPick({sectionId: section.id, path: "rows.0.columns.0.widgets.0"});
  }, [sections, selected, widget, update, place]);
  const removeSelectedWidget = useCallback(() => {
    const section = sections.find(item => item.id === selected);
    if (!section || !widget) return;
    update(removeWidget(section, widget)); setWidgetPick(null);
    toast("Widget deleted. Press Ctrl+Z to undo.");
  }, [sections, selected, widget, update]);
  const duplicateSelectedWidget = useCallback(() => {
    const section = sections.find(item => item.id === selected);
    if (!section || !widget || !draftRef.current || widgetAt(section, widget)?.type === "FORM") return;
    const copy = duplicateWidget(section, widget, pageElementIds(draftRef.current.data));
    if (copy) { update(copy.section); setWidgetPick({sectionId: section.id, path: copy.path}); }
  }, [sections, selected, widget, update]);
  const toggle = useCallback((id: string) => { const section = sections.find(item => item.id === id); if (section) update({...section, visible: !section.visible} as PageSection); }, [sections, update]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable));
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "s") { event.preventDefault(); void save(); return; }
      const arrows: Record<string, [number, number]> = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
      if (event.altKey && arrows[event.key] && selected && editable) {
        event.preventDefault();
        const step = event.shiftKey ? 20 : 4;
        nudge(arrows[event.key][0] * step, arrows[event.key][1] * step);
        return;
      }
      if (typing) return;
      if (event.key === "?") { event.preventDefault(); setShortcutsOpen(true); return; }
      if (mod && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if (mod && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
      else if (mod && event.key.toLowerCase() === "d" && selected) { event.preventDefault(); if (widget) duplicateSelectedWidget(); else duplicate(selected); }
      else if ((event.key === "Delete" || event.key === "Backspace") && selected && editable) {
        event.preventDefault();
        // With an element selected, Delete never removes the whole section.
        if (widget) removeSelectedWidget(); else if (element) toast("To hide this element, switch it off under Visibility in its Style tab."); else remove(selected);
      }
      else if (event.key === "Escape") { if (widget) setWidgetPick(null); else if (element) setElementPick(null); else { setSelected(null); setMenu(null); } }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, undo, redo, duplicate, remove, nudge, selected, editable, widget, element, duplicateSelectedWidget, removeSelectedWidget]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const target = dropAt;
    const column = dropColumn;
    const inside = dropInto;
    setDragging(false); setDropAt(null); setDropColumn(null); setDropInto(null);
    if (!editable) return;
    // Insert before the first widget whose middle is below the pointer.
    const indexInColumn = (drop: {sectionId: string; path: string}) => {
      const columnElement = document.querySelector(`[data-editor-section="${CSS.escape(drop.sectionId)}"] [data-column-path="${CSS.escape(drop.path)}"]`);
      const items = columnElement ? [...columnElement.querySelectorAll(":scope > [data-widget-path]")] : [];
      const index = items.findIndex(item => { const box = item.getBoundingClientRect(); return event.clientY < box.top + box.height / 2; });
      return index < 0 ? items.length : index;
    };
    const placed = event.dataTransfer.getData(DRAG_PLACED);
    if (placed) {
      let source: {sectionId: string; path: string} | null = null;
      try { const parsed = JSON.parse(placed) as {sectionId?: unknown; path?: unknown}; if (typeof parsed.sectionId === "string" && typeof parsed.path === "string" && parseWidgetPath(parsed.path)) source = {sectionId: parsed.sectionId, path: parsed.path}; } catch { source = null; }
      if (!source) return;
      if (column) movePlaced(source, {sectionId: column.sectionId, columnPath: column.path, index: indexInColumn(column)});
      else if (inside) movePlaced(source, inside);
      else if (target) movePlaced(source, {sectionIndex: target.before ? indexOf(target.id) : indexOf(target.id) + 1});
      return;
    }
    const widgetType = event.dataTransfer.getData(DRAG_WIDGET) as WidgetType;
    if (widgetType && (WIDGET_TYPES as readonly string[]).includes(widgetType)) {
      if (column) addWidget(widgetType, {sectionId: column.sectionId, columnPath: column.path, index: indexInColumn(column)});
      else if (inside) addWidget(widgetType, inside);
      else if (target) addWidget(widgetType, {sectionIndex: target.before ? indexOf(target.id) : indexOf(target.id) + 1});
      return;
    }
    if (!target) return;
    const base = indexOf(target.id);
    const index = target.before ? base : base + 1;
    const type = event.dataTransfer.getData(DRAG_NEW) as SectionType;
    const moving = event.dataTransfer.getData(DRAG_MOVE);
    if (type) insert(type, index);
    else if (moving) reorder(moving, index);
  };

  /** Moves a widget already on the page (dragged by its handle) into a column, inside a built-in section or into a new section. */
  const movePlaced = useCallback((source: {sectionId: string; path: string}, target: {sectionId: string; columnPath: string; index: number} | {sectionId: string; position: "BEFORE" | "AFTER"} | {sectionIndex: number}) => {
    if (!draftRef.current) return;
    const from = sections.find(item => item.id === source.sectionId);
    const moving = from ? widgetAt(from, source.path) : null;
    if (!from || !moving) return;
    const taken = pageElementIds(draftRef.current.data);
    const replace = (changes: PageSection[], extra?: {section: PageSection; index: number}) => {
      const byId = new Map(changes.map(item => [item.id, item]));
      const next = sections.map(item => byId.get(item.id) ?? item);
      if (extra) next.splice(Math.max(0, Math.min(extra.index, next.length)), 0, extra.section);
      setSections(next);
    };
    if ("columnPath" in target) {
      const to = sections.find(item => item.id === target.sectionId);
      const moved = to ? relocateWidget(from, source.path, to, target.columnPath, target.index) : null;
      if (!moved) { toast.error("The widget cannot go there."); return; }
      replace(from.id === to!.id ? [moved.to] : [moved.from, moved.to]);
      setSelected(target.sectionId); setWidgetPick({sectionId: target.sectionId, path: moved.path});
    } else if ("position" in target) {
      const to = sections.find(item => item.id === target.sectionId);
      if (!to || to.id === from.id) return;
      const added = addToSection(to, moving, target.position, taken);
      if (!added) return;
      replace([removeWidget(from, source.path), added.section]);
      setSelected(to.id); setWidgetPick({sectionId: to.id, path: added.path});
    } else {
      if (sections.length >= MAX_SECTIONS) return;
      const row = newRow("1", taken);
      const created = createSection("CUSTOM", newSectionId("CUSTOM", taken), {rows: [{...row, columns: [{...row.columns[0], widgets: [moving]}]}]});
      replace([removeWidget(from, source.path)], {section: created, index: target.sectionIndex});
      setSelected(created.id); setWidgetPick({sectionId: created.id, path: "rows.0.columns.0.widgets.0"});
    }
    say(`${WIDGET_DEFINITIONS[moving.type].label} moved.`);
  }, [sections, setSections]);
  /** Adds an empty custom section with the chosen column structure. */
  const addStructure = useCallback((layout: Parameters<typeof newRow>[0], index?: number) => {
    if (!draftRef.current || sections.length >= MAX_SECTIONS) return;
    const taken = pageElementIds(draftRef.current.data);
    const section = createSection("CUSTOM", newSectionId("CUSTOM", taken), {rows: [newRow(layout, taken)]});
    const footer = sections.findIndex(item => item.type === "FOOTER");
    place(section, index ?? (footer >= 0 ? footer : sections.length));
    setSectionTab("content"); setStructureAt(null); setLeftTab("elements");
    if (narrow) setDrawerOpen(true);
  }, [sections, place, narrow]);

  /** Inserts a saved section with new IDs, after the selected section. */
  const insertSaved = useCallback((saved: PageSection) => {
    if (!draftRef.current || sections.length >= MAX_SECTIONS) return;
    if (SECTION_DEFINITIONS[saved.type].single && sections.some(section => section.type === saved.type)) { toast.error(`${SECTION_DEFINITIONS[saved.type].label} is already on the page.`); return; }
    if ((saved.type === "ENQUIRY_FORM" || sectionWidgets(saved).some(item => item.widget.type === "FORM")) && (formWidgetCount(draftRef.current.data) > 0 || sections.some(section => section.type === "ENQUIRY_FORM"))) {
      toast.error("This page already shows the lead form. A page can show it only once."); return;
    }
    const taken = pageElementIds(draftRef.current.data);
    const id = newSectionId(saved.type, taken);
    place(withFreshIds(saved, id, taken));
  }, [sections, place]);
  /** Re-reads forms, contacts and linked data; the unsaved draft is kept. Agents chosen since the last save stay visible. */
  const refresh = useCallback(async () => {
    const data = await websitesGet<EditorPayload>(`/api/websites/pages/${pageId}`);
    setPayload(previous => {
      if (!previous) return data;
      const fresh = new Set((data.linked.agents ?? []).map(agent => agent.id));
      const agents = [...(data.linked.agents ?? []), ...(previous.linked.agents ?? []).filter(agent => !fresh.has(agent.id))];
      const freshUploads = new Set((data.linked.uploads ?? []).map(upload => upload.id));
      const uploads = [...(data.linked.uploads ?? []), ...(previous.linked.uploads ?? []).filter(upload => !freshUploads.has(upload.id))];
      return {...previous, linked: {...data.linked, agents, uploads}, form: data.form, forms: data.forms, checklist: data.checklist, permissions: data.permissions, page: {...previous.page, revision: data.page.revision}};
    });
  }, [pageId]);
  const services = useMemo<EditorServices | null>(() => payload ? {
    organizationId, pageId, payload, isAdministrator: payload.permissions.isAdministrator, refresh, openBrand: () => setBrandOpen(true),
    elementIds: () => draftRef.current ? pageElementIds(draftRef.current.data) : new Set<string>(),
    pageSections: () => draftRef.current?.data.sections ?? [],
    previewAgent: agent => setPayload(previous => previous ? {...previous, linked: {...previous.linked, agents: [...(previous.linked.agents ?? []).filter(item => item.id !== agent.id), agent]}} : previous),
    previewUpload: upload => setPayload(previous => previous ? {...previous, linked: {...previous.linked, uploads: [...(previous.linked.uploads ?? []).filter(item => item.id !== upload.id), upload]}} : previous),
  } : null, [organizationId, pageId, payload, refresh]);

  if (loadError) return <div role="alert" className="fixed inset-0 z-50 grid place-items-center bg-zinc-950 p-6 text-sm text-zinc-100"><div className="max-w-md space-y-3 text-center"><p className="font-medium text-red-300">{loadError}</p><button type="button" className="rounded-md border border-white/20 px-3 py-1.5" onClick={() => load()}>Try again</button></div></div>;
  if (!payload || !draft) return <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950 text-zinc-300" aria-busy="true"><Loader2 className="size-6 animate-spin" aria-label="Loading editor" /></div>;

  const shownData = viewingOldVersion ? normalized(payload.data) : draft.data;
  const selectedSection = sections.find(section => section.id === selected) ?? null;
  const hasForm = Boolean(payload.form?.view);
  const unavailable = new Map(sections.flatMap(section => { const result = sectionAvailability(section, payload.linked, {hasForm, today: payload.today, mode: "public"}); return result.ok ? [] : [[section.id, result.reason] as const]; }));

  const edit: EditBindings | undefined = preview || !editable ? undefined : {
    onText: (sectionId, path, value) => {
      const section = sections.find(item => item.id === sectionId);
      if (section) update({...section, props: setPath(section.props as Record<string, unknown>, path, value)} as PageSection);
    },
    wrapSection: (section: PageSection, element: ReactElement, state) => {
      const isSelected = selected === section.id;
      const index = indexOf(section.id);
      const Icon = SECTION_ICONS[section.type];
      const marker = dropAt?.id === section.id ? dropAt.before ? "top" : "bottom" : null;
      return <div data-editor-section={section.id} className={`group/sec relative ${section.type === "NAVBAR" && section.variant === "transparent" ? "z-30" : ""}`}
        onClick={(event: ReactMouseEvent) => {
          const target = event.target as HTMLElement;
          setSelected(section.id); setMenu(null);
          // Widgets first: inside a custom section, a click selects the widget (its text stays editable).
          const widgetPath = target.closest("[data-widget-path]")?.getAttribute("data-widget-path");
          if (widgetPath) { setWidgetPick({sectionId: section.id, path: widgetPath}); setElementPick(null); return; }
          setWidgetPick(null);
          const picked = target.closest("[data-move-key]");
          const key = picked?.getAttribute("data-move-key");
          const kind = picked?.getAttribute("data-element-kind");
          setElementPick(key ? {sectionId: section.id, key, kind: kind === "button" || kind === "image" || kind === "block" || kind === "card" ? kind : "text"} : null);
        }}
        onContextMenu={(event: ReactMouseEvent) => { event.preventDefault(); setSelected(section.id); setMenu({x: event.clientX, y: event.clientY, id: section.id}); }}
        onDragStart={(event: DragEvent) => {
          // A placed widget's handle: move it to another column or section.
          const handle = (event.target as HTMLElement).closest?.("[data-drag-widget]");
          const path = handle?.getAttribute("data-drag-widget");
          if (!path || !editable) return;
          event.stopPropagation();
          event.dataTransfer.setData(DRAG_PLACED, JSON.stringify({sectionId: section.id, path}));
          event.dataTransfer.effectAllowed = "move";
          setDragging(true);
        }}
        onDragOver={(event: DragEvent) => {
          if (!dragging) return;
          event.preventDefault();
          const types = event.dataTransfer.types;
          const widgetDrag = types.includes(DRAG_WIDGET) || types.includes(DRAG_PLACED);
          const columnPath = widgetDrag ? (event.target as HTMLElement).closest("[data-column-path]")?.getAttribute("data-column-path") : null;
          if (columnPath && isColumnPath(columnPath)) { if (dropColumn?.path !== columnPath || dropColumn.sectionId !== section.id) setDropColumn({sectionId: section.id, path: columnPath}); if (dropAt) setDropAt(null); if (dropInto) setDropInto(null); return; }
          if (dropColumn) setDropColumn(null);
          const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
          const ratio = (event.clientY - box.top) / Math.max(1, box.height);
          // Widgets dropped on the middle of a built-in section go inside it; near its edges, between sections.
          if (widgetDrag && acceptsExtra(section.type) && ratio > 0.15 && ratio < 0.85) {
            const position = ratio < 0.5 ? "BEFORE" as const : "AFTER" as const;
            if (dropInto?.sectionId !== section.id || dropInto.position !== position) setDropInto({sectionId: section.id, position});
            if (dropAt) setDropAt(null);
            return;
          }
          if (dropInto) setDropInto(null);
          const before = section.type !== "FOOTER" && ratio < 0.5 && !(section.type === "NAVBAR"); setDropAt({id: section.id, before: section.type === "FOOTER" ? true : before}); }}
        onDrop={onDrop}>
        {element}
        <div aria-hidden="true" className={`pointer-events-none absolute inset-0 z-[35] ${isSelected ? "ring-2 ring-inset ring-sky-500" : "group-hover/sec:ring-1 group-hover/sec:ring-inset group-hover/sec:ring-sky-400/70"} ${!state.available ? "opacity-60" : ""}`} />
        {dropInto?.sectionId === section.id && <div aria-hidden="true" className="pointer-events-none absolute inset-2 z-[40] flex items-center justify-center rounded-lg border-2 border-dashed border-sky-500 bg-sky-500/10">
          <span className="rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white shadow-lg">Drop inside {label(section)} · {dropInto.position === "BEFORE" ? "before" : "after"} its content</span></div>}
        {marker && <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 z-[40] h-1 bg-sky-500 shadow-[0_0_0_3px_rgba(14,165,233,.25)] ${marker === "top" ? "-top-0.5" : "-bottom-0.5"}`} />}
        <div className={`absolute left-1/2 top-2 z-[36] -translate-x-1/2 items-center gap-0.5 rounded-md bg-sky-600 px-1 py-0.5 text-white shadow-lg ${isSelected ? "flex" : "hidden group-hover/sec:flex"}`} onClick={event => event.stopPropagation()}>
          <span draggable onDragStart={event => { event.dataTransfer.setData(DRAG_MOVE, section.id); event.dataTransfer.effectAllowed = "move"; setDragging(true); }} onDragEnd={() => { setDragging(false); setDropAt(null); }}
            className="cursor-grab rounded p-1 hover:bg-white/20" title="Drag to move" aria-label={`Drag ${label(section)}`} role="button" tabIndex={-1}><GripVertical className="size-3.5" /></span>
          <span className="flex items-center gap-1 px-1 text-[11px] font-semibold"><Icon className="size-3.5" aria-hidden="true" />{label(section)}</span>
          <button type="button" className="rounded p-1 hover:bg-white/20 disabled:opacity-30" aria-label={`Move ${label(section)} up`} disabled={index <= 0} onClick={() => move(section.id, -1)}><ArrowUp className="size-3.5" /></button>
          <button type="button" className="rounded p-1 hover:bg-white/20 disabled:opacity-30" aria-label={`Move ${label(section)} down`} disabled={index >= sections.length - 1} onClick={() => move(section.id, 1)}><ArrowDown className="size-3.5" /></button>
          {!SECTION_DEFINITIONS[section.type].single && <button type="button" className="rounded p-1 hover:bg-white/20" aria-label={`Duplicate ${label(section)}`} onClick={() => duplicate(section.id)}><Copy className="size-3.5" /></button>}
          <button type="button" className="rounded p-1 hover:bg-white/20" aria-label={`Settings for ${label(section)}`} onClick={() => setSelected(section.id)}><Settings2 className="size-3.5" /></button>
          <button type="button" className="rounded p-1 hover:bg-red-500" aria-label={`Delete ${label(section)}`} onClick={() => remove(section.id)}><Trash2 className="size-3.5" /></button>
        </div>
        {section.type !== "FOOTER" && <button type="button" aria-label={`Add a section after ${label(section)}`} title="Add a section here"
          onClick={event => { event.stopPropagation(); setStructureAt({index: indexOf(section.id) + 1}); }}
          className="absolute -bottom-3.5 left-1/2 z-[37] hidden size-7 -translate-x-1/2 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg ring-2 ring-white hover:bg-sky-500 group-hover/sec:flex"><Plus className="size-4" /></button>}
      </div>;
    },
  };

  const setInsertAfter = (id: string | null) => { insertAfterRef.current = id; say(id ? "Choose an element to add." : ""); };

  const regenerate = async () => {
    if (!generating) return;
    setGenerateBusy(true);
    try {
      const result = await websitesSend<{versionNumber: number}>(`/api/websites/pages/${pageId}/generate`, organizationId, "POST", {expectedRevision: payload.page.revision, brief: generating.brief.trim(), style: generating.style || null}, "Claude could not redesign the page.");
      toast.success(`Claude created version ${result.versionNumber}. Earlier versions are in the history.`);
      setGenerating(null);
      await load();
    } catch (error) { toast.error(`${errorMessage(error, "Claude could not redesign the page.")} Your page is unchanged.`); } finally { setGenerateBusy(false); }
  };

  function runMenu(key: MenuKey, section: PageSection) {
    switch (key) {
      case "edit": setSelected(section.id); break;
      case "duplicate": duplicate(section.id); break;
      case "copy": setStyleClipboard({style: section.style, layout: section.layout}); toast("Style copied."); break;
      case "save": setSaveSection(section); break;
      case "paste": if (styleClipboard) update({...section, style: styleClipboard.style, layout: styleClipboard.layout} as PageSection); break;
      case "up": move(section.id, -1); break;
      case "down": move(section.id, 1); break;
      case "toggle": toggle(section.id); break;
      case "delete": remove(section.id); break;
    }
  }

  const panelShown = narrow ? drawerOpen : panelOpen;
  const tabs: Array<[LeftTab, string, typeof LayoutGrid]> = [["elements", "Elements", LayoutGrid], ["navigator", "Navigator", Layers], ["style", "Site style", Paintbrush], ["page", "Page", Settings2], ["publish", "Publish", Rocket]];
  const menuSection = menu ? sections.find(section => section.id === menu.id) : null;

  return <EditorServicesContext.Provider value={services}><div className={`dark fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100 ${fontClassName}`}>
    {brandOpen && <BrandContactsDrawer onClose={() => setBrandOpen(false)} />}
    {saveSection && <SaveSectionDialog section={saveSection} onClose={() => setSaveSection(null)} />}
    {shortcutsOpen && <ShortcutSheet onClose={() => setShortcutsOpen(false)} />}
    {structureAt && <StructurePicker onPick={layout => addStructure(layout, structureAt.index)} onClose={() => setStructureAt(null)}
      onReadyMade={() => { const after = structureAt.index !== undefined ? sections[structureAt.index - 1]?.id ?? null : null; setStructureAt(null); setSelected(null); setLeftTab("elements"); setPanelOpen(true); if (narrow) setDrawerOpen(true); setInsertAfter(after); }} />}
    <p className="sr-only" ref={announce} aria-live="polite" />
    {/* Top bar */}
    <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-white/10 bg-zinc-900 px-2 sm:gap-3 sm:px-3">
      <Link href="/websites" aria-label="Back to Websites" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-zinc-300 hover:bg-white/10 hover:text-white"><ArrowLeft className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Websites</span></Link>
      <button type="button" onClick={() => narrow ? setDrawerOpen(!drawerOpen) : setPanelOpen(!panelOpen)} aria-label={panelShown ? "Hide panel" : "Show panel"} className="rounded-md p-2 text-zinc-300 hover:bg-white/10">{panelShown ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}</button>
      <div className="min-w-0 flex-1 lg:flex-none"><h1 className="truncate text-sm font-semibold">{draft.meta.title}</h1><p className="text-[11px] text-zinc-400">{STATUS_LABELS[payload.page.status] ?? payload.page.status}{payload.live ? " · live" : ""} · {saving ? "Saving…" : dirty ? "Unsaved changes" : `Saved · version ${payload.page.currentVersionNumber}`}</p></div>
      <div role="radiogroup" aria-label="Preview device" className="mx-auto hidden items-center gap-0.5 rounded-md bg-white/5 p-0.5 md:flex">
        {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([value, Icon]) => <button key={value} type="button" role="radio" aria-checked={device === value} aria-label={value[0].toUpperCase() + value.slice(1)} title={value}
          onClick={() => setDevice(value)} className={`rounded p-1.5 ${device === value ? "bg-sky-500 text-white" : "text-zinc-400 hover:text-white"}`}><Icon className="size-4" /></button>)}
      </div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setZoom(zoom === 1 ? 0.75 : 1)} aria-pressed={zoom !== 1} aria-label={zoom === 1 ? "Zoom out to 75%" : "Zoom to 100%"} title="Zoom"
          className="hidden rounded-md px-2 py-1.5 text-[11px] font-semibold tabular-nums text-zinc-300 hover:bg-white/10 lg:inline-flex">{zoom === 1 ? "100%" : "75%"}</button>
        <button type="button" onClick={() => setShortcutsOpen(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" className="hidden rounded-md p-2 text-zinc-300 hover:bg-white/10 lg:inline-flex"><Keyboard className="size-4" /></button>
        <button type="button" onClick={undo} disabled={!past.length || !editable} aria-label="Undo" title="Undo (Ctrl+Z)" className="rounded-md p-2 text-zinc-300 hover:bg-white/10 disabled:opacity-30"><Undo2 className="size-4" /></button>
        <button type="button" onClick={redo} disabled={!future.length || !editable} aria-label="Redo" title="Redo (Ctrl+Y)" className="rounded-md p-2 text-zinc-300 hover:bg-white/10 disabled:opacity-30"><Redo2 className="size-4" /></button>
        <button type="button" onClick={() => setPreview(!preview)} aria-pressed={preview} title="Preview without editing tools" className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm ${preview ? "bg-white/15 text-white" : "text-zinc-300 hover:bg-white/10"}`}>{preview ? <EyeOff className="size-4" /> : <Eye className="size-4" />}<span className="hidden sm:inline">Preview</span></button>
        {payload.permissions.canGenerate && <button type="button" disabled={dirty || viewingOldVersion} onClick={() => setGenerating({brief: "", style: ""})} title={dirty ? "Save or undo your changes first" : "Redesign the whole page with Claude"} className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-zinc-300 hover:bg-white/10 disabled:opacity-40 md:inline-flex"><Sparkles className="size-4" />Claude</button>}
        {payload.live?.path && <a href={payload.live.path} target="_blank" rel="noreferrer" className="hidden rounded-md px-2.5 py-1.5 text-sm text-zinc-300 hover:bg-white/10 md:inline">View live</a>}
        {editable && <button type="button" onClick={save} disabled={!dirty || saving || validationIssues.length > 0} className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}<span className="hidden sm:inline">Save</span></button>}
        <button type="button" onClick={() => { setSelected(null); setLeftTab("publish"); setPanelOpen(true); setDrawerOpen(true); }} aria-label="Publish" className="hidden items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/10 sm:inline-flex"><Rocket className="size-4" />Publish</button>
      </div>
    </header>
    {(saveError || (dirty && validationIssues.length > 0)) && <div role="alert" className="border-b border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
      {saveError ? <>{saveError} <button type="button" className="underline" onClick={() => { setSaveError(null); load(); }}>Reload</button></> : validationIssues.join(" · ")}
    </div>}
    <div className="flex min-h-0 flex-1">
      {/* Left panel */}
      {panelShown && !preview && narrow && <button type="button" aria-label="Close panel" onClick={() => setDrawerOpen(false)} className="fixed inset-0 z-[64] bg-black/50" />}
      {panelShown && !preview && <aside aria-label="Editor panel" className={`flex flex-col border-r border-white/10 bg-zinc-900 ${narrow ? "fixed inset-y-0 left-0 z-[65] w-[min(22rem,92vw)] shadow-2xl" : "w-[22rem] shrink-0"}`}>
        {narrow && <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs text-zinc-400"><span>{draft.meta.title}</span>
          <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close panel" className="rounded p-1.5 hover:bg-white/10 hover:text-white"><X className="size-4" /></button></div>}
        {selectedSection && editable
          ? <>
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
              <button type="button" onClick={() => setSelected(null)} aria-label="Back to elements" className="rounded p-1.5 text-zinc-300 hover:bg-white/10"><ArrowLeft className="size-4" /></button>
              <p className="flex-1 truncate text-sm font-semibold">{element && !widget ? `${label(selectedSection)} › ${elementLabel(element)}` : `Edit ${label(selectedSection)}`}</p>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close settings" className="rounded p-1.5 text-zinc-400 hover:bg-white/10"><X className="size-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto"><SectionPanel key={selectedSection.id} section={selectedSection} linked={payload.linked} hasForm={hasForm} today={payload.today} device={device} onChange={update}
              element={element} elementKind={elementPick?.kind ?? "text"} onElement={key => setElementPick(key && selected ? {sectionId: selected, key, kind: elementPick?.kind ?? "text"} : null)} tab={sectionTab} onTab={setSectionTab}
              widget={widget} onWidget={path => setWidgetPick(path && selected ? {sectionId: selected, path} : null)} /></div>
          </>
          : <>
            <div role="tablist" aria-label="Editor panels" className="grid grid-cols-5 border-b border-white/10">{tabs.map(([value, text, Icon]) => <button key={value} type="button" role="tab" aria-selected={leftTab === value} onClick={() => setLeftTab(value)} title={text}
              className={`flex flex-col items-center gap-1 border-b-2 py-2.5 text-[10px] font-medium ${leftTab === value ? "border-sky-400 text-white" : "border-transparent text-zinc-400 hover:text-white"}`}><Icon className="size-4" aria-hidden="true" />{text}</button>)}</div>
            <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto">
              {leftTab === "elements" && (editable ? <ElementsPanel sections={sections} onAddWidget={type => addWidget(type)} library={<MySections onInsert={insertSaved} />} onAdd={type => { const after = insertAfterRef.current ? indexOf(insertAfterRef.current) + 1 : undefined; setInsertAfter(null); insert(type, after); }} onDragStart={() => setDragging(true)} />
                : <p className="p-4 text-sm text-zinc-400">{viewingOldVersion ? "Older versions are read-only. Restore it from the Publish tab to edit." : "You can view this page but not edit it."}</p>)}
              {leftTab === "navigator" && <NavigatorPanel sections={sections} selected={selected} onSelect={id => { setSelected(id); setWidgetPick(null); }}
                selectedWidget={widget} onSelectWidget={(id, path) => { setSelected(id); setWidgetPick({sectionId: id, path}); }} onMove={move} onReorder={reorder} onToggle={toggle} onDuplicate={duplicate} onDelete={remove} unavailable={unavailable} />}
              {leftTab === "style" && (editable ? <SiteStylePanel theme={draft.data.theme} onTheme={theme => commit({...draft, data: {...draft.data, theme}})} /> : <p className="p-4 text-sm text-zinc-400">Read-only.</p>)}
              {leftTab === "page" && (editable ? <PageSettingsPanel meta={draft.meta} onMeta={meta => commit({...draft, meta})} companySlug={payload.organization.slug} linked={payload.linked} /> : <p className="p-4 text-sm text-zinc-400">Read-only.</p>)}
              {leftTab === "publish" && <div className="p-4"><PublishPanel payload={payload} organizationId={organizationId} dirty={dirty} onReload={() => { setPreviewVersion(null); void load(); }} onPreviewVersion={version => { setPreviewVersion(version); void load(version); }}
                onRecheck={refresh} renderFix={item => <ChecklistFixAction item={item} footerId={sections.find(section => section.type === "FOOTER")?.id ?? null}
                  onOpenPage={() => setLeftTab("page")}
                  onOpenSection={id => { setSelected(id); setSectionTab("content"); requestAnimationFrame(() => document.querySelector(`[data-editor-section="${CSS.escape(id)}"]`)?.scrollIntoView({behavior: "smooth", block: "center"})); }} />} /></div>}
            </div>
          </>}
      </aside>}
      {/* Canvas */}
      <main className={`relative min-w-0 flex-1 overflow-auto bg-zinc-800/60 ${narrow && !preview ? "pb-20" : ""}`} aria-label="Page canvas"
        onDragOver={event => { if (dragging) event.preventDefault(); }} onDragEnd={() => { setDragging(false); setDropAt(null); }} onDrop={onDrop}
        onClickCapture={event => { if (!preview && (event.target as HTMLElement).closest("a")) event.preventDefault(); }}>
        {viewingOldVersion && <p className="sticky top-0 z-[60] flex items-center justify-center gap-3 bg-amber-200 px-3 py-1.5 text-xs text-amber-950">Viewing version {previewVersion} (read-only)<button type="button" className="underline" onClick={() => { setPreviewVersion(null); load(); }}>Back to current</button></p>}
        <div className={`mx-auto min-h-full bg-white shadow-2xl transition-[max-width] duration-300 ${device === "desktop" ? "" : "my-6 overflow-hidden rounded-xl"}`} style={{maxWidth: DEVICE_WIDTHS[device], zoom}} data-preview-device={device}>
          {editable && !preview && <style>{"[data-widget-path]{cursor:pointer;transition:outline-color .15s}[data-widget-path]:hover{outline:1px dashed rgba(56,189,248,.85);outline-offset:3px}[data-widget-path]:hover>[data-drag-widget]{display:flex}[data-column-path]{min-height:2rem}[data-element-kind=image],[data-element-kind=block]{cursor:pointer}[data-element-kind=image]:hover,[data-element-kind=block]:hover{outline:1px dashed rgba(56,189,248,.85);outline-offset:3px}"}</style>}
          {widget && selected && !preview && <style>{`[data-editor-section="${CSS.escape(selected)}"] [data-widget-path="${CSS.escape(widget)}"]{outline:2px solid #38bdf8 !important;outline-offset:3px}`}</style>}
          {dropColumn && <style>{`[data-editor-section="${CSS.escape(dropColumn.sectionId)}"] [data-column-path="${CSS.escape(dropColumn.path)}"]{outline:2px dashed #0ea5e9;outline-offset:6px;background-color:rgba(14,165,233,.08)}`}</style>}
          {element && selected && !preview && <style>{`[data-editor-section="${CSS.escape(selected)}"] [data-move-key="${CSS.escape(element)}"]{outline:2px dashed #38bdf8;outline-offset:4px;border-radius:2px}`}</style>}
          <PageRenderer mode="editor" today={payload.today} page={{title: draft.meta.title, data: shownData, linked: payload.linked, form: payload.form?.view ?? null}} edit={edit} />
        </div>
        {editable && !preview && <div className="mx-auto max-w-md py-8 text-center"><button type="button" onClick={() => setStructureAt({})} className="inline-flex items-center gap-2 rounded-full border border-dashed border-white/30 px-5 py-2.5 text-sm text-zinc-300 hover:border-sky-400 hover:text-white"><Plus className="size-4" />Add a section</button></div>}
      </main>
    </div>
    {/* Phones and tablets: the main actions in a bottom bar; the panel opens as a drawer. */}
    {narrow && !preview && <nav aria-label="Editor actions" className="fixed inset-x-0 bottom-0 z-[60] grid grid-cols-5 border-t border-white/10 bg-zinc-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      {([
        ["Add", Plus, () => setStructureAt({}), !editable],
        ["Elements", LayoutGrid, () => { setSelected(null); setLeftTab("elements"); setDrawerOpen(true); }, false],
        ["Edit", Settings2, () => setDrawerOpen(true), !selectedSection],
        ["Layers", Layers, () => { setSelected(null); setLeftTab("navigator"); setDrawerOpen(true); }, false],
        ["Publish", Rocket, () => { setSelected(null); setLeftTab("publish"); setDrawerOpen(true); }, false],
      ] as const).map(([text, Icon, run, disabled]) => <button key={text} type="button" onClick={run} disabled={disabled}
        className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium disabled:opacity-30 ${text === "Edit" && selectedSection ? "text-sky-300" : "text-zinc-300"}`}><Icon className="size-5" aria-hidden="true" />{text === "Edit" && selectedSection ? `Edit ${label(selectedSection)}`.slice(0, 18) : text}</button>)}
    </nav>}
    {/* Context menu */}
    {menu && menuSection && editable && <div role="menu" aria-label={`${label(menuSection)} actions`} className="fixed z-[70] w-52 overflow-hidden rounded-md border border-white/10 bg-zinc-900 py-1 text-sm shadow-2xl" style={{left: Math.min(menu.x, window.innerWidth - 220), top: Math.min(menu.y, window.innerHeight - 300)}} onClick={event => event.stopPropagation()}>
      {MENU_ITEMS.map(([key, text, Icon]) => {
        const enabled = key === "duplicate" ? !SECTION_DEFINITIONS[menuSection.type].single : key === "paste" ? Boolean(styleClipboard)
          : key === "up" ? indexOf(menuSection.id) > 0 : key === "down" ? indexOf(menuSection.id) < sections.length - 1 : true;
        const caption = key === "toggle" ? (menuSection.visible ? "Hide" : "Show") : text;
        return <button key={key} type="button" role="menuitem" disabled={!enabled} onClick={() => { runMenu(key, menuSection); setMenu(null); }}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left disabled:opacity-30 ${key === "delete" ? "text-red-300 hover:bg-red-500/20" : "hover:bg-white/10"}`}><Icon className="size-4" aria-hidden="true" />{caption}</button>;
      })}
    </div>}
    {/* Claude redesign */}
    {generating && <div role="dialog" aria-modal="true" aria-labelledby="regenerate-title" className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-lg space-y-4 rounded-xl border border-white/10 bg-zinc-900 p-5">
        <h2 id="regenerate-title" className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="size-5 text-sky-400" />Redesign this page with Claude</h2>
        <p className="text-sm text-zinc-400">Claude creates a new version from the linked CRM record and your brief, with rich copy, photography and video. The current version stays in the history, and nothing changes if generation fails.</p>
        <label className="block space-y-1.5 text-sm"><span>Brief</span><textarea className="min-h-28 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-sky-400" maxLength={MAX_BRIEF_CHARS} value={generating.brief} onChange={event => setGenerating({...generating, brief: event.target.value})} placeholder="A premium modern page with a luxury feel, video hero, gallery, payment plan and enquiry form." /></label>
        <label className="block space-y-1.5 text-sm"><span>Design style</span><select className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-2 text-sm [&>option]:bg-zinc-900" value={generating.style} onChange={event => setGenerating({...generating, style: event.target.value})}><option value="">Let Claude choose</option>{DESIGN_STYLES.map(style => <option key={style} value={style}>{DESIGN_STYLE_LABELS[style]}</option>)}</select></label>
        <div className="flex justify-end gap-2"><button type="button" disabled={generateBusy} onClick={() => setGenerating(null)} className="rounded-md px-3 py-1.5 text-sm hover:bg-white/10">Cancel</button>
          <button type="button" onClick={regenerate} disabled={generateBusy} className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50">{generateBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{generateBusy ? "Claude is designing…" : "Create new version"}</button></div>
      </div>
    </div>}
  </div></EditorServicesContext.Provider>;
}

