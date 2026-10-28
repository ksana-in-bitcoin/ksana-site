// The Markdown pipeline of the docs: markdown-it with heading ids, callouts, figures, tabbed code groups, card grids,
// highlighted code with a copy button, scrollable tables and page-relative links.
//
// Every page renders with an `env` holding its context: { lang, ui, pagePath, prefix, preview, enIds, figures, config }.
// After rendering, env.headings lists the page's headings, env.links its internal links and env.sources its code blocks
// marked `from="<path in the core submodule>"` (for the checks).

import MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import { highlight, languageOf } from './highlight.mjs';
import { CJK, escapeHtml, relUrl, slugify } from './util.mjs';

/** Front matter: `key: value` lines between two `---` lines at the top of the file. */
export function parseFrontMatter(source, file) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error(`${file}: missing front matter`);
  const data = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!kv) throw new Error(`${file}: bad front matter line: ${line}`);
    let value = kv[2].trim();
    if (/^".*"$/.test(value)) value = JSON.parse(value);
    data[kv[1]] = value;
  }
  return { data, body: source.slice(match[0].length) };
}

/** `{{signet.rpc}}` and the like: values from site.config.mjs, also inside code blocks. */
export function substitute(source, config, file) {
  return source.replace(/\{\{([a-z.]+)\}\}/g, (all, key) => {
    const value = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), config);
    if (typeof value !== 'string') throw new Error(`${file}: unknown placeholder ${all}`);
    return value;
  });
}

const LANG_LABEL = { rust: 'Rust', typescript: 'TypeScript', javascript: 'JavaScript', json: 'JSON', toml: 'TOML', shellscript: 'Shell', yaml: 'YAML', diff: 'Diff', html: 'HTML' };

function parseInfo(info) {
  const m = info.trim().match(/^(\S*)\s*(.*)$/);
  const lang = m ? m[1] : '';
  const rest = m ? m[2] : '';
  const title = (rest.match(/title="([^"]*)"/) || [])[1];
  const from = (rest.match(/from="([^"]*)"/) || [])[1];
  return { lang, title, from };
}

/** Site path of an internal link written as '/docs/…' in the English source, for the page's language. */
export function localPath(path, prefix) {
  if (!prefix || path.startsWith('/assets/')) return path;
  return prefix + path;
}

