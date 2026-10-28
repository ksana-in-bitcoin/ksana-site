---
title: Host functions and gas
nav: Host functions
lede: The interface between a contract and the node that runs it: how a call enters the module, every host function with its SDK wrapper and its gas, and the limits.
description: Reference for the Ksana contract ABI, the 31 host functions of the ksana import module, their ksana-contract-sdk wrappers, gas costs and limits.
---

A contract talks to the node only through host functions: the functions of the WebAssembly import module `ksana`. With `ksana-contract-sdk` you call them through Rust wrappers and never touch pointers; this page also gives the raw interface, for tools and for contracts written without the SDK. [The contract SDK](/docs/contract-sdk/) lists every wrapper with its Rust signature, and the rest of the SDK.

The gas costs and limits on this page are consensus rules. They are the same on devnet, the signet and mainnet, and they change only through a protocol upgrade. The [ABI]({{repo}}/blob/main/docs/ABI.md) in the repository is the full specification.

## How a call enters a contract {#abi}

Every call creates a new instance of the module, so linear memory never carries over from one call to the next. A call runs in three steps:

1. The node calls the export `ksana_alloc(len: i32) -> i32` to get a buffer, and writes the input into it: the Borsh encoding of `(method: String, args: Vec<u8>)`.
2. The node calls `ksana_call(ptr: i32, len: i32) -> i64`.
3. The returned `i64`, read as unsigned, is `(out_ptr << 32) | out_len`. It points at the Borsh encoding of `Result<Vec<u8>, Vec<u8>>`, whose tag is `0` for `Err` and `1` for `Ok`: `Ok(data)` returns `data`, and `Err(reason)` reverts.

These all fail the call: a trap (including `unreachable`, an access out of bounds and division by zero), running out of gas, output that is not a valid `Result` encoding, output longer than 65,536 bytes, and `Err`. A failure at any level fails the whole op, except under `try_call_contract`.

Host functions take pointers as `i32` offsets into the contract’s own memory, and an offset out of bounds traps. Functions that write a fixed-size result take a destination pointer `dst`. Functions that return data of variable length allocate it by calling the contract’s `ksana_alloc` and return it packed the same way, `(ptr << 32) | len`, or `-1` when there is nothing. `entry!` in the SDK generates the two exports and does this decoding for you.

## Host functions

The tables group the 31 functions by purpose. “/B” means per byte.

### Storage

| Host function | SDK | Gas | Notes |
| --- | --- | --- | --- |
| `storage_get` | `storage::get`, `storage::read` | 2,000 + 1/B of key and value | reads this contract’s storage; `None` when absent |
| `storage_set` | `storage::set`, `storage::write` | 10,000 + 10/B of key and value | keys up to 256 bytes, values up to 65,536 |
| `storage_remove` | `storage::remove` | 5,000 + 1/B of key | |

Storage is private: a contract reads and writes only its own keys. A write is visible at once to every level of the same op, re-entrant calls included.

### Context

| Host function | SDK | Gas | Notes |
| --- | --- | --- | --- |
| `caller` | `caller()` | 100 | the op’s account at the top level; the calling contract inside a call |
| `self_id` | `self_id()` | 100 | this contract’s ID |
| `block_height` | `block_height()` | 100 | height of the main-chain block executing the op |
| `block_timestamp` | `block_timestamp()` | 100 | that block’s timestamp, in seconds |
| `chain_id` | `chain_id()` | 100 | 1001 devnet, 1002 signet, 1000 mainnet |
| `gas_left` | `gas_left()` | 100 | gas left after this function’s own cost |

An op in a merged block runs with the height and timestamp of the main-chain block that merges it. The producer sets the timestamp within loose bounds, so it is not a precise clock. A read-only call (the RPC method `ksana_call`) runs as if in the next block: the tip’s height plus one, with the tip’s timestamp.

```rust
/// `env() -> (u64, u64, u32, u32)`: the block a call runs in, as the contract sees it.
pub fn env() -> CallResult {
    let height = sdk::block_height(); // the main-chain block executing the op
    let time = sdk::block_timestamp(); // seconds, set by the producer: not a precise clock
    sdk::ok(&(height, time, sdk::chain_id(), sdk::btc_anchor_height()))
}
```

