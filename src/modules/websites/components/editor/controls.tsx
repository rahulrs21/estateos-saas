"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";

/*
 * Small, accessible inspector controls for the page editor. Values are only
 * ever enums, bounded numbers, plain text or validated #rrggbb colours.
 */

export const inputClass = "h-9 w-full rounded-md border border-white/10 bg-white/5 px-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-sky-400 focus:ring-1 focus:ring-sky-400";
export const textareaClass = "min-h-20 w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-sky-400 focus:ring-1 focus:ring-sky-400";

export function Group({title, children, defaultOpen = true}: {title: string; children: ReactNode; defaultOpen?: boolean}) {
  const [open, setOpen] = useState(defaultOpen);
  return <section className="border-b border-white/10">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-300 hover:text-white">
      {title}<ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>
    {open && <div className="space-y-4 px-4 pb-5">{children}</div>}
  </section>;
}

export function Field({label, htmlFor, hint, children, aside}: {label: string; htmlFor?: string; hint?: string; children: ReactNode; aside?: ReactNode}) {
  return <div className="space-y-1.5">
    <div className="flex items-center justify-between gap-2"><label htmlFor={htmlFor} className="text-[13px] font-medium text-zinc-200">{label}</label>{aside}</div>
    {children}
    {hint && <p className="text-[11px] leading-4 text-zinc-500">{hint}</p>}
  </div>;
}

export function TextControl({label, value, max, multiline, onChange, hint, placeholder}: {label: string; value: string; max: number; multiline?: boolean; onChange: (value: string) => void; hint?: string; placeholder?: string}) {
  const id = useId();
  return <Field label={label} htmlFor={id} hint={hint} aside={<span className="text-[11px] tabular-nums text-zinc-500">{value.length}/{max}</span>}>
    {multiline
      ? <textarea id={id} value={value} maxLength={max} placeholder={placeholder} onChange={event => onChange(event.target.value)} className={textareaClass} />
      : <input id={id} value={value} maxLength={max} placeholder={placeholder} onChange={event => onChange(event.target.value)} className={inputClass} />}
  </Field>;
}

export function Segmented<T extends string>({label, value, options, onChange, labels}: {label?: string; value: T; options: readonly T[]; onChange: (value: T) => void; labels?: Partial<Record<T, ReactNode>>}) {
  const id = useId();
  const control = <div role="radiogroup" aria-labelledby={label ? id : undefined} className="flex flex-wrap gap-1 rounded-md bg-white/5 p-1">
    {options.map(option => <button key={option} type="button" role="radio" aria-checked={value === option} onClick={() => onChange(option)}
      className={`min-w-0 flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${value === option ? "bg-sky-500 text-white" : "text-zinc-300 hover:bg-white/10"}`}>{labels?.[option] ?? humanize(option)}</button>)}
  </div>;
  return label ? <div className="space-y-1.5"><p id={id} className="text-[13px] font-medium text-zinc-200">{label}</p>{control}</div> : control;
}

export function SelectControl<T extends string>({label, value, options, onChange, labels}: {label: string; value: T; options: readonly T[]; onChange: (value: T) => void; labels?: Partial<Record<T, string>>}) {
  const id = useId();
  return <Field label={label} htmlFor={id}>
    <select id={id} value={value} onChange={event => onChange(event.target.value as T)} className={`${inputClass} [&>option]:bg-zinc-900`}>
      {options.map(option => <option key={option} value={option}>{labels?.[option] ?? humanize(option)}</option>)}
    </select>
  </Field>;
}

export function Toggle({label, checked, onChange, hint}: {label: string; checked: boolean; onChange: (value: boolean) => void; hint?: string}) {
  return <label className="flex cursor-pointer items-start justify-between gap-3">
    <span className="text-[13px] text-zinc-200">{label}{hint && <span className="mt-0.5 block text-[11px] leading-4 text-zinc-500">{hint}</span>}</span>
    <span className="relative mt-0.5 inline-flex shrink-0">
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="peer sr-only" />
      <span className="h-5 w-9 rounded-full bg-white/15 transition-colors peer-checked:bg-sky-500 peer-focus-visible:ring-2 peer-focus-visible:ring-sky-300" />
      <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
    </span>
  </label>;
}

export function Slider({label, value, min, max, step = 1, onChange, unit = ""}: {label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void; unit?: string}) {
  const id = useId();
  return <Field label={label} htmlFor={id} aside={<span className="text-xs tabular-nums text-zinc-400">{value}{unit}</span>}>
    <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} className="w-full accent-sky-500" />
  </Field>;
}

