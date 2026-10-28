---
title: Your first contract
nav: Your first contract
lede: Write a poll in Rust, compile it and deploy it on the public signet, all in the browser with the contract playground, then vote on it from your wallet.
description: A first Ksana smart contract, step by step: a poll in Rust, compiled and deployed in the contract playground on the signet, called from a wallet, tested natively, and changed with an AI assistant.
---

This tutorial writes a poll. The account that deploys it asks a question with 2 to 8 options, every account votes once while the poll is open, and the creator closes it. You write, compile and deploy it in the [contract playground]({{playground}}), with nothing to install: every operation is signed in your own wallet and pays its fee in test KSA.

The poll is `contracts/examples/poll` in the [repository]({{repo}}), with its tests. [Write a contract](/docs/contracts/) goes through the same steps on your own machine, with `cargo` and [ksana-cli](/docs/cli/).

## Before you start {#before}

- A wallet: Unisat, OneKey or Xverse, with a Taproot (`tb1p…`) account on Bitcoin signet, as for [the signet wallet](/docs/wallet/#connect). The playground asks it for signatures only and never sees your keys.
- Test KSA: the playground’s **Get test KSA** asks the faucet for 100 KSA, once a day for each account, enough for many deployments and calls.

## The contract

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

## How it works

### The ABI block

The block marked `abi` in the `//!` comment at the top describes the poll to the playground. `init` takes the question and the options at deployment; each `call` is an operation you sign; each `view` only reads, so it needs no signature and no fee; and the events are what the poll records. The playground builds a form for every method from this block and decodes results and events with it. [The ABI block](/docs/playground/#the-abi-block) lists its types.

### Dispatch

`sdk::entry!(dispatch)` makes `dispatch` the contract’s entry point: it gets each call’s method name and its arguments, encoded with Borsh, and returns `sdk::ok(&value)` or a revert. The poll first refuses attached funds, since KSA attached to a call it does not expect would stay in the contract for good, and then matches the method’s name. `sdk::decode` reads the arguments and fails the call with `malformed arguments` when they do not fit.

### Storage

A call’s memory is gone when it returns: each call runs in a fresh instance. What lasts goes into storage, a key-value store only this contract can write. The poll keeps the question, the options, the creator, whether voting is open and the tally under one key each, and each voter’s choice under `vote:` followed by the voter’s account. That key is how `vote` refuses a second vote, and what `voted` reads.

### Checks and reverts

Every method checks before it writes and refuses with a reason: `init` checks the lengths, `vote` that the poll is open, that the account has not voted and that the option exists, and `close` that the caller is the creator. A revert undoes everything the operation did, and its reason is what the wallet and the playground show. The poll never panics either: it uses `get_mut` rather than indexing and `checked_add` rather than `+`, because a panic fails the operation without a reason anyone can read.

### Callers and events

`sdk::caller()` is the account that signed the operation, so `init` records the deployer as the creator and `vote` knows who voted. `sdk::emit` records an event in the operation’s receipt: `voted` with the voter and the option, `closed` with the total number of votes.

## Compile it {#compile}

::: steps

### Open the counter’s Code tab

The playground compiles a source as the `src/lib.rs` of one of its examples. The poll needs nothing but the contract SDK, so it builds as the counter does: open the [Counter page’s Code tab]({{playground}}#/counter/code) and connect your wallet.

### Paste the poll

Select the whole source in the editor and paste the poll over it. The page keeps your edit in this browser, and **Back to the example** brings the counter back.

### Compile

Press **Compile**. The build takes a few seconds, and the line under the button counts what your ABI block declares: `ABI: 6 methods, 2 events`, counting `init`.

:::

A mistake comes back from the compiler on its line and in a list beside the editor. To see one, delete the `?` after `sdk::decode(args)` in the `"vote"` arm and compile again:

```output
error[E0308]: mismatched types
  --> src/lib.rs:57:24
   |
57 |         "vote" => vote(sdk::decode(args)),
   |                   ---- ^^^^^^^^^^^^^^^^^ expected `u32`, found `Result<_, Vec<u8>>`
```

The compiler suggests the fix itself: put the `?` back, which turns arguments that do not decode into a revert.

## Deploy it {#deploy}

Press **Deploy this build**. The dialog asks for `init`’s arguments in a form built from the ABI block: type a question, such as `Which fruit?`, and add two or more options. Review the operation and sign it in your wallet. The page shows the new contract’s ID, predicted until a block includes the deployment.

The poll is now a contract of its own on the signet. The Counter page’s **App** tab is made for the counter and says that it may not match your contract, so use the **Methods** tab, whose forms follow your ABI block.

## Use it {#use}

::: steps

### Vote

In the **Methods** tab, open `vote`, enter the option `1`, press **Review** and sign the operation in your wallet. Once a block includes it, the result is `1`, the option’s votes so far, with the `voted` event below it.

### Try to vote again

Press **Try read-only** on `vote`. It runs the operation against the latest state without signing or sending anything, and shows that it would fail with `already voted`. The review before every signature runs the same check, because a failed operation still pays its fee.

### Read the results

`results`, `poll` and `voted` are views: **Read** runs them read-only, with no signature and no fee. `results` gives the votes of each option, and `voted` with your account the option you chose.

### Close the poll

Send `close` the same way. From then on `vote` fails with `voting is closed`, and `poll` reports voting closed. From any account but the creator’s, `close` fails with `only the creator`.

:::

The **Activity** tab lists the operations this browser sent, with their receipts. Others can vote too: on the playground’s home, **Any contract** opens the poll by its ID and builds its forms from the poll’s source, or just its ABI block, pasted there.

## Test it on your machine {#test}

The repository builds the poll as `contracts/examples/poll` and tests it natively on the SDK’s mock host, which runs a contract without a node. A test deploys the poll, calls it as different accounts, and checks what it returns, what it refuses and what it emits:

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

Run the poll’s tests from a clone of the repository, with Rust 1.98.1:

```sh
git clone {{repo}}
cd Ksana/contracts
cargo test -p poll
```

[Write a contract](/docs/contracts/#test-it-natively) explains the mock host, and [The contract SDK](/docs/contract-sdk/#mock) lists its functions.

## With an AI assistant {#ai}

An AI assistant writes and changes contracts like this one well once it knows Ksana. The playground’s [AI assistants]({{playground}}#/ai) page copies a reference written for them, also published at [{{origin}}/llms-contracts.txt]({{origin}}/llms-contracts.txt), and the Code tab’s **Copy for an AI assistant** copies it together with your contract and the compiler’s last messages. Paste it into ChatGPT, Claude or another assistant, then ask, for example:

```text
Change the poll so that voting ends by itself at a block height that init takes, and let the
creator add options until the first vote.
```

Paste the answer into the Code tab, compile it, and deploy it as a new contract.

## Next

::: cards
- [Write a contract](/docs/contracts/) The same steps on your own machine, with cargo and ksana-cli.
- [The contract SDK](/docs/contract-sdk/) Every function, type and constant a contract uses.
- [Host functions and gas](/docs/host-functions/) What each call costs, and the limits.
- [Example contracts](/docs/example-contracts/) Tokens, an AMM, lending, a multisig and more, each tested.
:::
