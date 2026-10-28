---
title: 账户与地址
nav: 账户
lede: 你的 Ksana 账户就是你的 Taproot 地址。`tb1p` 或 `bc1p` 地址背后的那把密钥，在比特币上接收比特币，在 Ksana 上持有 KSA 和代币，还为你的操作签名。
description: Ksana 账户是 Taproot 输出公钥（BIP86）。地址怎样对应账户，钱包和密钥文件怎样签名（BIP322、BIP340），nonce 怎样运作，余额和资产记在哪里，以及合约为什么只有 ID、没有地址。
---

## 一把密钥，一个地址

Ksana 账户是 32 个字节：一个 Taproot 地址的输出公钥（BIP86 密钥路径的公钥，没有脚本树）。地址就是这 32 个字节的 bech32m 写法，所以账户和地址可以双向互相转换。凡是 Ksana 要你提供账户的地方（ksana-cli、TypeScript SDK、节点的 `--producer`），填地址或 64 位十六进制都可以。

| 网络 | 地址开头 | 比特币网络 |
| --- | --- | --- |
| devnet | `bcrt1p` | regtest |
| signet | `tb1p` | signet |
| 主网 | `bc1p` | 主网（Ksana 主网尚未上线） |

只需复制一样东西，也不用做任何转换：别人给你用来收比特币的地址，就是你给他转 KSA 时用的地址；就算粘贴错了地方，转出的资产也仍然落在他的密钥上。其他类型的地址（`tb1q` P2WPKH、P2SH、传统地址）不能作为账户。只有 Taproot 地址本身就是一把 32 字节、能签名的密钥，客户端拒绝把其他任何形式读作账户。

`ksana-cli key` 在密钥文件不存在时创建它（内容是 64 位十六进制，文件权限 0600），并打印两种形式：

```sh
ksana-cli --chain signet key alice.key
```

```output
{
  "account": "5b276a0956672ea3037ef7758651f99ac7d0bd18b7a6ba31d913fe3855a29f03",
  "address": "tb1ptvnk5z2kvuh2xqm77a6cv50entrap0gck7nt5vwez0lrs4dznupsucam9p",
  "internal_key": "50515c21347f82ea2eb7fdadc95c50d812ea1490e042e67289144278e79931d8",
  "script": "51205b276a0956672ea3037ef7758651f99ac7d0bd18b7a6ba31d913fe3855a29f03"
}
```

`account` 是 Taproot 输出公钥，操作里写的就是它；`address` 是同样这些字节的 signet 地址写法。`internal_key` 是其中未经调整的那把公钥，`script` 是这个地址的输出脚本：`OP_1` 后面跟着账户。用 SDK 时，`parseAccount` 两种形式都能读，`accountToAddress` 把账户写成地址：

```typescript
import { accountToAddress, parseAccount, toHex } from '@ksana/sdk';

const address = 'tb1ptvnk5z2kvuh2xqm77a6cv50entrap0gck7nt5vwez0lrs4dznupsucam9p';
const account = parseAccount(address, 'signet'); // 32 字节：Taproot 输出公钥
console.log(toHex(account)); // 5b276a0956672ea3037ef7758651f99ac7d0bd18b7a6ba31d913fe3855a29f03
console.log(accountToAddress(account, 'signet') === address); // true
```

::: warning 密钥文件也是比特币密钥
谁持有 `alice.key`，谁就能花掉转到它地址上的比特币，也能动用它的 KSA。测试密钥只用在测试网络上：同一把密钥在每个网络上都是同一个账户，它的 `bc1p` 写法就是一个真实的比特币地址。
:::

## 密钥与签名

每笔操作都带着其账户的签名。签名可以采用两种形式，两者证明的都是你控制着同一把 Taproot 密钥：

- **BIP340**，ksana-cli 和使用本地密钥的 SDK 用的就是它：一个直接对照账户本身验证的 Schnorr 签名。因为账户是调整后的输出公钥，签名者要用经过 BIP86 调整的私钥签名，和 Taproot 密钥路径花费的做法一样。
- **BIP322 simple**，浏览器钱包用的就是它：钱包用自己的 Taproot 地址对一条文本消息签名，这条消息就是操作的签名哈希，写成 64 位小写十六进制。Unisat 用 `signMessage(message, 'bip322-simple')` 签名；Xverse 用它的 Ordinals 地址签名，那是一个 Taproot 地址。Xverse 的付款地址通常是 P2SH-P2WPKH，不能作为账户。

签名哈希是对不含签名的操作计算的带标签哈希（`Ksana/VmOp/v1`）；对路径 C，它还覆盖携带这笔操作的比特币交易中，第一个输入所花费的输出点。有了这个标签，Ksana 签名永远不可能成为有效的比特币交易签名。操作里的链 ID 防止它被重放到别的网络上，nonce 防止它在本网络上执行两次。

::: danger 看清你签的是什么
这层保护是单向的。一个页面如果让你的钱包对一串“随机”的 64 位十六进制字符做 BIP322 签名，它给你看的可能正是一笔花掉你 KSA 的 Ksana 操作的签名哈希。只在能先看到解码后操作的地方签署 Ksana 操作，就像 [signet 钱包](/docs/wallet/)会在你签名前把操作展示出来那样。
:::

## Nonce

