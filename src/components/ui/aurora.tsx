import {
  BackgroundCanvas,
  type BackgroundCanvasProps,
} from "@/components/ui/background-canvas";

/*
 * Aurora background (shadcn.io "Aurora Background for React"), from the
 * component markdown supplied by the product owner. It runs on the local
 * BackgroundCanvas host (components/ui/background-canvas.tsx).
 */

export interface AuroraProps
  extends Omit<
    BackgroundCanvasProps,
    | "atlas"
    | "colors"
    | "palettes"
    | "scene"
    | "simulation"
    | "still"
    | "uniforms"
  > {
  /**
   * How far the lower edge of the curtains waves up and down.
   *
   * @default 1
   */
  amplitude?: number;
  /**
   * Two to eight CSS colors, from the lower edge of the curtains to their
   * tips. Theme variables such as `var(--primary)` follow your theme.
   *
   * @default ["#22e584", "#19d3c5", "#4f7dff", "#a05cff"]
   */
  colors?: string[];
  /**
   * Where the lower edge sits, from 0 (the bottom of the box) to 1 (the top).
   *
   * @default 0.42
   */
  height?: number;
  /**
   * How bright the light is.
   *
   * @default 1
   */
  intensity?: number;
  /**
   * How many curtains hang one behind the other, from 1 to 3.
   *
   * @default 2
   */
  layers?: number;
  /**
   * Which side the light fills: `top` hangs it from above, `bottom` raises
   * it from below.
   *
   * @default "top"
   */
  placement?: "top" | "bottom";
  /**
   * How strongly the fine vertical rays show in the curtains, from 0 to 1.
   *
   * @default 0.7
   */
  rays?: number;
  /**
   * How far the light reaches past the lower edge, as a share of the box.
   *
   * @default 0.5
   */
  reach?: number;
  /**
   * The size of the folds: higher packs more of them across the box.
   *
   * @default 1
   */
  scale?: number;
}

/** Emerald at the lower edge, through teal and blue, to violet tips. */
const COLORS = ["#22e584", "#19d3c5", "#4f7dff", "#a05cff"];

// data
const SCENE = /* glsl */ `
uniform vec3 uColors[8];
uniform int uColorsCount;
uniform float uAmplitude;
uniform float uFlip;
uniform float uHeight;
uniform float uIntensity;
uniform float uLayers;
uniform float uRays;
uniform float uReach;
uniform float uScale;

// One curtain: its lower edge waves across the box, and light hangs above it.
vec4 curtain(vec2 uv, float aspect, float i) {
  float t = uTime * 0.06;
  float x = (uv.x - 0.5) * aspect * uScale + i * 3.7;
  // The fold: where the lower edge sits, and how the curtain bunches.
  float fold = snoise(vec2(x * 0.55 + t * (0.6 + i * 0.25), t * 0.9 + i * 7.1));
  float fine = snoise(vec2(x * 1.7 - t * 0.8, t * 1.3 + i * 3.3));
  float edge = uHeight + (fold * 0.16 + fine * 0.05) * uAmplitude - i * 0.05;
  float h = uv.y - edge;
  // Rays: thin across, long upward, sheared by the fold so they gather in the bends.
  float rx = x * 7.0 + fold * 3.5;
  float streak = snoise(vec2(rx, uv.y * 0.35 - t * 1.6 + i)) * 0.6 + snoise(vec2(rx * 2.9, uv.y * 0.8 + t * 2.2)) * 0.4;
  float rays = mix(1.0, 0.35 + 1.25 * smoothstep(-0.55, 0.75, streak), uRays);
  // The curtain is brighter in places along its length.
  float lit = smoothstep(-0.7, 0.6, snoise(vec2(x * 0.35 - t * 0.5, i * 5.0 + t * 0.4)));
  float reach = max(uReach, 0.02) * (0.75 + 0.5 * lit);
  float body = smoothstep(-0.02, 0.05, h) * exp(-max(h, 0.0) / reach * 2.6);
  // A brighter hem right at the lower edge.
  float hem = exp(-abs(h - 0.02) * 55.0) * 0.35;
  float amount = (body + hem) * rays * (0.35 + 0.65 * lit);
  vec3 color = ramp(uColors, uColorsCount, clamp(h / reach * 0.9 + fine * 0.08, 0.0, 1.0));
  return vec4(color, amount);
}

vec4 scene(vec2 frag) {
  vec2 uv = uvOf(frag);
  vec2 lean = (uPointer.xy / uResolution - 0.5) * uPointer.z;
  if (uFlip > 0.5) { uv.y = 1.0 - uv.y; lean.y = -lean.y; }
  // The curtains lean toward the pointer, more at their tips.
  uv.x -= lean.x * 0.06 * max(uv.y - uHeight + 0.2, 0.0);
  uv.y -= lean.y * 0.03;
  float aspect = uResolution.x / uResolution.y;
  vec4 sum = vec4(0);
  for (int i = 0; i < 3; i++) {
    if (float(i) >= uLayers) break;
    vec4 c = curtain(uv, aspect, float(i));
    float w = i == 0 ? 1.0 : 0.6 / float(i);
    sum += vec4(c.rgb * c.a * w, c.a * w);
  }
  vec3 color = sum.a > 0.0 ? sum.rgb / sum.a : vec3(0);
  // The light rises from the edge as it first shows.
  float rise = smoothstep(0.0, 1.0, uIntro * 1.4 - (uv.y - uHeight) * 0.6);
  float amount = (1.0 - exp(-sum.a * 1.6)) * uIntensity * rise;
  return glow(color, amount * mix(0.85, 1.2, uDark));
}
`;

/**
 * Curtains of light that hang across the box like the northern lights,
 * behind whatever you put inside it. Each curtain's lower edge waves on
 * slow noise, fine rays gather in its bends, and the color runs from the
 * edge to the tips through `colors`, mixed in OKLab. It glows on a dark
 * surface and tints a light one, leans toward the pointer, runs only while
 * it's on screen and holds a still frame with reduced motion.
 */
export const Aurora = (props: AuroraProps) => {
  const {
    amplitude = 1,
    colors = COLORS,
    height = 0.42,
    intensity = 1,
    layers = 2,
    placement = "top",
    rays = 0.7,
    reach = 0.5,
    scale = 1,
    ...rest
  } = props;
  return (
    <BackgroundCanvas
      data-slot="aurora"
      palettes={{ uColors: colors }}
      scene={SCENE}
      still={12}
      uniforms={{
        uAmplitude: amplitude,
        uFlip: placement === "bottom",
        uHeight: height,
        uIntensity: intensity,
        uLayers: layers,
        uRays: rays,
        uReach: reach,
        uScale: scale,
      }}
      {...rest}
    />
  );
};
