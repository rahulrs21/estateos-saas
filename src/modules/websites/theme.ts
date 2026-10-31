import type { CSSProperties } from "react";
import { BOX_SIDES, type Accent, type BoxSide, type DesignStyle, type Device, type DeviceBox, type ElementStyle, type FontFamily, type Offset, type PageTheme, type SectionStyle } from "./registry";
type ElementWeight = NonNullable<ElementStyle["weight"]>;

/**
 * Design tokens for the six page styles. Pages choose a style, an accent (or
 * a validated #rrggbb colour), fonts, a scale and a corner radius; the
 * renderer turns them into CSS custom properties. No page can supply its own
 * CSS, so there is nothing to inject. Accent colours meet WCAG AA (4.5:1)
 * for text and buttons on their style's background; for custom colours the
 * button text colour is chosen by contrast.
 */

interface StyleTokens { bg: string; fg: string; muted: string; mutedFg: string; card: string; border: string; dark: boolean; headingTracking: string; eyebrowCase: "uppercase" | "none" }

export const STYLE_TOKENS: Record<DesignStyle, StyleTokens> = {
  LUXURY_MINIMALIST: {bg: "#faf8f5", fg: "#1c1917", muted: "#f2eee8", mutedFg: "#5f5850", card: "#ffffff", border: "#e4ddd2", dark: false, headingTracking: "0.005em", eyebrowCase: "uppercase"},
  PREMIUM_DARK: {bg: "#0b0b0e", fg: "#f5f3ef", muted: "#141418", mutedFg: "#b3ada6", card: "#15151a", border: "#2b2b33", dark: true, headingTracking: "-0.01em", eyebrowCase: "uppercase"},
  MODERN_CORPORATE: {bg: "#ffffff", fg: "#0f172a", muted: "#f1f5f9", mutedFg: "#526074", card: "#ffffff", border: "#e2e8f0", dark: false, headingTracking: "-0.025em", eyebrowCase: "uppercase"},
  ELEGANT_LIGHT: {bg: "#fffdfb", fg: "#292524", muted: "#f8f1ee", mutedFg: "#6b625d", card: "#ffffff", border: "#ece0da", dark: false, headingTracking: "0", eyebrowCase: "uppercase"},
  CONTEMPORARY: {bg: "#ffffff", fg: "#111827", muted: "#f4f5f7", mutedFg: "#5b6472", card: "#ffffff", border: "#e5e7eb", dark: false, headingTracking: "-0.03em", eyebrowCase: "uppercase"},
  HIGH_CONVERSION: {bg: "#ffffff", fg: "#111111", muted: "#fff7ed", mutedFg: "#57534e", card: "#ffffff", border: "#fed7aa", dark: false, headingTracking: "-0.03em", eyebrowCase: "uppercase"},
};

/** [on light backgrounds, on dark backgrounds] */
export const ACCENT_COLORS: Record<Accent, {light: string; dark: string; label: string}> = {
  GOLD: {light: "#7d5f1e", dark: "#d9b56f", label: "Gold"},
  NAVY: {light: "#1e3a8a", dark: "#9db8ff", label: "Navy"},
  EMERALD: {light: "#046c4e", dark: "#4ade9f", label: "Emerald"},
  TEAL: {light: "#0f6b64", dark: "#3fd6c4", label: "Teal"},
  TERRACOTTA: {light: "#b03a0b", dark: "#fb9a5c", label: "Terracotta"},
  SLATE: {light: "#334155", dark: "#cbd5e1", label: "Slate"},
  ROSE: {light: "#b0123a", dark: "#fda4b6", label: "Rose"},
  INDIGO: {light: "#4338ca", dark: "#b0b8ff", label: "Indigo"},
};