### Events

| Host function | SDK | Gas | Notes |
| --- | --- | --- | --- |
| `emit_event` | `emit_event(&[u8])`, `emit(&T)` | 1,000 + 5/B | at most 16,384 bytes |

Events appear in the op’s receipt as `{ "contract", "data" }`. They are not part of the state root, and they are dropped when the op fails.

### Assets

| Host function | SDK | Gas | Notes |
| --- | --- | --- | --- |
| `asset_balance` | `asset_balance(asset, account)` | 2,000 | any account’s or contract’s balance, as a u128 |
| `asset_transfer` | `asset_transfer(asset, to, amount)` | 10,000 | pays out of this contract’s balance; traps when it is short or the asset’s rules refuse the transfer |
| `asset_issue` | `asset_issue(sub_id, meta, to, amount)` | 20,000 + 1/B of `meta` | issues this contract’s own asset; returns its ID. The first issue creates the asset with the capability to mint alone |
| `asset_create` | `asset_create(sub_id, meta, capabilities, to, amount)` | 20,000 + 1/B of `meta` | creates this contract’s own asset with the capabilities it declares, and issues `amount` to `to`; returns its ID |
| `asset_freeze` | `asset_freeze(sub_id, account, frozen)` | 10,000 | freezes or unfreezes an account for this contract’s asset |
| `asset_allow` | `asset_allow(sub_id, account, allowed)` | 10,000 | puts an account on or off this contract’s asset’s allowlist |
| `asset_pause` | `asset_pause(sub_id, paused)` | 10,000 | pauses or resumes this contract’s asset |
| `asset_renounce` | `asset_renounce(sub_id, capabilities)` | 10,000 | gives up capabilities of this contract’s asset for good |
| `asset_policy` | `asset_policy(asset)` | 2,000 | any asset’s capabilities and whether it is paused; `None` when it does not exist |
| `asset_status` | `asset_status(asset, account)` | 2,000 | an account’s status flags for an asset: `STATUS_FROZEN`, `STATUS_ALLOWED` |
| `asset_burn` | `asset_burn(asset, amount)` | 10,000 | burns from this contract’s balance, KSA included |
| `call_funds` | `call_funds()`, `received(asset)` | 100 + 1/B returned | the assets attached to the current call |

Accounts and contracts share one balance table for built-in assets: KSA (ID: 32 zero bytes, 8 decimals) and the assets contracts issue. An issued asset’s ID is `sha256(issuing contract ‖ sub_id)`, which `asset_id(issuer, sub_id)` computes. The first issue, or `asset_create`, records `meta`: a name of 1 to 64 bytes, a symbol of 1 to 16 bytes (such as `USDX`) and at most 18 decimals. Every later issue must pass the same `meta`, or it traps.

