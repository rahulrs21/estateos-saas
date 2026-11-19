"use client";

import { Shapes, X } from "lucide-react";
import { SECTION_DEFINITIONS, type PageSection } from "../../registry";

/** Confirms "Convert to custom section": what changes, what stays, and that it can be undone. */
export function ConvertSectionDialog({section, onConfirm, onClose}: {section: PageSection; onConfirm: () => void; onClose: () => void}) {
  const label = SECTION_DEFINITIONS[section.type].label;
  return <div role="dialog" aria-modal="true" aria-labelledby="convert-section-title" data-testid="convert-dialog" className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={onClose}>
    <div onClick={event => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-lg border border-white/10 bg-zinc-900 p-5 text-zinc-100 shadow-2xl">
      <div className="flex items-center justify-between">
        <h2 id="convert-section-title" className="flex items-center gap-2 text-base font-semibold"><Shapes className="size-4 text-sky-300" aria-hidden="true" />Convert {label} to a custom section?</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-zinc-400 hover:bg-white/10"><X className="size-4" /></button>
      </div>
      <ul className="list-disc space-y-1.5 ps-5 text-xs leading-5 text-zinc-300">
        <li>Each part becomes a widget in rows and columns, so you can drag it into any column, add columns and change their widths, like in Elementor.</li>
        <li>Texts, buttons and photos are copied with their styles. Prices and key facts become counters that keep showing the CRM values.</li>
        <li>The background, spacing and visibility stay. The section&apos;s built-in layouts (such as Split or Showcase) no longer apply.</li>
        <li>You can undo it with Ctrl+Z until you leave the editor.</li>
      </ul>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-sky-400">Cancel</button>
        <button type="button" autoFocus onClick={onConfirm} data-testid="convert-confirm" className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-400">Convert</button>
      </div>
    </div>
  </div>;
}
