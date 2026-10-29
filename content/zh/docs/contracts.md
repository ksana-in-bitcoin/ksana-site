---
title: 编写合约
lede: Ksana 合约是编译成 WebAssembly 的 Rust 程序。从一个空目录起步写一个小合约，在你自己的机器上测试，再把它部署到公开 signet 上并调用它。
description: 怎样用 Rust 和 ksana-contract-sdk 编写、测试、构建并部署 Ksana 智能合约，从 Cargo.toml 一直讲到调用其他合约。
---

合约是一个 WebAssembly 模块，有自己的存储，也有自己的余额。合约由一笔操作部署，它的方法由操作或其他合约调用。每个节点和每个索引器执行每一次调用的方式都完全相同，所以调用的结果都计入链的状态根。

本页要写的是一个小费罐：任何人都可以留言并附上 KSA，所有者可以把小费取走。想先在浏览器里上手，[你的第一个合约](/docs/first-contract/)在 Playground 里写一个投票合约，什么都不用安装。[合约 SDK](/docs/contract-sdk/) 列出了本页用到的每个函数；接下来可以读[示例合约](/docs/example-contracts/)，它们规模更大，也经过测试，可以当作范本。

## 合约如何运作 {#model}

- **语言与编译目标**：你用 Rust 编写合约，依赖仓库里的 `ksana-contract-sdk`，把它编译到 `wasm32-unknown-unknown`。在这个目标上，crate 是 `no_std` 的：分配器和 panic 处理函数由 SDK 提供。
- **一次调用，一个实例**：每次调用都在一个全新的实例里运行，所以内存不会在调用之间保留。需要长久保存的数据要写进合约的存储，这是一个键值存储，只有合约自己能写。
- **方法**：节点传入方法名和参数字节。合约返回 `Ok(bytes)`；要 revert 时，返回 `Err(reason)`。
- **全有或全无**：在嵌套调用的任何一层发生 revert、trap 或 gas 耗尽，整笔操作都会失败：所有改动全部回滚，只留下已扣的手续费和递增的 nonce。唯一的例外是下文的 `try_call`。
- **确定性**：宿主函数是合约观察外界的唯一途径：除了区块的时间戳，没有别的时钟，也没有任何随机数来源。浮点运算在部署时就会被拒绝，gas 精确计量，栈按固定的估算计量，所以每台机器都得出同样的结果。

### 部署时的检查

部署操作执行时，节点会检查模块：通不过检查的模块会让这笔操作失败，错误为 `deployment rejected: <reason>`，操作的手续费和 nonce 照样用掉。模块必须：

- 只使用 WebAssembly 1.0，外加可变全局变量、符号扩展、批量内存操作、多返回值和 `funcref` 表，不使用浮点、SIMD、线程或任何其他提案；
- 恰好定义一块内存，初始大小最多 256 页（16 MiB），并且最多定义一张表，表最多 4,096 项；
- 只从 `ksana` 模块导入函数（即[宿主函数](/docs/host-functions/)），并导出 `memory`、`ksana_alloc` 和 `ksana_call`。

用 Rust 1.98.1 配合 SDK 构建，不加任何额外选项，就能得到这样的模块。完整的规范见 [ABI]({{repo}}/blob/main/docs/ABI.md)。

## 建立项目

你需要 Rust 1.98.1 或更高版本，并装好 `wasm32-unknown-unknown` 编译目标，还需要克隆一份仓库：SDK 没有发布到 crates.io。把你的项目放在克隆目录的旁边，而不是放进去，免得 Cargo 把它当成仓库 workspace 的成员：

```text
work/
  ksana/      git clone {{repo}}
  tip-jar/
    Cargo.toml
    rust-toolchain.toml
    src/lib.rs
    tests/tip_jar.rs
```

```toml title="Cargo.toml"
[package]
name = "tip-jar"
version = "0.1.0"
edition = "2021"
rust-version = "1.98.1"
publish = false

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
ksana-contract-sdk = { path = "../ksana/crates/ksana-contract-sdk" }

[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

```toml title="rust-toolchain.toml"
[toolchain]
channel = "1.98.1"
targets = ["wasm32-unknown-unknown"]
```

`cdylib` 就是 WebAssembly 模块，`rlib` 让你的本机测试能链接这个合约。release 配置让模块保持小巧：部署的手续费、部署的 gas，以及每次调用的 gas，都随模块的大小增长。

## 编写合约代码

```rust title="src/lib.rs"
//! 小费罐：任何人都可以留言并附上 KSA，所有者把小费取走。
#![cfg_attr(target_arch = "wasm32", no_std)]
extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;
use ksana_contract_sdk::{self as sdk, storage, CallResult, KSA_ASSET_ID};

