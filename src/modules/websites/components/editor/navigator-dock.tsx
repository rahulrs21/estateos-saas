"use client";

import type { ReactNode } from "react";
import { ChevronsLeft, ChevronsRight, Layers } from "lucide-react";

/**
 * The Navigator docked on the right of the canvas (wide screens). It stays
 * open while sections and elements are edited in the left panel, and can be
 * minimised to a slim bar (remembered for the next visit).
 */
export function NavigatorDock({minimised, onMinimise, children}: {minimised: boolean; onMinimise: (minimised: boolean) => void; children: ReactNode}) {
  if (minimised) {
    return <aside aria-label="Navigator (minimised)" data-testid="navigator-dock" data-minimised="true" className="flex w-10 shrink-0 flex-col items-center border-l border-white/10 bg-zinc-900 py-2">
      <button type="button" onClick={() => onMinimise(false)} aria-label="Open the Navigator" title="Open the Navigator" data-testid="navigator-dock-open"
        className="flex flex-col items-center gap-2 rounded-md px-1.5 py-2 text-zinc-300 hover:bg-white/10 hover:text-white">
        <ChevronsLeft className="size-4" aria-hidden="true" />
        <Layers className="size-4" aria-hidden="true" />
        <span className="text-[11px] font-medium [writing-mode:vertical-rl]">Navigator</span>
      </button>
    </aside>;
  }
  return <aside aria-label="Navigator" data-testid="navigator-dock" className="flex w-72 shrink-0 flex-col border-l border-white/10 bg-zinc-900">
    <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
      <p className="flex items-center gap-2 text-sm font-semibold text-white"><Layers className="size-4 text-sky-300" aria-hidden="true" />Navigator</p>
      <button type="button" onClick={() => onMinimise(true)} aria-label="Minimise the Navigator" title="Minimise" data-testid="navigator-dock-minimise"
        className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"><ChevronsRight className="size-4" aria-hidden="true" /></button>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
  </aside>;
}
