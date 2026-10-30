---
title: 公开 signet
nav: 公开 signet
lede: Ksana 的公开测试网络运行在比特币的 signet 上。用它试用钱包、应用、合约和节点，所用的币没有任何价值。
description: Ksana 公开 signet 的服务地址、水龙头、限制和参数。它是运行在比特币 signet 上的测试网络，链 ID 为 1002。
---

公开 signet 是目前可以使用的 Ksana 网络。它运行在比特币的公开 signet 上，也就是 Bitcoin Core 加上 `-signet` 所加入的那个测试网络，所以它的结算都是真实的比特币交易，位于真实的 signet 区块中，由 signet 的矿工挖出。主网尚未上线。

| | |
| --- | --- |
| 网络名 | `signet`（节点、索引器和 CLI 都用 `--chain signet`） |
| 链 ID | 1002 |
| 比特币网络 | signet：地址以 `tb1` 开头，账户以 `tb1p` 开头 |
| 启动 | 2026 年 10 月 21 日，锚定在 signet 高度 327,273 |
| 创世配置 | 仓库中的 [`signet/genesis.json`]({{repo}}/blob/main/signet/genesis.json) |

::: warning 仅限测试币
signet 上的 KSA 和 signet 比特币（sBTC）都没有价值。测试密钥和真实密钥要分开保管，绝不要把真正的比特币发到你为 signet 生成的地址上。
:::

## 项目托管的服务

项目在 `{{signet.host}}` 上运行一台服务器，上面有运行在 signet 上的 Bitcoin Core、两个负责出块和结算的种子节点、一个核对它们的索引器、网页钱包、一个 KSA 水龙头，以及一个小型的比特币 RPC 代理。网络上的其余一切都由加入者自己运行：你可以用[自己的节点](/docs/run-a-node/)跟随这条链，用[自己的索引器](/docs/run-an-indexer/)核对它，还可以挖矿。

| 服务 | 地址 | 可跨源调用 |
| --- | --- | --- |
| 网页钱包与区块浏览器 | `{{signet.wallet}}` | |
| 节点 JSON-RPC（HTTP） | `{{signet.rpc}}` | 是 |
| 节点 JSON-RPC（WebSocket） | `{{signet.ws}}` | 是 |
| 索引器 JSON-RPC | `{{signet.indexer}}` | 否 |
| 比特币 RPC 代理 | `{{signet.btc}}` | 否 |
| KSA 水龙头 | `{{signet.faucet}}` | 否 |
| 种子节点 P2P | `{{signet.p2p}}` | |

只有节点的 RPC 会应答来自其他来源的浏览器页面（它的 CORS 设为 `*`）。部署在自己域名上的网页应用可以在浏览器里直接调用 `{{signet.rpc}}`，但索引器、比特币 RPC 代理和水龙头只能经由它自己的服务器访问。命令行工具和服务器则可以调用以上所有服务。

```sh title="向节点查询链顶"
curl -sS {{signet.rpc}} -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"ksana_getChainInfo","params":[]}'
```

```output
{"jsonrpc":"2.0","id":1,"result":{"chain_id":1002,"tip":{"height":"61","hash":"d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f"},"daa_score":"1860","protocol_version":2,"next_upgrade":null,"max_known_version":2,"finalized":{"height":"38","hash":"ab3fe1dcb95f0d76cd171210567f571fcd81cc8f7559d68da7dd38348eec7cf2"}}}
```

[JSON-RPC 参考](/docs/rpc/)列出了节点和索引器的每一个方法。

## 水龙头

水龙头从它的创世分配中拿出 100 KSA，以一笔普通的路径 B 转账发给任意 signet 账户。网页钱包会替你调用它；在其他地方，就 `POST` 一个带上你账户的 JSON 请求体：

```sh
curl -sS {{signet.faucet}} -H 'content-type: application/json' \
  --data '{"to": "tb1pgtxpryjkcus8l9cazy7eprtxml6hnuhefe3wa55sylmp7n2jf5kshm2h5s"}'
```

```output
{"op_id":"032d7d956cff983e57db09411a345aae134aa12b8b0c72305f8cdccfad4bb4b2","to":"42cc119256c7207f971d113d908d66dff579f2f94e62eed29027f61f4d524d2d","amount":"10000000000","nonce":"2"}
```

`to` 可以是 signet 的 Taproot 地址，也可以是写成 64 位十六进制的账户。节点把这笔转账接受进条目池时，应答就会返回，而不是等到区块收录它：用 `ksana-cli op` 或 `ksana_getOpStatus` 跟踪 `op_id`。`amount` 以最小单位计（KSA 有 8 位小数）。

`GET` 请求返回水龙头自身的状态：

```sh
curl -sS {{signet.faucet}}
```

```output
{"chain_id":1002,"account":"de6603f052fd5bfaae5678a2a20ae6ae4fe4ae00c89db70a2efea7429851afc0","address":"tb1pmenq8uzjl4dl4tjk0z32yzhx4e87ftsqezwmwz3wl6n59xz34lqqlgaqc2","balance":"9999949999999995","amount":"10000000000","cooldown_hours":24,"waiting":0}
```

`waiting` 是水龙头已经发出、但还没有被任何区块收录的转账笔数。

### 水龙头的限制