sdk::entry!(dispatch);

const OWNER: &[u8] = b"owner";
const TOTAL: &[u8] = b"total";

/// 把调用分派给对应的方法。部署时总会调用 `init`。
pub fn dispatch(method: &str, args: &[u8]) -> CallResult {
    match method {
        "init" => init(args),
        "tip" => tip(args),
        "withdraw" => withdraw(args),
        "total" => {
            sdk::decode::<()>(args)?;
            sdk::ok(&total()?)
        }
        _ => sdk::revert("unknown method"),
    }
}

/// `init()`：部署者成为所有者。
fn init(args: &[u8]) -> CallResult {
    sdk::decode::<()>(args)?;
    if !sdk::call_funds().is_empty() {
        return sdk::revert("init takes no funds");
    }
    storage::write(OWNER, &sdk::caller());
    sdk::ok(&())
}

/// `tip(note: String) -> u128`：收下这次调用附带的 KSA；返回新的总额。
fn tip(args: &[u8]) -> CallResult {
    let note: String = sdk::decode(args)?;
    if note.len() > 140 {
        return sdk::revert("the note is longer than 140 bytes");
    }
    let amount = match sdk::call_funds().as_slice() {
        [funds] if funds.asset == KSA_ASSET_ID => funds.amount,
        _ => return sdk::revert("attach KSA and nothing else"),
    };
    let total = total()?.checked_add(amount).ok_or(b"overflow".to_vec())?;
    storage::write(TOTAL, &total);
    sdk::emit(&("tip", sdk::caller(), amount, note));
    sdk::ok(&total)
}

/// `withdraw(to: [u8; 32], amount: u128)`：所有者把小费从罐里转出去。
fn withdraw(args: &[u8]) -> CallResult {
    let (to, amount): ([u8; 32], u128) = sdk::decode(args)?;
    let owner: [u8; 32] = storage::read(OWNER)?.ok_or(b"not initialized".to_vec())?;
    if sdk::caller() != owner {
        return sdk::revert("only the owner can withdraw");
    }
    // 余额不足时 asset_transfer 会 trap；先检查，才能带着原因 revert
    if sdk::asset_balance(&KSA_ASSET_ID, &sdk::self_id()) < amount {
        return sdk::revert("not enough KSA in the jar");
    }
    sdk::asset_transfer(&KSA_ASSET_ID, &to, amount);
    sdk::emit(&("withdraw", to, amount));
    sdk::ok(&())
}

