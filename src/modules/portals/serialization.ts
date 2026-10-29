import type { PortalRecord, PortalValue } from "./types";

const elementName = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

/** Escapes text and attribute content; strips characters XML 1.0 cannot represent. */
export function escapeXml(value: string): string {
  return value
    .replace(/[^\u0009\u000A\u000D -퟿-�\u{10000}-\u{10FFFF}]/gu, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function assertElementName(name: string) {
  if (!elementName.test(name) || name.toLowerCase().startsWith("xml")) throw new Error(`Invalid XML element name: ${name}`);
}

function xmlNode(name: string, value: PortalValue, indent: string): string {
  assertElementName(name);
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    // Arrays become a wrapper with one <item> per entry, keeping element names fixed.
    const children = value.map(item => xmlNode("item", item, indent + "  ")).filter(Boolean).join("");
    return children ? `${indent}<${name}>\n${children}${indent}</${name}>\n` : "";
  }
  if (typeof value === "object") {
    const children = Object.entries(value).map(([key, child]) => xmlNode(key, child, indent + "  ")).filter(Boolean).join("");
    return children ? `${indent}<${name}>\n${children}${indent}</${name}>\n` : "";
  }
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`Non-finite number in ${name}`);
  return `${indent}<${name}>${escapeXml(String(value))}</${name}>\n`;
}

/** Deterministic XML document: null/undefined fields are omitted. */
export function toXml(root: string, itemName: string, records: PortalRecord[], attributes: Record<string, string> = {}): string {
  assertElementName(root);
  const attrs = Object.entries(attributes).map(([key, value]) => { assertElementName(key); return ` ${key}="${escapeXml(value)}"`; }).join("");
  const body = records.map(record => xmlNode(itemName, record, "  ")).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${root}${attrs}>\n${body}</${root}>\n`;
}

/** Removes null/undefined values recursively so JSON and XML carry the same fields. */
export function compact(value: PortalValue): PortalValue {
  if (Array.isArray(value)) return value.map(compact).filter(item => item !== null && item !== undefined);
  if (value && typeof value === "object") {
    const output: PortalRecord = {};
    for (const [key, child] of Object.entries(value)) {
      const next = compact(child);
      if (next !== null && next !== undefined) output[key] = next;
    }
    return output;
  }
  return value;
}

export function toJson(value: PortalValue): string {
  return JSON.stringify(compact(value), null, 2) + "\n";
}
