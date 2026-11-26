"use client";

import { useEffect, useRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * BackgroundCanvas: a small WebGL2 host for GLSL background scenes such as
 * <Aurora> (components/ui/aurora.tsx). Written for EstateOS to the interface
 * those scenes expect, because the upstream registry file needs an account.
 *
 * A scene is GLSL that defines `vec4 scene(vec2 frag)` and returns
 * premultiplied colour. This host prepends a prelude with:
 *   uTime, uResolution, uPointer (xy in pixels from the bottom left, z = how
 *   present the pointer is, 0..1), uIntro (0 → 1 as the scene first shows),
 *   uDark (1 on a dark surface), snoise(vec2), uvOf(frag),
 *   ramp(colors, count, t) (OKLab palette → sRGB) and glow(color, amount).
 *
 * It draws only while on screen and the tab is visible, caps the pixel ratio
 * at 2, and with reduced motion draws one still frame (`still` seconds in)
 * and ignores the pointer. The canvas is decoration: hidden from assistive
 * tech and never takes clicks.
 */

type UniformValue = number | boolean;

export interface BackgroundCanvasProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children?: ReactNode;
  /** GLSL defining `vec4 scene(vec2 frag)`. */
  scene: string;
  /** Float uniforms (booleans become 0 or 1). */
  uniforms?: Record<string, UniformValue>;
  /** Colour palettes: each name becomes `vec3 name[8]` (OKLab) plus `int nameCount`. CSS colours, theme variables included. */
  palettes?: Record<string, string[]>;
  /** The moment, in seconds, drawn when motion is reduced. */
  still?: number;
  /** A fixed moment in seconds: draws it and doesn't animate. */
  time?: number;
  /** Animation speed: 1 is normal, 0 holds the frame. */
  speed?: number;
  /** Holds the current frame. */
  paused?: boolean;
  /** How strongly the scene shows over the surface, 0 to 1. */
  opacity?: number;
  /** Render scale, 0.25 to 1. */
  quality?: number;
  /** Whether the scene follows the pointer (mouse and pen only). */
  interactive?: boolean;
  /** Film grain, 0 to 1. */
  grain?: number;
  /** Which edges fade out to the surface. */
  fade?: "none" | "radial" | "top" | "bottom" | "left" | "right";
  /** CSS background shown until the first frame and without WebGL2. */
  fallback?: string;
  /** Not used by this host; accepted for compatibility with upstream scenes. */
  atlas?: never; colors?: never; simulation?: never;
}

const PRELUDE = /* glsl */ `#version 300 es
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uPointer;
uniform float uIntro;
uniform float uDark;
uniform float uGrain;
uniform float uOpacity;
out vec4 outColor;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
// 2D simplex noise (Ashima Arts, MIT licence), in -1..1.
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

vec2 uvOf(vec2 frag) { return frag / uResolution; }

vec3 oklabToSrgb(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  vec3 lin = vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
  lin = clamp(lin, 0.0, 1.0);
  return mix(lin * 12.92, 1.055 * pow(lin, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, lin));
}

// Palette colours arrive in OKLab; t runs 0..1 across them.
vec3 ramp(vec3 colors[8], int count, float t) {
  if (count <= 1) return oklabToSrgb(colors[0]);
  float x = clamp(t, 0.0, 1.0) * float(count - 1);
  int i = int(floor(x));
  int j = min(i + 1, count - 1);
  return oklabToSrgb(mix(colors[i], colors[j], fract(x)));
}

// Premultiplied colour: on a dark surface it adds light, on a light one it tints.
vec4 glow(vec3 color, float amount) {
  float a = clamp(amount, 0.0, 1.0);
  return vec4(color * a, a);
}
`;

const MAIN = /* glsl */ `
float grainHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec4 c = scene(gl_FragCoord.xy);
  if (uGrain > 0.0) {
    float n = grainHash(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5;
    c.rgb = clamp(c.rgb + n * uGrain * 0.12 * c.a, 0.0, 1.0);
  }
  outColor = c * uOpacity;
}
`;

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

