---
title: 快速上手
lede: 在公开 signet 上领取测试 KSA，用浏览器钱包或命令行发出你的第一笔操作，再看着它在比特币上变为最终。
description: 从 signet 水龙头领取测试 KSA，用 Unisat、Xverse 或 ksana-cli 发出第一笔 Ksana 操作，再跟着它从快轨确认走到最终。
---

本页带你从零开始，完成一笔在比特币上已经最终的转账。一切都在[公开 signet](/docs/signet/) 上进行，那是 Ksana 运行在比特币 signet 上的测试网络：上面的币没有价值，主网也尚未上线。

两条路线，任选其一。[在浏览器中](#in-the-browser)需要一个比特币钱包扩展，花上几分钟。[在命令行中](#from-the-command-line)需要 Rust 工具链，网络返回的每一个值都看得到。

无论走哪条路线，你的操作都会经过三道印记：

::: figure marks
一笔操作几秒内就会快轨确认；携带其所在区块的交易被挖出后，它就已写入比特币；有了 6 个比特币确认、再过 5 个区块加固判定，它就是最终的。
:::

| 印记 | 含义 | 在 signet 上 |
| --- | --- | --- |
| 快轨确认 | 出块者已把你的操作放进一个区块，每个节点都执行了它。 | 约 5 秒 |
| 已写入比特币 | 区块的数据已在一个比特币区块里，任何人都能读到。 | 通常是结算发出后的下一个比特币区块 |
| BTC 最终 | 这些数据有了六个确认时，每个节点和索引器都依据比特币判定该区块为最终；做出这一判定的比特币区块，也已有了六个确认。 | 写入比特币约 50 分钟后有 6 个确认，再过约 50 分钟 BTC 最终 |

[确认与最终性](/docs/confirmations/)一页解释了每道印记各保证什么，以及各种付款分别要等多久。

## 在浏览器中

你需要 Unisat 或 Xverse 的浏览器扩展。signet 钱包页面连接的是托管的 signet 节点，所以除了钱包，什么都不用装。

::: steps

### 设置比特币钱包

把钱包切换到 **Bitcoin Signet**，并使用 **Taproot (P2TR)** 地址。你的 Ksana 账户就是你的 Taproot 地址：KSA 和比特币共用这个地址，各自记在自己的链上。其他类型的地址不能持有 KSA。

- **Unisat**：选择 Taproot 地址类型。
- **Xverse**：账户的 Ordinals 地址就是 Taproot 地址，页面用的就是它。

页面会询问钱包当前设在哪个网络，其他网络一律拒绝，因为光凭 `tb1…` 地址分不清 signet 和 testnet。

### 连接 signet 钱包

打开 [{{signet.wallet}}]({{signet.wallet}}?lang=zh-CN)，选择**钱包**，再选**连接钱包**，然后选中你的钱包。在扩展里批准这次连接。

页面只请求签名。它看不到你的密钥，也从不保管你的币。

### 领取测试 KSA

空钱包会在余额下方显示**领取测试 KSA**；**收款**页上也有同一个水龙头，按钮是**从 signet 水龙头领取测试 KSA**。两者都会给你的账户发 100 KSA。

水龙头每天给每个账户发一次。出块者一收录水龙头的转账，KSA 就会到账，只需几秒。

### 发送 KSA

选择**发送**，粘贴收款账户（一个 `tb1p…` 地址，或写成 64 位十六进制的账户），再填写金额。提交方式保持**代付**（路径 B）：手续费是一小笔 KSA，页面会给出建议值。

选择**检查并签名**，核对收款账户的首尾几位字符，再选**签名并提交**。钱包会请你签署一条消息（BIP322）。不动用任何比特币，也不付比特币手续费。

### 观察三道印记

签名之后，发送页会变成这笔操作的进度：**待收录**、**快轨确认**、**已写入比特币**、**BTC 最终**。几秒之内就会到达快轨确认。另外两道印记要跟着比特币出块，所以你可以让页面开着，或者过一会儿再回来：钱包的**进行中**列表和**活动**会一直跟踪，**在区块浏览器中查看**能看到涉及的每一笔比特币交易。

:::

页面的其余功能见 [Signet 钱包](/docs/wallet/)：路径 C、充值、区块浏览器，以及连接你自己的节点。

## 在命令行中

`ksana-cli` 是 Ksana 节点的命令行客户端。这里它通过 HTTPS 连接托管的 signet 节点；水龙头是一个普通的 HTTP API，用 `curl` 调用。

::: steps

### 构建 ksana-cli

测试过的平台是 Ubuntu 22.04。安装 C 工具链、`clang` 和 `libclang`（RocksDB 要从源码编译）、`git`、`curl`、`jq`（其他页面用它从 JSON 里取字段）以及 `rustup`：

```sh title="Ubuntu 22.04 上的前置依赖"
sudo apt-get update
sudo apt-get install -y build-essential clang libclang-dev git curl jq
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain none
. "$HOME/.cargo/env"
```

克隆仓库并构建。`rustup toolchain install` 会读取 `rust-toolchain.toml`，安装固定版本的 Rust（1.98.1）。第一次构建要编译 RocksDB 和 wasmtime，在小机器上可能要半小时。

```sh
git clone {{repo}}
cd Ksana
rustup toolchain install
cargo build --release --locked -p ksana-cli
export PATH="$PWD/target/release:$PATH"
ksana-cli --version
```

```output
ksana-cli 0.1.0
```

### 生成密钥

先让 CLI 指向 signet 节点，再创建一个密钥文件。文件不存在时，`key` 会把一把新的随机私钥写进这个文件（权限 `0600`），并打印它的账户和地址；私钥本身从不打印。

```sh
export KSANA_RPC={{signet.rpc}}
ksana-cli --chain signet key alice.key
```

```output
{
  "account": "db3fd0c741d4ba7641a00125bb7e76765ec923a4b86323b901dfb85fb16dea2b",
  "address": "tb1pmvlap36p6ja8vsdqqyjmklnkwe0vjgayhp3j8wgpm7u9lvtdag4s9ngk3n",
  "internal_key": "8ff637a4906fb51061c45cbff37ca22e753313b1d5d56bd7676c7dc5a17fc098",
  "script": "5120db3fd0c741d4ba7641a00125bb7e76765ec923a4b86323b901dfb85fb16dea2b"
}
```

`address` 和 `account` 是同样的 32 个字节，只是写法不同：前者是 Taproot 地址，后者是它的输出公钥的十六进制形式。`--chain signet` 让 `key` 打印 signet 地址；用在其他任何命令上，它会让 CLI 拒绝连接其他网络的节点。

密钥文件是这把私钥唯一的副本：谁读到它，谁就控制这个账户；丢了它，账户也就丢了。

### 向水龙头申请

把你的地址发给水龙头。请把下面的地址换成你的 `key` 命令打印出的 `address`。

```sh
curl -sS {{signet.faucet}} -H 'content-type: application/json' \
  --data '{"to": "tb1pmvlap36p6ja8vsdqqyjmklnkwe0vjgayhp3j8wgpm7u9lvtdag4s9ngk3n"}'
```

```output
{"op_id":"89a278baadbd3162118630a5119a456c18af6e3e7c5b5d0761c62bb20656d7f0","to":"db3fd0c741d4ba7641a00125bb7e76765ec923a4b86323b901dfb85fb16dea2b","amount":"10000000000","nonce":"1"}
```

水龙头以一笔普通转账发出 100 KSA（`10000000000` 个最小单位：KSA 有 8 位小数），`op_id` 就是这笔转账的标识。节点一接受这笔转账，水龙头就会应答。每个账户每天可以申请一次；其他限制见[公开 signet](/docs/signet/)。

### 查看余额

几秒钟后，这笔转账就进了区块：

```sh
ksana-cli account @alice.key
```

```output
{
  "account": "db3fd0c741d4ba7641a00125bb7e76765ec923a4b86323b901dfb85fb16dea2b",
  "address": "tb1pmvlap36p6ja8vsdqqyjmklnkwe0vjgayhp3j8wgpm7u9lvtdag4s9ngk3n",
  "at": {
    "hash": "d8a91f8bdec0fd69849615308b8b800eec04e6f0aee037ed6fa6e97950604cc1",
    "height": "26"
  },
  "balances": [
    {
      "amount": "10000000000",
      "asset": "0000000000000000000000000000000000000000000000000000000000000000"
    }
  ],
  "locked_fees": [],
  "nonce": "0"
}
```

`@alice.key` 代表该文件中那把密钥的账户；直接写地址或 64 位十六进制也可以。KSA 的资产 ID 是 64 个零。如果 `balances` 还是空的，等几秒再查一次。

### 发送 1 KSA

再生成一把密钥作为收款方，然后走路径 B 给它转 1 KSA（`100000000` 个最小单位），手续费为 1 个最小单位：

```sh
ksana-cli --chain signet key bob.key
ksana-cli --chain signet transfer --key alice.key --to @bob.key \
  --amount 100000000 --fee-token 1 --wait
```

```output
{
  "account": "db3fd0c741d4ba7641a00125bb7e76765ec923a4b86323b901dfb85fb16dea2b",
  "nonce": "0",
  "op_id": "262b5d466a9f2fc69b2362c38352b635dce95d4385514ac994137891a8cf3dc9",
  "status": {
    "block": {
      "hash": "2681d67b65bc2dabad6ada543bffcb4562ed5dfdb89c8e57f1dc89f75a021e4f",
      "height": "27"
    },
    "index": 0,
    "receipt": {
      "asset_changes": [
        {
          "amount": "100000000",
          "asset": "0000000000000000000000000000000000000000000000000000000000000000",
          "events": 0,
          "from": "db3fd0c741d4ba7641a00125bb7e76765ec923a4b86323b901dfb85fb16dea2b",
          "kind": "transfer",
          "to": "9baa61325ed3b2e169065bdff5ffffe5f5b20ca90bf5f35301f44fb515d039cf"
        }
      ],
      "error": null,
      "events": [],
      "gas_used": "10000",
      "op_id": "262b5d466a9f2fc69b2362c38352b635dce95d4385514ac994137891a8cf3dc9",
      "output": "",
      "success": true
    },
    "status": "fast_confirmed"
  }
}
```

`--wait` 会轮询节点，直到操作执行完毕；这一笔在发出约四秒后，于区块 27 快轨确认。`--fee-token` 是路径 B 的手续费，以 KSA 最小单位计，付给出块者。`ksana-cli estimate-fee` 会打印节点的建议值，这笔转账发出前是 `1`：signet 节点在区块还有空间时，会收录手续费不低于 `1` 的操作。回执里的 `asset_changes` 列出这笔操作对内置资产做的变动，这里是 1 KSA 从 alice 的账户转到 bob 的账户，按这个版本的节点记录的样子给出；这笔转账是 signet 的节点在开始记录这些变动之前执行的，节点对它的回答是 `null`。

### 跟踪到最终

所在区块最终之后，这笔操作的状态就会从 `fast_confirmed` 变为 `btc_final`：

```sh
ksana-cli op 262b5d466a9f2fc69b2362c38352b635dce95d4385514ac994137891a8cf3dc9
```

```output
{
  "block": {
    "hash": "2681d67b65bc2dabad6ada543bffcb4562ed5dfdb89c8e57f1dc89f75a021e4f",
    "height": "27"
  },
  "index": 0,
  "receipt": {
    "asset_changes": [
      {
        "amount": "100000000",
        "asset": "0000000000000000000000000000000000000000000000000000000000000000",
        "events": 0,
        "from": "db3fd0c741d4ba7641a00125bb7e76765ec923a4b86323b901dfb85fb16dea2b",
        "kind": "transfer",
        "to": "9baa61325ed3b2e169065bdff5ffffe5f5b20ca90bf5f35301f44fb515d039cf"
      }
    ],
    "error": null,
    "events": [],
    "gas_used": "10000",
    "op_id": "262b5d466a9f2fc69b2362c38352b635dce95d4385514ac994137891a8cf3dc9",
    "output": "",
    "success": true
  },
  "status": "btc_final"
}
```

这中间，区块的结算会显示“已写入比特币”这道印记：携带这个区块以及它之前每一个区块的比特币交易全部被挖出后，`settled` 就变为 `true`。下面这份应答取自这些交易有四个确认的时候（`jq` 去掉了 `txs`，即原始交易）：

```sh
ksana-cli settlement 27 | jq 'del(.txs)'
```

```output
{
  "block": {
    "hash": "2681d67b65bc2dabad6ada543bffcb4562ed5dfdb89c8e57f1dc89f75a021e4f",
    "height": "27"
  },
  "btc_final": false,
  "carrier": {
    "hash": "338c18790906240dd8c9943ce84e3b983b24fe2469811e19c45df773f73d0250",
    "height": "31"
  },
  "carrier_account": "b40c816d58ee2578da0118a9c6feeca74b80280f92030bdfa510821ae2887954",
  "commit_txid": "393b36ea0b049dcd64ec8dfe39f558485965fecace3552d3da8cf95f463c5308",
  "commit_txid_rpc": "08533c465ff98cdad35235cecafe65594858f539fe8dec64cd9d040bea363b39",
  "confirmed": {
    "block": "c2d6d161fdef456778a3df4f2ffe65a4627ad100ccbd24122d78fd5006000000",
    "confirmations": 4,
    "height": 327281,
    "txid": "d2232fdbfa7d9b6f16c65cfc60645ccb4ca38fb6aa32f7711d0128b745124f5a"
  },
  "settled": true,
  "status": "confirmed",
  "txid": "d2232fdbfa7d9b6f16c65cfc60645ccb4ca38fb6aa32f7711d0128b745124f5a",
  "txid_rpc": "5a4f1245b728011d71f732aab68fa34ccb5c6460fc5cc6166f9b7dfadb2f23d2"
}
```

区块 27 没有自己的结算：区块 31 的结算携带了它的数据（`carrier`），signet 区块 327,281 收录了这笔结算。第 6 个确认之后再过 5 个比特币区块，给出第 6 个确认的那个比特币区块也有了 6 个确认，`btc_final` 就变为 `true`。`txid_rpc` 是揭示交易按区块浏览器的写法给出的 ID，比如 [mempool.space 上的这一笔](https://mempool.space/signet/tx/5a4f1245b728011d71f732aab68fa34ccb5c6460fc5cc6166f9b7dfadb2f23d2)。

:::

## 实际用时

本页的这笔转账发出于 2026 年 10 月 21 日 04:55:27 UTC。下表的时间是 `ksana-cli` 第一次显示各道印记的时刻；`--wait` 返回之后，大约每 15 秒用它查询一次。

| 印记 | 看到的时刻（UTC） | 距发出 |
| --- | --- | --- |
| 快轨确认，收进区块 27 | 04:55:31 | 4 秒 |
| 已写入比特币，进入 signet 区块 327,281 | 05:02:04 | 7 分钟 |
| 6 个确认，于 signet 区块 327,286 | 05:31:42 | 36 分钟 |
| BTC 最终，于 signet 区块 327,291 | 05:44:09 | 49 分钟 |

这笔转账发出时，区块 19 的结算还在等一个 signet 区块，所以区块 27 没有自己的结算：它的数据随区块 31 的结算上链，区块 31 里的合约部署超过 10 KiB，大到不必等待就能结算。signet 区块 327,281 是 21 分钟来的第一个区块，它确认了这两次结算。第 6 个确认比“已写入比特币”晚 30 分钟，BTC 最终又晚 12 分钟：327,281 之后的十个 signet 区块，彼此间隔从 2 秒到 10 分钟不等，平均约 4 分钟。signet 平均十分钟出一个区块，所以预计约 1 小时有 6 个确认，约 110 分钟 BTC 最终，有时更久。

## 下一步

::: cards
- [Ksana 的工作原理](/docs/how-it-works/) 快轨、写进比特币的结算，以及由比特币判定的最终性。
- [操作与手续费](/docs/submitting-ops/) 路径 B、路径 C 和充值，以及各自的花费。
- [ksana-cli](/docs/cli/) 每一条命令：查询、合约、路径 C 和兑换。
- [运行节点](/docs/run-a-node/) 自己跟随 signet，对照比特币检查每个区块，并挖矿。
:::
