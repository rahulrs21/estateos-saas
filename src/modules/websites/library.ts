import { withoutUnknownCrmImages } from "./linked";
import { anySectionSchema, type PageData, type PageSection } from "./registry";

/*
 * Saved sections: validated page sections stored in the company library.
 * CRM photos are removed because they belong to one record's media; the
 * editor gives inserted sections new IDs.
 */

export const SECTION_TEMPLATE_CATEGORIES = ["General", "Introduction", "Features", "Media", "Contact", "Conversion"] as const;

/** The stored form of a section, or null when it is not valid without its CRM photos. */
export function libraryTemplate(raw: unknown): {section: PageSection; data: string} | null {
  const parsed = anySectionSchema.safeParse(raw);
  if (!parsed.success) return null;
  const stripped = withoutUnknownCrmImages({sections: [parsed.data]} as unknown as PageData, new Set()) as {sections: unknown[]};
  const clean = anySectionSchema.safeParse(stripped.sections[0]);
  return clean.success ? {section: clean.data, data: JSON.stringify(clean.data)} : null;
}

export function parseLibrarySection(raw: string): PageSection | null {
  try {
    const parsed = anySectionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}
