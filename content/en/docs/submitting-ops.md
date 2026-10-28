---
title: Operations, paths and fees
nav: Operations and fees
lede: Everything you do on Ksana is one signed operation. Send it to any node and pay a fee in KSA (path B), or put it in a Bitcoin transaction of your own and pay only the Bitcoin fee (path C).
description: What a Ksana operation (VmOp) contains, how path B and path C get it into a block, how fees, fee rates and the entry pool work, how a top-up buys KSA with bitcoin, and what receipts, gas and failed operations mean.
---

A transfer, a contract call and a deployment are all operations: one signed message from one account. Path B sends it through any Ksana node for a fee in KSA; path C sends it through Bitcoin for the Bitcoin fee alone, and no producer can refuse it.

## What an operation is

An operation, a `VmOp` in the code, has these fields, in this order (the order is the encoding):

| Field | What it holds |
| --- | --- |
| `version` | 2, the current format |
| `chain_id` | The network: 1002 on signet, 1000 on mainnet, 1001 on devnet. The operation is valid nowhere else. |
| `account` | The signing account ([Accounts](/docs/accounts/)) |
| `nonce` | The account nonce this operation uses |
| `fee` | `Token { amount }`, a KSA amount in base units, for path B; `BtcNative` for path C |
| `max_gas` | The most gas the operation may use |
| `action` | What to do |
| `sig` | A BIP340 or BIP322 simple signature over all of the above |

The action is one of three:

- `AssetTransfer { asset, to, amount }` moves KSA or another built-in asset to an account or a contract.
- `Call { contract, method, args, funds }` calls a contract method with Borsh-encoded arguments.
- `Deploy { code, init_args, funds }` deploys WebAssembly code and runs its `init`.

`funds` attaches up to 16 built-in assets to a call or a deployment, in ascending order of asset ID and each above zero; they move to the contract before it runs. An operation is encoded with Borsh, at most 65,536 bytes, and its op ID is the SHA-256 of the whole encoding, signature included.

## Two paths in

::: figure paths
Path B, where you sign one message and a producer includes it within seconds for a fee in KSA, beside path C, where your own Bitcoin transaction carries the operation and every producer must include it once it confirms.
:::

| | Path B: sponsored | Path C: native |
| --- | --- | --- |
| Sent to | Any Ksana node, with `ksana_submitOp` | Bitcoin, in your own transaction |
| Fee | KSA, to the producer and the carrier | BTC, to Bitcoin miners only |
| Takes effect | In the next block, within seconds | After 2 Bitcoin confirmations on signet, 5 on mainnet |
| A producer can refuse it | Yes | No |

Use path B for everyday work. Use path C when you hold no KSA, when no producer will take your operation, or to pay bitcoin and act in the same transaction, as a top-up does.

## Path B: sponsored

Sign the operation with `fee: Token { amount }` and submit it to any node with `ksana_submitOp`. The node checks it (format, chain ID, signature, a nonce not below the account’s, a balance that covers the fees of all your queued operations), keeps it in its entry pool and passes it to its peers. A node that produces blocks answers only once the operation is in its next block template, so a producer usually includes it within seconds, and later pays the Bitcoin fee to land it.

A refusal comes back as an error: `-32010` for an operation that breaks a consensus rule (a path C operation sent here among them), `-32011` for one that this node’s policy turns down, such as a fee below its floor, a full pool or a replacement that does not raise the fee enough.

The fee is taken before the operation runs and is kept even when the operation fails. It stays locked with the block until the block’s data is on Bitcoin, then half goes to the block’s carrier and the rest to its producer; when the producer carried its own block, or nobody qualifies as carrier, the producer takes all of it ([KSA and rewards](/docs/ksa/)).

### Fee rate and floors

Producers rank operations by fee rate, not by the fee alone. An operation’s cost is the larger of its encoded size in bytes and its `max_gas` converted to bytes at the block’s ratio of data to gas (`max_gas * 81920 / 100000000`); its fee rate is `fee * 1024 / cost`, in base units per KiB. So an operation that reserves a large share of a block’s gas pays for that share, and cannot push out cheaper operations with a slightly larger fee.

A KSA transfer signed with BIP340 is 216 bytes. With a `max_gas` of 10,000, which a transfer uses exactly, its cost is 216 bytes; with ksana-cli’s default `max_gas` of 1,000,000 its cost is 819, and the same fee buys a lower rate. Set `max_gas` close to what the operation needs.

