---
title: 运行节点
lede: Ksana 节点经由对等节点跟随这条链，并通过你自己的 bitcoind 对照比特币检查每个区块。给它一个账户，它就出块；给它一把出资密钥，它就把区块结算到比特币上。
description: 如何在 Ksana 的公开 signet 上运行 ksana-node：从环境要求、构建和 signet 上的 bitcoind，到跟随这条链、出块与结算、剪枝和检查。
---

节点维护快轨的区块 DAG，执行它接受的每个区块，并为钱包、应用和 `ksana-cli` 提供 JSON-RPC。它通过你运行的 bitcoind 读取比特币，因此检查锚定、结算、路径 C 操作的强制收录和最终性时，不必信任任何人。本页在[公开 signet](/docs/signet/) 上搭建一个节点；主网尚未上线。

## 节点做什么

- **跟随**：不给账户时，节点从对等节点同步区块，逐个检查，转发区块和操作，并响应 RPC 调用。
- **出块**：加上 `--producer <account>` 后，它还会挖矿（在一个 CPU 核心上计算 Argon2id 工作量证明），赚取所出区块的奖励和路径 B 手续费。
- **结算**：再给它一把出资密钥，它就支付比特币交易的费用，把所出区块的数据写进比特币。没有出资密钥时，由其他出块者携带这些数据，并拿走奖励中携带者的那一份。

[挖矿](/docs/mining/)讲出块和结算如何获得报酬；本页讲如何搭建。

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 系统 | 经过测试的平台是 Ubuntu 22.04。 |
| Rust | `rust-toolchain.toml` 里的版本（1.98.1），由 `rustup` 安装 |
| 比特币 | 运行在 signet 上、开启 `-txindex=1` 的 Bitcoin Core，装在同一台机器上，或能通过明文 HTTP 访问 |
| 磁盘 | bitcoind 的 signet 链连同索引约 30 GB；节点自己的数据目录很小 |
| 内存 | 节点约 150 MiB；bitcoind 的内存另计 |
| CPU | 出块时占用一个核心，挖矿会让它一直忙着 |
| 端口 | 为 P2P 开放 TCP 9000；节点的 RPC（8545）和 bitcoind 的 RPC（38332）只留在本机 |

作为参照：托管的 signet 在一台 4 核、8 GB 内存的服务器上运行 bitcoind、两个出块节点、索引器和网页服务；它的运维指南则要求，只跑一个出块节点时，至少 2 核、4 GB 内存和 80 GB 磁盘。在一次 10 小时的 devnet 浸泡测试中，各节点结束时的常驻内存为 130 到 149 MiB；跑完 7,308 个区块后，一个节点的数据目录约 58 MB。

## 构建

按[快速上手](/docs/quickstart/)中的方法安装构建工具和 `rustup`，然后一次构建好节点、索引器、CLI 和密钥工具：

```sh
git clone {{repo}}
cd ksana
rustup toolchain install
cargo build --release --locked -p ksana-node -p ksana-indexer -p ksana-cli --bins
```

构建完成后，`target/release/` 里会有 `ksana-node`、`ksana-keytool`、`ksana-indexer` 和 `ksana-cli`。第一次构建要从源码编译 RocksDB、wasmtime，以及节点和索引器所用的 jemalloc：在 2 核机器上约需半小时，在 4 GB 内存的机器上还需要一些交换空间。

## 在 signet 上运行 bitcoind