fn total() -> Result<u128, Vec<u8>> {
    Ok(storage::read(TOTAL)?.unwrap_or(0))
}
```

### 入口与分派

`sdk::entry!(dispatch)` 生成节点要调用的两个导出函数：`ksana_alloc` 和 `ksana_call`。它解码出方法名和参数字节，交给你的 `dispatch` 函数，这个函数返回一个 `CallResult`，也就是 `Result<Vec<u8>, Vec<u8>>`。

部署时总会调用 `init`，所以每个合约都要处理它，即使它不带参数：在这里以 `unknown method` revert，部署就会失败。部署之后，任何对 `init` 的调用都会失败。

### 参数与返回值

参数和返回值都只是字节。约定的编码是 Borsh，每个示例合约和 `ksana-cli` 都采用它：一个方法的多个参数组成一个元组，依次紧挨着编码；单个参数就编码它本身；没有参数时，就是空的字节串。

- `sdk::decode::<T>(args)` 负责解码，并要求每个字节都被用上。输入有误时，它返回 `Err(b"malformed arguments")`，于是 `?` 把它变成一次 revert。它能处理整数、`bool`、`[u8; N]`、`Vec<T>`、`String`、`Option`、`Result`、`()`，以及最多 8 个元素的元组；你自己的结构体，请逐个字段解码。
- `sdk::ok(&value)` 编码一个返回值，`sdk::revert("reason")` 带着一条消息 revert。

### 存储

`storage::read` 和 `storage::write` 以字节为键，存取 Borsh 编码的值；`storage::get`、`set` 和 `remove` 直接处理原始字节。键最长 256 字节，值最长 65,536 字节。写入立即对同一笔操作的每一层调用可见。

写入耗费的 gas 远多于读取（写入是 10,000 加每字节 10，读取是 2,000 加每字节 1），所以只存需要的数据，不要多存。示例合约在一个键的值降到零时，就把这个键删掉。

### 调用者与附带资产

操作调用合约时，`sdk::caller()` 是签署这笔操作的账户；另一个合约调用它时，则是发起调用的那个合约的 ID。`init` 看到的调用者是部署者，小费罐就是这样知道自己的所有者的。

操作或合约可以给一次调用附带内置资产，比如 KSA。节点在合约运行之前就把这些资产转给合约，`sdk::call_funds()` 列出它们。合约没有记账的资产会永远留在它的余额里，所以要像 `tip` 和 `init` 那样，检查收到了什么。

合约自己的余额和账户的余额用法一样：`sdk::asset_balance` 读取它，`sdk::asset_transfer` 从中付款。余额不够支付的转账会 trap：合约无法捕获它，操作随之失败，错误只有一句 `insufficient balance`。所以 `withdraw` 先做检查，用自己的消息 revert。

### 事件

`sdk::emit(&value)` 在操作的回执里记录一个事件。按照惯例，事件是一个 Borsh 元组，第一个元素是事件名，比如 `("tip", caller, amount, note)`。事件不属于状态，花费 1,000 gas 加每字节 5，最多 16,384 字节，操作失败时随之消失。

## 在本机测试

在你自己的机器上，SDK 用一个内存中的模拟宿主代替宿主函数，所以普通的 `cargo test` 不需要节点就能运行合约：

```rust title="tests/tip_jar.rs"
#![cfg(not(target_arch = "wasm32"))]

use ksana_contract_sdk::mock::{self, Failure};
use ksana_contract_sdk::{encode, Funds, KSA_ASSET_ID};

const OWNER: [u8; 32] = [1; 32];
const FAN: [u8; 32] = [2; 32];

/// 部署一个新的小费罐，并给 FAN 1,000 个最小单位的 KSA。
fn setup() -> [u8; 32] {
    mock::reset();
    mock::register_asset(KSA_ASSET_ID, "KSA", 8, [0; 32]);
    mock::mint(KSA_ASSET_ID, FAN, 1_000).unwrap();
    mock::deploy(OWNER, 0, b"tip-jar", tip_jar::dispatch, &[]).unwrap()
}

fn ksa(amount: u128) -> [Funds; 1] {
    [Funds {
        asset: KSA_ASSET_ID,
        amount,
    }]
}

#[test]
fn tips_add_up_and_the_owner_withdraws() {
    let jar = setup();
    let out = mock::call_with_funds(FAN, jar, "tip", &encode("gm"), &ksa(250)).unwrap();
    assert_eq!(out, encode(&250u128));
    assert_eq!(mock::balance(&KSA_ASSET_ID, &jar), 250);
    assert_eq!(mock::events().len(), 1);

    mock::call(OWNER, jar, "withdraw", &encode(&(OWNER, 100u128))).unwrap();
    assert_eq!(mock::balance(&KSA_ASSET_ID, &OWNER), 100);
    assert_eq!(mock::balance(&KSA_ASSET_ID, &jar), 150);
}

#[test]
fn only_the_owner_withdraws() {
    let jar = setup();
    mock::call_with_funds(FAN, jar, "tip", &encode("gm"), &ksa(250)).unwrap();
    let failure = mock::call(FAN, jar, "withdraw", &encode(&(FAN, 250u128))).unwrap_err();
    assert_eq!(
        failure,
        Failure::Revert {
            contract: jar,
            reason: b"only the owner can withdraw".to_vec()
        }
    );
}
```

```sh
cargo test
```

```output

running 2 tests
test tips_add_up_and_the_owner_withdraws ... ok
test only_the_owner_withdraws ... ok

test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

模拟宿主遵循 ABI：任何一层失败都会回滚整笔操作，各项限制、调用深度和附带资产的规则也都照样适用。它和节点有三处不同，写测试时要留意：

- 在你调用 `mock::register_asset` 和 `mock::mint` 之前，KSA 并不存在。
- 没有 gas 计量，所以测试没法告诉你一次调用要花多少。
- 你传给 `mock::deploy` 的 `code` 只是一个标签，不是你的模块，所以测试里的合约 ID 和链上的不同。

