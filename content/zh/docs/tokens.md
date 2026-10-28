---
title: 资产与代币
lede: Ksana 有内置资产，由 VM 记录；也有代币，由合约按两种标准记录：KS-20 用于同质化代币，KS-721 用于独一无二的代币。它们有什么区别、该选哪一种，以及所有 KS-20 代币和 KS-721 合集的共同之处。
description: Ksana 上的内置资产、KS-20 代币和 KS-721 合集，怎样在它们之间选择，合约怎样声明标准，能力，AssetRef，共用的拒绝原因，以及写给钱包和合约的安全提示。
---

## 三种类型

| | 内置资产 | KS-20 代币 | KS-721 合集 |
| --- | --- | --- | --- |
| 是什么 | KSA，或合约用 `asset_issue` 或 `asset_create` 创建的资产 | 记录一本数额账本的合约 | 记录每个独一无二的代币归谁所有的合约 |
| 余额记在哪里 | VM 的余额表，和每个账户的 KSA 记在一起 | 代币合约的存储 | 合集合约的存储 |
| 怎样转移 | 一个 `AssetTransfer` 操作，或附带在调用上 | 调用代币合约：`transfer`、`transfer_and_call` | 调用合集合约 |
| 谁来读取 | 节点的 [`ksana_getAccount`](/docs/rpc/) 会列出它 | 对代币合约的 `balance_of` 做只读调用 | 对 `owner_of` 做只读调用 |
| 自己的规则 | 只有发行方创建它时从 `mint`、`freeze`、`allowlist`、`pause` 中声明的能力 | 任意规则，由代币在 `capabilities()` 里报告 | 任意规则，同样报告 |
| 一次转账花费 | 10,000 gas | 参考代币约 84,000 gas | 测试合集约 176,000 gas |

