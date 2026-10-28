---
title: 宿主函数与 gas
nav: 宿主函数
lede: 合约与运行它的节点之间的接口：调用怎样进入模块，每个宿主函数及其 SDK 封装和 gas，以及各项限制。
description: Ksana 合约 ABI 参考：ksana 导入模块的 31 个宿主函数、它们在 ksana-contract-sdk 中的封装、gas 开销与各项限制。
---

合约只通过宿主函数与节点打交道。宿主函数就是 WebAssembly 导入模块 `ksana` 中的函数。用 `ksana-contract-sdk` 时，你通过 Rust 封装调用它们，完全不用碰指针；本页也给出原始接口，供工具和不用 SDK 编写的合约使用。[合约 SDK](/docs/contract-sdk/) 列出了每个封装的 Rust 签名，以及 SDK 的其余部分。

本页的 gas 开销和各项限制都是共识规则。它们在 devnet、signet 和主网上都一样，只能通过协议升级改变。完整的规范是仓库里的 [ABI]({{repo}}/blob/main/docs/ABI.md)。

## 调用如何进入合约 {#abi}

每次调用都会新建一个模块实例，所以线性内存从不会从一次调用延续到下一次。一次调用分三步进行：

1. 节点调用导出函数 `ksana_alloc(len: i32) -> i32` 取得一块缓冲区，把输入写进去，输入是 `(method: String, args: Vec<u8>)` 的 Borsh 编码。
2. 节点调用 `ksana_call(ptr: i32, len: i32) -> i64`。
3. 返回的 `i64` 按无符号数解读，等于 `(out_ptr << 32) | out_len`。它指向 `Result<Vec<u8>, Vec<u8>>` 的 Borsh 编码，其中标签 `0` 表示 `Err`，`1` 表示 `Ok`：`Ok(data)` 返回 `data`，`Err(reason)` 则 revert。

以下情况都会让调用失败：trap（包括 `unreachable`、越界访问和除以零）、gas 耗尽、输出不是有效的 `Result` 编码、输出超过 65,536 字节，以及 `Err`。任何一层的失败都会让整笔操作失败，发生在 `try_call_contract` 之下的除外。

宿主函数接受的指针，是合约自身内存中的 `i32` 偏移量，偏移越界就会 trap。写出定长结果的函数接受一个目标指针 `dst`。返回变长数据的函数，会调用合约的 `ksana_alloc` 来分配空间，并以同样的方式打包返回，即 `(ptr << 32) | len`；没有数据时返回 `-1`。SDK 里的 `entry!` 会替你生成这两个导出函数，并完成这些解码。

## 宿主函数

下面的表格按用途把这 31 个函数分组。“/B”表示每字节。

### 存储

| 宿主函数 | SDK | gas | 说明 |
| --- | --- | --- | --- |
| `storage_get` | `storage::get`、`storage::read` | 2,000 + 1/B（键和值） | 读取本合约的存储；不存在时为 `None` |
| `storage_set` | `storage::set`、`storage::write` | 10,000 + 10/B（键和值） | 键最长 256 字节，值最长 65,536 字节 |
| `storage_remove` | `storage::remove` | 5,000 + 1/B（键） | |

存储是私有的：合约只能读写它自己的键。写入立即对同一笔操作的每一层调用可见，重入的调用也不例外。

### 上下文

| 宿主函数 | SDK | gas | 说明 |
| --- | --- | --- | --- |
| `caller` | `caller()` | 100 | 顶层为操作的账户；合约间调用中为发起调用的合约 |
| `self_id` | `self_id()` | 100 | 本合约的 ID |
| `block_height` | `block_height()` | 100 | 执行这笔操作的主链区块的高度 |
| `block_timestamp` | `block_timestamp()` | 100 | 该区块的时间戳，单位为秒 |
| `chain_id` | `chain_id()` | 100 | devnet 为 1001，signet 为 1002，主网为 1000 |
| `gas_left` | `gas_left()` | 100 | 扣除本函数自身开销后剩余的 gas |

