"use client";

import { Children, useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/*
 * Landing page carousels (docs/PAGE_COMPONENT_REGISTRY.md#section-types).
 * No scrollbar: previous and next buttons, the arrow keys and dragging
 * (mouse; touch swipes natively in the strip and drags the 3D ring). A drag
 * never counts as a click, so it does not open the photo viewer. Visitors who
 * prefer reduced motion get no animated transitions.
 */

const BUTTON = "pg-carousel-btn inline-flex size-11 items-center justify-center rounded-full border border-[var(--pg-border)] text-[var(--pg-fg)] transition-colors hover:bg-[var(--pg-muted)] disabled:pointer-events-none disabled:opacity-35";

/** The click that ends a drag is not a choice (photo viewer, links). */
function swallowNextClick(node: HTMLElement) {
  const swallow = (event: MouseEvent) => { event.preventDefault(); event.stopPropagation(); };
  node.addEventListener("click", swallow, {capture: true, once: true});
  window.setTimeout(() => node.removeEventListener("click", swallow, {capture: true}), 0);
}

/** A strip of photos that scrolls sideways and snaps to each photo. */
export function PageCarousel({label, children}: {label: string; children: ReactNode}) {
  const track = useRef<HTMLUListElement>(null);
  const drag = useRef<{x: number; left: number; moved: boolean} | null>(null);
  const [dragging, setDragging] = useState(false);
  const [edges, setEdges] = useState({start: true, end: false});
  const update = useCallback(() => {
    const node = track.current;
    if (node) setEdges({start: node.scrollLeft <= 4, end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 4});
  }, []);
  useEffect(() => {
    const node = track.current;
    if (!node) return;
    update();
    const resize = new ResizeObserver(update);
    resize.observe(node);
    return () => resize.disconnect();
  }, [update]);
  const go = (direction: 1 | -1) => {
    const node = track.current;
    if (!node) return;
    const first = node.children[0] as HTMLElement | undefined;
    const step = first ? first.offsetWidth + 20 : node.clientWidth * 0.8;
    node.scrollBy({left: direction * Math.max(step, node.clientWidth * 0.6), behavior: "smooth"});
  };
  const startDrag = (event: ReactPointerEvent<HTMLUListElement>) => {
    const node = track.current;
    if (!node || event.pointerType !== "mouse" || event.button !== 0) return;
    drag.current = {x: event.clientX, left: node.scrollLeft, moved: false};
    const move = (moveEvent: PointerEvent) => {
      const state = drag.current;
      if (!state) return;
      const distance = moveEvent.clientX - state.x;
      if (!state.moved && Math.abs(distance) < 6) return;
      if (!state.moved) { state.moved = true; setDragging(true); }
      moveEvent.preventDefault();
      node.scrollLeft = state.left - distance;
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      const moved = drag.current?.moved;
      drag.current = null;
      if (!moved) return;
      swallowNextClick(node);
      setDragging(false);
      const items = [...node.children] as HTMLElement[];
      const nearest = items.reduce((best, item) => Math.abs(item.offsetLeft - node.scrollLeft) < Math.abs(best.offsetLeft - node.scrollLeft) ? item : best, items[0]);
      if (nearest) node.scrollTo({left: nearest.offsetLeft, behavior: "smooth"});
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };
  const keys = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === "ArrowRight") { event.preventDefault(); go(1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); go(-1); }
  };
  return <div className="pg-carousel">
    <ul ref={track} onScroll={update} onPointerDown={startDrag} onKeyDown={keys} onDragStart={event => event.preventDefault()} tabIndex={0} aria-label={label} data-dragging={dragging || undefined}
      className={`pg-carousel-track relative flex gap-5 overflow-x-auto outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-[var(--pg-accent)] [&::-webkit-scrollbar]:hidden ${dragging ? "cursor-grabbing select-none snap-none" : "cursor-grab snap-x snap-mandatory"}`}>
      {children}
    </ul>
    <div className="mt-6 flex justify-end gap-2">
      <button type="button" className={BUTTON} onClick={() => go(-1)} disabled={edges.start} aria-label="Previous photos"><ChevronLeft className="size-5" aria-hidden="true" /></button>
      <button type="button" className={BUTTON} onClick={() => go(1)} disabled={edges.end} aria-label="Next photos"><ChevronRight className="size-5" aria-hidden="true" /></button>
    </div>
  </div>;
}