每个内置资产都有名称、符号、小数位数和一个 32 字节的 ID：KSA 的 ID 是 32 个零字节，发行的资产的 ID 是它的合约 ID 与一个子 ID 的 SHA-256（[账户](/docs/accounts/)讲了余额）。代币以它的合约 ID 来指称。这两种 ID 看起来一样，所以接受其中任一种的合约会要求一个 [`AssetRef`](#asset-ref)，而 Playground 在部署任何东西之前都会检查每一个 ID。

## 选哪一种

| 需要 | 用 |
| --- | --- |
| 一种货币、一个积分余额、一种按数量计的物品 | 内置资产：协议本身认识它，每个节点不靠索引就能回答它，它可以附带在调用上，一次转账花费 10,000 gas |
| 一种发行方必须能冻结账户、只允许名单内的账户持有或暂停所有转账的货币，比如支付用的稳定币 | 用 `asset_create` 带着这些能力创建的内置资产：钱包会显示这些能力，发行方可以放弃它们，但永远不能获得新的能力，也不能拿走任何余额 |
| 带有自己逻辑的余额：转账手续费、会生息的份额、投票快照、锁仓释放、分红、每个持有者的数据、会读写其他合约的转账 | [KS-20 代币](/docs/ks-20/)：网页钱包和区块浏览器根据节点对标准事件的索引，把它和内置资产列在一起 |
| 每件都独一无二的物品：收藏品、门票、名称、仓位凭证 | [KS-721 合集](/docs/ks-721/) |
| 由一个合约发出的多种同质化物品 | 内置资产：一个合约可以发行任意多种，每种有自己的子 ID |

一个品牌只发行一种形式。当它需要进入只接受另一种形式的合约时，比如让一个 KS-20 代币进入只接受内置资产的市场，可以用一个包装合约一比一地锁住代币，并发行一种名称表明这一点的内置资产，比如 `wXYZ`。

## 合约怎样声明标准 {#declare}

代币或合集自己声明它的标准。它的 `init` 先发出事件 `standards(ids)`，再发出 `metadata`，都在任何 `transfer` 之前；它的只读方法 `standards()` 在整个生命周期里都返回同一个列表：先是标准（`"KS-20"` 或 `"KS-721"`），然后是它实现的扩展。索引器把一个合约的第一个 `standards` 事件当作它的声明，所以只凭回执就能索引代币；钱包和其他合约随时可以调用这个只读方法；在合约里，SDK 的 `standard::standards_of(contract)` 和 `standard::declares(contract, id)` 会去问它。

声明只是一种主张，不是保证：一个合约可以声明 KS-20 却违反它的规则，发出虚假的事件，给出虚假的余额，不过只能是它自己的。钱包信任的是合约的身份，即它的 ID 和代码哈希，除非合约委托它的代码，否则两者都不会变。钱包可以标记代码哈希与某个已知构建相同的合约：[Playground 的编译服务](/docs/playground/)在任何机器上都把同一份源码构建成同一个模块。

## 能力

`capabilities() -> Vec<String>` 报告合约的规则此刻允许别人做什么，让钱包可以给代币加上标记：

| 名称 | 有人可以 |
| --- | --- |
| `mint` | 创造更多代币：设有增发者，或者合集还能铸造 |
| `freeze` | 让某个账户的代币无法转移 |
| `allowlist` | 限制谁可以持有或接收这些代币 |
| `pause` | 停止所有转账 |
| `clawback` | 不经持有者同意，从持有者那里拿走代币 |
| `fee` | 对转账收取手续费 |
| `upgrade` | 通过委托代码，改变合约的代码 |

列表里每个名称只出现一次，按这个顺序排列，标准没有定义的名称排在它们后面。已经结束的能力不再报告：增发者放弃了增发的代币，就不再报告 `mint`。

内置资产的发行能力用的是前四个名称：发行合约在创建资产时声明它们，之后只能放弃。[`ksana_getAsset`](/docs/rpc/#ksana_getasset) 按同样的顺序列出它们，所以钱包可以用同一种方式标记两类资产。内置资产永远没有 `clawback`、`fee` 和 `upgrade`，它的任何能力都不能移动余额（规则见[宿主函数](/docs/host-functions/#assets)）。

## 一个参数接受两种资产 {#asset-ref}

在一个参数里接受任何同质化资产的合约，比如资金池或市场，使用 SDK 的 `standard::AssetRef`：

```abi title="AssetRef"
enum AssetRef { Token(ContractId), Asset([u8; 32]) }   // 一个 KS-20 代币；一个内置资产（KSA 是 32 个零字节）
```

它的 Borsh 编码是一个表示变体的字节，`Token` 为 `00`，`Asset` 为 `01`，再加上 32 字节的 ID：`01` 加 32 个零字节就是 KSA。[示例 AMM](/docs/example-contracts/#amm) 就这样接受它的两侧。在合约里，`AssetRef::balance_of` 读取代币的 `balance_of` 或内置余额，`AssetRef::pay` 用代币的 `transfer` 或 `asset_transfer` 从合约自己的余额里付款。

## 拒绝原因

拒绝就是方法返回的错误文本，回执里显示为 `revert: <原因>`。标准把这些原因固定为英文短语，让钱包可以翻译它们，合约可以比较它们：

| 情形 | 原因 |
| --- | --- |
| 合约没有的方法 | `unknown method` |
| 无法解码的参数，或解码后还剩下字节 | `malformed arguments` |
| 给不接受资金的方法附带了资金 | `unexpected attached funds` |
| 数额为 0（KS-20） | `zero amount` |
| 以零账户作为收款方、被授权方、操作员或增发者 | `zero account` |
| 以代币或合集自身作为收款方 | `recipient is this contract` |
| 余额不足（KS-20） | `insufficient balance` |
| 授权额度不足（KS-20） | `insufficient allowance` |
| 授权额度已过期（KS-20） | `allowance expired` |
| 给自己 `approve`（KS-20） | `spender is the caller` |
| 不存在的代币（KS-721） | `unknown token` |
| 所有者以外的人调用 `transfer` 或 `transfer_and_call`（KS-721） | `not the owner` |
| 无权的账户调用 `transfer_from`、`approve` 或 `burn`（KS-721） | `not authorized` |
| `transfer_from` 写的 `from` 不是所有者（KS-721） | `wrong owner` |
| 转给所有者自己（KS-721） | `already the owner` |
| 以所有者作为被授权的账户（KS-721） | `spender is the owner` |
| 给自己 `set_operator`（KS-721） | `operator is the caller` |
| 铸造一个已有或曾有代币的 ID（KS-721） | `token exists`、`token was burned` |
| 收款方的返回值不是 `Bytes` | `malformed return value` |
| 增发者以外的人调用 `mint` 或 `set_minter`（KS-20-mintable） | `not the minter`，没有增发者之后为 `minting has ended` |
| 增发超过上限（KS-20-mintable） | `cap exceeded` |
| 合约自己的规则拒绝 | `rejected: <原因>` |

`transfer_and_call` 的收款方拒绝时，回执显示收款方的原因。合约自己的 `init` 和限制可以使用其他原因。

## 安全

- **冒充**：任何人都可以部署一个名叫 KSA 的代币。钱包会清理名称和符号，拿它们和 KSA、BTC 比较，对未经验证的代币显示完整的 ID，并把没人要的代币折叠起来。
- **授权额度**：授权额度让被授权方随时可以拿走额度以内的代币。只授权一次操作需要的数额，并设好有效期，撤销不再使用的授权，优先使用不需要授权的 `transfer_and_call`。
- **回调**：接收代币的合约要检查 `caller()`，因为任何人都可以直接调用 `on_token_received` 或 `on_nft_received`。代币先转移，再调用；调用最多嵌套 8 层。
- **卡住的代币**：代币永远不会转到零账户或合约自身，不接受资金的方法会拒绝资金。用普通的 `transfer` 转给一个无法转出代币的合约，代币就卡在那里了，所以收款方是合约时，钱包会建议用 `transfer_and_call`。
- **垃圾转账**：数额为 0 的转账会被拒绝，所以没人能用它们塞满一个账户的记录。
- **可升级的代币**：委托代码的合约可以改变它的行为；它会报告 `upgrade`，而参考实现什么也不委托。
- **会拒绝的规则**：代币自己的规则，以及内置资产的能力，都可能以 `rejected: ` 开头的原因拒绝一笔转账。资金池或市场对待这种拒绝，就像对待余额不足一样。
- **NFT 媒体**：钱包只用 `<img>` 显示代币的图片，从不把它当作会运行脚本的文档；远程媒体通过代理加载，或者等你打开时才加载。

## 下一步

::: cards
- [KS-20 代币](/docs/ks-20/) 同质化代币的接口、规则和扩展，以及怎样构建一个。
- [KS-721 合集](/docs/ks-721/) 独一无二的代币：ID、URI、授权和操作员。
- [代币与资金池教程](/docs/token-and-pool/) 部署一个 KS-20 代币，在资金池里交易它，一次一个操作。
:::
