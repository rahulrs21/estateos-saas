import { HERO_DEFAULT_FACTS, pageDataSchema, withStyleDefaults, type ElementStyle, type PageSection } from "./registry";

/*
 * Element actions of the page editor (right-click menu): duplicate, delete
 * and hide one element of a section. Pure functions on validated page data;
 * the result is validated again with the registry schema, so a full list or
 * a required field is refused with a message instead of an invalid page.
 */

export type ElementResult = {ok: true; section: PageSection; message: string} | {ok: false; message: string};

/** Elements that are list items: "items.2", "bullets.0", "facts.1"… */
function listItem(section: PageSection, key: string): {list: string; index: number; items: unknown[]} | null {
  const match = /^([A-Za-z]+)\.(\d+)$/.exec(key);
  if (!match) return null;
  const props = section.props as Record<string, unknown>;
  // The hero's automatic facts become its own list on the first change.
  const items = section.type === "HERO" && match[1] === "facts" && props.facts === null ? HERO_DEFAULT_FACTS.map(fact => ({...fact})) : props[match[1]];
  return Array.isArray(items) && Number(match[2]) < items.length ? {list: match[1], index: Number(match[2]), items} : null;
}

/** Element styles and offsets follow their list item when items before them are added or removed. */
function shiftKeys<T>(map: Record<string, T>, list: string, from: number, delta: 1 | -1, removed: number | null): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(map)) {
    const match = new RegExp(`^${list}\\.(\\d+)(\\..*)?$`).exec(key);
    if (!match) { next[key] = value; continue; }
    const index = Number(match[1]);
    if (removed !== null && index === removed) continue;
    next[index >= from ? `${list}.${index + delta}${match[2] ?? ""}` : key] = value;
  }
  return next;
}

function validated(section: PageSection, message: string, refused: string): ElementResult {
  const parsed = pageDataSchema.shape.sections.element.safeParse(section);
  return parsed.success ? {ok: true, section: parsed.data, message} : {ok: false, message: refused};
}

export const canDuplicateElement = (section: PageSection, key: string) => listItem(section, key) !== null;

/** A copy of a list item, placed right after it (with the same element style). */
export function duplicateElement(section: PageSection, key: string): ElementResult {
  const item = listItem(section, key);
  if (!item) return {ok: false, message: "Only items of a list (facts, highlights, points, questions…) can be duplicated here. Add a custom section for a free layout."};
  const items = [...item.items];
  items.splice(item.index + 1, 0, structuredClone(items[item.index]));
  const style = withStyleDefaults(section.style);
  const styles = shiftKeys(style.elementStyles, item.list, item.index + 1, 1, null);
  const offsets = shiftKeys(style.elementOffsets, item.list, item.index + 1, 1, null);
  for (const [map, source] of [[styles, style.elementStyles], [offsets, style.elementOffsets]] as const) {
    for (const [name, value] of Object.entries(source)) {
      const match = new RegExp(`^${item.list}\\.${item.index}(\\..*)?$`).exec(name);
      if (match) (map as Record<string, unknown>)[`${item.list}.${item.index + 1}${match[1] ?? ""}`] = structuredClone(value);
    }
  }
  return validated({...section, props: {...(section.props as Record<string, unknown>), [item.list]: items}, style: {...style, elementStyles: styles, elementOffsets: offsets}} as PageSection,
    "Duplicated.", "This list is full, so the item was not duplicated.");
}

/** Optional parts that can be removed outright. */
const REMOVABLE_TO_NULL = new Set(["secondaryCta", "cta", "image", "logo"]);

export function canDeleteElement(section: PageSection, key: string) {
  const props = section.props as Record<string, unknown>;
  return listItem(section, key) !== null || (REMOVABLE_TO_NULL.has(key) && props[key] != null) || typeof props[key] === "string";
}

/**
 * Removes an element: a list item, an optional button or image, or a text
 * (left empty, so it is not shown). Other elements (CRM values, groups) can
 * only be hidden.
 */
