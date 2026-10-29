---
title: Write a contract
lede: Ksana contracts are Rust compiled to WebAssembly. Build a small one from an empty directory, test it on your machine, then deploy and call it on the public signet.
description: How to write, test, build and deploy a Ksana smart contract in Rust with ksana-contract-sdk, from Cargo.toml to calling other contracts.
---

A contract is a WebAssembly module with its own storage and its own balances. An op deploys it; ops and other contracts call its methods. Every node and every indexer runs each call the same way, so the results are part of the chain’s state root.

This page builds a tip jar: anyone can leave a note with KSA attached, and the owner can withdraw the tips. To start in the browser instead, [Your first contract](/docs/first-contract/) writes a poll in the playground with nothing to install. [The contract SDK](/docs/contract-sdk/) lists every function this page uses, and the [example contracts](/docs/example-contracts/) are larger, tested models to read next.

## How contracts work {#model}

- **Language and target.** You write the contract in Rust, against `ksana-contract-sdk` from the repository, and compile it to `wasm32-unknown-unknown`. On that target the crate is `no_std`: the SDK supplies the allocator and the panic handler.
- **One call, one instance.** Each call runs in a fresh instance, so memory does not survive between calls. Data that must persist goes into the contract’s storage, a key-value store that only the contract itself can write.
- **Methods.** The node passes a method name and argument bytes. The contract returns `Ok(bytes)`, or `Err(reason)` to revert.
- **All or nothing.** A revert, a trap or running out of gas, at any level of nested calls, fails the whole op: every change is rolled back, and only the fee and the nonce increment remain. The one exception is `try_call`, below.
- **Determinism.** The host functions are a contract’s only view of the world: there is no clock but the block’s timestamp and no source of randomness. Floating point is rejected at deployment, gas is counted exactly, and the stack is metered by a fixed estimate, so every machine gets the same result.

### Checks at deployment

The node checks the module when the deploy op executes: a module that fails makes the op fail with `deployment rejected: <reason>`, and the op’s fee and nonce are spent all the same. The module must:

- use WebAssembly 1.0 plus mutable globals, sign extension, bulk memory, multi-value and `funcref` tables, and no floating point, SIMD, threads or other proposals;
- define exactly one memory of at most 256 pages (16 MiB) at the start, and at most one table of at most 4,096 entries;
- import functions only from the module `ksana` (the [host functions](/docs/host-functions/)), and export `memory`, `ksana_alloc` and `ksana_call`.

Rust 1.98.1 with the SDK produces such a module without extra flags. The [ABI]({{repo}}/blob/main/docs/ABI.md) is the full specification.

## Set up a project

You need Rust 1.98.1 or later with the `wasm32-unknown-unknown` target, and a clone of the repository: the SDK is not published on crates.io. Put your project next to the clone, not inside it, so that Cargo does not take it for a member of the repository’s workspace:

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

`cdylib` is the WebAssembly module, and `rlib` lets your native tests link the contract. The release profile keeps the module small: the deployment fee, the deployment gas and the gas of every call grow with its size.

## Write the contract

