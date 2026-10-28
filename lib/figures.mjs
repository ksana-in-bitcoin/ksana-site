// Drawings, as inline SVG so that they take the page's colors in both schemes. Text that must stay readable on a phone
// is HTML laid over or under a drawing, never SVG text scaled down with it.

import { ensoPath } from './render.mjs';
import { escapeHtml } from './util.mjs';

const f = (n) => Number(n.toFixed(2));

// ---------------------------------------------------------------------------------------------------------------------
// Status marks, the shape language of certainty (src/components/Status.tsx of ksana-web): a circle for the instant, a square for
// what is written, the same square with a check once it has six Bitcoin confirmations (D-116), and the vermilion seal
// with a meander border for what is final.

export function mark(kind, size = 24, cls = 'mark') {
  const s = size;
  const c = s / 2;
  let body = '';
  if (kind === 'pending') body = `<circle cx="${c}" cy="${c}" r="${f(c - s * 0.08)}" fill="none" stroke="var(--ink-3)" stroke-width="${f(s * 0.07)}" stroke-dasharray="${f(s * 0.14)} ${f(s * 0.1)}"/>`;
  if (kind === 'fast') body = `<circle cx="${c}" cy="${c}" r="${f(c - s * 0.06)}" fill="var(--qing)"/>`;
  if (kind === 'btc') body = `<rect x="${f(s * 0.08)}" y="${f(s * 0.08)}" width="${f(s * 0.84)}" height="${f(s * 0.84)}" rx="${f(s * 0.06)}" fill="var(--mo)"/>`;
  if (kind === 'deep') body = `<rect x="${f(s * 0.08)}" y="${f(s * 0.08)}" width="${f(s * 0.84)}" height="${f(s * 0.84)}" rx="${f(s * 0.06)}" fill="var(--mo)"/><path d="M${f(s * 0.27)} ${f(s * 0.52)}L${f(s * 0.43)} ${f(s * 0.68)}L${f(s * 0.73)} ${f(s * 0.36)}" fill="none" stroke="var(--on-ink)" stroke-width="${f(Math.max(1.3, s * 0.1))}" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (kind === 'final') body = sealShape(c, c, s * 0.92, -8);
  return `<svg class="${cls} ${cls}--${kind}" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" aria-hidden="true">${body}</svg>`;
}

/** The vermilion seal: a square with an inner border and a small meander (square spiral) inside. */
export function sealShape(cx, cy, size, rotate = -8) {
  const h = size / 2;
  const x = cx - h;
  const y = cy - h;
  const inset = size * 0.14;
  const ix = x + inset;
  const iy = y + inset;
  const is = size - 2 * inset;
  const sw = Math.max(0.8, size * 0.055);
  // A square spiral: in from the top-left corner of the inner box, turning clockwise three times.
  const u = is / 5;
  const sp = [
    [ix + u, iy + u],
    [ix + 4 * u, iy + u],
    [ix + 4 * u, iy + 4 * u],
    [ix + 2 * u, iy + 4 * u],
    [ix + 2 * u, iy + 2 * u],
    [ix + 3 * u, iy + 2 * u],
    [ix + 3 * u, iy + 3 * u],
  ];
  const spiral = size >= 18 ? `<path d="M${sp.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}" fill="none" stroke="var(--on-zhu)" stroke-width="${f(sw)}" stroke-linecap="square"/>` : '';
  return `<g transform="rotate(${rotate} ${f(cx)} ${f(cy)})"><rect x="${f(x)}" y="${f(y)}" width="${f(size)}" height="${f(size)}" rx="${f(size * 0.08)}" fill="var(--zhu)"/><rect x="${f(ix)}" y="${f(iy)}" width="${f(is)}" height="${f(is)}" rx="${f(size * 0.02)}" fill="none" stroke="var(--on-zhu)" stroke-width="${f(sw)}"/>${spiral}</g>`;
}

// ---------------------------------------------------------------------------------------------------------------------
// The hero: a large ensō in one stroke with dry-brush streaks in its tail, the seal in its gap, and a ring of 120 ticks
// (120 fast-lane blocks of 5 s make one Bitcoin block of 10 min). landing.js lights the ticks; the stroke draws itself.

