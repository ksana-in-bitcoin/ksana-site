// Small helpers shared by the build: escaping, hashing, slugs and page-relative URLs.

import { createHash } from 'node:crypto';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

export function hashOf(data, length = 10) {
  return createHash('sha256').update(data).digest('hex').slice(0, length);
}

/**
 * A heading's id: lowercase ASCII words joined by hyphens, accents dropped (kṣaṇa → ksana).
 * Chinese pages take their ids from the English page instead (see markdown.mjs), so their URLs stay ASCII.
 */
export function slugify(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9_\s-]/g, ' ')
    .trim()
    .replace(/[\s-]+/g, '-');
}

/**
 * The URL of site path `to` on the page at site path `from`.
 * The site itself links by root-relative paths ('/docs/rpc/'): they hold on any URL a page is reached by, the 404 page
 * included. A preview is served under a path of its own, so there `to` is made relative to the page, and directory
 * links name their index.html, because the preview host serves files only. Every page path is a directory ('/',
 * '/docs/', '/zh/docs/rpc/'); `to` is a directory or a file ('/assets/site.css'), optionally with a '#fragment'.
 */
export function relUrl(from, to, preview = false) {
  if (!preview) return to;
  const hashAt = to.indexOf('#');
  let path = hashAt >= 0 ? to.slice(0, hashAt) : to;
  const hash = hashAt >= 0 ? to.slice(hashAt) : '';
  if (path === '') return hash || './';
  if (preview && path.endsWith('/')) path += 'index.html';
  const fromDirs = from.split('/').filter(Boolean);
  const parts = path.split('/').slice(1);
  const file = path.endsWith('/') ? '' : parts.pop();
  const toDirs = parts.filter(Boolean);
  let common = 0;
  while (common < fromDirs.length && common < toDirs.length && fromDirs[common] === toDirs[common]) common++;
  const url = '../'.repeat(fromDirs.length - common) + toDirs.slice(common).map((d) => `${d}/`).join('') + file;
  return (url === '' ? './' : url) + hash;
}

/** The output file of a page path: '/docs/rpc/' → 'docs/rpc/index.html'. */
export function outFile(pagePath) {
  return pagePath.endsWith('/') ? `${pagePath.slice(1)}index.html` : pagePath.slice(1);
}

/** Text of an HTML fragment, for search and descriptions. */
export function stripTags(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Han characters and CJK punctuation: allowed only in the Chinese content (D-113). */
export const CJK = /[\u2e80-\u2fdf\u3000-\u303f\u3040-\u30ff\u3100-\u312f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/;
