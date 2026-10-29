---
title: 合约 SDK
nav: 合约 SDK
lede: ksana-contract-sdk 是编写 Ksana 合约用的 Rust crate。本页列出它的每个函数、类型和常量：它们的签名，以及每一项做什么。
description: ksana-contract-sdk 的 API 参考，这是 Ksana 智能合约的 Rust crate：Borsh 编码与调用上下文、内置资产与附带资产、调用与创建合约、比特币、存储、用于原生测试的模拟宿主，以及 KS-20 和 KS-721 模块。
---

`ksana-contract-sdk` 是[仓库]({{repo}})里 `crates/ksana-contract-sdk` 下的 crate。在 `wasm32-unknown-unknown` 上它是 `no_std` 的，函数调用节点的[宿主函数](/docs/host-functions/)；在其他任何目标上，同样的函数跑在一个内存里的模拟宿主上，所以 `cargo test` 不需要节点就能运行合约。SDK 没有发布到 crates.io：[编写合约](/docs/contracts/#set-up-a-project)按路径引用它，[Playground](/docs/playground/) 则在浏览器里用它构建。

本页列出 SDK 导出的全部内容：去掉函数体的 Rust 签名，每一项都附有一行说明它做什么。签名和说明与仓库里的源码一致，是英文的。[宿主函数与 gas](/docs/host-functions/) 给出每个到达节点的调用花多少 gas，[你的第一个合约](/docs/first-contract/)用到了其中最常用的那些。

::: tip 给 AI 助手
同样的列表，加上合约要遵守的规则、gas、各项限制和完整的合约，汇成了一个 Markdown 文件：[{{origin}}/llms-contracts.txt]({{origin}}/llms-contracts.txt)。请 ChatGPT、Claude 或其他助手写合约之前，先把它交给助手。Playground 的 [AI 助手]({{playground}}?lang=zh-CN#/ai)页面可以一键复制它。
:::

## 合约的框架 {#frame}

每个合约的框架都一样：在 WebAssembly 上不用标准库，导出一个入口，再由一个 `dispatch` 函数按名字应答每个方法。

```rust title="src/lib.rs"
#![cfg_attr(target_arch = "wasm32", no_std)]
extern crate alloc;

use ksana_contract_sdk::{self as sdk, CallResult};

sdk::entry!(dispatch);

pub fn dispatch(method: &str, args: &[u8]) -> CallResult {
    match method {
        "init" => {
            sdk::decode::<()>(args)?;
            sdk::ok(&())
        }
        _ => sdk::revert("unknown method"),
    }
}
```

- `sdk::entry!(dispatch)` 只在 WebAssembly 上生成模块的导出 `ksana_alloc` 和 `ksana_call`：它们解码方法名和参数，交给 `dispatch`。
- 部署时总会调用 `init`，所以即使不带参数，`dispatch` 也要应答它。部署之后，任何对 `init` 的调用都会失败。
- `sdk::ok(&value)` 返回一个值，`sdk::revert("reason")` 则 revert：这笔操作做过的一切，在每一层都被撤销，原因就是用户看到的内容。
- 宿主函数被误用时会 trap：键太长、余额不够支付的转账、不存在的资产、资产规则拒绝的转移。panic 也一样，比如对 `None` 调用 `unwrap`，或者下标越界。trap 让操作失败，却不给用户留下看得懂的原因，所以要先检查，再带着原因 revert。

## 调用上下文与编码 {#context}

参数和返回值都用 Borsh 编码：一个方法的多个参数按元组依次编码，单个参数就编码它本身，没有参数就是空字节。`decode` 要求每个字节都被用上，否则返回 `Err(b"malformed arguments")`，于是 `?` 把错误的输入变成一次 revert。

```rust from="playground/src/ai/ksana-contracts.md"
// ksana_contract_sdk
/// What a method returns: `Ok(data)`, or `Err(reason)` to revert.
pub type CallResult = Result<Vec<u8>, Vec<u8>>;
/// Decodes all of `bytes` as `T`; `Err(ERR_MALFORMED_ARGS)` when they do not fit, for `?`.
pub fn decode<T: Decode>(bytes: &[u8]) -> Result<T, Vec<u8>>;
/// Borsh-encodes `value`.
pub fn encode<T: BorshSerialize + ?Sized>(value: &T) -> Vec<u8>;
/// `Ok(encode(value))`.
pub fn ok<T: BorshSerialize + ?Sized>(value: &T) -> CallResult;
/// `Err(reason)`: reverts the whole operation with `reason`.
pub fn revert<T>(reason: &str) -> Result<T, Vec<u8>>;
pub const ERR_MALFORMED_ARGS: &[u8] = b"malformed arguments";
/// Borsh decoding without `core::fmt`; implemented for the integers, `bool` (0 or 1), `[u8; N]`, `Vec<T>`, `String`,
/// `Option<T>`, `Result<T, E>`, `()`, tuples of up to 8 elements, `Funds`, `AssetMetaInput`, `NativeTx`,
/// `NativeOutput` and `standard::AssetRef`.
pub trait Decode: Sized {
    fn decode(input: &mut &[u8]) -> Option<Self>;
}
/// The caller: the signing account at the top level, the calling contract in a call from a contract.
pub fn caller() -> [u8; 32];
/// This contract's ID.
pub fn self_id() -> [u8; 32];
/// The height of the block running the operation.
pub fn block_height() -> u64;
/// The block's timestamp in Unix seconds, set by its producer within the consensus rules: not a precise time.
pub fn block_timestamp() -> u64;
/// 1001 devnet, 1002 signet, 1000 mainnet.
pub fn chain_id() -> u32;
/// The gas left to this call.
pub fn gas_left() -> u64;
/// Aborts the operation (a trap, without a reason); revert instead whenever there is one.
pub fn trap() -> !;
/// Records an event (raw bytes); events are rolled back with a failed operation.
pub fn emit_event(data: &[u8]);
/// Records the Borsh encoding of `event`, by convention a tuple whose first element is the event's name.
pub fn emit<T: BorshSerialize + ?Sized>(event: &T);
pub fn sha256(data: &[u8]) -> [u8; 32];
/// `sha256(sha256(data))`, as Bitcoin hashes.
pub fn sha256d(data: &[u8]) -> [u8; 32];
/// BIP340: a 32-byte x-only key, a 32-byte message digest, a 64-byte signature.
pub fn verify_schnorr(pubkey: &[u8; 32], msg: &[u8; 32], sig: &[u8; 64]) -> bool;
/// `sha256(deployer ‖ nonce as u64 little-endian ‖ code_hash)`: the ID of a contract an account deployed.
pub fn contract_id(deployer: &[u8; 32], nonce: u64, code_hash: &[u8; 32]) -> [u8; 32];
```

你自己的结构体，用 SDK 重新导出的 Borsh derive 编码，再写一个按同样顺序读取字段的 `Decode` 实现来解码：

```rust
use ksana_contract_sdk::borsh::BorshSerialize;
use ksana_contract_sdk::Decode;

/// 一个挂单，作为方法的参数和返回值：Borsh 按字段的顺序排列。
#[derive(BorshSerialize)]
#[borsh(crate = "ksana_contract_sdk::borsh")]
pub struct Listing {
    pub price: u128,
    pub seller: [u8; 32],
}

impl Decode for Listing {
    fn decode(input: &mut &[u8]) -> Option<Self> {
        Some(Self {
            price: u128::decode(input)?,
            seller: <[u8; 32]>::decode(input)?,
        })
    }
}
```

## 内置资产与附带资产 {#assets}

KSA 和合约发行的资产都记在同一张余额表里，账户和合约共用这张表。一笔操作或另一个合约附在调用上的资产，在合约运行之前就已经进了合约的余额：不收资产的方法要拒绝它们，否则它们就永远留在合约里。[资产与代币](/docs/tokens/)讲解什么时候发行内置资产、什么时候写代币合约，[宿主函数](/docs/host-functions/#assets)给出资产每次转移都要遵守的规则。

```rust from="playground/src/ai/ksana-contracts.md"
// ksana_contract_sdk
/// KSA's asset ID: 32 zero bytes.
pub const KSA_ASSET_ID: [u8; 32] = [0u8; 32];
/// An asset and an amount attached to a call; Borsh-encodable, `Decode`.
pub struct Funds { pub asset: [u8; 32], pub amount: u128 }
/// The most assets one call attaches.
pub const MAX_CALL_FUNDS: usize = 16;
/// The funds attached to this call, already in this contract's balance, in ascending asset ID order.
pub fn call_funds() -> Vec<Funds>;
/// The amount of `asset` attached to this call; 0 when none.
pub fn received(asset: &[u8; 32]) -> u128;
pub fn asset_balance(asset: &[u8; 32], account: &[u8; 32]) -> u128;
/// Pays `amount` of `asset` from this contract's balance to `to`; traps when the balance is short.
pub fn asset_transfer(asset: &[u8; 32], to: &[u8; 32], amount: u128);
/// Burns `amount` of this contract's own balance of `asset`, KSA included.
pub fn asset_burn(asset: &[u8; 32], amount: u128);
/// A new asset's name (1 to 64 bytes), symbol (1 to 16 bytes) and decimals (at most 18); Borsh-encodable, `Decode`.
pub struct AssetMetaInput { pub name: String, pub symbol: String, pub decimals: u8 }
/// Issues `amount` of this contract's asset `sub_id` to `to` and returns its ID. The first issue creates the asset with
/// `CAP_MINT` alone and records `meta`; every later one passes the same `meta` and needs `CAP_MINT` still.
pub fn asset_issue(sub_id: &[u8; 32], meta: &AssetMetaInput, to: &[u8; 32], amount: u128) -> [u8; 32];
/// Creates this contract's asset `sub_id` with the issuer capabilities `capabilities` (`CAP_*` bits) and issues
/// `amount` of it (0 for none) to `to`; traps when the asset exists. Without `CAP_MINT` the supply stays `amount` for
/// good; with `CAP_ALLOWLIST`, `to` must be this contract until it allows an account.
pub fn asset_create(sub_id: &[u8; 32], meta: &AssetMetaInput, capabilities: u8, to: &[u8; 32], amount: u128) -> [u8; 32];
/// `sha256(issuer ‖ sub_id)`: the ID of the asset a contract issues.
pub fn asset_id(issuer: &[u8; 32], sub_id: &[u8; 32]) -> [u8; 32];
/// Issuer capabilities, declared by `asset_create` and only ever given up.
pub const CAP_MINT: u8 = 1;
pub const CAP_FREEZE: u8 = 2;
pub const CAP_ALLOWLIST: u8 = 4;
pub const CAP_PAUSE: u8 = 8;
/// Freezes or unfreezes `account` for this contract's asset, never this contract itself (freezing needs `CAP_FREEZE`):
/// a frozen account can neither send, receive nor burn it.
pub fn asset_freeze(sub_id: &[u8; 32], account: &[u8; 32], frozen: bool);
/// Puts `account` on or off the allowlist of this contract's asset (putting it on needs `CAP_ALLOWLIST`).
pub fn asset_allow(sub_id: &[u8; 32], account: &[u8; 32], allowed: bool);
/// Pauses or resumes this contract's asset (pausing needs `CAP_PAUSE`).
pub fn asset_pause(sub_id: &[u8; 32], paused: bool);
/// Gives up capabilities of this contract's asset for good.
pub fn asset_renounce(sub_id: &[u8; 32], capabilities: u8);
/// The capabilities an asset's issuer still holds and whether it is paused.
pub struct AssetPolicy { pub capabilities: u8, pub paused: bool }
/// `None` when the asset does not exist; KSA has no capabilities.
pub fn asset_policy(asset: &[u8; 32]) -> Option<AssetPolicy>;
/// An account's `STATUS_*` flags for an asset.
pub fn asset_status(asset: &[u8; 32], account: &[u8; 32]) -> u8;
pub const STATUS_FROZEN: u8 = 1;
pub const STATUS_ALLOWED: u8 = 2;
```

## 调用与创建合约 {#calls}

调用另一个合约，会在同一笔操作里立即运行它；它失败了，整笔操作也就失败，除非用 `try_call` 捕获。调用最多嵌套 8 层，还可能重入调用者，所以要先写存储，再向外调用。[编写合约](/docs/contracts/#call-other-contracts)演示了每一种用法。

```rust from="playground/src/ai/ksana-contracts.md"
// ksana_contract_sdk
/// Calls `method` of `contract` and returns the bytes in its `Ok`; any failure of the callee fails the operation.
/// The method name `init` is refused.
pub fn call(contract: &[u8; 32], method: &str, args: &[u8]) -> Vec<u8>;
/// As `call`, attaching `funds` from this contract's balance (strictly ascending asset IDs, amounts above 0).
pub fn call_with_funds(contract: &[u8; 32], method: &str, args: &[u8], funds: &[Funds]) -> Vec<u8>;
/// How a caught call failed: the callee's revert reason, or any other failure.
pub enum CallError { Revert(Vec<u8>), Failed }
/// As `call`, but a failure undoes only the callee's level and comes back as `Err`. The callee gets at most 63/64 of
/// the gas left, and a failure other than a revert uses up what it got.
pub fn try_call(contract: &[u8; 32], method: &str, args: &[u8]) -> Result<Vec<u8>, CallError>;
/// `try_call` with attached funds and a gas limit for the callee (0: no limit beyond 63/64).
pub fn try_call_with(contract: &[u8; 32], method: &str, args: &[u8], funds: &[Funds], gas: u64) -> Result<Vec<u8>, CallError>;
/// Runs `contract`'s code in this contract's context (its storage, balances, caller and funds): trusted code only.
pub fn delegate_call(contract: &[u8; 32], method: &str, args: &[u8]) -> Vec<u8>;
/// Creates a contract from code already on chain (`code_hash = sha256(code)`, stored by an earlier deployment) and runs
/// its `init(init_args)` with this contract as the caller, `funds` moved to it first; returns
/// `created_contract_id(self_id(), salt, code_hash)`. Fails the operation when the code is unknown, the ID is taken or
/// `init` fails.
pub fn create_contract(code_hash: &[u8; 32], salt: &[u8; 32], init_args: &[u8], funds: &[Funds]) -> [u8; 32];
/// `sha256(creator ‖ salt ‖ code_hash)`.
pub fn created_contract_id(creator: &[u8; 32], salt: &[u8; 32], code_hash: &[u8; 32]) -> [u8; 32];
```

## 比特币 {#bitcoin}

合约可以读取比它锚定的区块至少低 6 个的比特币区块头，以及承载路径 C 操作的那笔比特币交易。`btc` 模块在合约里解析区块头和交易，并校验 Merkle 证明；[合约中的比特币](/docs/bitcoin-in-contracts/)用它做了一个支付检查。

```rust from="playground/src/ai/ksana-contracts.md"
// ksana_contract_sdk
/// The Bitcoin height the current block anchors to.
pub fn btc_anchor_height() -> u32;
/// The 80-byte Bitcoin header at `height`, which must be at most `btc_anchor_height() - 6`; traps otherwise.
pub fn btc_header(height: u32) -> [u8; 80];
/// An output of the Bitcoin transaction carrying a path C operation.
pub struct NativeOutput { pub value: u64, pub script: Vec<u8> }
/// That transaction: its ID (internal byte order) and every output.
pub struct NativeTx { pub txid: [u8; 32], pub outputs: Vec<NativeOutput> }
/// The transaction carrying this operation when it came by path C; `None` for path B and read-only calls. Every level
/// of one operation reads the same transaction, so record what it paid for to credit it once.
pub fn native_tx() -> Option<NativeTx>;
```

```rust from="playground/src/ai/ksana-contracts.md"
// ksana_contract_sdk::btc
pub const HEADER_LEN: usize = 80;
pub const MAX_MONEY: u64 = 21_000_000 * 100_000_000;
pub const MAX_COMPACT_SIZE: u64 = 0x0200_0000;
pub const MAX_MERKLE_DEPTH: usize = 32;
/// A parsed block header; hashes in Bitcoin's internal byte order.
pub struct BlockHeader { pub version: i32, pub prev_blockhash: [u8; 32], pub merkle_root: [u8; 32], pub time: u32, pub bits: u32, pub nonce: u32 }
impl BlockHeader {
    pub fn parse(bytes: &[u8]) -> Option<Self>;
    pub fn to_bytes(&self) -> [u8; HEADER_LEN];
    pub fn block_hash(&self) -> [u8; 32];
}
/// An output of a parsed transaction.
pub struct TxOut<'a> { pub value: u64, pub script_pubkey: &'a [u8] }
/// `sha256d` of a transaction serialized without witness data.
pub fn txid(raw_tx: &[u8]) -> [u8; 32];
/// The outputs of a transaction serialized without witness data; `None` when it is malformed.
pub fn parse_outputs(raw_tx: &[u8]) -> Option<Vec<TxOut<'_>>>;
pub fn merkle_root_from_branch(leaf: &[u8; 32], index: u32, branch: &[[u8; 32]]) -> Option<[u8; 32]>;
pub fn verify_merkle_branch(leaf: &[u8; 32], index: u32, branch: &[[u8; 32]], root: &[u8; 32]) -> bool;
pub fn is_coinbase(raw_tx: &[u8]) -> bool;
/// Proves `raw_tx` is transaction `index` of the block `header` and returns its ID; the same block's coinbase and its
/// branch pin the tree's depth. Guard replays by the returned ID, never by `index`.
pub fn verify_tx_inclusion(header: &BlockHeader, raw_tx: &[u8], index: u32, branch: &[[u8; 32]], coinbase_tx: &[u8], coinbase_branch: &[[u8; 32]]) -> Option<[u8; 32]>;
```

## 存储 {#storage}

每个合约都有自己的键值存储，只有它自己能写。键最长 256 字节，值最长 65,536 字节。存储不能列举，也不能遍历，所以计数和索引键要自己维护。写一次花 10,000 gas 加每字节 10，读一次花 2,000 加每字节 1：少存一些，值回到空的时候就删掉那个键。

```rust from="playground/src/ai/ksana-contracts.md"
// ksana_contract_sdk::storage
/// The raw value of `key`, `None` when absent.
pub fn get(key: &[u8]) -> Option<Vec<u8>>;
pub fn set(key: &[u8], value: &[u8]);
pub fn remove(key: &[u8]);
/// Reads and Borsh-decodes `key`: `Ok(None)` when absent, `Err(ERR_MALFORMED_STORAGE)` when it does not decode.
pub fn read<T: Decode>(key: &[u8]) -> Result<Option<T>, Vec<u8>>;
/// Borsh-encodes `value` under `key`.
pub fn write<T: BorshSerialize + ?Sized>(key: &[u8], value: &T);
pub const ERR_MALFORMED_STORAGE: &[u8] = b"malformed storage value";
```

## 模拟宿主 {#mock}

在 WebAssembly 以外的任何目标上，SDK 在一个内存里的宿主上运行合约，供 `cargo test` 使用。它遵循 ABI：任何一层失败，整笔操作都会回滚，各项限制、调用深度和附带资产的规则都照样生效。它不计 gas；`register_asset` 和 `mint` 创建 KSA 之前，KSA 并不存在；传给 `deploy` 的 `code` 只是一个标签，而不是你的模块，所以测试里的合约 ID 和链上的不同。[编写合约](/docs/contracts/#test-it-natively)里有完整的测试。

```rust from="playground/src/ai/ksana-contracts.md"
// ksana_contract_sdk::mock
/// Clears everything.
pub fn reset();
/// Deploys: the ID from `deployer`, `nonce` and `sha256(code)` (`code` is a label, not the module), then `init` as
/// `deployer`; a failed `init` deploys nothing.
pub fn deploy(deployer: [u8; 32], nonce: u64, code: &[u8], dispatch: impl Fn(&str, &[u8]) -> CallResult + 'static, init_args: &[u8]) -> Result<[u8; 32], Failure>;
pub fn deploy_with_funds(deployer: [u8; 32], nonce: u64, code: &[u8], dispatch: impl Fn(&str, &[u8]) -> CallResult + 'static, init_args: &[u8], funds: &[Funds]) -> Result<[u8; 32], Failure>;
/// An operation of `caller` calling `contract`; a failure at any level rolls everything back.
pub fn call(caller: [u8; 32], contract: [u8; 32], method: &str, args: &[u8]) -> Result<Vec<u8>, Failure>;
pub fn call_with_funds(caller: [u8; 32], contract: [u8; 32], method: &str, args: &[u8], funds: &[Funds]) -> Result<Vec<u8>, Failure>;
/// Why an operation failed.
pub enum Failure { Revert { contract: [u8; 32], reason: Vec<u8> }, Trap(String) }
/// A dispatch function for `contract` without `init`, such as a stub of another contract.
pub fn register(contract: [u8; 32], dispatch: impl Fn(&str, &[u8]) -> CallResult + 'static);
/// Code that `create_contract` can create from; returns its hash.
pub fn register_code(code: &[u8], dispatch: impl Fn(&str, &[u8]) -> CallResult + 'static) -> [u8; 32];
pub type Dispatch = Rc<dyn Fn(&str, &[u8]) -> CallResult>;
/// Runs `f` as `caller` calling `self_id`, without rollback, to test a contract's internals.
pub fn with_context<R>(caller: [u8; 32], self_id: [u8; 32], f: impl FnOnce() -> R) -> R;
pub fn contract_exists(contract: &[u8; 32]) -> bool;
pub fn storage_value(contract: &[u8; 32], key: &[u8]) -> Option<Vec<u8>>;
/// An event a successful operation emitted.
pub struct Event { pub contract: [u8; 32], pub data: Vec<u8> }
pub fn events() -> Vec<Event>;
pub fn clear_events();
/// Registers an asset with no supply (an issuer of 32 zero bytes, as KSA's, gets no capabilities, any other `CAP_MINT`).
pub fn register_asset(asset: [u8; 32], name: &str, decimals: u8, issuer: [u8; 32]);
/// Gives `account` `amount` of a registered asset.
pub fn mint(asset: [u8; 32], account: [u8; 32], amount: u128) -> Result<(), Failure>;
pub fn balance(asset: &[u8; 32], account: &[u8; 32]) -> u128;
pub struct AssetInfo { pub name: String, pub symbol: String, pub decimals: u8, pub total_supply: u128, pub issuer: [u8; 32], pub capabilities: u8, pub paused: bool }
pub fn asset_info(asset: &[u8; 32]) -> Option<AssetInfo>;
pub fn set_asset_policy(asset: [u8; 32], capabilities: u8, paused: bool);
pub fn set_account_status(asset: [u8; 32], account: [u8; 32], status: u8);
pub fn account_status(asset: &[u8; 32], account: &[u8; 32]) -> u8;
pub fn set_block_height(height: u64);
pub fn set_block_timestamp(timestamp: u64);
pub fn set_chain_id(chain_id: u32);
pub fn set_gas_left(gas: u64);
pub fn set_btc_anchor_height(height: u32);
pub fn set_btc_header(height: u32, header: [u8; 80]);
pub fn set_btc_query_depth(depth: u32);
pub fn set_max_call_depth(depth: usize);
/// `Some` makes the following operations path C operations carried by `tx`.
pub fn set_native_tx(tx: Option<NativeTx>);
pub const DEFAULT_CHAIN_ID: u32 = 1001;
pub const DEFAULT_GAS_LEFT: u64 = 1_000_000_000;
pub const DEFAULT_BTC_QUERY_DEPTH: u32 = 6;
pub const DEFAULT_MAX_CALL_DEPTH: usize = 8;
pub const MAX_STORAGE_KEY_BYTES: usize = 256;
pub const MAX_STORAGE_VALUE_BYTES: usize = 65_536;
pub const MAX_EVENT_BYTES: usize = 16_384;
pub const MAX_OUTPUT_BYTES: usize = 65_536;
pub const MAX_OP_BYTES: usize = 65_536;
pub const MAX_ASSET_META_BYTES: usize = 1_024;
pub const MAX_ASSET_NAME_BYTES: usize = 64;
pub const MAX_ASSET_SYMBOL_BYTES: usize = 16;
pub const MAX_ASSET_DECIMALS: u8 = 18;
```

## 代币标准 {#standards}

打开 `standards` 特性后，SDK 带有 [KS-20](/docs/ks-20/) 代币和 [KS-721](/docs/ks-721/) 合集的参考实现：合约调用 `dispatch` 就能应答每一个标准方法，`conformance` 则在模拟宿主上按标准测试它。这个特性默认关闭，因为打开它，连不用它的合约的模块也会改变。在 `Cargo.toml` 里打开它：

```toml
ksana-contract-sdk = { path = "../ksana/crates/ksana-contract-sdk", features = ["standards"] }
```

在 Playground 里，“KS-20 代币”、“NFT”和“AMM”页面用它构建，其他页面不用。

### `standard`

两个标准共用的部分：零账户、revert 的原因、代币列出的能力、接收方合约的应答，以及 `AssetRef`，它用一个参数指明一个代币合约或一种内置资产。

```rust from="playground/src/ai/ksana-contracts.md"
// ksana_contract_sdk::standard
/// The zero account: the `from` of a mint and the `to` of a burn.
pub const ZERO_ACCOUNT: [u8; 32] = [0u8; 32];
pub const STANDARDS: &str = "standards";
pub const METADATA: &str = "metadata";
pub const CAPABILITIES_VIEW: &str = "capabilities";
pub const ERR_UNKNOWN_METHOD: &[u8] = b"unknown method";
pub const ERR_UNEXPECTED_FUNDS: &[u8] = b"unexpected attached funds";
pub const ERR_ZERO_ACCOUNT: &[u8] = b"zero account";
pub const ERR_SELF_RECIPIENT: &[u8] = b"recipient is this contract";
pub const ERR_NOT_THE_MINTER: &[u8] = b"not the minter";
pub const ERR_MINTING_ENDED: &[u8] = b"minting has ended";
pub const ERR_ALREADY_INITIALIZED: &[u8] = b"already initialized";
pub const ERR_NOT_INITIALIZED: &[u8] = b"not initialized";
pub const ERR_NAME: &[u8] = b"name must be 1 to 64 bytes";
pub const ERR_SYMBOL: &[u8] = b"symbol must be 1 to 16 bytes";
pub const ERR_MALFORMED_RETURN: &[u8] = b"malformed return value";
pub const ERR_MISSING_INDEX: &[u8] = b"missing index entry";
pub const ERR_OVERFLOW: &[u8] = b"arithmetic overflow";
pub const REJECTED: &str = "rejected: ";
pub const MAX_NAME_BYTES: usize = 64;
pub const MAX_SYMBOL_BYTES: usize = 16;
pub const CAP_MINT: &str = "mint";
pub const CAP_FREEZE: &str = "freeze";
pub const CAP_ALLOWLIST: &str = "allowlist";
pub const CAP_PAUSE: &str = "pause";
pub const CAP_CLAWBACK: &str = "clawback";
pub const CAP_FEE: &str = "fee";
pub const CAP_UPGRADE: &str = "upgrade";
/// The order a `capabilities()` view lists them in.
pub const CAPABILITIES: [&str; 7] = [CAP_MINT, CAP_FREEZE, CAP_ALLOWLIST, CAP_PAUSE, CAP_CLAWBACK, CAP_FEE, CAP_UPGRADE];
/// `rejected: <reason>`: a refusal by the contract's own rules.
pub fn rejected(reason: &str) -> Vec<u8>;
pub fn is_rejection(reason: &[u8]) -> bool;
/// Reverts with `unexpected attached funds` when funds are attached.
pub fn no_funds() -> Result<(), Vec<u8>>;
/// Reverts unless `to` is neither the zero account nor this contract.
pub fn check_recipient(to: &[u8; 32]) -> Result<(), Vec<u8>>;
pub fn check_name(name: &str) -> Result<(), Vec<u8>>;
pub fn check_symbol(symbol: &str) -> Result<(), Vec<u8>>;
/// The answer of `on_token_received` or `on_nft_received`: `value`'s Borsh bytes as `Bytes`.
pub fn reply<T: BorshSerialize + ?Sized>(value: &T) -> CallResult;
/// Whether an allowance or operator expiring at `expires_at` has expired at this block's timestamp.
pub fn expired(expires_at: Option<u64>) -> bool;
/// The standards `contract` declares, `None` when it answers no list (a caught call).
pub fn standards_of(contract: &[u8; 32]) -> Option<Vec<String>>;
pub fn declares(contract: &[u8; 32], id: &str) -> bool;
/// A fungible asset of either kind in one argument: Borsh tag 0 and a token contract's ID, or tag 1 and a built-in
/// asset's ID (KSA: 1 and 32 zero bytes).
pub enum AssetRef { Token([u8; 32]), Asset([u8; 32]) }
impl AssetRef {
    pub fn id(&self) -> [u8; 32];
    /// The token's `balance_of`, or the built-in balance.
    pub fn balance_of(&self, account: &[u8; 32]) -> Result<u128, Vec<u8>>;
    /// Pays from this contract's balance: the token's `transfer`, or `asset_transfer`.
    pub fn pay(&self, to: &[u8; 32], amount: u128);
}
```

### `ks20`

一个常量就是一个 KS-20 代币，`const TOKEN: Ks20 = Ks20::new().burnable();`；`Token` 用于在另一个合约里调用任意 KS-20 代币。

```rust from="playground/src/ai/ksana-contracts.md"
// ksana_contract_sdk::ks20
pub const ID: &str = "KS-20";
pub const BURNABLE: &str = "KS-20-burnable";
pub const MINTABLE: &str = "KS-20-mintable";
pub const ON_RECEIVED: &str = "on_token_received";
pub const MAX_DECIMALS: u8 = 18;
/// An allowance that never goes down.
pub const UNLIMITED: u128 = u128::MAX;
pub const ERR_ZERO_AMOUNT: &[u8] = b"zero amount";
pub const ERR_INSUFFICIENT_BALANCE: &[u8] = b"insufficient balance";
pub const ERR_INSUFFICIENT_ALLOWANCE: &[u8] = b"insufficient allowance";
pub const ERR_ALLOWANCE_EXPIRED: &[u8] = b"allowance expired";
pub const ERR_SPENDER_IS_CALLER: &[u8] = b"spender is the caller";
pub const ERR_DECIMALS: &[u8] = b"decimals must be at most 18";
pub const ERR_CAP_EXCEEDED: &[u8] = b"cap exceeded";
pub const ERR_SUPPLY_OVERFLOW: &[u8] = b"supply overflow";
pub const REASON_FEE: &str = "the fee takes the whole amount";
/// A KS-20 token to call from another contract: `Token(id).balance_of(&account)?`.
pub struct Token(pub [u8; 32]);
impl Token {
    pub fn standards(&self) -> Result<Vec<String>, Vec<u8>>;
    pub fn metadata(&self) -> Result<(String, String, u8), Vec<u8>>;
    pub fn total_supply(&self) -> Result<u128, Vec<u8>>;
    pub fn balance_of(&self, account: &[u8; 32]) -> Result<u128, Vec<u8>>;
    pub fn allowance(&self, owner: &[u8; 32], spender: &[u8; 32]) -> Result<u128, Vec<u8>>;
    /// Sends this contract's tokens.
    pub fn transfer(&self, to: &[u8; 32], amount: u128);
    /// Takes tokens with the allowance `from` gave this contract.
    pub fn transfer_from(&self, from: &[u8; 32], to: &[u8; 32], amount: u128);
    pub fn approve(&self, spender: &[u8; 32], amount: u128, expires_at: Option<u64>);
    pub fn transfer_and_call(&self, to: &[u8; 32], amount: u128, data: &[u8], funds: &[Funds]) -> Result<Vec<u8>, Vec<u8>>;
    /// `transfer` that returns the token's refusal instead of failing the operation.
    pub fn try_transfer(&self, to: &[u8; 32], amount: u128) -> Result<(), CallError>;
    pub fn try_transfer_from(&self, from: &[u8; 32], to: &[u8; 32], amount: u128) -> Result<(), CallError>;
}
/// What `on_token_received` got: `token` is its caller, and `from` and `amount` are true only when that is a token
/// this contract accepts.
pub struct Received { pub token: [u8; 32], pub from: [u8; 32], pub amount: u128, pub data: Vec<u8> }
/// Decodes the arguments of `on_token_received`.
pub fn received(args: &[u8]) -> Result<Received, Vec<u8>>;
pub enum Event {
    Standards(Vec<String>),
    Metadata { name: String, symbol: String, decimals: u8 },
    Transfer { from: [u8; 32], to: [u8; 32], amount: u128 },
    Approve { owner: [u8; 32], spender: [u8; 32], amount: u128, expires_at: Option<u64> },
    Minter { previous: Option<[u8; 32]>, minter: Option<[u8; 32]> },
}
impl Event {
    pub fn parse(data: &[u8]) -> Option<Self>;
    pub fn encode(&self) -> Vec<u8>;
    pub fn emit(&self);
}
/// A token's own rules; every method has a default of none.
pub trait Policy {
    /// Before every change of a balance (a mint is from the zero account, a burn to it); refuse with `rejected(…)`.
    fn check(&self, from: &[u8; 32], to: &[u8; 32], amount: u128) -> Result<(), Vec<u8>>;
    /// `Some((account, fee))` takes `fee` out of a transfer's amount for `account`.
    fn fee(&self, from: &[u8; 32], to: &[u8; 32], amount: u128) -> Result<Option<([u8; 32], u128)>, Vec<u8>>;
    /// The capabilities these rules give someone now, such as `freeze`.
    fn capabilities(&self) -> Result<Vec<&'static str>, Vec<u8>>;
}
pub struct NoPolicy;
/// The reference implementation, as a `const` of the token: `const TOKEN: Ks20 = Ks20::new().burnable();`.
pub struct Ks20<P = NoPolicy> { .. }
impl Ks20<NoPolicy> {
    pub const fn new() -> Self;
    pub const fn burnable(self) -> Self;
    pub const fn mintable(self) -> Self;
    pub const fn with_policy<Q: Policy>(self, policy: Q) -> Ks20<Q>;
}
impl<P: Policy> Ks20<P> {
    /// Answers every standard method the token has; `None` for the others, `init` included.
    pub fn dispatch(&self, method: &str, args: &[u8]) -> Option<CallResult>;
    /// Records the metadata and emits the declaration, in `init` before any mint.
    pub fn init(&self, name: &str, symbol: &str, decimals: u8) -> Result<(), Vec<u8>>;
    /// `KS-20-mintable`: the first minter and the cap, in `init` after `init`.
    pub fn init_minter(&self, minter: Option<[u8; 32]>, cap: Option<u128>) -> Result<(), Vec<u8>>;
    pub fn policy(&self) -> &P;
    pub fn standards(&self) -> Vec<String>;
    pub fn metadata(&self) -> Result<(String, String, u8), Vec<u8>>;
    pub fn set_metadata(&self, name: &str, symbol: &str) -> Result<(), Vec<u8>>;
    pub fn capabilities(&self) -> Result<Vec<String>, Vec<u8>>;
    pub fn total_supply(&self) -> Result<u128, Vec<u8>>;
    pub fn balance_of(&self, account: &[u8; 32]) -> Result<u128, Vec<u8>>;
    pub fn allowance(&self, owner: &[u8; 32], spender: &[u8; 32]) -> Result<u128, Vec<u8>>;
    pub fn allowance_info(&self, owner: &[u8; 32], spender: &[u8; 32]) -> Result<(u128, Option<u64>), Vec<u8>>;
    pub fn minter(&self) -> Result<Option<[u8; 32]>, Vec<u8>>;
    pub fn cap(&self) -> Result<Option<u128>, Vec<u8>>;
    /// Sets the minter (the method checks the caller first); `None` ends minting.
    pub fn set_minter(&self, minter: Option<[u8; 32]>) -> Result<(), Vec<u8>>;
    /// Moves `amount` from `from` to `to` by the token's rules; returns what `to` received.
    pub fn transfer(&self, from: &[u8; 32], to: &[u8; 32], amount: u128) -> Result<u128, Vec<u8>>;
    pub fn transfer_from(&self, spender: &[u8; 32], from: &[u8; 32], to: &[u8; 32], amount: u128) -> Result<u128, Vec<u8>>;
    pub fn transfer_and_call(&self, from: &[u8; 32], to: &[u8; 32], amount: u128, data: &[u8]) -> Result<Vec<u8>, Vec<u8>>;
    pub fn approve(&self, owner: &[u8; 32], spender: &[u8; 32], amount: u128, expires_at: Option<u64>) -> Result<(), Vec<u8>>;
    pub fn spend_allowance(&self, owner: &[u8; 32], spender: &[u8; 32], amount: u128) -> Result<(), Vec<u8>>;
    /// Creates tokens for `to`, up to the cap; the token's own minting method checks the caller first.
    pub fn mint(&self, to: &[u8; 32], amount: u128) -> Result<(), Vec<u8>>;
    pub fn burn(&self, from: &[u8; 32], amount: u128) -> Result<(), Vec<u8>>;
    pub fn burn_from(&self, spender: &[u8; 32], from: &[u8; 32], amount: u128) -> Result<(), Vec<u8>>;
}
```

### `ks721`

一个常量就是一个 KS-721 合集，`const NFT: Ks721 = Ks721::new().burnable().enumerable();`；`Collection` 用于在另一个合约里调用任意合集。合集自己写 `init` 和铸造方法。

```rust from="playground/src/ai/ksana-contracts.md"
// ksana_contract_sdk::ks721
pub const ID: &str = "KS-721";
pub const BURNABLE: &str = "KS-721-burnable";
pub const ENUMERABLE: &str = "KS-721-enumerable";
pub const ON_RECEIVED: &str = "on_nft_received";
pub const MAX_URI_BYTES: usize = 2_048;
pub const MAX_PAGE: u32 = 100;
pub type TokenId = [u8; 32];
pub const ERR_UNKNOWN_TOKEN: &[u8] = b"unknown token";
pub const ERR_NOT_THE_OWNER: &[u8] = b"not the owner";
pub const ERR_NOT_AUTHORIZED: &[u8] = b"not authorized";
pub const ERR_WRONG_OWNER: &[u8] = b"wrong owner";
pub const ERR_ALREADY_THE_OWNER: &[u8] = b"already the owner";
pub const ERR_SPENDER_IS_OWNER: &[u8] = b"spender is the owner";
pub const ERR_OPERATOR_IS_CALLER: &[u8] = b"operator is the caller";
pub const ERR_TOKEN_EXISTS: &[u8] = b"token exists";
pub const ERR_TOKEN_BURNED: &[u8] = b"token was burned";
pub const ERR_URI_TOO_LONG: &[u8] = b"uri too long";
/// The ID of serial number `n`: `n` big-endian in the last 16 bytes.
pub fn id(n: u128) -> TokenId;
/// The serial number of an ID whose first 16 bytes are zero.
pub fn serial(token_id: &TokenId) -> Option<u128>;
/// A KS-721 collection to call from another contract.
pub struct Collection(pub [u8; 32]);
impl Collection {
    pub fn standards(&self) -> Result<Vec<String>, Vec<u8>>;
    pub fn metadata(&self) -> Result<(String, String), Vec<u8>>;
    pub fn owner_of(&self, token_id: &TokenId) -> Result<Option<[u8; 32]>, Vec<u8>>;
    pub fn balance_of(&self, owner: &[u8; 32]) -> Result<u64, Vec<u8>>;
    pub fn token_uri(&self, token_id: &TokenId) -> Result<Option<String>, Vec<u8>>;
    pub fn transfer(&self, to: &[u8; 32], token_id: &TokenId);
    pub fn transfer_from(&self, from: &[u8; 32], to: &[u8; 32], token_id: &TokenId);
    pub fn approve(&self, spender: Option<&[u8; 32]>, token_id: &TokenId);
    pub fn set_operator(&self, operator: &[u8; 32], approved: bool, expires_at: Option<u64>);
    pub fn transfer_and_call(&self, to: &[u8; 32], token_id: &TokenId, data: &[u8], funds: &[Funds]) -> Result<Vec<u8>, Vec<u8>>;
    pub fn try_transfer(&self, to: &[u8; 32], token_id: &TokenId) -> Result<(), CallError>;
    pub fn try_transfer_from(&self, from: &[u8; 32], to: &[u8; 32], token_id: &TokenId) -> Result<(), CallError>;
}
/// What `on_nft_received` got; `collection` is its caller.
pub struct Received { pub collection: [u8; 32], pub from: [u8; 32], pub token_id: TokenId, pub data: Vec<u8> }
pub fn received(args: &[u8]) -> Result<Received, Vec<u8>>;
pub enum Event {
    Standards(Vec<String>),
    Metadata { name: String, symbol: String },
    Transfer { from: [u8; 32], to: [u8; 32], token_id: TokenId },
    Approve { owner: [u8; 32], spender: Option<[u8; 32]>, token_id: TokenId },
    Operator { owner: [u8; 32], operator: [u8; 32], approved: bool, expires_at: Option<u64> },
    Uri(Option<TokenId>),
}
impl Event {
    pub fn parse(data: &[u8]) -> Option<Self>;
    pub fn encode(&self) -> Vec<u8>;
    pub fn emit(&self);
}
/// A collection's own rules; every method has a default of none.
pub trait Policy {
    /// Before every change of owner (a mint is from the zero account, a burn to it).
    fn check(&self, from: &[u8; 32], to: &[u8; 32], token_id: &TokenId) -> Result<(), Vec<u8>>;
    fn capabilities(&self) -> Result<Vec<&'static str>, Vec<u8>>;
}
pub struct NoPolicy;
/// The reference implementation: `const NFT: Ks721 = Ks721::new().burnable().enumerable();`.
pub struct Ks721<P = NoPolicy> { .. }
impl Ks721<NoPolicy> {
    pub const fn new() -> Self;
    pub const fn burnable(self) -> Self;
    pub const fn enumerable(self) -> Self;
    pub const fn with_policy<Q: Policy>(self, policy: Q) -> Ks721<Q>;
}
impl<P: Policy> Ks721<P> {
    /// Answers every standard method the collection has; `None` for the others, `init` and minting included.
    pub fn dispatch(&self, method: &str, args: &[u8]) -> Option<CallResult>;
    pub fn init(&self, name: &str, symbol: &str) -> Result<(), Vec<u8>>;
    pub fn policy(&self) -> &P;
    pub fn standards(&self) -> Vec<String>;
    pub fn metadata(&self) -> Result<(String, String), Vec<u8>>;
    pub fn set_metadata(&self, name: &str, symbol: &str) -> Result<(), Vec<u8>>;
    pub fn capabilities(&self) -> Result<Vec<String>, Vec<u8>>;
    pub fn owner_of(&self, token_id: &TokenId) -> Result<Option<[u8; 32]>, Vec<u8>>;
    pub fn balance_of(&self, owner: &[u8; 32]) -> Result<u64, Vec<u8>>;
    pub fn token_uri(&self, token_id: &TokenId) -> Result<Option<String>, Vec<u8>>;
    pub fn approved(&self, token_id: &TokenId) -> Result<Option<[u8; 32]>, Vec<u8>>;
    pub fn operator_info(&self, owner: &[u8; 32], operator: &[u8; 32]) -> Result<(bool, Option<u64>), Vec<u8>>;
    pub fn is_operator(&self, owner: &[u8; 32], operator: &[u8; 32]) -> Result<bool, Vec<u8>>;
    pub fn is_burned(&self, token_id: &TokenId) -> bool;
    /// Whether `account` may move `owner`'s token: the owner, the approved account or an operator.
    pub fn may_move(&self, account: &[u8; 32], owner: &[u8; 32], token_id: &TokenId) -> Result<bool, Vec<u8>>;
    pub fn transfer(&self, caller: &[u8; 32], to: &[u8; 32], token_id: &TokenId) -> Result<(), Vec<u8>>;
    pub fn transfer_from(&self, caller: &[u8; 32], from: &[u8; 32], to: &[u8; 32], token_id: &TokenId) -> Result<(), Vec<u8>>;
    pub fn transfer_and_call(&self, caller: &[u8; 32], to: &[u8; 32], token_id: &TokenId, data: &[u8]) -> Result<Vec<u8>, Vec<u8>>;
    pub fn approve(&self, caller: &[u8; 32], spender: Option<&[u8; 32]>, token_id: &TokenId) -> Result<(), Vec<u8>>;
    pub fn set_operator(&self, owner: &[u8; 32], operator: &[u8; 32], approved: bool, expires_at: Option<u64>) -> Result<(), Vec<u8>>;
    /// Mints a new ID to `to`; an ID minted before, even burned, is refused.
    pub fn mint(&self, to: &[u8; 32], token_id: &TokenId, uri: Option<&str>) -> Result<(), Vec<u8>>;
    pub fn burn(&self, token_id: &TokenId) -> Result<(), Vec<u8>>;
    pub fn set_token_uri(&self, token_id: &TokenId, uri: Option<&str>) -> Result<(), Vec<u8>>;
    pub fn total_supply(&self) -> Result<u64, Vec<u8>>;
    pub fn tokens(&self, start: u64, limit: u32) -> Result<Vec<TokenId>, Vec<u8>>;
    pub fn tokens_of(&self, owner: &[u8; 32], start: u64, limit: u32) -> Result<Vec<TokenId>, Vec<u8>>;
}
```

### `conformance`

在模拟宿主上按标准对代币或合集做原生测试：`conformance::ks20(setup)` 返回 `Ok(())`，或者第一个没通过的检查。

```rust from="playground/src/ai/ksana-contracts.md"
// ksana_contract_sdk::conformance
/// Runs the KS-20 checks against the token `setup` deploys on the freshly reset mock host.
pub fn ks20(setup: impl Fn() -> Ks20Subject) -> Outcome;
pub fn ks721(setup: impl Fn() -> Ks721Subject) -> Outcome;
pub type Outcome = Result<(), String>;
/// The token and an account holding at least `MIN_BALANCE` that may send to the kit's accounts.
pub struct Ks20Subject { pub token: [u8; 32], pub holder: [u8; 32] }
/// The collection, an account owning at least `MIN_TOKENS`, and those tokens.
pub struct Ks721Subject { pub collection: [u8; 32], pub holder: [u8; 32], pub tokens: Vec<TokenId> }
pub const MIN_BALANCE: u128 = 100;
pub const MIN_TOKENS: usize = 2;
pub const ALICE: [u8; 32] = [0xA1; 32];
pub const BOB: [u8; 32] = [0xB2; 32];
pub const RECEIVER: [u8; 32] = [0xC3; 32];
pub const FUNDS_ASSET: [u8; 32] = [0xF4; 32];
pub const UNKNOWN_TOKEN: TokenId = [0xE5; 32];
```
