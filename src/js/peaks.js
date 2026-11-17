// The snow peaks behind the first screen, set in type. scripts/make-peaks.mjs draws the mountains into a small picture
// (how bright the ground is, how far, how much of it shows through the mist); here every cell of a grid of monospace
// glyphs reads the picture where it lies and becomes a character: the denser the darker in daylight, the denser the
// brighter at night, with slashes and underscores along the skylines. Mist drifts across the mountains' feet and a
// little snow falls, where motion is welcome. Without this script the first screen is the same page without a backdrop.
//
// <canvas data-peaks data-src="…peaks.png" data-at=".dial" data-summit="0 -0.1" data-span="3.4">: the summit stands at
// the middle of the element data-at names, moved by data-summit times that element's width, and the whole picture is
// data-span times as wide as it. data-ebb="0.42 0.64" lets the mountains dissolve between those two distances below the
// element's middle, again in its widths. Without data-at the numbers are fractions of the canvas itself.
// The canvas's own style gives the rest: font-size the size of a glyph, color the ink, --peaks-tint the second color,
// --peaks-mode whether shade is ink (daylight) or light is glow (night), and --peaks-crest, where it is set, the color
// of the first sun on the lit snow of the summit.

const RAMP = ' .·:;-=+*x#%@';
const FPS = 10;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function hash(x, y) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** The picture's pixels and where its highest summit is. */
async function load(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
  for (let y = 0; y < height; y++) {
    let from = -1;
    let to = -1;
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 1] === 255) continue;
      if (from < 0) from = x;
      to = x;
    }
    if (from >= 0) return { data, width, height, sx: (from + to + 1) / 2, sy: y };
  }
  throw new Error('an empty picture');
}

