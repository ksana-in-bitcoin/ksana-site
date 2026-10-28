---
title: 协议参数
nav: 参数
lede: devnet、signet 和主网的每一个协议参数，连同存放它的常量名，方便你在代码里找到每个取值。主网尚未上线；目前该用的网络是公开 signet。
description: Ksana 在 devnet、signet 和主网上的协议参数：常量名、单位、创世配置、本地策略的默认值，以及端口。
---

所有协议参数都集中在 `crates/ksana-primitives/src/params.rs` 这一个文件里：结构体 `Params`，以及每个网络各一个常量 `DEVNET`、`SIGNET` 和 `MAINNET`。本页对每个参数的称呼与规范和代码注释相同（`CHAIN_ID`、`ANCHOR_DEPTH`）。`Params` 里的字段就是同一个名字的小写形式，其中六个另带单位后缀（`target_block_time_secs`、`asert_half_life_secs`、`max_future_block_time_secs`、`max_timestamp_ahead_of_anchor_secs`、`min_settlement_feerate_sat_vb`、`max_wasm_memory_bytes`）。

金额以最小单位计：KSA 有 8 位小数，所以 1 KSA 等于 100,000,000 个最小单位。以秒或年给出的时间，都假定 DAA 分数按目标每 5 秒前进一个单位。主网尚未上线：它的取值就是[规范]({{repo}}/blob/main/docs/SPEC.md)所冻结的那些，规范第 13.1 节逐一给出了理由，并标出了上线前仍需实测的少数几项，例如 Argon2id 的参数。

## 三个网络

| 网络 | `CHAIN_ID` | 运行于 | 账户地址 |
| --- | --- | --- | --- |
| devnet | 1001 | 比特币 regtest，在你自己的机器上 | Taproot，以 `bcrt1p` 开头 |
| signet | 1002 | 比特币的公开 signet | Taproot，以 `tb1p` 开头 |
| 主网 | 1000 | 比特币主网（Ksana 主网尚未上线） | Taproot，以 `bc1p` 开头 |

项目在 `{{signet.host}}` 上托管 signet 的两个种子节点、索引器和网页钱包（见[公开 signet](/docs/signet/)）。节点和索引器用 `--chain devnet|signet|mainnet` 选择网络，默认是 `devnet`。`ksana-cli` 按它所连节点的链 ID 确定网络，它的 `--chain` 只用来声明你预期的网络。

链 ID 写在每个 VmOp 里，所以为一个网络签名的操作，在其他网络上都无效。它也是工作量证明所用 Argon2id 盐的一部分。

## 各网络之间的差异

| 常量 | devnet | signet | 主网 |
| --- | --- | --- | --- |
| `CHAIN_ID` | 1001 | 1002 | 1000 |
| `ANCHOR_DEPTH` | 0 | 1 | 2 |
| `NATIVE_CONFIRMATIONS` | 1 | 1 | 3 |
| `POW_LIMIT_BITS` | `0x207fffff` | `0x207fffff` | `0x1f00ffff` |
| `BLOCK_REWARD` | 990,000,000 (9.9 KSA) | 990,000,000 (9.9 KSA) | 420,000,000 (4.2 KSA) |
| `REWARD_HALVING_INTERVAL` | 25,228,800 | 25,228,800 | 12,500,000 |
| `REWARD_INTERVAL_DOUBLINGS` | 0 | 0 | 2 |
| `KSA_MAX_SUPPLY` | 1,000,000,000 KSA | 1,000,000,000 KSA | 210,000,000 KSA |

本页的其他参数在三个网络上取值都相同。signet 与 devnet 只在 `CHAIN_ID` 和 `ANCHOR_DEPTH` 上不同，`params.rs` 里有一个测试检查这一点。

路径 C 交易有了 `NATIVE_CONFIRMATIONS` + `ANCHOR_DEPTH` 个比特币确认，就会被强制收录：devnet 上 1 个，signet 上 2 个，主网上 5 个。锚定在比特币高度 A 的区块，必须收录直到高度 A − `NATIVE_CONFIRMATIONS` + 1 为止的原生交易，而出块者锚定在自己的比特币链顶之下 `ANCHOR_DEPTH` 个区块处（`crates/ksana-btc/src/native.rs`）。

## 工作量证明与难度