/** Font stacks. The --font-pg-* variables come from next/font (fonts.ts) on the page wrapper; the fallbacks keep pages readable without them. */
export const FONT_STACKS: Record<FontFamily, string> = {
  PLAYFAIR: "var(--font-pg-playfair), 'Playfair Display', Georgia, serif",
  CORMORANT: "var(--font-pg-cormorant), 'Cormorant Garamond', Georgia, serif",
  DM_SERIF: "var(--font-pg-dm-serif), 'DM Serif Display', Georgia, serif",
  INTER: "var(--font-pg-inter), Inter, ui-sans-serif, system-ui, sans-serif",
  MANROPE: "var(--font-pg-manrope), Manrope, ui-sans-serif, system-ui, sans-serif",
  MONTSERRAT: "var(--font-pg-montserrat), Montserrat, ui-sans-serif, system-ui, sans-serif",
  POPPINS: "var(--font-pg-poppins), Poppins, ui-sans-serif, system-ui, sans-serif",
  SYSTEM: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
};
const LEGACY_FONTS: Record<PageTheme["font"], {heading: FontFamily; body: FontFamily}> = {
  SANS: {heading: "SYSTEM", body: "SYSTEM"}, SERIF: {heading: "PLAYFAIR", body: "SYSTEM"}, DISPLAY: {heading: "MONTSERRAT", body: "SYSTEM"},
};

const RADIUS: Record<PageTheme["radius"], string> = {NONE: "0px", SOFT: "0.5rem", ROUND: "1.25rem"};
const DARK_SECTION = {bg: "#0e0e12", fg: "#f5f5f4", muted: "#1a1a20", mutedFg: "#b5b0aa", card: "#17171d", border: "#2d2d35"};

type CssVars = CSSProperties & Record<`--${string}`, string>;