An asset’s issuing contract holds the capabilities it declared when it created the asset, and nothing else: `CAP_MINT` issues more, `CAP_FREEZE` freezes accounts, `CAP_ALLOWLIST` admits only the accounts it allows, `CAP_PAUSE` pauses the asset. `asset_create` declares any of them (0 for none, a fixed supply), and `asset_issue` creates an asset with `CAP_MINT` alone. A capability can be given up with `asset_renounce` and never gained, and the functions that manage an asset name it by this contract’s `sub_id`, so only its issuing contract manages it. KSA has no capabilities. Wallets read an asset’s capabilities with [`ksana_getAsset`](/docs/rpc/#ksana_getasset) and an account’s standing with [`ksana_getAssetStatus`](/docs/rpc/#ksana_getassetstatus).

Every movement of the asset obeys them: the transfer action, attached funds, `asset_transfer`, `asset_issue`, `asset_create` and `asset_burn`. The issuing contract is exempt.

- A frozen account can neither send, receive nor burn the asset.
- With an allowlist, only the allowed accounts send, receive or burn it.
- While the asset is paused, no account but the issuing contract sends or burns it.
- Setting a flag or pausing needs the capability; clearing a flag or resuming never does, and a flag stops counting once its capability is given up.
- No capability moves a balance: an issuer can stop an account’s asset, never take it.

A refused movement fails the op, and its message starts with `rejected:`, such as `rejected: sender is frozen for this asset` or `rejected: asset is paused`. `try_call_contract` catches a refusal of the funds it attaches as status `2`.

Attached funds move to the contract before it runs. They must be in strictly ascending order of asset ID, each above zero, at most 16 items.

### Calls

| Host function | SDK | Gas | Notes |
| --- | --- | --- | --- |
| `call_contract` | `call`, `call_with_funds` | 20,000 + 1/B of input + 1/B of callee code + 10,000 per asset | a failure of the callee fails the op |
| `try_call_contract` | `try_call`, `try_call_with` | as `call_contract` | a failure rolls back only the callee |
| `delegate_call` | `delegate_call` | as `call_contract`, no assets | runs another contract’s code in this contract’s context |
| `create_contract` | `create_contract` | 100,000 + 1/B of args + 1/B of code + 10,000 per asset | creates a contract from code on chain |

- **`try_call_contract`** returns `(status: u8, data)`: `0` with the callee’s output, `1` with its revert reason, `2` for any other failure (the SDK maps these to `Ok`, `CallError::Revert` and `CallError::Failed`). The callee gets at most `min(gas, remaining − remaining / 64)`, where a `gas` of 0 sets no separate limit. The caller’s own mistakes still fail the op: the method name `init`, an input that is too long, a malformed funds list.
- **`delegate_call`** runs the other code with this contract’s storage, balances, `self_id`, `caller` and `call_funds`. Use it only with code you trust.
- **`create_contract`** gives the new contract the ID `sha256(this contract ‖ salt ‖ code_hash)` (`created_contract_id` computes it), then runs its `init` with this contract as the caller. It traps when the code is not on chain, the ID is taken, or `init` fails.

The op’s own call counts as level 1, and calls nest at most 8 levels. `try_call_contract` and `delegate_call` take a level too. Re-entry (A calls B calls A) is allowed.

### Bitcoin

| Host function | SDK | Gas | Notes |
| --- | --- | --- | --- |
| `btc_anchor_height` | `btc_anchor_height()` | 100 | the Bitcoin height the executing block anchors to |
| `btc_header` | `btc_header(height)` | 2,000 | the 80-byte header; traps unless `height` ≤ anchor − 6 |
| `native_tx` | `native_tx()` | 2,000 + 1/B returned | the Bitcoin transaction that carried this path C op |

`native_tx` returns `None` for path B ops and for read-only calls. Every level of one op reads the same transaction, so a contract must make sure it counts a payment once. [Bitcoin in contracts](/docs/bitcoin-in-contracts/) shows how to use these three, and the SDK’s `btc` module parses headers and transactions and checks Merkle proofs inside the contract.

### Crypto

| Host function | SDK | Gas | Notes |
| --- | --- | --- | --- |
| `sha256` | `sha256(data)`, `sha256d(data)` | 500 + 1/B | `sha256d` is two calls |
| `verify_schnorr` | `verify_schnorr(pubkey, digest, sig)` | 50,000 | BIP340 over a 32-byte digest |

`verify_schnorr` checks a signature of a 32-byte digest, not of a message: hash the message first. A Ksana account is an x-only key, so a contract can check a signature by an account:

```rust
/// Whether `sig` is a BIP340 signature by `signer` of `message`; the host checks a 32-byte digest.
pub fn signed_by(signer: &[u8; 32], message: &[u8], sig: &[u8; 64]) -> bool {
    sdk::verify_schnorr(signer, &sdk::sha256(message), sig)
}
```

The SDK’s `contract_id`, `created_contract_id` and `asset_id` compute identifiers with `sha256` inside the contract, at its gas. `trap()` executes `unreachable`, for cases that cannot happen.

## Raw signatures

The node accepts these imports, with exactly these types, and no others:

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

Amounts are 16-byte little-endian u128 values in memory. `funds` is a Borsh `Vec<Funds { asset: [u8; 32], amount: u128 }>`, at most 772 bytes, with `funds_len = 0` for none. The input of a call is encoded as in [How a call enters a contract](#abi). `verify_schnorr` returns `1` for a valid signature and `0` otherwise. `meta` is the Borsh encoding of `(name: String, symbol: String, decimals: u8)`. Capabilities are bits: `1` mint, `2` freeze, `4` allowlist, `8` pause, and a higher bit traps. `frozen`, `allowed` and `paused` are `1` or `0`, and any other value traps. `asset_policy` returns the capabilities in bits 0 to 7 with `0x100` added while the asset is paused, or `-1` when it does not exist; `asset_status` returns the flags, `1` frozen and `2` allowed.

## Gas

Gas is wasmtime fuel: ordinary instructions cost 1, while `nop`, `drop` and the structured control instructions cost 0. `memory.copy`, `memory.fill` and `memory.init` cost 1 more per byte, `memory.grow` 1 per page, and table operations 1 per element. Host functions add the costs in the tables above.

Each op also pays a fixed cost for its action:

| Action | Gas |
| --- | --- |
| `AssetTransfer` | 10,000 |
| `Deploy` | 100,000 + 20/B of code + 10,000 per attached asset + `init`, which includes loading the code at 1/B |
| `Call` | 20,000 + 1/B of the contract’s code + 10,000 per attached asset + the method |

The op’s `max_gas` is a hard limit: an op that needs more fails, even when the excess comes at the very end. A failed op’s receipt reports all of `max_gas` as used. The `max_gas` values of a block’s path B ops add up to at most 100,000,000, so no op can ask for more; a path C op with a `max_gas` above 1,000,000 uses its nonce but fails.

These ops of the [token and pool tutorial](/docs/token-and-pool/) used:

| Op | Gas |
| --- | --- |
| Deploy the 28,720-byte token | 776,169 |
| Deploy the 25,427-byte pool | 672,844 |
| `transfer_and_call` on the token, a deposit in the pool with KSA attached | 214,928 |
| `swap` on the pool, KSA attached | 169,247 |
| `transfer_and_call` on the token, a swap in the pool | 172,426 |

Gas sets the limit of an op’s work; it is not its price. A path B fee is paid in KSA and rated by the op’s cost in bytes, where `max_gas` counts as `max_gas × 81,920 / 100,000,000` bytes. [Operations and fees](/docs/submitting-ops/) explains how producers choose.

## Limits

| Limit | Value |
| --- | --- |
| Storage key / value | 256 / 65,536 bytes |
| Event | 16,384 bytes |
| `asset_issue` / `asset_create` meta | 1,024 bytes; a name of 1 to 64 bytes, a symbol of 1 to 16, at most 18 decimals |
| Call input / output | 65,536 / 65,536 bytes |
| Attached funds | 16 items, 772 bytes encoded |
| Call depth (`MAX_CALL_DEPTH`) | 8 |
| Instances / total memory in one op | 64 / 256 MiB |
| Linear memory of an instance (`MAX_WASM_MEMORY`) | 16 MiB, at most 256 pages at the start |
| Table | 4,096 entries |
| Stack of an instance (`STACK_BUDGET`) | 262,144 bytes, estimated |
| Whole op, code included (`MAX_OP_BYTES`) | 65,536 bytes |
| `max_gas` of a block’s path B ops (`BLOCK_GAS_LIMIT`) | 100,000,000 in total |
| `max_gas` of a path C op (`NATIVE_MAX_GAS`) | 1,000,000 |
| Header depth (`BTC_QUERY_DEPTH`) | 6 Bitcoin blocks below the anchor |

When `memory.grow` would pass 16 MiB it returns −1, and the SDK’s allocator then traps. Breaking any other limit fails the call or the op.

### Stack metering

The native stack depth of WebAssembly differs between machines, so the node meters the stack with an estimate that is the same everywhere. A function’s frame counts as 64 + 16 × (parameters + locals + the deepest operand stack) bytes, and an instance that goes past 262,144 bytes traps. Each contract call is a new instance with its own budget. Recursion, function pointers, trait objects and `core::fmt` all work within it.
