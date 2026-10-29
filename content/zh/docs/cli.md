---
title: 命令行客户端
nav: ksana-cli
lede: "`ksana-cli` 通过 JSON-RPC 与一个 Ksana 节点通信。它能生成密钥，读取账户、区块和操作，走路径 B 或路径 C 发送转账和合约调用，还能完成充值中买卖双方各自的操作。"
description: ksana-cli 的每一条命令，附公开 signet 上的示例：从密钥和查询，到转账、合约、通过 bitcoind 走路径 C、兑换合约和充值。
---

`ksana-cli` 通过节点的 JSON-RPC 读取链上数据，并在你的机器上用密钥文件签署操作，所以任何节点都看不到你的私钥。走路径 C 和充值时，它还会用到你自己的 bitcoind 里的一个钱包。本页的示例都在[公开 signet](/docs/signet/) 上运行，这是眼下该用的网络；主网尚未上线。回执里的 `asset_changes` 是按这个版本的节点记录的样子给出的；这些操作是 signet 的节点在开始记录这些变动之前执行的，对它们 `ksana-cli` 打印的是 `null`。

## 安装

从代码仓库构建。[快速上手](/docs/quickstart/)列出了构建所需的 Ubuntu 软件包和 `rustup` 配置。

```sh
git clone {{repo}}
cd ksana
rustup toolchain install
cargo build --release --locked -p ksana-cli
target/release/ksana-cli --version
```

```output
ksana-cli 0.1.0
```

构建出的程序是 `target/release/ksana-cli`；把这个目录加进 `PATH`，或者把文件复制到 `PATH` 中的某个目录。`ksana-cli --help` 列出所有命令，`ksana-cli <command> --help` 列出某条命令的选项。

## 全局选项

| 选项 | 默认值 | 含义 |
| --- | --- | --- |
| `--rpc <URL>` | `http://127.0.0.1:8545`，或 `KSANA_RPC` | 节点的 JSON-RPC 地址，HTTP 或 HTTPS 均可。 |
| `--chain <NETWORK>` | 无 | `devnet`、`signet` 或 `mainnet`：你预期节点所在的网络。 |

这两个选项写在命令之前或之后都可以。除 `key` 以外，每条命令都会先读取节点的链 ID，并为那个网络签名。给了 `--chain` 时，如果节点在别的网络上，命令会在签名或发送任何东西之前就拒绝它：

```output
ksana-cli: the node at {{signet.rpc}} is on signet (chain ID 1002), not devnet (--chain): refusing to sign for one network and send to another; drop --chain to use the node's network, or point --rpc at a devnet node
```

每次签名都加上 `--chain signet`，这样即使 `--rpc` 写错了，你也不会为另一个网络签名。

### 环境变量

| 变量 | 对应选项 |
| --- | --- |
| `KSANA_RPC` | `--rpc` |
| `KSANA_BTC_RPC_URL` | `--btc-rpc-url`（路径 C 和充值） |
| `KSANA_BTC_RPC_USER` | `--btc-rpc-user` |
| `KSANA_BTC_RPC_PASS` | `--btc-rpc-pass` |

命令行上的选项优先于对应的变量。`ksana-cli <command> --help` 会在每个选项旁边显示对应变量的当前值，连 bitcoind 的密码也不例外，所以这段输出只留给自己看。

### 输出与退出码

结果以 JSON 写到标准输出，键已排序；金额、nonce 和高度都是十进制字符串。错误以 `ksana-cli: <message>` 的形式写到标准错误，退出码为 1；选项写错时，退出码为 2。一个操作被区块收录、执行却失败时，命令仍以 0 退出，并显示 `"failed"`，所以脚本应当检查 `.status.status`。

凡是命令需要账户的地方，你都可以写节点所在网络的 Taproot 地址（在 signet 上是 `tb1p…`）、64 位十六进制的账户，或者用 `@<key file>` 表示某个密钥文件的账户。金额一律以最小单位计：KSA 有 8 位小数，所以 1 KSA 是 `100000000`。

## 密钥

```sh
ksana-cli --chain signet key alice.key
```

```output
{
  "account": "42cc119256c7207f971d113d908d66dff579f2f94e62eed29027f61f4d524d2d",
  "address": "tb1pgtxpryjkcus8l9cazy7eprtxml6hnuhefe3wa55sylmp7n2jf5kshm2h5s",
  "internal_key": "99b49d4d105d713742dcb48a5e09fab5edf9b564869d99c7ff73ab65dd76e9f2",
  "script": "512042cc119256c7207f971d113d908d66dff579f2f94e62eed29027f61f4d524d2d"
}
```

