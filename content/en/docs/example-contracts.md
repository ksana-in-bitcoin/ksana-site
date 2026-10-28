---
title: Example contracts
lede: The repository ships example contracts, from the reference KS-20 token to a market that sells KSA for bitcoin, the poll of the first tutorial, six more written for the contract playground, and one test contract. Each is a tested model to read, build and deploy.
description: A tour of Ksana's example contracts (token, amm, amm-factory, btc-payment-trigger, ksa-exchange, the tutorial's poll, and the playground's counter, mintable token, NFT, lending, multisig and vesting) and the probe test contract, with their methods and how to build, test and deploy them.
---

The contracts live in `contracts/` of the repository, a Cargo workspace of their own. The comment at the top of each crate’s `src/lib.rs` documents every method, event and rule; this page summarizes them.

| Contract | What it shows | Directory |
| --- | --- | --- |
| [`token`](#token) | the reference [KS-20](/docs/ks-20/) token: storage, events, allowances | `contracts/examples/token` |
| [`amm`](#amm) | calls to other contracts, attached funds, tokens paid in one step | `contracts/examples/amm` |
| [`amm-factory`](#amm-factory) | contracts that create contracts | `contracts/examples/amm-factory` |
| [`btc-payment-trigger`](#btc-payment-trigger) | Bitcoin headers and payment proofs | `contracts/examples/btc-payment-trigger` |
| [`ksa-exchange`](#ksa-exchange) | `native_tx` and path C | `contracts/examples/ksa-exchange` |
| [`poll`](#poll) | a first contract: a storage key per account, checks with reasons, events | `contracts/examples/poll` |
| [`probe`](#probe) | every host function, for tests | `contracts/testing/probe` |

## Build and test them

The native tests run each contract against the SDK’s mock host, with no node. Run them from the workspace:

```sh
git clone {{repo}}
cd Ksana/contracts
cargo test --workspace
```

Build a module from inside `contracts/`, as a `cdylib` alone, so that `contracts/.cargo/config.toml` applies and the module stays small:

```sh
cargo rustc --release --locked --target wasm32-unknown-unknown \
  --package ksa-exchange --crate-type cdylib
```

The module lands in `contracts/target/wasm32-unknown-unknown/release/`, named after the package with underscores: `ksa_exchange.wasm`, `amm_factory.wasm`. Its bytes depend on the absolute path of your checkout, so build the file you deploy once and compute IDs from that file.

## Deploy one

Deploy with `ksana-cli deploy`, which takes the module and the Borsh bytes of the `init` arguments in hex. The output does not give the new contract’s ID: compute it from your account, the deploy op’s nonce and the SHA-256 of the module, with the `contract_id` helper of the [token and pool tutorial](/docs/token-and-pool/#load-the-helpers), and your account in `ACCOUNT` as there. `ksa-exchange` takes no `init` arguments:

```sh
export KSANA_RPC={{signet.rpc}}
W=target/wasm32-unknown-unknown/release
ksana-cli deploy --key alice.key --code $W/ksa_exchange.wasm --fee-token 1 --wait > exchange.json
EXCHANGE=$(contract_id $ACCOUNT $(jq -r .nonce exchange.json) $W/ksa_exchange.wasm)
```

The [tutorial](/docs/token-and-pool/) deploys `token`, `amm` and `amm-factory`, with real output. Mainnet has not launched, so deploy on the signet.

## `token`

The reference [KS-20](/docs/ks-20/) token: the contract SDK's implementation with the extensions `KS-20-burnable` and `KS-20-mintable`, and no rules of its own. Its balances live in the contract’s storage, not in the node’s balance table like KSA’s, and you move them by calling the contract. `init` gives the supply to the deployer; a minter, when `init` names one, can mint more up to the cap, hand the role over or end minting for good.

`approve(spender, amount, expires_at)` lets a contract take your tokens with `transfer_from` until `expires_at`, a block timestamp in seconds (`None` never expires); it sets the allowance, it does not add to it. `transfer_and_call` pays a contract and calls its `on_token_received` in the same operation, so a pool needs no allowance at all.

| Method | Arguments | Returns |
| --- | --- | --- |
| `init` | `(name: String, symbol: String, decimals: u8, supply: u128, minter: Option<[u8; 32]>, cap: Option<u128>)` | `()` |
| `transfer` | `(to: [u8; 32], amount: u128)` | `()` |
| `transfer_from` | `(from: [u8; 32], to: [u8; 32], amount: u128)` | `()` |
| `approve` | `(spender: [u8; 32], amount: u128, expires_at: Option<u64>)` | `()` |
| `transfer_and_call` | `(to: [u8; 32], amount: u128, data: Vec<u8>)`, funds attached for the recipient | `Vec<u8>`, the recipient’s answer |
| `burn` | `amount: u128` | `()` |
| `burn_from` | `(from: [u8; 32], amount: u128)` | `()` |
| `mint` | `(to: [u8; 32], amount: u128)`, the minter only | `()` |
| `set_minter` | `minter: Option<[u8; 32]>`, the minter only | `()` |
| `balance_of` | `account: [u8; 32]` | `u128` |
| `allowance` | `(owner: [u8; 32], spender: [u8; 32])` | `u128`, 0 once expired |
| `allowance_info` | `(owner: [u8; 32], spender: [u8; 32])` | `(u128, Option<u64>)` |
| `total_supply` | none | `u128` |
| `metadata` | none | `(name, symbol, decimals)` |
| `standards` | none | `Vec<String>`: `KS-20`, `KS-20-burnable`, `KS-20-mintable` |
| `capabilities` | none | `Vec<String>`: `mint` while there is a minter |
| `minter`, `cap` | none | `Option<[u8; 32]>`, `Option<u128>` |

Events: `standards`, `metadata` and `minter` in `init`, then `("transfer", from, to, amount)` for every change of a balance, with `from` all zeros for a mint and `to` all zeros for a burn, and `("approve", owner, spender, amount, expires_at)`. The token written before KS-20 took `init` without the minter and the cap and `approve` without the expiry, and the reference token still takes both forms.

## `amm`

A constant-product pool of two sides. A side is an [`AssetRef`](/docs/tokens/#asset-ref): a KS-20 token or a built-in asset such as KSA, encoded as one byte (`0` token, `1` asset) and the 32-byte ID. A token side comes in one of two ways: in one step, with the token’s own `transfer_and_call(pool, amount, action)`, where `action` is a `PoolAction`, a swap or a deposit; or pulled by `swap` and `add_liquidity` with the token’s `transfer_from`, after you approve the pool. An asset side arrives attached to the call, in exactly the amount the arguments name, and with `transfer_and_call` the token passes it on.

The first deposit gets `isqrt(amount_a × amount_b)` shares. Later deposits get shares at the smaller of the two ratios of amount to reserve, and the pool takes only the amounts that ratio needs, refunding the excess of an asset side. A swap keeps a 0.3% fee: `out = in × 997 × R_out / (R_in × 1000 + in × 997)`, rounded down, and it reverts when `out` is below `min_out`. The pool keeps its reserves in storage, so assets sent to it directly do not move the price.

`add_liquidity` reverts when the shares fall below `min_shares`, and `remove_liquidity` when either amount falls below its minimum. A swap just before a deposit moves the ratio the deposit enters at. Amounts in the pool’s ratio get fewer shares whichever way the ratio moves, so offer amounts in that ratio, with `min_shares` a little below the shares a `query` of the same deposit returns. Callers written before the minimums can leave them out: `(amount_a, amount_b)` and a bare `shares` mean minimums of 0.

| Method | Arguments | Returns |
| --- | --- | --- |
| `init` | `(side_a: Side, side_b: Side)` | `()` |
| `add_liquidity` | `(amount_a: u128, amount_b: u128, min_shares: u128)` | `u128`, the shares |
| `remove_liquidity` | `(shares: u128, min_a: u128, min_b: u128)` | `(u128, u128)`, the amounts of A and B |
| `swap` | `(id_in: [u8; 32], amount_in: u128, min_out: u128)` | `u128`, the amount out |
| `reserves` | none | `(u128, u128)` |
| `shares_of` | `account: [u8; 32]` | `u128` |
| `total_shares` | none | `u128` |
| `on_token_received` | `(from: [u8; 32], amount: u128, data: Vec<u8>)`, called by a token side | `Vec<u8>`: the Borsh `u128` paid out, or the shares |
| `tokens` | none | `(AssetRef, AssetRef)` |

`data` of `on_token_received` is a `PoolAction`: `00` and `min_out: u128` for `Swap(min_out)`, which swaps the tokens received and pays the other side to the sender, or `01`, `amount_other: u128` and `min_shares: u128` for `AddLiquidity`, which deposits them with up to `amount_other` of the other side (attached when it is an asset) and sends back what the ratio does not use. Only a token side of the pool may call it.

Events: `("add_liquidity", provider, amount_a, amount_b, shares)`, `("remove_liquidity", provider, shares, amount_a, amount_b)` and `("swap", trader, id_in, amount_in, amount_out)`; through `transfer_and_call`, the provider or the trader is the account that sent the tokens.

## `amm-factory`

Creates `amm` pools with `create_contract`, from the `amm` code already on chain: someone must have deployed `amm` once. `init` takes the code’s hash, the SHA-256 of the module. A `Side` here is encoded as the pool’s `AssetRef`.

`create_pair` sorts the two sides by ID, then by kind, and uses the SHA-256 of their Borsh encoding as the salt. So each pair of sides gets one pool, at an ID you can compute in advance from the factory’s ID, the salt and the code hash. The pool’s `init` receives the sides in that order: in a pool of KSA and a token, KSA is side A, because its ID is all zeros.

| Method | Arguments | Returns |
| --- | --- | --- |
| `init` | `amm_code_hash: [u8; 32]` | `()` |
| `create_pair` | `(side_a: Side, side_b: Side)` | `[u8; 32]`, the pool’s ID |
| `get_pair` | `(side_a: Side, side_b: Side)`, in either order | `Option<[u8; 32]>` |
| `pair_count` | none | `u64` |
| `pair_at` | `index: u64` | `Option<[u8; 32]>` |
| `amm_code_hash` | none | `[u8; 32]` |

Event: `("pair_created", side_a, side_b, pair)`.

## `btc-payment-trigger`

Issues the contract’s own asset to whoever proves a Bitcoin payment to a watched script. `init` takes the script, the asset’s `sub_id`, its metadata `(name: String, symbol: String, decimals: u8)` and `units_per_sat`. It reverts on an empty script, a rate of 0 or metadata the host would refuse: a name of 1 to 64 bytes, a symbol of 1 to 16 bytes and at most 18 decimals pass.

`claim` checks the proof against a Bitcoin header and checks that output `vout` pays the watched script. The transaction must also have an output `OP_RETURN <beneficiary>` (`6a20` and the 32-byte account), so nobody else can claim the payment first. Each `(txid, vout)` is claimed once, for `value × units_per_sat` of the asset, issued to the beneficiary.

| Method | Arguments | Returns |
| --- | --- | --- |
| `init` | `(watch_script: Vec<u8>, sub_id: [u8; 32], meta, units_per_sat: u128)` | `()` |
| `claim` | the proof, then `vout: u32` and `beneficiary: [u8; 32]` | `u128`, the amount issued |
| `asset_id` | none | `[u8; 32]` |
| `is_claimed` | `(txid: [u8; 32], vout: u32)` | `bool` |

The proof is `height: u32`, `raw_tx: Vec<u8>`, `tx_index: u32`, `branch: Vec<[u8; 32]>`, `coinbase_tx: Vec<u8>` and `coinbase_branch: Vec<[u8; 32]>`, in that order. [Bitcoin in contracts](/docs/bitcoin-in-contracts/#proof) explains each part and builds the arguments of `claim` from a block. The event is `("claim", txid, vout, beneficiary, asset_id, amount)`, and the asset’s ID is the SHA-256 of the contract’s ID and `sub_id`.

## `ksa-exchange`

Sells KSA for bitcoin. Top-ups use it: a buyer with sats and no KSA pays a seller on Bitcoin and receives KSA on Ksana, in one Bitcoin transaction.

1. The seller deposits KSA, with `deposit` or attached to `lock`, and calls `lock`. The lock reserves `ksa` base units for the buyer’s account at `price` base units per sat, payable to a Bitcoin script no other lock has used, until Bitcoin height `expiry`.
2. The buyer sends one Bitcoin transaction that pays the lock’s script and carries a path C op calling `claim(lock)`. When the op runs, `claim` reads [`native_tx()`](/docs/bitcoin-in-contracts/#native-tx), adds up what the transaction pays to the script, and pays the KSA it buys to the buyer’s account, at most the KSA still locked.
3. A partial payment leaves the rest locked for the same buyer. Once the anchor reaches `expiry` + 6, the seller can `release` an open lock, and the KSA still in it returns to the seller’s free balance; `withdraw` takes KSA out of that balance.

The beneficiary is fixed in the lock, so whoever submits a claim, the KSA goes to the buyer. The op’s signature covers the transaction’s first input, so a copied claim fails. Paying more than the lock holds buys nothing more, and paying a lock that is no longer open loses the bitcoin: read the lock before you pay.

| Method | Arguments | Returns |
| --- | --- | --- |
| `init` | none, with no funds | `()` |
| `deposit` | none, with KSA attached | `u128`, the free balance |
| `withdraw` | `amount: u128` | `u128`, the free balance |
| `lock` | `(ksa: u128, price: u128, script: Vec<u8>, beneficiary: [u8; 32], expiry: u32)` | `u64`, the lock’s number |
| `claim` | `lock: u64`, from a path C op only | `(paid_sats: u64, ksa_paid: u128)` |
| `release` | `lock: u64` | `u128`, the KSA taken back |
| `get_lock` | `lock: u64` | `Lock` |
| `lock_of_script` | `script: Vec<u8>` | `Option<u64>` |
| `balance` | `seller: [u8; 32]` | `u128`, the free balance |
| `lock_count` | `seller: [u8; 32]` | `u64` |
| `locks_of` | `(seller: [u8; 32], start: u64, limit: u32)`, `limit` 1 to 256 | `Vec<u64>` |

A `Lock` is `(seller, beneficiary, script, price, ksa, expiry, state)`, where `ksa` is what is still locked. `state` is `0` (open), `1` with the totals `paid_sats: u64` and `ksa_paid: u128` (claimed), or `2` (released). A lock’s script is at most 64 bytes and cannot start with `OP_RETURN`. [ksana-cli](/docs/cli/) has `exchange` commands for sellers and a `top-up` command for buyers, and the [TypeScript SDK](/docs/sdk/) builds a top-up for a browser wallet.

## `poll`

The contract of the tutorial [Your first contract](/docs/first-contract/), which writes, compiles and deploys it in the playground. The account that deploys it asks a question with 2 to 8 options, every account votes once while the poll is open, and the creator closes it. It is a contract’s basics at their smallest: a storage key for each voter, a check with a reason before every write, the caller as identity, and an event for every change. It needs nothing but the contract SDK, so the playground builds it on the Counter page.

| Method | Arguments | Returns |
| --- | --- | --- |
| `init` | `(question: String, options: Vec<String>)`: a question of 1 to 200 bytes, 2 to 8 options of 1 to 64 bytes | `()` |
| `vote` | `option: u32`, once per account while the poll is open | `u64`, the option’s votes |
| `close` | none, the creator only | `()` |
| `poll` | none | `(String, Vec<String>, bool)`: the question, the options, whether voting is open |
| `results` | none | `Vec<u64>`, the votes of each option |
| `voted` | `account: [u8; 32]` | `Option<u32>`, the option it voted for |

Events: `("voted", voter, option)` and `("closed", total)`. Every method refuses attached funds.

## `probe`

A test contract, not an example: it exposes the host functions as methods, so that the node’s execution and determinism tests can drive each one. Its methods include `send`, `issue`, `burn`, `forward`, `try_forward`, `delegate`, `create`, `set`, `get`, `env`, `recurse`, `spin`, `trap` and `revert`.

Read it to see a host function used in isolation, and do not deploy it for real use. Its method table is at the top of `contracts/testing/probe/src/lib.rs`.

## Playground examples

Six more examples were written for the [contract playground](/docs/playground/), which has a page for each. Their `src/lib.rs` opens with the rules of every method and an [ABI block](/docs/playground/#the-abi-block), from which the playground builds its forms. The playground's KS-20 token page uses the [`token`](#token) above, and its AMM page the [`amm`](#amm).

| Contract | What it shows | Directory |
| --- | --- | --- |
| `playground-counter` | the smallest contract that keeps state: `init`, `increment`, `add`, `get` and a `changed` event | `contracts/examples/playground-counter` |
| `mintable-token` | a built-in asset whose owner mints up to an optional cap; any holder burns, `set_owner` hands the minting over | `contracts/examples/mintable-token` |
| `nft` | a [KS-721](/docs/ks-721/) collection with URIs, approvals and operators, and fixed-price listings paid in any asset | `contracts/examples/nft` |
| `lending` | one market: supply for shares, borrow against collateral at a price its admin sets, interest on a rate curve with a kink, liquidations | `contracts/examples/lending` |
| `multisig` | owners and a threshold, and proposals to transfer, call another contract or change the owners | `contracts/examples/multisig` |
| `vesting` | schedules with a cliff and a linear release, which their creator may revoke | `contracts/examples/vesting` |
