"use client";

import { useState } from "react";
import { ArrowRight, ExternalLink, Wrench } from "lucide-react";
import type { ChecklistItem } from "../../checklist";
import { BrandDetailsForm, LeadFormControl } from "./connections";
import { useEditorServices } from "./editor-context";

/*
 * Fixes a checklist item without leaving the editor: approve brand details or
 * connect a lead form in place, jump to the page settings or a section, or
 * open the CRM record that holds the value (records change only in the CRM).
 * The server re-checks everything when the page is published.
 */

const action = "mt-1.5 inline-flex items-center gap-1 rounded-md bg-sky-500/15 px-2 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/25 hover:text-white";

export function ChecklistFixAction({item, onOpenPage, onOpenSection, footerId}: {item: ChecklistItem; onOpenPage: () => void; onOpenSection: (id: string) => void; footerId: string | null}) {
  const {isAdministrator} = useEditorServices();
  const [open, setOpen] = useState(false);
  const fix = item.fix;
  if (!fix) return null;
  switch (fix.kind) {
    case "BRAND":
      if (!isAdministrator) return <span className="mt-1 block text-[11px] text-zinc-400">An owner or administrator approves company details.{fix.focus === "disclaimer" && footerId ? " You can add a disclaimer to this page's footer instead." : ""}</span>;
      return open
        ? <div className="mt-2 rounded-md border border-sky-400/30 bg-sky-500/5 p-3" data-testid={`fix-${item.id}`}><BrandDetailsForm compact focus={fix.focus} onSaved={() => setOpen(false)} onCancel={() => setOpen(false)} /></div>
        : <span className="flex flex-wrap gap-1.5">
          <button type="button" className={action} onClick={() => setOpen(true)}><Wrench className="size-3" aria-hidden="true" />{fix.focus === "disclaimer" ? "Add disclaimer here" : "Approve contacts here"}</button>
          {fix.focus === "disclaimer" && footerId && <button type="button" className={action} onClick={() => onOpenSection(footerId)}>Only for this page (footer)<ArrowRight className="size-3" aria-hidden="true" /></button>}
        </span>;
    case "LEAD_FORM":
      return open ? <div className="mt-2"><LeadFormControl /></div>
        : <button type="button" className={action} onClick={() => setOpen(true)}><Wrench className="size-3" aria-hidden="true" />Connect a form here</button>;
    case "PAGE": return <button type="button" className={action} onClick={onOpenPage}>Open page settings<ArrowRight className="size-3" aria-hidden="true" /></button>;
    case "SECTION": return <button type="button" className={action} onClick={() => onOpenSection(fix.sectionId)}>Go to the section<ArrowRight className="size-3" aria-hidden="true" /></button>;
    case "RECORD": return <span className="flex flex-wrap items-center gap-1.5">
      <a href={`/${fix.record === "project" ? "projects" : "listings"}/${fix.id}`} target="_blank" rel="noreferrer" className={action}>Open the {fix.record} in the CRM<ExternalLink className="size-3" aria-hidden="true" /></a>
      <span className="mt-1.5 text-[11px] text-zinc-500">then press Re-check.</span>
    </span>;
  }
}