export function deleteElement(section: PageSection, key: string): ElementResult {
  const props = section.props as Record<string, unknown>;
  const style = withStyleDefaults(section.style);
  const item = listItem(section, key);
  if (item) {
    const items = item.items.filter((_, index) => index !== item.index);
    return validated({...section, props: {...props, [item.list]: items},
      style: {...style, elementStyles: shiftKeys(style.elementStyles, item.list, item.index + 1, -1, item.index), elementOffsets: shiftKeys(style.elementOffsets, item.list, item.index + 1, -1, item.index)}} as PageSection,
      "Deleted.", "This list needs at least one item.");
  }
  const rest = <T,>(map: Record<string, T>) => Object.fromEntries(Object.entries(map).filter(([name]) => name !== key && !name.startsWith(`${key}.`)));
  const cleaned = {...style, elementStyles: rest(style.elementStyles), elementOffsets: rest(style.elementOffsets)};
  if (REMOVABLE_TO_NULL.has(key) && props[key] != null) return validated({...section, props: {...props, [key]: null}, style: cleaned} as PageSection, "Deleted.", "This part is required and cannot be deleted.");
  if (typeof props[key] === "string") return validated({...section, props: {...props, [key]: ""}, style: cleaned} as PageSection, "Deleted.", "This text is required: hide it instead.");
  return {ok: false, message: "This part comes from the CRM or holds other elements: hide it instead."};
}

/** Shows or hides an element on every device (its style's device visibility). */
export function setElementHidden(section: PageSection, key: string, hidden: boolean, current: ElementStyle): PageSection {
  const style = withStyleDefaults(section.style);
  return {...section, style: {...style, elementStyles: {...style.elementStyles, [key]: {...current, devices: {desktop: !hidden, tablet: !hidden, mobile: !hidden}}}}} as PageSection;
}

// --- Moving, copying and pasting elements (Navigator drag, right-click Copy / Paste) ---------------

/** Whether the element is an item of a list (facts, highlights, questions…), which can be moved within its list. */
export const isListElement = (section: PageSection, key: string) => listItem(section, key) !== null;

/** The section with the hero's automatic facts copied into its own list, so one fact can be edited. */
export function withOwnFacts(section: PageSection): PageSection {
  if (section.type !== "HERO" || (section.props as {facts: unknown}).facts !== null) return section;
  return {...section, props: {...section.props, facts: HERO_DEFAULT_FACTS.map(fact => ({...fact}))}} as PageSection;
}

/** Renames list item keys ("items.3.title") after the items were reordered. */
function remapKeys<T>(map: Record<string, T>, list: string, newIndexOf: Map<number, number>): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(map)) {
    const match = new RegExp(`^${list}\\.(\\d+)(\\..*)?$`).exec(key);
    next[match ? `${list}.${newIndexOf.get(Number(match[1])) ?? Number(match[1])}${match[2] ?? ""}` : key] = value;
  }
  return next;
}

