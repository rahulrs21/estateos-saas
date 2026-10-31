import {
  ROW_DEFAULTS, acceptsExtra, columnCount, defaultWidget, emptyColumn, rowsElementIds, sectionRows, sectionWidgets,
  type ColumnLayout, type CustomRow, type PageData, type PageSection, type SimpleWidget, type Widget, type WidgetType,
} from "./registry";

/*
 * Immutable edits to rows → columns → widgets for the editor. A column path
 * is "rows.0.columns.1" in a custom section, "extra.rows.0.columns.1" in
 * content added to a built-in section, and "<widget path>.props.columns.0"
 * inside an inner section; a widget path adds ".widgets.N". Every result is
 * validated again by the registry schema before it is saved.
 */

const COLUMN = /^(extra\.)?rows\.\d+\.columns\.\d+(\.widgets\.\d+\.props\.columns\.\d+)?$/;
const WIDGET = /^((?:extra\.)?rows\.\d+\.columns\.\d+(?:\.widgets\.\d+\.props\.columns\.\d+)?)\.widgets\.(\d+)$/;

export interface WidgetAddress { column: string; index: number }

export function parseWidgetPath(path: string): WidgetAddress | null {
  const match = WIDGET.exec(path);
  return match ? {column: match[1], index: Number(match[2])} : null;
}
export const isColumnPath = (path: string) => COLUMN.test(path);
export const widgetPath = (column: string, index: number) => `${column}.widgets.${index}`;
/** True for a column of an inner section (which holds only simple widgets). */
export const isInnerColumn = (column: string) => column.includes(".props.columns.");

/** Paths are relative to the section's props for a custom section, and to the section for added content. */
function read(section: PageSection, path: string): unknown {
  const [root, rest] = path.startsWith("extra.") ? [section as unknown, path] : [section.props as unknown, path];
  return rest.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, root);
}
function writeAt(target: unknown, keys: string[], value: unknown): unknown {
  const [head, ...rest] = keys;
  const copy: Record<string, unknown> | unknown[] = Array.isArray(target) ? [...target] : {...(target as Record<string, unknown>)};
  (copy as Record<string, unknown>)[head] = rest.length ? writeAt((target as Record<string, unknown>)[head], rest, value) : value;
  return copy;
}
function write(section: PageSection, path: string, value: unknown): PageSection {
  if (path.startsWith("extra.")) return writeAt(section, path.split("."), value) as PageSection;
  return {...section, props: writeAt(section.props, path.split("."), value)} as PageSection;
}

export function widgetAt(section: PageSection, path: string): Widget | null {
  return parseWidgetPath(path) ? (read(section, path) as Widget | undefined) ?? null : null;
}
export function columnWidgets(section: PageSection, column: string): Widget[] | null {
  if (!COLUMN.test(column)) return null;
  const widgets = read(section, `${column}.widgets`);
  return Array.isArray(widgets) ? widgets as Widget[] : null;
}

/** Every ID on the page (sections, rows, columns, widgets): new IDs must not collide with any of them. */
export function pageElementIds(data: PageData) {
  return new Set(data.sections.flatMap(section => [section.id, ...sectionRows(section).flatMap(({rows}) => rowsElementIds(rows))]));
}

export function newElementId(prefix: string, taken: Set<string>, random: () => number = Math.random) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const id = `${prefix}-${Math.floor(random() * 36 ** 5).toString(36).padStart(5, "0")}`;
    if (!taken.has(id)) { taken.add(id); return id; }
  }
  throw new Error("Could not create a unique ID.");
}

export function updateWidget(section: PageSection, path: string, widget: Widget): PageSection {
  return parseWidgetPath(path) && widgetAt(section, path) ? write(section, path, widget) : section;
}

export function removeWidget(section: PageSection, path: string): PageSection {
  const address = parseWidgetPath(path);
  const widgets = address ? columnWidgets(section, address.column) : null;
  if (!address || !widgets) return section;
  return write(section, `${address.column}.widgets`, widgets.filter((_, index) => index !== address.index));
}

/** Moves a widget up or down within its column; returns the new path. */
export function moveWidget(section: PageSection, path: string, delta: number): {section: PageSection; path: string} {
  const address = parseWidgetPath(path);
  const widgets = address ? columnWidgets(section, address.column) : null;
  if (!address || !widgets) return {section, path};
  const target = address.index + delta;
  if (target < 0 || target >= widgets.length) return {section, path};
  const next = [...widgets];
  const [item] = next.splice(address.index, 1);
  next.splice(target, 0, item);
  return {section: write(section, `${address.column}.widgets`, next), path: widgetPath(address.column, target)};
}

/** Inserts a widget into a column at an index (the end when omitted); returns the new path. Inner sections take only simple widgets. */
export function insertWidget(section: PageSection, column: string, widget: Widget, index?: number): {section: PageSection; path: string} | null {
  const widgets = columnWidgets(section, column);
  if (!widgets || (isInnerColumn(column) && widget.type === "INNER_SECTION")) return null;
  const at = Math.max(0, Math.min(index ?? widgets.length, widgets.length));
  return {section: write(section, `${column}.widgets`, [...widgets.slice(0, at), widget, ...widgets.slice(at)]), path: widgetPath(column, at)};
}

export function duplicateWidget(section: PageSection, path: string, taken: Set<string>) {
  const widget = widgetAt(section, path);
  const address = parseWidgetPath(path);
  if (!widget || !address) return null;
  return insertWidget(section, address.column, freshWidget(widget, taken), address.index + 1);
}