/** Relative luminance; used to pick readable text on custom colours. */
export function luminance(hex: string) {
  const channel = (value: number) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
export const readableOn = (hex: string) => luminance(hex) > 0.45 ? "#111111" : "#ffffff";

export function accentColor(theme: PageTheme) {
  if (theme.customAccent) return theme.customAccent;
  return STYLE_TOKENS[theme.style].dark ? ACCENT_COLORS[theme.accent].dark : ACCENT_COLORS[theme.accent].light;
}

export function pageThemeStyle(theme: PageTheme): CssVars {
  const tokens = STYLE_TOKENS[theme.style];
  const accent = accentColor(theme);
  const legacy = LEGACY_FONTS[theme.font];
  const heading = FONT_STACKS[theme.headingFont ?? legacy.heading];
  const body = FONT_STACKS[theme.bodyFont ?? legacy.body];
  return {
    "--pg-bg": tokens.bg, "--pg-fg": tokens.fg, "--pg-muted": tokens.muted, "--pg-muted-fg": tokens.mutedFg, "--pg-card": tokens.card, "--pg-border": tokens.border,
    "--pg-accent": accent, "--pg-accent-fg": readableOn(accent),
    "--pg-heading-font": heading, "--pg-body-font": body, "--pg-heading-tracking": tokens.headingTracking, "--pg-radius": RADIUS[theme.radius],
    "--pg-eyebrow-case": tokens.eyebrowCase,
    "--pg-button-radius": theme.buttonShape === "PILL" ? "9999px" : theme.buttonShape === "SQUARE" ? "0px" : "calc(var(--pg-radius) * 0.7)",
    backgroundColor: tokens.bg, color: tokens.fg, fontFamily: body,
  };
}

/**
 * A panel on top of a section (the hero's enquiry form) keeps the theme's own
 * colours, so it stays readable when the section has a photo, video or dark background.
 */
export function panelStyle(theme: PageTheme): CssVars {
  const tokens = STYLE_TOKENS[theme.style];
  return {"--pg-bg": tokens.bg, "--pg-fg": tokens.fg, "--pg-muted": tokens.muted, "--pg-muted-fg": tokens.mutedFg, "--pg-card": tokens.card, "--pg-border": tokens.border, backgroundColor: tokens.bg, color: tokens.fg};
}

const LIGHT_TEXT = {"--pg-fg": "#ffffff", "--pg-muted-fg": "#e7e5e4", "--pg-card": "#ffffff14", "--pg-border": "#ffffff33"} as const;
const DARK_TEXT = {"--pg-fg": "#111111", "--pg-muted-fg": "#44403c", "--pg-card": "#ffffffcc", "--pg-border": "#00000022"} as const;

/** Variable overrides for a section background; content inside keeps using the --pg-* tokens. */
export function sectionBackgroundStyle(background: "DEFAULT" | "MUTED" | "ACCENT" | "DARK", theme: PageTheme, style?: SectionStyle): CssVars | undefined {
  const tokens = STYLE_TOKENS[theme.style];
  let vars: CssVars | undefined;
  if (background === "MUTED") vars = {backgroundColor: tokens.muted, "--pg-card": tokens.dark ? "#1d1d23" : "#ffffff"};
  else if (background === "ACCENT") {
    const accent = accentColor(theme);
    const foreground = readableOn(accent);
    vars = {backgroundColor: accent, color: foreground, "--pg-fg": foreground, "--pg-muted-fg": foreground, "--pg-accent": foreground, "--pg-accent-fg": accent,
      "--pg-card": foreground === "#ffffff" ? "#ffffff1f" : "#00000014", "--pg-border": foreground === "#ffffff" ? "#ffffff4d" : "#0000002e"};
  } else if (background === "DARK" && !tokens.dark) {
    vars = {backgroundColor: DARK_SECTION.bg, color: DARK_SECTION.fg, "--pg-fg": DARK_SECTION.fg, "--pg-muted": DARK_SECTION.muted, "--pg-muted-fg": DARK_SECTION.mutedFg,
      "--pg-card": DARK_SECTION.card, "--pg-border": DARK_SECTION.border, "--pg-accent": theme.customAccent ?? ACCENT_COLORS[theme.accent].dark, "--pg-accent-fg": "#0d0d10"};
  } else if (background === "DARK") vars = {backgroundColor: "#050507"};
  if (!style) return vars;
  // Style tab: a custom colour background, media backgrounds and text tone.
  if (style.backgroundType === "COLOR" && style.backgroundColor) {
    const text = readableOn(style.backgroundColor);
    vars = {...vars, backgroundColor: style.backgroundColor, color: text, ...(text === "#ffffff" ? LIGHT_TEXT : DARK_TEXT)};
  }
  const media = style.backgroundType === "IMAGE" || style.backgroundType === "VIDEO";
  const tone = style.textTone === "AUTO" ? (media ? (style.overlayTone === "LIGHT" ? "DARK" : "LIGHT") : null) : style.textTone;
  if (tone === "LIGHT") vars = {...vars, color: "#ffffff", ...LIGHT_TEXT};
  if (tone === "DARK") vars = {...vars, color: "#111111", ...DARK_TEXT};
  if (style.textColor) vars = {...vars, color: style.textColor, "--pg-fg": style.textColor};
  return vars;
}

export function overlayStyle(style: SectionStyle, theme: PageTheme): CSSProperties {
  const color = style.overlayTone === "LIGHT" ? "255,255,255" : style.overlayTone === "ACCENT" ? hexToRgb(accentColor(theme)) : "0,0,0";
  const alpha = style.overlay / 100;
  return {background: `linear-gradient(180deg, rgba(${color},${Math.min(alpha + 0.15, 0.95)}) 0%, rgba(${color},${alpha}) 45%, rgba(${color},${Math.min(alpha + 0.2, 0.95)}) 100%)`};
}
const hexToRgb = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)).join(",");

