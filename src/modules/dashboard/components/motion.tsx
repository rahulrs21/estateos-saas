"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { MotionConfig, animate, motion, useReducedMotion } from "motion/react";

/*
 * Dashboard motion: one short entrance per section, numbers that count up once
 * and bars that grow to their value. Nothing loops or reacts to hover. With
 * "reduce motion" set in the OS, everything renders in its final state.
 */

const EASE = [0.2, 0, 0, 1] as const;

export function DashboardMotion({children}: {children: ReactNode}) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Fades a section in and lifts it 6px, once, on first render. */
export function Reveal({children, index = 0, className}: {children: ReactNode; index?: number; className?: string}) {
  return <motion.div className={className} initial={{opacity: 0, y: 6}} animate={{opacity: 1, y: 0}} transition={{duration: 0.25, delay: index * 0.04, ease: EASE}}>
    {children}
  </motion.div>;
}

const integer = new Intl.NumberFormat("en-AE", {maximumFractionDigits: 0});

/**
 * A whole number that counts up from zero once. The server-rendered text is
 * the final value; screen readers always get the final value.
 */
export function AnimatedNumber({value, className}: {value: number; className?: string}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const node = ref.current;
    if (!node || reduce || value === 0) return;
    const controls = animate(0, value, {duration: 0.6, ease: EASE, onUpdate: latest => { node.textContent = integer.format(Math.round(latest)); }});
    return () => controls.stop();
  }, [value, reduce]);
  return <span className={className}><span ref={ref} aria-hidden="true">{integer.format(value)}</span><span className="sr-only">{integer.format(value)}</span></span>;
}

/** A thin horizontal bar that grows to `percent` of its track. */
export function AnimatedBar({percent, index = 0}: {percent: number; index?: number}) {
  const width = `${Math.max(0, Math.min(100, percent))}%`;
  return <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
    <motion.div className="h-full rounded-full bg-chart-1" initial={{width: 0}} animate={{width}} transition={{duration: 0.5, delay: 0.1 + index * 0.03, ease: EASE}} />
  </div>;
}
