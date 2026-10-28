// Page templates: the document shell, the top bar, the footer, the docs layout and the search dialog.

import { escapeHtml, relUrl } from './util.mjs';

// ---------------------------------------------------------------------------------------------------------------------
// The ensō mark (the web wallet's Brand.tsx): one brush stroke that starts full and dries out, and a vermilion seal.

export function ensoPath(cx, cy, r, startDeg, sweepDeg, wMax, n = 72, wobbleAmp = 0.28) {
  const outer = [];
  const inner = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const f = t < 0.08 ? 0.82 + 2.25 * t : 1 - 0.8 * Math.pow((t - 0.08) / 0.92, 1.4);
    const w = wMax * f;
    const wobble = wobbleAmp * Math.sin(t * Math.PI * 3.2);
    const a = ((startDeg + sweepDeg * t) * Math.PI) / 180;
    outer.push([cx + (r + wobble + w / 2) * Math.cos(a), cy + (r + wobble + w / 2) * Math.sin(a)]);
    inner.push([cx + (r + wobble - w / 2) * Math.cos(a), cy + (r + wobble - w / 2) * Math.sin(a)]);
  }
  const fmt = (p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  const capR = (wMax * 0.82) / 2;
  let d = `M ${fmt(outer[0])}`;
  for (let i = 1; i < outer.length; i++) d += ` L ${fmt(outer[i])}`;
  for (let i = inner.length - 1; i >= 0; i--) d += ` L ${fmt(inner[i])}`;
  d += ` A ${capR.toFixed(2)} ${capR.toFixed(2)} 0 0 1 ${fmt(outer[0])} Z`;
  return d;
}

const MARK_PATH = ensoPath(16, 16, 11, 100, 300, 3.6);
const SEAL = (() => {
  const a = (70 * Math.PI) / 180;
  return { x: 16 + 11 * Math.cos(a), y: 16 + 11 * Math.sin(a) };
})();