从 [bitcoincore.org](https://bitcoincore.org/) 安装 Bitcoin Core（托管的 signet 运行的是 31.1），设一个 RPC 密码，然后在 signet 上带交易索引启动它：

```sh
export KSANA_BTC_RPC_PASS='<a password of your choice>'
bitcoind -signet -daemon -server -txindex=1 -rpcuser=ksana -rpcpassword="$KSANA_BTC_RPC_PASS" \
  -rpcbind=127.0.0.1 -rpcallowip=127.0.0.1
BCLI="bitcoin-cli -signet -rpcuser=ksana -rpcpassword=$KSANA_BTC_RPC_PASS"
$BCLI getblockchaininfo | jq '{blocks, initialblockdownload}'
```

第一次同步要下载 signet 链，需要几个小时。等到 `initialblockdownload` 变为 `false`：只要 bitcoind 的最优链还不包含 signet 的创世锚定，节点就会拒绝启动（`the genesis anchor block (height 327273) is not on bitcoind's best chain`）。bitcoind 在 signet 上的 RPC 端口是 38332。

Bitcoin Core 30 及更高版本还会转发你用 `ksana-cli` 发出的路径 C 交易里那个较大的 `OP_RETURN` 输出；更早的版本要加 `-datacarriersize=100000` 才会转发。结算把数据放在 Taproot 见证里，所有版本都会转发。

## 创世配置

一个网络里的每个节点和索引器，都从同一份创世配置启动。signet 的创世配置是仓库里的 `signet/genesis.json`：

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

它规定了起始时间、这条链锚定的比特币区块（其哈希按比特币的内部字节序书写，与区块浏览器显示的顺序相反）、起始难度、创世分配（水龙头和运营方的 KSA），以及区块分享账户。数据目录会记住创建它时所用的配置；换一份配置，节点就以 `data directory belongs to a different genesis config` 拒绝启动。signet [从创世重启](/docs/signet/#restarts-from-genesis)时，先拉取仓库，再用新的数据目录启动。

## 跟随 signet

在仓库目录下，按上文设好 `KSANA_BTC_RPC_PASS` 后运行：

```sh
target/release/ksana-node --chain signet --data-dir ~/ksana-signet/node \
  --genesis signet/genesis.json \
  --btc-rpc-url http://127.0.0.1:38332 --btc-rpc-user ksana \
  --p2p-listen /ip4/0.0.0.0/tcp/9000 --peer {{signet.p2p}}
```

- `--chain signet` 选用 signet 的参数；不加它，节点运行的是 devnet。
- `--data-dir` 存放区块存储、状态、节点的 P2P 身份（`p2p.key`）和剪枝检查点。目录不存在时会自动创建。
- `--btc-rpc-url` 和 `--btc-rpc-user` 用来连接 bitcoind，密码由节点从 `KSANA_BTC_RPC_PASS` 读取，这样它不会出现在进程列表里（也可以用 `--btc-rpc-pass`）。只支持 `http://` 地址。
- `--p2p-listen` 开启 P2P 网络，`--peer` 拨号连接托管的种子节点；要连更多对等节点，就重复 `--peer`。节点最多接受 100 个入站对等节点，来自同一地址的最多 4 个；对等节点发来三个无效的区块或操作，就连同它的地址一起被封禁一分钟（[本地策略的默认值](/docs/parameters/#local-policy-defaults)）。

节点把日志写到标准错误。它先打印 `[ksana-node] network layer started: peer id …` 和 `[ksana-node] started: main-chain height …, tip …`，等 RPC 开始监听后，再向标准输出打印 `ksana-node rpc=127.0.0.1:8545`。接着它从种子节点同步；最终性每向前推进一次，它就记录一行 `[ksana-node] BTC final: block … at height …`。按 Ctrl-C 或发送 `SIGTERM` 可以停止它。

### RPC 接口

节点在 `--rpc-addr` 上通过 HTTP 和 WebSocket 提供 JSON-RPC，默认是 `127.0.0.1:8545`（要写 IP 地址和端口，主机名会被拒绝）。RPC 没有认证，所以只在本机开放；如果要给别人用，就把它放在你掌控的代理后面。它接受的批量请求最多 64 个调用、请求体最多 1 MiB，同时最多保持 100 个连接，每个 WebSocket 连接最多 16 个订阅（[限制](/docs/rpc/#limits)）；这些限制没有对应的选项，放在它前面的代理可以再对每个客户端加以限制。

让 `ksana-cli --rpc http://127.0.0.1:8545` 或你的应用连接它。其他来源上的浏览器页面需要 `--rpc-cors`：`--rpc-cors https://{{signet.host}}` 让 [signet 钱包](/docs/wallet/)能把你的节点用作数据源，`--rpc-cors '*'` 允许所有来源，用逗号分隔的列表则允许多个来源。

### 确认运行正常

节点追上之后，它的链顶就与托管节点的一致（最新的一个区块可能有出入）：

```sh
for rpc in http://127.0.0.1:8545 {{signet.rpc}}; do
  curl -sS "$rpc" -H 'content-type: application/json' \
    --data '{"jsonrpc":"2.0","id":1,"method":"ksana_getChainInfo","params":[]}' | jq -c .result.tip
done
```

然后：

- 留意日志里的 `decided final` 和 `BTC final` 行：它们说明你的节点在根据你自己的 bitcoind 判定最终性。
- 通过你的节点读取一个账户，例如 `ksana-cli --rpc http://127.0.0.1:8545 account @alice.key`。
- 在旁边再运行一个[索引器](/docs/run-an-indexer/)，比对两者的状态根。

## 出块

### 选择收款账户

`--producer` 指定接收你的区块奖励和路径 B 手续费的账户：可以是你掌控的某个钱包里的 `tb1p…` 地址，也可以是一个密钥文件的 `account`：

```sh
target/release/ksana-keytool producer.key | jq .
```

```output
{
  "account": "02ee9753ea3f23d2cdd3c1d5b5caba98acc43e07074f8e8ec59db63d7dffe6fe",
  "funding_script": "512002ee9753ea3f23d2cdd3c1d5b5caba98acc43e07074f8e8ec59db63d7dffe6fe",
  "internal_key": "e7798d3c642863091e43f81dc4cc24acd6726b23702e4ebce8ae00cdffd50084",
  "mainnet_address": "bc1pqthfw5l28u3a9nwnc82mtj46nzkvg0s8qa8cark9nkmr6l0lumlqgkmm4q",
  "regtest_address": "bcrt1pqthfw5l28u3a9nwnc82mtj46nzkvg0s8qa8cark9nkmr6l0lumlqj88j64",
  "signet_address": "tb1pqthfw5l28u3a9nwnc82mtj46nzkvg0s8qa8cark9nkmr6l0lumlql7d500"
}
```

`ksana-keytool <file>` 在密钥文件不存在时创建它（权限 `0600`），并打印这把密钥的账户和各个地址。要用 `account`，不要用 `internal_key`：账户是 Taproot 输出公钥。`ksana-cli key` 读取的也是这种文件，所以之后用 `ksana-cli account @producer.key` 就能看到这个账户挣了多少。

在上面的命令里加上 `--producer <account>`，节点就会用一个核心挖矿。在 signet 上，每个区块付给出块者的，是它每个奖励槽 9.9 KSA 中的一部分，再加上它收录的路径 B 手续费；区块的数据写进比特币后，这笔奖励才会解锁，在此之前 `ksana-cli account` 把它列在 `locked_fees` 下。详见 [KSA 与奖励](/docs/ksa/)。

### 自己结算区块

没有出资密钥，你的区块照样收录路径 B 操作，由其他出块者的结算把这些区块的数据带上比特币。把一个区块的数据写进比特币的节点，就是这个区块的携带者：它从你的那一份中拿走该区块每个奖励槽的 5%，以及一半的路径 B 手续费。

要自己结算区块，就给节点一把出资密钥：它是 signet 上的一个热钱包，用里面的 sBTC 支付提交交易和揭示交易。在 signet 上，节点通过你的 bitcoind 里的一个仅观察（watch-only）钱包列出这把密钥的币，没有这个钱包就拒绝启动，因为扫描一遍 signet 的整个 UTXO 集要 30 到 50 秒。

::: steps

### 生成出资密钥

```sh
target/release/ksana-keytool funding.key | jq .
```

sBTC 要转到 `signet_address`，`funding_script` 是它的输出脚本。

### 创建仅观察钱包

在转入 sBTC 之前做这一步，这样钱包才能看到它到账：

```sh
SCRIPT=$(target/release/ksana-keytool funding.key | jq -r .funding_script)
$BCLI -named createwallet wallet_name=ksana-funding disable_private_keys=true blank=true \
  load_on_startup=true
DESC=$($BCLI getdescriptorinfo "raw($SCRIPT)" | jq -r .descriptor)
$BCLI -rpcwallet=ksana-funding importdescriptors '[{"desc": "'"$DESC"'", "timestamp": "now"}]'
```

如果 sBTC 在导入之前就已确认，就从它到账之前的某个 signet 高度起重新扫描：`$BCLI -rpcwallet=ksana-funding rescanblockchain <height>`。

### 向地址转入资金

向 `signet_address` 转入 sBTC，至少分成三个输出，因为每笔在途的结算都要占用一个。总共 0.006 sBTC 就够起步；一个产出三分之一区块的节点，按 2 sat/vB 每天约花 0.00025 sBTC（有流量时最多 0.0005），所以 0.02 sBTC 约可用六周。然后等这些输出确认。

### 用这把密钥启动节点

```sh
target/release/ksana-node --chain signet --data-dir ~/ksana-signet/node \
  --genesis signet/genesis.json \
  --btc-rpc-url http://127.0.0.1:38332 --btc-rpc-user ksana \
  --p2p-listen /ip4/0.0.0.0/tcp/9000 --peer {{signet.p2p}} \
  --producer <account> --btc-funding-key-file funding.key \
  --btc-funding-wallet ksana-funding --funding-pool-target 0
```

节点在启动时检查这个钱包，并记录 `the funding outputs are listed from bitcoind's wallet ksana-funding`。如果这个钱包没有监视该地址，节点会拒绝启动，并指出要导入哪个描述符。

:::

一对结算交易约 316 到 383 vB，外加一个 240 聪的锚点输出，按 2 sat/vB 算约 1,000 聪。即使 signet 处于空闲，大约每两个比特币区块也会发出一对，由携带它的那个区块的出块者付费。用 `$BCLI -rpcwallet=ksana-funding listunspent 0` 查看资金，低于 0.002 sBTC 或不足三个输出时就补充：资金耗尽的节点会继续出块，但它的区块数据要等别的出块者来携带。

`--funding-pool-target 0` 让输出保持你转入时的样子。默认情况下（64），只要可用的输出少于 64 个，节点就会把最大的那个输出拆成每份至少 100,000 聪的若干份；托管的种子节点用的是 0，改为一开始就用多个输出注资。

::: warning 出资密钥是热钱包
节点会自动用它签名，任何能读到 `funding.key` 的人都能花掉这个地址上的币。那里只存放结算所需的金额；其余的交给收益地址。
:::

### 手续费策略

这些选项决定你的节点为自己的比特币交易（结算、救援和补发）支付多少手续费。它们属于本地策略：其他节点不会检查。

| 选项 | 默认值 | 设定的内容 |
| --- | --- | --- |
| `--settlement-feerate` | `2` | 最低费率，单位 sat/vB；下一个比特币区块还有空位时按它支付，bitcoind 没有估计值时也按它支付。 |
| `--max-settlement-feerate` | `100` | 最高费率，加速时也不超过它。 |
| `--settlement-conf-target` | `3` | bitcoind 的 `estimatesmartfee` 所用的确认目标，以比特币区块数计。 |

bitcoind 的内存池不超过半个区块（500,000 vB）时，下一个比特币区块装得下所有在等的交易，节点就按下限付费；内存池自己的最低费率更高时，按那个费率付。内存池更满时，节点在下限和上限之间按 bitcoind 的估计付费。比特币上出现一条较轻的竞争链时，它改为以下一个区块为目标，不管有没有空位。一对结算交易若已等了 2 个比特币区块，付的费率又低于估计，就会得到一笔花费其锚点输出的 CPFP 子交易；内存池有空位时，等了 2 个区块还没确认的一对交易会得到一笔子交易，把它至少拉到自己费率的两倍，之后每多一个区块再翻一倍，直到上限。在 signet 上请把下限保持为 2：2026 年 10 月 13 日，signet 的区块没有收录任何低于 2 sat/vB 的交易，1 sat/vB 的交易则一直在等待。上限请像托管的种子节点一样设为 5（`--max-settlement-feerate 5`）：bitcoind 的估计可能远高于 signet 的区块实际收录的费率，2026 年 10 月 16 日起它就一直停在 100 sat/vB。

路径 B 有自己的本地策略：`--min-token-fee`（默认 1）是你的区块收录的最低手续费，以 KSA 最小单位计；`--min-relay-token-fee` 是你的节点接纳并转发的最低手续费（默认与前者相同）；`--min-fee-per-kib`（默认 0，不设限）是费率的下限。它们如何起作用，见[操作与手续费](/docs/submitting-ops/)。

### 收益地址

`--revenue-address <tb1… address>` 让热钱包保持小额。如果不算一笔结算花掉的币，出资地址仍持有至少 `--hot-wallet-cap-sat`（默认 1,000,000 聪），这笔结算的找零就转到收益地址，而不是回到出资地址。它需要配合 `--btc-funding-key-file` 使用，而且这个地址必须是出资地址以外的一个标准 signet 地址。

### 其他出块选项

| 选项 | 默认值 | 作用 |
| --- | --- | --- |
| `--carrier-payee <account>` | `--producer` 的账户 | 你的节点通过补发把另一个区块的数据写进比特币时，由这个账户接收携带者报酬。 |
| `--no-settlement-batching` | 批次结算开启 | 每个需要结算的区块各自发送结算，而不是由下一个区块用一对交易把积压的数据一起带走。 |
| `--min-block-interval-ms <ms>` | `0` | 你的两个区块之间的最短间隔；种子节点用的是 1000。 |

## 剪枝与内存

剪枝默认开启，让节点的内存占用保持有界。一个区块成为 BTC 最终、再过 144 个比特币区块（在 signet 上约一天）之后，节点就以 1,000 个区块为一步，从内存中丢掉它仍可能切换到的任何链都不再需要的数据。每次剪枝都会把 `pruning.ckpt` 写进数据目录，重启时从它继续。磁盘上的区块存储保留每一个区块，所以远远落后、正在同步的对等节点，仍能从这个节点拿到旧区块。

`--no-pruning` 把全部历史留在内存里，内存会随着链增长。在 Linux 上，节点用 jemalloc 分配内存，并限制 RocksDB 的写缓冲区和缓存；每次剪枝时，它都会记录 RocksDB 的内存用量。

比特币重组的深度一旦超出剪枝后节点保留的范围，节点就会停止，并提示必须重新同步：用空的数据目录重新启动它。这样的重组，必须推翻已经最终了一天的区块。

## 常见启动错误

| 消息 | 原因 |
| --- | --- |
| `BTC data source error: … Connection refused` | bitcoind 没有运行，或者 `--btc-rpc-url` 写错了。 |
| `the genesis anchor block (height 327273) is not on bitcoind's best chain` | bitcoind 还没同步到那个高度，或者运行在别的网络上。 |
| `data directory belongs to a different genesis config` | 这个目录属于另一个网络，或者属于更早的一次 signet。 |
| `--btc-funding-key-file on signet needs --btc-funding-wallet as well` | 加上仅观察钱包。 |
| `--peer requires --p2p-listen as well` | 加上 `--p2p-listen`。 |
