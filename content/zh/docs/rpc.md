---
title: JSON-RPC 接口
nav: JSON-RPC
lede: Ksana 节点与索引器 JSON-RPC 接口的每一个方法，附 JSON 约定、错误，以及对公开 signet 的真实调用。
description: Ksana 节点与索引器 JSON-RPC 方法的参考：各方法的参数、结果和错误码，附上调用公开 signet 的 curl 示例。
---

Ksana 节点在同一个端口上通过 HTTP 和 WebSocket 应答 JSON-RPC 2.0 请求。索引器则应答它自己的两个方法。钱包、应用、[ksana-cli](/docs/cli/) 和 [TypeScript SDK](/docs/sdk/) 用的都是这套接口。

本页的每个示例，都是 2026 年 10 月 21 日对公开 signet 发出的真实调用。主网尚未上线。回执里的 `asset_changes` 是按这个版本的节点记录的样子给出的；这些操作是 signet 的节点在开始记录这些变动之前执行的，节点对它们的回答是 `null`。

## 端点

| 服务 | 默认地址 | 公开 signet |
| --- | --- | --- |
| 节点，HTTP | `127.0.0.1:8545`（`ksana-node --rpc-addr`） | `{{signet.rpc}}` |
| 节点，WebSocket | 同一个端口 | `{{signet.ws}}` |
| 索引器，HTTP | `127.0.0.1:8546`（`ksana-indexer --rpc-addr`） | `{{signet.indexer}}` |

调用的参数按位置传递：`params` 是一个 JSON 数组，参数的顺序就是下文各节列出的顺序。请求头要带上 `content-type: application/json`。

### 从网页调用

浏览器只在服务器允许时才会调用另一个来源（CORS）。节点默认不允许任何来源；启动时加上 `--rpc-cors '*'` 就允许所有来源，也可以给它一个以逗号分隔的来源列表。命令行工具和服务器不受影响。

在公开 signet 上，节点的 RPC 允许所有来源，索引器则一个也不允许。发一个预检请求就能看出区别：

```sh
curl -sS -i -X OPTIONS {{signet.rpc}} -H 'origin: https://example.org' \
  -H 'access-control-request-method: POST' -H 'access-control-request-headers: content-type' \
  | grep -i -E '^(HTTP/2|access-control)'
```

```output
HTTP/2 200
access-control-allow-headers: content-type
access-control-allow-methods: POST,GET,OPTIONS
access-control-allow-origin: *
```

同样的请求发给 `{{signet.indexer}}`，得到的是 `HTTP/2 405`。请从服务器或命令行调用索引器。

### 限制 {#limits}

节点和索引器对每个客户端采用相同的限制。它们是本地策略，不是共识规则；超过其中一项时，服务器用它自己的错误来回答：

| 限制 | 值 | 超过时 |
| --- | --- | --- |
| 一个批量请求中的调用数 | 64 | 整个批量请求被拒绝，只返回一个错误 `-32010`，其 `id` 为 `null`；其中的调用一个也不执行 |
| 请求体，或一条 WebSocket 消息 | 1 MiB | `-32007`，HTTP 状态码为 413 |
| 响应 | 10 MiB | `-32008`；批量请求则是 `-32011`，`id` 为 `null` |
| 同时的连接数，HTTP 与 WebSocket 合计 | 100 | HTTP 状态码 429 |
| 一个 WebSocket 连接上的订阅数 | 16 | `-32006` |

因大小被拒绝的批量请求什么也没有执行：把其中的调用分成更小的批量重新发送。节点拒绝一个操作时，`ksana_submitOp` 也返回 `-32010` 和 `-32011`；回答整个批量请求的错误，`id` 为 `null`，回答单个调用的错误，则带着这个调用的 `id`。

## 第一次调用

向节点查询它的链顶：

```sh
curl -sS {{signet.rpc}} -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"ksana_getChainInfo","params":[]}' | jq
```

```output
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "chain_id": 1002,
    "tip": {
      "height": "61",
      "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f"
    },
    "daa_score": "1860",
    "protocol_version": 2,
    "next_upgrade": null,
    "max_known_version": 2,
    "finalized": {
      "height": "38",
      "hash": "ab3fe1dcb95f0d76cd171210567f571fcd81cc8f7559d68da7dd38348eec7cf2"
    }
  }
}
```

其余示例都用一个简短的 shell 函数，只打印 `result`。这个函数需要 `curl` 和 `jq`：

```sh
NODE={{signet.rpc}}
INDEXER={{signet.indexer}}
rpc() {  # rpc <url> <method> [JSON 数组形式的参数]
  curl -sS "$1" -H 'content-type: application/json' \
    --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$2\",\"params\":${3:-[]}}"
}
ACCOUNT=b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09d
KSA=0000000000000000000000000000000000000000000000000000000000000000
```

`ACCOUNT` 是[代币与资金池教程](/docs/token-and-pool/)里用的账户，`KSA` 是 KSA 的资产 ID。

## JSON 约定 {#conventions}

- **字节串**（哈希、账户、资产 ID 和合约 ID、Borsh 编码）写成小写十六进制字符串，不带 `0x`。
- **`u64` 和 `u128` 值**（高度、nonce、金额、gas）是十进制字符串，因为 JavaScript 的数字只有 53 位精度。`u8` 和 `u32` 值（小数位数、BTC 高度、计数）是 JSON 数字。
- **区块标识**是 `"latest"`、一个十进制高度（例如 `"33"`），或者一个 64 位十六进制的区块哈希。高度指的是主链上的区块；哈希可以指节点知道的任何区块。
- **比特币的 ID**（`txid`、BTC 区块哈希）按比特币的内部字节序书写，与区块浏览器显示的顺序相反。以 `_rpc` 结尾的字段按区块浏览器的顺序给出。
- **协议类型**（区块头、条目、VmOp）采用仓库测试向量中的 JSON 形式：枚举是只有一个键的对象，这个键就是它的变体，例如 `{"Token": {"amount": "1"}}`。