```rust title="src/lib.rs"
//! A tip jar: anyone leaves a note with KSA attached, and the owner withdraws the tips.
#![cfg_attr(target_arch = "wasm32", no_std)]
extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;
use ksana_contract_sdk::{self as sdk, storage, CallResult, KSA_ASSET_ID};

sdk::entry!(dispatch);

const OWNER: &[u8] = b"owner";
const TOTAL: &[u8] = b"total";

/// Routes a call to its method. Deployment always calls `init`.
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

/// `init()`: the deployer becomes the owner.
fn init(args: &[u8]) -> CallResult {
    sdk::decode::<()>(args)?;
    if !sdk::call_funds().is_empty() {
        return sdk::revert("init takes no funds");
    }
    storage::write(OWNER, &sdk::caller());
    sdk::ok(&())
}

/// `tip(note: String) -> u128`: keeps the KSA attached to the call; returns the new total.
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

/// `withdraw(to: [u8; 32], amount: u128)`: the owner sends tips out of the jar.
fn withdraw(args: &[u8]) -> CallResult {
    let (to, amount): ([u8; 32], u128) = sdk::decode(args)?;
    let owner: [u8; 32] = storage::read(OWNER)?.ok_or(b"not initialized".to_vec())?;
    if sdk::caller() != owner {
        return sdk::revert("only the owner can withdraw");
    }
    // asset_transfer traps on a short balance; check first to revert with a reason
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

### Entry point and dispatch

`sdk::entry!(dispatch)` generates the two exports the node calls, `ksana_alloc` and `ksana_call`. It decodes the method name and the argument bytes and hands them to your `dispatch` function, which returns a `CallResult`, that is `Result<Vec<u8>, Vec<u8>>`.

Deployment always calls `init`, so every contract handles it, even with no arguments: an `unknown method` revert there fails the deployment. After deployment, any call to `init` fails.

### Arguments and return values

Arguments and return values are plain bytes. The convention, used by every example and by `ksana-cli`, is Borsh: the arguments of a method are a tuple encoded back to back, a single argument is encoded as itself, and no arguments is empty bytes.

- `sdk::decode::<T>(args)` decodes and requires every byte to be used. On bad input it returns `Err(b"malformed arguments")`, so `?` turns it into a revert. It handles integers, `bool`, `[u8; N]`, `Vec<T>`, `String`, `Option`, `Result`, `()` and tuples of up to 8 elements; decode your own structs field by field.
- `sdk::ok(&value)` encodes a return value, and `sdk::revert("reason")` reverts with a message.

### Storage

`storage::read` and `storage::write` keep Borsh values under byte keys; `storage::get`, `set` and `remove` work on raw bytes. A key can be up to 256 bytes and a value up to 65,536 bytes. A write is visible at once to every level of the same op.

Writes cost far more gas than reads (10,000 plus 10 per byte, against 2,000 plus 1 per byte), so store what you need and no more. The examples delete a key when its value drops to zero.

### Callers and attached funds

`sdk::caller()` is the account that signed the op when an op calls the contract, or the calling contract’s ID when another contract calls it. `init` sees the deployer, which is how the tip jar learns its owner.

An op or a contract can attach built-in assets, such as KSA, to a call. The node moves them to the contract before the contract runs, and `sdk::call_funds()` lists them. Funds that a contract does not account for stay in its balance for good, so check what arrives, as `tip` and `init` do.

The contract’s own balance works like an account’s: `sdk::asset_balance` reads it and `sdk::asset_transfer` pays out of it. A transfer the balance cannot cover traps: the contract cannot catch it, and the op fails with the bare error `insufficient balance`. So `withdraw` checks first and reverts with its own message.

### Events

`sdk::emit(&value)` records an event in the op’s receipt. By convention, an event is a Borsh tuple whose first element is its name, such as `("tip", caller, amount, note)`. Events are not part of the state, cost 1,000 gas plus 5 per byte, hold at most 16,384 bytes, and disappear when the op fails.

## Test it natively

On your own machine, the SDK replaces the host functions with an in-memory mock, so ordinary `cargo test` runs the contract without a node:

```rust title="tests/tip_jar.rs"
#![cfg(not(target_arch = "wasm32"))]

use ksana_contract_sdk::mock::{self, Failure};
use ksana_contract_sdk::{encode, Funds, KSA_ASSET_ID};

const OWNER: [u8; 32] = [1; 32];
const FAN: [u8; 32] = [2; 32];

/// Deploys a fresh jar and gives FAN 1,000 base units of KSA.
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

The mock follows the ABI: a failure at any level rolls back the whole op, and the limits, the call depth and the funds rules apply. It differs from a node in three ways that matter in tests:

- KSA does not exist until you call `mock::register_asset` and `mock::mint`.
- There is no gas metering, so a test cannot tell you what a call costs.
- The `code` you pass to `mock::deploy` is a label, not your module, so contract IDs in tests differ from those on chain.

## Build the module

Build the release module as a `cdylib` alone:

```sh
cargo rustc --release --target wasm32-unknown-unknown --crate-type cdylib
wc -c target/wasm32-unknown-unknown/release/tip_jar.wasm
```

```output
9081 target/wasm32-unknown-unknown/release/tip_jar.wasm
```

`cargo build` also produces the `rlib`, and the module it leaves behind is larger, because link-time optimization cannot drop as much. The module’s bytes depend on the absolute path of your SDK checkout, so build the file you deploy once and compute its ID from that file.

::: details The lints the example contracts use
The repository’s contracts deny the constructs that panic or overflow. Add the same table to your `Cargo.toml` and run `cargo clippy -- -D warnings`, natively and with `--target wasm32-unknown-unknown`; the tip jar passes both.

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

Tests usually allow `unwrap_used` and `panic` again at the top of each test file.
:::

## Deploy and call it

