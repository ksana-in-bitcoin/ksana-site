#!/usr/bin/env node
// Snow peaks for the first screen: a height field of a few summits and ridged noise, seen from far away through a long
// lens with the sun low on the left, drawn into src/img/peaks.png. The page reads the picture's three channels and sets
// it in type (src/js/peaks.js):
//   red    how bright the ground is: lit snow near 255, rock and shadow near 0
//   green  how far the ground is, nearest 0, sky 255
//   blue   how much of the ground shows through the haze and the mist at its foot; sky 0
//
//   node scripts/make-peaks.mjs [out.png]

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const W = 440;
const H = 176;

// Noise ------------------------------------------------------------------------------------------------------------------

function hash(ix, iz) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const v = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Ridged noise in 0..1: sharp crests where the octaves cross their middle. */
function ridged(x, z, octaves) {
  let sum = 0;
  let amp = 0.5;
  let weight = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    let n = 1 - Math.abs(noise(x, z) * 2 - 1);
    n *= n;
    sum += n * amp * weight;
    norm += amp;
    weight = Math.min(1, Math.max(0, n * 1.6));
    amp *= 0.5;
    const nx = x * 1.6 - z * 1.2 + 17.3;
    z = (x * 1.2 + z * 1.6) + 9.1;
    x = nx;
  }
  return sum / norm;
}

function fbm(x, z, octaves) {
  let sum = 0;
  let amp = 0.5;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x, z) * amp;
    amp *= 0.5;
    const nx = x * 1.6 - z * 1.2 + 31.7;
    z = x * 1.2 + z * 1.6 + 4.3;
    x = nx;
  }
  return sum;
}

// The ground ----------------------------------------------------------------------------------------------------------
// Summits: x, z, height, radius at the foot, sharpness, the number of buttresses, their turn and how far they reach.

const SUMMITS = [
  // the summit and its shoulders
  { x: 0.0, z: 13.0, h: 3.55, r: 4.3, e: 1.3, k: 3, a: 0.5, b: 0.36 },
  { x: -2.5, z: 13.5, h: 3.0, r: 3.3, e: 1.25, k: 3, a: 1.9, b: 0.32 },
  { x: 2.2, z: 12.8, h: 2.8, r: 3.0, e: 1.25, k: 4, a: 0.2, b: 0.3 },
  { x: 4.4, z: 14.0, h: 2.9, r: 3.3, e: 1.25, k: 3, a: 2.4, b: 0.32 },
  { x: -4.9, z: 14.3, h: 2.55, r: 3.2, e: 1.25, k: 4, a: 1.0, b: 0.3 },
  // the range to both sides
  { x: -7.6, z: 15.2, h: 2.5, r: 3.6, e: 1.3, k: 3, a: 2.6, b: 0.3 },
  { x: 7.4, z: 15.4, h: 2.3, r: 3.6, e: 1.3, k: 3, a: 1.1, b: 0.3 },
  { x: -10.4, z: 16.5, h: 2.2, r: 4.2, e: 1.3, k: 4, a: 0.4, b: 0.26 },
  { x: 10.0, z: 16.2, h: 2.6, r: 4.0, e: 1.3, k: 3, a: 2.2, b: 0.3 },
  { x: -15.0, z: 18.0, h: 2.3, r: 4.8, e: 1.25, k: 3, a: 1.2, b: 0.26 },
  { x: 14.5, z: 17.6, h: 2.0, r: 4.6, e: 1.25, k: 4, a: 0.9, b: 0.26 },
  { x: -20.5, z: 19.5, h: 1.9, r: 5.0, e: 1.25, k: 3, a: 0.3, b: 0.24 },
  { x: 20.0, z: 19.5, h: 2.1, r: 5.0, e: 1.25, k: 3, a: 1.7, b: 0.24 },
];

function height(x, z, octaves = 6) {
  const wx = x + (fbm(x * 0.35 + 3.1, z * 0.35, 3) - 0.5) * 1.9;
  const wz = z + (fbm(x * 0.35, z * 0.35 + 7.7, 3) - 0.5) * 1.9;
  let h = 0;
  let lift = 0;
  for (const s of SUMMITS) {
    const dx = wx - s.x;
    const dz = (wz - s.z) * 1.25;
    const d = Math.hypot(dx, dz);
    if (d >= s.r * 1.5) continue;
    const buttress = 1 + s.b * Math.cos(s.k * Math.atan2(dz, dx) + s.a);
    const t = Math.max(0, 1 - d / (s.r * buttress));
    const peak = s.h * Math.pow(t, s.e);
    if (peak > h) h = peak;
    lift = Math.max(lift, t);
  }
  // the range the summits stand on, a long back that rises and falls
  const back = Math.exp(-(((wz - 15.6) / 2.6) ** 2)) * (0.75 + 1.1 * fbm(wx * 0.3 + 5.5, 2.5, 3));
  if (back > h) {
    h = back;
    lift = Math.max(lift, 0.45);
  }
  const crag = ridged(wx * 0.62, wz * 0.62, octaves);
  // the crags grow with the mountain under them and leave the valleys smooth
  return h * (0.66 + 0.62 * crag) + crag * 0.34 * (0.35 + lift);
}

