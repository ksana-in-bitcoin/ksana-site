#!/usr/bin/env node
// The generator of ksana.network: the landing page and the docs, in English and Chinese.
//
//   node build.mjs              the site, into dist/ (what the Cloudflare Worker serves, wrangler.jsonc)
//   node build.mjs --preview    a preview into dist-preview/: links relative to each page, the home page without its
//                               document skeleton (the preview host adds one)
//   node build.mjs --check      the site, then the checks: links and anchors, the site's own absolute links and those of
//                               the contract reference included; links to the signet's web page in each page's language;
//                               code blocks marked from="<path>" the same as that file of the core submodule; the text files
//                               beyond ASCII given their charset in _headers; Chinese only under content/zh/; the two
//                               languages' pages and headings in step; the Chinese heading font covering the headings
//   node build.mjs --serve      the site, served at http://127.0.0.1:4321 and built again on every change
//   node build.mjs --serif-text the text the Chinese pages set in the serif face (scripts/subset-zh-serif.py reads it)
//   --out <dir>                 with any of the above: write there instead

import { createHash } from 'node:crypto';
import { existsSync, watch } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { initHighlighter } from './lib/highlight.mjs';
import { CJK, escapeHtml, hashOf, outFile, stripTags } from './lib/util.mjs';
import { woff2CodePoints } from './lib/woff2.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
/** The Ksana repository, pinned as the git submodule core/: code blocks marked from="<path>" and the contract reference are
 * read from it */
const REPO = path.join(ROOT, 'core');
/** The contract reference for AI assistants, published as /llms-contracts.txt (D-124) */
const REFERENCE = 'playground/src/ai/ksana-contracts.md';
const args = new Set(process.argv.slice(2));
const PREVIEW = args.has('--preview');
const CHECK = args.has('--check');
const SERVE = args.has('--serve');
const SERIF_TEXT = args.has('--serif-text');
const outAt = process.argv.indexOf('--out');
const OUT = outAt > 0 && process.argv[outAt + 1] ? path.resolve(process.argv[outAt + 1]) : path.join(ROOT, PREVIEW ? 'dist-preview' : 'dist');

let generation = 0;

/** Imports a module afresh (the server builds again after edits). */
async function load(file) {
  const url = pathToFileURL(path.join(ROOT, file)).href;
  return (await import(SERVE ? `${url}?v=${generation}` : url)).default;
}

async function loadLib() {
  const v = SERVE ? `?v=${generation}` : '';
  const lib = (name) => import(pathToFileURL(path.join(ROOT, 'lib', name)).href + v);
  const [markdown, render, landing, figures, llms] = await Promise.all([lib('markdown.mjs'), lib('render.mjs'), lib('landing.mjs'), lib('figures.mjs'), lib('llms.mjs')]);
  return { ...markdown, ...render, ...landing, ...figures, ...llms };
}

async function write(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
}

function warn(message) {
  console.warn(`warning: ${message}`);
}

// Assets -------------------------------------------------------------------------------------------------------------

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

