// The landing page's scenes (D-125): one drawing for each act of the story, which src/js/landing.js plays forward as
// the reader scrolls through the act. Every drawing is written in its final state, which is what a reader sees without
// the script or with reduced motion; the script takes it back to where the act starts and plays it from there.
//
// What moves, and when, is written on the elements as the act's progress from 0 to 1:
//   data-in="a b"        fades and grows in while the progress goes from a to b
//   data-fade="a b"      fades in, without growing
//   data-out="a b [o]"   fades out to opacity o (0 if left out)
//   data-draw="a b"      a stroke drawn along its length (pathLength 1)
//   data-move="p:x,y …"  earlier positions: at progress p the element stands at (x, y), its drawn place being the last
//   data-rx="a b from"   corner radius from `from` to the drawn one: a fast-lane block becoming a block on Bitcoin
//   data-scale="a b s"   scale from s to 1 (the seal stamping)
//   data-on="a"          the class is-on from a, for changes of color that CSS eases
// Text a reader must read is HTML over the drawing (tags), never SVG text scaled down with it.

import { sealShape } from './figures.mjs';
import { ensoPath } from './render.mjs';

const f = (n) => Number(Number(n).toFixed(2));
const span = (a, b) => `${f(a)} ${f(b)}`;

/** The markup in its final state: what has faded out is faded out, and what turns on is on. */
function finalState(html) {
  return html.replace(/<[a-z]+\b[^>]*>/g, (el) => {
    let out = el;
    if (/\sdata-on="/.test(el)) out = out.replace(/class="([^"]*)"/, 'class="$1 is-on"');
    const faded = el.match(/\sdata-out="[\d.]+ [\d.]+(?: ([\d.]+))?"/);
    if (faded) {
      const o = faded[1] || '0';
      out = /\sstyle="/.test(out) ? out.replace(/style="([^"]*)"/, `style="$1;opacity:${o}"`) : out.replace(/\/?>$/, (end) => ` style="opacity:${o}"${end}`);
    }
    return out;
  });
}

/** A scene: the drawing, and the HTML tags laid over it at the drawing's coordinates. */
function scene(kind, W, H, body, tags = []) {
  return `<div class="scene scene--${kind}" style="--w:${W};--h:${H}">
<svg class="scene-svg" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">${finalState(body)}</svg>${finalState(tags.join(''))}</div>`;
}

/** An HTML label at (x, y) of a W × H drawing; `at` is the side it hangs from: l(eft), c(entre) or r(ight). */
function tag(W, H, x, y, html, { at = 'c', cls = '', anim = '' } = {}) {
  return `<span class="tag tag--${at}${cls ? ` ${cls}` : ''}" style="left:${f((x / W) * 100)}%;top:${f((y / H) * 100)}%"${anim ? ` ${anim}` : ''} aria-hidden="true">${html}</span>`;
}

/**
 * A block of the fast lane: a square with fully rounded corners, so that it can square up once it is on Bitcoin
 * (drawn with corner radius `rx`, and data-rx giving the radius it starts from).
 */
function blk(x, y, r, cls = '', anim = '', rx = r) {
  return `<rect class="blk${cls ? ` ${cls}` : ''}" x="${f(x - r)}" y="${f(y - r)}" width="${f(2 * r)}" height="${f(2 * r)}" rx="${f(rx)}"${anim ? ` ${anim}` : ''}/>`;
}

/** A Bitcoin block: a square of side s centred at (x, y). */
function btc(x, y, s, cls = '', anim = '') {
  return `<rect class="btc${cls ? ` ${cls}` : ''}" x="${f(x - s / 2)}" y="${f(y - s / 2)}" width="${f(s)}" height="${f(s)}" rx="${f(s * 0.07)}"${anim ? ` ${anim}` : ''}/>`;
}

function line(x1, y1, x2, y2, cls, anim = '') {
  return `<path class="${cls}" d="M ${f(x1)} ${f(y1)} L ${f(x2)} ${f(y2)}" pathLength="1"${anim ? ` ${anim}` : ''}/>`;
}

function curve(x1, y1, x2, y2, cls, anim = '', bend = 0.55) {
  const dy = (y2 - y1) * bend;
  return `<path class="${cls}" d="M ${f(x1)} ${f(y1)} C ${f(x1)} ${f(y1 + dy)}, ${f(x2)} ${f(y2 - dy)}, ${f(x2)} ${f(y2)}" pathLength="1"${anim ? ` ${anim}` : ''}/>`;
}

/** A check mark centred at (x, y), `s` wide. */
function check(x, y, s, cls, anim = '') {
  const h = s / 2;
  return `<path class="${cls}" d="M ${f(x - h)} ${f(y + h * 0.05)} L ${f(x - h * 0.3)} ${f(y + h * 0.7)} L ${f(x + h)} ${f(y - h * 0.65)}" pathLength="1"${anim ? ` ${anim}` : ''}/>`;
}

const moves = (frames) => `data-move="${frames.map(([p, x, y]) => `${f(p)}:${f(x)},${f(y)}`).join(' ')}"`;

// A small deterministic generator, so that the drawings' hex is the same at every build.
function hexStream(seed, length) {
  let s = seed >>> 0;
  let out = '';
  for (let i = 0; i < length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out += ((s >>> 24) & 15).toString(16);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Act 1. One Bitcoin block of ten minutes, and the hundred and twenty five-second blocks of the fast lane that fit in
// it: the cells light one by one as the clock runs from 0:00 to 10:00, then the ink frame of the Bitcoin block closes
// around them.

export const CLOCK = { cellsFrom: 0.05, cellsTo: 0.86 };

export function clockScene(t) {
  const W = 600;
  const H = 620;
  const cols = 12;
  const s = 38;
  const g = 6;
  const gw = cols * s + (cols - 1) * g;
  const gh = 10 * s + 9 * g;
  const x0 = (W - gw) / 2;
  const y0 = 40;
  let cells = '';
  for (let i = 0; i < 120; i++) {
    const at = CLOCK.cellsFrom + (CLOCK.cellsTo - CLOCK.cellsFrom) * (i / 119);
    const x = x0 + (i % cols) * (s + g);
    const y = y0 + Math.floor(i / cols) * (s + g);
    // four decimals, so that every cell lights at its own moment and the readout's count follows the cells
    cells += `<rect class="cell" x="${f(x)}" y="${f(y)}" width="${s}" height="${s}" rx="3" data-on="${Number(at.toFixed(4))}"/>`;
  }
  const p = 13;
  const [fx, fy, fw, fh, r] = [x0 - p, y0 - p, gw + 2 * p, gh + 2 * p, 10];
  const frame = `<path class="frame" d="M ${f(fx + r)} ${f(fy)} H ${f(fx + fw - r)} Q ${f(fx + fw)} ${f(fy)} ${f(fx + fw)} ${f(fy + r)} V ${f(fy + fh - r)} Q ${f(fx + fw)} ${f(fy + fh)} ${f(fx + fw - r)} ${f(fy + fh)} H ${f(fx + r)} Q ${f(fx)} ${f(fy + fh)} ${f(fx)} ${f(fy + fh - r)} V ${f(fy + r)} Q ${f(fx)} ${f(fy)} ${f(fx + r)} ${f(fy)} Z" pathLength="1" data-draw="${span(0.88, 0.97)}"/>`;
  const readY = y0 + gh + 70;
  const tags = [
    tag(W, H, x0, readY, `<span class="clock-time" data-k="clock">10:00</span>`, { at: 'l', cls: 'tag--big' }),
    tag(W, H, x0 + gw, readY, `<span data-k="count" data-template="${t.count}">${t.count.replace('{n}', '120')}</span>`, { at: 'r', cls: 'tag--count' }),
    tag(W, H, x0 + gw, fy + fh + 26, t.block, { at: 'r', cls: 'tag--ink', anim: `data-fade="${span(0.92, 0.98)}"` }),
  ];
  return scene('clock', W, H, `<g class="cells">${cells}</g>${frame}`, tags);
}

// ---------------------------------------------------------------------------------------------------------------------
// Act 2. The fast lane: blocks found about every five seconds, a block DAG where blocks found at the same moment are
// merged by the next one instead of thrown away, your operation dropping into a block, and every block's anchor, the
// Bitcoin block it has seen.

export function laneScene(t) {
  const W = 800;
  const H = 600;
  const Y = 270;
  const UP = 188;
  const DOWN = 352;
  const R = 13;
  const X = (i) => 64 + i * 45;
  const at = (i) => 0.06 + (0.8 * i) / 15;
  const OP = 4;

  const blocks = [];
  for (let i = 0; i < 16; i++) blocks.push({ x: X(i), y: Y, at: at(i), parents: i ? [{ x: X(i - 1), y: Y }] : [] });
  // Blocks found at the same moment as a main-chain block, merged by the next block: two pairs and a triple.
  const sides = [
    { i: 7, y: UP },
    { i: 11, y: DOWN },
    { i: 14, y: UP },
    { i: 14, y: DOWN },
  ];
  for (const s of sides) {
    const b = { x: X(s.i), y: s.y, at: at(s.i) + 0.012, parents: [{ x: X(s.i - 1), y: Y }] };
    blocks.push(b);
    blocks[s.i + 1].parents.push({ x: b.x, y: b.y });
  }

  let edges = '';
  let shapes = '';
  for (const b of blocks) {
    // centre to centre: the blocks, drawn over the edges, hide the ends
    for (const p of b.parents) edges += line(p.x, p.y, b.x, b.y, 'edge', `data-draw="${span(b.at - 0.025, b.at + 0.005)}"`);
    shapes += blk(b.x, b.y, R, b.y === Y ? '' : 'blk--side', `data-in="${span(b.at, b.at + 0.03)}"`);
  }

  // Your operation: signed, waiting in a node's pool above the lane, then taken into block OP.
  const ox = X(OP);
  const landed = at(OP) + 0.025;
  const op = `<g class="op" ${moves([
    [0.1, ox, 44],
    [0.22, ox, 138],
    [at(OP), ox, 146],
    [landed, ox, Y],
  ])} data-fade="${span(0.1, 0.13)}"><circle class="op-glow" cx="${ox}" cy="${Y}" r="15"/><circle class="op-dot" cx="${ox}" cy="${Y}" r="6.5"/></g>`;
  const ring = `<circle class="ring" cx="${ox}" cy="${Y}" r="${R + 8}" data-in="${span(landed, landed + 0.04)}"/>`;

  // The anchors: a few blocks and the Bitcoin block each has seen, which never goes back.
  const BY = 520;
  const bx = [150, 420, 690];
  const btcRow =
    btc(bx[0], BY, 58, '', `data-fade="${span(0.62, 0.66)}"`) +
    btc(bx[1], BY, 58, '', `data-fade="${span(0.64, 0.68)}"`) +
    btc(bx[2], BY, 58, 'btc--next', `data-fade="${span(0.66, 0.7)}"`) +
    line(bx[0] + 29, BY, bx[1] - 29, BY, 'link', `data-fade="${span(0.64, 0.68)}"`) +
    line(bx[1] + 29, BY, bx[2] - 29, BY, 'link link--next', `data-fade="${span(0.66, 0.7)}"`);
  const anchors = [
    [2, 0],
    [6, 0],
    [10, 1],
    [13, 1],
  ]
    .map(([i, k], n) => curve(X(i), Y + R + 4, bx[k] + (i % 2 ? 12 : -12), BY - 33, 'anchor', `data-fade="${span(0.68 + n * 0.03, 0.72 + n * 0.03)}"`, 0.5))
    .join('');

  const tags = [
    tag(W, H, ox - 18, 44, t.signed, { at: 'r', anim: `data-fade="${span(0.1, 0.13)}" data-out="${span(0.22, 0.25)}"` }),
    tag(W, H, ox, Y - 50, t.you, { anim: `data-fade="${span(landed, landed + 0.04)}"` }),
    tag(W, H, X(7) + 22, UP - 44, t.merged, { anim: `data-fade="${span(at(8), at(8) + 0.04)}"` }),
    tag(W, H, X(14), DOWN + 46, t.parents, { anim: `data-fade="${span(at(15), at(15) + 0.04)}"` }),
    tag(W, H, bx[1], BY + 52, t.anchor, { anim: `data-fade="${span(0.7, 0.74)}"` }),
  ];
  return scene('lane', W, H, `<g class="anchors">${anchors}</g>${btcRow}<g class="edges">${edges}</g><g class="blocks">${shapes}</g>${ring}${op}`, tags);
}

// ---------------------------------------------------------------------------------------------------------------------
// Act 3. A settlement: the blocks since the last settlement, their data copied into the Taproot witness of a reveal
// transaction that spends the commit transaction's output, the pair landing in the next Bitcoin block, and the blocks
// above squaring up: their data is on Bitcoin.

export function settleScene(t) {
  const W = 800;
  const H = 640;
  const LY = 100;
  const R = 12;
  const N = 12;
  const X = (i) => 96 + i * 55.3;

  let lane = '';
  for (let i = 1; i < N; i++) lane += line(X(i - 1) + R, LY, X(i) - R, LY, 'edge');
  lane += line(X(-1) + R, LY, X(0) - R, LY, 'edge edge--faint') + line(X(N - 1) + R, LY, X(N) - R, LY, 'edge edge--faint');
  lane += blk(X(-1), LY, R, 'blk--faint blk--written', '', 2.5) + blk(X(N), LY, R, 'blk--faint');
  for (let i = 0; i < N; i++) lane += blk(X(i), LY, R, 'blk--batch', `data-rx="${span(0.78 + i * 0.008, 0.84 + i * 0.008)} ${R}" data-on="${f(0.8 + i * 0.008)}"`, 2.5);
  const bracket = `<path class="brace" d="M ${f(X(0) - 16)} ${LY - 30} V ${LY - 40} H ${f(X(N - 1) + 16)} V ${LY - 30}" pathLength="1" data-draw="${span(0.03, 0.15)}"/>`;

  // The pair: the commit transaction pays to a Taproot output, which the reveal spends; the reveal's witness holds the
  // envelope's leaf script: <key> OP_CHECKSIG OP_FALSE OP_IF "KSN1" <chunks of the payload> OP_ENDIF.
  const C = { x: 92, y: 236, w: 214, h: 130 };
  const V = { x: 372, y: 206, w: 354, h: 190 };
  const box = (b, a) =>
    `<rect class="tx" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10" pathLength="1" data-draw="${span(a, a + 0.08)}"/>`;
  const commitOut = `<rect class="tx-out" x="${C.x + C.w - 58}" y="${C.y + C.h - 44}" width="36" height="24" rx="4" data-fade="${span(0.3, 0.33)}"/>`;
  const arrow = `<path class="arrow" d="M ${C.x + C.w - 22} ${C.y + C.h - 32} C ${C.x + C.w + 30} ${C.y + C.h - 32}, ${V.x - 40} ${V.y + V.h - 60}, ${V.x} ${V.y + V.h - 60}" pathLength="1" data-draw="${span(0.33, 0.38)}"/>`;
  const lines = [
    `<tspan class="hex-dim">20</tspan> ${hexStream(7, 16)}… <tspan class="hex-dim">ac 00 63</tspan>`,
    `<tspan class="hex-dim">04</tspan> <tspan class="hex-key">4b534e31</tspan> <tspan class="hex-dim">4d 0802</tspan>`,
    hexStream(11, 30),
    hexStream(23, 30),
    hexStream(31, 30),
    `${hexStream(43, 18)} <tspan class="hex-dim">68</tspan>`,
  ];
  const hex = lines
    .map((l, k) => `<text class="hex" x="${V.x + 22}" y="${V.y + 72 + k * 19}" data-fade="${span(0.4 + k * 0.03, 0.44 + k * 0.03)}">${l}</text>`)
    .join('');

  // Copies of the blocks' data streaming into the witness.
  let copies = '';
  for (let i = 0; i < N; i++) {
    const a = 0.36 + i * 0.012;
    const tx = V.x + 34 + (i % 6) * 50;
    const ty = V.y + 112 + Math.floor(i / 6) * 38;
    copies += `<circle class="copy" cx="${f(tx)}" cy="${f(ty)}" r="4.5" ${moves([
      [a, X(i), LY],
      [a + 0.1, tx, ty],
    ])} data-fade="${span(a, a + 0.02)}" data-out="${span(a + 0.1, a + 0.14)}"/>`;
  }

  // Bitcoin below: earlier blocks, and the next one, which the pair lands in.
  const BY = 560;
  const S = 64;
  const bx = [112, 247, 382, 517, 652];
  let chain = '';
  for (let k = 1; k < bx.length; k++) chain += line(bx[k - 1] + S / 2, BY, bx[k] - S / 2, BY, 'link');
  for (let k = 0; k < bx.length - 1; k++) chain += btc(bx[k], BY, S);
  chain += btc(bx[4], BY, S, 'btc--next', 'data-on="0.72"');
  chain += `<rect class="btc-tx" x="${bx[4] - 14}" y="${BY - 9}" width="28" height="18" rx="3" data-in="${span(0.72, 0.76)}"/>`;
  const land = curve(V.x + V.w / 2 + 40, V.y + V.h + 4, bx[4], BY - S / 2 - 6, 'land', `data-draw="${span(0.6, 0.71)}"`, 0.5);

  const tags = [
    tag(W, H, (X(0) + X(N - 1)) / 2, LY - 66, t.batch, { anim: `data-fade="${span(0.08, 0.14)}"` }),
    tag(W, H, C.x + 18, C.y + 30, t.commit, { at: 'l', cls: 'tag--box', anim: `data-fade="${span(0.26, 0.3)}"` }),
    tag(W, H, V.x + 18, V.y + 30, t.reveal, { at: 'l', cls: 'tag--box', anim: `data-fade="${span(0.32, 0.36)}"` }),
    tag(W, H, bx[4] + S / 2, BY + S / 2 + 24, t.next, { at: 'r', anim: `data-fade="${span(0.66, 0.7)}"` }),
  ];
  return scene('settle', W, H, `${chain}${land}<g class="lane">${lane}</g>${bracket}${box(C, 0.22)}${commitOut}${arrow}${box(V, 0.28)}<g class="hexes">${hex}</g>${copies}`, tags);
}

// ---------------------------------------------------------------------------------------------------------------------
// Act 4. Final on Bitcoin: Bitcoin blocks pile up on the one holding the data. At the sixth confirmation every node
// decides the block final; when the Bitcoin block of that decision has six confirmations of its own (the data's
// eleventh), it is reported final and the seal stamps (D-114, D-116).

export const SEAL = {
  // when each of the ten Bitcoin blocks after the data's appears
  at: [0.06, 0.145, 0.23, 0.315, 0.4, 0.54, 0.61, 0.68, 0.75, 0.82],
  decided: 0.46,
  stamp: [0.86, 0.9],
  flood: [0.87, 0.97],
};

export function sealScene(t) {
  const W = 800;
  const H = 560;
  const Y = 290;
  const S = 50;
  const X = (j) => 66 + j * 66.8;
  let chain = '';
  for (let j = 1; j <= 10; j++) {
    const a = SEAL.at[j - 1];
    chain += line(X(j - 1) + S / 2, Y, X(j) - S / 2, Y, 'link', `data-fade="${span(a, a + 0.03)}"`);
    chain += btc(X(j), Y, S, '', `data-in="${span(a, a + 0.035)}"`);
  }
  // The block holding the data, with the data as a grid of small squares.
  let data = btc(X(0), Y, S, 'btc--data');
  for (let k = 0; k < 4; k++) data += `<rect class="data-bit" x="${f(X(0) - 13 + (k % 2) * 14)}" y="${f(Y - 13 + Math.floor(k / 2) * 14)}" width="12" height="12" rx="2"/>`;
  const tick = check(X(0), Y, 26, 'tick', `data-draw="${span(SEAL.decided, SEAL.decided + 0.04)}"`);
  const b1 = `<path class="brace" d="M ${f(X(0) - S / 2)} ${Y + 44} V ${Y + 54} H ${f(X(5) + S / 2)} V ${Y + 44}" pathLength="1" data-draw="${span(SEAL.decided, SEAL.decided + 0.05)}"/>`;
  const b2 = `<path class="brace brace--decision" d="M ${f(X(5) - S / 2)} ${Y - 44} V ${Y - 54} H ${f(X(10) + S / 2)} V ${Y - 44}" pathLength="1" data-draw="${span(0.82, 0.86)}"/>`;
  const seal = `<g class="seal" data-scale="${span(SEAL.stamp[0], SEAL.stamp[1])} 2.4" data-fade="${span(SEAL.stamp[0], SEAL.stamp[0] + 0.015)}">${sealShape(X(0), Y, 74, -8)}</g>`;

  const tags = [
    tag(W, H, X(0) - S / 2, 116, `<span class="seal-count" data-k="count">11</span>`, { at: 'l', cls: 'tag--big' }),
    tag(W, H, X(0) - S / 2, 176, `<span data-k="count-label" data-one="${t.confirmation}" data-many="${t.confirmations}">${t.confirmations}</span>`, { at: 'l', cls: 'tag--count' }),
    tag(W, H, X(0) - S / 2, Y + 82, t.decided, { at: 'l', anim: `data-fade="${span(SEAL.decided + 0.02, SEAL.decided + 0.06)}"` }),
    tag(W, H, (X(5) + X(10)) / 2, Y - 82, t.secured, { anim: `data-fade="${span(0.83, 0.87)}"` }),
  ];
  return scene('seal', W, H, `${chain}${data}${tick}${b1}${b2}${seal}`, tags);
}

// ---------------------------------------------------------------------------------------------------------------------
// Act 5. Two ways in: path B, a signature a producer takes into the next block within seconds, and path C, an
// operation in your own Bitcoin transaction that every producer must include once it has its confirmations; a block
// that leaves it out is invalid.

export function doorScene(t) {
  const W = 800;
  const H = 600;
  const FY = 176;
  const R = 13;
  const X = (i) => 70 + i * 66;
  const appear = [0.02, 0.06, 0.1, 0.16, 0.24, 0.32, 0.42, 0.52, 0.74, 0.86, 0.92];
  const B = 2;
  const C = 8;
  let lane = '';
  for (let i = 0; i <= 10; i++) {
    const a = appear[i];
    if (i) lane += line(X(i - 1) + R, FY, X(i) - R, FY, 'edge', `data-draw="${span(a - 0.02, a + 0.005)}"`);
    lane += blk(X(i), FY, R, i === C ? 'blk--forced' : '', `data-in="${span(a, a + 0.03)}"`);
  }
  // The block that left the path C operation out: built on the same parent, and invalid.
  const rogue = `<g class="rogue" data-fade="${span(0.66, 0.7)}">${line(X(C - 1) + 9, FY - 9, X(C) - 10, FY - 66, 'edge edge--rogue')}${blk(X(C), FY - 76, R, 'blk--rogue')}</g>`;
  const cross = `${line(X(C) - 15, FY - 91, X(C) + 15, FY - 61, 'cross', `data-draw="${span(0.78, 0.81)}"`)}${line(X(C) + 15, FY - 91, X(C) - 15, FY - 61, 'cross', `data-draw="${span(0.8, 0.83)}"`)}`;

  const BY = 474;
  const S = 50;
  const bx = [110, 250, 390, 530, 670];
  const bAt = [0, 0, 0.5, 0.58, 0.86];
  let chain = '';
  for (let k = 0; k < bx.length; k++) {
    if (k) chain += line(bx[k - 1] + S / 2, BY, bx[k] - S / 2, BY, 'link', bAt[k] ? `data-fade="${span(bAt[k], bAt[k] + 0.03)}"` : '');
    chain += btc(bx[k], BY, S, '', bAt[k] ? `data-in="${span(bAt[k], bAt[k] + 0.03)}"` : '');
  }

  // Path B: a signature, into block B within seconds.
  const sig = `<g class="sig" ${moves([
    [0.04, 24, 60],
    [0.2, X(B) - 40, 92],
    [0.26, X(B), FY],
  ])} data-fade="${span(0.04, 0.07)}"><circle class="op-glow" cx="${X(B)}" cy="${FY}" r="14"/><circle class="op-dot op-dot--b" cx="${X(B)}" cy="${FY}" r="6.5"/></g>`;
  const ringB = `<circle class="ring" cx="${X(B)}" cy="${FY}" r="${R + 8}" data-in="${span(0.26, 0.3)}"/>`;
  // Path C: your Bitcoin transaction, into Bitcoin block 1, then forced into block C.
  const tx = `<rect class="ctx" x="${bx[1] - 10}" y="${BY - 10}" width="20" height="20" rx="3" ${moves([
    [0.34, 24, 560],
    [0.46, bx[1], BY],
  ])} data-fade="${span(0.34, 0.37)}"/>`;
  const force = curve(bx[1] + 6, BY - S / 2 - 6, X(C), FY + R + 6, 'force', `data-draw="${span(0.62, 0.73)}"`, 0.6);
  const inC = `<rect class="ctx ctx--in" x="${X(C) - 5}" y="${FY - 5}" width="10" height="10" rx="1.5" data-in="${span(0.73, 0.76)}"/>`;

  const tags = [
    tag(W, H, 24, 30, t.signature, { at: 'l', anim: `data-fade="${span(0.04, 0.08)}"` }),
    tag(W, H, X(B), FY + 50, t.pathB, { anim: `data-fade="${span(0.27, 0.31)}"` }),
    tag(W, H, 24, 588, t.tx, { at: 'l', anim: `data-fade="${span(0.34, 0.38)}"` }),
    tag(W, H, (bx[2] + bx[3]) / 2, BY - 52, t.confirms, { anim: `data-fade="${span(0.52, 0.56)}"` }),
    tag(W, H, (bx[1] + X(C)) / 2 + 40, 338, t.forced, { anim: `data-fade="${span(0.66, 0.7)}"` }),
    tag(W, H, X(C) - 26, FY - 76, t.invalid, { at: 'r', cls: 'tag--warn', anim: `data-fade="${span(0.8, 0.84)}"` }),
  ];
  return scene('door', W, H, `${chain}${force}<g class="lane">${lane}</g>${rogue}${cross}${ringB}${sig}${tx}${inC}`, tags);
}

// ---------------------------------------------------------------------------------------------------------------------
// Act 6. Rebuilt from Bitcoin alone: the Ksana nodes go dark and the fast lane with them; the indexer, talking only to
// bitcoind, reads each block's data back from Bitcoin, executes it and checks its state root.

export function rebuildScene(t) {
  const W = 800;
  const H = 640;
  const nodes = [
    [118, 92],
    [252, 152],
    [384, 78],
    [516, 156],
    [650, 92],
    [176, 238],
    [452, 246],
    [692, 226],
  ];
  const mesh = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [0, 5],
    [1, 5],
    [1, 6],
    [3, 6],
    [4, 7],
    [3, 7],
    [5, 6],
    [6, 7],
  ];
  const dark = (k) => `data-out="${span(0.05 + k * 0.025, 0.1 + k * 0.025)} 0.12"`;
  let net = '';
  mesh.forEach(([a, b], k) => (net += line(nodes[a][0], nodes[a][1], nodes[b][0], nodes[b][1], 'p2p', dark(k * 0.6))));
  nodes.forEach(([x, y], k) => {
    net += `<path class="node" d="${ensoPath(x, y, 13, 100, 300, 4.4, 40, 0)}" ${dark(k)}/>`;
  });

  const LY = 372;
  const R = 11;
  const N = 12;
  const X = (i) => 102 + i * 54.2;
  const BY = 566;
  const S = 54;
  const bx = [126, 242, 358, 474, 590, 706];
  let ghost = '';
  let rebuilt = '';
  for (let i = 0; i < N; i++) {
    if (i) ghost += line(X(i - 1) + R, LY, X(i) - R, LY, 'edge');
    ghost += blk(X(i), LY, R);
    const a = 0.4 + i * 0.035;
    const k = Math.min(bx.length - 1, Math.floor(i / 2));
    rebuilt += curve(bx[k] + (i % 2 ? 10 : -10), BY - S / 2 - 4, X(i), LY + R + 5, 'rise', `data-draw="${span(a - 0.035, a)}"`, 0.5);
    if (i) rebuilt += line(X(i - 1) + R, LY, X(i) - R, LY, 'edge', `data-draw="${span(a, a + 0.02)}"`);
    rebuilt += blk(X(i), LY, R, 'blk--rebuilt', `data-in="${span(a, a + 0.03)}"`);
    rebuilt += check(X(i), LY - 30, 12, 'tick tick--small', `data-draw="${span(a + 0.02, a + 0.04)}"`);
  }
  let chain = '';
  for (let k = 0; k < bx.length; k++) {
    if (k) chain += line(bx[k - 1] + S / 2, BY, bx[k] - S / 2, BY, 'link');
    chain += btc(bx[k], BY, S);
  }

  const tags = [
    tag(W, H, 400, 30, t.nodes, { anim: `data-out="${span(0.24, 0.3)} 0.45"` }),
    tag(W, H, X(0) - R, LY + 48, t.indexer, { at: 'l', anim: `data-fade="${span(0.34, 0.38)}"` }),
    tag(W, H, X(N - 1) + R, LY - 62, t.roots, { at: 'r', anim: `data-fade="${span(0.86, 0.9)}"` }),
  ];
  return scene('rebuild', W, H, `<g class="net">${net}</g><g class="ghost" data-out="${span(0.12, 0.3)}">${ghost}</g>${chain}<g class="rebuilt">${rebuilt}</g>`, tags);
}