const FADES: Record<NonNullable<BackgroundCanvasProps["fade"]>, string | undefined> = {
  none: undefined,
  radial: "radial-gradient(ellipse at center, #000 35%, transparent 80%)",
  top: "linear-gradient(to bottom, transparent, #000 40%)",
  bottom: "linear-gradient(to top, transparent, #000 40%)",
  left: "linear-gradient(to right, transparent, #000 40%)",
  right: "linear-gradient(to left, transparent, #000 40%)",
};

/** A CSS colour (hex, rgb, oklch, a theme variable…) as sRGB 0..1, resolved inside `host` so variables follow the theme. */
function resolveColor(value: string, host: HTMLElement, scratch: CanvasRenderingContext2D): [number, number, number] {
  const probe = document.createElement("span");
  probe.style.color = value;
  probe.style.display = "none";
  host.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  scratch.clearRect(0, 0, 1, 1);
  scratch.fillStyle = "#000";
  scratch.fillStyle = computed;
  scratch.fillRect(0, 0, 1, 1);
  const [r, g, b] = scratch.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

function srgbToOklab([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (c: number) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Whether the first opaque background behind `element` is dark. */
function surfaceIsDark(element: HTMLElement, scratch: CanvasRenderingContext2D) {
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor;
    if (!color || color === "transparent" || /rgba\([^)]*,\s*0\)$/.test(color)) continue;
    const [r, g, b] = resolveColor(color, node, scratch);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.4;
  }
  return document.documentElement.classList.contains("dark");
}

export function BackgroundCanvas(props: BackgroundCanvasProps) {
  const {
    children, className, style, scene, uniforms = {}, palettes = {}, still = 0, time, speed = 1, paused = false,
    opacity = 1, quality = 1, interactive = true, grain = 0, fade = "none", fallback,
    atlas: _atlas, colors: _colors, simulation: _simulation, ...rest
  } = props;
  void _atlas; void _colors; void _simulation;
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Live settings read by the frame loop without restarting WebGL.
  const live = useRef({uniforms, palettes, still, time, speed, paused, opacity, quality, interactive, grain});
  useEffect(() => { live.current = {uniforms, palettes, still, time, speed, paused, opacity, quality, interactive, grain}; });
  const paletteKey = JSON.stringify(palettes);

  useEffect(() => {
    const host = hostRef.current, canvas = canvasRef.current;
    if (!host || !canvas) return;
    const gl = canvas.getContext("webgl2", {premultipliedAlpha: true, alpha: true, antialias: false});
    if (!gl) return; // No WebGL2: the host keeps its background or `fallback`.
    const scratch = document.createElement("canvas").getContext("2d", {willReadFrequently: true});
    if (!scratch) return;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn("BackgroundCanvas shader:", gl.getShaderInfoLog(shader));
        return null;
      }
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, VERTEX), fs = compile(gl.FRAGMENT_SHADER, PRELUDE + scene + MAIN);
    if (!vs || !fs) return;
    const program = gl.createProgram()!;
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { console.warn("BackgroundCanvas link:", gl.getProgramInfoLog(program)); return; }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const at = (name: string) => gl.getUniformLocation(program, name);

    // Palettes and the surface tone are resolved from CSS, and again when the theme changes.
    let dark = 0;
    const applyColors = () => {
      for (const [name, list] of Object.entries(live.current.palettes)) {
        const lab = list.slice(0, 8).flatMap(value => srgbToOklab(resolveColor(value, host, scratch)));
        while (lab.length < 24) lab.push(0, 0, 0);
        gl.uniform3fv(at(`${name}[0]`), new Float32Array(lab));
        gl.uniform1i(at(`${name}Count`), Math.min(list.length, 8));
      }
      dark = surfaceIsDark(host, scratch) ? 1 : 0;
    };
    applyColors();
    const themeWatch = new MutationObserver(() => { applyColors(); requestDraw(); });
    themeWatch.observe(document.documentElement, {attributes: true, attributeFilter: ["class", "style", "data-theme"]});

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2) * Math.min(Math.max(live.current.quality, 0.25), 1);
      const width = Math.max(1, Math.round(host.clientWidth * ratio)), height = Math.max(1, Math.round(host.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      gl.viewport(0, 0, width, height);
    };
    const resizeWatch = new ResizeObserver(() => { resize(); requestDraw(); });
    resizeWatch.observe(host);
    resize();

    // Pointer: mouse and pen only, eased in and out as it enters and leaves.
    const pointer = {x: 0, y: 0, inside: false, presence: 0};
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const rect = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) / rect.width * canvas.width;
      pointer.y = (1 - (event.clientY - rect.top) / rect.height) * canvas.height;
      pointer.inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    };
    window.addEventListener("pointermove", onPointer, {passive: true});

    let visible = true, frame = 0, clock = 0, last = 0, started = 0, shown = false;
    const draw = (now: number) => {
      const settings = live.current;
      const still = reducedMotion.matches || settings.time !== undefined;
      if (!started) started = now;
      const delta = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      if (!still && !settings.paused) clock += delta * settings.speed;
      const t = settings.time ?? (reducedMotion.matches ? settings.still : clock);
      pointer.presence += ((settings.interactive && !reducedMotion.matches && pointer.inside ? 1 : 0) - pointer.presence) * Math.min(delta * 3, 1);
      gl.uniform1f(at("uTime"), t);
      gl.uniform2f(at("uResolution"), canvas.width, canvas.height);
      gl.uniform3f(at("uPointer"), pointer.x, pointer.y, pointer.presence);
      gl.uniform1f(at("uIntro"), reducedMotion.matches ? 1 : Math.min((now - started) / 1600, 1));
      gl.uniform1f(at("uDark"), dark);
      gl.uniform1f(at("uGrain"), Math.min(Math.max(settings.grain, 0), 1));
      gl.uniform1f(at("uOpacity"), Math.min(Math.max(settings.opacity, 0), 1));
      for (const [name, value] of Object.entries(settings.uniforms)) gl.uniform1f(at(name), typeof value === "boolean" ? (value ? 1 : 0) : value);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!shown) { shown = true; canvas.style.opacity = "1"; }
      const intro = now - started < 1700;
      if (visible && !document.hidden && (!still || intro) && (!settings.paused || pointer.presence > 0.01)) frame = requestAnimationFrame(draw);
      else frame = 0;
    };
    function requestDraw() { if (!frame) { last = 0; frame = requestAnimationFrame(draw); } }
    const onVisibility = () => { if (!document.hidden) requestDraw(); };
    document.addEventListener("visibilitychange", onVisibility);
    const viewWatch = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); if (visible) requestDraw(); });
    viewWatch.observe(host);
    reducedMotion.addEventListener("change", requestDraw);
    requestDraw();

    return () => {
      cancelAnimationFrame(frame);
      themeWatch.disconnect(); resizeWatch.disconnect(); viewWatch.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      reducedMotion.removeEventListener("change", requestDraw);
      gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs); gl.deleteBuffer(buffer);
    };
    // The program depends on the scene and palette list; other settings are read live.
  }, [scene, paletteKey]);

  const mask = FADES[fade];
  return <div ref={hostRef} className={cn("relative isolate overflow-hidden bg-background", className)}
    style={{...(fallback ? {background: fallback} : {}), ...style} as CSSProperties} {...rest}>
    <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 size-full opacity-0 transition-opacity duration-700"
      style={mask ? {maskImage: mask, WebkitMaskImage: mask} : undefined} />
    {children}
  </div>;
}
