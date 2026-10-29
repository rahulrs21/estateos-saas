import { z } from "zod";
import { CONTENT_CATALOG, localesFor, type ContentLanguage, type ContentLocale, type ContentType, type FieldDefinition } from "./catalog";

/**
 * Output schemas for Claude structured outputs (output_config.format) and the
 * matching Zod schemas. Both are built from the catalog so they cannot drift.
 * Structured outputs guarantee the JSON shape; Zod re-checks it with length
 * limits, and validate.ts then checks the facts. Every property is required
 * and there are no unions, which keeps the schema within structured-output
 * limits and gives the model one unambiguous shape.
 */

type JsonSchema = Record<string, unknown>;

const str = (description: string): JsonSchema => ({type: "string", description});
const strList = (description: string): JsonSchema => ({type: "array", items: {type: "string"}, description});
const object = (properties: Record<string, JsonSchema>, description?: string): JsonSchema => ({
  type: "object", properties, required: Object.keys(properties), additionalProperties: false, ...(description ? {description} : {}),
});

const AD_VARIANT_JSON = object({
  primaryText: str("Main ad text. Empty string when the platform has no primary text."),
  headlines: strList("Headlines for this variant."),
  descriptions: strList("Descriptions for this variant."),
  callToAction: str("A short call to action."),
});

const PROPOSAL_PROPERTY_JSON = object({
  reference: str("The listing reference exactly as given in the facts."),
  summary: str("One or two sentences about this option."),
  priceAndSpecifications: str("Asking price and specifications exactly as recorded."),
  locationHighlights: str("Community, area and emirate from the facts; no distances or nearby places."),
  advantages: strList("Advantages supported by the facts."),
});

function fieldJson(field: FieldDefinition): JsonSchema {
  switch (field.kind) {
    case "line": case "text": return str(field.description);
    case "list": return strList(field.description);
    case "adVariants": return {type: "array", items: AD_VARIANT_JSON, description: field.description};
    case "proposalProperties": return {type: "array", items: PROPOSAL_PROPERTY_JSON, description: field.description};
  }
}

export function contentJsonSchema(type: ContentType): JsonSchema {
  return object(Object.fromEntries(CONTENT_CATALOG[type].fields.map(field => [field.key, fieldJson(field)])));
}

/** The JSON schema sent as output_config.format.schema. */
export function outputJsonSchema(type: ContentType, language: ContentLanguage): JsonSchema {
  const locales = localesFor(language);
  return object({
    title: str("A short internal title for this draft (not shown to customers)."),
    content: object(Object.fromEntries(locales.map(locale => [locale, contentJsonSchema(type)])),
      "The content, keyed by language code: en for English, ar for Arabic."),
    missingInformation: strList("Facts the request needed but the verified data did not contain."),
    claimsToReview: {type: "array", items: object({claim: str("The exact wording."), reason: str("Why a person should check it.")}),
      description: "Statements a person should verify before use."},
  });
}

// --- Zod -------------------------------------------------------------------

const MAX_LIST_ITEMS = 20;
const textField = (max: number) => z.string().max(max);
const listField = (max: number) => z.array(z.string().max(max)).max(MAX_LIST_ITEMS);

export const adVariantSchema = z.strictObject({
  primaryText: textField(1000),
  headlines: listField(200).max(15),
  descriptions: listField(400).max(6),
  callToAction: textField(200),
});

export const proposalPropertySchema = z.strictObject({
  reference: textField(120),
  summary: textField(1500),
  priceAndSpecifications: textField(1500),
  locationHighlights: textField(1500),
  advantages: listField(400).max(10),
});

function fieldZod(field: FieldDefinition) {
  switch (field.kind) {
    case "line": case "text": return textField(field.max);
    case "list": return listField(field.max);
    case "adVariants": return z.array(adVariantSchema).min(1).max(6);
    case "proposalProperties": return z.array(proposalPropertySchema).min(1).max(5);
  }
}

export function contentZod(type: ContentType) {
  return z.strictObject(Object.fromEntries(CONTENT_CATALOG[type].fields.map(field => [field.key, fieldZod(field)])));
}

export type LocalizedContent = Partial<Record<ContentLocale, Record<string, unknown>>>;

function localizedZod(type: ContentType, language: ContentLanguage) {
  const shape = contentZod(type);
  return z.strictObject(Object.fromEntries(localesFor(language).map(locale => [locale, shape])));
}

export const reviewClaimSchema = z.strictObject({claim: z.string().max(600), reason: z.string().max(600)});

export function outputZod(type: ContentType, language: ContentLanguage) {
  return z.strictObject({
    title: z.string().trim().min(1).max(200),
    content: localizedZod(type, language),
    missingInformation: z.array(z.string().max(400)).max(30),
    claimsToReview: z.array(reviewClaimSchema).max(30),
  });
}

export type GeneratedOutput = {
  title: string;
  content: LocalizedContent;
  missingInformation: string[];
  claimsToReview: Array<{claim: string; reason: string}>;
};

/** Stored draft content: what the user edits and saves. */
export function contentDataZod(type: ContentType, language: ContentLanguage) {
  return z.strictObject({schemaVersion: z.literal(1), content: localizedZod(type, language)});
}

export interface ContentData { schemaVersion: 1; content: LocalizedContent }

/** Parse stored JSON; null when it is missing or does not match the draft's type. */
export function parseContentData(type: ContentType, language: ContentLanguage, raw: string): ContentData | null {
  try {
    const result = contentDataZod(type, language).safeParse(JSON.parse(raw));
    return result.success ? result.data as ContentData : null;
  } catch { return null; }
}

/** Every text value of a content object, for validation and search. */
export function contentTexts(value: unknown, path = ""): Array<{path: string; text: string}> {
  if (typeof value === "string") return [{path, text: value}];
  if (Array.isArray(value)) return value.flatMap((item, index) => contentTexts(item, `${path}[${index}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => contentTexts(item, path ? `${path}.${key}` : key));
  return [];
}

/** Plain text for copying: labelled sections in catalog order. */
export function contentToPlainText(type: ContentType, content: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const field of CONTENT_CATALOG[type].fields) {
    const value = content[field.key];
    if (field.kind === "line" || field.kind === "text") {
      if (typeof value === "string" && value.trim()) parts.push(`${field.label}\n${value.trim()}`);
    } else if (field.kind === "list") {
      const items = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
      if (items.length) parts.push(`${field.label}\n${field.key === "hashtags" ? items.join(" ") : items.map(item => `• ${item}`).join("\n")}`);
    } else if (field.kind === "adVariants" && Array.isArray(value)) {
      value.forEach((variant, index) => {
        const item = variant as z.infer<typeof adVariantSchema>;
        const lines = [`Variant ${index + 1}`];
        if (item.primaryText) lines.push(`Primary text: ${item.primaryText}`);
        item.headlines.forEach(headline => lines.push(`Headline: ${headline}`));
        item.descriptions.forEach(description => lines.push(`Description: ${description}`));
        if (item.callToAction) lines.push(`Call to action: ${item.callToAction}`);
        parts.push(lines.join("\n"));
      });
    } else if (field.kind === "proposalProperties" && Array.isArray(value)) {
      value.forEach(entry => {
        const item = entry as z.infer<typeof proposalPropertySchema>;
        parts.push([item.reference, item.summary, item.priceAndSpecifications, item.locationHighlights, ...item.advantages.map(advantage => `• ${advantage}`)]
          .filter(Boolean).join("\n"));
      });
    }
  }
  return parts.join("\n\n");
}
