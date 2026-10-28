---
title: 运行索引器
lede: 索引器只凭比特币重建整条链。它读取结算写进比特币的数据，执行每个主链区块，并核对每个区块的状态根，因此你不必信任节点，也能验证它。
description: 如何在 Ksana 的公开 signet 上运行 ksana-indexer、读取它的 JSON-RPC、把它的状态根与节点比对，以及它的告警、重启和剪枝各意味着什么。
---

`ksana-indexer` 不与任何 Ksana 节点通信。它只需要同一个比特币网络上的 bitcoind，从中收集结算和补发写进比特币的区块头和区块体。它据此构建出与节点相同的区块 DAG 和主链，执行主链区块，并检查每个区块的 `state_root` 是否与它自己算出的一致。

::: figure architecture
节点之间相互通信，并读写比特币；索引器只读比特币，它的状态根必须与节点的一致。
:::

## 为什么要运行索引器

- **核对节点**。当你的索引器和某个节点在同一高度报告相同的状态根时，那个节点在该高度的状态，恰好就是比特币上的数据所决定的状态。对托管节点也同样适用。
- **只依赖比特币**。索引器用到的一切都在比特币上，因此它证明了：即使所有 Ksana 节点都消失了，这条链也能重建。
- **核对最终性**。它用与节点相同的规则，从比特币判定哪些区块已最终；一旦有对不上的地方，就发出告警。

[signet 钱包](/docs/wallet/)的**验证**页面，对托管的索引器和节点做的正是同样的比对。

## 构建与运行

索引器可以和节点一起构建（见[运行节点](/docs/run-a-node/)），也可以单独构建：

```sh
cargo build --release --locked -p ksana-indexer
```