| 常量 | 取值 | 含义 |
| --- | --- | --- |
| `TARGET_BLOCK_TIME` | 5 秒 | 每个单位 DAA 分数的目标时间 |
| `ASERT_HALF_LIFE` | 7,200 秒 | aserti3-2d 难度调整的半衰期；这种调整按 DAA 分数计算，以创世块为锚点 |
| `POW_ALGORITHM` | Argon2id | RFC 9106，版本 0x13：消息是 Borsh 编码的区块头，盐是 `ksana-pow` 后接 4 字节小端序的链 ID，32 字节的输出按小端序读成一个数 |
| `POW_ARGON2_MEMORY` | 2,048 KiB (2 MiB) | 一次哈希所用的内存（`Argon2Params::memory_kib`） |
| `POW_ARGON2_ITERATIONS` | 1 | 遍数（`iterations`） |
| `POW_ARGON2_LANES` | 1 | 并行度（`lanes`） |
| `POW_LIMIT_BITS` | 按网络而定，见上表 | 最容易的目标值；创世配置没有给出时，它也是创世块的 `bits` |
| `EMPTY_BLOCK_DIFFICULTY` | 12 | 非空块之后第一个空块的权重 |
| `MAX_EMPTY_BLOCK_WEIGHT` | 120 | 连续空块权重的上限 |

在普通 CPU 的一个核心上，一次 Argon2id 哈希约需 1 毫秒。在主网上，`0x1f00ffff` 对应约 2^240 的目标值：在这个最低难度下，每块约需 65,536 次哈希，所以大约 13 个核心就能每 5 秒找到一个区块。创世配置可以设定更难的 `bits`，与上线时预期的算力相匹配。devnet 和 signet 用的是 `0x207fffff`，即比特币 regtest 最容易的目标值。

**两速难度**。有条目的区块权重为 1。选定链上连续的第 s 个空块，权重为 min(N × 2^(s − 1), N_MAX)，其中 N = `EMPTY_BLOCK_DIFFICULTY`，N_MAX = `MAX_EMPTY_BLOCK_WEIGHT`：依次是 12、24、48、96，之后每个都是 120（`Params::empty_block_weight`）。区块的 PoW 目标值要除以它的权重，权重还计入 DAA 分数，也决定区块占几个奖励槽，所以空闲的链大约每 1、2、4、8 分钟出一块，之后每 10 分钟一块。见[挖矿](/docs/mining/)。

## 时间戳

| 常量 | 取值 | 含义 |
| --- | --- | --- |
| `MEDIAN_TIME_SPAN` | 11 | 接收规则：新区块的时间戳必须晚于它选定链上前 11 个区块的中位数 |
| `MAX_FUTURE_BLOCK_TIME` | 15 秒 | 接收规则：新区块的时间戳最多可以比接收节点的时钟超前多少 |
| `MAX_TIMESTAMP_AHEAD_OF_ANCHOR` | 14,400 秒（4 小时） | 共识规则：时间戳最多可以比它锚定的比特币区块的时间超前多少 |

节点只在收到新区块时检查接收规则。共识规则对每个区块都成立，包括从历史中同步来的区块，以及从比特币重建的区块。

## 区块 DAG

| 常量 | 取值 | 含义 |
| --- | --- | --- |
| `GHOSTDAG_K` | 16 | 一个蓝块的反锥（anticone）中最多可以有的蓝块数 |
| `MAX_BLOCK_PARENTS` | 10 | 一个区块最多可以有的父块数 |
| `MAX_MERGESET_SIZE` | 128 | 合并集的最大规模，含选定父块 |
| `MERGE_DEPTH` | 720（蓝分数，约一小时的 5 秒区块） | 被合并区块的蓝分数最多比选定父块的低这么多，而且它的选定链必须经过合并深度根 |
| `REORG_WINDOW` | 1,000 个区块 | 按工作量切换主链时的最大深度；强制切换到已最终的链时不受它限制 |