/** Spacing per device with container queries: mobile < 48rem, tablet 48–64rem, desktop ≥ 64rem. Literal classes so Tailwind generates them. */
const SPACE = {
  NONE: {base: "py-0", tablet: "@3xl:py-0", desktop: "@5xl:py-0"},
  COMPACT: {base: "py-8", tablet: "@3xl:py-10", desktop: "@5xl:py-12"},
  NORMAL: {base: "py-14", tablet: "@3xl:py-20", desktop: "@5xl:py-24"},
  SPACIOUS: {base: "py-20", tablet: "@3xl:py-28", desktop: "@5xl:py-36"},
} as const;
export function spacingClasses(desktop: keyof typeof SPACE, tablet: string, mobile: string) {
  const tab = (tablet === "INHERIT" ? desktop : tablet) as keyof typeof SPACE;
  const mob = (mobile === "INHERIT" ? tab : mobile) as keyof typeof SPACE;
  return `${SPACE[mob].base} ${SPACE[tab].tablet} ${SPACE[desktop].desktop}`;
}
/** Preset vertical padding in px: [mobile, tablet, desktop], matching SPACE. */
const SPACE_PX = {NONE: [0, 0, 0], COMPACT: [32, 40, 48], NORMAL: [56, 80, 96], SPACIOUS: [80, 112, 144]} as const;
const DEVICE_ORDER = ["desktop", "tablet", "mobile"] as const;
const DEVICE_SUFFIX = {desktop: "d", tablet: "t", mobile: "m"} as const;
const SIDE_LETTER = {top: "t", right: "r", bottom: "b", left: "l"} as const;
// Literal class lists so Tailwind generates them; the values come from CSS variables set inline.
const PADDING_VAR_CLASSES = "pt-[var(--pg-pt-m)] pr-[var(--pg-pr-m)] pb-[var(--pg-pb-m)] pl-[var(--pg-pl-m)] @3xl:pt-[var(--pg-pt-t)] @3xl:pr-[var(--pg-pr-t)] @3xl:pb-[var(--pg-pb-t)] @3xl:pl-[var(--pg-pl-t)] @5xl:pt-[var(--pg-pt-d)] @5xl:pr-[var(--pg-pr-d)] @5xl:pb-[var(--pg-pb-d)] @5xl:pl-[var(--pg-pl-d)]";
const MARGIN_VAR_CLASSES = "mt-[var(--pg-mt-m)] mr-[var(--pg-mr-m)] mb-[var(--pg-mb-m)] ml-[var(--pg-ml-m)] @3xl:mt-[var(--pg-mt-t)] @3xl:mr-[var(--pg-mr-t)] @3xl:mb-[var(--pg-mb-t)] @3xl:ml-[var(--pg-ml-t)] @5xl:mt-[var(--pg-mt-d)] @5xl:mr-[var(--pg-mr-d)] @5xl:mb-[var(--pg-mb-d)] @5xl:ml-[var(--pg-ml-d)]";

/** A side's value on a device: tablet inherits desktop, mobile inherits tablet (as in Elementor). */
export function boxValue(box: DeviceBox | null, device: Device, side: BoxSide): number | null {
  if (!box) return null;
  for (const name of DEVICE_ORDER.slice(0, DEVICE_ORDER.indexOf(device) + 1).reverse()) {
    const value = box[name]?.[side];
    if (value != null) return value;
  }
  return null;
}

/**
 * Custom padding and margin as CSS variables. Without custom padding the
 * spacing preset classes apply unchanged; with it, unset top and bottom
 * sides keep the preset's value for that device.
 */
export function presetPaddingPx(style: SectionStyle, desktopSpacing: keyof typeof SPACE): Record<Device, number> {
  const tablet = (style.spacingTablet === "INHERIT" ? desktopSpacing : style.spacingTablet) as keyof typeof SPACE;
  const mobile = (style.spacingMobile === "INHERIT" ? tablet : style.spacingMobile) as keyof typeof SPACE;
  return {desktop: SPACE_PX[desktopSpacing][2], tablet: SPACE_PX[tablet][1], mobile: SPACE_PX[mobile][0]};
}

export function boxLayout(style: SectionStyle, desktopSpacing: keyof typeof SPACE): {padding: boolean; className: string; vars: CssVars} {
  const preset = presetPaddingPx(style, desktopSpacing);
  const vars: Record<string, string> = {};
  const classes: string[] = [];
  if (style.padding) {
    classes.push(PADDING_VAR_CLASSES);
    for (const device of DEVICE_ORDER) for (const side of BOX_SIDES) {
      const value = boxValue(style.padding, device, side) ?? (side === "top" || side === "bottom" ? preset[device] : 0);
      vars[`--pg-p${SIDE_LETTER[side]}-${DEVICE_SUFFIX[device]}`] = `${value}px`;
    }
  }
  if (style.margin) {
    classes.push(MARGIN_VAR_CLASSES);
    for (const device of DEVICE_ORDER) for (const side of BOX_SIDES) vars[`--pg-m${SIDE_LETTER[side]}-${DEVICE_SUFFIX[device]}`] = `${boxValue(style.margin, device, side) ?? 0}px`;
  }
  return {padding: Boolean(style.padding), className: classes.join(" "), vars: vars as CssVars};
}