export function heroDial(label) {
  const C = 260;
  const R = 166;
  const W = 34;
  const START = 100;
  const SWEEP = 300;
  const stroke = ensoPath(C, C, R, START, SWEEP, W, 240, 4.2);

  // The centre line the reveal mask follows (butt caps, so it uncovers exactly the stroke drawn so far).
  const arc = (r, a0, a1) => {
    const p = (a) => [C + r * Math.cos((a * Math.PI) / 180), C + r * Math.sin((a * Math.PI) / 180)];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M ${f(x0)} ${f(y0)} A ${r} ${r} 0 ${large} 1 ${f(x1)} ${f(y1)}`;
  };
  const reveal = arc(R, START - 6, START + SWEEP + 2);

  // Flying white: thin gaps along the stroke where the brush runs dry, only over the last part of the sweep.
  const streaks = [
    { dr: -6.5, w: 1.3, from: 0.5, to: 1, dash: '38 9 22 14 54 7 31 12' },
    { dr: -2, w: 0.9, from: 0.62, to: 1, dash: '24 16 41 6 18 22' },
    { dr: 2.5, w: 1.6, from: 0.56, to: 0.97, dash: '52 11 17 8 36 19' },
    { dr: 6.5, w: 1.1, from: 0.7, to: 1, dash: '15 9 33 13 21 6' },
    { dr: 10, w: 0.8, from: 0.45, to: 0.8, dash: '29 21 12 9' },
  ]
    .map((s) => `<path d="${arc(R + s.dr, START + SWEEP * s.from, START + SWEEP * s.to)}" stroke-width="${s.w}" stroke-dasharray="${s.dash}"/>`)
    .join('');

  // The 120 ticks, from twelve o'clock clockwise; every twelfth (a minute) is longer.
  let ticks = '';
  for (let i = 0; i < 120; i++) {
    const a = ((i * 3 - 90) * Math.PI) / 180;
    const major = i % 12 === 0;
    const r0 = major ? 214 : 219;
    const r1 = 229;
    ticks += `<line class="tick${major ? ' tick--major' : ''}" x1="${f(C + r0 * Math.cos(a))}" y1="${f(C + r0 * Math.sin(a))}" x2="${f(C + r1 * Math.cos(a))}" y2="${f(C + r1 * Math.sin(a))}"/>`;
  }

  const sa = (70 * Math.PI) / 180;
  const sx = C + (R + 6) * Math.cos(sa);
  const sy = C + (R + 6) * Math.sin(sa);

  return `<svg class="dial" viewBox="0 0 520 520" role="img" aria-label="${escapeHtml(label)}">
<defs>
  <mask id="dial-dry" maskUnits="userSpaceOnUse" x="0" y="0" width="520" height="520"><rect width="520" height="520" fill="#fff"/><g fill="none" stroke="#000" stroke-linecap="round">${streaks}</g></mask>
  <mask id="dial-reveal" maskUnits="userSpaceOnUse" x="0" y="0" width="520" height="520"><path class="dial-reveal" d="${reveal}" fill="none" stroke="#fff" stroke-width="64" pathLength="1"/></mask>
</defs>
<g class="dial-ticks">${ticks}</g>
<circle class="dial-hand" cx="${C}" cy="${C - 236}" r="3.2"/>
<g mask="url(#dial-reveal)"><path class="dial-stroke" d="${stroke}" mask="url(#dial-dry)"/></g>
<g class="dial-seal">${sealShape(sx, sy, 40, -8)}</g>
</svg>`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Two rails: the fast lane's block DAG above, Bitcoin below, settlements falling from one to the other. Blocks are
// drawn in the state they would have at the right-hand edge: final (sealed) on the left, on Bitcoin (ink) in the
// middle, fast-confirmed (qing) at the tip. A wide drawing for wide screens and a compact one for phones, so that a
// phone sees all three states at a readable size instead of a shrunken copy.
//
// A block is final at the 11th confirmation of its data: decided at the 6th, reported once the Bitcoin block of that
// decision has 6 of its own (D-114). Seven Bitcoin blocks are drawn, and a break in both rails, after Bitcoin block 1
// and fast block `cut`, leaves out the five between them, so that the data in Bitcoin block 1 has 11 confirmations.

const FINAL_CONFS = 2 * 6 - 1;
const DRAWN = 7;
const SKIPPED = FINAL_CONFS - (DRAWN - 1);

const RAILS = {
  wide: {
    W: 1000, H: 306, fastY: 84, btcY: 244, r: 7, sq: 13, seal: 14, bb: 44, sideDy: 34, skipFont: 13,
    bx0: 80, bstep: 126, n: 31, step: 28, cut: 7, gap: 40,
    side: [6, 15, 24],
    settlements: [4, 9, 13, 18, 22, 26],
    anchors: [2, 11, 20, 28],
  },
  compact: {
    W: 560, H: 280, fastY: 76, btcY: 214, r: 7.5, sq: 14, seal: 15, bb: 36, sideDy: 30, skipFont: 17,
    bx0: 40, bstep: 70, n: 21, step: 23.4, cut: 4, gap: 26,
    side: [3, 10, 15],
    settlements: [2, 5, 8, 11, 14, 17],
    anchors: [1, 7, 13, 19],
  },
};

function railsSvg(kind) {
  const c = RAILS[kind];
  const { W, H, fastY, btcY } = c;
  // Both rails open a gap of `gap` at the break, which falls at the same x on each.
  const btc = [];
  for (let i = 0; i < DRAWN; i++) btc.push({ x: c.bx0 + i * c.bstep + (i > 1 ? c.gap : 0), i });
  const cutX = (btc[1].x + btc[2].x) / 2;
  const x0 = cutX - c.gap / 2 - (c.cut + 0.5) * c.step;
  const fast = [];
  for (let i = 0; i < c.n; i++) fast.push({ x: x0 + i * c.step + (i > c.cut ? c.gap : 0), i });
  // Parallel blocks found at nearly the same time, merged by the next block.
  const side = c.side.map((i) => ({ x: fast[i].x, y: fastY - c.sideDy, parent: i - 1, child: i + 1 }));
  // The blocks that carry a settlement, and the Bitcoin block it confirms in: settlement k lands in Bitcoin block k + 1.
  const settlements = c.settlements.map((from, k) => ({ from, to: k + 1 }));
  // State at the right-hand edge: data landed in Bitcoin block k has DRAWN − k confirmations, and the blocks the break
  // leaves out besides when k is 1; FINAL_CONFS make it final. The blocks just before the break settle into the
  // blocks it leaves out, which give them fewer, so they are on Bitcoin like the blocks of Bitcoin block 2.
  const stateOf = (i) => {
    const s = settlements.find((st) => i <= st.from);
    if (!s) return 'fast';
    return DRAWN - s.to + (s.to === 1 ? SKIPPED : 0) >= FINAL_CONFS ? 'final' : 'btc';
  };
  const half = c.bb / 2;

  // A rail's line from a to b, open where the break crosses it.
  const rail = (a, b, y) =>
    a < cutX && b > cutX
      ? `<line x1="${f(a)}" y1="${y}" x2="${f(cutX - 7)}" y2="${y}"/><line x1="${f(cutX + 7)}" y1="${y}" x2="${f(b)}" y2="${y}"/>`
      : `<line x1="${f(a)}" y1="${y}" x2="${f(b)}" y2="${y}"/>`;
  // The break itself: two short slanted strokes across the rail.
  const slashes = (y, h) =>
    [-5, 5].map((dx) => `<line x1="${f(cutX + dx - 3)}" y1="${y + h}" x2="${f(cutX + dx + 3)}" y2="${y - h}"/>`).join('');

  let edges = '';
  for (let i = 1; i < c.n; i++) edges += rail(fast[i - 1].x, fast[i].x, fastY);
  for (const s of side) {
    edges += `<line x1="${f(fast[s.parent].x)}" y1="${fastY}" x2="${f(s.x)}" y2="${s.y}"/><line x1="${f(s.x)}" y1="${s.y}" x2="${f(fast[s.child].x)}" y2="${fastY}"/>`;
  }
  edges += slashes(fastY, 7);
  let btcEdges = '';
  for (let i = 1; i < btc.length; i++) btcEdges += rail(btc[i - 1].x, btc[i].x, btcY);
  btcEdges += slashes(btcY, 9);
  const skip = `<text class="rails-skip" x="${f(cutX)}" y="${btcY + c.skipFont + 10}" font-size="${c.skipFont}" text-anchor="middle">+${SKIPPED}</text>`;

  // Anchors: a dotted line from a few fast blocks down to the Bitcoin block they saw.
  const anchors = c.anchors
    .map((i) => {
      const b = [...btc].reverse().find((bb) => bb.x < fast[i].x - 10) || btc[0];
      return `<path d="M ${f(fast[i].x)} ${fastY + 9} C ${f(fast[i].x)} ${fastY + 64}, ${b.x + 8} ${btcY - 74}, ${b.x + 8} ${btcY - half - 2}"/>`;
    })
    .join('');

  const threads = settlements
    .map((s, k) => {
      const a = fast[s.from];
      const b = btc[s.to];
      return `<path class="thread" style="--d:${k}" pathLength="1" d="M ${f(a.x)} ${fastY + 9} C ${f(a.x)} ${fastY + 84}, ${b.x - 6} ${btcY - 90}, ${b.x - 6} ${btcY - half - 2}"/>`;
    })
    .join('');

  const blockShape = (x, y, state, k) => {
    const d = `style="--d:${k}"`;
    if (state === 'fast') return `<circle class="fb fb--fast" ${d} cx="${f(x)}" cy="${y}" r="${c.r}"/>`;
    if (state === 'btc') return `<rect class="fb fb--btc" ${d} x="${f(x - c.sq / 2)}" y="${f(y - c.sq / 2)}" width="${c.sq}" height="${c.sq}" rx="1.4"/>`;
    return `<g class="fb fb--final" ${d}>${sealShape(x, y, c.seal, -8)}</g>`;
  };
  let blocks = '';
  fast.forEach((b) => (blocks += blockShape(b.x, fastY, stateOf(b.i), b.i)));
  side.forEach((s) => (blocks += blockShape(s.x, s.y, stateOf(s.child), s.child)));

  const btcBlocks = btc.map((b) => `<rect class="bb" style="--d:${b.i}" x="${b.x - half}" y="${btcY - half}" width="${c.bb}" height="${c.bb}" rx="3"/>`).join('');

  // Eleven confirmations: a vermilion bracket under Bitcoin block 1, the blocks the break leaves out and blocks 2 to 6.
  const by = btcY + half + 14;
  const bracket = `<path class="bracket" d="M ${btc[1].x - half} ${by - 6} V ${by} H ${btc[DRAWN - 1].x + half} V ${by - 6}"/>`;

  return `<svg class="rails-svg rails-svg--${kind}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
<g class="rails-anchors">${anchors}</g>
<g class="rails-edges">${edges}</g>
<g class="rails-btc-edges">${btcEdges}</g>
<g class="rails-threads">${threads}</g>
<g class="rails-blocks">${blocks}</g>
<g class="rails-btc">${btcBlocks}</g>
${skip}
${bracket}
</svg>`;
}

/** The rails with their labels and legend in HTML. `t` holds the figure strings of the page's language. */
export function railsFigure(t) {
  const thread = '<svg class="legend-thread" viewBox="0 0 18 14" aria-hidden="true"><path d="M2 1c0 7 14 5 14 12"/></svg>';
  return `<div class="rails">
<p class="rails-lane"><b>${escapeHtml(t.fastLane)}</b><span>${escapeHtml(t.every5s)}</span></p>
${railsSvg('wide')}${railsSvg('compact')}
<p class="rails-lane rails-lane--btc"><b>${escapeHtml(t.bitcoin)}</b><span>${escapeHtml(t.every10m)}</span></p>
<ul class="rails-legend">
  <li>${mark('fast', 14)}<span>${escapeHtml(t.fast)}</span><span class="legend-time">${escapeHtml(t.fastTime)}</span></li>
  <li>${mark('btc', 14)}<span>${escapeHtml(t.onBtc)}</span><span class="legend-time">${escapeHtml(t.onBtcTime)}</span></li>
  <li>${mark('final', 16)}<span>${escapeHtml(t.final)}</span><span class="legend-time">${escapeHtml(t.finalTime)}</span></li>
  <li>${thread}<span>${escapeHtml(t.settlement)}</span></li>
</ul>
</div>`;
}

// ---------------------------------------------------------------------------------------------------------------------
// KSA issued over time on mainnet (SPEC §8.6): linear within each halving period, the periods 2, 4, then 8 years long.

export const SUPPLY_POINTS = (() => {
  const yearsPerDaa = 5 / (365.25 * 86400);
  const pts = [[0, 0]];
  let daa = 0;
  let issued = 0;
  for (let k = 0; k < 12; k++) {
    const len = 12_500_000 * 2 ** Math.min(k, 2);
    const reward = 4.2 / 2 ** k;
    daa += len;
    issued += (len * reward) / 1e6;
    pts.push([daa * yearsPerDaa, issued]);
  }
  return pts;
})();

/** The issuance curve with its axis labels in HTML (crisp at any width). `t` holds the figure strings. */
export function supplyFigure(t) {
  const W = 480;
  const H = 260;
  const pad = { l: 2, r: 8, t: 8, b: 2 };
  const maxYears = 40;
  const maxM = 220;
  const sx = (y) => pad.l + (y / maxYears) * (W - pad.l - pad.r);
  const sy = (m) => H - pad.b - (m / maxM) * (H - pad.t - pad.b);
  const pts = [];
  for (const [yr, m] of SUPPLY_POINTS) {
    if (yr <= maxYears) pts.push([yr, m]);
    else {
      const [py, pm] = pts[pts.length - 1];
      pts.push([maxYears, pm + ((m - pm) * (maxYears - py)) / (yr - py)]);
      break;
    }
  }
  const line = pts.map(([y, m], i) => `${i ? 'L' : 'M'} ${f(sx(y))} ${f(sy(m))}`).join(' ');
  const area = `${line} L ${f(sx(maxYears))} ${f(sy(0))} L ${f(sx(0))} ${f(sy(0))} Z`;
  const grid = [50, 100, 150, 200].map((m) => `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${f(sy(m))}" y2="${f(sy(m))}"/>`).join('');
  const halvings = pts
    .slice(1, -1)
    .map(([y, m]) => `<circle class="halving" cx="${f(sx(y))}" cy="${f(sy(m))}" r="3.6"/>`)
    .join('');
  const pct = (v, total) => `${f((v / total) * 100)}%`;
  const yTicks = [0, 50, 100, 150, 200]
    .map((m) => `<span class="supply-tick supply-tick--y" style="left:${pct(sx(0), W)};top:${pct(sy(m), H)}">${m}</span>`)
    .join('');
  const xTicks = [0, 10, 20, 30, 40]
    .map((y) => `<span class="supply-tick supply-tick--x" style="left:${pct(sx(y), W)};top:${pct(sy(0), H)}">${y}</span>`)
    .join('');
  const svg = `<svg class="supply-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
<defs>
  <linearGradient id="supply-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--ink)" stop-opacity="0.14"/><stop offset="1" stop-color="var(--ink)" stop-opacity="0.02"/></linearGradient>
</defs>
${grid}
<line class="cap" x1="${pad.l}" x2="${W - pad.r}" y1="${f(sy(210))}" y2="${f(sy(210))}"/>
<path class="area" d="${area}" fill="url(#supply-fill)"/>
<path class="line" d="${line}"/>
<line class="baseline" x1="${pad.l}" x2="${W - pad.r}" y1="${f(sy(0))}" y2="${f(sy(0))}"/>
${halvings}
</svg>`;
  return `<div class="supply">
<p class="supply-top label">${escapeHtml(t.supplyAxis)}</p>
<div class="supply-plot">${svg}${yTicks}${xTicks}</div>
<p class="supply-axis-x label">${escapeHtml(t.yearsAxis)}</p>
<ul class="supply-legend">
  <li><span class="key key--line"></span>${escapeHtml(t.supply)}</li>
  <li><span class="key key--dot"></span>${escapeHtml(t.halving)}</li>
  <li><span class="key key--cap"></span>${escapeHtml(t.cap)}</li>
</ul>
</div>`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Line icons for the reasons on the landing page, 32 × 32.

const POINT_ICONS = {
  rebuild: '<rect x="11" y="11" width="10" height="10" rx="1"/><path d="M6.5 13.5A10 10 0 0 1 24 8.5M25.5 18.5A10 10 0 0 1 8 23.5"/><path d="M24.5 4.5v4.3h-4.3M7.5 27.5v-4.3h4.3"/>',
  nobridge: '<path d="M3 22h7M22 22h7M6 22V17M26 22V17"/><path d="M6 17c3-4 6-6 8-6.6M26 17c-3-4-6-6-8-6.6"/><path d="m14.5 8 1.5 4-1.6 2.6 1.2 3"/>',
  wallet: '<circle cx="11" cy="16" r="5.5"/><path d="M16.5 16H28M24 16v4.5M28 16v3.5"/><circle cx="11" cy="16" r="1.6"/>',
  door: '<path d="M8 28V4.5h12V28"/><path d="M4 28h24"/><path d="M14 16h13M23 12l4 4-4 4"/>',
  cpu: '<rect x="9" y="9" width="14" height="14" rx="1.5"/><rect x="13" y="13" width="6" height="6" rx=".5"/><path d="M13 9V5M19 9V5M13 27v-4M19 27v-4M9 13H5M9 19H5M27 13h-4M27 19h-4"/>',
  contract: '<path d="M11 9 5 16l6 7M21 9l6 7-6 7M18 7l-4 18"/>',
};

export function pointIcon(name) {
  return `<svg class="point-icon" width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${POINT_ICONS[name]}</svg>`;
}

// ---------------------------------------------------------------------------------------------------------------------
// The drawings the docs place with `::: figure <name>`. Each takes the language's figure strings. They are laid out in
// HTML (boxes, lists, grids) with the marks as small SVGs, so that every label stays text at its own size on a phone.

const h = (s) => escapeHtml(s);

/** The three marks of an operation in order, the six confirmations before the last (D-116), and what each one means. */
export function marksFigure(t) {
  const m = t.marks;
  const step = (kind, name, time, text) => `<li class="marks-step marks-step--${kind}">
  <span class="marks-icon">${mark(kind, kind === 'final' ? 30 : 26)}</span>
  <span class="marks-time">${h(time)}</span>
  <b class="marks-name">${h(name)}</b>
  <span class="marks-text">${h(text)}</span>
</li>`;
  return `<ol class="marks">
${step('fast', t.fast, t.fastTime, m.fast)}
${step('btc', t.onBtc, t.onBtcTime, m.onBtc)}
${step('deep', t.deep, m.deepTime, m.deep)}
${step('final', t.final, m.finalTime, m.final)}
</ol>`;
}

/** Path B beside path C: how an operation gets in, step by step. */
export function pathsFigure(t) {
  const p = t.paths;
  const lane = (kind, name, tag, steps, facts) => `<section class="lane lane--${kind}">
  <header class="lane-head">${mark(kind === 'b' ? 'fast' : 'btc', 18)}<b>${h(name)}</b><span class="lane-tag">${h(tag)}</span></header>
  <ol class="lane-steps">${steps.map((s) => `<li>${h(s)}</li>`).join('')}</ol>
  <ul class="lane-facts">${facts.map((s) => `<li>${h(s)}</li>`).join('')}</ul>
</section>`;
  return `<div class="lanes">
${lane('b', p.b, p.bTag, p.bSteps, p.bFacts)}
${lane('c', p.c, p.cTag, p.cSteps, p.cFacts)}
</div>`;
}

/** A settlement: the commit transaction and the reveal transaction that spends its commitment output. */
export function settlementFigure(t) {
  const x = t.settle;
  const row = (n, label, sub, cls = '') => `<li class="tx-io${cls ? ` tx-io--${cls}` : ''}"><span class="tx-n">${h(n)}</span><span class="tx-what">${h(label)}${sub ? `<small>${h(sub)}</small>` : ''}</span></li>`;
  const commit = `<section class="tx tx--commit">
  <header class="tx-head"><b>${h(x.commit)}</b><span>${h(x.commitSub)}</span></header>
  <p class="tx-side">${h(x.inputs)}</p>
  <ul class="tx-list">${row('in', x.funding, x.fundingSub)}</ul>
  <p class="tx-side">${h(x.outputs)}</p>
  <ul class="tx-list">${row('0', x.change, '')}${row('1', x.commitment, x.commitmentSub, 'hot')}</ul>
</section>`;
  const reveal = `<section class="tx tx--reveal">
  <header class="tx-head"><b>${h(x.reveal)}</b><span>${h(x.revealSub)}</span></header>
  <p class="tx-side">${h(x.inputs)}</p>
  <ul class="tx-list">${row('in', x.spends, '', 'hot')}</ul>
  <div class="tx-witness">
    <p class="tx-side">${h(x.witness)}</p>
    <ol class="witness">
      <li>${h(x.signature)}</li>
      <li class="witness-leaf"><span>${h(x.leaf)}</span><span class="envelope"><b>KSN1</b>${h(x.envelope)}</span></li>
      <li>${h(x.control)}</li>
    </ol>
  </div>
  <p class="tx-side">${h(x.outputs)}</p>
  <ul class="tx-list">${row('0', x.anchor, x.anchorSub)}${row('1', x.opReturn, x.opReturnSub)}</ul>
</section>`;
  const link = `<div class="tx-link" aria-hidden="true"><svg viewBox="0 0 40 24"><path d="M2 12h34M28 5l8 7-8 7"/></svg><span>${h(x.link)}</span></div>`;
  return `<div class="settle">${commit}${link}${reveal}</div>`;
}

/** Who talks to whom: apps to nodes, nodes to each other and to Bitcoin, the indexer to Bitcoin alone. */
export function architectureFigure(t) {
  const a = t.arch;
  const node = `<span class="arch-node">${ensoIcon()}<span>${h(a.node)}</span></span>`;
  return `<div class="arch">
  <section class="arch-box arch-apps"><b>${h(a.apps)}</b><span>${h(a.appsSub)}</span></section>
  <div class="arch-link arch-l1"><span>${h(a.rpc)}</span></div>
  <section class="arch-box arch-nodes"><b>${h(a.nodes)}</b><span>${h(a.nodesSub)}</span>
    <span class="arch-mesh">${node}<i>${h(a.p2p)}</i>${node}<i>${h(a.p2p)}</i>${node}</span></section>
  <div class="arch-link arch-l2 arch-link--both"><span>${h(a.nodesBtc)}</span></div>
  <section class="arch-box arch-btc"><b>${h(a.bitcoin)}</b><span>${h(a.bitcoinSub)}</span></section>
  <div class="arch-link arch-l3"><span>${h(a.indexerBtc)}</span></div>
  <section class="arch-box arch-indexer"><b>${h(a.indexer)}</b><span>${h(a.indexerSub)}</span><span class="arch-check">${mark('final', 14)}${h(a.stateRoot)}</span></section>
</div>`;
}

function ensoIcon() {
  return `<svg class="arch-enso" viewBox="0 0 24 24" aria-hidden="true"><path d="${ensoPath(12, 12, 7.2, 100, 300, 2.6, 24, 0)}"/><rect x="14.6" y="14.6" width="4.6" height="4.6" rx="0.6" transform="rotate(-8 16.9 16.9)"/></svg>`;
}

export const docsFigures = {
  rails: (t) => railsFigure(t),
  supply: (t) => supplyFigure(t),
  marks: marksFigure,
  settlement: settlementFigure,
  paths: pathsFigure,
  architecture: architectureFigure,
};