/** A slider whose empty value means "keep the default"; the reset button returns to it. */
export function OptionalSlider({label, value, min, max, step = 1, unit = "", fallback, onChange, hint}: {label: string; value: number | null; min: number; max: number; step?: number; unit?: string; fallback: number; onChange: (value: number | null) => void; hint?: string}) {
  const id = useId();
  return <Field label={label} htmlFor={id} hint={hint} aside={<span className="flex items-center gap-1.5">
    <span className={`text-xs tabular-nums ${value === null ? "text-zinc-500" : "text-sky-300"}`}>{value === null ? "Default" : `${value}${unit}`}</span>
    {value !== null && <button type="button" onClick={() => onChange(null)} aria-label={`Reset ${label.toLowerCase()}`} title="Reset" className="rounded p-0.5 text-zinc-400 hover:bg-white/10 hover:text-white"><RotateCcw className="size-3" /></button>}
  </span>}>
    <input id={id} type="range" min={min} max={max} step={step} value={value ?? fallback} onChange={event => onChange(Number(event.target.value))} className={`w-full ${value === null ? "accent-zinc-500 opacity-60" : "accent-sky-500"}`} />
  </Field>;
}

const SWATCHES = ["#ffffff", "#f8f5f0", "#e7e5e4", "#111111", "#0b0b0e", "#1e293b", "#7d5f1e", "#c9a35b", "#0f6b64", "#1e3a8a", "#b03a0b", "#b0123a"];

/** Swatches, the native colour picker and a hex field; null means "use the theme". */
export function ColorControl({label, value, onChange, allowReset = true}: {label: string; value: string | null; onChange: (value: string | null) => void; allowReset?: boolean}) {
  const id = useId();
  const [draft, setDraft] = useState(value ?? "");
  const commit = (next: string) => { setDraft(next); if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next.toLowerCase()); };
  return <Field label={label} htmlFor={id} aside={allowReset && value ? <button type="button" onClick={() => { setDraft(""); onChange(null); }} className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"><RotateCcw className="size-3" aria-hidden="true" />Theme</button> : null}>
    <div className="flex flex-wrap gap-1.5">{SWATCHES.map(swatch => <button key={swatch} type="button" aria-label={`Colour ${swatch}`} aria-pressed={value === swatch} onClick={() => commit(swatch)}
      className={`size-6 rounded-full border ${value === swatch ? "border-sky-400 ring-2 ring-sky-400" : "border-white/20"}`} style={{backgroundColor: swatch}} />)}</div>
    <div className="flex items-center gap-2">
      <input type="color" aria-label={`${label} picker`} value={/^#[0-9a-f]{6}$/i.test(draft) ? draft : "#000000"} onChange={event => commit(event.target.value)} className="h-9 w-11 cursor-pointer rounded border border-white/10 bg-transparent" />
      <input id={id} value={draft} placeholder="Theme colour" maxLength={7} onChange={event => commit(event.target.value.trim())} className={`${inputClass} font-mono uppercase`} />
    </div>
  </Field>;
}

export function humanize(value: string) {
  const labels: Record<string, string> = {
    COMPACT: "Compact", NORMAL: "Normal", SPACIOUS: "Spacious", NONE: "None", INHERIT: "Same as above", DEFAULT: "Theme", MUTED: "Subtle", ACCENT: "Accent", DARK: "Dark", LIGHT: "Light",
    START: "Left", CENTER: "Centre", AUTO: "Auto", MEDIUM: "Medium", TALL: "Tall", SCREEN: "Full screen", BOXED: "Boxed", WIDE: "Wide", FULL: "Full width", FADE_UP: "Fade up",
    FADE: "Fade", ZOOM: "Zoom", SLIDE_LEFT: "Slide", COLOR: "Colour", IMAGE: "Image", VIDEO: "Video", LEFT: "Left", RIGHT: "Right", COMFORTABLE: "Comfortable", LARGE: "Large",
    SOFT: "Soft", ROUND: "Rounded", SANS: "Sans", SERIF: "Serif", DISPLAY: "Display",
  };
  return labels[value] ?? value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase().replace(/^\w/, letter => letter.toUpperCase());
}

type Sides = Record<"top" | "right" | "bottom" | "left", number | null>;
const SIDE_NAMES = ["top", "right", "bottom", "left"] as const;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)));

/**
 * Top, right, bottom and left in px, Elementor style. Empty sides inherit
 * (shown as placeholders); the link button edits all four together.
 */