export function createMarkdown() {
  const md = new MarkdownIt({ html: true, linkify: false, typographer: true, quotes: '“”‘’' });

  // Chinese text has no spaces between words: a line break inside a paragraph must not become one.
  md.core.ruler.after('inline', 'cjk_breaks', (state) => {
    for (const block of state.tokens) {
      if (block.type !== 'inline' || !block.children) continue;
      const kids = block.children;
      for (let i = 1; i < kids.length - 1; i++) {
        if (kids[i].type !== 'softbreak') continue;
        const before = kids[i - 1].content || '';
        const after = kids[i + 1].content || '';
        if (CJK.test(before.slice(-1)) && CJK.test(after.slice(0, 1))) {
          kids[i].type = 'text';
          kids[i].content = '';
        }
      }
    }
  });

  // Heading ids: `{#id}` when given, else the English page's id at the same position, else a slug of the text.
  md.core.ruler.after('cjk_breaks', 'heading_ids', (state) => {
    // An inline render (a lede, a table cell) has no headings and must not reset the page's list
    if (state.inlineMode) return;
    const env = state.env;
    env.headings = [];
    const used = new Map();
    let index = 0;
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const open = tokens[i];
      if (open.type !== 'heading_open') continue;
      const inline = tokens[i + 1];
      let id;
      const last = inline.children[inline.children.length - 1];
      const explicit = last && last.type === 'text' ? last.content.match(/\s*\{#([a-z0-9_-]+)\}\s*$/) : null;
      if (explicit) {
        id = explicit[1];
        last.content = last.content.slice(0, explicit.index);
        inline.content = inline.content.replace(/\s*\{#[a-z0-9_-]+\}\s*$/, '');
      }
      const text = inline.children.map((t) => (t.type === 'text' || t.type === 'code_inline' ? t.content : '')).join('').trim();
      if (!id) id = (env.enIds && env.enIds[index]) || slugify(text) || `section-${index + 1}`;
      const seen = used.get(id) || 0;
      used.set(id, seen + 1);
      if (seen) id = `${id}-${seen}`;
      open.attrSet('id', id);
      const level = Number(open.tag.slice(1));
      env.headings.push({ level, id, text, html: state.md.renderer.renderInline(inline.children, state.md.options, env) });
      index++;
    }
  });

  md.renderer.rules.heading_close = (tokens, idx, options, env) => {
    const open = tokens[idx - 2];
    const id = open.attrGet('id');
    const level = Number(open.tag.slice(1));
    const anchor = level <= 3 && id ? `<a class="h-anchor" href="#${id}" aria-label="${escapeHtml(env.ui.anchor)}"></a>` : '';
    return `${anchor}</${tokens[idx].tag}>\n`;
  };

  // Links: site paths become page-relative (and Chinese pages link to the Chinese pages).
  const defaultLinkOpen = md.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = token.attrGet('href') || '';
    if (href.startsWith('/')) {
      const target = localPath(href, env.prefix);
      env.links.push(target);
      token.attrSet('href', relUrl(env.pagePath, target, env.preview));
    } else if (/^https?:\/\//.test(href)) {
      token.attrSet('rel', 'noopener');
      token.attrJoin('class', 'ext');
    } else if (href.startsWith('#')) {
      env.links.push(env.pagePath + href);
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  md.renderer.rules.table_open = () => '<div class="table-wrap"><table>\n';
  md.renderer.rules.table_close = () => '</table></div>\n';

  // Inline code: a short one stays on one line (a flag must not break after its "--"); a long one, a hash or an
  // address, may break anywhere.
  const defaultCodeInline = md.renderer.rules.code_inline;
  md.renderer.rules.code_inline = (tokens, idx, options, env, self) => {
    if ([...tokens[idx].content].length <= 26) tokens[idx].attrJoin('class', 'nb');
    return defaultCodeInline(tokens, idx, options, env, self);
  };

  // Code: a panel with its title or language, a copy button and the highlighted lines.
  md.renderer.rules.fence = (tokens, idx, options, env) => {
    const token = tokens[idx];
    const { lang, title, from } = parseInfo(token.info);
    const code = token.content.replace(/\n$/, '');
    if (from && env.sources) env.sources.push({ from, code });
    const isOutput = lang === 'output' || lang === 'text' || lang === '';
    const label = title || (lang === 'output' ? env.ui.output : LANG_LABEL[languageOf(lang)] || '');
    const body = highlight(code, isOutput ? 'text' : lang);
    const group = token.meta && token.meta.group;
    const panelAttrs = group
      ? ` role="tabpanel" id="${group.id}-${group.index}" aria-labelledby="${group.id}-tab-${group.index}"${group.index ? ' hidden' : ''}`
      : '';
    const head = group
      ? `<button class="copy" type="button" data-copied="${escapeHtml(env.ui.copied)}">${escapeHtml(env.ui.copy)}</button>`
      : `<div class="code-head"><span class="code-label">${escapeHtml(label)}</span><button class="copy" type="button" data-copied="${escapeHtml(env.ui.copied)}">${escapeHtml(env.ui.copy)}</button></div>`;
    return `<div class="code${isOutput ? ' code--output' : ''}${group ? ' code--grouped' : ''}" data-lang="${escapeHtml(languageOf(lang) || 'text')}"${panelAttrs}>${head}<pre tabindex="0"><code>${body}</code></pre></div>\n`;
  };

  // ::: note | tip | warning | danger [title]
  for (const kind of ['note', 'tip', 'warning', 'danger']) {
    md.use(container, kind, {
      render(tokens, idx, options, env) {
        const token = tokens[idx];
        if (token.nesting === 1) {
          const custom = token.info.trim().slice(kind.length).trim();
          const title = custom || env.ui.callouts[kind];
          return `<aside class="callout callout--${kind}"><p class="callout-title">${md.renderInline(title, env)}</p>\n`;
        }
        return '</aside>\n';
      },
    });
  }

  // ::: details Summary
  md.use(container, 'details', {
    render(tokens, idx, options, env) {
      const token = tokens[idx];
      if (token.nesting === 1) {
        const summary = token.info.trim().slice('details'.length).trim();
        return `<details class="details"><summary>${md.renderInline(summary, env)}</summary><div class="details-body">\n`;
      }
      return '</div></details>\n';
    },
  });

  // ::: figure name — a drawing from figures.mjs, the container's content is its caption.
  md.use(container, 'figure', {
    render(tokens, idx, options, env) {
      const token = tokens[idx];
      if (token.nesting === 1) {
        const name = token.info.trim().slice('figure'.length).trim();
        const draw = env.figures[name];
        if (!draw) throw new Error(`${env.file}: unknown figure ${name}`);
        return `<figure class="fig fig--${name}">${draw(env.ui.figures, env)}<figcaption>\n`;
      }
      return '</figcaption></figure>\n';
    },
  });

  // ::: code-group — consecutive fences with titles, shown as tabs.
  let groups = 0;
  md.use(container, 'code-group', {
    render(tokens, idx, options, env) {
      const token = tokens[idx];
      if (token.nesting !== 1) return '</div>\n';
      const id = `cg${++groups}`;
      const titles = [];
      for (let j = idx + 1, depth = 0; j < tokens.length; j++) {
        const t = tokens[j];
        if (t.type === 'container_code-group_open') depth++;
        if (t.type === 'container_code-group_close') {
          if (depth === 0) break;
          depth--;
        }
        if (t.type === 'fence') {
          const { lang, title } = parseInfo(t.info);
          t.meta = { group: { id, index: titles.length } };
          titles.push(title || LANG_LABEL[languageOf(lang)] || lang);
        }
      }
      const key = token.info.trim().slice('code-group'.length).trim();
      const tabs = titles
        .map(
          (title, i) =>
            `<button type="button" role="tab" id="${id}-tab-${i}" aria-controls="${id}-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${escapeHtml(title)}</button>`,
        )
        .join('');
      return `<div class="code-group"${key ? ` data-key="${escapeHtml(key)}"` : ''}><div class="code-tabs" role="tablist">${tabs}</div>\n`;
    },
  });

  // ::: cards — a list of links, each with a line of text, shown as a grid of cards.
  md.use(container, 'cards', {
    render(tokens, idx) {
      return tokens[idx].nesting === 1 ? '<div class="cards">\n' : '</div>\n';
    },
  });

  // ::: steps — numbered steps: each ### heading inside is a step.
  md.use(container, 'steps', {
    render(tokens, idx) {
      return tokens[idx].nesting === 1 ? '<div class="steps">\n' : '</div>\n';
    },
  });

  return md;
}
