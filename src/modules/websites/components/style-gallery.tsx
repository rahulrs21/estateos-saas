"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Eye, Monitor, Smartphone, Sparkles, Tablet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CLASSIC_DESIGN_STYLES, DESIGN_STYLE_DETAILS, DESIGN_STYLE_LABELS, NEW_DESIGN_STYLES, type DesignStyle } from "../registry";
import { PAGE_STRUCTURES, STRUCTURE_DEFINITIONS, STYLE_STRUCTURES, type PageStructure } from "../structures";
import { SAMPLE_TODAY, sampleMiniature, samplePage } from "../style-samples";
import { PageRenderer } from "./page-renderer";

/**
 * The style gallery (docs/AI_PAGE_BUILDER.md#style-gallery): every design
 * style and page structure as a live miniature of a sample page, built by
 * the same mapping and renderer as a generated page, with a full-size
 * preview on desktop, tablet and phone widths. Sample content only: no
 * company data is read and nothing is saved.
 */

const PAGE_WIDTH = 1280;
const SLIDE = "flex w-[82%] shrink-0 snap-start flex-col sm:w-[calc((100%-0.75rem)/2)] lg:w-[calc((100%-1.5rem)/3)] xl:w-[calc((100%-2.25rem)/4)]";

/** A sample page scaled down to fit its frame; rendered once it scrolls into view. */
function Miniature({style, structure}: {style: DesignStyle; structure: PageStructure}) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const resize = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / PAGE_WIDTH));
    resize.observe(node);
    const seen = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); seen.disconnect(); } }, {rootMargin: "300px"});
    seen.observe(node);
    return () => { resize.disconnect(); seen.disconnect(); };
  }, []);
  const page = useMemo(() => visible ? sampleMiniature(style, structure) : null, [visible, style, structure]);
  return <div ref={frame} aria-hidden="true" inert className="relative aspect-[16/11] overflow-hidden bg-muted">
    {page && scale > 0 && <div className="pg-still pointer-events-none absolute left-0 top-0 origin-top-left select-none" style={{width: PAGE_WIDTH, transform: `scale(${scale})`}}>
      <PageRenderer page={page} mode="preview" today={SAMPLE_TODAY} hideNotice />
    </div>}
  </div>;
}

function PreviewLink({onClick, label}: {onClick: () => void; label: string}) {
  return <button type="button" onClick={onClick} aria-label={label} className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <Eye className="size-3.5" aria-hidden="true" />Preview
  </button>;
}

/**
 * A style card. The miniature is a real page (with its own links, buttons
 * and form), so it sits beside the card's button rather than inside it; the
 * button's overlay stretches over the whole card, so a click anywhere selects.
 */
function StyleCard({style, structure, selected, onSelect, onPreview}: {style: DesignStyle; structure: PageStructure; selected: boolean; onSelect: () => void; onPreview: () => void}) {
  return <li className={`group relative ${SLIDE} overflow-hidden rounded-xl border bg-card transition-colors has-[[role=radio]:focus-visible]:ring-2 has-[[role=radio]:focus-visible]:ring-ring ${selected ? "border-primary ring-2 ring-primary/25" : "hover:border-foreground/30"}`}>
    <Miniature style={style} structure={structure} />
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect} data-testid={`style-${style}`}
      className="block w-full flex-1 border-t p-3 text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
      <span className="flex items-center justify-between gap-2 text-sm font-medium">{DESIGN_STYLE_LABELS[style]}{selected && <Check className="size-4 text-primary" aria-hidden="true" />}</span>
      <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{DESIGN_STYLE_DETAILS[style].description}</span>
    </button>
    <div className="relative z-10 flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
      <span className="truncate">{STRUCTURE_DEFINITIONS[STYLE_STRUCTURES[style]].label} layout</span>
      <PreviewLink onClick={onPreview} label={`Preview ${DESIGN_STYLE_LABELS[style]}`} />
    </div>
  </li>;
}

