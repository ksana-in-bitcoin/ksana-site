// Syntax highlighting with shiki, in one theme: code is set on an inkstone panel, dark in both color schemes,
// so its token colors read the same on a light or a dark page.

import { createHighlighter } from 'shiki';

const INK = {
  fg: '#d9e2df',
  muted: '#93a29d',
  comment: '#7d8d88',
  keyword: '#8cc5d6',
  type: '#b3c7ea',
  fn: '#f0f4f2',
  string: '#a9d3b2',
  number: '#e2c98e',
  constant: '#e2c98e',
  attr: '#c4d0cc',
  macro: '#e7b9a6',
};

const inkstone = {
  name: 'ksana-inkstone',
  type: 'dark',
  colors: { 'editor.background': '#141c1d', 'editor.foreground': INK.fg },
  tokenColors: [
    { settings: { foreground: INK.fg } },
    { scope: ['comment', 'punctuation.definition.comment', 'string.comment'], settings: { foreground: INK.comment, fontStyle: 'italic' } },
    {
      scope: ['keyword', 'keyword.control', 'keyword.other', 'keyword.operator.new', 'keyword.operator.expression', 'keyword.operator.logical.python', 'storage', 'storage.type', 'storage.modifier', 'variable.language.this', 'variable.language.self'],
      settings: { foreground: INK.keyword },
    },
    { scope: ['keyword.operator', 'punctuation', 'meta.brace', 'punctuation.separator', 'punctuation.terminator'], settings: { foreground: INK.muted } },
    { scope: ['entity.name.type', 'entity.name.class', 'entity.name.struct', 'entity.name.enum', 'entity.name.trait', 'support.type', 'support.class', 'storage.type.primitive', 'entity.name.type.primitive', 'meta.type.annotation entity.name.type'], settings: { foreground: INK.type } },
    { scope: ['entity.name.function', 'support.function', 'meta.function-call entity.name.function', 'entity.name.function.macro'], settings: { foreground: INK.fn } },
    { scope: ['entity.name.function.macro', 'support.function.macro', 'meta.macro'], settings: { foreground: INK.macro } },
    { scope: ['string', 'string.quoted', 'string.template', 'punctuation.definition.string', 'markup.inline.raw'], settings: { foreground: INK.string } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character', 'constant.other', 'support.constant', 'variable.other.constant', 'entity.name.constant'], settings: { foreground: INK.number } },
    { scope: ['entity.other.attribute-name', 'meta.attribute', 'support.type.property-name', 'meta.object-literal.key', 'variable.other.property', 'variable.other.object.property'], settings: { foreground: INK.attr } },
    { scope: ['support.type.property-name.json', 'support.type.property-name.toml', 'entity.name.tag.toml', 'support.type.property-name.table.toml'], settings: { foreground: INK.keyword } },
    { scope: ['entity.name.section.toml', 'entity.name.tag'], settings: { foreground: INK.type } },
    { scope: ['variable.parameter', 'variable.other.readwrite'], settings: { foreground: INK.fg } },
    { scope: ['meta.attribute.rust', 'punctuation.definition.attribute.rust'], settings: { foreground: INK.comment } },
    { scope: ['entity.name.lifetime.rust', 'storage.modifier.lifetime.rust'], settings: { foreground: INK.macro } },
    { scope: ['entity.name.command.shell', 'support.function.builtin.shell'], settings: { foreground: INK.fn } },
    { scope: ['variable.other.normal.shell', 'variable.other.special.shell', 'punctuation.definition.variable.shell'], settings: { foreground: INK.number } },
    { scope: ['string.unquoted.argument.shell constant.other.option', 'constant.other.option'], settings: { foreground: INK.keyword } },
    { scope: ['markup.inserted', 'punctuation.definition.inserted'], settings: { foreground: INK.string } },
    { scope: ['markup.deleted', 'punctuation.definition.deleted'], settings: { foreground: INK.macro } },
    { scope: ['markup.bold'], settings: { fontStyle: 'bold' } },
    { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
  ],
};

const LANGS = ['rust', 'typescript', 'javascript', 'json', 'toml', 'shellscript', 'yaml', 'diff', 'html'];
const ALIASES = { ts: 'typescript', js: 'javascript', mjs: 'javascript', sh: 'shellscript', bash: 'shellscript', shell: 'shellscript', console: 'shellscript', rs: 'rust', yml: 'yaml' };

let highlighter;

/** Loads the grammars once: the dev server builds again on every change and reuses them. */
export async function initHighlighter() {
  highlighter ??= await createHighlighter({ themes: [inkstone], langs: LANGS });
}

export function languageOf(info) {
  const lang = (info || '').toLowerCase();
  return ALIASES[lang] ?? lang;
}

/** Highlighted lines of `code` as HTML (one <span class="line"> per line), or escaped text for an unknown language. */
export function highlight(code, info) {
  const lang = languageOf(info);
  const loaded = highlighter.getLoadedLanguages();
  const html = highlighter.codeToHtml(code, { lang: loaded.includes(lang) ? lang : 'text', theme: 'ksana-inkstone' });
  // Keep only the lines: the panel, its background and the copy button are the page's own markup.
  const inner = html.replace(/^<pre[^>]*><code>/, '').replace(/<\/code><\/pre>\s*$/, '');
  return inner;
}
