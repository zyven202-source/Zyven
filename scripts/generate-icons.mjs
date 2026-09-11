// Generates public/icon-192.png and public/icon-512.png — the Zyven brand mark
// (amber "Z" on the app's dark background) — with zero dependencies.
// Run: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── PNG encoding primitives ────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  // Prepend filter byte 0 (None) to every scanline
  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ── Brand mark rendering ───────────────────────────────────────────────────
const BG = [11, 15, 20];    // #0B0F14 — app background / theme color
const FG = [245, 158, 11];  // #F59E0B — brand amber

/** Is this point inside the "Z" glyph? Coordinates in [0, size). */
function inGlyph(x, y, S) {
  const w = 0.58 * S;
  const x0 = (S - w) / 2;
  const y0 = x0;
  const t = 0.115 * S;
  // Top bar
  if (y >= y0 && y < y0 + t && x >= x0 && x < x0 + w) return true;
  // Bottom bar
  if (y >= y0 + w - t && y < y0 + w && x >= x0 && x < x0 + w) return true;
  // Diagonal: right end (top) → left end (bottom)
  if (y >= y0 + t && y < y0 + w - t) {
    const p = (y - (y0 + t)) / (w - 2 * t);
    const cx = x0 + w - t / 2 - p * (w - t);
    return x >= cx - t / 2 && x < cx + t / 2;
  }
  return false;
}

function renderIcon(size) {
  const SS = 4; // supersample factor for smooth diagonal edges
  const big = size * SS;
  const buf = Buffer.alloc(size * size * 4);
  // Accumulate coverage per pixel at supersampled resolution
  const cov = new Float32Array(size * size);
  for (let by = 0; by < big; by++) {
    const y = Math.floor(by / SS);
    for (let bx = 0; bx < big; bx++) {
      if (inGlyph(bx + 0.5, by + 0.5, big)) cov[y * size + Math.floor(bx / SS)] += 1;
    }
  }
  const total = SS * SS;
  for (let i = 0; i < size * size; i++) {
    const a = cov[i] / total;
    const o = i * 4;
    buf[o]     = Math.round(BG[0] + (FG[0] - BG[0]) * a);
    buf[o + 1] = Math.round(BG[1] + (FG[1] - BG[1]) * a);
    buf[o + 2] = Math.round(BG[2] + (FG[2] - BG[2]) * a);
    buf[o + 3] = 255; // full-bleed square — works as both "any" and "maskable"
  }
  return encodePng(size, buf);
}

mkdirSync(join(root, 'public'), { recursive: true });
for (const size of [192, 512]) {
  const out = join(root, 'public', `icon-${size}.png`);
  writeFileSync(out, renderIcon(size));
  console.log(`wrote ${out}`);
}