export interface PreviewTarget { style: DesignStyle; structure: PageStructure }

/**
 * A row of cards that scrolls sideways, four per view on wide screens, with
 * previous and next buttons. Phones and trackpads swipe natively; with a
 * mouse the row can be dragged, and it settles on the nearest card when
 * released. A drag never selects the card it started on. Focusing a card
 * with the keyboard scrolls it into view.
 */
function Carousel({title, count, children}: {title: string; count: number; children: ReactNode}) {
  const track = useRef<HTMLUListElement>(null);
  const drag = useRef<{x: number; left: number; moved: boolean} | null>(null);
  const [dragging, setDragging] = useState(false);
  const [edges, setEdges] = useState({start: true, end: false});
  const update = useCallback(() => {
    const node = track.current;
    if (!node) return;
    setEdges({start: node.scrollLeft <= 4, end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 4});
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
    if (node) node.scrollBy({left: direction * node.clientWidth, behavior: "smooth"});
  };
  const startDrag = (event: ReactPointerEvent<HTMLUListElement>) => {
    const node = track.current;
    // Touch and pens scroll the row natively; only the main mouse button drags.
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
      // The click that follows a drag is not a choice.
      const swallow = (click: MouseEvent) => { click.preventDefault(); click.stopPropagation(); };
      node.addEventListener("click", swallow, {capture: true, once: true});
      window.setTimeout(() => node.removeEventListener("click", swallow, {capture: true}), 0);
      setDragging(false);
      // Settle on the nearest card.
      const cards = [...node.children] as HTMLElement[];
      // Cards are positioned from the row (relative), less its 4px start padding.
      const offset = (card: HTMLElement) => card.offsetLeft - 4;
      const nearest = cards.reduce((best, card) => Math.abs(offset(card) - node.scrollLeft) < Math.abs(offset(best) - node.scrollLeft) ? card : best, cards[0]);
      if (nearest) node.scrollTo({left: Math.max(0, offset(nearest)), behavior: "smooth"});
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };
  return <section className="min-w-0 space-y-2" aria-label={title}>
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title} <span className="font-normal normal-case tracking-normal">· {count}</span></h3>
      <div className="flex gap-1.5">
        <Button type="button" variant="outline" size="icon-sm" onClick={() => go(-1)} disabled={edges.start} aria-label={`Previous ${title.toLowerCase()}`}><ChevronLeft aria-hidden="true" /></Button>
        <Button type="button" variant="outline" size="icon-sm" onClick={() => go(1)} disabled={edges.end} aria-label={`More ${title.toLowerCase()}`}><ChevronRight aria-hidden="true" /></Button>
      </div>
    </div>
    <ul ref={track} onScroll={update} onPointerDown={startDrag} onDragStart={event => event.preventDefault()} data-testid={`carousel-${title.toLowerCase().replaceAll(" ", "-")}`} data-dragging={dragging || undefined}
      className={`relative -mx-1 flex scroll-px-1 gap-3 overflow-x-auto px-1 py-1 pb-3 [scrollbar-width:thin] ${dragging ? "cursor-grabbing select-none snap-none scroll-auto [&_*]:!cursor-grabbing" : "cursor-grab snap-x snap-mandatory scroll-smooth"}`}>{children}</ul>
  </section>;
}

/**
 * Design style picker. `value` null is "Let Claude choose" (offered when
 * `allowAuto`); `structure` is the structure the miniatures show (each
 * style's own when null).
 */
