// The English landing page (D-125): a prologue, a story in six acts that the scroll plays, then the sections a visitor
// comes back for. Strings may hold inline HTML; site paths in href="/…" are made page-relative.

export default {
  title: 'Ksana · Confirmed in an instant. Final on Bitcoin.',
  description:
    'Ksana is a proof-of-work smart-contract chain that confirms in about five seconds, writes every block into Bitcoin, and lets Bitcoin alone decide what is final.',

  hero: {
    status: 'Public signet',
    statusLive: (height) => `Public signet · block ${height}`,
    title: 'Confirmed in an <em>instant</em>.<br>Final on Bitcoin<span class="stop">.</span>',
    lede: 'Ksana is a smart-contract chain that confirms in about five seconds and writes every block into Bitcoin. Which blocks are final is decided by Bitcoin’s chain alone: no bridge, no committee, no sequencer in between.',
    primary: 'Open the signet wallet',
    secondary: 'Read the docs',
    dialLabel: 'An ensō drawn in one stroke, ringed by 120 ticks: 120 Ksana blocks of five seconds make one Bitcoin block of ten minutes.',
    chapters: 'The story, in six acts',
    scroll: 'Scroll, and time moves forward',
  },

  live: {
    label: 'Signet, live',
    fast: 'Fast lane',
    ago: (s) => `last block ${s} s ago`,
    tip: 'latest block',
    final: 'BTC-final',
    finalSub: 'final on Bitcoin',
    btc: 'Anchor',
    btcSub: 'Bitcoin signet block',
  },

  // The operation the acts follow, from its signature to its seal: its age, and the mark it has reached.
  story: {
    label: 'Your operation',
    pending: 'Signed',
    units: { s: '{n} s', min: '{n} min', h: '{h} h {m} min' },
  },

  acts: {
    clock: {
      label: 'Ten minutes',
      title: 'One Bitcoin block.<br>A hundred and twenty <em>instants</em>.',
      beats: [
        'Bitcoin keeps time in blocks of about ten minutes: slow, and very hard to rewrite.',
        'Ksana confirms in about five seconds. In the time Bitcoin takes for one block, Ksana’s fast lane can confirm a hundred and twenty times.',
        {
          quote: 'A hundred and twenty <i lang="sa-Latn">kṣaṇas</i> make one <i lang="sa-Latn">tat-kṣaṇa</i>.',
          cite: 'Abhidharmakośa',
          text: 'The <i lang="sa-Latn">kṣaṇa</i> is the shortest unit of time in the Buddhist texts. It gave the chain its name.',
        },
      ],
      tags: { count: 'block {n} of 120', block: 'one Bitcoin block' },
    },
    lane: {
      label: 'The fast lane',
      title: 'Confirmed in<br>an <em>instant</em>.',
      beats: [
        'Producers mine Ksana’s own proof-of-work blocks, about one every five seconds while there are operations to include. Yours executes as soon as a block takes it in: balances move, and contracts see the new state.',
        'Two producers often find a block at the same moment. Neither is thrown away: a block names up to ten parents, and GHOSTDAG puts the whole block DAG in one order.',
        'Every block names a Bitcoin block it has seen, its anchor. Execution reads Bitcoin only up to the anchor, so every node computes the same result whatever its own Bitcoin tip.',
      ],
      tags: {
        signed: 'signed',
        you: 'your operation',
        merged: 'found at the same moment, merged',
        parents: 'three parents',
        anchor: 'anchors: the Bitcoin block each has seen',
      },
    },
    settle: {
      label: 'Settlement',
      title: 'Then it is written<br>into <em>Bitcoin</em>.',
      beats: [
        'Every block’s data goes into ordinary Bitcoin transactions. A busy chain sends about one settlement per Bitcoin block, carrying everything since the last one.',
        'A commit and reveal pair carries the blocks’ compact headers and the operations themselves in a Taproot witness. A path B transfer takes 79 to 143 bytes.',
        'From then on anyone can read it from Bitcoin, and no one can withhold it. On path B you pay only KSA: the producer pays the Bitcoin fee.',
      ],
      tags: { batch: 'blocks since the last settlement', commit: 'commit', reveal: 'reveal · Taproot witness', next: 'the next Bitcoin block' },
    },
    seal: {
      label: 'Finality',
      title: 'Final on <em>Bitcoin</em>.',
      beats: [
        'Every node and every indexer decides finality with the same function of Bitcoin data, so they reach the same answer without trusting one another.',
        'At six Bitcoin confirmations of its data, every node decides the block final. Five more Bitcoin blocks secure that decision.',
        'Undoing a final block means reorganizing at least six blocks of Bitcoin itself. Fast-lane hashrate alone cannot do it.',
      ],
      tags: {
        confirmation: 'Bitcoin confirmation',
        confirmations: 'Bitcoin confirmations',
        decided: 'six confirmations: decided final',
        secured: 'the decision, six blocks deep',
      },
    },
    door: {
      label: 'Two ways in',
      title: 'Fast when you want it.<br>Unstoppable when you need it.',
      beats: [
        '<b>Path B, sponsored.</b> Sign one message and pay a small fee in KSA. A producer includes it within seconds and pays the Bitcoin fee to settle it. No bitcoin needed.',
        '<b>Path C, native.</b> Put the operation in a Bitcoin transaction of your own and pay its Bitcoin fee. Once it has its confirmations, every producer must include it, ahead of every other entry.',
        'A block that leaves it out is invalid, so no producer can keep you out. Only hold bitcoin? <a href="/docs/wallet/#top-up">Top up</a>: buy KSA from an exchange contract with a single Bitcoin payment, then use path B.',
      ],
      tags: {
        signature: 'your signature',
        pathB: 'path B · in seconds',
        tx: 'your Bitcoin transaction',
        confirms: 'its confirmations',
        forced: 'forced inclusion',
        invalid: 'left it out: invalid',
      },
    },
    rebuild: {
      label: 'Verification',
      title: 'Nothing to trust<br>but Bitcoin and work.',
      beats: [
        'Suppose every Ksana node went dark.',
        'The chain would still be there. The indexer talks only to bitcoind: it reads every block’s data back from Bitcoin, executes it again and checks each state root.',
        'It runs the same finality function as the nodes and reports the same final block. Anyone can run one, with no Ksana node in the loop.',
      ],
      tags: { nodes: 'Ksana nodes', indexer: 'the indexer: Bitcoin only', roots: 'state roots match' },
    },
  },

  marks: {
    label: 'The life of an operation',
    title: 'One operation, three marks.',
    intro:
      'Every operation passes three marks, each a stronger promise than the last. The wallet shows which one it has reached, and an application decides by the amount at stake which one to wait for.',
    stages: [
      {
        key: 'fast',
        name: 'Fast-confirmed',
        time: 'about 5 seconds',
        text: 'A producer includes your operation in a fast-lane block, and every node replays it. The new state is live: balances move, contracts see it.',
      },
      {
        key: 'btc',
        name: 'On Bitcoin',
        time: 'the next Bitcoin block',
        text: 'The block’s header and entries ride into Bitcoin in a settlement transaction. From then on anyone can read them from Bitcoin, and no one can withhold them.',
      },
      {
        key: 'final',
        name: 'Final on Bitcoin',
        time: 'from about 110 minutes',
        text: 'Once the block’s data has six Bitcoin confirmations, every node and indexer decides from Bitcoin’s chain, with the same rule, that it is final, and five more Bitcoin blocks secure that decision. Undoing a final block means reorganizing at least six blocks of Bitcoin itself.',
      },
    ],
    more: 'How long to wait, and why',
    moreHref: '/docs/confirmations/',
  },

  reasons: {
    label: 'Why Ksana',
    title: 'No bridge. No new seed phrase.<br>No premine.',
    points: [
      {
        icon: 'nobridge',
        title: 'No bridge, no custody',
        text: 'Ksana never holds your bitcoin. KSA is the chain’s own asset; BTC stays on Bitcoin, where contracts can still see it move.',
      },
      {
        icon: 'wallet',
        title: 'Your Bitcoin wallet is your account',
        text: 'An account is a Taproot key, so your Ksana account and your bitcoin share one address. Unisat and Xverse sign Ksana operations with BIP322.',
      },
      {
        icon: 'cpu',
        title: 'Mined on CPUs, no premine',
        text: 'Anyone can mine: Argon2id with 2 MiB per hash, made for an ordinary CPU. Mainnet starts with zero KSA, and every coin is a block reward.',
      },
      {
        icon: 'contract',
        title: 'Contracts that can read Bitcoin',
        text: 'Rust compiled to WebAssembly, with exact gas. Contracts read Bitcoin headers six blocks deep, verify Bitcoin payments with Merkle proofs, and see the transaction that carried their call.',
      },
    ],
  },

  ksa: {
    label: 'KSA',
    title: 'Issued by work, capped at 210 million.',
    intro:
      'KSA pays for sponsored operations and contract gas. New KSA appears only as block rewards, paid once a block’s data has landed on Bitcoin, and the reward halves on a schedule that stretches over decades.',
    stats: [
      { value: '210,000,000', label: 'KSA, the most there will ever be' },
      { value: '4.2', label: 'KSA per reward slot, one slot per 5 s' },
      { value: '2 · 4 · 8', label: 'years between halvings: the first after 2, the next after 4, then every 8' },
      { value: '≈ 220', label: 'years until the reward per slot reaches zero' },
    ],
    chartCaption: 'KSA issued over time on mainnet. Every coin is a block reward; nothing is allocated at genesis.',
    note: 'Mainnet has not launched. Signet KSA is test money with no value.',
    more: 'Rewards, fees and the carrier reward',
    moreHref: '/docs/ksa/',
  },

  build: {
    label: 'Build',
    title: 'Build with the tools you know.',
    intro:
      'A TypeScript SDK for browsers and Node, contracts in Rust compiled to WebAssembly, a command-line client for everything else, and a JSON-RPC under all three.',
    links: [
      { label: 'Quickstart', href: '/docs/quickstart/' },
      { label: 'TypeScript SDK', href: '/docs/sdk/' },
      { label: 'Write a contract', href: '/docs/contracts/' },
      { label: 'JSON-RPC', href: '/docs/rpc/' },
    ],
    playground: {
      text: 'Or start in the browser. The contract playground has a token, an NFT collection, an AMM, lending, a multisig and vesting, each with a page of its own, to use, edit, compile and deploy on the signet.',
      cta: 'Open the playground',
    },
    code: [
      {
        title: 'TypeScript',
        lang: 'ts',
        code: `import {
  KsanaRpcClient,
  SIGNET,
  UnisatAdapter,
  VMOP_VERSION,
  btcNetworkOf,
  fromHex,
  ksaAssetId,
  parseAccount,
  signVmopWithWallet,
} from '@ksana/sdk';

const rpc = new KsanaRpcClient('{{signet.rpc}}');
const params = await rpc.getParams(SIGNET); // refuses a node on another network
const wallet = new UnisatAdapter(); // the wallet's Taproot address is your Ksana account
const account = fromHex((await wallet.getAccount()).account, 32);

const { nonce } = await rpc.getAccount(account);
const { path_b } = await rpc.estimateFee();
const op = await signVmopWithWallet(
  {
    version: VMOP_VERSION,
    chain_id: params.chain_id,
    account,
    nonce,
    fee: { kind: 'Token', amount: 2n * path_b.amount }, // path B: the fee is paid in KSA
    max_gas: 10_000n, // a transfer uses exactly 10,000 gas
    action: {
      kind: 'AssetTransfer',
      asset: ksaAssetId(),
      to: parseAccount('tb1p…', btcNetworkOf(params)),
      amount: 100_000_000n, // 1 KSA: 8 decimals
    },
  },
  wallet, // one BIP322 signature in the wallet, no bitcoin spent
);
const { op_id } = await rpc.submitOp(op); // fast-confirmed in about 5 s
`,
      },
      {
        title: 'Rust contract',
        lang: 'rust',
        code: `#![cfg_attr(target_arch = "wasm32", no_std)]
extern crate alloc;

use ksana_contract_sdk::{self as sdk, storage, CallResult};

sdk::entry!(dispatch);

/// A counter anyone can bump; every bump is an event.
pub fn dispatch(method: &str, args: &[u8]) -> CallResult {
    match method {
        "init" => {
            sdk::decode::<()>(args)?;
            storage::write(b"count", &0u64);
            sdk::ok(&())
        }
        "bump" => {
            sdk::decode::<()>(args)?;
            let count: u64 = storage::read(b"count")?.unwrap_or(0);
            let next = count.checked_add(1).ok_or(b"overflow".to_vec())?;
            storage::write(b"count", &next);
            sdk::emit(&("bumped", sdk::caller(), next));
            sdk::ok(&next)
        }
        "count" => sdk::ok(&storage::read::<u64>(b"count")?.unwrap_or(0)),
        _ => sdk::revert("unknown method"),
    }
}
`,
      },
      {
        title: 'CLI',
        lang: 'sh',
        code: `# A new key, and its account's signet address
ksana-cli key --chain signet alice.key

# Send 1 KSA on path B (amounts in base units: KSA has 8 decimals) and wait until it executes
export KSANA_RPC={{signet.rpc}}
ksana-cli transfer --chain signet --key alice.key --to tb1p… --amount 100000000 --fee-token 1 --wait

# The same op reads btc_final five Bitcoin blocks after its block's data has six confirmations
ksana-cli op <op_id>
`,
      },
    ],
  },

  run: {
    label: 'Run it',
    title: 'Run the whole thing yourself.',
    cards: [
      {
        title: 'A node',
        text: 'Follow the chain, check every block against Bitcoin, mine on a CPU, and settle the blocks you mine.',
        href: '/docs/run-a-node/',
        cta: 'Run a node',
      },
      {
        title: 'An indexer',
        text: 'Rebuild the whole chain from bitcoind alone, with no Ksana node in the loop, and verify every state root.',
        href: '/docs/run-an-indexer/',
        cta: 'Run an indexer',
      },
      {
        title: 'A wallet',
        text: 'Paths B and C and top-ups from Unisat or Xverse, on the hosted signet page or against your own node.',
        href: '/docs/wallet/',
        cta: 'Use the wallet',
      },
    ],
  },

  status: {
    label: 'Where it stands',
    states: { done: 'Done', now: 'Now', next: 'Next' },
    title: 'Fast blocks.<br>A careful launch.',
    items: [
      {
        state: 'done',
        title: 'Specification frozen',
        text: 'The consensus rules were frozen on 5&nbsp;October 2026. Any change from here on goes through the upgrade schedule.',
      },
      {
        state: 'done',
        title: 'Audited and attacked',
        text: 'Internal security audits, adversarial tests of reorgs and withheld blocks, fuzzing, and a five-hour soak test of nodes against the indexer.',
      },
      {
        state: 'now',
        title: 'Public signet',
        text: 'Running on Bitcoin’s public signet with a seed node, an indexer, the web wallet and a faucet. Test coins only.',
      },
      {
        state: 'next',
        title: 'Mainnet',
        text: 'Not launched. The signet runs for at least four weeks first, to watch settlements and the carrier reward on a real fee market.',
      },
    ],
  },

  coda: {
    title: 'An instant,<br>written into Bitcoin.',
    primary: 'Try it on signet',
    secondary: 'Start with the quickstart',
    secondaryHref: '/docs/quickstart/',
  },
};