每个账户都有一个 nonce：新账户为 0，账户的操作每执行一笔就加一，不论成功还是失败。操作的 nonce 必须等于执行时账户的 nonce，所以每笔操作只执行一次，并且按你编的号依次执行。

- **多笔路径 B 操作**：节点的条目池为每个账户最多保留 64 笔操作，从账户的 nonce 开始编号，其中最多 8 笔可以排在编号的缺口之后。nonce 相同的新操作，只有手续费高出至少十分之一、并且至少高出节点的中继门槛时，才会替换正在等待的那笔。ksana-cli 会从节点取得账户的 nonce 并自动填入，所以要在第一笔被收录之前发出第二笔，请用 `--nonce` 传入下一个编号。
- **路径 C**：nonce 不对或签名验不过的操作会失败，但不会用掉 nonce。路径 B 和路径 C 共用 nonce，而路径 C 操作要等比特币确认之后才执行，所以如果一笔 nonce 相同的路径 B 操作抢先被收录，路径 C 操作就会失败，它付的比特币手续费也就白付了。路径 C 操作还在等待时，请给你的路径 B 操作使用排在它后面的 nonce。
- **充值**用一次性密钥在 nonce 0 上签署领取操作，所以永远不会和你账户的操作相互竞争（[操作与手续费](/docs/submitting-ops/#top-up)）。

## 余额与资产

链上只有一张余额表，所有 32 字节账户都记在里面，个人和合约一视同仁，每种资产各记一个数额：

- **KSA**，内置代币：资产 ID 是 32 个零字节，8 位小数。数额一律是最小单位的整数：1 KSA 等于 100,000,000 个最小单位。
- **合约发行的内置资产**：合约用宿主函数 `asset_create` 或 `asset_issue` 创建自己的资产。每个资产 ID 是合约 ID 后接一个由合约自选的 32 字节 `sub_id`，再取 SHA-256。这些资产和 KSA 用同一个转账动作转移，也可以附带在合约调用上。资产的发行方可能拥有它创建资产时声明的能力，例如冻结账户或暂停资产；`ksana_getAsset` 会列出这些能力，而且没有哪一项能让发行方拿走余额（[宿主函数](/docs/host-functions/#assets)）。
- **代币合约**，比如示例合约 `token`，把余额记在自己的存储里。要转移这些余额就得调用合约，账户查询也不会列出它们：请直接问合约，比如调用它的 `balance_of` 方法。

`ksana-cli account`（RPC 方法 `ksana_getAccount`）显示一个账户的 nonce 和内置资产余额。下面查询的是 signet 水龙头的账户：

```sh
export KSANA_RPC={{signet.rpc}}
ksana-cli --chain signet account tb1pmenq8uzjl4dl4tjk0z32yzhx4e87ftsqezwmwz3wl6n59xz34lqqlgaqc2
```

```output
{
  "account": "de6603f052fd5bfaae5678a2a20ae6ae4fe4ae00c89db70a2efea7429851afc0",
  "address": "tb1pmenq8uzjl4dl4tjk0z32yzhx4e87ftsqezwmwz3wl6n59xz34lqqlgaqc2",
  "at": {
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f",
    "height": "61"
  },
  "balances": [
    {
      "amount": "9999949999999995",
      "asset": "0000000000000000000000000000000000000000000000000000000000000000"
    }
  ],
  "locked_fees": [],
  "nonce": "5"
}
```

`at` 是这份结果所依据的区块。对出块者而言，`locked_fees` 列出的是要等它的区块数据写入比特币后才会入账的奖励和手续费（[KSA 与奖励](/docs/ksa/)）。

## 合约有 ID，没有地址

合约由一个 32 字节的合约 ID 来标识：

- 由账户部署的：把部署者的账户、部署操作的 nonce（8 个小端字节）和代码的 SHA-256 依次连在一起，再取 SHA-256；
- 由另一个合约创建的：把创建者合约的 ID、它自选的 32 字节盐值和代码的 SHA-256 连在一起，取 SHA-256。

合约 ID 不是密钥：谁也无法替它签名，只有合约自己的代码能动用它的资产。正因如此，合约没有地址，你要把它写成 64 位十六进制。它和其他所有账户共用同一张余额表，所以用一笔普通转账就能把 KSA 转到合约 ID 上。

::: warning 千万不要把比特币转到合约 ID
有些合约 ID 恰好是有效的 Taproot 公钥，对这些 ID，ksana-cli 的 `account` 命令和 SDK 的 `accountToAddress` 会打印出一个 `tb1p` 地址。没有人持有它的密钥：转到那里的比特币永远花不出去。
:::

## 比特币与 KSA 分开记账

你的地址在比特币上持有比特币，在 Ksana 上持有 KSA，两本账从不相混：

- 转到你地址上的比特币不会给你带来 KSA，KSA 也不能提取成比特币。
- 你的比特币钱包显示你的比特币；[signet 钱包](/docs/wallet/)、ksana-cli 或任何节点显示你的 KSA。
- 要把比特币换成 KSA，可以[充值](/docs/submitting-ops/#top-up)：用一笔比特币交易付款给一位已在兑换合约里锁定了 KSA 的卖方，合约随即给你入账。

账户、签名和 nonce 的完整规则见[规范 §4]({{repo}}/blob/main/docs/SPEC.md#4-accounts-signatures-and-vmop)。