文件不存在时，`key` 生成一把新的随机私钥写进这个文件（权限 `0600`）；文件已存在时，就读取它。它从不联系节点，也从不打印私钥。文件里存的是 64 位十六进制的私钥，格式与 `ksana-keytool` 和节点的出资密钥相同。

`account` 是 Taproot 输出公钥，也就是你的账户；`address` 是同样这 32 字节写成的 Taproot 地址；`internal_key` 是做 Taproot 调整（tweak）之前的公钥，`script` 是这个地址的输出脚本。不加 `--chain` 或 `--network` 时，`key` 打印的是 devnet 地址（`bcrt1p…`）；`--network regtest|signet|testnet|mainnet` 直接指定地址的编码。[账户与地址](/docs/accounts/)讲解了密钥、账户和地址之间的关系。

::: warning 备份你的密钥文件
密钥文件是其中那把私钥唯一的副本：谁读到它，谁就控制这个账户；丢了它，账户也就丢了。signet 用的密钥，要和持有任何有价值资产的密钥分开存放。
:::

## 读取链上数据

这些命令只读不写。每个回答都在 `at` 里写明它是在哪个区块上读到的。

### `account`

```sh
ksana-cli account @bob.key
```

```output
{
  "account": "7e3f2a17f6af3db190101f3e5d55347a7f0eb83184c2be79ec8ac464da617f41",
  "address": "tb1p0clj59lk4u7mryqsrul964f50flsawp3snptu70v3tzxfknp0aqsey62tx",
  "at": {
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f",
    "height": "61"
  },
  "balances": [
    {
      "amount": "100000000",
      "asset": "0000000000000000000000000000000000000000000000000000000000000000"
    }
  ],
  "locked_fees": [],
  "nonce": "0"
}
```

`balances` 列出账户现在能花的资产，每种资产一项；KSA 就是 ID 为 64 个零的那种资产。`nonce` 是这个账户的下一个操作必须带的 nonce。`locked_fees` 列出还没解锁的收入，比如出块者的手续费和出块奖励，每个区块一项；区块的数据写进比特币之后，它就转入 `balances`。从没用过的账户显示 nonce `0` 和空列表。

节点为代币标准建了索引时，`account` 还会列出 `tokens`，即账户持有的 KS-20 代币及其余额，形如 `[{ "contract", "balance" }]`；以及 `nfts`，即账户持有其中 NFT 的 KS-721 合集，以及各持有多少个，形如 `[{ "contract", "count" }]`。节点没有这份索引时，这两项都不显示。

### `asset`

```sh
ksana-cli asset
```

```output
{
  "asset": "0000000000000000000000000000000000000000000000000000000000000000",
  "at": {
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f",
    "height": "61"
  },
  "capabilities": [],
  "decimals": 8,
  "issuer": "0000000000000000000000000000000000000000000000000000000000000000",
  "name": "KSA",
  "paused": false,
  "symbol": "KSA",
  "total_supply": "11001412730000000"
}
```

不带参数时显示 KSA；要看别的资产，就给出它的资产 ID（64 位十六进制）。KSA 的 `total_supply` 是创世分配加上到目前为止已解锁的出块奖励。

### `contract`

