import { createHash } from "node:crypto";
import { getPortalAdapter } from "./adapters";
import { normalizeListing } from "./normalize";
import { compact, toJson, toXml } from "./serialization";
import type { ExportListingRow, FeedFormatCode, FieldMappingRow, PortalRecord } from "./types";
import { hasErrors, validateListing, type MappingLookup } from "./validation";

/** Company override first, then the adapter default. Overrides for other providers are ignored. */
export function mappingLookup(provider: string, defaults: Record<string, Record<string, string>>, overrides: FieldMappingRow[]): MappingLookup {
  const own = new Map(overrides.filter(row => row.provider === provider).map(row => [`${row.fieldKey}\u0000${row.sourceValue}`, row.targetValue]));
  return (fieldKey, sourceValue) => own.get(`${fieldKey}\u0000${sourceValue}`) ?? defaults[fieldKey]?.[sourceValue];
}

export function buildPortalExport(provider: string, row: ExportListingRow, overrides: FieldMappingRow[], now: Date) {
  const adapter = getPortalAdapter(provider);
  const normalized = normalizeListing(row);
  const lookup = mappingLookup(adapter.provider, adapter.defaultMappings, overrides);
  const issues = validateListing(normalized, adapter.rules, lookup, now);
  const record = compact(adapter.transform(normalized, lookup)) as PortalRecord;
  const json = toJson(record);
  return {
    provider: adapter.provider, normalized, issues, record, json,
    xml: toXml(adapter.xml.root, adapter.xml.item, [record]),
    payloadHash: createHash("sha256").update(json).digest("hex"),
    ready: !hasErrors(issues),
  };
}

/** Codes only, most frequent first, bounded to the stored column length. */
export function summarizeErrorCodes(codes: string[], maxLength = 2000): string | null {
  if (!codes.length) return null;
  const counts = new Map<string, number>();
  for (const code of codes) counts.set(code, (counts.get(code) ?? 0) + 1);
  const summary = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([code, count]) => `${code}:${count}`).join(", ");
  return summary.length <= maxLength ? summary : summary.slice(0, maxLength - 1) + "…";
}

/**
 * In-memory dry run. Only listings without validation errors are serialized;
 * the content is measured and discarded by the caller, never stored or served.
 */
export function buildFeedDryRun(provider: string, format: FeedFormatCode, rows: ExportListingRow[], overrides: FieldMappingRow[], now: Date) {
  const adapter = getPortalAdapter(provider);
  const results = rows.map(row => buildPortalExport(adapter.provider, row, overrides, now));
  const valid = results.filter(result => result.ready).map(result => result.record);
  const content = format === "XML"
    ? toXml(adapter.xml.root, adapter.xml.item, valid, {schema: "estateos-draft-v1", provider: adapter.provider})
    : toJson({schema: "estateos-draft-v1", provider: adapter.provider, listings: valid});
  const errorCodes = results.flatMap(result => result.issues.filter(issue => issue.severity === "ERROR").map(issue => issue.code));
  return {
    listingCount: rows.length, validCount: valid.length, invalidCount: rows.length - valid.length,
    byteSize: Buffer.byteLength(content, "utf8"), errorSummary: summarizeErrorCodes(errorCodes),
  };
}