## 方法一览

| 方法 | 参数 | 结果 |
| --- | --- | --- |
| [`ksana_getChainInfo`](#ksana_getchaininfo) | 无 | 链 ID、链顶、DAA 分数、版本、最终链顶 |
| [`ksana_estimateFee`](#ksana_estimatefee) | 无 | 建议的路径 B 手续费，以及节点的 BTC 费率 |
| [`ksana_getAccount`](#ksana_getaccount) | 账户 | nonce、余额、锁定的手续费 |
| [`ksana_getAsset`](#ksana_getasset) | 资产 ID | 名称、符号、小数位数、总量、发行者、能力 |
| [`ksana_getAssetStatus`](#ksana_getassetstatus) | 资产 ID、账户 | 账户的状态标记，以及它能否发送和接收这个资产 |
| [`ksana_getContract`](#ksana_getcontract) | 合约 ID | 代码哈希、部署者、声明的标准 |
| [`ksana_getAccountAssets`](#ksana_getaccountassets) | 账户、`after`、`limit` | 一个账户的一页资产、代币和 NFT |
| [`ksana_getToken`](#ksana_gettoken) | 合约 ID | 代币的标准、元数据、总量和持有者数 |
| [`ksana_getTokenHolders`](#ksana_gettokenholders) | 合约 ID、`after`、`limit` | 一个代币的一页持有者，持有最多的在前 |
| [`ksana_getNfts`](#ksana_getnfts) | 账户、`contract`、`after`、`limit` | 一个账户的一页 NFT |
| [`ksana_getApprovals`](#ksana_getapprovals) | 账户、`after`、`limit` | 一个账户给出的一页授权 |
| [`ksana_submitOp`](#ksana_submitop) | VmOp（Borsh 编码，十六进制） | 操作 ID |
| [`ksana_getOpStatus`](#ksana_getopstatus) | 操作 ID | 状态、区块、回执 |
| [`ksana_getAccountOps`](#ksana_getaccountops) | 账户、`before`、`limit` | 一个账户的一页操作 |
| [`ksana_getLatestOps`](#ksana_getlatestops) | `before`、`limit` | 全链的一页操作 |
| [`ksana_getBlock`](#ksana_getblock) | 区块标识 | 区块头、条目、回执 |
| [`ksana_getSettlement`](#ksana_getsettlement) | 区块标识 | 结算及其在比特币上的状态 |
| [`ksana_call`](#ksana_call) | 调用请求 | 一次只读调用的回执 |
| [`ksana_subscribeBlocks`](#ksana_subscribeblocks) | 无（WebSocket） | 每个新区块一条通知 |
| [`indexer_status`](#indexer_status) | 无 | 索引器已核对的链顶 |
| [`indexer_stateRoot`](#indexer_stateroot) | 区块标识 | 一个已核对区块的状态根 |

## 链与手续费

### `ksana_getChainInfo`

没有参数。结果如[第一次调用](#a-first-call)所示：

| 字段 | 含义 |
| --- | --- |
| `chain_id` | signet 上为 1002，devnet 上为 1001，主网上为 1000 |
| `tip` | 主链的链顶，`{ "height", "hash" }` |
| `daa_score` | 链顶的 DAA 分数；每个区块加上自己的权重（空块的权重更大） |
| `protocol_version` | 链顶的区块头版本 |
| `next_upgrade` | 下一次排定的升级，`{ "version", "daa_score" }`，或 `null` |
| `max_known_version` | 本节点软件支持的最高协议版本 |
| `finalized` | BTC 最终链顶：判定它为最终的那个比特币区块如今已有 6 个确认的最新区块；主链经过它，只有至少 6 个区块的比特币重组才能把它撤回 |

网络的 `protocol_version` 一旦超过 `max_known_version`，节点的软件就需要升级。在任何区块成为最终之前，`finalized` 是创世块。

### `ksana_estimateFee`

没有参数。它给出手续费的建议值，不改变节点接受操作的条件。

```sh
rpc $NODE ksana_estimateFee | jq .result
```

```output
{
  "feerate_sat_vb": "2",
  "path_b": {
    "amount": "1",
    "per_kib": "4"
  },
  "at": {
    "height": "61",
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f"
  }
}
```

- `feerate_sat_vb` 是本节点眼下为自己的结算支付的费率，单位 sat/vB。路径 C 交易和充值可以拿它作参考。
- `path_b.per_kib` 是路径 B 的建议费率：每 KiB 成本多少个 KSA 最小单位。一笔操作的成本，是它编码后的大小与它的 `max_gas` 换算成的字节数（`max_gas × 81,920 / 100,000,000`）两者中较大的那个。节点在它最近的 20 个主链区块中，取每个区块最低的路径 B 费率，再取这些费率的中位数，而且从不低于它自己的 `--min-fee-per-kib`。
- `path_b.amount` 是按这个费率算出的一笔普通 KSA 转账的建议手续费，不会低于节点的 `--min-token-fee`。对于别的操作，用它的成本乘以 `per_kib`。
- `at` 是这次估算所依据的链顶。

[操作与手续费](/docs/submitting-ops/)一页讲解手续费的规则。

## 账户与资产

### `ksana_getAccount`

参数：账户，写成 64 位十六进制（即 Taproot 输出公钥，而不是 `tb1p` 地址）。

```sh
rpc $NODE ksana_getAccount "[\"$ACCOUNT\"]" | jq .result
```

```output
{
  "account": "b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09d",
  "nonce": "9",
  "balances": [
    {
      "asset": "0000000000000000000000000000000000000000000000000000000000000000",
      "amount": "6975669407"
    }
  ],
  "locked_fees": [],
  "at": {
    "height": "61",
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f"
  }
}
```

- `nonce` 是这个账户在主链上的下一个 nonce。还在条目池里等待的操作不计在内。
- `balances` 列出每种内置资产的可用余额，以最小单位计。保存在合约存储里的代币（比如示例代币 `token`）不会出现在这里：[`ksana_getAccountAssets`](#ksana_getaccountassets) 列出一个账户持有的 KS-20 代币和 KS-721 NFT，持有多少则由合约回答。
- `locked_fees` 列出这个账户在尚未解锁的区块里待领的金额，每个区块一项，形如 `[{ "block_hash", "amount" }]`：作为出块者，是该区块的奖励和路径 B 手续费；作为携带者，是携带者的那一份；作为区块分享账户，是区块分享。没有待领金额时，列表为空。
- `at` 是这个回答所依据的区块。

### `ksana_getAsset`

参数：资产 ID。KSA 的 ID 是 64 个零。

```sh
rpc $NODE ksana_getAsset "[\"$KSA\"]" | jq .result
```

```output
{
  "asset": "0000000000000000000000000000000000000000000000000000000000000000",
  "name": "KSA",
  "symbol": "KSA",
  "decimals": 8,
  "total_supply": "11001412730000000",
  "issuer": "0000000000000000000000000000000000000000000000000000000000000000",
  "capabilities": [],
  "paused": false,
  "at": {
    "height": "61",
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f"
  }
}
```

`total_supply` 以最小单位计：创世分配，加上到目前为止发放的出块奖励，再减去销毁的数额。`issuer` 是发行这种资产的合约，KSA 的则是全零。查询未知的资产，返回 `-32004`。

`capabilities` 列出发行合约仍然能对这个资产做的事，顺序为 `mint`、`freeze`、`allowlist`、`pause`：增发、冻结账户、只放行它允许的账户、暂停除它自己以外的所有账户。KSA，以及供应量固定、谁也不能拦下的资产，这一项为空。能力只能放弃，而且没有哪一项能动用余额。发行合约暂停了这个资产时，`paused` 为 `true`。[宿主函数](/docs/host-functions/#assets)一页讲解这些规则。

### `ksana_getAssetStatus`

参数：资产 ID 和账户。

```sh
rpc $NODE ksana_getAssetStatus "[\"$KSA\", \"$ACCOUNT\"]" | jq .result
```

```output
{
  "asset": "0000000000000000000000000000000000000000000000000000000000000000",
  "account": "b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09d",
  "status": [],
  "can_send": true,
  "can_receive": true,
  "at": {
    "height": "61",
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f"
  }
}
```

- `status` 列出这个账户在该资产上的标记：`frozen` 和 `allowed`。只有资产仍拥有对应的能力时，标记才生效。
- `can_send` 表示资产的规则现在是否允许这个账户发送它：账户没有被冻结；资产有白名单时，账户在白名单上；资产没有暂停，发行合约本身除外。不考虑余额。
- `can_receive` 表示规则现在是否允许这个账户接收这个资产。
- 发送带有能力的资产之前，先检查这两项：被规则拒绝的操作照样要付手续费。查询未知的资产，返回 `-32004`。

## 代币与 NFT

节点从主链所执行操作的回执里，为 KS-20 代币和 KS-721 合集（也就是遵循[代币标准]({{repo}}/blob/main/docs/STANDARDS.md)的合约）的事件建立索引。本节的方法读取这份索引。它是节点自己的账目，不属于共识；节点让它和主链保持一致，链重组时也是如此。

- **哪些事件算数**：合约的第一个 `standards` 事件就是它的声明，此后索引计入它声明的第一个标准的事件。违反标准的事件会被略过，比如按代币自己的事件计算、转出的数额超过发送方持有量的转账；这个代币随即被标为 `irregular`。
- **索引与合约**：索引告诉你一个账户持有什么，合约告诉你持有多少。要按某个数额行事之前，先用 [`ksana_call`](#ksana_call) 读取 `balance_of`、`allowance` 或 `owner_of`。授权额度按它最近一次 `approve` 事件设定的值列出：花掉额度不会产生新的事件，所以 `amount` 仍是当初批准的数额，而代币的 `allowance` 给出的是剩下的部分。授权过期后仍会列出，直到新的事件改变它。
- **分页**：要接着往下翻，就把上一页的 `next` 作为 `after` 传入；要第一页，就传 `null`（或者什么都不传）。`limit` 为 1 到 500，默认 50；列到末尾时 `next` 为 `null`。`at` 是读这一页时的链顶；在两页之间挪了位置的条目（比如余额变了的持有者）可能被漏掉，也可能列出两次。
- **旧节点**：版本早于这份索引的节点，或者索引还没建好的节点，返回 `-32601`，和操作列表方法一样。ID 或 `after` 的格式不对，或者 `limit` 超出范围，返回 `-32602`。

### `ksana_getContract`

参数：合约 ID。任何合约都可以查询，不论它是否遵循标准：

| 字段 | 含义 |
| --- | --- |
| `contract` | 合约 ID |
| `code_hash` | 合约代码的 SHA-256：可以拿它和已知的构建比对 |
| `deployer` | 部署它的账户 |
| `standards` | 它的声明，先是标准，然后是扩展，比如 `["KS-20", "KS-20-burnable"]`；没有声明时为空 |
| `declared` | 做出这个声明的操作的[位置](#ksana_getaccountops)，或者 `null` |
| `at` | 这个回答所依据的区块 |

查询的 ID 不是合约时，返回 `-32004`。

遵循标准的代币或合集在 `init` 里声明自己，所以 `declared` 就是它的部署所在的位置，这个操作的事件里也有它的第一个 `metadata`。[`ksana_getAccountOps`](#ksana_getaccountops) 从不把部署列在它部署的合约下面：要读这次部署，调用 [`ksana_getLatestOps`](#ksana_getlatestops)，`limit` 取 1，`before` 取它后面的一个条目（`declared` 是 `"412:1:3"` 时，传 `"412:1:4"`）。

### `ksana_getAccountAssets`

参数：`account`、`after`（可选）、`limit`（可选）。账户持有的一切，都在一个列表里：先是内置资产，按资产 ID 排列；然后是 KS-20 代币和 KS-721 合集，按合约 ID 排列。每一项都有一个 `kind`：

| `kind` | 字段 | 含义 |
| --- | --- | --- |
| `asset` | `asset`、`balance` | 一种内置资产，余额和 [`ksana_getAccount`](#ksana_getaccount) 显示的相同 |
| `token` | `contract`、`balance` | 一种 KS-20 代币，余额由它的事件累计得出 |
| `nft` | `contract`、`count` | 一个 KS-721 合集，以及账户持有其中多少个 NFT |

数额以最小单位计，写成十进制字符串。账户持有某个代币或合集时，才会列出它。

### `ksana_getToken`

参数：代币或合集的合约 ID。

| 字段 | 含义 |
| --- | --- |
| `contract` | 合约 ID |
| `standard` | `KS-20` 或 `KS-721` |
| `extensions` | 它声明的扩展，比如 `KS-20-mintable` |
| `name`、`symbol` | 来自它最近一次 `metadata` 事件；在那之前为 `null` |
| `decimals` | 代币的小数位数，是一个数字；合集为 `null` |
| `supply` | 代币的总量（以最小单位计），或者合集现存的 NFT 数量 |
| `holders` | 持有它的账户数 |
| `declared` | 做出声明的操作的位置 |
| `irregular` | 索引略过它的某个事件之后为 `true`：这时它的余额可能和合约自己给出的不同 |
| `at` | 这个回答所依据的区块 |

合约两个标准都没有声明，或者查询的 ID 不是合约时，返回 `-32004`。

### `ksana_getTokenHolders`

参数：合约 ID、`after`（可选）、`limit`（可选）。一个代币或合集的持有者，持有最多的在前，每项是 `{ "account", "balance" }`；对合集来说，`balance` 是 NFT 的个数。余额相同的持有者按账户排列，大的在前。`ksana_getToken` 不认识的合约，返回 `-32004`。

### `ksana_getNfts`

参数：`account`、`contract`（可选）、`after`（可选）、`limit`（可选）。账户持有的 NFT，每项是 `{ "contract", "token_id" }`，先按合集、再按 token ID 排列；给了 `contract` 时，只列出那个合集的。token ID 是 32 个字节，[SDK](/docs/sdk/#use-ks-20-and-ks-721-tokens) 可以在序号和 ID 之间换算。

### `ksana_getApprovals`

参数：`account`、`after`（可选）、`limit`（可选）。账户给出的授权，先按合约、再按种类排列：

| `kind` | 字段 | 含义 |
| --- | --- | --- |
| `allowance` | `contract`、`spender`、`amount`、`expires_at` | 一笔 KS-20 授权额度，取它最近一次 `approve` 事件设定的值 |
| `operator` | `contract`、`operator`、`expires_at` | 一个 KS-721 操作员，可以转移账户在这个合集里的所有 NFT |
| `token` | `contract`、`token_id`、`spender` | 获准转移某一个 NFT 的账户；这个 NFT 换了主人，这项授权就随之取消 |

`expires_at` 是一个以秒计的区块时间戳，写成十进制字符串，授权从这一刻起失效；没有期限时为 `null`。要撤销授权，就发送标准里清除它的那个调用：授权额度用数额为 0 的 `approve`，操作员用 `approved` 为 false 的 `set_operator`，单个 NFT 用不带 spender 的 `approve`。

## 操作

### `ksana_submitOp`

参数：一个签好名的路径 B VmOp，经 Borsh 编码，写成十六进制。结果：`{ "op_id" }`。

节点按共识规则（版本、链 ID、大小、签名、nonce 不低于账户的 nonce）和它自己的策略（最低手续费、容量）检查这个操作。出块的节点要等这个操作进了它的下一个出块模板才应答，最多等 5 秒。

- 路径 C 操作不走这个方法：它随一笔比特币交易传递，`ksana_submitOp` 会以 `-32010` 拒绝它。
- 违反共识规则的操作返回 `-32010`；被节点策略拒绝的操作（手续费太低、条目池已满、替换时手续费提高得不够）返回 `-32011`。
- 无法解码的字节返回 `-32602`：

```sh
rpc $NODE ksana_submitOp '["00"]' | jq .error
```

```output
{
  "code": -32602,
  "message": "VmOp decode failed: Borsh decode failed: Unexpected length of input"
}
```

[TypeScript SDK](/docs/sdk/) 和 [ksana-cli](/docs/cli/) 会替你构造、签名并编码操作。

### `ksana_getOpStatus`

参数：操作 ID。示例查询的是一笔水龙头转账：

```sh
OP=a91054efcbde256b412d0d5286d922ce5377ac6a3ea0941a2eabe41cbaaf090e
rpc $NODE ksana_getOpStatus "[\"$OP\"]" | jq .result
```

```output
{
  "status": "btc_final",
  "block": {
    "height": "30",
    "hash": "f564dcd99ab57f8cc2a38e76232a717a2b4a0a3cc2707fcb55ca22e04c687e01"
  },
  "index": 0,
  "receipt": {
    "op_id": "a91054efcbde256b412d0d5286d922ce5377ac6a3ea0941a2eabe41cbaaf090e",
    "success": true,
    "error": null,
    "gas_used": "10000",
    "output": "",
    "events": [],
    "asset_changes": [
      {
        "kind": "transfer",
        "asset": "0000000000000000000000000000000000000000000000000000000000000000",
        "from": "de6603f052fd5bfaae5678a2a20ae6ae4fe4ae00c89db70a2efea7429851afc0",
        "to": "b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09d",
        "amount": "10000000000",
        "events": 0
      }
    ]
  }
}
```

| `status` | 含义 |
| --- | --- |
| `pending` | 在条目池里，还没进区块 |
| `fast_confirmed` | 在主链的一个区块里，并且执行成功 |
| `failed` | 在某个区块里，但执行失败：状态已回滚，手续费照扣 |
| `skipped` | 只由一个被合并的区块收录，而且无法执行；不收手续费，操作可以回到条目池 |
| `btc_final` | 执行成功，而且接受它的区块已经 BTC 最终 |

`block.hash` 是收录这个操作的区块。`block.height` 是接受它的主链区块的高度：被合并区块中的操作，在合并该区块的那个区块的高度生效。`index` 是这个条目在所在区块里的位置。未知的操作返回 `-32004`；[确认与最终性](/docs/confirmations/)讲解了这些状态背后的印记。

`receipt.asset_changes` 按先后顺序列出这个操作对内置资产做了什么：这里就是这笔转账本身。每一项都有 `kind` 和 `asset`；`events` 是在它之前这个操作发出的事件数，两个列表合起来，就是操作做事的先后顺序：

| `kind` | 字段 | 变动 |
| --- | --- | --- |
| `transfer` | `from`、`to`、`amount` | 一个 `AssetTransfer` 操作，从签名者转出 |
| `funds` | `from`、`to`、`amount` | 调用或部署附带的资产：由操作的签名者附带，或者由合约附给它调用或创建的合约 |
| `payout` | `from`、`to`、`amount` | 合约从自己的余额付款 |
| `issue` | `to`、`amount` | 发行合约增发 |
| `burn` | `from`、`amount` | 销毁 |
| `create` | `capabilities` | 资产的创建，能力的名称和 [`ksana_getAsset`](#ksana_getasset) 里的一样；随后的发行是一项 `issue`，数额为 0 时没有 |
| `freeze` | `account`、`frozen` | 发行合约冻结一个账户，或者解冻 |
| `allow` | `account`、`allowed` | 发行合约把一个账户加进白名单，或者移出 |
| `pause` | `paused` | 发行合约暂停这个资产，或者恢复 |
| `renounce` | `capabilities` | 发行合约放弃的能力；资产已经没有这些能力时为空 |

失败的操作没有变动；手续费和数额为 0 的流动都不算变动。节点在开始记录之前存下的回执，`asset_changes` 为 `null`；更早版本的节点没有这个字段。

### `ksana_getAccountOps`

参数：`account`、`before`（可选）、`limit`（可选）。它列出一个账户在主链上的操作，最新的在前：这个账户签署的操作、转给它的转账、它作为合约时收到的调用、[代币事件](#tokens-and-nfts)提到它或由它发出的操作，以及[内置资产变动](#ksana_getopstatus)提到它的操作（它自己的部署除外）。传入 KSA 以外的资产 ID，则列出改变过这个资产的操作。

```sh
rpc $NODE ksana_getAccountOps "[\"$ACCOUNT\", null, 2]" | jq .result
```

```output
{
  "ops": [
    {
      "op_id": "85aa965def12e9cc329dc120f9fcabf2ad165b70731917fc47158e0b87b42f0d",
      "status": "fast_confirmed",
      "block": {
        "height": "39",
        "hash": "7a485752fb81319c9d454215968acb3010139cc79f52457feff6d8f25653c5c6"
      },
      "index": 0,
      "position": "39:0:0"
    },
    {
      "op_id": "797d9dc411ae59e79ce0aa8a369ec151f9416f7afb18569c0181fe81ebecc2e0",
      "status": "btc_final",
      "block": {
        "height": "38",
        "hash": "ab3fe1dcb95f0d76cd171210567f571fcd81cc8f7559d68da7dd38348eec7cf2"
      },
      "index": 0,
      "position": "38:0:0"
    }
  ],
  "next": "38:0:0",
  "at": {
    "height": "61",
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f"
  }
}
```

- `position` 是操作在主链上的位置，形如 `"height:slot:entry"`：接受它的主链区块的高度，它所在的区块在那个主链区块所接受的各区块中的位次，以及条目的序号。列表从最高的位置往下排。
- `before` 是一个位置：这一页列出位于它之下的操作。要接着往下翻，就传入上一页的 `next`；要最新的操作，就传 `null`（或者什么都不传）。
- `limit` 为 1 到 500，默认 50。
- 列表到达创世块后，`next` 为 `null`。在 `next` 不为 `null` 时，一页里的操作也可能少于 `limit`，甚至一个都没有：要一直沿着 `next` 取下去。

下一页从 `38:0:0` 之下接着列出：

```sh
rpc $NODE ksana_getAccountOps "[\"$ACCOUNT\", \"38:0:0\", 2]" \
  | jq -c '.result.ops[].position, .result.next'
```

```output
"37:0:0"
"36:0:0"
"36:0:0"
```

列表包括路径 B 和路径 C 的操作，不包括解锁条目。版本早于这些方法的节点，或者操作索引还没建好的节点，返回 `-32601`。账户或位置的格式不对，或者 `limit` 超出范围，返回 `-32602`。

### `ksana_getLatestOps`

参数：`before`（可选）、`limit`（可选）。列表与 `ksana_getAccountOps` 的相同，只是涵盖所有账户：

```sh
rpc $NODE ksana_getLatestOps '[null, 1]' | jq .result
```

```output
{
  "ops": [
    {
      "op_id": "54dfe7da3eccfadafdaf89422d718ead59ee35a7100fa1c96553b38c2ca230bb",
      "status": "fast_confirmed",
      "block": {
        "height": "49",
        "hash": "ce36e3736a66c3773ed309cae018dd6e51fe2e4ad1e11b7d46893238026882a6"
      },
      "index": 0,
      "position": "49:0:0"
    }
  ],
  "next": "49:0:0",
  "at": {
    "height": "61",
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f"
  }
}
```

## 区块与结算

### `ksana_getBlock`

参数：一个区块标识。结果包含 `hash`、`header`、`entries`、`settlement`、`receipts`、`accepted_height` 和 `merged`。为了简短，示例省略了 `entries` 和 `receipts`：

```sh
rpc $NODE ksana_getBlock '["33"]' | jq '.result | del(.entries, .receipts)'
```

```output
{
  "hash": "8f3d978dd672b44bf040d325af63e4701a00d9e04e620178480a5b36b636b593",
  "header": {
    "version": 2,
    "height": "33",
    "parents": [
      "5131d895b03d85d20262c6bc70417a36bb3d8c46c03059167d29267e7118a1b4"
    ],
    "btc_anchor": {
      "height": 327279,
      "hash": "c770c385e86ae4792f479f8a8c0fd3fde68b3fb604d47911afa42c5103000000"
    },
    "entries_root": "418ccbe2a7af7e2dd1e10948e51a1558358ac3b3f20fdc3efd09e5351bba20d1",
    "state_root": "bcd3279d347647192768169d53610bb36fe0681b0213e46a3e8193fae792f8ad",
    "producer": "b40c816d58ee2578da0118a9c6feeca74b80280f92030bdfa510821ae2887954",
    "timestamp": "1792558601",
    "bits": 520499867,
    "nonce": "371"
  },
  "settlement": null,
  "accepted_height": "33",
  "merged": []
}
```

- `header.parents` 列出这个区块在区块 DAG 中的父块；`btc_anchor` 是它锚定的比特币区块；`producer` 是出这个区块的账户。
- `entries` 列出区块的条目，每个条目都是只有一个键的对象：`Sponsored`（路径 B 操作）、`Forced`（路径 C 操作，附带携带它的 `btc_txid`）或 `Unlock`。
- `receipts` 为每个条目给出一张回执，取自主链接受这个区块之时。`error` 以 `skipped` 开头的条目没有执行。
- `settlement` 是这个区块自带的提交交易和揭示交易，`{ "commit", "reveal" }`，写成十六进制；区块不带结算交易时为 `null`。
- `accepted_height` 是接受这个区块的主链区块的高度：主链上的区块就是它自己的高度，被合并的区块是合并它的那个区块的高度，还没有主链区块接受它时为 `null`。
- `merged` 列出它合并的区块，顺序就是这些区块的条目执行的顺序。

区块 33 的条目，去掉了签名：

```sh
rpc $NODE ksana_getBlock '["33"]' | jq '.result.entries[0].Sponsored.op | del(.sig)'
```

```output
{
  "version": 2,
  "chain_id": 1002,
  "account": "b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09d",
  "nonce": "2",
  "fee": {
    "Token": {
      "amount": "1"
    }
  },
  "max_gas": "1000000",
  "action": {
    "Call": {
      "contract": "6569e81e9aa68a0ae8058c3f749de4b0f13d2f3448f12831d8ccf0960c329658",
      "method": "transfer_and_call",
      "args": "eb5ca55289984d64598a12303a0638ee9dd6edc50f4bebe6d43a7a46121fc74500a0724e180900000000000000000000210000000100f2052a01000000000000000000000001000000000000000000000000000000",
      "funds": [
        {
          "asset": "0000000000000000000000000000000000000000000000000000000000000000",
          "amount": "5000000000"
        }
      ]
    }
  }
}
```

用密钥签名时，`sig` 是 `{"Bip340": "<64 bytes>"}`；用钱包签名时，它是 `{"Bip322Simple": "<bytes>"}`。路径 B 的 `fee` 是 `{"Token": {"amount"}}`，路径 C 的是 `"BtcNative"`。`action` 是 `Deploy`、`Call` 或 `AssetTransfer`。

### `ksana_getSettlement`

参数：一个区块标识。它告诉你这个区块的数据是否已在比特币上。示例省略了 `txs`，即那两笔原始交易（十六进制的 `{ "commit", "reveal" }`）：

```sh
rpc $NODE ksana_getSettlement '["38"]' | jq '.result | del(.txs)'
```

```output
{
  "block": {
    "height": "38",
    "hash": "ab3fe1dcb95f0d76cd171210567f571fcd81cc8f7559d68da7dd38348eec7cf2"
  },
  "txid": "a31ec70b067407708454acf3cea6af68851c4e2cea4d682c737dc76003943921",
  "txid_rpc": "2139940360c77d732c684dea2c4e1c8568afa6cef3ac5484700774060bc71ea3",
  "commit_txid": "97080af7841e539719cb93c78562f11d9f9e4f155930785224c460f32e99f702",
  "commit_txid_rpc": "02f7992ef360c42452783059154f9e9f1df16285c793cb1997531e84f70a0897",
  "carrier_account": "ccc06c3ce8d176b3c10138dd4e70873939a9c6dc05597f45aace147ef2c07d3d",
  "carrier": null,
  "status": "confirmed",
  "confirmed": {
    "txid": "a31ec70b067407708454acf3cea6af68851c4e2cea4d682c737dc76003943921",
    "height": 327281,
    "block": "c2d6d161fdef456778a3df4f2ffe65a4627ad100ccbd24122d78fd5006000000",
    "confirmations": 11
  },
  "settled": true,
  "btc_final": true
}
```

- `txid` 是揭示交易，它在 Taproot 见证里携带载荷；`commit_txid` 是它所花费的提交交易。以 `_rpc` 结尾的字段按区块浏览器的顺序给出这两个 ID。
- `status` 为 `pending`（还没广播：区块有了 2 个快轨确认之后，结算才会发出）、`broadcast` 或 `confirmed`。
- `confirmed` 描述第一笔把这个区块的数据写进比特币、并且已经确认的比特币交易，`{ "txid", "height", "block", "confirmations" }`。它可能是这个区块自己的结算、后来某个区块的结算，也可能是一次补发。
- 接受这个区块的主链区块，连同它之前的每一个主链区块，数据都已在比特币上时，`settled` 为 `true`；接受它的区块已经最终时，`btc_final` 为 `true`。
- `carrier_account` 是作为这个区块的携带者而获得报酬的账户；出块者自己留下这份奖励时为 `null`。它按当前的比特币链和主链作答。

一个区块的区块体可以由后来某个区块的结算携带（批量结算）。这时它的 `carrier` 指明那个区块，各交易字段描述的是那个区块的结算；还没有区块携带它时，这些字段为 `null`，`status` 为 `pending`。空块或只含路径 C 操作的区块没有区块体要上链，所以它自己不带结算时，返回 `-32004`。

## 只读调用

### `ksana_call`

参数：一个调用请求对象。它在最新的状态上运行一个合约方法，不收手续费，不用 nonce，也不写入任何东西：

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| `contract` | 是 | 合约 ID |
| `method` | 是 | 方法名 |
| `args` | 是 | 参数，Borsh 编码，写成十六进制（没有参数时为 `""`） |
| `funds` | 否 | 附带的资产，`[{ "asset", "amount" }]`，模拟时从 `caller` 转出 |
| `caller` | 否 | 模拟的调用者，默认是 32 个零字节 |
| `max_gas` | 否 | 十进制字符串，至多 `BLOCK_GAS_LIMIT`（100,000,000，也是默认值） |

读取一个资金池的储备（教程里的资金池，`(u128, u128)`，小端）：

```sh
POOL=eb5ca55289984d64598a12303a0638ee9dd6edc50f4bebe6d43a7a46121fc745
rpc $NODE ksana_call "[{\"contract\": \"$POOL\", \"method\": \"reserves\", \"args\": \"\"}]" \
  | jq .result
```

```output
{
  "op_id": null,
  "success": true,
  "error": null,
  "gas_used": "50570",
  "output": "be310d09810400000000000000000000583a7696000000000000000000000000",
  "events": [],
  "asset_changes": []
}
```

附带的资产从 `caller` 的余额中转出，所以附带资产的模拟需要一个有余额的 `caller`。下面在这个资金池里报价兑换 1 KSA，不带 `caller` 就会失败，而失败的调用会把 `max_gas` 全部记为已用：

```sh
ARGS=${KSA}00e1f50500000000000000000000000001000000000000000000000000000000
rpc $NODE ksana_call "[{\"contract\": \"$POOL\", \"method\": \"swap\", \"args\": \"$ARGS\",
  \"funds\": [{\"asset\": \"$KSA\", \"amount\": \"100000000\"}], \"max_gas\": \"500000\"}]" \
  | jq .result
```

```output
{
  "op_id": null,
  "success": false,
  "error": "attached funds transfer failed: insufficient balance",
  "gas_used": "500000",
  "output": "",
  "events": [],
  "asset_changes": []
}
```

加上 `"caller": "$ACCOUNT"` 后，调用成功，并返回报价：

```output
{
  "op_id": null,
  "success": true,
  "error": null,
  "gas_used": "169247",
  "output": "f4513fcf2b0000000000000000000000"
}
```

（这段输出省略了 `events` 和 `asset_changes`。）回执是 `{ "op_id", "success", "error", "gas_used", "output", "events", "asset_changes" }`，与操作回执的结构相同，只是 `op_id` 为 `null`；`asset_changes` 列出这次调用会对内置资产做的变动，附带的资产排在最前。`output` 是方法返回的字节，写成十六进制；每个事件是 `{ "contract", "data" }`。

调用看到的是下一个区块的环境：高度是链顶的高度加一，时间戳和比特币锚定块则与链顶的相同。`native_tx()` 什么也不返回。`max_gas` 超过上限时，返回 `-32602`。一个节点同一时间最多运行 4 个调用；在其中一个结束之前，再来的调用都返回 `-32009`。

## 订阅

### `ksana_subscribeBlocks`

只能通过 WebSocket 使用。应答是一个订阅 ID。此后，每个加入主链的区块，包括重组时接入主链的区块，都会作为一条 `ksana_block` 通知送达。要停止，就用这个订阅 ID 调用 `ksana_unsubscribeBlocks`。

下面这段 JavaScript 可以在浏览器里运行，也可以在 Node.js 22 及更高版本中运行（`node subscribe.mjs`）。它订阅区块，打印第一条通知，然后取消订阅：

```javascript title="subscribe.mjs"
const ws = new WebSocket("{{signet.ws}}");
const send = (id, method, params) =>
  ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
ws.onopen = () => send(1, "ksana_subscribeBlocks", []);
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log(JSON.stringify(message, null, 2));
  if (message.method === "ksana_block") {
    // 这里一个区块就够了：取消订阅，等节点确认后再关闭连接
    send(2, "ksana_unsubscribeBlocks", [message.params.subscription]);
  }
  if (message.id === 2) ws.close();
};
ws.onclose = (event) => console.log("closed", event.code);
```

```output
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": 8723730946419982
}
{
  "jsonrpc": "2.0",
  "method": "ksana_block",
  "params": {
    "subscription": 8723730946419982,
    "result": {
      "height": "63",
      "hash": "8f9221ec3639c5f48bf56afed0a2e8b692d5a229470ca108f8137c37e8b3202b",
      "entries": 0,
      "timestamp": "1792562771"
    }
  }
}
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": true
}
closed 1005
```

每条通知都是 `{ "height", "hash", "entries", "timestamp" }`：`entries` 是区块的条目数，`timestamp` 以秒为单位。

跟不上的订阅者会跳过它错过的通知，接着接收后面的区块。不会自动重连：连接关闭后，要新开一个连接，重新订阅，再用 `ksana_getBlock` 读取错过的区块。在空闲的 signet 上，相邻两个区块可能相隔几分钟。

## 索引器的方法

[索引器](/docs/run-an-indexer/)只凭 bitcoind 重建这条链，并核对每一个状态根。它的两个方法遵循同样的约定。

### `indexer_status`

没有参数。

```sh
rpc $INDEXER indexer_status | jq .result
```

```output
{
  "height": "51",
  "hash": "5b69b10223571ab01bdee3080d8e1ed25c8ace4fc420f744d23b7d8d5db15981",
  "state_root": "bd7ad23935fc366400a48eb8591696171be864520fd981c3204f9d5e64cc0963",
  "btc_height": 327291,
  "finalized": {
    "height": "38",
    "hash": "ab3fe1dcb95f0d76cd171210567f571fcd81cc8f7559d68da7dd38348eec7cf2"
  },
  "halted": null
}
```

- `height`、`hash` 和 `state_root` 描述索引器已执行并核对过的最高区块。一个区块的数据已在比特币上、并且在索引器的主链上有了 2 个确认，或者它已被判定为最终，索引器才会核对它，所以索引器落后于节点。
- `btc_height` 是它已扫描到的比特币链顶；与 bitcoind 同步之前为 `null`。
- `finalized` 是 BTC 最终链顶，规则与节点相同。
- `halted` 在正常运行时为 `null`。只有当一个被比特币判为最终的区块结果却是无效的时候，索引器才会停止，并由 `halted` 给出原因；尚未最终的无效区块会被排除在外，索引器重新选择它的主链（[告警](/docs/run-an-indexer/#alarms)）。

### `indexer_stateRoot`

参数：一个区块标识。它只对索引器已核对的区块作答；其他区块返回 `-32004`，格式不对的标识返回 `-32602`。

```sh
rpc $INDEXER indexer_stateRoot '["51"]' | jq .result
rpc $NODE ksana_getBlock '["51"]' | jq -r .result.header.state_root
```

```output
{
  "height": "51",
  "hash": "5b69b10223571ab01bdee3080d8e1ed25c8ace4fc420f744d23b7d8d5db15981",
  "state_root": "bd7ad23935fc366400a48eb8591696171be864520fd981c3204f9d5e64cc0963"
}
bd7ad23935fc366400a48eb8591696171be864520fd981c3204f9d5e64cc0963
```

两个状态根一致：节点的区块 51，正是索引器只凭比特币重建出来的那个区块。

## 错误

出错的应答里没有 `result`，而是一个 `error` 对象，包含 `code` 和 `message`，有时还有 `data`：

```sh
rpc $NODE ksana_getOpStatus "[\"$KSA\"]" | jq .error
rpc $NODE ksana_getBlock '["0x10"]' | jq .error
rpc $NODE ksana_getBlockCount | jq .error
```

```output
{
  "code": -32004,
  "message": "unknown op"
}
{
  "code": -32602,
  "message": "block identifier must be \"latest\", a decimal height or a 64-digit hex hash"
}
{
  "code": -32601,
  "message": "Method not found"
}
```

| 错误码 | 含义 |
| --- | --- |
| `-32601` | 没有这个方法，或者本节点不提供它（没有相应索引时的操作列表方法和代币方法） |
| `-32602` | 参数格式错误：十六进制、解码、长度、范围 |
| `-32010` | 操作违反共识规则，或者是路径 C 操作；`id` 为 `null` 时，是一个超过 64 个调用的批量请求（[限制](#limits)） |
| `-32011` | 节点的策略拒绝了这个操作：手续费太低、条目池已满、替换时手续费提高得不够；`id` 为 `null` 时，是一个回答会超过 10 MiB 的批量请求 |
| `-32004` | 对象不存在：操作、区块、资产、结算、未核对的区块 |
| `-32009` | 节点繁忙：同时有太多 `ksana_call` 请求；请稍后再试 |
| `-32603` | 节点的内部错误 |
| `-32006` | 一个 WebSocket 连接上的订阅太多（[限制](#limits)） |
| `-32007` | 请求长于 1 MiB |
| `-32008` | 回答会长于 10 MiB |