`ksana-cli contract <合约 ID>` 显示一个合约的 `code_hash`、`deployer`、它声明的 `standards`，以及做出声明的那个操作的位置。任何合约都可以查；各字段的说明见 [`ksana_getContract`](/docs/rpc/#ksana_getcontract)。

### `token`

`ksana-cli token <合约 ID>` 显示节点的索引对一个 KS-20 代币或 KS-721 合集所知的一切：它的标准和扩展，名称、符号和小数位数，总量和持有者数，以及 `irregular`，索引不得不略过它的某个事件时为 `true`。各字段的说明见 [`ksana_getToken`](/docs/rpc/#ksana_gettoken)。

### `holders`

`ksana-cli holders <合约 ID>` 列出一个代币或合集的持有者，余额最多的在前。每页默认 50 项；`--limit <N>` 可以要 1 到 500 项，`--after <next>` 接着之前的某一页往下列，传入那一页的 `next`。`nfts` 和 `approvals` 的分页方式相同。

### `nfts`

`ksana-cli nfts <账户>` 列出一个账户持有的 NFT，先按合集、再按 token ID 排列。`--contract <ID>` 只列出一个合集的 NFT。

### `approvals`

`ksana-cli approvals <账户>` 列出一个账户给出的授权：KS-20 授权额度、KS-721 操作员，以及获准转移单个 NFT 的账户，取它们最近一次事件设定的值，不论是否过期。授权额度还剩多少，要看代币的 `allowance` 视图，用 [`query`](#query) 读取。

节点没有这份索引时，会以错误 `-32601` 拒绝 `contract`、`token`、`holders`、`nfts` 和 `approvals`。索引告诉你一个账户持有什么；要按某个数额行事，请用 `query` 向合约查询。

### `op`

```sh
ksana-cli op 032d7d956cff983e57db09411a345aae134aa12b8b0c72305f8cdccfad4bb4b2
```

```output
{
  "block": {
    "hash": "8948675528f5bdfd5f928bc0ee70ebeec9b3a96612738a4a883247824d9bf4d8",
    "height": "28"
  },
  "index": 0,
  "receipt": {
    "asset_changes": [
      {
        "amount": "10000000000",
        "asset": "0000000000000000000000000000000000000000000000000000000000000000",
        "events": 0,
        "from": "de6603f052fd5bfaae5678a2a20ae6ae4fe4ae00c89db70a2efea7429851afc0",
        "kind": "transfer",
        "to": "42cc119256c7207f971d113d908d66dff579f2f94e62eed29027f61f4d524d2d"
      }
    ],
    "error": null,
    "events": [],
    "gas_used": "10000",
    "op_id": "032d7d956cff983e57db09411a345aae134aa12b8b0c72305f8cdccfad4bb4b2",
    "output": "",
    "success": true
  },
  "status": "btc_final"
}
```

`block.height` 是一个主链区块的高度，这个主链区块接受了操作所在的区块；`index` 是操作在所在区块的条目中的位置；`receipt` 是它的执行结果，其中的 `asset_changes` 按先后顺序列出这个操作对内置资产做了什么（各种变动见 [RPC 页面](/docs/rpc/#ksana_getopstatus)）。`status` 是下面几种之一：

| 状态 | 含义 |
| --- | --- |
| `pending` | 在节点的条目池里，还没进区块。 |
| `fast_confirmed` | 已收录，执行成功。 |
| `failed` | 已收录，但执行失败；手续费照扣。 |
| `skipped` | 只被一个无法执行它的平行块收录；不扣任何费用，它会回到条目池，等待再次被收录。 |
| `btc_final` | 执行成功，且所在区块在比特币上已最终。 |

查询节点不认识的操作会报错：`ErrorObject { code: ServerError(-32004), message: "unknown op", … }`。路径 C 的操作在被区块收录之前，节点一直不认识它。[确认与最终性](/docs/confirmations/)讲解了每种状态各自保证什么。

### `block`

`ksana-cli block` 接受 `latest`、一个高度或一个区块哈希。高度指的是该高度上的主链区块；哈希可以指任何区块，平行块也包括在内。

::: details 收录本页那笔转账的区块
```sh
ksana-cli block 29
```

```output
{
  "accepted_height": "29",
  "entries": [
    {
      "Sponsored": {
        "op": {
          "account": "42cc119256c7207f971d113d908d66dff579f2f94e62eed29027f61f4d524d2d",
          "action": {
            "AssetTransfer": {
              "amount": "100000000",
              "asset": "0000000000000000000000000000000000000000000000000000000000000000",
              "to": "7e3f2a17f6af3db190101f3e5d55347a7f0eb83184c2be79ec8ac464da617f41"
            }
          },
          "chain_id": 1002,
          "fee": {
            "Token": {
              "amount": "1"
            }
          },
          "max_gas": "1000000",
          "nonce": "0",
          "sig": {
            "Bip340": "8ee2feb60ec2b4ab2861db2a8a756703ac527b43409f67594a0686f0a832bd356d219e01a72a5a1377e7c9f9152e0148b4788ce4ce1e9c63d7d3fa565cec124b"
          },
          "version": 2
        }
      }
    }
  ],
  "hash": "88ab3dd805eac5654cdd752dc1a0a50c2c8d4fac581e2c46b2bd65bc7f35bb50",
  "header": {
    "bits": 520499087,
    "btc_anchor": {
      "hash": "c770c385e86ae4792f479f8a8c0fd3fde68b3fb604d47911afa42c5103000000",
      "height": 327279
    },
    "entries_root": "11677bbe5187d3b8021bcc06edc2e6cf7eeda32fcd804c8d38bc155120cca92d",
    "height": "29",
    "nonce": "1357",
    "parents": [
      "8948675528f5bdfd5f928bc0ee70ebeec9b3a96612738a4a883247824d9bf4d8"
    ],
    "producer": "ccc06c3ce8d176b3c10138dd4e70873939a9c6dc05597f45aace147ef2c07d3d",
    "state_root": "2138690c600b998a923498e86eea30bef23c9ae5ee5d4eea79527e9a04d25f78",
    "timestamp": "1792558561",
    "version": 2
  },
  "merged": [],
  "receipts": [
    {
      "asset_changes": [
        {
          "amount": "100000000",
          "asset": "0000000000000000000000000000000000000000000000000000000000000000",
          "events": 0,
          "from": "42cc119256c7207f971d113d908d66dff579f2f94e62eed29027f61f4d524d2d",
          "kind": "transfer",
          "to": "7e3f2a17f6af3db190101f3e5d55347a7f0eb83184c2be79ec8ac464da617f41"
        }
      ],
      "error": null,
      "events": [],
      "gas_used": "10000",
      "op_id": "9e3c9bbeacd422ef8888c9992dc0f7024e1b8ae08edec0ed8dc5897495766503",
      "output": "",
      "success": true
    }
  ],
  "settlement": null
}
```
:::

区块头写明了区块的 `parents`、它锚定的比特币区块（`btc_anchor`，其中的哈希按比特币的内部字节序）、它的 `producer` 和 `state_root`。`entries` 与 `receipts` 按位置一一对应；`merged` 列出这个区块合并的平行块，`settlement` 是这个区块携带的提交交易和揭示交易，没有时为 `null`。

### `settlement`

`ksana-cli settlement <block>` 显示携带某个区块数据的比特币交易，以及它们现在到了哪一步：

- `status`：`pending`（还没发出）、`broadcast`（已发出，正等待比特币区块）或 `confirmed`；`confirmed` 下面给出所在的比特币区块及其确认数。
- `settled`：这个区块和它之前的每个区块都已写入比特币时为 `true`。这就是“已写入比特币”这道印记。
- `btc_final`：区块已最终时为 `true`。
- `carrier`：出块者批量结算时，指那个后来的区块，这个区块的数据由它的结算携带；区块的数据由自己携带时为 `null`。
- `carrier_account`：因把区块数据写进比特币而得到携带者报酬的账户，可能是某个区块的出块者（那个区块的结算携带了这份数据），也可能是补发者的收款账户；没有时为 `null`，这部分归出块者。
- `txid_rpc` 和 `commit_txid_rpc`：揭示交易和提交交易的 ID，按比特币区块浏览器的写法；`txid` 和 `commit_txid` 是同样的 ID，按内部字节序写，`confirmed` 下面的哈希也按内部字节序。

没有区块体要上链的区块，即空块或只含路径 C 操作的区块，除非自己带着一次结算，否则没有结算：命令返回 `-32004`，信息是 `that block has no settlement transactions`。[快速上手](/docs/quickstart/#follow-it-to-final)里有一个完整的回答。

### `estimate-fee`

```sh
ksana-cli estimate-fee
```

```output
{
  "at": {
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f",
    "height": "61"
  },
  "feerate_sat_vb": "2",
  "path_b": {
    "amount": "1",
    "per_kib": "4"
  }
}
```

`path_b.amount` 是节点为一笔普通 KSA 转账建议的 `--fee-token`，以最小单位计；`path_b.per_kib` 是按操作成本计、每 KiB 建议的手续费，适用于较大的操作。`feerate_sat_vb` 是节点眼下为自己的结算支付的比特币费率，可作为 `--btc-fee-rate` 的参考。这三个都只是建议；[操作与手续费](/docs/submitting-ops/)讲解了手续费如何运作。

## 发送转账

```sh
ksana-cli --chain signet transfer --key alice.key --to @bob.key \
  --amount 100000000 --fee-token 1 --wait
```

```output
{
  "account": "42cc119256c7207f971d113d908d66dff579f2f94e62eed29027f61f4d524d2d",
  "nonce": "0",
  "op_id": "9e3c9bbeacd422ef8888c9992dc0f7024e1b8ae08edec0ed8dc5897495766503",
  "status": {
    "block": {
      "hash": "88ab3dd805eac5654cdd752dc1a0a50c2c8d4fac581e2c46b2bd65bc7f35bb50",
      "height": "29"
    },
    "index": 0,
    "receipt": {
      "asset_changes": [
        {
          "amount": "100000000",
          "asset": "0000000000000000000000000000000000000000000000000000000000000000",
          "events": 0,
          "from": "42cc119256c7207f971d113d908d66dff579f2f94e62eed29027f61f4d524d2d",
          "kind": "transfer",
          "to": "7e3f2a17f6af3db190101f3e5d55347a7f0eb83184c2be79ec8ac464da617f41"
        }
      ],
      "error": null,
      "events": [],
      "gas_used": "10000",
      "op_id": "9e3c9bbeacd422ef8888c9992dc0f7024e1b8ae08edec0ed8dc5897495766503",
      "output": "",
      "success": true
    },
    "status": "fast_confirmed"
  }
}
```

`transfer` 把 `--amount` 个最小单位的 KSA 转给 `--to`；用 `--asset <ID>` 可以转别的资产。不加 `--wait` 时，节点一接受这个操作，命令就打印 `account`、`nonce` 和 `op_id`，之后你用 `ksana-cli op` 跟踪它。

### 发送选项

`transfer`、`deploy`、`call`，以及会改变状态的几条 `exchange` 命令（`deposit`、`withdraw`、`lock`、`release`）共用下面这些选项。每条命令都需要 `--key`，并且 `--fee-token` 和 `--native` 两者恰好选一个。

| 选项 | 默认值 | 作用 |
| --- | --- | --- |
| `--key <FILE>` | 必填 | 用来签名的密钥文件；操作由它的账户发出。 |
| `--fee-token <AMOUNT>` | | 路径 B：手续费，以 KSA 最小单位计，付给出块者。 |
| `--native` | | 路径 C：用你自己的比特币交易携带这个操作（[见下文](#path-c-with-bitcoind)）。 |
| `--nonce <N>` | 账户的 nonce | 操作的 nonce。 |
| `--max-gas <GAS>` | `1000000` | 执行上限；失败的操作会把它全部用掉。 |
| `--sig <SCHEME>` | `bip340` | `bip340`，或浏览器钱包使用的 `bip322`。 |
| `--wait` | 关闭 | 等到区块收录这个操作（[见下文](#waiting-and-timeouts)）。 |
| `--timeout <SECONDS>` | `120` | `--wait` 等待多久。 |

默认的 nonce 是账户在链顶的 nonce，不计入还在节点条目池里等待的操作。如果第一个操作还没进区块，你就发出了第二个，两个会带同一个 nonce，节点会以 `-32011` 拒绝第二个：`an op with the same nonce already exists; replacing it needs a sponsored fee of at least <FEE>`。在两个操作之间用 `--wait`，或者给每个操作各自指定 `--nonce`。用同一个 nonce、不低于消息里给出的手续费作 `--fee-token`，可以替换一个还在等待的操作：要比它的手续费高出至少十分之一，并且至少高出节点的中继门槛。

## 合约

合约是 WebAssembly 模块。[编写合约](/docs/contracts/)讲解如何构建合约，[代币与资金池教程](/docs/token-and-pool/)则在 signet 上一步步部署并使用两个合约。

### `deploy`

```sh
ksana-cli --chain signet deploy --key alice.key \
  --code crates/ksana-execution/tests/data/token.wasm \
  --init-args 040000005465737403000000545354080010a5d4e80000000000000000000000 \
  --fee-token 1 --wait | tee deploy.json
```

`--code` 是 wasm 文件，`--init-args` 是合约的 `init` 收到的参数，写成十六进制（默认没有参数）。`--fund` 给 `init` 附带资产（[见下文](#arguments-and-attached-funds)）。仓库在 `crates/ksana-execution/tests/data/token.wasm` 放了一个构建好的代币合约；它的 `init` 接受名称、符号、小数位数和总量，这里分别是 `"Test"`、`"TST"`、8 和 1,000,000,000,000 个最小单位。

部署在 `init` 运行之前就要花 100,000 gas，外加每字节代码 20 gas，所以默认的 `--max-gas` 1,000,000 够部署约 40 KB 以内的代码。整个操作（包括代码）必须在 64 KiB 以内（`MAX_OP_BYTES`）。

### 算出合约 ID

`deploy` 不会打印新合约的 ID：要你自己算。合约 ID 是这三样东西的 SHA-256：部署账户，部署操作的 nonce（写成 8 字节小端整数），以及代码的 SHA-256。下面这个 shell 函数用 Python 来算：

```sh
contract_id() {  # 账户、nonce、wasm 文件
  python3 -c 'import hashlib, sys
code = hashlib.sha256(open(sys.argv[3], "rb").read()).digest()
seed = bytes.fromhex(sys.argv[1]) + int(sys.argv[2]).to_bytes(8, "little") + code
print(hashlib.sha256(seed).hexdigest())' "$@"
}
contract_id 6b77bade530385d352e9d68ab6af57d110a4bb27d92dcc3221fe32f8f683bd8a 0 \
  crates/ksana-execution/tests/data/token.wasm
```

```output
e36da19a8adccf6dcfd8c73dccf16a64c032067dc89f28b2ceecdf14c27d392d
```

这是在 signet 上由账户 `6b77bade…` 以 nonce 0 部署的一个代币合约，代码和 `init` 参数都和上面的 `deploy` 一样，下面的 `query` 读的就是它。算你自己部署的合约时，传入 `deploy` 打印的 `account` 和 `nonce`（这里用到 `jq`）：

```sh
TOKEN=$(contract_id "$(jq -r .account deploy.json)" "$(jq -r .nonce deploy.json)" \
  crates/ksana-execution/tests/data/token.wasm)
```

如果 `init` 发出了事件（这个代币合约的 `init` 就会），部署回执的 `events[].contract` 也会显示同一个 ID。

### `query`

`query` 在节点上运行一个合约方法，但不发送任何东西，所以不花手续费，也不需要密钥：

```sh
ksana-cli query --contract e36da19a8adccf6dcfd8c73dccf16a64c032067dc89f28b2ceecdf14c27d392d \
  --method metadata
```

```output
{
  "asset_changes": [],
  "error": null,
  "events": [],
  "gas_used": "37555",
  "op_id": null,
  "output": "04000000546573740300000054535408",
  "success": true
}
```

`output` 是方法返回值的十六进制，这里是 `("Test", "TST", 8)` 的 Borsh 编码。`--args` 传入参数，`--caller <ACCOUNT>` 设定方法看到的调用者（默认是全零的 32 字节），`--fund` 模拟附带的资产。

### `call`

`call` 把一次合约调用作为操作发送出去。这个例子从你在上面部署的代币里转 250 个最小单位给另一个账户，这些代币是 `init` 发到你账户里的；参数 `(to, amount)` 按 Borsh 编码：

```sh
TO=7e3f2a17f6af3db190101f3e5d55347a7f0eb83184c2be79ec8ac464da617f41
AMOUNT=fa000000000000000000000000000000   # 250，写成 16 字节小端整数
ksana-cli --chain signet call --key alice.key --contract "$TOKEN" \
  --method transfer --args "$TO$AMOUNT" --fee-token 1 --wait
```

结果的结构和转账的一样。方法执行 revert 时，结果是 `"status": "failed"`，原因在 `.status.receipt.error` 里，命令仍以 0 退出。

### 参数与附带资产

`--args` 和 `--init-args` 接受十六进制的原始参数字节（可以带 `0x` 前缀）；`ksana-cli` 不会替你做任何编码。示例合约读的是 Borsh：多个参数按顺序组成一个元组，单个参数就编码它本身，没有参数时不写任何字节。

| 类型 | Borsh 编码 |
| --- | --- |
| `u8`、`u32`、`u64`、`u128` | 小端，1、4、8 或 16 字节 |
| `[u8; 32]`（账户或合约 ID） | 这 32 个字节本身 |
| `String`、`Vec<u8>` | 先是长度，写成 4 字节小端整数，然后是这些字节 |

`--fund` 给 `deploy`、`call` 和 `query` 附带资产：`--fund 5000` 附带 5,000 个最小单位的 KSA，`--fund <asset ID>:<amount>` 附带别的资产。要附带多种资产就重复这个选项，最多 16 种，每种资产只能出现一次。

## 用 bitcoind 走路径 C

加上 `--native`，操作就不经过节点的条目池，而是放在你自己的一笔比特币交易里传递：你付比特币手续费，不付 KSA 手续费；交易得到所需的确认后，每个出块者都必须收录这个操作。[操作与手续费](/docs/submitting-ops/)讲解了什么时候这样做有好处。

`ksana-cli` 构造这笔交易，让 bitcoind 的钱包添加输入和找零并签名，再签署这个操作，签名绑定交易的第一个输入，最后广播交易。你需要：

- 你自己的 bitcoind，与节点在同一个比特币网络上（公开 signet 对应 signet），并且能用普通的 `http://` 访问：CLI 连接 bitcoind 不支持 TLS；
- 其中有一个持有一些 sBTC 的钱包；按默认的 2 sat/vB，一笔转账的手续费约 700 聪；
- Bitcoin Core 30 或更高版本，或者设置 `-datacarriersize=100000`，这样你的 bitcoind 才会转发这笔交易里较大的 `OP_RETURN` 输出。

托管的比特币 RPC 代理没有钱包方法，所以做不了这件事。[运行节点](/docs/run-a-node/)介绍了如何在 signet 上搭建 bitcoind。

```sh
export KSANA_BTC_RPC_URL=http://127.0.0.1:38332
export KSANA_BTC_RPC_USER=ksana
export KSANA_BTC_RPC_PASS=<password>
ksana-cli --chain signet transfer --key alice.key --to @bob.key --amount 100000000 \
  --native --btc-wallet <wallet>
```

命令会打印 `account`、`nonce`、`op_id` 和 `btc_txid`，后者是按区块浏览器写法的比特币交易 ID。`--btc-wallet` 指定付款的 bitcoind 钱包（省略时用 bitcoind 唯一加载的那个钱包），`--btc-fee-rate` 设定费率，单位为 sat/vB（默认 2）。

在 signet 上，交易有了 2 个比特币确认（`NATIVE_CONFIRMATIONS` 1 加 `ANCHOR_DEPTH` 1）之后，区块才会收录这个操作；在主网上将需要 5 个。在此之前，`ksana-cli op <op_id>` 会回答 `unknown op`。不要加 `--wait`，或者配上 `--timeout 3600`：默认的 120 秒早在那之前就用完了。

::: warning 收录之前，别动这个账户
路径 C 的操作带着账户的 nonce。如果同一账户的一个路径 B 操作先用掉了这个 nonce，路径 C 的操作被收录时就会失败，比特币手续费也照样花掉了。走路径 C 时，`--max-gas` 必须不超过 1,000,000（`NATIVE_MAX_GAS`），否则操作会在链上失败，并用掉它的 nonce。
:::

## 兑换

充值通过兑换合约出售 KSA、换取比特币：卖方为某一个买方锁定 KSA，买方的比特币付款携带领取操作。`exchange` 这组命令是卖方这一侧的，按示例合约 `ksa-exchange` 编写。signet 上没有人运营常设的兑换合约，所以想试一试，就得自己部署一个。

```sh
(cd contracts && cargo rustc --release --locked --target wasm32-unknown-unknown \
  --package ksa-exchange --crate-type cdylib)
WASM=contracts/target/wasm32-unknown-unknown/release/ksa_exchange.wasm
ksana-cli --chain signet deploy --key seller.key --code $WASM --fee-token 1 --wait \
  | tee exchange.json
EXCHANGE=$(contract_id "$(jq -r .account exchange.json)" "$(jq -r .nonce exchange.json)" $WASM)
```

这个合约的 `init` 不接受参数，`contract_id` 就是[算出合约 ID](#find-the-contract-id) 里的那个函数。接着，以卖方身份执行：

```sh
ksana-cli --chain signet exchange lock --key seller.key --fee-token 1 \
  --exchange "$EXCHANGE" --ksa 3000000 --price 100 --fund 3000000 \
  --address <a fresh tb1 address of yours> --beneficiary <buyer's account> \
  --expiry <Bitcoin height> --wait
```

这会为买方锁定 3,000,000 个最小单位的 KSA，价格是每聪 100 个最小单位，所以 30,000 聪就能买下全部。结果里的 `lock` 字段是锁定编号；把它和兑换合约的 ID 一起交给买方。

- `--fund` 给这次调用附带 KSA，这些 KSA 先进入你在合约里的可用余额，锁定再从中取出 `--ksa`。`exchange deposit --amount <N>` 预先往这个余额里存入，`exchange withdraw --amount <N>` 从中取出；两者都不动任何锁定。
- `--address`（或 `--script <hex>`）是买方付款的去处。每个锁定都用一个新地址：合约会拒绝任何先前的锁定用过的收款脚本。
- `--expiry` 是一个比特币高度，必须高于当前区块锚定的高度（`ksana-cli block latest` 里的 `header.btc_anchor.height`）。signet 大约每十分钟出一个块，所以要留足余量，让买方来得及付款。
- `exchange release --lock <N>` 把仍锁定的部分退回你的可用余额。只有锚定的比特币高度达到到期高度再加 6 个块之后，它才有效。

有两条命令只读取：

```sh
ksana-cli exchange show --exchange "$EXCHANGE" --lock 0
ksana-cli exchange balance --exchange "$EXCHANGE" --seller @seller.key
```

`show` 打印锁定的 `seller`、`beneficiary`、收款 `script`、`price`、仍锁定的 `ksa`、`expiry`、`sats_for_all`（买下全部所需的聪数）以及它的 `state`：`open`、`released`，或者 `claimed` 并附上已付的金额。`balance` 打印你在合约里的可用余额。

## 充值

`top-up` 是买方这一侧。一笔比特币交易既向锁定的地址付款，又以路径 C 操作的形式携带领取操作；领取操作由一次性密钥签名，所以你自己的账户什么都不用签，也不消耗 nonce。

```sh
ksana-cli --chain signet top-up --exchange <exchange ID> --lock <lock number> \
  --beneficiary @buyer.key --sats 30000 --btc-wallet <wallet>
```

付款之前，命令会先读取锁定，遇到下列情况就拒绝付款：

- 锁定的受益账户不是 `--beneficiary`，因为那样 KSA 会落到别人手里；
- 锁定不处于开放状态；
- 离到期只剩 3 个或更少的比特币区块（`--expiry-margin`，默认 3）；
- `--sats` 与买下仍锁定的全部 KSA 所需的金额不同。`--allow-partial` 允许你只买一部分，其余继续为你锁定；`--allow-overpay` 允许你多付，但多付的部分买不到更多。

它和[路径 C](#path-c-with-bitcoind) 一样需要 bitcoind，并打印领取操作的 `op_id`、`btc_txid`、比特币手续费、你得到的 `ksa` 以及锁定的条款。区块收录领取操作时，KSA 就到了受益账户；在 signet 上，这是 2 个比特币确认之后。在浏览器里，[signet 钱包](/docs/wallet/)也能做同样的事。

## 等待与超时

`--wait` 每半秒向节点查询一次操作的状态，遇到 `fast_confirmed`、`failed` 或 `btc_final` 就返回；操作处于 `pending` 或 `skipped` 时，它会继续等待。等满 `--timeout` 秒（默认 120）后，如果最后看到的状态是 `skipped`，它就打印这个状态，否则以错误结束，退出码为 1：

```output
ksana-cli: timed out waiting for the op to be included (120 seconds)
```

::: note 操作可能仍在路上
超时不会取消任何东西：操作已经发出；走路径 C 或 `top-up` 时，比特币交易也已广播。而且错误会取代结果，所以 `op_id` 和 `btc_txid` 都不会打印出来。
:::

要弄清发生了什么：

- 对发送账户运行 `ksana-cli account`：如果 `nonce` 增加了，说明已有区块收录了这个操作。
- 走路径 C 时，在出资的钱包里找这笔交易（`bitcoin-cli -signet -rpcwallet=<wallet> listtransactions`），并等它得到确认。
- 用节点的 `ksana_getAccountOps` 方法列出这个账户最近的操作，最新的在前。它接受 64 位十六进制的账户，给出每个操作的 `op_id` 和状态（这里用到 `jq`）：

```sh
ACCOUNT=$(ksana-cli account @alice.key | jq -r .account)
BODY='{"jsonrpc":"2.0","id":1,"method":"ksana_getAccountOps","params":["'$ACCOUNT'",null,5]}'
curl -sS {{signet.rpc}} -H 'content-type: application/json' \
  --data "$BODY" | jq .result
```

```output
{
  "ops": [
    {
      "op_id": "9e3c9bbeacd422ef8888c9992dc0f7024e1b8ae08edec0ed8dc5897495766503",
      "status": "btc_final",
      "block": {
        "height": "29",
        "hash": "88ab3dd805eac5654cdd752dc1a0a50c2c8d4fac581e2c46b2bd65bc7f35bb50"
      },
      "index": 0,
      "position": "29:0:0"
    },
    {
      "op_id": "032d7d956cff983e57db09411a345aae134aa12b8b0c72305f8cdccfad4bb4b2",
      "status": "btc_final",
      "block": {
        "height": "28",
        "hash": "8948675528f5bdfd5f928bc0ee70ebeec9b3a96612738a4a883247824d9bf4d8"
      },
      "index": 0,
      "position": "28:0:0"
    }
  ],
  "next": null,
  "at": {
    "height": "61",
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f"
  }
}
```

这个列表包括账户签署的操作、它收到的转账，以及代币事件或内置资产的变动提到它的操作；这里的第二项就是水龙头发来的那笔。在确定第一个操作失败之前，不要换一个新 nonce 再发一次，否则两个都可能执行成功。[JSON-RPC 参考](/docs/rpc/)介绍了 `ksana_getAccountOps` 及其分页。

## 常见错误

| 错误信息 | 怎么办 |
| --- | --- |
| `reading the chain ID of the node at …: … Connection refused` | 节点没有运行，或者 `--rpc` 写错了。 |
| `… Method not found …`（读取链 ID 时） | `--rpc` 指向的不是节点，比如指向了索引器。 |
| `invalid account: invalid address: validation error` | 这个地址属于另一个网络，不是节点所在的网络。 |
| `the following required arguments were not provided: <--fee-token <FEE_TOKEN>\|--native>` | 选择路径 B（`--fee-token`）或路径 C（`--native`）。 |
| `-32011` … `an op with the same nonce already exists` | 之前的操作还在等待；等它被收录，或者设置 `--nonce`。 |
| `bitcoind …: … https feature is not enabled` | 连接 bitcoind 要用 `http://`。 |
| `bitcoind fundrawtransaction: … Method not found` | 那个 bitcoind 没有钱包，托管的代理就是这样。改用你自己的、带钱包的 bitcoind。 |