async function buildAssets(lib, problems) {
  const assets = { preload: {} };
  const put = async (name, data, ext) => {
    const file = `/assets/${name}.${hashOf(data, 10)}.${ext}`;
    await write(path.join(OUT, file), data);
    return file;
  };

  // Fonts, named by their content.
  const fontDir = path.join(ROOT, 'src/fonts');
  const fonts = {};
  for (const name of (await readdir(fontDir)).filter((f) => f.endsWith('.woff2')).sort()) {
    const data = await readFile(path.join(fontDir, name));
    fonts[name] = await put(`fonts/${name.replace(/\.woff2$/, '')}`, data, 'woff2');
  }
  await write(path.join(OUT, 'assets/fonts/OFL.txt'), await readFile(path.join(fontDir, 'OFL.txt')));

  // One stylesheet, from src/css/ in file order.
  const cssDir = path.join(ROOT, 'src/css');
  let css = '';
  for (const name of (await readdir(cssDir)).filter((f) => f.endsWith('.css')).sort()) css += `${await readFile(path.join(cssDir, name), 'utf8')}\n`;
  css = css.replace(/@font-face\s*\{[^}]*\}/g, (rule) => {
    const name = (rule.match(/url\("fonts\/([^"]+)"\)/) || [])[1];
    if (!name) return rule;
    if (!fonts[name]) {
      problems.push(`src/css: font ${name} is missing from src/fonts/ (scripts/subset-zh-serif.py makes ksana-serif-sc.woff2)`);
      return '';
    }
    return rule.replace(`url("fonts/${name}")`, `url("${fonts[name].replace('/assets/', '')}")`);
  });
  assets.css = await put('site', minifyCss(css), 'css');

  assets.js = await put('site', await readFile(path.join(ROOT, 'src/js/site.js')), 'js');
  assets.landingJs = await put('landing', await readFile(path.join(ROOT, 'src/js/landing.js')), 'js');
  assets.favicon = await put('favicon', lib.faviconSvg(), 'svg');
  for (const [key, name] of [
    ['ogImage', 'og.png'],
    ['touchIcon', 'apple-touch-icon.png'],
  ]) {
    const file = path.join(ROOT, 'src/img', name);
    if (!existsSync(file)) {
      problems.push(`src/img/${name} is missing (scripts/make-images.mjs draws it)`);
      continue;
    }
    const data = await readFile(file);
    assets[key] = await put(name.replace('.png', ''), data, 'png');
    // a PNG's width and height, from its IHDR chunk
    assets[`${key}Size`] = { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  // The faces the first screen sets: the serif of the headings and the sans of the text; Chinese pages add theirs.
  const preload = ['serif-normal-200-900-latin.woff2', 'sans-normal-100-700-latin.woff2'].map((n) => fonts[n]);
  assets.preload.en = preload;
  assets.preload.zh = fonts['ksana-serif-sc.woff2'] ? [...preload, fonts['ksana-serif-sc.woff2']] : preload;
  assets.fonts = fonts;
  assets.put = put;
  return assets;
}

// Content ----------------------------------------------------------------------------------------------------------------

function docPath(lang, name) {
  return `${lang.prefix}/docs/${name === 'index' ? '' : `${name}/`}`;
}

/** Search entries of one rendered page: the page itself, then each section under an h2 or h3. */
function searchEntries(doc) {
  const html = doc.html
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<div class="code-head">[\s\S]*?<\/div>/g, ' ')
    .replace(/<button[\s\S]*?<\/button>/g, ' ')
    .replace(/<a class="h-anchor"[^>]*><\/a>/g, '');
  const entries = [{ page: doc.title, title: doc.title, url: doc.path, text: stripTags(doc.lede || '').slice(0, 400), depth: 0 }];
  const marks = [...html.matchAll(/<h([2-4]) id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)];
  const intro = stripTags(html.slice(0, marks.length ? marks[0].index : html.length));
  if (intro) entries[0].text = `${entries[0].text} ${intro}`.trim().slice(0, 1200);
  marks.forEach((m, i) => {
    const level = Number(m[1]);
    const end = i + 1 < marks.length ? marks[i + 1].index : html.length;
    const text = stripTags(html.slice(m.index + m[0].length, end)).slice(0, 1500);
    if (level === 4) {
      // h4 sections belong to the section above them
      const parent = entries[entries.length - 1];
      parent.text = `${parent.text} ${stripTags(m[3])} ${text}`.slice(0, 2400);
      return;
    }
    entries.push({ page: doc.title, title: stripTags(m[3]), url: `${doc.path}#${m[2]}`, text, depth: level - 1 });
  });
  return entries;
}

async function readDocs(lib, site, lang, ui, enDocs) {
  const md = lib.createMarkdown();
  const docs = new Map();
  const dir = path.join(ROOT, 'content', lang.code, 'docs');
  const figures = lib.docsFigures || {};
  for (const section of site.docs) {
    for (const name of section.pages) {
      const file = path.join(dir, `${name}.md`);
      if (!existsSync(file)) continue;
      const rel = path.relative(ROOT, file);
      const source = lib.substitute(await readFile(file, 'utf8'), site, rel);
      const { data, body } = lib.parseFrontMatter(source, rel);
      if (!data.title) throw new Error(`${rel}: no title in the front matter`);
      const pagePath = docPath(lang, name);
      const env = {
        lang: lang.code,
        ui,
        pagePath,
        prefix: lang.prefix,
        preview: PREVIEW,
        enIds: enDocs?.get(name)?.headings.map((h) => h.id),
        figures,
        config: site,
        links: [],
        sources: [],
        file: rel,
      };
      const html = md.render(body, env);
      const lede = data.lede ? md.renderInline(data.lede, env) : '';
      docs.set(name, {
        name,
        section: section.section,
        path: pagePath,
        title: data.title,
        nav: data.nav || data.title,
        description: data.description || stripTags(lede) || ui.description,
        lede,
        html,
        headings: env.headings,
        links: env.links,
        sources: env.sources,
        markdown: body,
        ledeMarkdown: data.lede || '',
        file: rel,
      });
    }
  }
  return docs;
}

// Pages ------------------------------------------------------------------------------------------------------------------

async function build() {
  generation++;
  const started = Date.now();
  const problems = [];
  const lib = await loadLib();
  const site = await load('site.config.mjs');
  await initHighlighter();
  await rm(OUT, { recursive: true, force: true });

  const languages = site.languages.filter((l) => existsSync(path.join(ROOT, 'content', l.code)));
  if (languages.length < site.languages.length) problems.push(`content: missing languages ${site.languages.filter((l) => !languages.includes(l)).map((l) => l.code).join(', ')}`);
  const content = {};
  for (const lang of languages) {
    content[lang.code] = {
      ui: await load(`content/${lang.code}/ui.mjs`),
      landing: await load(`content/${lang.code}/landing.mjs`),
    };
  }
  const en = languages.find((l) => l.code === 'en');
  const docs = {};
  docs.en = await readDocs(lib, site, en, content.en.ui, null);
  for (const lang of languages) if (lang.code !== 'en') docs[lang.code] = await readDocs(lib, site, lang, content[lang.code].ui, docs.en);

  const assets = await buildAssets(lib, problems);
  const searchFiles = {};
  for (const lang of languages) {
    const entries = [...docs[lang.code].values()].flatMap(searchEntries);
    searchFiles[lang.code] = await assets.put(`search-${lang.code}`, JSON.stringify(entries), 'json');
  }

  const pages = [];
  const other = (lang) => languages.find((l) => l.code !== lang.code);
  const makePage = (lang, kind, pagePath, extra) => {
    const ui = content[lang.code].ui;
    const o = other(lang);
    return {
      kind,
      lang: lang.code,
      langAttr: lang.lang,
      prefix: lang.prefix,
      path: pagePath,
      ui,
      site,
      assets: { ...assets, preload: assets.preload[lang.code] || assets.preload.en, search: searchFiles[lang.code] },
      preview: PREVIEW,
      bare: PREVIEW && pagePath === '/',
      links: [],
      alternates: {},
      otherLanguage: o ? { path: `${o.prefix}/`, lang: o.lang, ui: content[o.code].ui } : null,
      ...extra,
    };
  };

  // The landing pages.
  for (const lang of languages) {
    const c = content[lang.code].landing;
    const page = makePage(lang, 'landing', `${lang.prefix}/`, { title: c.title, description: c.description });
    for (const l of languages) page.alternates[l.code] = `${l.prefix}/`;
    if (page.otherLanguage) page.otherLanguage.path = `${other(lang).prefix}/`;
    const main = lib.landingMain(page, c);
    pages.push({ page, html: lib.documentHtml(page, { main, bodyClass: 'page-landing' }) });
  }

  // The docs.
  for (const lang of languages) {
    const ui = content[lang.code].ui;
    const langDocs = docs[lang.code];
    const nav = site.docs
      .map((s) => ({ title: ui.sections[s.section], pages: s.pages.filter((n) => langDocs.has(n)).map((n) => ({ path: docPath(lang, n), nav: langDocs.get(n).nav })) }))
      .filter((s) => s.pages.length);
    const order = site.docs.flatMap((s) => s.pages).filter((n) => langDocs.has(n));
    for (const [i, name] of order.entries()) {
      const doc = langDocs.get(name);
      const page = makePage(lang, 'docs', doc.path, { title: doc.title, description: doc.description, lede: doc.lede });
      page.links = doc.links;
      for (const l of languages) if (docs[l.code].has(name)) page.alternates[l.code] = docPath(l, name);
      const o = other(lang);
      if (o) page.otherLanguage.path = docs[o.code].has(name) ? docPath(o, name) : `${o.prefix}/docs/`;
      const at = (k) => (k >= 0 && k < order.length ? { path: docPath(lang, order[k]), nav: langDocs.get(order[k]).nav } : null);
      const body = lib.docsBody(page, { nav, section: ui.sections[doc.section], html: doc.html, headings: doc.headings, prev: at(i - 1), next: at(i + 1) });
      pages.push({ page, html: lib.documentHtml(page, { main: body.main, drawerNav: body.drawerNav, bodyClass: 'page-docs' }), doc });
    }
  }

  // The 404 page (what the Worker answers for any path it has no file for): in English, with a line in each other language.
  if (!PREVIEW) {
    const ui = content.en.ui;
    const page = makePage(en, 'notfound', '/404.html', { title: ui.notFound.title, description: ui.notFound.text, noindex: true });
    const others = languages
      .filter((l) => l.code !== 'en' && content[l.code])
      .map((l) => {
        const t = content[l.code].ui.notFound;
        return `<p class="lost-alt" lang="${l.lang}">${escapeHtml(t.title)} · <a href="${l.prefix}/">${escapeHtml(t.home)}</a> · <a href="${l.prefix}/docs/">${escapeHtml(t.docs)}</a></p>`;
      })
      .join('');
    const main = `<main id="main" class="wrap lost">${lib.ensoMark(72)}<h1>${escapeHtml(ui.notFound.title)}</h1><p>${escapeHtml(ui.notFound.text)}</p><div class="hero-ctas"><a class="btn btn--ink" href="/">${escapeHtml(ui.notFound.home)}</a><a class="btn btn--line" href="/docs/">${escapeHtml(ui.notFound.docs)}</a></div>${others}</main>`;
    pages.push({ page, html: lib.documentHtml(page, { main, bodyClass: 'page-lost' }) });
  }

  for (const { page, html } of pages) await write(path.join(OUT, page.path === '/404.html' ? '404.html' : outFile(page.path)), html);

  if (!PREVIEW) {
    const listed = pages.filter((p) => !p.page.noindex);
    const urls = listed
      .map(({ page }) => {
        const alt = Object.entries(page.alternates)
          .map(([code, p]) => `<xhtml:link rel="alternate" hreflang="${site.languages.find((l) => l.code === code).lang}" href="${site.origin}${p}"/>`)
          .join('');
        return `<url><loc>${site.origin}${page.path}</loc>${alt}</url>`;
      })
      .join('\n');
    await write(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);
    await write(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.origin}/sitemap.xml\n`);
    await write(path.join(OUT, '_headers'), headers(lib, site));
  }

  // The files for AI assistants (D-124), in previews too: the docs are English, and every link in them is absolute.
  const files = ['/sitemap.xml', '/robots.txt'];
  const referenceFile = path.join(REPO, REFERENCE);
  if (existsSync(referenceFile)) {
    const reference = await readFile(referenceFile, 'utf8');
    for (const [name, text] of Object.entries(lib.llmsFiles({ site, docs: docs.en, ui: content.en.ui, reference }))) {
      await write(path.join(OUT, name), text);
      files.push(`/${name}`);
    }
  } else {
    problems.push(`core/${REFERENCE} is missing (git submodule update --init): the site publishes it as /llms-contracts.txt`);
  }

  if (SERIF_TEXT) return { pages, problems, site, languages, docs, serif: serifText(pages) };
  console.log(`built ${pages.length} pages into ${path.relative(process.cwd(), OUT) || '.'} in ${Date.now() - started} ms`);
  for (const p of problems) warn(p);
  return { pages, problems, site, languages, docs, assets, files };
}

/** Cloudflare Pages headers: long caching for the named-by-content assets, and a strict content security policy. */
function headers(lib, site) {
  const themeHash = createHash('sha256').update(lib.THEME_SCRIPT).digest('base64');
  const signetOrigin = new URL(site.signet.rpc).origin;
  // Cloudflare Web Analytics' beacon, which the zone's automatic setup adds to every page; it reports to /cdn-cgi/rum on the page's own origin (D-128).
  const analytics = 'https://static.cloudflareinsights.com';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'sha256-${themeHash}' ${analytics}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${signetOrigin}`,
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
  return `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  X-Frame-Options: DENY

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/llms.txt
  Content-Type: text/plain; charset=utf-8
  Access-Control-Allow-Origin: *

/llms-full.txt
  Content-Type: text/plain; charset=utf-8
  Access-Control-Allow-Origin: *

/llms-contracts.txt
  Content-Type: text/plain; charset=utf-8
  Access-Control-Allow-Origin: *
`;
}

// The serif text of the Chinese pages: headings, titles and the other places that use the heading face ----------------

const SERIF_SELECTORS = /<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>|<(p|span)\b[^>]*class="(?:foot-tagline|pager-title|chap-label)"[^>]*>([\s\S]*?)<\/\3>/g;

function serifText(pages) {
  let text = '';
  for (const { page, html } of pages) {
    if (page.lang === 'en') continue;
    const body = html.replace(/<svg[\s\S]*?<\/svg>/g, '');
    for (const m of body.matchAll(SERIF_SELECTORS)) text += stripTags(m[2] || m[4] || '');
    // the link titles of card grids and the stats are set in the serif too
    for (const m of body.matchAll(/<div class="cards">([\s\S]*?)<\/div>/g)) for (const a of m[1].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) text += stripTags(a[1]);
    for (const m of body.matchAll(/<dt>([\s\S]*?)<\/dt>/g)) text += stripTags(m[1]);
    // the landing page's quotation (D-125)
    for (const m of body.matchAll(/<blockquote class="beat-quote"><p>([\s\S]*?)<\/p>/g)) text += stripTags(m[1]);
    text += page.ui.tagline;
  }
  return text;
}

// Checks -----------------------------------------------------------------------------------------------------------------

async function walk(dir, skip) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full);
    if (skip.some((s) => rel === s || rel.startsWith(`${s}${path.sep}`))) continue;
    if (entry.isDirectory()) out.push(...(await walk(full, skip)));
    else out.push(full);
  }
  return out;
}