/**
 * A 3D carousel: the photos stand on a curve in perspective and turn as it
 * rotates. Drag (mouse or touch), the buttons or the arrow keys rotate it; a
 * side photo brings itself to the front when clicked, the front photo opens
 * in the viewer.
 */
export function PageCoverflow({label, children}: {label: string; children: ReactNode}) {
  const items = Children.toArray(children);
  const count = items.length;
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{x: number; start: number; moved: boolean} | null>(null);
  const [position, setPosition] = useState(0);
  const [dragging, setDragging] = useState(false);
  const clamp = useCallback((value: number) => Math.max(0, Math.min(count - 1, value)), [count]);
  // The position stays within the photos even if the list gets shorter.
  const shown = clamp(position);
  const active = Math.round(shown);
  const go = (direction: 1 | -1) => setPosition(current => clamp(Math.round(current) + direction));
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const node = stage.current;
    if (!node || (event.pointerType === "mouse" && event.button !== 0)) return;
    // One photo per ~30% of the stage width.
    const unit = Math.max(120, node.clientWidth * 0.3);
    drag.current = {x: event.clientX, start: shown, moved: false};
    const move = (moveEvent: PointerEvent) => {
      const state = drag.current;
      if (!state) return;
      const distance = moveEvent.clientX - state.x;
      if (!state.moved && Math.abs(distance) < 6) return;
      if (!state.moved) { state.moved = true; setDragging(true); }
      setPosition(clamp(state.start - distance / unit));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      const moved = drag.current?.moved;
      drag.current = null;
      if (!moved) return;
      swallowNextClick(node);
      setDragging(false);
      setPosition(current => clamp(Math.round(current)));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") { event.preventDefault(); go(1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); go(-1); }
  };
  return <div className="pg-coverflow-3d" role="group" aria-roledescription="carousel" aria-label={label}>
    <div ref={stage} onPointerDown={startDrag} onKeyDown={keys} onDragStart={event => event.preventDefault()} tabIndex={0} data-dragging={dragging || undefined}
      className={`pg-coverflow-stage relative mx-auto h-[clamp(18rem,52cqi,34rem)] touch-pan-y select-none overflow-hidden outline-none [perspective:1800px] focus-visible:ring-2 focus-visible:ring-[var(--pg-accent)] ${dragging ? "cursor-grabbing" : "cursor-grab"}`}>
      {items.map((item, index) => {
        const offset = index - shown;
        const distance = Math.abs(offset);
        const turn = Math.max(-55, Math.min(55, -offset * 38));
        return <div key={index} data-slot={index} data-active={index === active || undefined} aria-hidden={index !== active || undefined}
          onClickCapture={event => { if (index !== active) { event.preventDefault(); event.stopPropagation(); setPosition(index); } }}
          onFocusCapture={() => { if (index !== active) setPosition(index); }}
          className="pg-coverflow-slot absolute left-1/2 top-0 aspect-[3/4] h-full"
          style={{
            transform: `translateX(calc(-50% + ${offset * 62}%)) translateZ(${-distance * 180}px) rotateY(${turn}deg)`,
            zIndex: 100 - Math.round(distance * 10), opacity: distance > 3.4 ? 0 : 1 - Math.min(distance, 3) * 0.16,
            transition: dragging ? "none" : undefined, pointerEvents: distance > 3.4 ? "none" : undefined,
          }}>{item}</div>;
      })}
    </div>
    <div className="mt-8 flex items-center justify-center gap-4">
      <button type="button" className={BUTTON} onClick={() => go(-1)} disabled={active <= 0} aria-label="Previous photo"><ChevronLeft className="size-5" aria-hidden="true" /></button>
      <span className="min-w-14 text-center text-sm tabular-nums text-[var(--pg-muted-fg)]" aria-live="polite">{`${active + 1} / ${count}`}</span>
      <button type="button" className={BUTTON} onClick={() => go(1)} disabled={active >= count - 1} aria-label="Next photo"><ChevronRight className="size-5" aria-hidden="true" /></button>
    </div>
  </div>;
}