To try a contract from the browser, the [contract playground](/docs/playground/) deploys modules on the signet and calls them through forms that follow the [ABI block](/docs/playground/#the-abi-block) of their source, signed in your wallet. Its examples can also be edited and compiled there.

Deploy with [ksana-cli](/docs/cli/) on the public signet. These commands use the `contract_id`, `enc_string` and `enc_u128` shell functions of the [token and pool tutorial](/docs/token-and-pool/#load-the-helpers), which runs the same commands, with real output, on three example contracts.

The tip jar’s `init` takes no arguments, so the deployment has no `--init-args`. The output gives the op’s `account`, `nonce` and status, but not the new contract’s ID: you compute it from the deploying account, the deploy op’s nonce and the SHA-256 of the module.

```sh
export KSANA_RPC={{signet.rpc}}
ACCOUNT=$(ksana-cli --chain signet key alice.key | jq -r .account)
WASM=target/wasm32-unknown-unknown/release/tip_jar.wasm
ksana-cli deploy --key alice.key --code $WASM --fee-token 1 --wait > deploy.json
JAR=$(contract_id $ACCOUNT $(jq -r .nonce deploy.json) $WASM)
```

Leave a tip of 1 KSA with a note, read the total, then withdraw half of it to your own account. `--args` takes the Borsh bytes in hex, and `--fund` attaches KSA in base units:

```sh
ksana-cli call --key alice.key --contract $JAR --method tip --args $(enc_string "gm") \
  --fund 100000000 --fee-token 1 --wait
ksana-cli query --contract $JAR --method total
ksana-cli call --key alice.key --contract $JAR --method withdraw \
  --args $ACCOUNT$(enc_u128 50000000) --fee-token 1 --wait
```

`query` runs a method without sending an op, so it costs nothing and changes nothing. From a web app or a script, use the [TypeScript SDK](/docs/sdk/) instead.

The default `--max-gas` of `ksana-cli` is 1,000,000. A deployment costs 100,000 gas plus 20 per byte of code, plus its `init`; the 28,720-byte token of the tutorial used 776,169 gas. A call costs 20,000 plus 1 per byte of the contract’s code, plus 10,000 per attached asset, plus what the method uses.

## Call other contracts

A contract calls another with `sdk::call`, which returns the bytes inside the callee’s `Ok`. Any failure of the callee fails the whole op:

```rust
/// Reads `account`'s balance in a contract with the token example's interface.
pub fn token_balance(token: &[u8; 32], account: &[u8; 32]) -> Result<u128, Vec<u8>> {
    sdk::decode(&sdk::call(token, "balance_of", account))
}
```

`sdk::call_with_funds` attaches assets from the calling contract’s own balance. List them in ascending order of asset ID, at most 16:

```rust
/// Swaps `amount` of this contract's KSA in a pool of the amm example; returns what it got.
pub fn swap_ksa(pool: &[u8; 32], amount: u128, min_out: u128) -> Result<u128, Vec<u8>> {
    let args = sdk::encode(&(KSA_ASSET_ID, amount, min_out));
    let funds = [sdk::Funds {
        asset: KSA_ASSET_ID,
        amount,
    }];
    sdk::decode(&sdk::call_with_funds(pool, "swap", &args, &funds))
}
```

`sdk::try_call` catches the callee’s failure instead: only the callee’s changes roll back, and the caller continues with `CallError::Revert(reason)` or `CallError::Failed`. Use it where a failure elsewhere must not undo your own work:

```rust
/// Sends `amount` of a token this contract holds to `to`; reports a refusal instead of failing.
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

`try_call_with` adds funds and a gas limit for the callee. `delegate_call` runs another contract’s code inside your own context (your storage, your balances, your caller), for proxy patterns with code you trust. Calls can nest 8 levels deep, counting the op’s own call as the first, and a contract can be re-entered.

## Create contracts

A contract can create another from code that is already on chain, that is, code some account stored with an earlier deployment. The new contract’s ID is the SHA-256 of the creating contract’s ID, a 32-byte salt and the code hash, so it is known in advance:

```rust
/// Creates a contract from code already on chain; the salt makes one contract per `init_args`.
pub fn create(code_hash: &[u8; 32], init_args: &[u8]) -> [u8; 32] {
    let salt = sdk::sha256(init_args);
    sdk::create_contract(code_hash, &salt, init_args, &[])
}

/// The ID that `create` gives for these arguments, known before the contract exists.
pub fn created_id(code_hash: &[u8; 32], init_args: &[u8]) -> [u8; 32] {
    sdk::created_contract_id(&sdk::self_id(), &sdk::sha256(init_args), code_hash)
}
```

The new contract’s `init` runs at once, with the creating contract as its caller. `create_contract` traps when the code is not on chain, when the ID is taken (the same salt twice), or when `init` fails. The `amm-factory` example creates one pool per pair of assets this way.

## Limits

| Limit | Value |
| --- | --- |
| Storage key / value | 256 / 65,536 bytes |
| Event | 16,384 bytes |
| Call input / return value | 65,536 bytes each |
| Assets attached to one call | 16 |
| Nested calls | 8 levels |
| Instances / memory in one op | 64 / 256 MiB |
| Memory of one instance | 16 MiB |
| Stack of one instance | 262,144 bytes, by the node’s estimate |
| Op size, code included | 65,536 bytes |
| Gas of one op | `max_gas`, at most 100,000,000; 1,000,000 for a path C op |

These limits are the same on devnet, the signet and mainnet. [Host functions and gas](/docs/host-functions/) lists the gas of every operation, and [Bitcoin in contracts](/docs/bitcoin-in-contracts/) shows how a contract reads Bitcoin.

To write contracts with an AI assistant, give it the [reference for AI assistants]({{origin}}/llms-contracts.txt) first: everything on this page and the SDK’s, gas, limits and complete contracts in one file, which the playground’s [AI assistants]({{playground}}#/ai) page copies in one click.