async function check(result) {
  const errors = [...result.problems];
  const { pages, languages, docs } = result;

  // Links and anchors.
  const ids = new Map();
  for (const { page, html } of pages) ids.set(page.path, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  for (const { page } of pages) {
    for (const link of page.links) {
      const [target, hash] = link.split('#');
      if (target.startsWith('/assets/')) continue;
      const known = ids.get(target);
      if (!known) errors.push(`${page.path}: link to a page that does not exist: ${link}`);
      else if (hash && !known.has(decodeURIComponent(hash))) errors.push(`${page.path}: link to an anchor that does not exist: ${link}`);
    }
  }

  // The site's own absolute links, in the pages and in the contract reference, name a page (and an anchor of it) or a
  // file the build writes.
  const files = new Set(result.files);
  const ownLink = (where, href) => {
    const url = new URL(href);
    if (url.origin !== result.site.origin) return;
    const known = ids.get(url.pathname);
    if (!known && !files.has(url.pathname)) errors.push(`${where}: link to a page that does not exist: ${href}`);
    else if (known && url.hash && !known.has(decodeURIComponent(url.hash.slice(1)))) errors.push(`${where}: link to an anchor that does not exist: ${href}`);
  };
  for (const { page, html } of pages) for (const [, href] of html.matchAll(/\shref="(https:[^"]+)"/g)) ownLink(page.path, href.replaceAll('&amp;', '&'));
  const referenceFile = path.join(REPO, REFERENCE);
  if (existsSync(referenceFile)) {
    const origin = result.site.origin.replace(/[.]/g, '\\.');
    for (const [href] of (await readFile(referenceFile, 'utf8')).matchAll(new RegExp(`${origin}/[^\\s)>\\]\`'"]*`, 'g'))) ownLink(REFERENCE, href.replace(/[.,;:]+$/, ''));
  }

  // A text file the build writes with any character beyond ASCII names its charset in _headers: Workers serve .txt as
  // text/plain without one, which browsers and many HTTP clients read as windows-1252 or Latin-1.
  const headerRules = new Map();
  let rule = null;
  for (const line of (await readFile(path.join(OUT, '_headers'), 'utf8')).split('\n')) {
    if (/^\S/.test(line)) headerRules.set((rule = line.trim()), []);
    else if (rule && line.trim()) headerRules.get(rule).push(line.trim().toLowerCase());
  }
  for (const file of result.files) {
    if (!file.endsWith('.txt') || !/[^\x00-\x7f]/.test(await readFile(path.join(OUT, file), 'utf8'))) continue;
    if (!headerRules.get(file)?.includes('content-type: text/plain; charset=utf-8')) {
      errors.push(`_headers: ${file} has text beyond ASCII but no Content-Type: text/plain; charset=utf-8`);
    }
  }

  // A code block marked from="<path>" is that file of the core submodule, or one of the code blocks of a Markdown file.
  for (const lang of languages) {
    for (const doc of docs[lang.code].values()) {
      for (const { from, code } of doc.sources) {
        const file = path.join(REPO, from);
        if (!existsSync(file)) {
          errors.push(`${doc.file}: a code block from ${from}, which does not exist`);
          continue;
        }
        const text = await readFile(file, 'utf8');
        const same = from.endsWith('.md')
          ? [...text.matchAll(/^(`{3,})[^\n]*\n([\s\S]*?)\n\1$/gm)].some((m) => m[2] === code)
          : text.replace(/\n$/, '') === code;
        if (!same) errors.push(`${doc.file}: a code block differs from ${from}: copy it again`);
      }
    }
  }

  // A page in another language asks the signet's web page, and the contract playground, for that language: unasked, they
  // open in English (D-115, D-119).
  const asked = new Map([[result.site.signet.wallet, "the signet's web page"], [result.site.playground, 'the contract playground']]);
  for (const { page, html } of pages) {
    if (page.lang === 'en') continue;
    for (const [, href] of html.matchAll(/\shref="(https:[^"]+)"/g)) {
      const url = new URL(href.replaceAll('&amp;', '&'));
      const name = asked.get(url.origin + url.pathname);
      if (!name) continue;
      if (url.searchParams.get('lang') !== page.langAttr) errors.push(`${page.path}: link to ${name} without ?lang=${page.langAttr}: ${href}`);
    }
  }

  // Chinese only in the Chinese content (D-113).
  const skip = ['.git', 'core', 'node_modules', '.wrangler', 'dist', 'dist-preview', path.join('content', 'zh'), path.join('src', 'fonts'), path.join('src', 'img')];
  for (const file of await walk(ROOT, skip)) {
    const text = await readFile(file, 'utf8');
    const line = text.split('\n').findIndex((l) => CJK.test(l));
    if (line >= 0) errors.push(`${path.relative(ROOT, file)}:${line + 1}: Chinese characters outside content/zh/ (D-113)`);
  }

  // Every page in both languages, with the same headings.
  for (const lang of languages) {
    if (lang.code === 'en') continue;
    for (const [name, doc] of docs.en) {
      const t = docs[lang.code].get(name);
      if (!t) {
        errors.push(`content/${lang.code}/docs/${name}.md is missing`);
        continue;
      }
      const a = doc.headings.map((h) => h.level).join('');
      const b = t.headings.map((h) => h.level).join('');
      if (a !== b) errors.push(`${t.file}: its headings (levels ${b}) do not follow ${doc.file} (levels ${a}): the anchors are shared`);
    }
    for (const name of docs[lang.code].keys()) if (!docs.en.has(name)) errors.push(`content/${lang.code}/docs/${name}.md has no English page`);
  }
  for (const section of result.site.docs) for (const name of section.pages) if (!docs.en.has(name)) errors.push(`content/en/docs/${name}.md is missing`);

  // The Chinese heading subset covers the Chinese serif text.
  const subset = path.join(ROOT, 'src/fonts/ksana-serif-sc.woff2');
  if (existsSync(subset)) {
    const covered = woff2CodePoints(await readFile(subset));
    const serif = serifText(pages);
    const missing = [...new Set([...serif].filter((ch) => CJK.test(ch) && !covered.has(ch.codePointAt(0))))];
    if (missing.length) errors.push(`src/fonts/ksana-serif-sc.woff2 lacks ${missing.length} characters of the Chinese headings: run scripts/subset-zh-serif.py`);
  }

  if (errors.length) {
    for (const e of errors) console.error(`error: ${e}`);
    console.error(`${errors.length} problems`);
    process.exit(1);
  }
  console.log('checks passed');
}

// Serving ------------------------------------------------------------------------------------------------------------------

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };

function serve() {
  const server = createServer(async (req, res) => {
    let file = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (file.endsWith('/')) file += 'index.html';
    let full = path.join(OUT, path.normalize(file));
    if (!full.startsWith(OUT)) full = path.join(OUT, '404.html');
    let status = 200;
    if (!existsSync(full) && existsSync(path.join(full, 'index.html'))) {
      res.writeHead(308, { location: `${file}/` });
      res.end();
      return;
    }
    if (!existsSync(full)) {
      full = path.join(OUT, '404.html');
      status = 404;
    }
    try {
      const data = await readFile(full);
      res.writeHead(status, { 'content-type': TYPES[path.extname(full)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    } catch {
      res.writeHead(500);
      res.end();
    }
  });
  server.listen(4321, '127.0.0.1', () => console.log('serving http://127.0.0.1:4321'));
  let timer = null;
  for (const dir of ['content', 'lib', 'src']) {
    watch(path.join(ROOT, dir), { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => build().catch((e) => console.error(e)), 120);
    });
  }
}

// ------------------------------------------------------------------------------------------------------------------------

const result = await build();
if (SERIF_TEXT) process.stdout.write(result.serif);
else if (CHECK) await check(result);
else if (SERVE) serve();
