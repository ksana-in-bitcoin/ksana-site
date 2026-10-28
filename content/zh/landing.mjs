// The Chinese landing page: the English one (content/en/landing.mjs) in Chinese, with the same keys and markup.

export default {
  title: 'Ksana · 瞬间确认，最终在比特币上落定',
  description: 'Ksana 是一条工作量证明的智能合约链：约五秒确认，把每个区块写进比特币，哪些区块最终只由比特币决定。',

  hero: {
    status: '公开 signet',
    statusLive: (height) => `公开 signet · 区块 ${height}`,
    title: '<em>瞬间</em>确认，<br>最终在比特币上落定<span class="stop">。</span>',
    lede: 'Ksana 是一条智能合约链：约五秒确认，并把每个区块写进比特币。哪些区块算最终，只由比特币的链决定，中间没有跨链桥，没有委员会，也没有排序器。',
    primary: '打开 signet 钱包',
    secondary: '阅读文档',
    dialLabel: '一笔画成的圆相，外圈 120 道刻度：120 个五秒的 Ksana 区块，正好是一个十分钟的比特币区块。',
    chapters: '六幕故事',
    scroll: '向下滚动，时间就往前走',
  },

  live: {
    label: 'Signet 实时',
    fast: '快轨',
    ago: (s) => `上一块 ${s} 秒前`,
    tip: '最新区块',
    final: 'BTC 最终',
    finalSub: '比特币上已落定',
    btc: '锚定',
    btcSub: '比特币区块高度',
  },

  story: {
    label: '你的操作',
    pending: '已签名',
    units: { s: '{n} 秒', min: '{n} 分钟', h: '{h} 小时 {m} 分' },
  },

  acts: {
    clock: {
      label: '十分钟',
      title: '一个比特币区块，<br>一百二十个<em>刹那</em>。',
      beats: [
        '比特币以区块计时，大约十分钟一块：很慢，也极难改写。',
        'Ksana 约五秒确认一次。比特币出一个块的工夫，Ksana 的快轨可以确认一百二十次。',
        {
          quote: '刹那百二十，为一怛刹那。',
          cite: '《阿毗达磨俱舍论》',
          text: '刹那（<i lang="sa-Latn">kṣaṇa</i>）是佛典里最短的时间单位，这条链由此得名。',
        },
      ],
      tags: { count: '第 {n} / 120 块', block: '一个比特币区块' },
    },
    lane: {
      label: '快轨',
      title: '<em>瞬间</em><br>确认。',
      beats: [
        '出块者用工作量证明挖 Ksana 自己的区块，有操作要收录时大约五秒一块。你的操作一被收进区块就立即执行：余额变了，合约也看得到新状态。',
        '两个出块者常常在同一刻各挖出一块。哪一块都不丢：一个区块最多能引用十个父块，GHOSTDAG 把整个区块 DAG 排成唯一的顺序。',
        '每个区块都写明它见过的一个比特币区块，也就是它的锚定。执行只读到锚定为止的比特币数据，所以不论各节点自己的比特币链头在哪，算出的结果都一样。',
      ],
      tags: {
        signed: '已签名',
        you: '你的操作',
        merged: '同一刻挖出，一并合并',
        parents: '三个父块',
        anchor: '锚定：每块见过的比特币区块',
      },
    },
    settle: {
      label: '结算',
      title: '然后，<br>写进<em>比特币</em>。',
      beats: [
        '每个区块的数据都会写进普通的比特币交易。链上繁忙时，大约每个比特币区块发一次结算，把上一次以来的一切都带上。',
        '一对交易，先提交、后揭示，在 Taproot 见证里装着这些区块的紧凑区块头和操作本身。一笔路径 B 转账只占 79 到 143 字节。',
        '从此任何人都能从比特币上读到它，谁也扣不下来。走路径 B 你只付 KSA，比特币手续费由出块者付。',
      ],
      tags: { batch: '上次结算以来的区块', commit: '提交', reveal: '揭示 · Taproot 见证', next: '下一个比特币区块' },
    },
    seal: {
      label: '最终性',
      title: '在<em>比特币</em>上<br>落定。',
      beats: [
        '每个节点、每个索引器都用同一个只看比特币数据的函数判定最终性，所以彼此不必信任，也会得出同一个答案。',
        '区块的数据在比特币上有了 6 个确认，每个节点就判定它为最终；再过 5 个比特币区块，这一判定被加固。',
        '要推翻一个最终的区块，就得把比特币本身重组至少六个区块。光靠快轨的算力做不到。',
      ],
      tags: {
        confirmation: '个比特币确认',
        confirmations: '个比特币确认',
        decided: '6 个确认：判定为最终',
        secured: '这一判定，也有六块深',
      },
    },
    door: {
      label: '两种提交方式',
      title: '想快时够快，<br>要紧时谁也拦不住。',
      beats: [
        '<b>路径 B，代付。</b>签一条消息，付一点 KSA 手续费。出块者几秒内收录它，并替你付结算所需的比特币手续费。不需要比特币。',
        '<b>路径 C，原生。</b>把操作放进你自己的比特币交易，自付比特币手续费。等它有了足够的确认，每个出块者都必须收录它，而且排在其他条目之前。',
        '漏掉它的区块无效，所以谁也拦不住你。手上只有比特币？可以<a href="/docs/wallet/#top-up">充值</a>：用一笔比特币付款，从兑换合约买到 KSA，然后走路径 B。',
      ],
      tags: {
        signature: '你的签名',
        pathB: '路径 B · 几秒内',
        tx: '你的比特币交易',
        confirms: '它的确认',
        forced: '强制收录',
        invalid: '漏掉它：无效',
      },
    },
    rebuild: {
      label: '验证',
      title: '除了比特币和算力，<br>什么都不用信任。',
      beats: [
        '假设所有 Ksana 节点同时熄灭。',
        '这条链也还在。索引器只连 bitcoind：它从比特币上读回每个区块的数据，重新执行，核对每个状态根。',
        '它和节点跑同一个最终性函数，报告同一个最终区块。谁都能运行一个，不经过任何 Ksana 节点。',
      ],
      tags: { nodes: 'Ksana 节点', indexer: '索引器：只读比特币', roots: '状态根全部对上' },
    },
  },

  marks: {
    label: '一笔操作的一生',
    title: '一笔操作，<br>三道印记。',
    intro: '每笔操作都要经过三道印记，一道比一道更有分量。钱包会显示它走到了哪一道；应用按涉及的金额，决定等到哪一道。',
    stages: [
      {
        key: 'fast',
        name: '快轨确认',
        time: '约 5 秒',
        text: '出块者把你的操作收进一个快轨区块，每个节点都重放一遍。新状态立即生效：余额变了，合约也看得到。',
      },
      {
        key: 'btc',
        name: '已写入比特币',
        time: '下一个比特币区块',
        text: '区块头和条目随一笔结算交易写进比特币。从此任何人都能从比特币上读到它们，谁也扣不下来。',
      },
      {
        key: 'final',
        name: 'BTC 最终',
        time: '约 110 分钟起',
        text: '区块的数据有了 6 个比特币确认，每个节点和索引器就按同一条规则，从比特币的链上判定它为最终，再过 5 个比特币区块把这一判定加固。要推翻一个最终的区块，就得把比特币本身重组至少六个区块。',
      },
    ],
    more: '要等多久，为什么',
    moreHref: '/docs/confirmations/',
  },

  reasons: {
    label: '为什么是 Ksana',
    title: '没有跨链桥，不用新助记词，<br>没有预挖。',
    points: [
      {
        icon: 'nobridge',
        title: '没有跨链桥，没有托管',
        text: 'Ksana 从不保管你的比特币。KSA 是这条链自己的资产；BTC 留在比特币上，合约照样看得到它的流动。',
      },
      {
        icon: 'wallet',
        title: '比特币钱包就是你的账户',
        text: '账户就是一把 Taproot 密钥，你的 Ksana 账户和比特币共用一个地址。Unisat 与 Xverse 用 BIP322 签署 Ksana 操作。',
      },
      {
        icon: 'cpu',
        title: 'CPU 挖矿，没有预挖',
        text: '人人都能挖：Argon2id，每次哈希用 2 MiB 内存，为普通 CPU 而设计。主网从零个 KSA 起步，每一枚都是出块奖励。',
      },
      {
        icon: 'contract',
        title: '能读比特币的合约',
        text: '用 Rust 编写、编译成 WebAssembly，gas 精确计量。合约能读六块深的比特币区块头，用 Merkle 证明核验比特币付款，还能看到携带这次调用的那笔交易。',
      },
    ],
  },

  ksa: {
    label: 'KSA',
    title: '靠工作量发行，<br>上限 2.1 亿。',
    intro: 'KSA 用来支付代付操作的手续费和合约的 gas。新的 KSA 只以出块奖励的形式出现，在区块数据写进比特币之后才发放；奖励按一张跨越几十年的时间表减半。',
    stats: [
      { value: '210,000,000', label: 'KSA，总量永远不会更多' },
      { value: '4.2', label: '每个奖励槽的 KSA，5 秒一槽' },
      { value: '2 · 4 · 8', label: '减半间隔（年）：2 年后第一次，再过 4 年第二次，之后每 8 年一次' },
      { value: '≈ 220', label: '年后，每个奖励槽的奖励降到零' },
    ],
    chartCaption: '主网 KSA 的发行曲线。每一枚都是出块奖励，创世时不分配任何 KSA。',
    note: '主网尚未上线。signet 上的 KSA 是没有价值的测试币。',
    more: '奖励、手续费与携带者报酬',
    moreHref: '/docs/ksa/',
  },

  build: {
    label: '开发',
    title: '用你熟悉的<br>工具开发。',
    intro: '给浏览器和 Node 用的 TypeScript SDK，用 Rust 编写、编译成 WebAssembly 的合约，包办其余一切的命令行客户端，以及在这三者之下的 JSON-RPC。',
    links: [
      { label: '快速上手', href: '/docs/quickstart/' },
      { label: 'TypeScript SDK', href: '/docs/sdk/' },
      { label: '编写合约', href: '/docs/contracts/' },
      { label: 'JSON-RPC', href: '/docs/rpc/' },
    ],
    playground: {
      text: '也可以直接从浏览器开始。合约 Playground 里有代币、NFT、AMM、借贷、多签钱包和锁仓释放，每个都有自己的页面，可以在 signet 上使用、修改、编译和部署。',
      cta: '打开 Playground',
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
const params = await rpc.getParams(SIGNET); // 节点若在别的网络上，这里会拒绝
const wallet = new UnisatAdapter(); // 钱包的 Taproot 地址就是你的 Ksana 账户
const account = fromHex((await wallet.getAccount()).account, 32);

const { nonce } = await rpc.getAccount(account);
const { path_b } = await rpc.estimateFee();
const op = await signVmopWithWallet(
  {
    version: VMOP_VERSION,
    chain_id: params.chain_id,
    account,
    nonce,
    fee: { kind: 'Token', amount: 2n * path_b.amount }, // 路径 B：手续费用 KSA 支付
    max_gas: 10_000n, // 一笔转账正好用 10,000 gas
    action: {
      kind: 'AssetTransfer',
      asset: ksaAssetId(),
      to: parseAccount('tb1p…', btcNetworkOf(params)),
      amount: 100_000_000n, // 1 KSA：8 位小数
    },
  },
  wallet, // 钱包里签一次 BIP322，不花一聪比特币
);
const { op_id } = await rpc.submitOp(op); // 约 5 秒快轨确认
`,
      },
      {
        title: 'Rust 合约',
        lang: 'rust',
        code: `#![cfg_attr(target_arch = "wasm32", no_std)]
extern crate alloc;

use ksana_contract_sdk::{self as sdk, storage, CallResult};

sdk::entry!(dispatch);

/// 一个谁都能加一的计数器；每次加一都发出一个事件。
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
        title: '命令行',
        lang: 'sh',
        code: `# 新建一把私钥，并显示其账户的 signet 地址
ksana-cli key --chain signet alice.key

# 走路径 B 转 1 KSA（金额以基本单位计：KSA 有 8 位小数），并等到它执行
export KSANA_RPC={{signet.rpc}}
ksana-cli transfer --chain signet --key alice.key --to tb1p… --amount 100000000 --fee-token 1 --wait

# 所在区块的数据有了 6 个比特币确认，再过 5 个比特币区块，同一笔操作就显示 btc_final
ksana-cli op <op_id>
`,
      },
    ],
  },

  run: {
    label: '自己运行',
    title: '整条链，<br>你都能自己跑。',
    cards: [
      {
        title: '节点',
        text: '跟随这条链，对照比特币检查每个区块，用 CPU 挖矿，并结算你挖出的区块。',
        href: '/docs/run-a-node/',
        cta: '运行节点',
      },
      {
        title: '索引器',
        text: '只凭 bitcoind 重建整条链，不经过任何 Ksana 节点，并核验每个状态根。',
        href: '/docs/run-an-indexer/',
        cta: '运行索引器',
      },
      {
        title: '钱包',
        text: '用 Unisat 或 Xverse 走路径 B、路径 C 和充值，在托管的 signet 页面上，或连你自己的节点。',
        href: '/docs/wallet/',
        cta: '使用钱包',
      },
    ],
  },

  status: {
    label: '进展',
    states: { done: '已完成', now: '进行中', next: '下一步' },
    title: '出块要快，<br>上线要稳。',
    items: [
      {
        state: 'done',
        title: '规范已冻结',
        text: '共识规则已于 2026 年 10 月 5 日冻结。此后的任何改动，都要走升级时间表。',
      },
      {
        state: 'done',
        title: '审计与攻防',
        text: '内部安全审计，重组与扣留区块的对抗测试，模糊测试，以及节点对照索引器、长达五小时的浸泡测试。',
      },
      {
        state: 'now',
        title: '公开 signet',
        text: '运行在比特币的公开 signet 上，有种子节点、索引器、网页钱包和水龙头。只用测试币。',
      },
      {
        state: 'next',
        title: '主网',
        text: '尚未上线。signet 要先运行至少四周，在真实的手续费市场上观察结算和携带者报酬。',
      },
    ],
  },

  coda: {
    title: '一瞬之间，<br>写进比特币。',
    primary: '在 signet 上试试',
    secondary: '从快速上手开始',
    secondaryHref: '/docs/quickstart/',
  },
};