export async function peaks(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const pic = await load(canvas.dataset.src);
  try {
    await document.fonts.load(`${getComputedStyle(canvas).fontSize} ${getComputedStyle(canvas).fontFamily}`);
  } catch {}
  const at = canvas.dataset.at ? document.querySelector(canvas.dataset.at) : null;
  const [dx, dy] = (canvas.dataset.summit || '0.5 0.3').split(' ').map(Number);
  const span = Number(canvas.dataset.span || 1.4);
  const [e0, e1] = (canvas.dataset.ebb || '').split(' ').map(Number);

  // the grid: for each cell how much of the ground shows, the shade or the light it carries, how much of the first sun
  // it catches, the character of a skyline or 0, how high it stands in the picture and a number of its own for the
  // order it appears in
  let cols = 0;
  let rows = 0;
  let cw = 0;
  let ch = 0;
  let size = 0;
  let cover = new Float32Array(0);
  let value = new Float32Array(0);
  let crest = new Float32Array(0);
  let line = new Uint8Array(0);
  let high = new Float32Array(0);
  let rank = new Float32Array(0);
  let glow = false;
  let inks = ['#000', '#000', ''];
  let flakes = [];
  let born = 0;

  function sample(bx, by, out) {
    const { data, width, height } = pic;
    if (bx < 0 || by < 0 || bx > width - 1 || by > height - 1) {
      out[0] = 0;
      out[1] = 1;
      out[2] = 0;
      return;
    }
    const x0 = Math.floor(bx);
    const y0 = Math.floor(by);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const fx = bx - x0;
    const fy = by - y0;
    const p = (x, y, k) => data[(y * width + x) * 4 + k];
    const mix = (k) => (p(x0, y0, k) * (1 - fx) + p(x1, y0, k) * fx) * (1 - fy) + (p(x0, y1, k) * (1 - fx) + p(x1, y1, k) * fx) * fy;
    out[0] = mix(0) / 255;
    out[1] = p(fx < 0.5 ? x0 : x1, fy < 0.5 ? y0 : y1, 1) / 255;
    out[2] = mix(2) / 255;
  }

  function layout() {
    const box = canvas.getBoundingClientRect();
    const w = box.width;
    const h = box.height;
    if (!w || !h) return false;
    const style = getComputedStyle(canvas);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    size = parseFloat(style.fontSize) || 10;
    ctx.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
    ctx.textBaseline = 'middle';
    cw = ctx.measureText('M'.repeat(64)).width / 64;
    ch = Math.round(size * 1.18);
    cols = Math.ceil(w / cw);
    rows = Math.ceil(h / ch);
    glow = style.getPropertyValue('--peaks-mode').trim() === 'glow';
    inks = [style.color, style.getPropertyValue('--peaks-tint').trim() || style.color, style.getPropertyValue('--peaks-crest').trim()];

    // where the summit stands and how many pixels of the screen one pixel of the picture takes
    let px = dx * w;
    let py = dy * h;
    let scale = (span * w) / pic.width;
    let ebbFrom = e0 * h;
    let ebbTo = e1 * h;
    if (at) {
      const r = at.getBoundingClientRect();
      px = r.left - box.left + r.width / 2 + dx * r.width;
      py = r.top - box.top + r.height / 2 + dy * r.width;
      scale = (span * r.width) / pic.width;
      ebbFrom = r.top - box.top + r.height / 2 + e0 * r.width;
      ebbTo = r.top - box.top + r.height / 2 + e1 * r.width;
    }

    const n = cols * rows;
    cover = new Float32Array(n);
    value = new Float32Array(n);
    crest = new Float32Array(n);
    line = new Uint8Array(n);
    high = new Float32Array(n);
    rank = new Float32Array(n);
    const far = new Float32Array(n);
    const s = [0, 0, 0];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const bx = pic.sx + ((c + 0.5) * cw - px) / scale;
        let bright = 0;
        let shown = 0;
        // a cell is taller than it is wide: the mean of its upper and lower half
        for (const k of [0.25, 0.75]) {
          sample(bx, pic.sy + ((r + k) * ch - py) / scale, s);
          bright += s[0] / 2;
          shown += s[2] / 2;
        }
        sample(bx, pic.sy + ((r + 0.5) * ch - py) / scale, s);
        far[i] = s[1];
        cover[i] = ebbTo > ebbFrom ? shown * (1 - smooth(ebbFrom, ebbTo, (r + 0.5) * ch)) : shown;
        value[i] = glow ? 0.06 + 0.94 * bright : 1 - 0.92 * bright;
        // the sun reaches the summit first: the lit snow of the picture's upper part below it
        const below = ((r + 0.5) * ch - py) / scale / (pic.height - pic.sy);
        crest[i] = inks[2] ? smooth(0.42, 0.78, bright) * (1 - smooth(0.05, 0.3, below)) : 0;
        high[i] = clamp((pic.sy + ((r + 0.5) * ch - py) / scale) / pic.height);
        rank[i] = hash(c, r);
      }
    }
    // skylines: a cell whose upper neighbor is sky or ground much farther away, drawn as the slope it is part of
    const near = (i, j) => j >= 0 && j < n && cover[j] > 0.06 && Math.abs(far[j] - far[i]) < 0.03;
    for (let r = 0; r < rows; r++) {
      for (let c = 1; c < cols - 1; c++) {
        const i = r * cols + c;
        if (cover[i] <= 0.06) continue;
        const up = r ? far[i - cols] : 1;
        if (up - far[i] < 0.03) continue;
        const ul = r > 0 && near(i, i - cols - 1);
        const ur = r > 0 && near(i, i - cols + 1);
        const l = near(i, i - 1);
        const rt = near(i, i + 1);
        let glyph = '^';
        if (ul && ur) glyph = '.';
        else if (ul) glyph = '\\';
        else if (ur) glyph = '/';
        else if (l && rt) glyph = '_';
        else if (l) glyph = '\\';
        else if (rt) glyph = '/';
        line[i] = glyph.charCodeAt(0);
      }
    }
    flakes = [];
    for (let k = Math.round((cols * rows) / 520); k > 0; k--) flakes.push({ x: Math.random() * cols, y: Math.random() * rows, v: 0.5 + Math.random(), k: Math.random() });
    return true;
  }

  // Nine runs of text per row: three inks at three strengths.
  const LEVELS = [0.4, 0.68, 1];
  const buckets = Array.from({ length: 9 }, () => []);

  function draw(now) {
    const t = now / 1000;
    const shown = reduce.matches ? 1 : clamp((now - born) / 2600);
    const w = canvas.width;
    ctx.clearRect(0, 0, w, canvas.height);
    for (let r = 0; r < rows; r++) {
      let any = false;
      for (const b of buckets) b.length = 0;
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        let a = cover[i];
        let glyph = ' ';
        let k = -1;
        if (a > 0.05) {
          // the mist: veils that drift to the right, thick at the mountains' feet and thin at the summit
          const veil = smooth(0.42, 0.78, noise(c * 0.021 - t * 0.016, r * 0.085 + t * 0.004) * 0.7 + noise(c * 0.06 - t * 0.03, r * 0.2) * 0.3);
          a *= 1 - veil * smooth(0.12, 0.62, high[i]) * 0.92;
          // the mountains come out of the mist from the top down, cell by cell
          if (shown < 1) a *= smooth(0, 0.22, shown * 1.25 - (0.55 * high[i] + 0.3 * rank[i]));
          const v = a * value[i];
          if (line[i] && a > 0.3) {
            glyph = String.fromCharCode(line[i]);
            k = glow ? (a > 0.5 ? 2 : 1) : a > 0.62 ? 2 : a > 0.3 ? 1 : 0;
          } else {
            // a cell in a hundred changes its character each frame, so that the picture breathes
            const grain = hash(i, Math.floor(t * FPS)) < 0.012 ? hash(i, Math.floor(t * FPS) + 7) : rank[i];
            const sunlit = crest[i] > 0.2 + 0.7 * rank[i];
            // by day the sunlit snow is drawn as light, the denser the brighter, where the rest is drawn as shade
            const w = sunlit && !glow ? a * (0.3 + 0.7 * crest[i]) : v;
            const j = Math.round(Math.pow(w, glow ? 0.8 : 0.72) * (RAMP.length - 1) + (grain - 0.5) * 1.1);
            if (j > 0) {
              glyph = RAMP[Math.min(RAMP.length - 1, j)];
              const level = a > 0.66 ? 2 : a > 0.33 ? 1 : 0;
              k = sunlit ? 6 + level : glow ? (value[i] > 0.5 ? level : 3 + level) : v > 0.36 ? level : 3 + level;
            }
          }
        }
        for (let b = 0; b < 9; b++) buckets[b].push(b === k ? glyph : ' ');
        if (k >= 0) any = true;
      }
      if (!any) continue;
      const y = (r + 0.5) * ch;
      for (let b = 0; b < 9; b++) {
        const text = buckets[b].join('').trimEnd();
        if (!text) continue;
        ctx.fillStyle = inks[Math.floor(b / 3)];
        ctx.globalAlpha = LEVELS[b % 3];
        ctx.fillText(text, 0, y);
      }
    }
    // the snow
    if (!reduce.matches) {
      ctx.fillStyle = inks[0];
      for (const f of flakes) {
        const x = Math.floor(f.x + Math.sin(t * 0.6 + f.k * 40) * 1.5);
        const y = Math.floor(f.y);
        ctx.globalAlpha = (0.16 + 0.3 * f.k) * shown;
        ctx.fillText(f.k > 0.8 ? '*' : f.k > 0.4 ? '·' : '.', x * cw, (y + 0.5) * ch);
        f.y += f.v * 0.18;
        f.x += 0.05;
        if (f.y > rows) {
          f.y = 0;
          f.x = Math.random() * cols;
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // Frames ---------------------------------------------------------------------------------------------------------------
  let ready = false;
  let visible = true;
  let timer = 0;
  let last = 0;

  function frame(now) {
    timer = 0;
    if (!ready || !visible || document.hidden) return;
    if (now - last >= 1000 / FPS - 4) {
      last = now;
      draw(now);
    }
    if (!reduce.matches) timer = requestAnimationFrame(frame);
  }

  function wake() {
    if (!timer) timer = requestAnimationFrame(frame);
  }

  function again() {
    ready = layout();
    last = 0;
    wake();
  }

  born = performance.now();
  again();
  canvas.classList.add('is-drawn');
  const sizes = new ResizeObserver(again);
  sizes.observe(canvas);
  if (at) sizes.observe(at);
  const seen = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) wake();
  });
  seen.observe(canvas);
  document.addEventListener('visibilitychange', wake);
  // the theme: the reader's choice on the root element, or the system's
  const theme = new MutationObserver(again);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  const dark = matchMedia('(prefers-color-scheme: dark)');
  dark.addEventListener('change', again);
  reduce.addEventListener('change', again);

  // for a page that takes the canvas away again
  return () => {
    ready = false;
    if (timer) cancelAnimationFrame(timer);
    sizes.disconnect();
    seen.disconnect();
    theme.disconnect();
    document.removeEventListener('visibilitychange', wake);
    dark.removeEventListener('change', again);
    reduce.removeEventListener('change', again);
  };
}

for (const canvas of document.querySelectorAll('canvas[data-peaks]')) peaks(canvas).catch(() => {});