它需要一个运行在 signet 上、开启 `-txindex=1`、并已同步过 signet 创世锚定的 bitcoind；怎样启动，见[运行节点](/docs/run-a-node/#run-bitcoind-on-signet)。然后在仓库目录下运行：

```sh
export KSANA_BTC_RPC_PASS='<your bitcoind RPC password>'
target/release/ksana-indexer --chain signet --data-dir ~/ksana-signet/indexer \
  --genesis signet/genesis.json \
  --btc-rpc-url http://127.0.0.1:38332 --btc-rpc-user ksana
```

`--chain signet` 和创世配置必须与节点的相同，数据目录也会记住创建它时所用的创世配置。密码取自 `KSANA_BTC_RPC_PASS`（或 `--btc-rpc-pass`），连接 bitcoind 只能用明文的 `http://`。

| 选项 | 默认值 | 设定的内容 |
| --- | --- | --- |
| `--rpc-addr <IP:PORT>` | `127.0.0.1:8546` | JSON-RPC 的监听地址。 |
| `--poll-ms <ms>` | `500` | 两轮读取 bitcoind 之间的间隔。 |
| `--no-pruning` | 剪枝开启 | 把全部历史保留在内存里。 |

索引器没有 CORS 选项：浏览器页面只能通过与页面同源的代理访问它，托管钱包用 `{{signet.indexer}}` 就是这样做的。

启动时，它向标准错误写出 `[ksana-indexer] started: verified height …, state root …`，向标准输出写出 `ksana-indexer rpc=127.0.0.1:8546`。追赶进度时，它会记录 `verified up to height … (block tree main-chain height …, BTC height …)`；最终性每向前推进一次，就记录 `decided final: block … at height …`；BTC 最终链顶跟上时，再记录 `BTC-final: block … at height …`。第一次同步 signet 所需的时间，与读完创世锚定以来的比特币区块所需的时间相当。

### 它落后节点多少

只有当某笔结算或补发把一个区块的数据带进了比特币区块，索引器才能看到这个区块。之后，一个主链区块要在索引器的主链上有 2 个确认（signet 上的 `SETTLEMENT_DEPTH`），或者已经最终，索引器才会核对它。所以它已核对的高度落后于节点的链顶，差的正是那些数据还没进入比特币区块的区块，在 signet 上通常是最近几分钟的区块。

## JSON-RPC 接口

索引器通过 HTTP 和 WebSocket 应答两个方法。`indexer_status` 报告它的进度：

```sh
curl -sS {{signet.indexer}} -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"indexer_status","params":[]}'
```

```output
{"jsonrpc":"2.0","id":1,"result":{"height":"51","hash":"5b69b10223571ab01bdee3080d8e1ed25c8ace4fc420f744d23b7d8d5db15981","state_root":"bd7ad23935fc366400a48eb8591696171be864520fd981c3204f9d5e64cc0963","btc_height":327291,"finalized":{"height":"38","hash":"ab3fe1dcb95f0d76cd171210567f571fcd81cc8f7559d68da7dd38348eec7cf2"},"halted":null}}
```

- `height`、`hash` 和 `state_root`：它已执行并核对的最高区块。
- `btc_height`：它已读到的比特币高度（是一个数字，这一点与快轨高度不同）。
- `finalized`：它的 BTC 最终链顶，按与节点相同的规则从比特币得出。
- `halted`：一切正常时为 `null`；否则是它停止的原因（见[下文](#alarms)）。

`indexer_stateRoot` 接受一个高度、`"latest"` 或一个区块哈希，只对已核对的区块作答；对其他区块，它返回 `-32004`，即 `the block has not yet been executed and verified by the indexer`：

```sh
curl -sS {{signet.indexer}} -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"indexer_stateRoot","params":["29"]}'
```

```output
{"jsonrpc":"2.0","id":1,"result":{"height":"29","hash":"88ab3dd805eac5654cdd752dc1a0a50c2c8d4fac581e2c46b2bd65bc7f35bb50","state_root":"2138690c600b998a923498e86eea30bef23c9ae5ee5d4eea79527e9a04d25f78"}}
```

`ksana-cli` 不能和索引器通信，因为它需要节点的方法；请改用 `curl` 或 [TypeScript SDK](/docs/sdk/) 的索引器客户端。

## 与节点比对状态根

这个脚本把索引器最近核对的五个高度，与节点在同样高度上的区块逐一比较。把 `NODE` 和 `INDEXER` 设成你自己的，或者沿用托管的；它需要 `curl` 和 `jq`。

```sh title="compare-roots.sh"
NODE={{signet.rpc}}
INDEXER={{signet.indexer}}
call() {  # 参数依次为 url、method、params
  curl -sS "$1" -H 'content-type: application/json' \
    --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$2\",\"params\":$3}" | jq -c .result
}
top=$(call "$INDEXER" indexer_status '[]' | jq -r .height)
for h in $(seq $((top - 4)) "$top"); do
  a=$(call "$INDEXER" indexer_stateRoot "[\"$h\"]" | jq -c '[.hash, .state_root]')
  b=$(call "$NODE" ksana_getBlock "[\"$h\"]" | jq -c '[.hash, .header.state_root]')
  if [ "$a" = "$b" ]; then echo "$h same $a"; else echo "$h DIFFERENT indexer $a node $b"; fi
done
```

```output
47 same ["c52236bffa3e7c70c065fb44c81ce32c5926384a32e290cb6ef0fdadc9c777f6","2b467e3a07620190a59be9fc28fd31e913c132178f5fa4773011e51e9cb523ea"]
48 same ["2ca734d18afaae94bf0ac04c55a5d17a47a198f4512a19eb19f1c1b867635e41","e99d23768dbb247f974ca842623c26072832101b82db58a64cbf5d177f8e45e8"]
49 same ["ce36e3736a66c3773ed309cae018dd6e51fe2e4ad1e11b7d46893238026882a6","bd7ad23935fc366400a48eb8591696171be864520fd981c3204f9d5e64cc0963"]
50 same ["a8975ea2295f05403e1f943a09a3c28467415449302481dae475602f4ab4c8b5","bd7ad23935fc366400a48eb8591696171be864520fd981c3204f9d5e64cc0963"]
51 same ["5b69b10223571ab01bdee3080d8e1ed25c8ace4fc420f744d23b7d8d5db15981","bd7ad23935fc366400a48eb8591696171be864520fd981c3204f9d5e64cc0963"]
```

区块哈希和状态根都必须一致。这里的区块 48 和 49 各含一笔操作，状态根随之改变；50 和 51 是空块，空块不改变状态，所以沿用 49 的状态根。

刚发生比特币重组或主链切换时出现的差异，可能会持续到双方都跟上为止。如果差异停留在双方早已越过的高度上，就说明节点和索引器对同一个区块的执行结果不同：请保留双方的数据目录，并按[安全](/docs/security/)页面的说明报告。

## 告警

索引器把问题写到标准错误，每行以 `[ksana-indexer] alarm` 开头。大多数告警描述的是它自己就能处理的情况：

| 告警 | 索引器的处理 |
| --- | --- |
| `block … at height … is invalid (…)` | 节点也会拒绝这个区块；索引器把它排除在外，并重新选择主链。 |
| `block … cannot land (…)` | 把这个区块排除在外，并重新选择主链。 |
| `a BTC reorg took the anchor of main-chain block … off the BTC best chain` | 退到这个区块之下，并重新选择主链。 |
| `block … met the BTC finality condition but is invalid` | 把这个区块以及建立在它之上的每个区块，都排除在最终性之外。 |

比特币重组如果只撤销了尚未报告的判定，就不算告警：索引器记录 `a BTC reorg revoked finality decisions, taking back nothing reported as BTC-final`，并在新链上重新判定。

有四种最高级别的告警需要你来处理：

- `alarm (highest level): … processing halted` 会让索引器停止，同时在 `indexer_status` 里显示为 `halted`。一个被比特币判为最终的区块，结果却是无效的：要么是快轨让一个无效区块成了最终区块，要么是 Ksana 的软件在不同机器上算出了不同的结果。请保留数据目录并报告。
- `alarm (highest level): a BTC reorg took back BTC-final block … at height …` 表示一次至少 6 个区块的比特币重组，深及判定某个区块的那个比特币区块，而索引器此前已把这个区块报告为最终。索引器会沿新链继续；这个区块如果被重新判定，会再次被报告为最终。从这个区块起你当作已最终的一切，都需要核查。
- `the payload contains a block header of protocol version …, but this indexer only supports up to …` 表示网络已经升级了规则。索引器会在变更之前停下；请从仓库更新它。
- `cannot check block header … in the payload` 表示这台机器没能算出某个区块头的工作量证明，这是本地故障，比如内存分配失败。索引器不会据此判定任何区块，它会记录 `sync failed (will retry later)` 并重试；如果这条告警反复出现，请检查这台机器。

## 重启与剪枝

索引器把工作成果保存在数据目录里（`state/`、`index/`、`indexer.json` 和 `pruning.ckpt`）。重启后，它先把存下的状态与比特币上的数据核对一遍，bitcoind 落后时就等着，然后记录 `verification against the BTC data complete: continuing from height …`。

剪枝默认开启，做法与节点相同：内存只保留它仍可能跟随的那些主链所需的数据，在此之下的已核对主链由磁盘上的索引来应答，每次剪枝都写下一个检查点，下次启动就从那里继续。在一次 10 小时的 devnet 浸泡测试中，索引器跑完 7,308 个区块后，常驻内存为 67 MiB，数据目录约 45 MB。

如果无法从保留的数据继续，索引器会自己从创世锚定重新开始：比特币重组深过它保留的范围、主链离开它的剪枝根，或者索引丢失时，都是如此。它会记录一条告警，然后从 bitcoind 重建全部数据，耗时与第一次同步相当。signet [从创世重启](/docs/signet/#restarts-from-genesis)后，给它新的创世配置和新的数据目录。