export function BoxControl({label, value, inherited, min, max, onChange, hint}: {label: string; value: Sides | null; inherited: Record<keyof Sides, number>; min: number; max: number; onChange: (value: Sides | null) => void; hint?: string}) {
  const id = useId();
  const [linked, setLinked] = useState(false);
  const set = (side: keyof Sides, raw: string) => {
    const number = raw.trim() === "" || raw === "-" ? null : clamp(Number(raw), min, max);
    if (raw.trim() !== "" && raw !== "-" && !Number.isFinite(Number(raw))) return;
    const next: Sides = linked ? {top: number, right: number, bottom: number, left: number} : {...(value ?? {top: null, right: null, bottom: null, left: null}), [side]: number};
    onChange(SIDE_NAMES.every(name => next[name] === null) ? null : next);
  };
  return <div className="space-y-1.5" role="group" aria-labelledby={id}>
    <div className="flex items-center justify-between gap-2">
      <p id={id} className="text-[13px] font-medium text-zinc-200">{label} <span className="text-[11px] font-normal text-zinc-500">px</span></p>
      <span className="flex items-center gap-1">
        <button type="button" aria-pressed={linked} onClick={() => setLinked(!linked)} title={linked ? "Editing all sides together" : "Edit all sides together"} aria-label={`Link ${label.toLowerCase()} sides`}
          className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${linked ? "bg-sky-500 text-white" : "text-zinc-400 hover:bg-white/10 hover:text-white"}`}>Link</button>
        {value && <button type="button" onClick={() => onChange(null)} title="Reset" aria-label={`Reset ${label.toLowerCase()}`} className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"><RotateCcw className="size-3.5" /></button>}
      </span>
    </div>
    <div className="grid grid-cols-4 gap-1.5">
      {SIDE_NAMES.map(side => <label key={side} className="space-y-1 text-center">
        <input type="number" inputMode="numeric" min={min} max={max} step={1} value={value?.[side] ?? ""} placeholder={String(inherited[side])} onChange={event => set(side, event.target.value)}
          aria-label={`${label} ${side}`} className={`${inputClass} px-1 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`} />
        <span className="block text-[10px] uppercase tracking-wider text-zinc-500">{side}</span>
      </label>)}
    </div>
    {hint && <p className="text-[11px] leading-4 text-zinc-500">{hint}</p>}
  </div>;
}

/** Moves something left, right, up or down with arrow buttons (Shift for bigger steps) or exact px values. */
export function OffsetControl({label, value, max, onChange, hint}: {label: string; value: {x: number; y: number}; max: number; onChange: (value: {x: number; y: number}) => void; hint?: string}) {
  const id = useId();
  const nudge = (dx: number, dy: number, big: boolean) => onChange({x: clamp(value.x + dx * (big ? 20 : 4), -max, max), y: clamp(value.y + dy * (big ? 20 : 4), -max, max)});
  const arrow = (dx: number, dy: number, name: string, glyph: string, area: string) => <button type="button" onClick={event => nudge(dx, dy, event.shiftKey)} aria-label={`Move ${name}`} title={`Move ${name} (Shift: 20 px)`}
    className={`grid size-8 place-items-center rounded-md bg-white/5 text-sm text-zinc-200 hover:bg-sky-500 hover:text-white ${area}`}>{glyph}</button>;
  const axis = (key: "x" | "y", name: string) => <label className="space-y-1">
    <span className="block text-[10px] uppercase tracking-wider text-zinc-500">{name}</span>
    <input type="number" inputMode="numeric" min={-max} max={max} value={value[key]} onChange={event => { const number = Number(event.target.value); if (Number.isFinite(number)) onChange({...value, [key]: clamp(number, -max, max)}); }}
      aria-label={`${label} ${name}`} className={`${inputClass} text-center tabular-nums`} />
  </label>;
  return <div className="space-y-2" role="group" aria-labelledby={id}>
    <div className="flex items-center justify-between gap-2">
      <p id={id} className="text-[13px] font-medium text-zinc-200">{label}</p>
      {(value.x !== 0 || value.y !== 0) && <button type="button" onClick={() => onChange({x: 0, y: 0})} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-zinc-400 hover:bg-white/10 hover:text-white"><RotateCcw className="size-3" aria-hidden="true" />Reset</button>}
    </div>
    <div className="flex items-center gap-4">
      <div className="grid grid-cols-3 grid-rows-3 gap-1">
        {arrow(0, -1, "up", "↑", "col-start-2 row-start-1")}
        {arrow(-1, 0, "left", "←", "col-start-1 row-start-2")}
        {arrow(1, 0, "right", "→", "col-start-3 row-start-2")}
        {arrow(0, 1, "down", "↓", "col-start-2 row-start-3")}
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2">{axis("x", "Left / right")}{axis("y", "Up / down")}</div>
    </div>
    {hint && <p className="text-[11px] leading-4 text-zinc-500">{hint}</p>}
  </div>;
}