/** The favicon: the mark in ink, paper-colored on a dark browser theme, with its vermilion seal. */
export function faviconSvg() {
  const { x, y } = SEAL;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>path{fill:#16201f}@media (prefers-color-scheme:dark){path{fill:#e2ebe8}}</style><path d="${MARK_PATH}"/><rect x="${(x - 3.1).toFixed(2)}" y="${(y - 3.1).toFixed(2)}" width="6.2" height="6.2" rx="0.8" fill="#c03a22" transform="rotate(-8 ${x.toFixed(2)} ${y.toFixed(2)})"/></svg>\n`;
}

export function ensoMark(size = 28) {
  const { x, y } = SEAL;
  return `<svg class="enso-mark" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><path d="${MARK_PATH}" fill="currentColor"/><rect x="${(x - 3.1).toFixed(2)}" y="${(y - 3.1).toFixed(2)}" width="6.2" height="6.2" rx="0.8" fill="var(--zhu)" transform="rotate(-8 ${x.toFixed(2)} ${y.toFixed(2)})"/></svg>`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Icons: 20 × 20, drawn with currentColor.

const ICON = {
  search: '<circle cx="9" cy="9" r="5.5"/><path d="m13.2 13.2 3.8 3.8"/>',
  sun: '<circle cx="10" cy="10" r="3.4"/><path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3 6 14M14 6l1.3-1.3"/>',
  moon: '<path d="M15.8 12.6A6.6 6.6 0 0 1 7.4 4.2a6.6 6.6 0 1 0 8.4 8.4Z"/>',
  menu: '<path d="M3.5 6h13M3.5 10h13M3.5 14h13"/>',
  close: '<path d="m5 5 10 10M15 5 5 15"/>',
  arrowRight: '<path d="M4 10h11.5M11 5.5l4.5 4.5-4.5 4.5"/>',
  arrowLeft: '<path d="M16 10H4.5M9 5.5 4.5 10 9 14.5"/>',
  external: '<path d="M8 4.5H5a1 1 0 0 0-1 1V15a1 1 0 0 0 1 1h9.5a1 1 0 0 0 1-1v-3M11.5 4h4.5v4.5M16 4l-7 7"/>',
  github:
    '<path d="M10 2.2a7.9 7.9 0 0 0-2.5 15.4c.4.1.5-.2.5-.4v-1.4c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.9.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-3.9 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.5 7.5 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3-1.8 3.7-3.6 3.9.3.3.5.8.5 1.5v2.2c0 .2.1.5.6.4A7.9 7.9 0 0 0 10 2.2Z" fill="currentColor" stroke="none"/>',
  // Discord's mark, from Simple Icons (CC0): 24 units wide, drawn 16 wide.
  discord:
    '<path transform="translate(2 2) scale(0.6667)" d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" fill="currentColor" stroke="none"/>',
  globe: '<circle cx="10" cy="10" r="7"/><path d="M3 10h14M10 3c2 2.2 2.9 4.5 2.9 7S12 14.8 10 17c-2-2.2-2.9-4.5-2.9-7S8 5.2 10 3Z"/>',
};

export function icon(name, cls = 'icon') {
  return `<svg class="${cls}" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
}

// ---------------------------------------------------------------------------------------------------------------------

/** A site path made relative to the page. */
function href(page, path) {
  return relUrl(page.path, path, page.preview);
}

/** The signet's wallet and explorer, asked to open in the page's language: unasked, it opens in English. */
export function walletHref(page) {
  const url = page.site.signet.wallet;
  return page.lang === 'en' ? url : `${url}?lang=${page.langAttr}`;
}

/** The contract playground (D-119), asked for the page's language the same way. */
export function playgroundHref(page) {
  const url = page.site.playground;
  return page.lang === 'en' ? url : `${url}?lang=${page.langAttr}`;
}

/** The one inline script: the theme chosen on an earlier visit, applied before the page paints (hashed into the CSP). */
export const THEME_SCRIPT = "try{var t=localStorage.getItem('ksana-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}";

function head(page) {
  const { ui, site, assets } = page;
  const title = page.kind === 'landing' ? page.title : `${page.title} · Ksana`;
  const canonical = site.origin + page.path;
  const alternates = Object.entries(page.alternates)
    .map(([code, path]) => {
      const lang = site.languages.find((l) => l.code === code).lang;
      return `<link rel="alternate" hreflang="${lang}" href="${site.origin}${path}">`;
    })
    .join('');
  const preloads = assets.preload.map((f) => `<link rel="preload" href="${href(page, f)}" as="font" type="font/woff2" crossorigin>`).join('');
  return [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`,
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="claude:viewport-fit-sides" content="cover">`,
    `<meta name="description" content="${escapeHtml(page.description)}">`,
    page.noindex ? `<meta name="robots" content="noindex">` : `<link rel="canonical" href="${canonical}">`,
    alternates,
    page.alternates.en ? `<link rel="alternate" hreflang="x-default" href="${site.origin}${page.alternates.en}">` : '',
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Ksana">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(page.description)}">`,
    `<meta property="og:url" content="${canonical}">`,
    assets.ogImage ? `<meta property="og:image" content="${site.origin}${assets.ogImage}">` : '',
    assets.ogImage ? `<meta property="og:image:width" content="${assets.ogImageSize.width}"><meta property="og:image:height" content="${assets.ogImageSize.height}">` : '',
    `<meta property="og:locale" content="${page.langAttr.replace('-', '_')}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="theme-color" content="#f1f4f3" media="(prefers-color-scheme: light)">`,
    `<meta name="theme-color" content="#0d1314" media="(prefers-color-scheme: dark)">`,
    `<link rel="icon" href="${href(page, assets.favicon)}" type="image/svg+xml">`,
    assets.touchIcon ? `<link rel="apple-touch-icon" href="${href(page, assets.touchIcon)}">` : '',
    preloads,
    `<link rel="stylesheet" href="${href(page, assets.css)}">`,
    `<script>${THEME_SCRIPT}</script>`,
    `<script type="module" src="${href(page, assets.js)}"></script>`,
    page.kind === 'landing' ? `<script type="module" src="${href(page, assets.landingJs)}"></script>` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function topbar(page) {
  const { ui, site } = page;
  const home = page.lang === 'en' ? '/' : '/zh/';
  const docs = page.lang === 'en' ? '/docs/' : '/zh/docs/';
  const other = page.otherLanguage;
  const isDocs = page.kind === 'docs';
  const links = [
    `<a class="topnav-link" href="${href(page, docs)}"${isDocs ? ' aria-current="true"' : ''}>${escapeHtml(ui.nav.docs)}</a>`,
    `<a class="topnav-link" href="${walletHref(page)}" rel="noopener">${escapeHtml(ui.nav.wallet)}</a>`,
    `<a class="topnav-link" href="${playgroundHref(page)}" rel="noopener">${escapeHtml(ui.nav.playground)}</a>`,
    `<a class="topnav-link" href="${site.repo}" rel="noopener">${escapeHtml(ui.nav.github)}</a>`,
  ].join('');
  const lang = other
    ? `<a class="lang-switch" href="${href(page, other.path)}" hreflang="${other.lang}" lang="${other.lang}" title="${escapeHtml(other.ui.languageName)}">${icon('globe')}<span>${escapeHtml(other.ui.languageShort)}</span></a>`
    : '';
  return `<header class="topbar">
<div class="topbar-inner">
  <a class="wordmark" href="${href(page, home)}" aria-label="${escapeHtml(ui.nav.home)}">${ensoMark(28)}<span>Ksana</span></a>
  <nav class="topnav" aria-label="${escapeHtml(ui.nav.label)}">${links}</nav>
  <div class="topbar-tools">
    <button class="search-open" type="button" aria-label="${escapeHtml(ui.search.button)}" aria-keyshortcuts="/">${icon('search')}<span class="search-open-label">${escapeHtml(ui.search.button)}</span><kbd>/</kbd></button>
    <a class="icon-btn topbar-discord" href="${site.discord}" rel="noopener" aria-label="${escapeHtml(ui.nav.discord)}" title="${escapeHtml(ui.nav.discord)}">${icon('discord')}</a>
    ${lang}
    <button class="icon-btn theme-toggle" type="button" data-to-light="${escapeHtml(ui.theme.toLight)}" data-to-dark="${escapeHtml(ui.theme.toDark)}" aria-label="${escapeHtml(ui.theme.toDark)}">${icon('moon', 'icon icon-moon')}${icon('sun', 'icon icon-sun')}</button>
    <button class="icon-btn menu-toggle" type="button" aria-label="${escapeHtml(ui.menu)}" aria-expanded="false" aria-controls="drawer">${icon('menu')}</button>
  </div>
</div>
</header>`;
}

function footer(page) {
  const { ui, site } = page;
  const p = (path) => href(page, (page.lang === 'en' ? '' : '/zh') + path);
  const col = (title, items) =>
    `<div class="foot-col"><p class="foot-title">${escapeHtml(title)}</p><ul>${items.map(([label, url]) => `<li><a href="${url}"${url.startsWith('http') ? ' rel="noopener"' : ''}>${escapeHtml(label)}</a></li>`).join('')}</ul></div>`;
  const f = ui.footer;
  return `<footer class="site-foot">
<div class="foot-inner">
  <div class="foot-brand">
    <a class="wordmark" href="${p('/')}">${ensoMark(28)}<span>Ksana</span></a>
    <p class="foot-tagline">${escapeHtml(ui.tagline)}</p>
    <p class="foot-note">${f.note}</p>
  </div>
  <div class="foot-cols">
    ${col(f.learn, [
      [f.links.howItWorks, p('/docs/how-it-works/')],
      [f.links.confirmations, p('/docs/confirmations/')],
      [f.links.ksa, p('/docs/ksa/')],
      [f.links.faq, p('/docs/faq/')],
    ])}
    ${col(f.build, [
      [f.links.quickstart, p('/docs/quickstart/')],
      [f.links.sdk, p('/docs/sdk/')],
      [f.links.contracts, p('/docs/contracts/')],
      [f.links.playground, playgroundHref(page)],
      [f.links.rpc, p('/docs/rpc/')],
    ])}
    ${col(f.network, [
      [f.links.wallet, walletHref(page)],
      [f.links.signet, p('/docs/signet/')],
      [f.links.node, p('/docs/run-a-node/')],
      [f.links.indexer, p('/docs/run-an-indexer/')],
    ])}
    ${col(f.project, [
      [f.links.github, site.repo],
      [f.links.discord, site.discord],
      [f.links.spec, `${site.repo}/blob/main/docs/SPEC.md`],
      [f.links.security, p('/docs/security/')],
    ])}
  </div>
</div>
<div class="foot-base"><p>${escapeHtml(f.base)}</p></div>
</footer>`;
}

function searchDialog(page) {
  const { ui } = page;
  return `<div class="search" id="search" hidden>
  <div class="search-scrim" data-close></div>
  <div class="search-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(ui.search.button)}">
    <div class="search-bar">${icon('search')}<input type="search" placeholder="${escapeHtml(ui.search.placeholder)}" autocomplete="off" spellcheck="false" aria-controls="search-results" aria-label="${escapeHtml(ui.search.placeholder)}"><button class="search-esc" type="button" data-close>Esc</button></div>
    <ul class="search-results" id="search-results" role="listbox" aria-label="${escapeHtml(ui.search.results)}"></ul>
    <p class="search-status" aria-live="polite" data-empty="${escapeHtml(ui.search.empty)}" data-loading="${escapeHtml(ui.search.loading)}" data-failed="${escapeHtml(ui.search.failed)}">${escapeHtml(ui.search.hint)}</p>
  </div>
</div>`;
}

/** The drawer for small screens: the top links, and on docs pages the docs navigation. */
function drawer(page, docsNav) {
  const { ui, site } = page;
  const docs = page.lang === 'en' ? '/docs/' : '/zh/docs/';
  return `<div class="drawer" id="drawer" hidden>
  <div class="drawer-scrim" data-close></div>
  <div class="drawer-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(ui.menu)}">
    <div class="drawer-head"><a class="wordmark" href="${href(page, page.lang === 'en' ? '/' : '/zh/')}">${ensoMark(26)}<span>Ksana</span></a><button class="icon-btn" type="button" data-close aria-label="${escapeHtml(ui.close)}">${icon('close')}</button></div>
    <nav class="drawer-links" aria-label="${escapeHtml(ui.nav.label)}">
      <a href="${href(page, docs)}">${escapeHtml(ui.nav.docs)}</a>
      <a href="${walletHref(page)}" rel="noopener">${escapeHtml(ui.nav.wallet)}${icon('external', 'icon icon-sm')}</a>
      <a href="${playgroundHref(page)}" rel="noopener">${escapeHtml(ui.nav.playground)}${icon('external', 'icon icon-sm')}</a>
      <a href="${site.repo}" rel="noopener">${escapeHtml(ui.nav.github)}${icon('external', 'icon icon-sm')}</a>
      <a href="${site.discord}" rel="noopener">${escapeHtml(ui.nav.discord)}${icon('external', 'icon icon-sm')}</a>
    </nav>
    ${docsNav || ''}
  </div>
</div>`;
}

/** The docs navigation: sections with their pages, the current page marked. */
export function docsNavHtml(page, nav) {
  return nav
    .map(
      (section) => `<div class="nav-section"><p class="nav-title">${escapeHtml(section.title)}</p><ul>${section.pages
        .map((p) => `<li><a href="${href(page, p.path)}"${p.path === page.path ? ' aria-current="page"' : ''}>${escapeHtml(p.nav)}</a></li>`)
        .join('')}</ul></div>`,
    )
    .join('');
}

function tocHtml(page, headings) {
  const items = headings.filter((h) => h.level === 2 || h.level === 3);
  if (items.length < 2) return '';
  const html = (h) => h.html.replace(/<\/?a\b[^>]*>/g, '');
  return `<ul>${items.map((h) => `<li class="toc-l${h.level}"><a href="#${h.id}">${html(h)}</a></li>`).join('')}</ul>`;
}

export function docsBody(page, { nav, section, html, headings, prev, next }) {
  const { ui } = page;
  const navHtml = docsNavHtml(page, nav);
  const toc = tocHtml(page, headings);
  const pager = (dir, p) =>
    p
      ? `<a class="pager-link pager-${dir}" href="${href(page, p.path)}" rel="${dir}"><span class="pager-dir">${dir === 'prev' ? icon('arrowLeft', 'icon icon-sm') : ''}${escapeHtml(dir === 'prev' ? ui.prev : ui.next)}${dir === 'next' ? icon('arrowRight', 'icon icon-sm') : ''}</span><span class="pager-title">${escapeHtml(p.nav)}</span></a>`
      : '<span></span>';
  return {
    drawerNav: `<nav class="drawer-docs" aria-label="${escapeHtml(ui.nav.docs)}">${navHtml}</nav>`,
    main: `<div class="docs">
  <aside class="sidebar"><nav class="sidebar-nav" aria-label="${escapeHtml(ui.nav.docs)}">${navHtml}</nav></aside>
  <main id="main" class="docs-main">
    <article class="doc">
      <header class="doc-head">
        <p class="eyebrow">${escapeHtml(section)}</p>
        <h1>${escapeHtml(page.title)}</h1>
        ${page.lede ? `<p class="lede">${page.lede}</p>` : ''}
      </header>
      ${toc ? `<details class="toc-inline"><summary>${escapeHtml(ui.onThisPage)}</summary>${toc}</details>` : ''}
      <div class="prose">
${html}
      </div>
      <nav class="pager" aria-label="${escapeHtml(ui.pager)}">${pager('prev', prev)}${pager('next', next)}</nav>
    </article>
    ${toc ? `<aside class="toc" aria-label="${escapeHtml(ui.onThisPage)}"><p class="toc-title">${escapeHtml(ui.onThisPage)}</p>${toc}</aside>` : ''}
  </main>
</div>`,
  };
}

/** The whole page. In preview mode the root page leaves out the document skeleton, which the preview host adds. */
export function documentHtml(page, { main, drawerNav = '', bodyClass }) {
  const searchUrl = href(page, page.assets.search);
  const body = `<a class="skip" href="#main">${escapeHtml(page.ui.skip)}</a>
${topbar(page)}
${main}
${footer(page)}
${drawer(page, drawerNav)}
${searchDialog(page)}`;
  const attrs = `class="${bodyClass}" data-root="${href(page, '/')}" data-search="${searchUrl}"${page.preview ? ' data-preview="1"' : ''}`;
  if (page.bare) {
    // The preview host wraps this page in its own document; the language and the body's data go on a wrapper.
    return `${head(page)}
<div lang="${page.langAttr}" id="page" ${attrs}>
${body}
</div>
<script>document.documentElement.lang=${JSON.stringify(page.langAttr)}</script>
`;
  }
  return `<!doctype html>
<html lang="${page.langAttr}">
<head>
${head(page)}
</head>
<body ${attrs}>
${body}
</body>
</html>
`;
}
