// The characters a WOFF2 font maps, read from its cmap table: the check that the Chinese heading subset covers every
// character the Chinese headings use. WOFF2: https://www.w3.org/TR/WOFF2/ (the cmap table is never transformed).

import { brotliDecompressSync } from 'node:zlib';

const KNOWN_TAGS = 'cmap head hhea hmtx maxp name OS/2 post cvt  fpgm glyf loca prep CFF  VORG EBDT EBLC gasp hdmx kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL SVG  sbix acnt avar bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx opbd prop trak Zapf Silf Glat Gloc Feat Sill'
  .match(/.{4}\s?/g)
  .map((t) => t.slice(0, 4));

function base128(bytes, at) {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const b = bytes[at.i++];
    value = value * 128 + (b & 0x7f);
    if (!(b & 0x80)) return value;
  }
  throw new Error('woff2: bad UIntBase128');
}

/** The set of code points the font maps to a glyph. */
export function woff2CodePoints(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== 0x774f4632) throw new Error('woff2: not a WOFF2 file');
  const numTables = view.getUint16(12);
  const compressedSize = view.getUint32(20);
  const at = { i: 48 };
  const tables = [];
  for (let t = 0; t < numTables; t++) {
    const flags = bytes[at.i++];
    let tag;
    if ((flags & 0x3f) === 0x3f) {
      tag = String.fromCharCode(...bytes.slice(at.i, at.i + 4));
      at.i += 4;
    } else {
      tag = KNOWN_TAGS[flags & 0x3f];
    }
    const version = flags >> 6;
    const origLength = base128(bytes, at);
    const transformed = tag === 'glyf' || tag === 'loca' ? version !== 3 : version !== 0;
    const length = transformed ? base128(bytes, at) : origLength;
    tables.push({ tag, length });
  }
  const data = brotliDecompressSync(bytes.subarray(at.i, at.i + compressedSize));
  let offset = 0;
  let cmap = null;
  for (const table of tables) {
    if (table.tag === 'cmap') cmap = data.subarray(offset, offset + table.length);
    offset += table.length;
  }
  if (!cmap) throw new Error('woff2: no cmap table');
  return cmapCodePoints(cmap);
}

function cmapCodePoints(cmap) {
  const view = new DataView(cmap.buffer, cmap.byteOffset, cmap.byteLength);
  const count = view.getUint16(2);
  let best = null;
  for (let i = 0; i < count; i++) {
    const platform = view.getUint16(4 + i * 8);
    const encoding = view.getUint16(6 + i * 8);
    const offset = view.getUint32(8 + i * 8);
    const format = view.getUint16(offset);
    if (platform === 3 && encoding === 10 && format === 12) best = { offset, format };
    else if (!best && ((platform === 3 && encoding === 1) || platform === 0) && format === 4) best = { offset, format };
  }
  if (!best) throw new Error('woff2: no Unicode cmap subtable');
  const points = new Set();
  const o = best.offset;
  if (best.format === 12) {
    const groups = view.getUint32(o + 12);
    for (let g = 0; g < groups; g++) {
      const start = view.getUint32(o + 16 + g * 12);
      const end = view.getUint32(o + 20 + g * 12);
      for (let c = start; c <= end; c++) points.add(c);
    }
    return points;
  }
  const segments = view.getUint16(o + 6) / 2;
  const ends = o + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const rangeOffsets = deltas + segments * 2;
  for (let s = 0; s < segments; s++) {
    const end = view.getUint16(ends + s * 2);
    const start = view.getUint16(starts + s * 2);
    const delta = view.getInt16(deltas + s * 2);
    const rangeOffset = view.getUint16(rangeOffsets + s * 2);
    for (let c = start; c <= end && c !== 0xffff; c++) {
      let glyph;
      if (rangeOffset === 0) glyph = (c + delta) & 0xffff;
      else {
        const at = rangeOffsets + s * 2 + rangeOffset + (c - start) * 2;
        glyph = view.getUint16(at);
        if (glyph) glyph = (glyph + delta) & 0xffff;
      }
      if (glyph) points.add(c);
    }
  }
  return points;
}