/** Moves a list item before or after another item of the same list; its style and position move with it. */
export function moveElement(section: PageSection, key: string, targetKey: string, after: boolean): ElementResult {
  const from = listItem(section, key);
  const to = listItem(section, targetKey);
  if (!from || !to || from.list !== to.list) return {ok: false, message: "Items can only be moved within their own list."};
  if (from.index === to.index) return {ok: true, section, message: "Moved."};
  const order = from.items.map((_, index) => index).filter(index => index !== from.index);
  order.splice(order.indexOf(to.index) + (after ? 1 : 0), 0, from.index);
  const newIndexOf = new Map(order.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  const style = withStyleDefaults(section.style);
  return validated({...section, props: {...(section.props as Record<string, unknown>), [from.list]: order.map(index => from.items[index])},
    style: {...style, elementStyles: remapKeys(style.elementStyles, from.list, newIndexOf), elementOffsets: remapKeys(style.elementOffsets, from.list, newIndexOf)}} as PageSection,
    "Moved.", "This item could not be moved.");
}

/** The order of a group of elements (the hero text, a section heading…), as arranged in the Navigator. */
export function setElementOrder(section: PageSection, group: string, ids: string[]): ElementResult {
  const style = withStyleDefaults(section.style);
  return validated({...section, style: {...style, elementOrder: {...style.elementOrder, [group]: ids}}} as PageSection, "Moved.", "This element could not be moved.");
}

/** What Copy keeps: the element's content (when it has its own) and its style. */
export interface ElementClip { key: string; value: unknown; style: ElementStyle | null }

const valueAt = (props: unknown, path: string) => path.split(".").reduce<unknown>((current, part) => current && typeof current === "object" ? (current as Record<string, unknown>)[part] : undefined, props);
function setAt(target: unknown, path: string[], value: unknown): unknown {
  const [head, ...rest] = path;
  const copy: Record<string, unknown> | unknown[] = Array.isArray(target) ? [...target] : {...(target as Record<string, unknown>)};
  (copy as Record<string, unknown>)[head] = rest.length ? setAt((target as Record<string, unknown>)[head], rest, value) : value;
  return copy;
}

export function copyElement(section: PageSection, key: string): ElementClip {
  const own = key.startsWith("facts.") ? withOwnFacts(section) : section;
  const value = valueAt(own.props, key);
  const style = withStyleDefaults(section.style).elementStyles[key] ?? null;
  return {key, value: value === undefined || value === null ? undefined : structuredClone(value), style: style && structuredClone(style)};
}

/** Kinds of content that can replace each other: text, an image, a button, or objects with the same fields. */
function shapeOf(value: unknown): string {
  if (typeof value === "string") return "text";
  if (!value || typeof value !== "object" || Array.isArray(value)) return typeof value;
  const record = value as Record<string, unknown>;
  if (typeof record.alt === "string" && ("stockId" in record || "mediaId" in record || "uploadId" in record)) return "image";
  return `object:${Object.keys(record).sort().join(",")}`;
}

/**
 * Pastes a copied element: after a list item (a new item next to it), at the
 * end of a list, or in place of an element of the same kind (text on text, a
 * button on a button), with the copied style. Validated like every change.
 */
export function pasteElement(section: PageSection, key: string, clip: ElementClip): ElementResult {
  if (clip.value === undefined) return {ok: false, message: "The copied part has no content of its own. Use Paste style to reuse its look."};
  const base = key === "facts" || key.startsWith("facts.") ? withOwnFacts(section) : section;
  const props = base.props as Record<string, unknown>;
  const style = withStyleDefaults(base.style);
  const refused = "The copied element cannot be pasted here. Paste it on an element of the same kind, such as text on text or a fact on a fact.";
  const item = listItem(base, key);
  if (item) {
    const items = [...item.items];
    items.splice(item.index + 1, 0, structuredClone(clip.value));
    const styles = shiftKeys(style.elementStyles, item.list, item.index + 1, 1, null);
    if (clip.style) styles[`${item.list}.${item.index + 1}`] = structuredClone(clip.style);
    return validated({...base, props: {...props, [item.list]: items}, style: {...style, elementStyles: styles, elementOffsets: shiftKeys(style.elementOffsets, item.list, item.index + 1, 1, null)}} as PageSection,
      "Pasted after it.", refused);
  }
  const target = valueAt(props, key);
  if (Array.isArray(target)) {
    const styles = {...style.elementStyles, ...(clip.style ? {[`${key}.${target.length}`]: structuredClone(clip.style)} : {})};
    return validated({...base, props: setAt(props, key.split("."), [...target, structuredClone(clip.value)]), style: {...style, elementStyles: styles}} as PageSection, "Pasted at the end of the list.", refused);
  }
  if (target !== undefined && target !== null && shapeOf(target) === shapeOf(clip.value)) {
    const styles = {...style.elementStyles};
    if (clip.style) styles[key] = structuredClone(clip.style);
    return validated({...base, props: setAt(props, key.split("."), structuredClone(clip.value)), style: {...style, elementStyles: styles}} as PageSection, "Pasted.", refused);
  }
  return {ok: false, message: refused};
}
