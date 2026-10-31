"use client";

import { useEffect } from "react";
import { LayoutTemplate, X } from "lucide-react";
import { COLUMN_LAYOUTS, type ColumnLayout } from "../../registry";
import { LAYOUT_LABELS, LayoutIcon } from "./custom-panel";

/**
 * "Select your structure" (as in Elementor): a new section starts as one or
 * more columns, or the visitor picks a ready-made section from Elements.
 */
export function StructurePicker({onPick, onReadyMade, onClose}: {onPick: (layout: ColumnLayout) => void; onReadyMade: () => void; onClose: () => void}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="structure-title" onClick={onClose}>
    <div className="w-full max-w-xl rounded-xl border border-white/10 bg-zinc-900 p-5 text-zinc-100 shadow-2xl" onClick={event => event.stopPropagation()}>
      <div className="mb-1 flex items-center justify-between">
        <h2 id="structure-title" className="text-base font-semibold">Select your structure</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"><X className="size-4" /></button>
      </div>
      <p className="mb-4 text-xs text-zinc-400">A new section with these columns. Change the width of each column, its phone layout and its style afterwards in the section&apos;s Content tab.</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="list">
        {COLUMN_LAYOUTS.map(layout => <button key={layout} type="button" role="listitem" onClick={() => onPick(layout)} aria-label={`${LAYOUT_LABELS[layout]} columns`}
          className="group flex flex-col items-center gap-2 rounded-lg border border-white/10 px-2 py-3 text-[11px] tabular-nums text-zinc-300 transition-colors hover:border-sky-400 hover:bg-sky-500/10 hover:text-white">
          <LayoutIcon layout={layout} className="h-8 w-full text-zinc-500 group-hover:text-sky-400" />{LAYOUT_LABELS[layout]}
        </button>)}
      </div>
      <button type="button" onClick={onReadyMade} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 px-3 py-2.5 text-sm text-zinc-300 hover:border-sky-400 hover:text-white">
        <LayoutTemplate className="size-4" aria-hidden="true" />Or add a ready-made section (hero, gallery, payment plan…)
      </button>
    </div>
  </div>;
}