Each node sets its own floors. They are policy, not consensus:

| Flag | Default | Effect |
| --- | --- | --- |
| `--min-token-fee` | 1 base unit | Packing floor: the smallest fee this node puts in its blocks |
| `--min-fee-per-kib` | 0 | The lowest fee rate this node packs |
| `--min-relay-token-fee` | The packing floor | Relay floor: the smallest fee this node admits and forwards (the lower of the two floors applies) |

An operation above the relay floor but below the packing floor still enters the pool and travels on, for a producer with a lower floor. No network-wide price exists: each producer prices KSA against its own Bitcoin costs. Ask a node what it suggests with `ksana-cli estimate-fee` (the RPC method `ksana_estimateFee`):

```sh
export KSANA_RPC={{signet.rpc}}
ksana-cli --chain signet estimate-fee
```

```output
{
  "at": {
    "hash": "d8a91f8bdec0fd69849615308b8b800eec04e6f0aee037ed6fa6e97950604cc1",
    "height": "26"
  },
  "feerate_sat_vb": "2",
  "path_b": {
    "amount": "1",
    "per_kib": "4"
  }
}
```

`path_b.per_kib` is the median, over the last 20 main-chain blocks, of the lowest path B fee rate in each block that has one, and `path_b.amount` is that rate applied to a plain transfer with a `max_gas` of 10,000, rounded up and at least the packing floor. `feerate_sat_vb` is the Bitcoin fee rate the node pays for its own settlements now, a reference for path C transactions.

### The entry pool

The entry pool is local policy too: by default a node’s pool holds up to 10,000 operations or 32 MiB, and up to 64 operations per account, numbered from the account’s nonce, at most 8 of them behind a gap in the numbering. A new operation with the same account and nonce replaces the waiting one only with a fee at least a tenth higher, and higher by at least the node’s relay floor; the refusal names the least fee that does. When the pool is full, it evicts the operations that stand lowest (behind a nonce gap first, then by fee rate) instead of refusing newcomers. A replaced or evicted operation is gone, and its op ID answers `-32004`.

## Path C: native

Path C puts the operation in a Bitcoin transaction of your own. The operation, with `fee: BtcNative`, goes into an `OP_RETURN` output that begins with the `KSN1` marker; you fund the transaction from any coins, pay the Bitcoin fee and broadcast it to Bitcoin. Bitcoin Core 30 and later relay such large `OP_RETURN` outputs by default, while earlier versions need `-datacarriersize=100000`.

The signature covers the outpoint that the transaction’s first input spends. An output can be spent only once, so a copy of your operation in someone else’s transaction fails authentication and does not use your nonce. ksana-cli and the [TypeScript SDK](/docs/sdk/) build these transactions; with a browser wallet, the wallet signs the operation first and the transaction after it.

### Forced inclusion

A block anchored at Bitcoin height A must start with every path C transaction confirmed at or below A − `NATIVE_CONFIRMATIONS` + 1 that its parents have not included, in Bitcoin order. Producers anchor `ANCHOR_DEPTH` blocks below their Bitcoin tip, so your transaction is included once it has `NATIVE_CONFIRMATIONS` + `ANCHOR_DEPTH` confirmations: 2 on signet, 5 on mainnet, 1 on devnet. A block that leaves one out is invalid, so no producer can keep your operation out.

Forced entries are not bound by the block’s gas limit; each counts as its `max_gas`, up to 1,000,000. An operation that asks for more than 1,000,000 (`NATIVE_MAX_GAS`) fails and uses its nonce.

### What path C costs

A path C operation pays producers nothing: you pay only the Bitcoin fee, and it is not refunded if the operation fails. A KSA transfer with one input and change, built with the SDK, came to 330 vB, which is 660 sats at 2 sat/vB (672 sats when a wallet signs the operation with BIP322).

The nodes do not know your operation until a block includes it: until then `ksana_getOpStatus` answers `-32004`, so follow the Bitcoin transaction meanwhile. ksana-cli funds and broadcasts the transaction from a wallet in your own bitcoind:

```sh
ksana-cli --chain signet transfer --key alice.key --to @bob.key --amount 100000000 \
  --native --btc-rpc-url http://127.0.0.1:38332 --btc-wallet <wallet> --wait --timeout 3600
```