## 构建模块

构建 release 模块，只产出 `cdylib`：

```sh
cargo rustc --release --target wasm32-unknown-unknown --crate-type cdylib
wc -c target/wasm32-unknown-unknown/release/tip_jar.wasm
```

```output
9081 target/wasm32-unknown-unknown/release/tip_jar.wasm
```

`cargo build` 还会产出 `rlib`，它留下的模块也更大，因为链接时优化能删掉的代码没那么多。模块的字节取决于你那份 SDK 检出目录的绝对路径，所以要部署的文件只构建一次，并用这个文件算出它的 ID。

::: details 示例合约使用的 lint 规则
仓库里的合约禁止那些会 panic 或溢出的写法。把同样的表加进你的 `Cargo.toml`，再运行 `cargo clippy -- -D warnings`，在本机目标上和加上 `--target wasm32-unknown-unknown` 各运行一次；小费罐两次都能通过。

```toml
[lints.rust]
unsafe_code = "deny"
missing_docs = "warn"

[lints.clippy]
unwrap_used = "deny"
expect_used = "deny"
panic = "deny"
unreachable = "deny"
todo = "deny"
unimplemented = "deny"
indexing_slicing = "deny"
arithmetic_side_effects = "deny"
float_arithmetic = "deny"
cast_possible_truncation = "deny"
cast_possible_wrap = "deny"
cast_sign_loss = "deny"
```

测试通常会在每个测试文件的开头重新允许 `unwrap_used` 和 `panic`。
:::

## 部署并调用