被合并区块中的操作，按合并它的那个主链区块的高度和时间戳运行。时间戳由出块者在宽松的范围内设定，所以它不是精确的时钟。只读调用（RPC 方法 `ksana_call`）按下一个区块的情形运行：高度为链顶高度加一，时间戳沿用链顶的时间戳。

```rust
/// `env() -> (u64, u64, u32, u32)`：合约所见的、这次调用所在的区块。
pub fn env() -> CallResult {
    let height = sdk::block_height(); // 执行这笔操作的主链区块
    let time = sdk::block_timestamp(); // 单位为秒，由出块者设定：不是精确的时钟
    sdk::ok(&(height, time, sdk::chain_id(), sdk::btc_anchor_height()))
}
```

### 事件

| 宿主函数 | SDK | gas | 说明 |
| --- | --- | --- | --- |
| `emit_event` | `emit_event(&[u8])`、`emit(&T)` | 1,000 + 5/B | 最多 16,384 字节 |

事件以 `{ "contract", "data" }` 的形式出现在操作的回执里。它们不计入状态根，操作失败时会被丢弃。

### 资产

| 宿主函数 | SDK | gas | 说明 |
| --- | --- | --- | --- |
| `asset_balance` | `asset_balance(asset, account)` | 2,000 | 任意账户或合约的余额，以 u128 表示 |
| `asset_transfer` | `asset_transfer(asset, to, amount)` | 10,000 | 从本合约的余额中付款；余额不足或资产的规则拒绝这笔转账时 trap |
| `asset_issue` | `asset_issue(sub_id, meta, to, amount)` | 20,000 + 1/B（`meta`） | 发行本合约自己的资产；返回资产 ID。第一次发行创建的资产只有增发能力 |
| `asset_create` | `asset_create(sub_id, meta, capabilities, to, amount)` | 20,000 + 1/B（`meta`） | 创建本合约自己的资产，带上它声明的能力，并向 `to` 发行 `amount`；返回资产 ID |
| `asset_freeze` | `asset_freeze(sub_id, account, frozen)` | 10,000 | 冻结或解冻某个账户持有的本合约资产 |
| `asset_allow` | `asset_allow(sub_id, account, allowed)` | 10,000 | 把某个账户加入或移出本合约资产的白名单 |
| `asset_pause` | `asset_pause(sub_id, paused)` | 10,000 | 暂停或恢复本合约的资产 |
| `asset_renounce` | `asset_renounce(sub_id, capabilities)` | 10,000 | 永久放弃本合约资产的某些能力 |
| `asset_policy` | `asset_policy(asset)` | 2,000 | 任意资产的能力，以及它是否处于暂停；资产不存在时为 `None` |
| `asset_status` | `asset_status(asset, account)` | 2,000 | 某个账户在某个资产上的状态标记：`STATUS_FROZEN`、`STATUS_ALLOWED` |
| `asset_burn` | `asset_burn(asset, amount)` | 10,000 | 从本合约的余额中销毁，KSA 也不例外 |
| `call_funds` | `call_funds()`、`received(asset)` | 100 + 1/B（返回的数据） | 当前调用附带的资产 |

账户和合约共用一张内置资产的余额表。内置资产包括 KSA（ID 为 32 个零字节，8 位小数）和合约发行的资产。合约发行的资产，ID 是 `sha256(issuing contract ‖ sub_id)`，可以用 `asset_id(issuer, sub_id)` 计算。第一次发行或 `asset_create` 时记下 `meta`：1 到 64 字节的名称、1 到 16 字节的符号（例如 `USDX`），以及最多 18 位小数。之后每次发行都必须传入相同的 `meta`，否则 trap。

