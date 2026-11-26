"use client";

import { useId } from "react";
import { motion } from "motion/react";

/**
 * The AI Copilot card's robot, drawn in SVG with gradients and highlights for
 * a soft 3D look (no image files). It floats, blinks, waves and its antenna
 * light pulses. Decorative only. Inside the dashboard's
 * MotionConfig reducedMotion="user", the transform animations stop for
 * visitors who ask the OS to reduce motion.
 */
export function CopilotRobot({className}: {className?: string}) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (name: string) => `robot-${raw}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;
  const loop = {repeat: Infinity, ease: "easeInOut"} as const;

  return <svg viewBox="0 0 220 230" className={className} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={id("shell")} cx="38%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="55%" stopColor="#e7eef2" />
        <stop offset="100%" stopColor="#aebcc6" />
      </radialGradient>
      <linearGradient id={id("visor")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1f3a47" />
        <stop offset="100%" stopColor="#0a161d" />
      </linearGradient>
      <linearGradient id={id("gloss")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={id("teal")} cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#7ff0d6" />
        <stop offset="100%" stopColor="#0f8a74" />
      </radialGradient>
      <radialGradient id={id("glow")} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#b9fff0" />
        <stop offset="60%" stopColor="#4fe3c1" />
        <stop offset="100%" stopColor="#4fe3c1" stopOpacity="0" />
      </radialGradient>
      <filter id={id("soft")} x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#03251f" floodOpacity="0.35" />
      </filter>
      <filter id={id("blur")} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" /></filter>
    </defs>

    {/* Floor shadow: shrinks as the robot rises. */}
    <motion.ellipse cx="110" cy="214" rx="50" ry="7" fill="#022019" opacity="0.32" style={{transformBox: "fill-box", transformOrigin: "50% 50%"}}
      animate={{scaleX: [1, 0.86, 1], opacity: [0.32, 0.22, 0.32]}} transition={{duration: 3.6, ...loop}} />

    <motion.g animate={{y: [0, -8, 0]}} transition={{duration: 3.6, ...loop}} filter={url("soft")}>
      {/* Antenna with a pulsing light. */}
      <rect x="107" y="22" width="6" height="22" rx="3" fill={url("shell")} />
      <motion.circle cx="110" cy="18" r="12" fill={url("glow")} style={{transformBox: "fill-box", transformOrigin: "50% 50%"}}
        animate={{scale: [0.8, 1.15, 0.8], opacity: [0.55, 1, 0.55]}} transition={{duration: 2.2, ...loop}} />
      <circle cx="110" cy="18" r="5.5" fill="#e9fffa" />

      {/* Ears. */}
      <ellipse cx="44" cy="92" rx="11" ry="17" fill={url("teal")} />
      <ellipse cx="176" cy="92" rx="11" ry="17" fill={url("teal")} />

      {/* Head shell, visor and gloss. */}
      <rect x="48" y="42" width="124" height="98" rx="44" fill={url("shell")} />
      <ellipse cx="86" cy="58" rx="26" ry="8" fill="#ffffff" opacity="0.7" />
      <rect x="62" y="64" width="96" height="56" rx="28" fill={url("visor")} />
      <path d="M72 76 C 84 66, 128 64, 146 72 L 146 80 C 126 74, 88 76, 72 86 Z" fill={url("gloss")} />

      {/* Eyes: glow plus a blink every few seconds. */}
      <motion.g style={{transformBox: "fill-box", transformOrigin: "50% 50%"}}
        animate={{scaleY: [1, 1, 0.12, 1, 1]}} transition={{duration: 4.6, times: [0, 0.9, 0.93, 0.96, 1], repeat: Infinity}}>
        <ellipse cx="92" cy="92" rx="9" ry="11" fill="#4fe3c1" filter={url("blur")} opacity="0.8" />
        <ellipse cx="128" cy="92" rx="9" ry="11" fill="#4fe3c1" filter={url("blur")} opacity="0.8" />
        <ellipse cx="92" cy="92" rx="6.5" ry="8.5" fill="#c9fff3" />
        <ellipse cx="128" cy="92" rx="6.5" ry="8.5" fill="#c9fff3" />
      </motion.g>
      <path d="M100 108 Q 110 114 120 108" stroke="#4fe3c1" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.85" />

      {/* Neck and body with a chest light. */}
      <rect x="96" y="136" width="28" height="12" rx="5" fill="#9fb0bb" />
      <rect x="66" y="144" width="88" height="58" rx="26" fill={url("shell")} />
      <ellipse cx="94" cy="156" rx="18" ry="5" fill="#ffffff" opacity="0.6" />
      <motion.circle cx="110" cy="174" r="9" fill={url("glow")} animate={{opacity: [0.6, 1, 0.6]}} transition={{duration: 2.2, ...loop}} />
      <circle cx="110" cy="174" r="4.5" fill="#0f8a74" />

      {/* Left arm resting; right arm waving from the shoulder. */}
      <rect x="44" y="150" width="20" height="44" rx="10" fill={url("shell")} transform="rotate(12 54 152)" />
      <motion.g style={{transformBox: "fill-box", transformOrigin: "20% 92%"}}
        animate={{rotate: [0, 0, -22, 4, -22, 0, 0]}} transition={{duration: 5.5, times: [0, 0.45, 0.55, 0.65, 0.75, 0.85, 1], repeat: Infinity}}>
        <rect x="156" y="112" width="20" height="46" rx="10" fill={url("shell")} transform="rotate(-24 166 156)" />
        <circle cx="182" cy="112" r="11" fill={url("shell")} />
      </motion.g>
    </motion.g>
  </svg>;
}