`--btc-rpc-user` and `--btc-rpc-pass` (or `KSANA_BTC_RPC_PASS`) give your bitcoind’s credentials. Keep the long `--timeout`: the operation needs two signet blocks, far beyond the default 120 seconds, and a `--wait` that times out prints only an error. A contract called on path C can read the transaction that carries the call with the `native_tx` host function, which is how it checks a payment made in that same transaction ([Bitcoin in contracts](/docs/bitcoin-in-contracts/)).

## Top-up: KSA for BTC {#top-up}

A top-up buys KSA with bitcoin in one Bitcoin transaction, through an exchange contract such as the `ksa-exchange` example. Exchange contracts are applications, not protocol rules, and anyone can deploy one.

1. **Agree**: you and a seller settle, off-chain, the amount, the price in KSA base units per sat and the account to credit.
2. **Lock** (the seller, on path B): the seller locks KSA in the contract with the price, a payment script used by this lock alone, your account as the beneficiary and an expiry Bitcoin height. The terms cannot change afterwards.
3. **Pay and claim** (you, on path C): one Bitcoin transaction pays the payment script and carries the claim operation. A one-time key signs the claim at nonce 0, bound to the transaction’s first input, so it never collides with your account’s nonces and a copy cannot take it.
4. **Credit**: once the transaction is force-included, the contract reads it with `native_tx` and credits the beneficiary with the sats paid times the price, up to what is still locked. A payment that buys only part leaves the rest locked for you.

The seller can take back what is still locked 6 Bitcoin blocks after the expiry, so your payment has to confirm at Bitcoin height expiry + 6 − `NATIVE_CONFIRMATIONS` − 1 at the latest (the SDK’s `payBy`). The SDK and ksana-cli read the lock first and refuse to pay when the beneficiary is not you, when the lock is not open, when fewer than 3 Bitcoin blocks are left before the expiry, or when the payment is more or less than the locked KSA is worth (flags allow a partial payment or an overpayment). One top-up transaction is about 381 vB. The [signet wallet](/docs/wallet/) and [ksana-cli](/docs/cli/) both do top-ups.

## Receipts and gas

Every included operation gets a receipt with `success`, `gas_used`, `output` (what a call returned), `events`, `error` and `asset_changes`, the changes it made to built-in assets in the order it made them ([JSON-RPC](/docs/rpc/#ksana_getopstatus) lists their kinds).

Gas measures execution. Ordinary WebAssembly instructions cost 1 gas, host functions have fixed prices, and the built-in actions start from fixed amounts:

| Action | Gas |
| --- | --- |
| `AssetTransfer` | 10,000 |
| `Call` | 20,000, plus 10,000 per attached asset, 1 per byte of the contract’s code, and the execution |
| `Deploy` | 100,000, plus 20 per byte of code, 10,000 per attached asset, and the execution of `init` |

The limit is exact: an operation that would use more than its `max_gas` fails. Deploying the example token used 776,169 gas ([Token and pool tutorial](/docs/token-and-pool/)). A block takes path B operations only while the `max_gas` of its entries adds up to at most 100,000,000 (a path C entry counts at most 1,000,000), which is one more reason to keep `max_gas` close to what you need. [Host functions](/docs/host-functions/) lists every price.

## Failed ops and invalid blocks

Three different things can go wrong, and only the first is about your operation:

- **A failed operation** is included, but its execution fails: out of gas, a contract trap or revert, invalid attached funds, an insufficient balance. Its receipt has `success: false` and `gas_used` equal to `max_gas`; the fee is charged and the nonce used, and every other change and event is rolled back. A path C operation that fails its checks (version, chain ID, length, fee mode, signature or nonce) fails too, but leaves the nonce unchanged. The block stays valid.
- **A skipped entry** sits in a merged block and cannot run where the merge puts it, for example because another block already ran the same operation. It pays nothing and changes nothing, and an operation that is still valid returns to the pool.
- **An invalid block** breaks a consensus rule: a bad signature, a wrong nonce among its own entries, a missing path C entry or a wrong state root. Nodes refuse it or keep it off the main chain, so an operation in it counts only where a valid block runs it.

A **local fault**, such as a storage or bitcoind error, is none of these: the node retries and never judges a block invalid because of one.

The full rules are in [SPEC §5]({{repo}}/blob/main/docs/SPEC.md#5-the-two-submission-paths) (the two paths and top-up), [§7.4]({{repo}}/blob/main/docs/SPEC.md#74-forced-inclusion-of-native-transactions) (forced inclusion) and [§8]({{repo}}/blob/main/docs/SPEC.md#8-fees-incentives-and-unlocking) (fees and gas).