要在浏览器里试一个合约，[合约 Playground](/docs/playground/) 能把模块部署到 signet 上，并按源码里的 [ABI 块](/docs/playground/#the-abi-block)生成表单来调用它，签名都在你的钱包里完成。它的示例还可以直接在那里修改和编译。

用 [ksana-cli](/docs/cli/) 在公开 signet 上部署。下面的命令用到[代币与资金池教程](/docs/token-and-pool/#load-the-helpers)里的 shell 函数 `contract_id`、`enc_string` 和 `enc_u128`；那篇教程在三个示例合约上运行同样的命令，并附有真实的输出。

小费罐的 `init` 不接受参数，所以部署时不带 `--init-args`。输出给出这笔操作的 `account`、`nonce` 和状态，但不给新合约的 ID：你要用部署账户、部署操作的 nonce 和模块的 SHA-256 自己算出它。

```sh
export KSANA_RPC={{signet.rpc}}
ACCOUNT=$(ksana-cli --chain signet key alice.key | jq -r .account)
WASM=target/wasm32-unknown-unknown/release/tip_jar.wasm
ksana-cli deploy --key alice.key --code $WASM --fee-token 1 --wait > deploy.json
JAR=$(contract_id $ACCOUNT $(jq -r .nonce deploy.json) $WASM)
```

留下 1 KSA 小费和一句留言，读出总额，再把其中一半取回你自己的账户。`--args` 接受十六进制的 Borsh 字节，`--fund` 以最小单位附带 KSA：

```sh
ksana-cli call --key alice.key --contract $JAR --method tip --args $(enc_string "gm") \
  --fund 100000000 --fee-token 1 --wait
ksana-cli query --contract $JAR --method total
ksana-cli call --key alice.key --contract $JAR --method withdraw \
  --args $ACCOUNT$(enc_u128 50000000) --fee-token 1 --wait
```

`query` 运行一个方法，但不发送操作，所以既不花费什么，也不改变什么。在网页应用或脚本里，请改用 [TypeScript SDK](/docs/sdk/)。

`ksana-cli` 默认的 `--max-gas` 是 1,000,000。一次部署花费 100,000 gas，加上代码每字节 20，再加上它的 `init`；教程里 28,720 字节的代币合约用了 776,169 gas。一次调用花费 20,000，加上合约代码每字节 1，再加上每个附带资产 10,000，以及方法本身用掉的 gas。

## 调用其他合约

合约用 `sdk::call` 调用另一个合约，它返回被调用方 `Ok` 里的字节。被调用方的任何失败都会让整笔操作失败：

```rust
/// 读取 `account` 在某个合约里的余额，这个合约采用示例代币合约的接口。
pub fn token_balance(token: &[u8; 32], account: &[u8; 32]) -> Result<u128, Vec<u8>> {
    sdk::decode(&sdk::call(token, "balance_of", account))
}
```

`sdk::call_with_funds` 从发起调用的合约自己的余额里附带资产。按资产 ID 升序列出，最多 16 项：

```rust
/// 把本合约数额为 `amount` 的 KSA 拿到示例 amm 的一个资金池里兑换；返回换到的数额。
pub fn swap_ksa(pool: &[u8; 32], amount: u128, min_out: u128) -> Result<u128, Vec<u8>> {
    let args = sdk::encode(&(KSA_ASSET_ID, amount, min_out));
    let funds = [sdk::Funds {
        asset: KSA_ASSET_ID,
        amount,
    }];
    sdk::decode(&sdk::call_with_funds(pool, "swap", &args, &funds))
}
```

`sdk::try_call` 则会捕获被调用方的失败：只有被调用方的改动回滚，调用者拿到 `CallError::Revert(reason)` 或 `CallError::Failed` 后继续执行。如果别处的失败不能撤销你自己的工作，就用它：

```rust
/// 把本合约持有的一种代币转 `amount` 给 `to`；遭到拒绝时报告出来，而不是失败。
pub fn try_pay(token: &[u8; 32], to: &[u8; 32], amount: u128) -> CallResult {
    match sdk::try_call(token, "transfer", &sdk::encode(&(to, amount))) {
        Ok(_) => sdk::ok(&true),
        Err(sdk::CallError::Revert(reason)) => {
            sdk::emit(&("payment_refused", reason));
            sdk::ok(&false)
        }
        Err(sdk::CallError::Failed) => sdk::ok(&false),
    }
}
```

`try_call_with` 还能附带资产，并给被调用方设一个 gas 上限。`delegate_call` 在你自己的上下文中（你的存储、你的余额、你的调用者）运行另一个合约的代码，用于代理模式，且只配合你信任的代码使用。调用最多嵌套 8 层，操作自身的调用算第一层；合约可以被重入。

## 创建合约

合约可以用链上已有的代码创建另一个合约，这些代码是某个账户在更早的一次部署中存下的。新合约的 ID 是创建方合约的 ID、一个 32 字节的盐值和代码哈希三者的 SHA-256，所以事先就能知道：

```rust
/// 用链上已有的代码创建合约；盐值让每组 `init_args` 只对应一个合约。
pub fn create(code_hash: &[u8; 32], init_args: &[u8]) -> [u8; 32] {
    let salt = sdk::sha256(init_args);
    sdk::create_contract(code_hash, &salt, init_args, &[])
}

/// `create` 用这些参数会得到的 ID，在合约存在之前就能知道。
pub fn created_id(code_hash: &[u8; 32], init_args: &[u8]) -> [u8; 32] {
    sdk::created_contract_id(&sdk::self_id(), &sdk::sha256(init_args), code_hash)
}
```

新合约的 `init` 立即运行，调用者是创建它的合约。代码不在链上、ID 已被占用（同一个盐值用了两次），或者 `init` 失败时，`create_contract` 会 trap。示例 `amm-factory` 就是这样为每一对资产创建一个资金池的。

## 限制

| 限制 | 取值 |
| --- | --- |
| 存储的键 / 值 | 256 / 65,536 字节 |
| 事件 | 16,384 字节 |
| 调用的输入 / 返回值 | 各 65,536 字节 |
| 一次调用附带的资产 | 16 |
| 嵌套调用 | 8 层 |
| 一笔操作内的实例数 / 内存 | 64 / 256 MiB |
| 单个实例的内存 | 16 MiB |
| 单个实例的栈 | 262,144 字节，按节点的估算 |
| 操作大小，含代码 | 65,536 字节 |
| 一笔操作的 gas | `max_gas`，最多 100,000,000；路径 C 操作为 1,000,000 |

这些限制在 devnet、signet 和主网上都一样。[宿主函数与 gas](/docs/host-functions/) 列出了每一项 gas 开销，[合约中的比特币](/docs/bitcoin-in-contracts/)讲解合约怎样读取比特币。

想用 AI 助手写合约，先把[写给 AI 助手的资料]({{origin}}/llms-contracts.txt)交给它：本页和 SDK 的全部内容、gas、各项限制和完整的合约都在这一个文件里，Playground 的 [AI 助手]({{playground}}?lang=zh-CN#/ai)页面可以一键复制。