/** Nudges an element without changing the layout around it. */
export function offsetStyle(offset: Offset | undefined): CSSProperties | undefined {
  return offset && (offset.x || offset.y) ? {position: "relative", left: offset.x, top: offset.y} : undefined;
}

/** What an element is, which decides how alignment and spacing apply to it. */
export type ElementKind = "text" | "block" | "button" | "image" | "card";
const WEIGHTS: Record<ElementWeight, number> = {LIGHT: 300, REGULAR: 400, MEDIUM: 500, SEMIBOLD: 600, BOLD: 700};
const CASES = {NONE: "none", UPPERCASE: "uppercase", LOWERCASE: "lowercase", CAPITALIZE: "capitalize"} as const;
const JUSTIFY = {LEFT: "flex-start", CENTER: "center", RIGHT: "flex-end"} as const;
/** Font size on phones when none is set: large type is reduced, small type is kept. */
export const mobileSize = (size: number) => size >= 28 ? Math.max(24, Math.round(size * 0.72)) : size;
/** Classes that switch the font size at the tablet breakpoint (values come from the custom properties). */
const SIZE_CLASSES = "text-[length:var(--pg-el-fs-m)] @3xl:text-[length:var(--pg-el-fs)]";
/** Hidden per device on public pages; faded in the editor so the element can still be selected. */
function elementDeviceClasses(devices: ElementStyle["devices"], editor: boolean) {
  // Literal class names, so Tailwind generates them.
  const classes = editor
    ? [devices.mobile ? "" : "@max-3xl:opacity-30", devices.tablet ? "" : "@3xl:@max-5xl:opacity-30", devices.desktop ? "" : "@5xl:opacity-30"]
    : [devices.mobile ? "" : "@max-3xl:hidden", devices.tablet ? "" : "@3xl:@max-5xl:hidden", devices.desktop ? "" : "@5xl:hidden"];
  return classes.filter(Boolean).join(" ");
}

/** Inline properties and classes for an element; `sizeClass` goes on the element whose font size changes. */
export interface ElementLook { style: CSSProperties; className: string; sizeClass: string }

/**
 * Turns a validated element style into fixed inline properties and classes.
 * Every value is an enum or a bounded number, so no page text reaches CSS.
 */