export function StylePicker({value, onChange, allowAuto, structure, onPreview}: {
  value: DesignStyle | null; onChange: (style: DesignStyle | null) => void; allowAuto: boolean; structure: PageStructure | null; onPreview: (target: PreviewTarget) => void;
}) {
  const card = (style: DesignStyle) => <StyleCard key={style} style={style} structure={structure ?? STYLE_STRUCTURES[style]} selected={value === style}
    onSelect={() => onChange(style)} onPreview={() => onPreview({style, structure: structure ?? STYLE_STRUCTURES[style]})} />;
  // min-w-0: a fieldset is otherwise at least as wide as its content, which would stretch the page with the carousels.
  return <fieldset className="min-w-0 space-y-4">
    <legend className="text-sm font-medium">Design style</legend>
    <p className="-mt-2 text-xs text-muted-foreground">Each preview is a real sample page built in that style. Your page uses your record&apos;s facts, photos and Claude&apos;s copy.</p>
    <div role="radiogroup" aria-label="Design style" className="space-y-5">
      {allowAuto && <button type="button" role="radio" aria-checked={value === null} onClick={() => onChange(null)} data-testid="style-auto"
        className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${value === null ? "border-primary bg-primary/5 ring-2 ring-primary/25" : "hover:bg-muted/50"}`}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-sky-500 to-emerald-400 text-white"><Sparkles className="size-5" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1"><span className="block font-medium">Let Claude choose</span><span className="text-muted-foreground">Claude picks the style and layout that suit your record and brief. Every page can turn out different.</span></span>
        {value === null && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
      </button>}
      <Carousel title="New design styles" count={NEW_DESIGN_STYLES.length}>{NEW_DESIGN_STYLES.map(card)}</Carousel>
      <Carousel title="Signature styles" count={CLASSIC_DESIGN_STYLES.length}>{CLASSIC_DESIGN_STYLES.map(card)}</Carousel>
    </div>
  </fieldset>;
}

/** A structure's sections as a small wireframe. */
function Wireframe({structure}: {structure: PageStructure}) {
  const blocks = STRUCTURE_DEFINITIONS[structure].wireframe;
  return <div aria-hidden="true" className="flex h-36 flex-col gap-1 bg-muted/60 p-2.5">
    {blocks.map(([label, size], index) => <div key={index} className={`flex min-h-0 items-center justify-center rounded-[3px] px-1 text-[9px] font-medium leading-none text-muted-foreground ${index === 0 ? "bg-primary/20 text-foreground" : "bg-background"}`} style={{flexGrow: size}}>
      <span className="truncate">{label}</span>
    </div>)}
  </div>;
}

/** Page structure picker. `value` null matches the chosen style (or lets Claude choose when no style is chosen). */
export function StructurePicker({value, onChange, style, onPreview}: {
  value: PageStructure | null; onChange: (structure: PageStructure | null) => void; style: DesignStyle | null; onPreview: (target: PreviewTarget) => void;
}) {
  const recommended = style ? STYLE_STRUCTURES[style] : null;
  return <fieldset className="min-w-0 space-y-3">
    <legend className="text-sm font-medium">Page structure</legend>
    <p className="-mt-1 text-xs text-muted-foreground">Which sections the page has and how they are laid out. Sections whose CRM data is missing are left out automatically.</p>
    <div role="radiogroup" aria-label="Page structure" className="space-y-3">
      <button type="button" role="radio" aria-checked={value === null} onClick={() => onChange(null)} data-testid="structure-auto"
        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${value === null ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
        <span><span className="block font-medium">{style ? "Match the design style (recommended)" : "Let Claude choose"}</span>
          <span className="text-muted-foreground">{recommended ? `${DESIGN_STYLE_LABELS[style!]} uses the ${STRUCTURE_DEFINITIONS[recommended].label} structure.` : "Claude picks the structure together with the style."}</span></span>
        {value === null && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
      </button>
      <Carousel title="Page structures" count={PAGE_STRUCTURES.length}>{PAGE_STRUCTURES.map(structure => {
        const selected = value === structure;
        const definition = STRUCTURE_DEFINITIONS[structure];
        return <li key={structure} className={`${SLIDE} overflow-hidden rounded-xl border bg-card transition-colors ${selected ? "border-primary ring-2 ring-primary/25" : "hover:border-foreground/30"}`}>
          <button type="button" role="radio" aria-checked={selected} onClick={() => onChange(structure)} data-testid={`structure-${structure}`} className="block w-full flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <Wireframe structure={structure} />
            <span className="block border-t p-3">
              <span className="flex items-center justify-between gap-2 text-sm font-medium">{definition.label}{selected && <Check className="size-4 text-primary" aria-hidden="true" />}</span>
              {recommended === structure && <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Recommended</span>}
              <span className="mt-1 line-clamp-3 block text-xs text-muted-foreground">{definition.description}</span>
            </span>
          </button>
          <div className="border-t px-3 py-2"><PreviewLink onClick={() => onPreview({style: style ?? "CONTEMPORARY", structure})} label={`Preview the ${definition.label} structure`} /></div>
        </li>;
      })}</Carousel>
    </div>
  </fieldset>;
}

const DEVICES = [{key: "desktop", label: "Desktop", width: "100%", icon: Monitor}, {key: "tablet", label: "Tablet", width: "820px", icon: Tablet}, {key: "mobile", label: "Phone", width: "390px", icon: Smartphone}] as const;

/** The full sample page in a style and structure, at desktop, tablet or phone width. */
export function StylePreviewDialog({target, onClose, onUse}: {target: PreviewTarget; onClose: () => void; onUse: (target: PreviewTarget) => void}) {
  const [device, setDevice] = useState<(typeof DEVICES)[number]["key"]>("desktop");
  const close = useRef<HTMLButtonElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  /*
   * Links to sections of the page (the menu, "Enquire", "Scroll to explore")
   * scroll this preview. Every miniature behind it is the same sample page
   * with the same section names, so the browser would otherwise jump to the
   * first match, a hidden miniature, and the preview would not move.
   */
  const followAnchor = (event: ReactMouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href^='#']");
    const panel = scroller.current;
    if (!link || !panel) return;
    event.preventDefault();
    link.closest("details")?.removeAttribute("open");
    const id = decodeURIComponent(link.getAttribute("href")!.slice(1));
    const target = id && id !== "top" ? panel.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`) : null;
    if (target) target.scrollIntoView({behavior: "smooth", block: "start"});
    else panel.scrollTo({top: 0, behavior: "smooth"});
  };
  const page = useMemo(() => samplePage(target.style, target.structure), [target]);
  useEffect(() => {
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [onClose]);
  const width = DEVICES.find(item => item.key === device)!.width;
  return <div role="dialog" aria-modal="true" aria-labelledby="style-preview-title" className="fixed inset-0 z-[90] flex flex-col bg-zinc-950/95" data-testid="style-preview">
    <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 text-zinc-100">
      <div className="min-w-0 flex-1">
        <h2 id="style-preview-title" className="truncate text-sm font-semibold">{DESIGN_STYLE_LABELS[target.style]} · {STRUCTURE_DEFINITIONS[target.structure].label} structure</h2>
        <p className="truncate text-xs text-zinc-400">Sample preview with illustrative content. Your page uses your record&apos;s facts, photos and Claude&apos;s copy.</p>
      </div>
      <div className="flex rounded-lg border border-white/10 p-0.5" role="group" aria-label="Preview width">{DEVICES.map(item => <button key={item.key} type="button" aria-pressed={device === item.key} onClick={() => setDevice(item.key)} title={item.label}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs ${device === item.key ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white"}`}><item.icon className="size-4" aria-hidden="true" /><span className="hidden sm:inline">{item.label}</span></button>)}</div>
      <Button size="sm" onClick={() => onUse(target)} data-testid="style-preview-use"><Check aria-hidden="true" />Use this design</Button>
      <button ref={close} type="button" onClick={onClose} aria-label="Close preview" className="rounded-md p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"><X className="size-5" /></button>
    </div>
    <div ref={scroller} onClickCapture={followAnchor} className="pg-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto min-h-full bg-white shadow-2xl transition-[max-width] duration-300" style={{maxWidth: width}}>
        <PageRenderer page={page} mode="preview" today={SAMPLE_TODAY} hideNotice />
      </div>
    </div>
  </div>;
}
