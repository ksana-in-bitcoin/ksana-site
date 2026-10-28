#!/usr/bin/env node
// The site's two raster images, drawn by a headless Chromium from the site's own fonts, colors and dial:
//   src/img/og.png                the picture a link to the site shows in chats and posts (1200 × 630 at twice the density)
//   src/img/apple-touch-icon.png  the site's icon on a phone's home screen (180 × 180)
//
//   npm install --no-save playwright-core@1.56.1 && npx playwright-core install --only-shell chromium
//   node scripts/make-images.mjs           (KSANA_BROWSER=<a Chromium executable> uses that browser instead)
//
// Both images are committed; run this again when the brand, the hero's title or the dial changes.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import landing from '../content/en/landing.mjs';
import { heroDial } from '../lib/figures.mjs';
import { ensoMark } from '../lib/render.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMG = path.join(ROOT, 'src/img');

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('playwright-core is not installed: npm install --no-save playwright-core@1.56.1');
  process.exit(1);
}

// The site, built into a temporary directory for its stylesheet and fonts, and served from there.
const out = mkdtempSync(path.join(tmpdir(), 'ksana-images-'));
execFileSync(process.execPath, ['build.mjs', '--out', out], { cwd: ROOT, stdio: 'ignore' });
const css = readdirSync(path.join(out, 'assets')).find((f) => /^site\..+\.css$/.test(f));
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  try {
    const file = path.join(out, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(out)) throw new Error('outside');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const page = (body, style) => `<!doctype html>
<html lang="en" data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="/assets/${css}"><style>${style}</style></head>
<body>${body}</body></html>`;

// The dial as the landing page shows it two minutes after a Bitcoin block: 24 of its 120 five-second ticks lit, the
// hand on the newest one.
const LIT = 24;
let tick = 0;
const dial = heroDial(landing.hero.dialLabel)
  .replace(/<line class="tick( tick--major)?"/g, (all, major) => {
    const n = tick++;
    const state = n < LIT - 1 ? ' is-on' : n === LIT - 1 ? ' is-new' : '';
    return `<line class="tick${major || ''}${state}"`;
  })
  .replace('<circle class="dial-hand"', `<circle class="dial-hand" style="transform: rotate(${(LIT - 1) * 3}deg)"`);

const og = page(
  `<main class="og">
  <div class="og-text">
    <p class="og-brand">${ensoMark(46)}<span>Ksana</span></p>
    <h1 class="hero-title og-title">${landing.hero.title}</h1>
    <p class="og-foot">ksana.network</p>
  </div>
  <div class="og-art">${dial}</div>
</main>`,
  `html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: var(--bg); }
  .og { box-sizing: border-box; width: 1200px; height: 630px; padding: 64px 56px 60px 76px; display: grid;
        grid-template-columns: 1fr 500px; align-items: center; }
  .og-text { display: flex; flex-direction: column; height: 100%; justify-content: space-between; }
  .og-brand { display: flex; align-items: center; gap: 14px; margin: 0; font-family: var(--font-serif); font-weight: 600;
              font-size: 38px; letter-spacing: -0.01em; color: var(--ink); }
  .og-title { margin: 0; font-size: 82px; line-height: 1.02; }
  .og-foot { margin: 0; font-family: var(--font-mono); font-size: 22px; letter-spacing: 0.04em; color: var(--ink-3); }
  .og-art { width: 500px; }`,
);

const icon = page(
  `<main class="icon">${ensoMark(140)}</main>`,
  `html, body { margin: 0; width: 180px; height: 180px; overflow: hidden; background: var(--bg); }
  .icon { width: 180px; height: 180px; display: grid; place-items: center; color: var(--ink); }`,
);

writeFileSync(path.join(out, 'og.html'), og);
writeFileSync(path.join(out, 'icon.html'), icon);

const launch = process.env.KSANA_BROWSER ? { executablePath: process.env.KSANA_BROWSER } : {};
const browser = await chromium.launch(launch);
try {
  for (const [name, file, width, height, scale] of [
    ['og.png', 'og.html', 1200, 630, 2],
    ['apple-touch-icon.png', 'icon.html', 180, 180, 1],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, reducedMotion: 'reduce', colorScheme: 'light' });
    const tab = await context.newPage();
    await tab.goto(`${origin}/${file}`, { waitUntil: 'networkidle' });
    await tab.evaluate(() => document.fonts.ready);
    await tab.screenshot({ path: path.join(IMG, name), omitBackground: false });
    await context.close();
    console.log(`src/img/${name}: ${width * scale} × ${height * scale}`);
  }
} finally {
  await browser.close();
  server.close();
  rmSync(out, { recursive: true, force: true });
}
