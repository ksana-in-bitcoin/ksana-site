---
title: 你的第一个合约
nav: 第一个合约
lede: 用 Rust 写一个投票合约，用合约 Playground 在浏览器里编译并部署到公开 signet，再用你的钱包投票。
description: 一步一步写出第一个 Ksana 智能合约：用 Rust 写一个投票合约，在 signet 上的合约 Playground 中编译、部署，用钱包调用，在本机测试，再请 AI 助手修改它。
---

本教程写一个投票合约。部署它的账户提出一个问题，带 2 到 8 个选项；投票开放期间，每个账户投一票；最后由创建者结束投票。编写、编译、部署都在[合约 Playground]({{playground}}?lang=zh-CN) 里完成，什么都不用安装：每笔操作都在你自己的钱包里签名，手续费用测试 KSA 支付。

这个投票合约就是[仓库]({{repo}})里的 `contracts/examples/poll`，测试也在那里。[编写合约](/docs/contracts/)在你自己的机器上用 `cargo` 和 [ksana-cli](/docs/cli/) 走一遍同样的步骤。

## 开始之前 {#before}

- 一个钱包：Unisat、OneKey 或 Xverse，使用比特币 signet 上的 Taproot（`tb1p…`）账户，和[signet 钱包](/docs/wallet/#connect)的要求一样。Playground 只请钱包签名，从不接触你的私钥。
- 测试 KSA：Playground 的**领取测试 KSA**会向水龙头领取 100 KSA，每个账户每天一次，足够部署和调用很多次。

## 合约

下面是仓库里的原文件，代码和注释都是英文：

```rust title="src/lib.rs" from="contracts/examples/poll/src/lib.rs"
//! Tutorial contract: a poll. The account that deploys it asks a question with 2 to 8 options; every account votes
//! once while the poll is open, and the creator closes it. It takes no funds.
//!
//! The contract of the docs' tutorial "Your first contract", which builds it in the playground in place of the
//! counter's source, so it needs nothing but the contract SDK. It keeps its state under a few storage keys and one key
//! per voter, refuses with a reason what it does not allow, knows its creator and its voters by `caller()`, and emits
//! an event for every change.
//!
//! Arguments and return values are Borsh-encoded; the options are numbered from 0 in the order `init` takes them.
//!
//! ```abi
//! init(question: String, options: Vec<String>)   // a question of 1 to 200 bytes; 2 to 8 options of 1 to 64 bytes
//! call vote(option: u32) -> u64                   // one vote per account while the poll is open; returns the option's votes
//! call close()                                    // the creator only: ends the voting for good
//! view poll() -> (String, Vec<String>, bool)      // the question, the options, whether voting is open
//! view results() -> Vec<u64>                      // the votes for each option, in order
//! view voted(account: Account) -> Option<u32>     // the option the account voted for; None before it votes
//! event voted(voter: Account, option: u32)
//! event closed(total: u64)
//! ```
#![cfg_attr(target_arch = "wasm32", no_std)]

extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;

use ksana_contract_sdk::{self as sdk, storage, CallResult, Decode};

sdk::entry!(dispatch);

/// The longest question, in bytes.
pub const MAX_QUESTION: usize = 200;
/// The longest option, in bytes.
pub const MAX_OPTION: usize = 64;
/// The most options a poll has; it has at least 2.
pub const MAX_OPTIONS: usize = 8;

const KEY_QUESTION: &[u8] = b"question";
const KEY_OPTIONS: &[u8] = b"options";
const KEY_CREATOR: &[u8] = b"creator";
const KEY_OPEN: &[u8] = b"open";
const KEY_TALLY: &[u8] = b"tally";
/// Followed by a voter's account: the option it voted for.
const PREFIX_VOTE: &[u8] = b"vote:";

/// Dispatches the poll's methods; storage belongs to this contract instance.
pub fn dispatch(method: &str, args: &[u8]) -> CallResult {
    if !sdk::call_funds().is_empty() {
        return sdk::revert("unexpected attached funds");
    }
    match method {
        "init" => {
            let (question, options): (String, Vec<String>) = sdk::decode(args)?;
            init(question, options)
        }
        "vote" => vote(sdk::decode(args)?),
        "close" => {
            sdk::decode::<()>(args)?;
            close()
        }
        "poll" => {
            sdk::decode::<()>(args)?;
            let question: String = load(KEY_QUESTION)?;
            let options: Vec<String> = load(KEY_OPTIONS)?;
            let open: bool = load(KEY_OPEN)?;
            sdk::ok(&(question, options, open))
        }
        "results" => {
            sdk::decode::<()>(args)?;
            sdk::ok(&load::<Vec<u64>>(KEY_TALLY)?)
        }
        "voted" => {
            let account: [u8; 32] = sdk::decode(args)?;
            sdk::ok(&storage::read::<u32>(&vote_key(&account))?)
        }
        _ => sdk::revert("unknown method"),
    }
}

/// Keeps the question and the options and opens the poll with no votes; the deploying account is its creator.
fn init(question: String, options: Vec<String>) -> CallResult {
    if question.is_empty() || question.len() > MAX_QUESTION {
        return sdk::revert("the question must be 1 to 200 bytes");
    }
    if options.len() < 2 || options.len() > MAX_OPTIONS {
        return sdk::revert("a poll has 2 to 8 options");
    }
    if options.iter().any(|o| o.is_empty() || o.len() > MAX_OPTION) {
        return sdk::revert("an option must be 1 to 64 bytes");
    }
    storage::write(KEY_TALLY, &alloc::vec![0u64; options.len()]);
    storage::write(KEY_QUESTION, &question);
    storage::write(KEY_OPTIONS, &options);
    storage::write(KEY_CREATOR, &sdk::caller());
    storage::write(KEY_OPEN, &true);
    sdk::ok(&())
}

/// Counts the caller's vote for `option`, once per account while the poll is open.
fn vote(option: u32) -> CallResult {
    if !load::<bool>(KEY_OPEN)? {
        return sdk::revert("voting is closed");
    }
    let voter = sdk::caller();
    let key = vote_key(&voter);
    if storage::get(&key).is_some() {
        return sdk::revert("already voted");
    }
    let mut tally: Vec<u64> = load(KEY_TALLY)?;
    let Some(count) = usize::try_from(option).ok().and_then(|i| tally.get_mut(i)) else {
        return sdk::revert("unknown option");
    };
    let Some(votes) = count.checked_add(1) else {
        return sdk::revert("too many votes");
    };
    *count = votes;
    storage::write(KEY_TALLY, &tally);
    storage::write(&key, &option);
    sdk::emit(&("voted", voter, option));
    sdk::ok(&votes)
}

/// Ends the voting; only the creator may, once.
fn close() -> CallResult {
    if load::<[u8; 32]>(KEY_CREATOR)? != sdk::caller() {
        return sdk::revert("only the creator");
    }
    if !load::<bool>(KEY_OPEN)? {
        return sdk::revert("voting is closed");
    }
    let tally: Vec<u64> = load(KEY_TALLY)?;
    let Some(total) = tally.iter().try_fold(0u64, |sum, n| sum.checked_add(*n)) else {
        return sdk::revert("too many votes");
    };
    storage::write(KEY_OPEN, &false);
    sdk::emit(&("closed", total));
    sdk::ok(&())
}

/// Reads a value `init` stored.
fn load<T: Decode>(key: &[u8]) -> Result<T, Vec<u8>> {
    storage::read(key)?.ok_or_else(|| b"not initialized".to_vec())
}

/// The storage key of `account`'s vote.
fn vote_key(account: &[u8; 32]) -> Vec<u8> {
    [PREFIX_VOTE, account.as_slice()].concat()
}
```

## 它怎样工作

### ABI 块

文件开头 `//!` 注释里标记为 `abi` 的代码块，向 Playground 描述这个合约。`init` 在部署时接收问题和选项；每个 `call` 是一笔要你签名的操作；每个 `view` 只读取，不用签名，也不付手续费；`event` 是合约记录下来的事件。Playground 按这个块为每个方法生成表单，也用它解码返回值和事件。[ABI 块](/docs/playground/#the-abi-block)列出了它支持的类型。

### 分派

`sdk::entry!(dispatch)` 让 `dispatch` 成为合约的入口：每次调用的方法名和 Borsh 编码的参数都交给它，它返回 `sdk::ok(&value)`，或者 revert。投票合约先拒绝附带的资产，因为它不需要的 KSA 一旦附在调用上，就会永远留在合约里；然后按方法名分派。`sdk::decode` 读取参数，参数对不上时，这次调用以 `malformed arguments` 失败。

### 存储

调用一返回，它的内存就没了：每次调用都在全新的实例里运行。要长久保留的东西写进存储，这是一个只有本合约能写的键值存储。投票合约把问题、选项、创建者、投票是否开放和计票结果各存在一个键下，每个投票者的选择存在 `vote:` 加上投票者账户的键下。`vote` 正是靠这个键拒绝重复投票，`voted` 读的也是它。

### 检查与 revert

每个方法都先检查、后写入，不允许的事就带着原因拒绝：`init` 检查长度，`vote` 检查投票还开放、这个账户还没投过、选项存在，`close` 检查调用者是创建者。revert 会撤销这笔操作做过的一切，它的原因就是钱包和 Playground 显示给你的内容。投票合约也从不 panic：用 `get_mut` 而不是下标，用 `checked_add` 而不是 `+`，因为 panic 会让操作失败，却不留下任何人看得懂的原因。

### 调用者与事件

`sdk::caller()` 是签名这笔操作的账户，所以 `init` 把部署者记为创建者，`vote` 也知道是谁投的票。`sdk::emit` 在操作的回执里记录一个事件：`voted` 带着投票者和选项，`closed` 带着总票数。

## 编译 {#compile}

::: steps

### 打开计数器的“代码”页

Playground 把一份源码当作某个示例的 `src/lib.rs` 来编译。投票合约只需要合约 SDK，所以和计数器一样编译：打开[计数器页的“代码”页]({{playground}}?lang=zh-CN#/counter/code)，连接你的钱包。

### 粘贴投票合约

在编辑器里全选源码，把投票合约粘贴进去覆盖它。页面会把你的修改保存在这个浏览器里，**恢复示例源码**可以换回计数器。

### 编译

按**编译**。构建要几秒钟，按钮下面那一行数出你的 ABI 块声明了什么：`ABI：6 个方法，2 个事件`，`init` 也算在内。

:::

出错时，编译器的报错会出现在对应的行上，编辑器旁边也有一份列表。想看看报错的样子，可以删掉 `"vote"` 分支里 `sdk::decode(args)` 后面的 `?`，再编译一次：

```output
error[E0308]: mismatched types
  --> src/lib.rs:57:24
   |
57 |         "vote" => vote(sdk::decode(args)),
   |                   ---- ^^^^^^^^^^^^^^^^^ expected `u32`, found `Result<_, Vec<u8>>`
```

编译器自己就给出了修正：把 `?` 加回去，它会把解码不了的参数变成一次 revert。

## 部署 {#deploy}

按**部署这个版本**。对话框按 ABI 块生成表单，请你填写 `init` 的参数：输入一个问题，比如 `Which fruit?`，再添加两个或更多选项。核对这笔操作，在钱包里签名。页面会显示新合约的 ID，在区块收录这次部署之前，它是预测值。

现在，投票合约就是 signet 上一个独立的合约了。计数器页的**应用**页是为计数器做的，它会提示可能与你的合约不符，所以请用**方法**页，那里的表单按你的 ABI 块生成。

## 使用 {#use}

::: steps

### 投票

在**方法**页展开 `vote`，填入选项 `1`，按**核对**，在钱包里签名。区块收录之后，结果是 `1`，也就是这个选项目前的票数，下面还有 `voted` 事件。

### 再投一次试试

在 `vote` 上按**只读试运行**。它在最新状态上运行这笔操作，不签名，也不发送，结果显示它会以 `already voted` 失败。每次签名之前的核对也会做同样的检查，因为失败的操作照样要付手续费。

### 查看结果

`results`、`poll` 和 `voted` 都是 view：按**读取**就以只读方式运行，不用签名，也不付手续费。`results` 给出每个选项的票数，用你的账户调用 `voted` 会得到你选的选项。

### 结束投票

用同样的方式发送 `close`。从此 `vote` 会以 `voting is closed` 失败，`poll` 也显示投票已结束。用创建者以外的账户调用，`close` 会以 `only the creator` 失败。

:::

**记录**页列出这个浏览器发出的操作和它们的回执。别人也可以投票：在 Playground 首页用**任意合约**按 ID 打开这个投票合约，把它的源码或只把 ABI 块贴进去，就有了表单。

## 在本机测试 {#test}

仓库把投票合约构建为 `contracts/examples/poll`，并在 SDK 的模拟宿主上做原生测试，不需要节点就能运行合约。下面的测试部署投票合约，以不同账户调用它，检查它返回什么、拒绝什么、发出什么事件：

```rust title="tests/one_vote.rs" from="contracts/examples/poll/tests/one_vote.rs"
//! A native test of the poll on the contract SDK's mock host.
#![cfg(not(target_arch = "wasm32"))]
#![allow(missing_docs, clippy::unwrap_used)]

use ksana_contract_sdk::mock::{self, Failure};
use ksana_contract_sdk::{decode, encode};

#[test]
fn every_account_votes_once() {
    mock::reset();
    let creator = [1; 32];
    let init = encode(&(
        "Which fruit?",
        vec!["apple".to_string(), "pear".to_string()],
    ));
    let contract = mock::deploy(creator, 0, b"poll", poll::dispatch, &init).unwrap();

    let votes: u64 =
        decode(&mock::call([2; 32], contract, "vote", &encode(&1u32)).unwrap()).unwrap();
    assert_eq!(votes, 1);
    assert_eq!(
        mock::call([2; 32], contract, "vote", &encode(&0u32)),
        Err(Failure::Revert {
            contract,
            reason: b"already voted".to_vec()
        })
    );
    let results: Vec<u64> =
        decode(&mock::call([9; 32], contract, "results", &[]).unwrap()).unwrap();
    assert_eq!(results, vec![0, 1]);
    assert_eq!(mock::events().len(), 1);
}
```

在仓库的克隆里，用 Rust 1.98.1 运行投票合约的测试：

```sh
git clone {{repo}}
cd Ksana/contracts
cargo test -p poll
```

[编写合约](/docs/contracts/#test-it-natively)讲解了模拟宿主，[合约 SDK](/docs/contract-sdk/#mock) 列出了它的全部函数。

## 用 AI 助手 {#ai}

AI 助手只要了解 Ksana，就能很好地编写和修改这样的合约。Playground 的 [AI 助手]({{playground}}?lang=zh-CN#/ai)页面可以一键复制一份为它们写的资料，同样的内容也发布在 [{{origin}}/llms-contracts.txt]({{origin}}/llms-contracts.txt)；“代码”页的**复制给 AI 助手**会把这份资料连同你的合约和编译器最近一次的输出一起复制。把它粘贴给 ChatGPT、Claude 或其他助手，然后提出要求，比如：

```text
修改这个投票合约：投票在 init 指定的区块高度自动结束，并且在第一张票之前，创建者可以添加选项。
```

把它的回答粘贴到“代码”页，编译，再作为新合约部署。

## 接下来

::: cards
- [编写合约](/docs/contracts/) 在你自己的机器上，用 cargo 和 ksana-cli 走一遍同样的步骤。
- [合约 SDK](/docs/contract-sdk/) 合约用到的每个函数、类型和常量。
- [宿主函数与 gas](/docs/host-functions/) 每次调用的开销，以及各项限制。
- [示例合约](/docs/example-contracts/) 代币、AMM、借贷、多签钱包等，每个都经过测试。
:::