资产的发行合约只拥有它创建资产时声明的能力，此外别无其他：`CAP_MINT` 可以增发，`CAP_FREEZE` 可以冻结账户，`CAP_ALLOWLIST` 只放行它允许的账户，`CAP_PAUSE` 可以暂停资产。`asset_create` 可以声明其中任意几项（0 表示一项都不要，即供应量固定），`asset_issue` 创建的资产只有 `CAP_MINT`。能力只能用 `asset_renounce` 放弃，不能再获得；管理资产的函数用本合约的 `sub_id` 指明资产，所以只有发行合约能管理它。KSA 没有任何能力。钱包用 [`ksana_getAsset`](/docs/rpc/#ksana_getasset) 读取资产的能力，用 [`ksana_getAssetStatus`](/docs/rpc/#ksana_getassetstatus) 读取账户的状态。

资产的每一次移动都要遵守这些能力：转账动作、附带的资产、`asset_transfer`、`asset_issue`、`asset_create` 和 `asset_burn`。发行合约本身不受限制。

- 被冻结的账户既不能发送、接收，也不能销毁这个资产。
- 有白名单时，只有被允许的账户才能发送、接收或销毁它。
- 资产暂停期间，除了发行合约，任何账户都不能发送或销毁它。
- 设置标记或暂停需要相应的能力；清除标记或恢复则不需要。能力一旦放弃，对应的标记就不再生效。
- 没有任何能力可以动用余额：发行方可以冻住某个账户的资产，但永远拿不走。

被拒绝的移动会让操作失败，错误信息以 `rejected:` 开头，例如 `rejected: sender is frozen for this asset` 或 `rejected: asset is paused`。`try_call_contract` 附带的资产被拒绝时，会被它捕获为状态 `2`。

附带的资产在合约运行之前就转给合约。它们必须按资产 ID 严格升序排列，每项都大于零，最多 16 项。

### 调用

| 宿主函数 | SDK | gas | 说明 |
| --- | --- | --- | --- |
| `call_contract` | `call`、`call_with_funds` | 20,000 + 1/B（输入）+ 1/B（被调用方的代码）+ 每个资产 10,000 | 被调用方失败，整笔操作随之失败 |
| `try_call_contract` | `try_call`、`try_call_with` | 同 `call_contract` | 失败时只回滚被调用方 |
| `delegate_call` | `delegate_call` | 同 `call_contract`，不附带资产 | 在本合约的上下文中运行另一个合约的代码 |
| `create_contract` | `create_contract` | 100,000 + 1/B（参数）+ 1/B（代码）+ 每个资产 10,000 | 用链上的代码创建合约 |

- **`try_call_contract`** 返回 `(status: u8, data)`：`0` 时附带被调用方的输出，`1` 时附带它 revert 的原因，`2` 表示其他任何失败（SDK 把三者分别映射为 `Ok`、`CallError::Revert` 和 `CallError::Failed`）。被调用方最多得到 `min(gas, remaining − remaining / 64)` 的 gas，`gas` 为 0 时不另设上限。调用者自己的错误仍会让操作失败：方法名为 `init`、输入过长、附带资产列表格式有误。
- **`delegate_call`** 用本合约的存储、余额、`self_id`、`caller` 和 `call_funds` 运行另一份代码。只对你信任的代码使用它。
- **`create_contract`** 给新合约的 ID 是 `sha256(this contract ‖ salt ‖ code_hash)`（可以用 `created_contract_id` 计算），然后以本合约为调用者，运行新合约的 `init`。代码不在链上、ID 已被占用，或者 `init` 失败时，它会 trap。

操作自身的调用算第 1 层，调用最多嵌套 8 层。`try_call_contract` 和 `delegate_call` 也各占一层。允许重入（A 调用 B，B 又调用 A）。

### 比特币

| 宿主函数 | SDK | gas | 说明 |
| --- | --- | --- | --- |
| `btc_anchor_height` | `btc_anchor_height()` | 100 | 执行中的区块所锚定的比特币高度 |
| `btc_header` | `btc_header(height)` | 2,000 | 80 字节的区块头；除非 `height` ≤ 锚定高度 − 6，否则 trap |
| `native_tx` | `native_tx()` | 2,000 + 1/B（返回的数据） | 携带这笔路径 C 操作的比特币交易 |

对路径 B 操作和只读调用，`native_tx` 返回 `None`。一笔操作的每一层读到的都是同一笔交易，所以合约必须确保一笔付款只计一次。[合约中的比特币](/docs/bitcoin-in-contracts/)讲解这三个函数怎样用；SDK 的 `btc` 模块能在合约内解析区块头和交易，并核验 Merkle 证明。

### 密码学

| 宿主函数 | SDK | gas | 说明 |
| --- | --- | --- | --- |
| `sha256` | `sha256(data)`、`sha256d(data)` | 500 + 1/B | `sha256d` 是两次调用 |
| `verify_schnorr` | `verify_schnorr(pubkey, digest, sig)` | 50,000 | BIP340，签名对象为 32 字节摘要 |

`verify_schnorr` 检查的是对 32 字节摘要的签名，而不是对消息的签名：要先对消息做哈希。Ksana 账户就是一把 x-only 公钥，所以合约能检查某个账户的签名：

```rust
/// `sig` 是否为 `signer` 对 `message` 的 BIP340 签名；宿主检查的是 32 字节的摘要。
pub fn signed_by(signer: &[u8; 32], message: &[u8], sig: &[u8; 64]) -> bool {
    sdk::verify_schnorr(signer, &sdk::sha256(message), sig)
}
```

SDK 的 `contract_id`、`created_contract_id` 和 `asset_id` 在合约内调用 `sha256` 计算标识符，耗费的就是这些调用的 gas。`trap()` 执行 `unreachable`，用于不可能发生的情形。

## 原始函数签名

节点接受下面这些导入，类型必须与此完全一致，此外不接受任何导入：

```text
storage_get(key_ptr: i32, key_len: i32) -> i64
storage_set(key_ptr: i32, key_len: i32, val_ptr: i32, val_len: i32)
storage_remove(key_ptr: i32, key_len: i32)
caller(dst: i32)
self_id(dst: i32)
block_height() -> i64
block_timestamp() -> i64
chain_id() -> i64
gas_left() -> i64
btc_anchor_height() -> i64
btc_header(height: i64, dst: i32)
asset_balance(asset_ptr: i32, account_ptr: i32, dst: i32)
asset_transfer(asset_ptr: i32, to_ptr: i32, amount_ptr: i32)
asset_issue(sub_id_ptr: i32, meta_ptr: i32, meta_len: i32, to_ptr: i32, amount_ptr: i32, dst: i32)
asset_create(sub_id_ptr: i32, meta_ptr: i32, meta_len: i32, capabilities: i32,
             to_ptr: i32, amount_ptr: i32, dst: i32)
asset_freeze(sub_id_ptr: i32, account_ptr: i32, frozen: i32)
asset_allow(sub_id_ptr: i32, account_ptr: i32, allowed: i32)
asset_pause(sub_id_ptr: i32, paused: i32)
asset_renounce(sub_id_ptr: i32, capabilities: i32)
asset_policy(asset_ptr: i32) -> i64
asset_status(asset_ptr: i32, account_ptr: i32) -> i32
asset_burn(asset_ptr: i32, amount_ptr: i32)
create_contract(code_hash_ptr: i32, salt_ptr: i32, args_ptr: i32, args_len: i32,
                funds_ptr: i32, funds_len: i32, dst: i32)
call_contract(contract_ptr: i32, input_ptr: i32, input_len: i32,
              funds_ptr: i32, funds_len: i32) -> i64
call_funds() -> i64
native_tx() -> i64
try_call_contract(contract_ptr: i32, input_ptr: i32, input_len: i32,
                  funds_ptr: i32, funds_len: i32, gas: i64) -> i64
delegate_call(contract_ptr: i32, input_ptr: i32, input_len: i32) -> i64
emit_event(ptr: i32, len: i32)
sha256(ptr: i32, len: i32, dst: i32)
verify_schnorr(pubkey_ptr: i32, msg_ptr: i32, sig_ptr: i32) -> i32
```

金额在内存中是 16 字节小端的 u128 值。`funds` 是 Borsh 编码的 `Vec<Funds { asset: [u8; 32], amount: u128 }>`，最多 772 字节；不附带资产时 `funds_len = 0`。调用的输入按[调用如何进入合约](#abi)一节所述编码。`verify_schnorr` 对有效签名返回 `1`，否则返回 `0`。`meta` 是 `(name: String, symbol: String, decimals: u8)` 的 Borsh 编码。能力按位表示：`1` 增发、`2` 冻结、`4` 白名单、`8` 暂停，更高的位会 trap。`frozen`、`allowed` 和 `paused` 取 `1` 或 `0`，其他值会 trap。`asset_policy` 在第 0 到 7 位返回能力，资产暂停期间再加上 `0x100`，资产不存在时返回 `-1`；`asset_status` 返回状态标记，`1` 为冻结，`2` 为允许。

## Gas

gas 就是 wasmtime 的 fuel：普通指令每条 1，而 `nop`、`drop` 和结构化控制指令为 0。`memory.copy`、`memory.fill` 和 `memory.init` 每字节另加 1，`memory.grow` 每页 1，表操作每个元素 1。宿主函数另加上面各表所列的开销。

每笔操作还要为它的动作支付一笔固定的开销：

| 动作 | gas |
| --- | --- |
| `AssetTransfer` | 10,000 |
| `Deploy` | 100,000 + 20/B（代码）+ 每个附带资产 10,000 + `init`，其中包括按 1/B 加载代码 |
| `Call` | 20,000 + 1/B（合约的代码）+ 每个附带资产 10,000 + 方法本身 |

操作的 `max_gas` 是硬上限：需要更多 gas 的操作会失败，哪怕超出发生在最后一刻。失败操作的回执把 `max_gas` 全部记为已用。一个区块中路径 B 操作的 `max_gas` 加起来最多 100,000,000，所以任何操作都不能要求更多；`max_gas` 超过 1,000,000 的路径 C 操作会用掉它的 nonce，但会失败。

[代币与资金池教程](/docs/token-and-pool/)里的这些操作用掉的 gas 如下：

| 操作 | gas |
| --- | --- |
| 部署 28,720 字节的代币合约 | 776,169 |
| 部署 25,427 字节的资金池合约 | 672,844 |
| 对代币合约调用 `transfer_and_call`，附带 KSA 存入资金池 | 214,928 |
| 对资金池调用 `swap`，附带 KSA | 169,247 |
| 对代币合约调用 `transfer_and_call`，在资金池里兑换 | 172,426 |

gas 限定的是一笔操作能做多少工作，而不是它的价格。路径 B 的手续费用 KSA 支付，按操作以字节计的成本来衡量费率，其中 `max_gas` 折算为 `max_gas × 81,920 / 100,000,000` 字节。[操作与手续费](/docs/submitting-ops/)讲解出块者怎样挑选。

## 限制

| 限制 | 取值 |
| --- | --- |
| 存储的键 / 值 | 256 / 65,536 字节 |
| 事件 | 16,384 字节 |
| `asset_issue` / `asset_create` 的元数据 | 1,024 字节；名称 1 到 64 字节，符号 1 到 16 字节，最多 18 位小数 |
| 调用的输入 / 输出 | 65,536 / 65,536 字节 |
| 附带资产 | 16 项，编码后 772 字节 |
| 调用深度（`MAX_CALL_DEPTH`） | 8 |
| 一笔操作内的实例数 / 总内存 | 64 / 256 MiB |
| 单个实例的线性内存（`MAX_WASM_MEMORY`） | 16 MiB，初始最多 256 页 |
| 表 | 4,096 项 |
| 单个实例的栈（`STACK_BUDGET`） | 262,144 字节，按估算 |
| 整笔操作，含代码（`MAX_OP_BYTES`） | 65,536 字节 |
| 一个区块中路径 B 操作的 `max_gas`（`BLOCK_GAS_LIMIT`） | 合计 100,000,000 |
| 路径 C 操作的 `max_gas`（`NATIVE_MAX_GAS`） | 1,000,000 |
| 区块头深度（`BTC_QUERY_DEPTH`） | 锚定块之下 6 个比特币区块 |

`memory.grow` 若会超过 16 MiB，就返回 −1，SDK 的分配器随即 trap。超出其他任何一项限制，都会让调用或操作失败。

### 栈计量

WebAssembly 的原生栈深度因机器而异，所以节点用一个处处相同的估算来计量栈。一个函数的栈帧按 64 + 16 ×（参数个数 + 局部变量个数 + 操作数栈的最大深度）字节计，实例超过 262,144 字节就会 trap。每次合约调用都是一个新实例，有自己的一份预算。在预算之内，递归、函数指针、trait 对象和 `core::fmt` 都能正常使用。
