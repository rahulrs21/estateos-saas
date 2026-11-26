/**
 * A Dubai skyline in simple geometric shapes: the Burj Khalifa, towers and the
 * Burj Al Arab sail over a water line. Decorative only (aria-hidden). It is
 * drawn in the theme's --banner-skyline colour at low opacity, so it recolours
 * itself for light and dark mode with no image files.
 */
const BACK: Array<[number, number, number]> = [
  // [x, width, height] of the far row of towers.
  [8, 26, 62], [38, 18, 84], [60, 30, 54], [96, 22, 98], [122, 28, 70], [154, 16, 112], [174, 26, 80],
  [300, 24, 92], [328, 18, 118], [350, 30, 76], [386, 20, 104], [410, 28, 66], [444, 22, 88], [470, 32, 58],
  [508, 18, 96], [530, 26, 72], [562, 22, 84], [590, 30, 60],
];
const FRONT: Array<[number, number, number]> = [
  [0, 34, 40], [36, 24, 58], [64, 30, 46], [100, 20, 72], [124, 34, 52], [164, 22, 64], [190, 28, 44],
  [284, 30, 56], [318, 22, 78], [344, 34, 50], [384, 24, 68], [414, 30, 42], [450, 26, 60], [482, 34, 48],
  [522, 22, 66], [550, 30, 44], [586, 34, 54],
];
const BASE = 150;

export function Skyline({className}: {className?: string}) {
  return <svg viewBox="0 -16 640 176" preserveAspectRatio="xMaxYMax meet" className={className} aria-hidden="true" focusable="false">
    <g fill="var(--banner-skyline)">
      <g opacity="0.10">
        {BACK.map(([x, w, h]) => <rect key={`b${x}`} x={x} y={BASE - h} width={w} height={h} rx="1.5" />)}
      </g>
      {/* Burj Khalifa: stepped setbacks and a spire. */}
      <g opacity="0.22">
        <rect x="226" y="62" width="34" height="88" rx="1.5" />
        <rect x="231" y="36" width="24" height="30" rx="1.5" />
        <rect x="236" y="16" width="14" height="24" rx="1" />
        <rect x="240" y="2" width="6" height="18" rx="1" />
        <rect x="242.25" y="-14" width="1.5" height="18" />
      </g>
      {/* Burj Al Arab: a sail on a slim mast. */}
      <g opacity="0.2">
        <rect x="604" y="64" width="3" height="86" />
        <path d="M607 64 C 632 84, 634 122, 607 150 Z" />
      </g>
      <g opacity="0.18">
        {FRONT.map(([x, w, h]) => <rect key={`f${x}`} x={x} y={BASE - h} width={w} height={h} rx="1.5" />)}
      </g>
      {/* Water line. */}
      <rect x="0" y={BASE} width="640" height="10" opacity="0.12" />
      <rect x="40" y={BASE + 4} width="120" height="1.5" opacity="0.18" />
      <rect x="330" y={BASE + 6} width="160" height="1.5" opacity="0.14" />
    </g>
  </svg>;
}
