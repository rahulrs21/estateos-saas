"use client";

import { useState } from "react";
import { ArrowLeft, ClipboardPaste, Copy, Image as ImageIcon, MousePointerClick, PanelsTopLeft, RotateCcw, Square, Type } from "lucide-react";
import { DEFAULT_ELEMENT_STYLE, ELEMENT_ALIGNS, ELEMENT_CASES, ELEMENT_FONTS, ELEMENT_WEIGHTS, MAX_BOX, MAX_OFFSET, type ElementStyle, type Offset } from "../../registry";
import { mobileSize, type ElementKind } from "../../theme";
import { ColorControl, Group, OffsetControl, OptionalSlider, Segmented, Slider, TextControl, Toggle } from "./controls";

/*
 * Styles one element on its own: a heading, eyebrow, paragraph, button,
 * image or group (Elementor-style). Every control writes a value the
 * registry validates (enums, bounded numbers, #rrggbb colours).
 */

export const ELEMENT_KIND_LABELS: Record<ElementKind, string> = {text: "Text", button: "Button", image: "Image", block: "Group", card: "Panel"};
const KIND_ICONS = {text: Type, button: MousePointerClick, image: ImageIcon, block: Square, card: PanelsTopLeft};
const DEFAULT = "DEFAULT";
type Choice<T extends string> = T | typeof DEFAULT;
const choice = <T extends string>(value: T | null): Choice<T> => value ?? DEFAULT;
const unchoice = <T extends string>(value: Choice<T>): T | null => value === DEFAULT ? null : value as T;

/** Copy and paste between elements of the same editor session. */
let styleClipboard: ElementStyle | null = null;

/** Widgets have their own alignment and device visibility, so they leave those groups out. */
export function ElementStyleControls({value, kind, onChange, widget = false}: {value: ElementStyle; kind: ElementKind; onChange: (style: ElementStyle) => void; widget?: boolean}) {
  const set = (patch: Partial<ElementStyle>) => onChange({...value, ...patch});
  const typography = kind === "text" || kind === "button";
  return <div>
    {typography && <Group title="Typography">
      {kind === "text" && <Segmented label="Font" value={choice(value.font)} options={[DEFAULT, ...ELEMENT_FONTS]} labels={{DEFAULT: "Default", HEADING: "Heading font", BODY: "Body font"}} onChange={font => set({font: unchoice(font)})} />}
      <OptionalSlider label="Size" value={value.size} min={10} max={kind === "button" ? 32 : 120} unit="px" fallback={kind === "button" ? 16 : 32} onChange={size => set({size, sizeMobile: size === null ? null : value.sizeMobile})} />
      {value.size !== null && kind === "text" && <OptionalSlider label="Size on phones" value={value.sizeMobile} min={10} max={96} unit="px" fallback={mobileSize(value.size)} onChange={sizeMobile => set({sizeMobile})}
        hint={value.sizeMobile === null ? `Automatically ${mobileSize(value.size)} px on phones.` : undefined} />}
      <Segmented label="Weight" value={choice(value.weight)} options={[DEFAULT, ...ELEMENT_WEIGHTS]} labels={{DEFAULT: "Auto", LIGHT: "300", REGULAR: "400", MEDIUM: "500", SEMIBOLD: "600", BOLD: "700"}} onChange={weight => set({weight: unchoice(weight)})} />
      <Segmented label="Letter case" value={choice(value.textCase)} options={[DEFAULT, ...ELEMENT_CASES]} labels={{DEFAULT: "Auto", NONE: "Aa", UPPERCASE: "AA", LOWERCASE: "aa", CAPITALIZE: "Ab Cd"}} onChange={textCase => set({textCase: unchoice(textCase)})} />
      <Toggle label="Italic" checked={value.italic} onChange={italic => set({italic})} />
      <OptionalSlider label="Letter spacing" value={value.letterSpacing} min={-10} max={50} unit="" fallback={0} onChange={letterSpacing => set({letterSpacing})} hint="In hundredths of the font size." />
      {kind === "text" && <OptionalSlider label="Line height" value={value.lineHeight} min={80} max={250} step={5} unit="%" fallback={140} onChange={lineHeight => set({lineHeight})} />}
    </Group>}
    {kind !== "image" && <Group title="Colour">
      <ColorControl label={kind === "button" ? "Text colour" : "Colour"} value={value.color} onChange={color => set({color})} />
      <ColorControl label={kind === "button" ? "Button colour" : kind === "text" ? "Highlight" : "Background"} value={value.background} onChange={background => set({background})} />
      {kind === "card" && <>
        <ColorControl label="Button and focus colour" value={value.accent} onChange={accent => set({accent})} />
        <p className="text-[11px] leading-4 text-zinc-500">Fields, borders and labels follow the background automatically; set a text colour only to override them.</p>
      </>}
    </Group>}
    {kind !== "button" && !widget && <Group title="Alignment">
      <Segmented value={choice(value.align)} options={[DEFAULT, ...ELEMENT_ALIGNS]} labels={{DEFAULT: "Auto"}} onChange={align => set({align: unchoice(align)})} />
      {kind === "image" && value.align && value.maxWidth === null && <p className="text-[11px] text-zinc-500">Set a maximum width below to see the image move.</p>}
    </Group>}
    <Group title={kind === "text" ? "Size" : "Shape and size"}>
      {kind !== "text" && <OptionalSlider label="Corner radius" value={value.radius} min={0} max={80} unit="px" fallback={kind === "button" ? 8 : kind === "image" ? 16 : 20} onChange={radius => set({radius})} />}
      {kind !== "button" && <OptionalSlider label="Maximum width" value={value.maxWidth} min={80} max={1600} step={10} unit="px" fallback={kind === "image" ? 560 : 640} onChange={maxWidth => set({maxWidth})} />}
      <Slider label="Opacity" value={value.opacity} min={10} max={100} step={5} unit="%" onChange={opacity => set({opacity})} />
    </Group>
    {!widget && <Group title="Visibility" defaultOpen={false}>
      {(["desktop", "tablet", "mobile"] as const).map(device => <Toggle key={device} label={`Show on ${device}`} checked={value.devices[device]} onChange={checked => set({devices: {...value.devices, [device]: checked}})} />)}
      <p className="text-[11px] text-zinc-500">Hidden elements are faded in the editor and left out on that device for visitors.</p>
    </Group>}
  </div>;
}

