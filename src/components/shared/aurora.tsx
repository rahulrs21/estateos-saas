import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Animated aurora light for decorative backgrounds: four colours as slow,
 * blurred curtains (the `aurora-curtains` utility in globals.css), faded out
 * toward the bottom so content stays readable. CSS only (no WebGL, no
 * dependency); still under reduced motion. Place it inside a positioned,
 * overflow-hidden parent.
 */
export function Aurora({colors = ["#34d399", "#2dd4bf", "#60a5fa", "#a7f3d0"], className, opacity = 0.5}: {
  colors?: [string, string, string, string]; className?: string; opacity?: number;
}) {
  const style = {
    "--aurora-1": colors[0], "--aurora-2": colors[1], "--aurora-3": colors[2], "--aurora-4": colors[3],
    opacity,
    maskImage: "radial-gradient(ellipse 110% 90% at 20% 0%, #000 25%, transparent 80%)",
    WebkitMaskImage: "radial-gradient(ellipse 110% 90% at 20% 0%, #000 25%, transparent 80%)",
  } as CSSProperties;
  return <div aria-hidden="true" data-slot="aurora" className={cn("pointer-events-none absolute -inset-[10px] aurora-curtains", className)} style={style} />;
}