// The view ------------------------------------------------------------------------------------------------------------

const EYE = [0, 0.95, 0];
const SPAN = 0.62; // half the width of the view at distance 1
const HORIZON = 0.74; // where the horizon sits, as a fraction of the picture's height from its top
const FAR = 30;
const SUN = norm([-0.7, 0.44, -0.42]);
const SNOW_LINE = 1.02;
const MIST_TOP = 0.92;

function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

function cast(u, v) {
  const dir = norm([u * SPAN, -(v - HORIZON) * SPAN * 2 * (H / W), 1]);
  let t = 2.5;
  let last = t;
  while (t < FAR) {
    const y = EYE[1] + dir[1] * t;
    const g = height(EYE[0] + dir[0] * t, EYE[2] + dir[2] * t);
    if (y < g) {
      // between the last step above the ground and this one below it
      let lo = last;
      let hi = t;
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        if (EYE[1] + dir[1] * mid < height(EYE[0] + dir[0] * mid, EYE[2] + dir[2] * mid)) hi = mid;
        else lo = mid;
      }
      return hi;
    }
    if (y > 5.2 && dir[1] > 0) return -1;
    last = t;
    t += Math.max(0.012, Math.min((y - g) * 0.32, 0.4)) * (0.5 + t * 0.06);
  }
  return -1;
}

function shade(t, u, v) {
  const dir = norm([u * SPAN, -(v - HORIZON) * SPAN * 2 * (H / W), 1]);
  const x = EYE[0] + dir[0] * t;
  const z = EYE[2] + dir[2] * t;
  const y = height(x, z);
  const e = 0.012 + t * 0.0016;
  const n = norm([height(x - e, z) - height(x + e, z), 2 * e, height(x, z - e) - height(x, z + e)]);
  let lit = Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]);
  // the shadow other ground casts
  let shadow = 1;
  for (let s = 0.05; s < 7; s += 0.05 + s * 0.09) {
    const gap = y + 0.02 + SUN[1] * s - height(x + SUN[0] * s, z + SUN[2] * s, 4);
    if (gap < 0) {
      shadow = 0;
      break;
    }
    shadow = Math.min(shadow, (gap * 9) / s);
  }
  lit *= Math.max(0, Math.min(1, shadow));
  // snow lies above the snow line where the ground is not too steep
  const line = SNOW_LINE + (fbm(x * 1.7, z * 1.7, 3) - 0.5) * 0.5;
  const steep = 0.5 - 0.3 * smooth(1.3, 3.0, y) + (fbm(x * 5.1 + 2, z * 5.1, 2) - 0.5) * 0.28;
  const snow = smooth(line - 0.12, line + 0.2, y) * smooth(steep - 0.1, steep + 0.08, n[1]);
  const albedo = 0.16 + 0.84 * snow;
  const bright = albedo * (0.13 + 1.25 * Math.pow(lit, 0.8)) + 0.05 * snow * Math.max(0, n[1]);
  // haze with distance, and the mist the mountains stand in
  const haze = Math.exp(-Math.max(0, t - 6) * 0.052);
  const mistLine = MIST_TOP + (fbm(x * 0.5 + 11, z * 0.2, 3) - 0.5) * 0.7;
  const mist = smooth(mistLine - 0.16, mistLine + 0.55, y);
  return { bright: Math.min(1, bright), cover: haze * mist };
}

function smooth(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// The picture ---------------------------------------------------------------------------------------------------------

export function draw() {
  const rgb = Buffer.alloc(W * H * 3);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const u = ((i + 0.5) / W) * 2 - 1;
      const v = (j + 0.5) / H;
      const t = cast(u, v);
      const at = (j * W + i) * 3;
      if (t < 0) {
        rgb[at + 1] = 255;
        continue;
      }
      const s = shade(t, u, v);
      rgb[at] = Math.round(s.bright * 255);
      rgb[at + 1] = Math.min(254, Math.round((Math.log(t / 2.5) / Math.log(FAR / 2.5)) * 254));
      rgb[at + 2] = Math.round(s.cover * 255);
    }
  }
  return rgb;
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}

export function png(rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rows = Buffer.alloc((W * 3 + 1) * H);
  for (let j = 0; j < H; j++) rgb.copy(rows, j * (W * 3 + 1) + 1, j * W * 3, (j + 1) * W * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

export { W, H };

if (import.meta.url === `file://${process.argv[1]}`) {
  const started = Date.now();
  const out = process.argv[2] || new URL('../src/img/peaks.png', import.meta.url).pathname;
  const data = png(draw());
  writeFileSync(out, data);
  console.log(`${out}: ${W} × ${H}, ${data.length} bytes, ${Date.now() - started} ms`);
}