剪枝让节点的内存占用保持有界。剪枝点的蓝分数比剪枝根至少低 `GhostdagParams::min_pruning_depth` = 3 × (`MERGE_DEPTH` + `GHOSTDAG_K`) + 1 = 2,209（`crates/ksana-consensus/src/ghostdag.rs`）。剪枝根取在多深、节点多久剪枝一次，则属于本地设置，列在[本地策略的默认值](#local-policy-defaults)中。

## 比特币锚定与最终性

| 常量 | 取值 | 含义 |
| --- | --- | --- |
| `ANCHOR_DEPTH` | 0, 1, 2 | 出块者把新区块锚定在自己的比特币链顶之下几个区块处（依次为 devnet、signet、主网） |
| `MAX_ANCHOR_LAG` | 1 个比特币区块 | 在 `ANCHOR_DEPTH` 之外，新区块的锚定块最多可以落后接收节点的比特币链顶多少 |
| `NATIVE_CONFIRMATIONS` | 1, 1, 3 | 按区块的锚定块计算，一笔路径 C 交易的比特币确认数达到这个值后，该区块就必须收录它（依次为 devnet、signet、主网） |
| `SETTLEMENT_DEPTH` | 2 个区块 | 广播一个区块的结算之前需要的快轨确认数；索引器执行尚未最终的主链区块之前，也要等这么多确认 |
| `SETTLEMENT_TIMEOUT` | 6 个比特币区块 | 一个区块的区块体在其锚定块之后过了这么多个区块仍未写入比特币时，在它写入之前，新区块只能包含强制收录条目（结算积压上限） |
| `BTC_FINALITY_CONFS` | 6 | 一个区块被判定为最终之前，它的数据及其合并的区块的数据所需的比特币确认数；做出这一判定的比特币区块也要有这么多确认，该区块才会被报告为最终 |
| `BTC_QUERY_DEPTH` | 6 | 合约只能读取比所在区块的锚定高度至少低这么多个区块的比特币区块头 |
| `MIN_SETTLEMENT_FEERATE` | 1 sat/vB | 提交交易或揭示交易的最低费率（共识规则；节点默认支付 2 sat/vB 或更高） |
| `CARRIER_REPOST_DELAY` | 2 个比特币区块 | 只有当区块的数据在其锚定块之后超过 `ANCHOR_DEPTH` + 2 个比特币区块才写入时，补发载荷的收款账户才能得到携带者报酬 |

这些数字对一笔操作多久能最终意味着什么，见[确认与最终性](/docs/confirmations/)。

## 数据上限

| 常量 | 取值 | 含义 |
| --- | --- | --- |
| `MAGIC` | `KSN1` | KSN1 数据输出和信封的标识 |
| `MAX_OP_BYTES` | 65,536 字节（64 KiB） | 编码后 VmOp 的最大长度，含合约代码 |
| `MAX_BLOCK_DATA_BYTES` | 81,920 字节（80 KiB） | 单个载荷（结算或补发）的最大长度；需要区块体的区块，只有当它的区块体能单独装进一个补发载荷时才有效 |
| `MAX_SETTLEMENT_HEADERS` | 500 | 一个载荷中最多的区块头数，在解码任何区块头之前就先检查 |
| `MAX_CHUNK` | 520 字节 | KSN1 输出或信封中单次数据 push 的最大长度（`crates/ksana-btc/src/data.rs`） |
| `MAX_SETTLEMENT_TX_BYTES` | 400,000 字节 | 提交交易或揭示交易的最大长度；`MAX_SETTLEMENT_WEIGHT` 把它的重量限制在 400,000 WU 以内（`crates/ksana-btc/src/settlement.rs`） |
| `P2A_AMOUNT_SAT` | 240 聪 | 揭示交易的 P2A 锚点输出的金额；CPFP 子交易花费这个输出，来提高这对交易的手续费 |
| `PRODUCER_SEQUENCE` | `0xFFFFFFFD` | 提交交易和揭示交易的每个输入都必须使用的 `nSequence` |
| `MAX_BIP322_SIG_BYTES` | 1,024 字节 | BIP322 simple 签名的最大长度（`crates/ksana-crypto/src/bip322.rs`） |
| `MAX_CALL_FUNDS` | 16 | 一次调用最多附带的资产数 |
| `VMOP_VERSION` | 2 | VmOp 格式的版本 |
| `BLOCK_VERSION` | 2 | 区块头版本，即尚无升级激活时的协议版本 |

最后三项在 `crates/ksana-primitives/src/lib.rs` 里。这些上限同样是共识规则：改动其中任何一项都是共识变更，和改动 `Params` 的字段一样。

## gas 与执行上限

| 常量 | 取值 | 含义 |
| --- | --- | --- |
| `BLOCK_GAS_LIMIT` | 100,000,000 | 一个区块最多的 gas，按各条目 `max_gas` 之和计算；强制收录条目按 `min(max_gas, NATIVE_MAX_GAS)` 计入，且不受这个上限约束；解锁条目计为 0 |
| `NATIVE_MAX_GAS` | 1,000,000 | 路径 C 操作最多可以申请的 gas；通过了各项检查、但申请得比这更多的操作会失败，它的 nonce 照样用掉 |
| `MAX_WASM_MEMORY` | 16 MiB（16,777,216 字节） | 合约的线性内存 |
| `MAX_CALL_DEPTH` | 8 | 合约间调用链的最大深度 |

虚拟机在 `crates/ksana-vm/src/limits.rs` 里另有一组固定上限（`MAX_CALL_INPUT_BYTES` 在 `engine.rs` 里）：

| 常量 | 取值 | 限制对象 |
| --- | --- | --- |
| `MAX_STORAGE_KEY_BYTES` | 256 字节 | 一个存储键 |
| `MAX_STORAGE_VALUE_BYTES` | 65,536 字节 | 一个存储值 |
| `MAX_CALL_INPUT_BYTES` | 65,536 字节 | 一次调用的输入，即 Borsh 编码的方法名和参数 |
| `MAX_OUTPUT_BYTES` | 65,536 字节 | 合约的返回值 |
| `MAX_EVENT_BYTES` | 16,384 字节 | 一个事件 |
| `MAX_ASSET_META_BYTES` | 1,024 字节 | `asset_issue` 和 `asset_create` 的元数据 |
| `MAX_ASSET_NAME_BYTES` | 64 字节 | 资产的名称，至少 1 字节 |
| `MAX_ASSET_SYMBOL_BYTES` | 16 字节 | 资产的符号，至少 1 字节 |
| `MAX_ASSET_DECIMALS` | 18 | 资产的小数位数 |
| `MAX_TABLE_ELEMENTS` | 4,096 | WebAssembly 表的元素数 |
| `STACK_BUDGET` | 262,144 字节 | 一个合约实例内调用链的估算栈用量，在运行时计量 |
| `MAX_INSTANCES_PER_OP` | 64 | 一个操作创建的合约实例数（每次调用都创建一个） |
| `MAX_TOTAL_MEMORY_PER_OP` | 268,435,456 字节（256 MiB） | 一个操作所有实例的线性内存合计 |

为每个宿主函数定价的 gas 表，见[宿主函数](/docs/host-functions/)。

## 奖励与总量

KSA 只以出块奖励的形式发行。每个区块占用的奖励槽数等于它的权重，也就是它所覆盖的那些 DAA 分数，每个槽按所在减半周期的奖励发放。第 k 个周期持续 `REWARD_HALVING_INTERVAL` × 2^min(k, `REWARD_INTERVAL_DOUBLINGS`) 个 DAA 分数，每槽发放 `BLOCK_REWARD` / 2^k，向下取整到整数个最小单位（`Params::reward_period_at`、`block_reward_at`）。

| 主网周期 | DAA 分数 | 每槽奖励 | 大约时间 |
| --- | --- | --- | --- |
| 0 | 0 至 12,499,999 | 4.2 KSA | 第 0 至 2 年 |
| 1 | 12,500,000 至 37,499,999 | 2.1 KSA | 第 2 至 6 年 |
| 2 | 37,500,000 至 87,499,999 | 1.05 KSA | 第 6 至 14 年 |
| 3 | 87,500,000 至 137,499,999 | 0.525 KSA | 第 14 至 22 年 |
| 4 及以后 | 每期 50,000,000 | 前一周期的一半 | 每期 8 年 |

在主网上，最后一个最小单位在第 28 周期发放；从 DAA 分数 1,387,500,000 起（约第 220 年），奖励为 0。主网所有的槽合计发放 20,999,999,600,000,000 个最小单位，比上限少 4 KSA。奖励总额的上界 `Params::max_total_rewards` = `BLOCK_REWARD` × `REWARD_HALVING_INTERVAL` × (`REWARD_INTERVAL_DOUBLINGS` + 2) 在主网上恰好等于 `KSA_MAX_SUPPLY`，所以主网没有创世分配。

在 devnet 和 signet 上，每个周期都是 25,228,800 DAA 分数（约 4 年），第一个周期每槽发放 9.9 KSA；从 DAA 分数 756,864,000（第 30 周期）起，奖励为 0。它们的奖励上界是 499,530,240 KSA，所以在 1,000,000,000 KSA 的上限之下，最多还能留给创世分配 500,469,760 KSA。

| 常量 | 取值 | 含义 |
| --- | --- | --- |
| `CARRIER_BPS` | 500 (5%) | 每个奖励槽中归区块携带者的份额，从出块者那部分里扣出 |
| `CARRIER_FEE_BPS` | 5,000 (50%) | 携带者在区块的路径 B 手续费中所占的份额；其余归出块者 |
| `MAX_UNLOCK_BATCH` | 1,024 | 一个解锁条目最多发放的区块数，按主链接受它们的顺序 |

携带者那份，在主网上是一个 4.2 KSA 的槽里的 0.21 KSA，在 signet 上是一个 9.9 KSA 的槽里的 0.495 KSA；没有谁够格成为携带者时，这份留给出块者。

奖励和手续费在解锁时发放，也就是等这个区块及其每个祖先区块的数据都写入比特币之后。[KSA 与奖励](/docs/ksa/)一页讲解发行时间表、携带者和解锁。

## 升级

三个网络的 `Params::upgrades` 都是空的：区块的协议版本是 2（`BLOCK_VERSION`），接受版本 2 的 VmOp。一个升级项从指定的 DAA 分数起提高协议版本，并可以为这些规则设定新值：`BLOCK_GAS_LIMIT`、`NATIVE_MAX_GAS`、接受的 VmOp 版本、`BLOCK_SHARE_BPS`、`BLOCK_SHARE_END`、`CARRIER_BPS` 和 `CARRIER_FEE_BPS`。其他改动，比如新的执行规则或编码，在代码里按协议版本分支，并随同一个升级项激活。

有些参数在一个网络的整个生命期内固定不变，不进升级表：`ASERT_HALF_LIFE`、`EMPTY_BLOCK_DIFFICULTY`、`MAX_EMPTY_BLOCK_WEIGHT`、Argon2id 的参数、`REWARD_INTERVAL_DOUBLINGS` 和 `CARRIER_REPOST_DELAY`。节点通过 `ksana_getChainInfo` 报告它的链 ID、协议版本和下一个排期中的升级：

```sh title="读取 signet 的链信息"
curl -s -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"ksana_getChainInfo","params":[]}' \
  {{signet.rpc}} | jq .result
```

```output
{
  "chain_id": 1002,
  "tip": {
    "height": "281",
    "hash": "d18e91c9383400d27166695177decadb89399456e55d79eb6e6164d625edaf95"
  },
  "daa_score": "12199",
  "protocol_version": 2,
  "next_upgrade": null,
  "max_known_version": 2,
  "finalized": {
    "height": "241",
    "hash": "0cb65c0a51c1200757560f9ed1a2aa28f5a01a236bbdda8005120eb609a8ae6b"
  }
}
```

DAA 分数远远跑在高度前面，因为 signet 大部分时间都处于空闲：它的空块每个权重 12 到 120。

## 创世配置

一个网络的每个节点和索引器，都从同一份创世配置启动，那是一个 JSON 文件（`crates/ksana-execution/src/genesis_file.rs`）。数据目录会记下这份配置的指纹，换了别的配置就拒绝打开。

| 字段 | devnet | signet | 主网 |
| --- | --- | --- | --- |
| `timestamp` | `devnet/init.sh` 运行的时间 | 1792553063 (2026-10-21 03:24:23 UTC) | 上线时填入 |
| `btc_anchor` | regtest 的链顶 | signet 高度 327,273 | 待填入，至少在链顶之下 2 个区块 |
| `bits` | 不给出（`0x207fffff`） | 520523192 (`0x1f068db8`) | 可选，不给出时为 `0x1f00ffff` |
| `allocations` | 给一个测试账户 10,000 KSA | 给两个账户共 110,000,000 KSA | 不允许 |
| `block_share_account` | 一个生成的账户 | 已设定，见下文 | 一个任何节点都不接受的占位符 |

- **devnet** 没有提交到仓库的文件：每次 devnet 从头启动，`devnet/init.sh` 都会写一份新的，带着新的随机密钥。
- **signet** 使用仓库中的 `signet/genesis.json`。它的 `bits` 预期每块约 10,000 次 Argon2id 哈希，这是按两个各用一个线程挖矿的种子节点定的（`signet/ksana-signet.sh`）。第一笔分配 100,000,000 KSA 供[水龙头](/docs/signet/)发放；第二笔 10,000,000 KSA 属于运营方。
- **主网**只有模板 `mainnet/genesis.json`。区块分享账户是占位符 `KSANA_BLOCK_SHARE_ACCOUNT_TBD___` 的配置，节点和索引器一律拒绝；在主网上，它们还要求设定区块分享账户、不得有分配，并且锚定块和时间戳都必须是真实的。不论配置写了什么，主网现在都不会启动：区块分享的参数尚未公布，在代码里填上之前，节点和索引器拒绝主网。

```json title="signet/genesis.json"
{
  "timestamp": "1792553063",
  "btc_anchor": {
    "height": 327273,
    "hash": "41cb1fa60f4a0803b02024c7c0fd9cabb094f2935e7fcc4e7a63f03011000000"
  },
  "bits": 520523192,
  "allocations": [
    {
      "account": "de6603f052fd5bfaae5678a2a20ae6ae4fe4ae00c89db70a2efea7429851afc0",
      "amount": "10000000000000000"
    },
    {
      "account": "6431409abb9b8434defe68b0e066cf76610ac7b1cf49f2d02bc807543877dc0e",
      "amount": "1000000000000000"
    }
  ],
  "block_share_account": "0073719af1ae0718ca4fde1055e6c5c34157eefd54302c9b19deb28927ce8d8c"
}
```

锚定块的哈希按比特币的内部字节序书写，与 `bitcoin-cli getblockhash` 打印的顺序相反。主网上线之前，共识一旦改动，signet 就会换一份新的创世配置从头开始，余额不会带过去。

## 本地策略的默认值

这些是节点自己的设置，不是共识规则：每个运营者都可以修改，设置不同的节点，认定的仍是同一条链。[运行节点](/docs/run-a-node/)一页讲解这些选项。

| 设置 | 默认值 | 含义 |
| --- | --- | --- |
| `--min-token-fee` | 1 个最小单位 | 打包门槛：本节点放进自己区块的最低路径 B 手续费 |
| `--min-relay-token-fee` | 等于打包门槛 | 中继门槛：本节点接纳并转发的最低手续费（两者之中较低的那个生效） |
| `--min-fee-per-kib` | 0 | 本节点打包的最低费率，以每 KiB 成本多少个最小单位计 |
| 条目池 | 10,000 笔操作，32 MiB | 每个账户最多 64 笔，其中最多 8 笔排在 nonce 缺口之后（没有对应的选项） |
| `--settlement-feerate` | 2 sat/vB | 本节点比特币费率的下限：bitcoind 的内存池有空位时按它支付，bitcoind 给不出估计时也按它支付 |
| `--max-settlement-feerate` | 100 sat/vB | 本节点比特币费率的上限，CPFP 加速和与竞争链赛跑时也不例外 |
| `--settlement-conf-target` | 3 个比特币区块 | `estimatesmartfee` 的目标；比特币上有一条较轻的竞争链时改为 1 |
| 内存池的空位 | 500,000 vB | bitcoind 的内存池不超过半个区块时（`ROOMY_MEMPOOL_VSIZE`），本节点新发的比特币交易按下限付费，内存池的最低费率更高时按那个费率，而不按估计；比特币上有一条较轻的竞争链时除外 |
| `BUMP_AFTER` | 2 个比特币区块 | 本节点发出的一对结算交易，若以低于 bitcoind 估计的费率等了这么久，就通过 P2A 输出加速到这个估计；内存池有空位时，还在等的一对交易至少加速到它自己费率的两倍，之后每多一个区块再翻一倍，直到上限 |
| `CLAIM_PATIENCE` | 8 个比特币区块 | 比特币内存池里有交易声称结算某个区块时，对该区块的救援最多推迟这么久（`RESCUE_ORDER_WINDOW` 6 + `RESCUE_DELAY` 2） |
| `--hot-wallet-cap-sat` | 1,000,000 聪 | 配合 `--revenue-address`：出资钱包扣除一笔结算花掉的资金后，若仍持有至少这么多，这笔结算的找零就付到收益地址 |
| `--funding-pool-target` | 64 | 要保持的已确认出资输出个数，办法是把最大的输出拆成每份至少 100,000 聪 |
| 批量结算 | 开启 | 有结算在途时（携带它的区块锚定在比特币链顶之下至多 2 个比特币区块处，`IN_FLIGHT_BTC_BLOCKS`，且它还没写入比特币），新区块把自己的区块体留给下一次结算，除非等待中的区块体，或者某个区块自己的区块体，超过 10 KiB（`MAX_BLOCK_DATA_BYTES` / `PAYLOAD_BODY_TRIGGER` 8）；`--no-settlement-batching` 让每个需要区块体的区块都自带结算 |
| 剪枝 | 开启 | 剪枝根是在比特币链顶之下至少 144 个区块处就已判定为最终的最高区块（`PRUNE_BTC_MARGIN`）；剪枝点一旦能前进 1,000 蓝分数，节点就再剪枝一次（`PRUNE_STEP`）；`--no-pruning` 保留全部数据 |
| 孤块池 | 256 个区块，32 MiB | `MAX_ORPHANS`、`MAX_ORPHAN_BYTES` |
| P2P 连接 | 入站 100 个，握手中 32 个 | 来自同一地址（IPv6 地址按其 /64 计）的入站连接最多 4 个，与同一个对等节点的连接最多 2 个；回环地址和私有地址只计入总数（没有对应的选项） |
| P2P 配额 | 区块每秒 20 个，操作每秒 1,000 个，同步请求每秒 50 个 | 令牌桶属于对等节点连接时所用的地址，突发上限分别为 100、5,000 和 200，重新连接后仍然保留；因评分被封禁的对等节点（3 分，封禁 60 秒）连同它的地址一起被封禁 |
| 等待验证的 gossip | 区块 256 MiB，操作 32 MiB | 来自同一地址的最多占各自的四分之一；长于 `MAX_OP_BYTES` 的操作在解码之前就被拒绝 |
| 同步服务 | 同时 4 个请求 | 来自同一地址的请求同时最多 16 个在处理中；正在发送的响应合计最多 256 MiB，来自同一地址的最多占四分之一；`GetMempool` 的响应最多 4 MiB |
| RPC 限制 | 批量请求 64 个调用，请求体 1 MiB | 响应 10 MiB，100 个连接，每个 WebSocket 连接 16 个订阅，节点与索引器相同（[JSON-RPC 的限制](/docs/rpc/#limits)） |
| `--btc-poll-ms` | 500 | 两次与 bitcoind 同步之间的间隔 |
| `--min-block-interval-ms` | 0 | 本节点自己两个区块之间的最短间隔 |

只读的 `ksana_call` 最多用 `BLOCK_GAS_LIMIT` 的 gas 运行，一个节点同时最多运行 4 个。

## 默认端口

| 服务 | 默认值 | 设定方式 |
| --- | --- | --- |
| 节点 JSON-RPC（HTTP 和 WebSocket） | `127.0.0.1:8545` | `--rpc-addr` |
| 索引器 JSON-RPC | `127.0.0.1:8546` | `--rpc-addr` |
| 节点 P2P | 关闭；按惯例用端口 9000 | `--p2p-listen /ip4/0.0.0.0/tcp/9000` |
| bitcoind RPC（节点、索引器、`ksana-cli`） | `http://127.0.0.1:18443` (regtest) | `--btc-rpc-url`；signet 的 bitcoind 监听 38332，主网的监听 8332 |
| `ksana-cli` 连接的节点地址 | `http://127.0.0.1:8545` | `--rpc` 或 `KSANA_RPC` |

Docker Compose 中的 devnet 把 bitcoind 发布在 18443（P2P 在 18444），三个节点在 18545 到 18547，索引器在 18548。signet 的第一个种子节点是 `{{signet.p2p}}`，其他服务地址列在[公开 signet](/docs/signet/) 一页。