export interface ElementText { value: string; max: number; multiline: boolean; onChange: (value: string) => void }

export function ElementPanel({label, sectionLabel, kind, style, offset, text, onStyle, onOffset, onReset, onBack}: {
  label: string; sectionLabel: string; kind: ElementKind; style: ElementStyle; offset: Offset; text: ElementText | null;
  onStyle: (style: ElementStyle) => void; onOffset: (offset: Offset) => void; onReset: () => void; onBack: () => void;
}) {
  const [tab, setTab] = useState<"style" | "position">("style");
  const [, setPasted] = useState(0);
  const Icon = KIND_ICONS[kind];
  const changed = JSON.stringify(style) !== JSON.stringify(DEFAULT_ELEMENT_STYLE);
  return <div>
    <div className="flex items-center gap-1.5 border-b border-white/10 bg-sky-500/10 px-3 py-2 text-xs">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-zinc-300 hover:bg-white/10 hover:text-white" aria-label={`Back to ${sectionLabel}`}><ArrowLeft className="size-3.5" aria-hidden="true" />{sectionLabel}</button>
      <span className="text-zinc-500">›</span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 font-semibold text-white"><Icon className="size-3.5 shrink-0 text-sky-300" aria-hidden="true" /><span className="truncate" data-testid="element-panel-title">{label}</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-300">{ELEMENT_KIND_LABELS[kind]}</span></span>
    </div>
    <div role="tablist" aria-label="Element settings" className="sticky top-0 z-10 grid grid-cols-2 border-b border-white/10 bg-zinc-900">
      {(["style", "position"] as const).map(option => <button key={option} type="button" role="tab" aria-selected={tab === option} onClick={() => setTab(option)}
        className={`border-b-2 py-3 text-xs font-semibold uppercase tracking-wider ${tab === option ? "border-sky-400 text-white" : "border-transparent text-zinc-400 hover:text-white"}`}>{option}</button>)}
    </div>
    {tab === "style" && <div role="tabpanel">
      {text && <div className="border-b border-white/10 p-4"><TextControl label="Text" value={text.value} max={text.max} multiline={text.multiline} onChange={text.onChange} hint="You can also type on the canvas." /></div>}
      <ElementStyleControls value={style} kind={kind} onChange={onStyle} />
    </div>}
    {tab === "position" && <div role="tabpanel" className="space-y-5 p-4">
      <OffsetControl label={`Move "${label}"`} value={offset} max={MAX_OFFSET} onChange={onOffset} hint="Alt + arrow keys nudge it on the canvas (add Shift for 20 px). Moving does not push other content." />
      <OptionalSlider label="Space above" value={style.spaceBefore} min={-MAX_BOX} max={MAX_BOX} step={2} unit="px" fallback={0} onChange={spaceBefore => onStyle({...style, spaceBefore})} hint="Unlike moving, spacing pushes the content below." />
      <OptionalSlider label="Space below" value={style.spaceAfter} min={-MAX_BOX} max={MAX_BOX} step={2} unit="px" fallback={0} onChange={spaceAfter => onStyle({...style, spaceAfter})} />
    </div>}
    <div className="flex flex-wrap gap-1.5 border-t border-white/10 p-4">
      <button type="button" onClick={() => { styleClipboard = style; setPasted(count => count + 1); }} className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-xs text-zinc-200 hover:border-sky-400"><Copy className="size-3.5" aria-hidden="true" />Copy style</button>
      <button type="button" disabled={!styleClipboard} onClick={() => styleClipboard && onStyle({...styleClipboard})} className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-xs text-zinc-200 hover:border-sky-400 disabled:opacity-40"><ClipboardPaste className="size-3.5" aria-hidden="true" />Paste style</button>
      {(changed || offset.x !== 0 || offset.y !== 0) && <button type="button" onClick={onReset} className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-white/10 hover:text-white"><RotateCcw className="size-3.5" aria-hidden="true" />Reset element</button>}
    </div>
  </div>;
}