export function elementCss(style: ElementStyle | undefined, kind: ElementKind, editor = false): ElementLook {
  if (!style) return {style: {}, className: "", sizeClass: ""};
  const css: CSSProperties & Record<`--${string}`, string> = {};
  const classes: string[] = [];
  if (style.color) css.color = style.color;
  if (style.background) {
    css.backgroundColor = style.background;
    if (kind === "text") Object.assign(css, {padding: "0.1em 0.35em", borderRadius: "0.2em", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone"});
  }
  if (kind === "card") {
    // A panel (a form) sets its own colour tokens, so fields, borders and the button follow its background.
    const foreground = style.color ?? (style.background ? readableOn(style.background) : null);
    if (style.background) Object.assign(css, {"--pg-bg": style.background, "--pg-card": style.background});
    if (foreground) Object.assign(css, {color: foreground, "--pg-fg": foreground, "--pg-muted-fg": `${foreground}b3`, "--pg-border": `${foreground}33`});
    if (style.accent) Object.assign(css, {"--pg-accent": style.accent, "--pg-accent-fg": readableOn(style.accent)});
    if (style.radius !== null) css["--pg-radius"] = `${style.radius}px`;
  }
  if (style.font) css.fontFamily = `var(--pg-${style.font === "HEADING" ? "heading" : "body"}-font)`;
  if (style.size) {
    css["--pg-el-fs"] = `${style.size}px`;
    css["--pg-el-fs-m"] = `${style.sizeMobile ?? mobileSize(style.size)}px`;
  }
  if (style.weight) css.fontWeight = WEIGHTS[style.weight];
  if (style.italic) css.fontStyle = "italic";
  if (style.textCase) css.textTransform = CASES[style.textCase];
  if (style.letterSpacing !== null) css.letterSpacing = `${style.letterSpacing / 100}em`;
  if (style.lineHeight !== null) css.lineHeight = style.lineHeight / 100;
  if (style.opacity < 100) css.opacity = style.opacity / 100;
  if (style.radius !== null && kind !== "text") css.borderRadius = style.radius;
  if (style.maxWidth !== null) css.maxWidth = style.maxWidth;
  if (style.spaceBefore !== null) css.marginTop = style.spaceBefore;
  if (style.spaceAfter !== null) css.marginBottom = style.spaceAfter;
  if (style.align) {
    if (kind === "block") { css.justifyContent = JUSTIFY[style.align]; css.textAlign = style.align.toLowerCase() as "left"; }
    else if (kind === "text") css.textAlign = style.align.toLowerCase() as "left";
    if (kind !== "button") {
      if (style.align === "CENTER") { css.marginLeft = "auto"; css.marginRight = "auto"; }
      else if (style.align === "RIGHT") css.marginLeft = "auto";
      else css.marginRight = "auto";
    }
  }
  // Inline text needs a box for alignment, width and vertical space to apply.
  if (kind === "text" && (style.align || style.maxWidth !== null || style.spaceBefore !== null || style.spaceAfter !== null)) css.display = "block";
  const devices = elementDeviceClasses(style.devices, editor);
  if (devices) classes.push(devices);
  return {style: css, className: classes.join(" "), sizeClass: style.size ? SIZE_CLASSES : ""};
}

export const CONTENT_VERTICAL_CLASSES = {AUTO:"", TOP: "flex flex-col justify-start", CENTER: "flex flex-col justify-center", BOTTOM: "flex flex-col justify-end"} as const;

/** Kept for callers that only know the desktop spacing. */
export const SPACING_CLASSES = {NONE: spacingClasses("NONE", "INHERIT", "INHERIT"), COMPACT: spacingClasses("COMPACT", "INHERIT", "INHERIT"), NORMAL: spacingClasses("NORMAL", "INHERIT", "INHERIT"), SPACIOUS: spacingClasses("SPACIOUS", "INHERIT", "INHERIT")} as const;

export const HEIGHT_CLASSES = {AUTO: "", MEDIUM: "min-h-[60vh] flex flex-col justify-center", TALL: "min-h-[80vh] flex flex-col justify-center", SCREEN: "min-h-[100svh] flex flex-col justify-center"} as const;
export const WIDTH_CLASSES = {BOXED: "mx-auto w-full max-w-6xl px-5 @3xl:px-8", WIDE: "mx-auto w-full max-w-[90rem] px-5 @3xl:px-10", FULL: "w-full px-5 @3xl:px-12 @7xl:px-20"} as const;
export const ANIMATION_CLASSES = {NONE: "", FADE_UP: "pg-anim pg-anim-fade-up", FADE: "pg-anim pg-anim-fade", ZOOM: "pg-anim pg-anim-zoom", SLIDE_LEFT: "pg-anim pg-anim-slide"} as const;
export const HEADLINE_CLASSES = {COMPACT: "text-4xl @3xl:text-5xl", COMFORTABLE: "text-4xl @3xl:text-6xl", LARGE: "text-5xl @3xl:text-7xl"} as const;
export const HEADING_CLASSES = {COMPACT: "text-2xl @3xl:text-3xl", COMFORTABLE: "text-3xl @3xl:text-4xl", LARGE: "text-3xl @3xl:text-5xl"} as const;

/**
 * Device visibility with container queries, so the editor's mobile, tablet
 * and desktop previews behave like real screens.
 */
export function deviceClasses(devices: {desktop: boolean; tablet: boolean; mobile: boolean}) {
  if (devices.desktop && devices.tablet && devices.mobile) return "";
  return [devices.mobile ? "block" : "hidden", devices.tablet ? "@3xl:block" : "@3xl:hidden", devices.desktop ? "@5xl:block" : "@5xl:hidden"].join(" ");
}
