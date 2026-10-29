import Link from "next/link";
import { Wand2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { ContentType } from "../catalog";

/**
 * Opens the Content Studio with a record pre-selected. It only links: nothing
 * is generated until the member clicks Generate, and the studio and server
 * re-check the member's access to the record.
 */
type RecordRef = {kind: "propertyId" | "listingId" | "projectId" | "leadId"; id: string};

export function aiContentHref(type: ContentType, purpose: string | undefined, records: RecordRef[]) {
  const query = new URLSearchParams({type, ...(purpose ? {purpose} : {})});
  for (const record of records) query.set(record.kind, record.id);
  return `/ai-content?${query}`;
}

export function AiContentLink({label, type, purpose, record, also, size}: {
  label: string; type: ContentType; purpose?: string; record: RecordRef; also?: RecordRef; size?: "sm" | "default";
}) {
  return <Link href={aiContentHref(type, purpose, also ? [record, also] : [record])} className={buttonVariants({variant: "outline", size})}><Wand2 aria-hidden="true" />{label}</Link>;
}