| 限制 | 达到限制时的应答 |
| --- | --- |
| 每个账户每 24 小时一次 | 429 `this account already received KSA; it can ask again in N hour(s)` |
| 每个客户端地址每天 5 次 | 429 `this address has asked too often today` |
| 每个客户端地址每分钟 30 次 | 429 `too many requests from this address; slow down` |
| 所有人合计每小时约 120 笔转账 | 429 `the faucet is busy; try again in a few minutes` |
| 48 笔转账在等待区块收录 | 503 `the faucet has many transfers waiting for a block; try again in a minute` |

每个错误都是一个 JSON 对象 `{"error": "<message>"}`；在等待时间可知时，429 和 503 应答会带上以秒为单位的 `Retry-After` 头。请求体或账户格式不对，返回 400 并附上原因；节点拒绝这笔转账，则返回 502 `the node refused the transfer: …`。

## 比特币 RPC 代理

借助 `{{signet.btc}}`，网页钱包不需要你自己的比特币节点，就能构建并广播路径 C 交易和充值交易。它转发四个 bitcoind 方法，每次调用只能是一个 JSON-RPC 请求，参数都会经过检查：

| 方法 | 说明 |
| --- | --- |
| `getblockcount` | 缓存 2 秒 |
| `getblockchaininfo` | 缓存 2 秒 |
| `estimatesmartfee` | 目标为 1 到 1008 个区块，缓存 60 秒 |
| `sendrawtransaction` | 已签名交易的十六进制 |

```sh
curl -sS {{signet.btc}} -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"estimatesmartfee","params":[2]}'
```

```output
{"jsonrpc":"2.0","id":1,"result":{"feerate":0.00020055,"blocks":2}}
```

它还转发 mempool.space signet API 的两个 `GET` 路径：`esplora/block-height/0`，以及列出某个 signet Taproot 地址上的币的 `esplora/address/<tb1p…>/utxo`。其他方法一律拒绝，`scantxoutset` 也不例外：扫描一遍 signet 的 UTXO 集要 30 到 50 秒。每个客户端地址每分钟可发 120 个请求，其中至多 20 个广播、30 个 Esplora 请求。

代理没有钱包方法。`ksana-cli` 的路径 C 命令和 `top-up` 命令用你自己 bitcoind 里的钱包为交易出资，见 [ksana-cli](/docs/cli/)。

## Signet 比特币

只有需要你自己付比特币手续费的事，才用得到 sBTC：路径 C 操作、充值，或结算你挖出的区块。路径 B 转账和水龙头都不需要。sBTC 可以从任何公开的比特币 signet 水龙头领取；项目自己不运营这样的水龙头。

把它发到你的 Taproot 地址，也就是存放你 KSA 的那个地址。按 2 sat/vB 计，一笔路径 C 转账的手续费约 700 聪，所以几千聪就够用很久。结算自己区块的出块者需要更多：具体数额见[运行节点](/docs/run-a-node/)。

## Signet 与主网的区别

signet 采用与主网相同的规则，大部分取值也相同：每 5 秒一个区块，GHOSTDAG 取 K = 16，6 个比特币确认时判定最终、再过 5 个区块加固，gas 限制相同，Argon2id 用 2 MiB 内存，携带者分成也相同。以下取值不同：

| 参数 | Signet | 主网 |
| --- | --- | --- |
| 链 ID | 1002 | 1000 |
| `ANCHOR_DEPTH`（区块的锚定块落后比特币链顶多少块） | 1 | 2 |
| `NATIVE_CONFIRMATIONS` | 1 | 3 |
| 路径 C 操作的收录时机 | 2 个比特币确认之后 | 5 个比特币确认之后 |
| 每个奖励槽的奖励 | 9.9 KSA | 4.2 KSA |
| 减半周期（以 DAA 分数计） | 25,228,800，每期相同 | 先 12,500,000，再 25,000,000，之后 50,000,000 |
| KSA 总量上限 | 1,000,000,000 | 210,000,000 |
| 创世分配 | 水龙头 100,000,000 KSA，运营方账户 10,000,000 | 无 |
| 最低难度（`pow_limit_bits`） | `0x1f0fffff` | `0x1f00ffff` |

devnet 是运行在比特币 regtest 上的本地网络，取值与 signet 相同，只有链 ID 是 1001、`ANCHOR_DEPTH` 是 0、最低难度是 `0x207fffff`。三个网络的全部取值见[参数](/docs/parameters/)。

没有人发送操作时，signet 的出块者只出空块，空块的难度最高可达含条目区块的 120 倍，所以空闲的 signet 会从大约一分钟一块，放慢到大约十分钟一块。第一笔操作一到，就又恢复每隔几秒一块。[挖矿](/docs/mining/)一页解释了这种两速难度。

## 从创世重启

主网上线之前，共识规则一旦改动，signet 就会换上新的 `signet/genesis.json`，从创世重新开始。重启意味着一条新链：余额、合约和操作历史都不会带过去；你的密钥和地址依然有效，只是在新链上什么也没有。

重启之后：

- 拉取仓库，获取新的 `signet/genesis.json` 和与之配套的代码。
- 用新的数据目录启动你的节点和索引器。数据目录会记住创建它时所用的创世配置，节点和索引器遇到旧的数据目录会拒绝启动，报错 `data directory belongs to a different genesis config`。
- 重新向水龙头申请测试 KSA。