export function createWidget(type: WidgetType, taken: Set<string>) {
  const id = newElementId("w", taken);
  const widget = defaultWidget(type, id);
  return widget.type === "INNER_SECTION" ? {...widget, props: {...widget.props, columns: widget.props.columns.map(() => emptyColumn(newElementId("col", taken)))}} : widget;
}

/** A copy of a widget with new IDs (an inner section's columns and widgets too). */
function freshWidget(widget: Widget, taken: Set<string>): Widget {
  const copy = {...structuredClone(widget), id: newElementId("w", taken)} as Widget;
  if (copy.type !== "INNER_SECTION") return copy;
  return {...copy, props: {...copy.props, columns: copy.props.columns.map(column => ({...column, id: newElementId("col", taken), widgets: column.widgets.map(item => ({...item, id: newElementId("w", taken)}) as SimpleWidget)}))}};
}

/**
 * Moves a widget to another column (in the same or another section of the
 * page). The caller replaces both sections; within one section, "to" is
 * applied after the removal, so the target index is adjusted.
 */
export function relocateWidget(from: PageSection, path: string, to: PageSection, column: string, index: number): {from: PageSection; to: PageSection; path: string} | null {
  const address = parseWidgetPath(path);
  const widget = widgetAt(from, path);
  if (!address || !widget) return null;
  if (column === path || column.startsWith(`${path}.`)) return null; // into itself
  const removed = removeWidget(from, path);
  const sameColumn = from.id === to.id && column === address.column;
  const target = sameColumn && index > address.index ? index - 1 : index;
  // A path after the removed widget in the same column shifts up by one.
  const base = from.id === to.id ? removed : to;
  const shifted = from.id === to.id && column.startsWith(`${address.column}.widgets.`) ? (() => {
    const rest = column.slice(address.column.length + ".widgets.".length);
    const [first, ...tail] = rest.split(".");
    return Number(first) > address.index ? [address.column, "widgets", String(Number(first) - 1), ...tail].join(".") : column;
  })() : column;
  const inserted = insertWidget(base, shifted, widget, target);
  if (!inserted) return null;
  return from.id === to.id ? {from: inserted.section, to: inserted.section, path: inserted.path} : {from: removed, to: inserted.section, path: inserted.path};
}

export function newRow(layout: ColumnLayout, taken: Set<string>): CustomRow {
  return {id: newElementId("row", taken), layout, ...ROW_DEFAULTS, gap: "MD", columns: Array.from({length: columnCount(layout)}, () => emptyColumn(newElementId("col", taken)))};
}

type Columned = {layout: ColumnLayout; widths: number[] | null; columns: Array<{id: string; widgets: unknown[]}>};
/** Changes a layout, keeping widgets: extra columns' widgets move into the last kept column; custom widths reset. */
export function setRowLayout<R extends Columned>(row: R, layout: ColumnLayout, taken: Set<string>): R {
  const count = columnCount(layout);
  const columns = row.columns.slice(0, count).map(column => ({...column}));
  if (row.columns.length > count) columns[count - 1] = {...columns[count - 1], widgets: [...columns[count - 1].widgets, ...row.columns.slice(count).flatMap(column => column.widgets)]};
  while (columns.length < count) columns.push(emptyColumn(newElementId("col", taken)));
  return {...row, layout, widths: null, columns} as R;
}

/** Sets one column's width (5–95 %) and gives the difference to its neighbour, so the row still adds up to 100 %. */
export function setColumnWidth(widths: number[], index: number, value: number): number[] {
  const next = [...widths];
  if (next.length < 2) return next;
  const neighbour = index < next.length - 1 ? index + 1 : index - 1;
  const pair = next[index] + next[neighbour];
  const width = Math.max(5, Math.min(pair - 5, Math.round(value)));
  next[index] = width;
  next[neighbour] = pair - width;
  return next;
}

/** Copies a row with new IDs for the row, its columns and widgets. */
export function cloneRow(row: CustomRow, taken: Set<string>): CustomRow {
  return {...structuredClone(row), id: newElementId("row", taken), columns: row.columns.map(column => ({
    ...structuredClone(column), id: newElementId("col", taken), widgets: column.widgets.map(widget => freshWidget(widget, taken)),
  }))};
}

/** A whole section copy with fresh IDs (duplicating, or inserting a saved section). */
export function withFreshIds<S extends PageSection>(section: S, sectionId: string, taken: Set<string>): S {
  let copy = {...structuredClone(section), id: sectionId} as PageSection;
  if (copy.type === "CUSTOM") copy = {...copy, props: {...copy.props, rows: copy.props.rows.map(row => cloneRow(row, taken))}};
  if (copy.extra) copy = {...copy, extra: {...copy.extra, rows: copy.extra.rows.map(row => cloneRow(row, taken))}};
  return copy as S;
}

/**
 * Adds a widget inside a built-in section: into its added content, which is
 * created (one single-column row, before or after the section's own content)
 * when the section has none.
 */
export function addToSection(section: PageSection, widget: Widget, position: "BEFORE" | "AFTER", taken: Set<string>): {section: PageSection; path: string} | null {
  if (!acceptsExtra(section.type)) return null;
  const withExtra = section.extra ? section : {...section, extra: {position, rows: [newRow("1", taken)]}} as PageSection;
  const last = withExtra.extra!.rows.length - 1;
  return insertWidget(withExtra, `extra.rows.${last}.columns.0`, widget);
}

/** The number of form widgets on the page (one lead form per page). */
export function formWidgetCount(data: PageData) {
  return data.sections.flatMap(sectionWidgets).filter(item => item.widget.type === "FORM").length;
}
