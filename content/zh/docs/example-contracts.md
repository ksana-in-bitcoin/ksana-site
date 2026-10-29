---
title: 示例合约
lede: 仓库附带一组示例合约，从参考 KS-20 代币到出售 KSA 换取比特币的市场，还有第一个教程的投票合约、六个为合约 Playground 写的示例和一个测试合约。每一个都经过测试，都是可供阅读、构建和部署的范本。
description: Ksana 示例合约（token、amm、amm-factory、btc-payment-trigger、ksa-exchange、教程的投票合约 poll，以及 Playground 的计数器、可增发代币、NFT、借贷、多签和锁仓释放）与测试合约 probe 一览，包括它们的方法，以及怎样构建、测试和部署它们。
---

这些合约位于仓库的 `contracts/` 目录，自成一个 Cargo workspace。每个 crate 的 `src/lib.rs` 开头的注释，记载了它的每个方法、事件和规则；本页对这些内容做个概述。

| 合约 | 展示什么 | 目录 |
| --- | --- | --- |
| [`token`](#token) | 参考 [KS-20](/docs/ks-20/) 代币：存储、事件、授权额度 | `contracts/examples/token` |
| [`amm`](#amm) | 调用其他合约、附带资产、一步收取代币 | `contracts/examples/amm` |
| [`amm-factory`](#amm-factory) | 由合约创建合约 | `contracts/examples/amm-factory` |
| [`btc-payment-trigger`](#btc-payment-trigger) | 比特币区块头与付款证明 | `contracts/examples/btc-payment-trigger` |
| [`ksa-exchange`](#ksa-exchange) | `native_tx` 与路径 C | `contracts/examples/ksa-exchange` |
| [`poll`](#poll) | 第一个合约：每个账户一个存储键、带原因的检查、事件 | `contracts/examples/poll` |
| [`probe`](#probe) | 每一个宿主函数，供测试使用 | `contracts/testing/probe` |

## 构建与测试

本机测试在 SDK 的模拟宿主上运行每个合约，不需要节点。在这个 workspace 里运行它们：

```sh
git clone {{repo}}
cd ksana/contracts
cargo test --workspace
```

在 `contracts/` 目录里构建模块，并且只产出 `cdylib`，这样 `contracts/.cargo/config.toml` 才会生效，模块也能保持小巧：

```sh
cargo rustc --release --locked --target wasm32-unknown-unknown \
  --package ksa-exchange --crate-type cdylib
```

模块会生成在 `contracts/target/wasm32-unknown-unknown/release/` 里，以包名命名，连字符换成下划线：`ksa_exchange.wasm`、`amm_factory.wasm`。它的字节取决于你检出目录的绝对路径，所以要部署的文件只构建一次，并用这个文件算出 ID。

## 部署一个合约

用 `ksana-cli deploy` 部署，它接受模块，以及 `init` 参数的 Borsh 字节（写成十六进制）。输出里没有新合约的 ID：要用你的账户、部署操作的 nonce 和模块的 SHA-256 自己算出来，可以用[代币与资金池教程](/docs/token-and-pool/#load-the-helpers)里的辅助函数 `contract_id`，并像那里一样把你的账户放在 `ACCOUNT` 中。`ksa-exchange` 的 `init` 不接受参数：

```sh
export KSANA_RPC={{signet.rpc}}
W=target/wasm32-unknown-unknown/release
ksana-cli deploy --key alice.key --code $W/ksa_exchange.wasm --fee-token 1 --wait > exchange.json
EXCHANGE=$(contract_id $ACCOUNT $(jq -r .nonce exchange.json) $W/ksa_exchange.wasm)
```

[那篇教程](/docs/token-and-pool/)部署了 `token`、`amm` 和 `amm-factory`，并附有真实的输出。主网尚未上线，所以请在 signet 上部署。

## `token`

参考 [KS-20](/docs/ks-20/) 代币：合约 SDK 的实现，带有扩展 `KS-20-burnable` 和 `KS-20-mintable`，没有自己的规则。它的余额记在合约的存储里，而不是像 KSA 那样记在节点的余额表里，要转移它，就得调用合约。`init` 把总量交给部署者；`init` 指定了增发者时，增发者可以在上限内增发更多，把这个角色移交出去，或者永久结束增发。

`approve(spender, amount, expires_at)` 让一个合约可以用 `transfer_from` 取走你的代币，直到 `expires_at` 为止，它是以秒计的区块时间戳（`None` 表示永不过期）；它设定授权额度，而不是在原有额度上累加。`transfer_and_call` 在同一个操作里付款给一个合约并调用它的 `on_token_received`，所以资金池根本不需要授权额度。

| 方法 | 参数 | 返回 |
| --- | --- | --- |
| `init` | `(name: String, symbol: String, decimals: u8, supply: u128, minter: Option<[u8; 32]>, cap: Option<u128>)` | `()` |
| `transfer` | `(to: [u8; 32], amount: u128)` | `()` |
| `transfer_from` | `(from: [u8; 32], to: [u8; 32], amount: u128)` | `()` |
| `approve` | `(spender: [u8; 32], amount: u128, expires_at: Option<u64>)` | `()` |
| `transfer_and_call` | `(to: [u8; 32], amount: u128, data: Vec<u8>)`，附带的资产转交给收款方 | `Vec<u8>`，即收款方的返回值 |
| `burn` | `amount: u128` | `()` |
| `burn_from` | `(from: [u8; 32], amount: u128)` | `()` |
| `mint` | `(to: [u8; 32], amount: u128)`，仅限增发者 | `()` |
| `set_minter` | `minter: Option<[u8; 32]>`，仅限增发者 | `()` |
| `balance_of` | `account: [u8; 32]` | `u128` |
| `allowance` | `(owner: [u8; 32], spender: [u8; 32])` | `u128`，过期后为 0 |
| `allowance_info` | `(owner: [u8; 32], spender: [u8; 32])` | `(u128, Option<u64>)` |
| `total_supply` | 无 | `u128` |
| `metadata` | 无 | `(name, symbol, decimals)` |
| `standards` | 无 | `Vec<String>`：`KS-20`、`KS-20-burnable`、`KS-20-mintable` |
| `capabilities` | 无 | `Vec<String>`：有增发者时为 `mint` |
| `minter`、`cap` | 无 | `Option<[u8; 32]>`、`Option<u128>` |

事件：`init` 里有 `standards`、`metadata` 和 `minter`；之后每次余额变化都有 `("transfer", from, to, amount)`，增发时 `from` 为全零，销毁时 `to` 为全零；以及 `("approve", owner, spender, amount, expires_at)`。KS-20 之前写的代币，`init` 不带增发者和上限，`approve` 不带过期时间，参考代币两种形式都仍然接受。

## `amm`

一个由两侧组成的恒定乘积资金池。每一侧是一个 [`AssetRef`](/docs/tokens/#asset-ref)：一个 KS-20 代币，或是 KSA 这样的内置资产，编码为一个字节（`0` 为代币，`1` 为资产）加上 32 字节的 ID。代币一侧的资金有两种送来的方式：一步完成，用代币自己的 `transfer_and_call(pool, amount, action)`，其中 `action` 是一个 `PoolAction`，即一笔兑换或一笔存入；或者先授权给资金池，再由 `swap` 和 `add_liquidity` 通过代币的 `transfer_from` 拉入。资产一侧的资金附带在调用里送来，数额必须恰好等于参数所写的数额；用 `transfer_and_call` 时，由代币把它转交过来。

第一次存入得到的份额为 `isqrt(amount_a × amount_b)`。之后的存入，按两侧数额与储备之比中较小的那个得到份额，资金池也只收取这个比例所需的数额，资产一侧多出的部分会退还。兑换时资金池留下 0.3% 的手续费：`out = in × 997 × R_out / (R_in × 1000 + in × 997)`，向下取整；`out` 低于 `min_out` 时 revert。资金池把储备记在存储里，所以直接转给它的资产不会影响价格。

份额低于 `min_shares` 时 `add_liquidity` 会 revert；任一数额低于它的下限时 `remove_liquidity` 会 revert。紧挨在存入之前的一笔兑换，会改变这笔存入所按的比例。按资金池比例给出的数额，不论比例往哪边变，得到的份额都会变少，所以要按这个比例给出数额，并把 `min_shares` 设得比同一笔存入用 `query` 得到的份额略低。在有这些下限之前写的调用方可以不传它们：`(amount_a, amount_b)` 和单独的 `shares` 表示下限为 0。

| 方法 | 参数 | 返回 |
| --- | --- | --- |
| `init` | `(side_a: Side, side_b: Side)` | `()` |
| `add_liquidity` | `(amount_a: u128, amount_b: u128, min_shares: u128)` | `u128`，即份额 |
| `remove_liquidity` | `(shares: u128, min_a: u128, min_b: u128)` | `(u128, u128)`，即 A 和 B 的数额 |
| `swap` | `(id_in: [u8; 32], amount_in: u128, min_out: u128)` | `u128`，即换出的数额 |
| `reserves` | 无 | `(u128, u128)` |
| `shares_of` | `account: [u8; 32]` | `u128` |
| `total_shares` | 无 | `u128` |
| `on_token_received` | `(from: [u8; 32], amount: u128, data: Vec<u8>)`，由代币一侧调用 | `Vec<u8>`：Borsh 编码的 `u128`，即换出的数额或份额 |
| `tokens` | 无 | `(AssetRef, AssetRef)` |

`on_token_received` 的 `data` 是一个 `PoolAction`：`Swap(min_out)` 为 `00` 加上 `min_out: u128`，它兑换收到的代币，把另一侧付给发送者；`AddLiquidity` 为 `01`、`amount_other: u128` 和 `min_shares: u128`，它把收到的代币连同至多 `amount_other` 的另一侧（是资产时附带在调用里）一起存入，并退还比例用不上的部分。只有资金池的代币一侧可以调用它。

事件：`("add_liquidity", provider, amount_a, amount_b, shares)`、`("remove_liquidity", provider, shares, amount_a, amount_b)` 和 `("swap", trader, id_in, amount_in, amount_out)`；通过 `transfer_and_call` 时，provider 或 trader 是发出代币的账户。

## `amm-factory`

用 `create_contract`，以链上已有的 `amm` 代码创建 `amm` 资金池：必须已经有人部署过一次 `amm`。`init` 接受这份代码的哈希，即模块的 SHA-256。这里的 `Side` 编码与资金池的 `AssetRef` 相同。

`create_pair` 把两侧先按 ID、再按种类排序，并以它们的 Borsh 编码的 SHA-256 作为盐值。所以每个交易对只对应一个资金池，它的 ID 可以事先用工厂合约的 ID、盐值和代码哈希算出来。资金池的 `init` 按这个顺序收到两侧：在 KSA 与某个代币组成的资金池里，KSA 是 A 侧，因为它的 ID 全为零。

| 方法 | 参数 | 返回 |
| --- | --- | --- |
| `init` | `amm_code_hash: [u8; 32]` | `()` |
| `create_pair` | `(side_a: Side, side_b: Side)` | `[u8; 32]`，即资金池的 ID |
| `get_pair` | `(side_a: Side, side_b: Side)`，顺序不限 | `Option<[u8; 32]>` |
| `pair_count` | 无 | `u64` |
| `pair_at` | `index: u64` | `Option<[u8; 32]>` |
| `amm_code_hash` | 无 | `[u8; 32]` |

事件：`("pair_created", side_a, side_b, pair)`。

## `btc-payment-trigger`

谁证明了一笔付给被监视脚本的比特币付款，就向谁发行本合约自己的资产。`init` 接受这个脚本、资产的 `sub_id`、资产的元数据 `(name: String, symbol: String, decimals: u8)` 以及 `units_per_sat`。脚本为空、比率为 0，或者元数据会被宿主拒绝时，它会 revert：名称 1 到 64 字节、符号 1 到 16 字节、最多 18 位小数才能通过。

`claim` 对照比特币区块头检查证明，并检查输出 `vout` 付款给被监视的脚本。这笔交易还必须有一个 `OP_RETURN <beneficiary>` 输出（`6a20` 加上 32 字节的账户），这样别人就无法抢先领取这笔付款。每个 `(txid, vout)` 只能领取一次，换得 `value × units_per_sat` 的资产，发行给受益账户。

| 方法 | 参数 | 返回 |
| --- | --- | --- |
| `init` | `(watch_script: Vec<u8>, sub_id: [u8; 32], meta, units_per_sat: u128)` | `()` |
| `claim` | 先是证明，然后是 `vout: u32` 和 `beneficiary: [u8; 32]` | `u128`，即发行的数额 |
| `asset_id` | 无 | `[u8; 32]` |
| `is_claimed` | `(txid: [u8; 32], vout: u32)` | `bool` |

证明依次是 `height: u32`、`raw_tx: Vec<u8>`、`tx_index: u32`、`branch: Vec<[u8; 32]>`、`coinbase_tx: Vec<u8>` 和 `coinbase_branch: Vec<[u8; 32]>`。[合约中的比特币](/docs/bitcoin-in-contracts/#proof)解释了每一部分，并从一个区块构造出 `claim` 的参数。事件是 `("claim", txid, vout, beneficiary, asset_id, amount)`；资产的 ID 是合约 ID 与 `sub_id` 的 SHA-256。

## `ksa-exchange`

出售 KSA，换取比特币。充值用的就是它：手上有聪、没有 KSA 的买方，用一笔比特币交易，在比特币上付款给卖方，在 Ksana 上收到 KSA。

1. 卖方存入 KSA（用 `deposit`，或者附带在 `lock` 上），然后调用 `lock`。这个锁定为买方的账户预留 `ksa` 个最小单位，价格为每聪 `price` 个最小单位，付款要付给一个其他锁定从未用过的比特币脚本，有效期到比特币高度 `expiry` 为止。
2. 买方发出一笔比特币交易，它向锁定的脚本付款，并携带一个调用 `claim(lock)` 的路径 C 操作。操作运行时，`claim` 读取 [`native_tx()`](/docs/bitcoin-in-contracts/#native-tx)，加总这笔交易付给该脚本的金额，把买到的 KSA 付给买方的账户，以仍处于锁定的 KSA 为限。
3. 只付了一部分时，剩下的部分继续为同一个买方锁定。锚定高度达到 `expiry` + 6 之后，卖方可以对一个开放的锁定调用 `release`，其中仍锁定的 KSA 回到卖方的可用余额；`withdraw` 从这个余额中取出 KSA。

受益账户在锁定里就已写定，所以无论谁提交领取，KSA 都归买方。操作的签名覆盖交易的第一个输入，所以复制来的领取会失败。付款超出锁定里 KSA 的价值，也买不到更多；向已不再开放的锁定付款，比特币就白白损失了：付款之前，先读取锁定。

| 方法 | 参数 | 返回 |
| --- | --- | --- |
| `init` | 无，且不附带资产 | `()` |
| `deposit` | 无，附带 KSA | `u128`，即可用余额 |
| `withdraw` | `amount: u128` | `u128`，即可用余额 |
| `lock` | `(ksa: u128, price: u128, script: Vec<u8>, beneficiary: [u8; 32], expiry: u32)` | `u64`，即锁定编号 |
| `claim` | `lock: u64`，只能来自路径 C 操作 | `(paid_sats: u64, ksa_paid: u128)` |
| `release` | `lock: u64` | `u128`，即取回的 KSA |
| `get_lock` | `lock: u64` | `Lock` |
| `lock_of_script` | `script: Vec<u8>` | `Option<u64>` |
| `balance` | `seller: [u8; 32]` | `u128`，即可用余额 |
| `lock_count` | `seller: [u8; 32]` | `u64` |
| `locks_of` | `(seller: [u8; 32], start: u64, limit: u32)`，`limit` 为 1 到 256 | `Vec<u64>` |

`Lock` 是 `(seller, beneficiary, script, price, ksa, expiry, state)`，其中 `ksa` 是仍处于锁定的数额。`state` 为 `0`（开放）、附带总计 `paid_sats: u64` 和 `ksa_paid: u128` 的 `1`（已领取），或 `2`（已释放）。锁定的脚本最长 64 字节，且不能以 `OP_RETURN` 开头。[ksana-cli](/docs/cli/) 为卖方提供 `exchange` 命令，为买方提供 `top-up` 命令；[TypeScript SDK](/docs/sdk/) 能为浏览器钱包构造充值。

## `poll`

教程[你的第一个合约](/docs/first-contract/)里的合约，教程在 Playground 中编写、编译并部署它。部署它的账户提出一个问题，带 2 到 8 个选项；投票开放期间，每个账户投一票；最后由创建者结束投票。它用最小的篇幅展示合约的基本功：每个投票者一个存储键，每次写入之前都带着原因做检查，以调用者作为身份，每次变化都发出事件。它只需要合约 SDK，所以 Playground 在计数器页上构建它。

| 方法 | 参数 | 返回 |
| --- | --- | --- |
| `init` | `(question: String, options: Vec<String>)`：问题 1 到 200 字节，2 到 8 个选项，每个 1 到 64 字节 | `()` |
| `vote` | `option: u32`，投票开放期间每个账户一次 | `u64`，即这个选项的票数 |
| `close` | 无，只有创建者可以调用 | `()` |
| `poll` | 无 | `(String, Vec<String>, bool)`：问题、选项、投票是否开放 |
| `results` | 无 | `Vec<u64>`，即每个选项的票数 |
| `voted` | `account: [u8; 32]` | `Option<u32>`，即它投的选项 |

事件：`("voted", voter, option)` 和 `("closed", total)`。每个方法都拒绝附带的资产。

## `probe`

这是一个测试合约，不是示例：它把宿主函数公开为方法，让节点的执行测试和确定性测试能逐个驱动它们。它的方法包括 `send`、`issue`、`burn`、`forward`、`try_forward`、`delegate`、`create`、`set`、`get`、`env`、`recurse`、`spin`、`trap` 和 `revert`。

读它，可以看到单独使用某个宿主函数是什么样子；不要把它部署来实际使用。它的方法表在 `contracts/testing/probe/src/lib.rs` 的开头。

## Playground 示例

另外六个示例是为[合约 Playground](/docs/playground/) 写的，Playground 为每一个都做了页面。它们的 `src/lib.rs` 开头写着每个方法的规则和一个 [ABI 块](/docs/playground/#the-abi-block)，Playground 据此生成表单。Playground 的 KS-20 代币页面用的就是上面的 [`token`](#token)，AMM 页面用的是 [`amm`](#amm)。

| 合约 | 展示什么 | 目录 |
| --- | --- | --- |
| `playground-counter` | 最小的有状态合约：`init`、`increment`、`add`、`get` 和一个 `changed` 事件 | `contracts/examples/playground-counter` |
| `mintable-token` | 一种内置资产：所有者在可选的上限内增发，任何持有者都能销毁，`set_owner` 移交增发权 | `contracts/examples/mintable-token` |
| `nft` | 一个 [KS-721](/docs/ks-721/) 合集：带 URI 的代币、授权与操作员，以及用任意资产计价的固定价格挂单 | `contracts/examples/nft` |
| `lending` | 单一市场：存款换取份额，按管理员设定的价格抵押借款，按带拐点的利率曲线计息，清算 | `contracts/examples/lending` |
| `multisig` | 所有者和门槛，以及转账、调用其他合约或调整所有者的提案 | `contracts/examples/multisig` |
| `vesting` | 带悬崖期、线性释放的计划，创建者可以撤销 | `contracts/examples/vesting` |
