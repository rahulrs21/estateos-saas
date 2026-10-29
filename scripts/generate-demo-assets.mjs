import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

/*
 * Generates the demo property photos in public/demo-assets/ from
 * dev-data/fixtures/properties.json: simple original illustrations with a
 * "DEMO IMAGE" watermark, drawn here (no downloaded or third-party images).
 * Output is deterministic, so re-running produces identical files.
 *   node scripts/generate-demo-assets.mjs
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(root, "dev-data", "fixtures");
const read = name => JSON.parse(readFileSync(join(fixtures, name), "utf8"));
const properties = read("properties.json");
const projects = read("projects.json");

const W = 960, H = 640;

// CRC32 and PNG encoding (8-bit RGB, no filtering).
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = bytes => { let c = 0xffffffff; for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function png(pixels) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y += 1) { raw[y * (W * 3 + 1)] = 0; pixels.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(W, 0); header.writeUInt32BE(H, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// Deterministic pseudo-random numbers per property.
function rng(seedText) {
  let seed = 2166136261;
  for (const char of seedText) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

function canvas() {
  const pixels = Buffer.alloc(W * H * 3);
  const set = (x, y, [r, g, b], alpha = 1) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    pixels[i] = Math.round(pixels[i] * (1 - alpha) + r * alpha);
    pixels[i + 1] = Math.round(pixels[i + 1] * (1 - alpha) + g * alpha);
    pixels[i + 2] = Math.round(pixels[i + 2] * (1 - alpha) + b * alpha);
  };
  const rect = (x0, y0, w, h, color, alpha = 1) => { for (let y = Math.max(0, Math.round(y0)); y < Math.min(H, Math.round(y0 + h)); y += 1) for (let x = Math.max(0, Math.round(x0)); x < Math.min(W, Math.round(x0 + w)); x += 1) set(x, y, color, alpha); };
  const circle = (cx, cy, radius, color, alpha = 1) => { for (let y = Math.floor(cy - radius); y <= cy + radius; y += 1) for (let x = Math.floor(cx - radius); x <= cx + radius; x += 1) if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) set(x, y, color, alpha); };
  const triangle = (cx, top, halfWidth, height, color) => { for (let dy = 0; dy < height; dy += 1) { const half = halfWidth * (dy / height); rect(cx - half, top + dy, half * 2, 1, color); } };
  return { pixels, set, rect, circle, triangle };
}

const mix = (a, b, t) => a.map((value, i) => Math.round(value + (b[i] - value) * t));
const shade = (color, factor) => color.map(value => Math.max(0, Math.min(255, Math.round(value * factor))));

// 5x7 bitmap font for the watermark.
const FONT = {
  A: "0E1111 1F111111", B: "1E11111E11111E", C: "0E111010 10110E", D: "1E111111 11111E", E: "1F10101E10101F", F: "1F10101E101010", G: "0E111017 11110F",
  H: "1111111F111111", I: "0E040404 04040E", J: "07020202 02120C", K: "11121418 141211", L: "10101010 10101F", M: "111B1515 111111", N: "11111915 131111",
  O: "0E111111 11110E", P: "1E11111E 101010", Q: "0E111111 15120D", R: "1E11111E 141211", S: "0F10100E 01011E", T: "1F040404 040404", U: "11111111 11110E",
  V: "11111111 110A04", W: "11111115 15150A", X: "11110A04 0A1111", Y: "1111110A 040404", Z: "1F010204 08101F", 0: "0E111315 19110E", 1: "040C0404 04040E",
  2: "0E110102 04081F", 3: "1F020402 01110E", 4: "02060A12 1F0202", 5: "1F101E01 01110E", 6: "0608101E 11110E", 7: "1F010204 080808", 8: "0E11110E 11110E",
  9: "0E11110F 01020C", "-": "0000001F 000000", " ": "00000000 000000", ".": "00000000 000C0C", "/": "01010204 081010",
};
function text(c, message, x, y, scale, color) {
  for (const char of message.toUpperCase()) {
    const rows = (FONT[char] ?? FONT[" "]).replace(/ /g, "").match(/../g).map(hex => parseInt(hex, 16));
    rows.forEach((bits, row) => { for (let col = 0; col < 5; col += 1) if (bits & (1 << (4 - col))) c.rect(x + col * scale, y + row * scale, scale, scale, color); });
    x += 6 * scale;
  }
  return x;
}
const textWidth = (message, scale) => message.length * 6 * scale - scale;

function draw(property, project) {
  const random = rng(property.propertyReference);
  const c = canvas();
  const dusk = random() < 0.3;
  const skyTop = dusk ? [64, 72, 140] : [96, 160, 220];
  const skyBottom = dusk ? [246, 170, 120] : [214, 236, 250];
  const horizon = Math.round(H * 0.68);
  for (let y = 0; y < horizon; y += 1) c.rect(0, y, W, 1, mix(skyTop, skyBottom, y / horizon));
  c.circle(140 + random() * 680, 90 + random() * 90, dusk ? 46 : 38, dusk ? [255, 196, 120] : [255, 236, 170]);
  const waterfront = /sea|marina|canal|lake|beach|island/i.test(`${property.view} ${property.community}`);
  const ground = waterfront ? [70, 140, 170] : [222, 200, 160];
  for (let y = horizon; y < H; y += 1) c.rect(0, y, W, 1, mix(ground, shade(ground, 0.8), (y - horizon) / (H - horizon)));
  const palette = [[236, 232, 222], [214, 206, 190], [190, 200, 210], [226, 214, 196], [200, 190, 175]];
  const glass = dusk ? [255, 214, 140] : [120, 170, 205];

  if (property.propertyType === "APARTMENT" || property.propertyType === "PENTHOUSE") {
    const towers = 3 + Math.floor(random() * 3);
    for (let t = 0; t < towers; t += 1) {
      const width = 90 + random() * 70;
      const x = 40 + t * ((W - 80) / towers) + random() * 30;
      const height = 230 + random() * 240 + (t === 1 ? 60 : 0);
      const color = palette[Math.floor(random() * palette.length)];
      c.rect(x, horizon - height, width, height, color);
      c.rect(x + width - 14, horizon - height, 14, height, shade(color, 0.82));
      for (let wy = horizon - height + 16; wy < horizon - 18; wy += 22) for (let wx = x + 12; wx < x + width - 26; wx += 20) c.rect(wx, wy, 11, 13, glass, 0.9);
    }
  } else {
    const units = property.propertyType === "TOWNHOUSE" ? 4 : 1;
    const unitWidth = property.propertyType === "TOWNHOUSE" ? 170 : 420;
    const startX = (W - unitWidth * units) / 2;
    const color = palette[Math.floor(random() * palette.length)];
    for (let u = 0; u < units; u += 1) {
      const x = startX + u * unitWidth;
      const height = property.propertyType === "TOWNHOUSE" ? 190 : 170;
      c.rect(x, horizon - height, unitWidth - 4, height, u % 2 ? shade(color, 0.94) : color);
      c.rect(x - 6, horizon - height - 14, unitWidth + 8, 14, shade(color, 0.7));
      if (property.propertyType === "VILLA") c.rect(x + unitWidth * 0.55, horizon - height - 70, unitWidth * 0.4, 70, shade(color, 0.9));
      for (let wx = x + 20; wx < x + unitWidth - 50; wx += 70) { c.rect(wx, horizon - height + 30, 40, 50, glass, 0.9); c.rect(wx, horizon - height + 100, 40, 50, glass, 0.9); }
      c.rect(x + unitWidth / 2 - 18, horizon - 70, 36, 70, [120, 90, 70]);
    }
    if (property.propertyType === "VILLA") c.rect(W / 2 - 160, horizon + 30, 320, 60, [90, 190, 220]);
    for (const px of [70, W - 110]) {
      c.rect(px + 14, horizon - 170, 10, 170, [120, 90, 60]);
      for (let f = 0; f < 5; f += 1) c.circle(px + 19 + Math.cos(f * 1.3) * 30, horizon - 170 + Math.sin(f * 1.3) * 12, 18, [70, 140, 80]);
    }
  }

  // Watermark band: marks every image as a fictional demo.
  c.rect(0, H - 92, W, 92, [20, 24, 32], 0.78);
  const title = "DEMO IMAGE - FICTIONAL PROPERTY";
  text(c, title, (W - textWidth(title, 4)) / 2, H - 80, 4, [255, 255, 255]);
  const subtitle = `${property.propertyReference} / ${project.projectCode}`;
  text(c, subtitle, (W - textWidth(subtitle, 3)) / 2, H - 38, 3, [200, 210, 225]);
  return png(c.pixels);
}

let written = 0;
for (const property of properties) {
  const project = projects.find(item => item.key === property.projectKey);
  for (const photo of property.photos) {
    const target = join(root, "public", photo.asset);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, draw(property, project));
    written += 1;
  }
}
console.log(`Wrote ${written} demo images to public/demo-assets/.`);
