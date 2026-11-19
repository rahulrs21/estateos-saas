"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { Move } from "lucide-react";

/**
 * A handle on the selected element: drag it to move the element on the
 * canvas. The element follows the pointer while dragging and the move is
 * saved once, when released (one undo step), as the element's offset. The
 * handle follows the element when the canvas scrolls, resizes or changes.
 */
export function MoveHandle({scroller, target, zoom, onMove}: {
  /** The scrolling canvas (positioned), the element's selector inside it, and the canvas zoom. */
  scroller: RefObject<HTMLElement | null>; target: string; zoom: number; onMove: (dx: number, dy: number) => void;
}) {
  const [box, setBox] = useState<{left: number; top: number} | null>(null);
  const drag = useRef<{x: number; y: number; node: HTMLElement} | null>(null);
  useEffect(() => {
    const area = scroller.current;
    if (!area) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const node = area.querySelector<HTMLElement>(target);
        if (!node) { setBox(null); return; }
        const rect = node.getBoundingClientRect();
        const outer = area.getBoundingClientRect();
        setBox({left: rect.left - outer.left + area.scrollLeft, top: rect.top - outer.top + area.scrollTop});
      });
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(area);
    const changes = new MutationObserver(measure);
    changes.observe(area, {subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class"]});
    area.addEventListener("scroll", measure, {passive: true});
    return () => { cancelAnimationFrame(frame); resize.disconnect(); changes.disconnect(); area.removeEventListener("scroll", measure); };
  }, [scroller, target]);
  if (!box) return null;
  const start = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const node = scroller.current?.querySelector<HTMLElement>(target);
    if (!node || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {x: event.clientX, y: event.clientY, node};
  };
  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state) return;
    // The canvas may be zoomed: page pixels are screen pixels divided by the zoom.
    state.node.style.translate = `${(event.clientX - state.x) / zoom}px ${(event.clientY - state.y) / zoom}px`;
  };
  const end = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state) return;
    drag.current = null;
    state.node.style.translate = "";
    const dx = Math.round((event.clientX - state.x) / zoom);
    const dy = Math.round((event.clientY - state.y) / zoom);
    if (dx || dy) onMove(dx, dy);
  };
  return <button type="button" aria-label="Drag to move this element" title="Drag to move (Alt + arrow keys nudge it)" data-testid="element-move-handle"
    onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
    className="absolute z-[55] flex size-6 -translate-x-1/2 -translate-y-1/2 cursor-move touch-none items-center justify-center rounded-full bg-sky-500 text-white shadow-lg ring-2 ring-white"
    style={{left: box.left, top: box.top}}>
    <Move className="size-3.5" aria-hidden="true" />
  </button>;
}
