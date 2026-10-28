// The files for AI assistants at the site's root (llmstxt.org, D-124): llms.txt lists the docs with a line on each,
// llms-full.txt holds every English page in one Markdown file, and llms-contracts.txt is the contract reference the
// playground copies (core/playground/src/ai/ksana-contracts.md, read from the core submodule at build time).

/**
 * A page's Markdown as plain Markdown: the callouts and details as a bold line, a figure as its caption, the other
 * containers dropped, heading ids and the code blocks' `from` dropped, and the site's own links made absolute.
 */
export function plainMarkdown(body, { origin, callouts }) {
  const out = [];
  let fence = null;
  let figure = false;
  for (const line of body.split('\n')) {
    const marker = line.match(/^(\s*)(`{3,})(.*)$/);
    if (fence) {
      out.push(line);
      if (marker && marker[2].length >= fence.length && !marker[3].trim()) fence = null;
      continue;
    }
    if (marker) {
      fence = marker[2];
      out.push(`${marker[1]}${marker[2]}${marker[3].replace(/\s+from="[^"]*"/, '')}`);
      continue;
    }
    const container = line.match(/^:::\s*(\S*)\s*(.*)$/);
    if (container) {
      const [, kind, rest] = container;
      figure = kind === 'figure';
      if (callouts[kind]) out.push(`**${rest || callouts[kind]}.**`);
      else if (kind === 'details') out.push(`**${rest}**`);
      continue;
    }
    if (figure) {
      if (line.trim()) out.push(`*Figure: ${line.trim()}*`);
      continue;
    }
    const text = line.startsWith('#') ? line.replace(/\s*\{#[a-z0-9_-]+\}\s*$/, '') : line;
    out.push(text.replace(/\]\((\/[^)\s]*)\)/g, (all, target) => `](${origin}${target})`));
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** The first paragraph of a page's Markdown */
function firstParagraph(markdown) {
  return markdown.split(/\n\s*\n/).find((p) => p.trim() && !/^[#:`|<-]/.test(p.trim())) ?? '';
}

/**
 * The three files, by name. `docs` are the English pages in the sidebar's order (each with its Markdown), `ui` the
 * English interface strings, `reference` the contract reference's text.
 */
export function llmsFiles({ site, docs, ui, reference }) {
  const plain = (markdown) => plainMarkdown(markdown, { origin: site.origin, callouts: ui.callouts });
  const url = (doc) => `${site.origin}${doc.path}`;
  const sections = site.docs
    .map((s) => ({ title: ui.sections[s.section], pages: s.pages.filter((n) => docs.has(n)).map((n) => docs.get(n)) }))
    .filter((s) => s.pages.length);
  const home = docs.get('index');

  const index = [
    '# Ksana',
    '',
    `> ${ui.description}`,
    '',
    home ? plain(firstParagraph(home.markdown)) : '',
    '',
    'The docs below are also one Markdown file, and contracts have a reference of their own, written for AI assistants that write, review or fix Ksana contracts.',
    '',
    '## For AI assistants',
    '',
    `- [Contract reference](${site.origin}/llms-contracts.txt): how contracts run, every function of the contract SDK, gas, limits, the token standards and complete contracts in one file, held to the code by the repository's tests`,
    `- [All the docs](${site.origin}/llms-full.txt): every English page of these docs in one Markdown file`,
    '',
    ...sections.flatMap((s) => [`## ${s.title}`, '', ...s.pages.map((doc) => `- [${doc.title}](${url(doc)}): ${doc.description}`), '']),
    '## Optional',
    '',
    `- [The docs in Chinese](${site.origin}/zh/docs/): the same pages in Simplified Chinese`,
    `- [Contract playground](${site.playground}): write, compile, deploy and call contracts on the public signet in the browser`,
    `- [Signet wallet and explorer](${site.signet.wallet}): the public signet's web wallet`,
    `- [Source code](${site.repo}): the node, the indexer, the SDKs, the specification and the design decisions`,
    '',
  ].join('\n');

  const full = [
    '# Ksana documentation',
    '',
    `> ${ui.description}`,
    '',
    `Every English page of the docs at ${site.origin}/docs/, in the order of their sidebar. Contracts have a reference of their own for AI assistants: ${site.origin}/llms-contracts.txt.`,
    '',
    ...sections.flatMap((s) => s.pages.flatMap((doc) => [
      '---',
      '',
      `# ${doc.title}`,
      '',
      `URL: ${url(doc)}`,
      '',
      ...(doc.ledeMarkdown ? [`> ${plain(doc.ledeMarkdown)}`, ''] : []),
      plain(doc.markdown),
      '',
    ])),
  ].join('\n');

  return { 'llms.txt': index, 'llms-full.txt': full, 'llms-contracts.txt': reference };
}
