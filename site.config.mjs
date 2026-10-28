// Where the site lives and what it links to. The hosted signet's addresses are kept here only, so that the landing page,
// the docs and the live status strip all change together when a host does.

export default {
  // Canonical origin of this site: canonical links, the sitemap and Open Graph tags.
  origin: 'https://ksana.network',
  repo: 'https://github.com/ksana-in-bitcoin/ksana',
  discord: 'https://discord.gg/t7ckfmNMU',

  // The hosted public signet (core/docs/SIGNET.md, D-107).
  signet: {
    host: 'signet.ksana.network',
    wallet: 'https://signet.ksana.network/',
    rpc: 'https://signet.ksana.network/rpc',
    ws: 'wss://signet.ksana.network/rpc',
    indexer: 'https://signet.ksana.network/indexer',
    btc: 'https://signet.ksana.network/btc',
    faucet: 'https://signet.ksana.network/faucet',
    p2p: '/dns4/signet.ksana.network/tcp/9000',
  },

  // The contract playground on the signet (core/playground/, D-119): a page of its own, asked for Chinese like the wallet.
  playground: 'https://playground.ksana.network/',

  // Languages: the first is the default and lives at the root, the others under their own prefix.
  languages: [
    { code: 'en', lang: 'en', prefix: '' },
    { code: 'zh', lang: 'zh-CN', prefix: '/zh' },
  ],

  // The docs sidebar: sections in order, each a list of page slugs ('index' is the docs home).
  // Section titles are in each language's ui.mjs, page titles in each page's front matter.
  docs: [
    { section: 'start', pages: ['index', 'quickstart'] },
    { section: 'concepts', pages: ['how-it-works', 'confirmations', 'accounts', 'submitting-ops', 'ksa', 'mining'] },
    { section: 'network', pages: ['signet', 'wallet', 'run-a-node', 'run-an-indexer', 'cli'] },
    { section: 'build', pages: ['sdk', 'rpc', 'first-contract', 'contracts', 'contract-sdk', 'playground', 'host-functions', 'bitcoin-in-contracts', 'tokens', 'ks-20', 'ks-721', 'example-contracts', 'token-and-pool'] },
    { section: 'reference', pages: ['parameters', 'glossary', 'faq', 'security'] },
  ],
};
