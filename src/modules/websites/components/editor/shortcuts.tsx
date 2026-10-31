"use client";

import { Keyboard, X } from "lucide-react";

const SHORTCUTS: Array<[string, string]> = [
  ["Ctrl + S", "Save a new version"],
  ["Ctrl + Z / Ctrl + Shift + Z", "Undo / redo"],
  ["Ctrl + D", "Duplicate the selected section or widget"],
  ["Delete", "Delete the selected section or widget"],
  ["Alt + arrow keys", "Move the selected element (Shift: 20 px)"],
  ["Escape", "Deselect the widget, then the section"],
  ["Enter (while typing)", "Finish editing a line of text"],
  ["Right-click a section", "Copy or paste style, save to the library, hide"],
  ["?", "Show this list"],
];

export function ShortcutSheet({onClose}: {onClose: () => void}) {
  return <div role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={onClose}>
    <div onClick={event => event.stopPropagation()} className="w-full max-w-md rounded-lg border border-white/10 bg-zinc-900 p-5 text-zinc-100 shadow-2xl">
      <div className="mb-4 flex items-center justify-between"><h2 id="shortcuts-title" className="flex items-center gap-2 text-base font-semibold"><Keyboard className="size-4 text-sky-300" aria-hidden="true" />Keyboard shortcuts</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-zinc-400 hover:bg-white/10"><X className="size-4" /></button></div>
      <dl className="divide-y divide-white/10 text-sm">{SHORTCUTS.map(([keys, action]) => <div key={keys} className="flex items-center justify-between gap-4 py-2">
        <dt><kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-xs text-zinc-200">{keys}</kbd></dt><dd className="text-right text-zinc-400">{action}</dd>
      </div>)}</dl>
    </div>
  </div>;
}
