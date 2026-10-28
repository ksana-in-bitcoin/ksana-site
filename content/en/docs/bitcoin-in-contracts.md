---
title: Bitcoin in contracts
lede: A contract can read Bitcoin block headers, check a proof that a Bitcoin transaction paid a script, and read the Bitcoin transaction that carried its own op.
description: How Ksana contracts read Bitcoin headers, verify payments with Merkle proofs, and use native_tx for path C ops, with tested Rust code.
---

Every Ksana block anchors to a Bitcoin block, and every node executes it against the Bitcoin chain up to that anchor. Contracts share that view of Bitcoin through three host functions:

| Function | Returns | Gas |
| --- | --- | --- |
| `btc_anchor_height()` | the Bitcoin height that the block executing the op anchors to | 100 |
| `btc_header(height)` | the 80-byte header of a Bitcoin block at least 6 blocks below the anchor | 2,000 |
| `native_tx()` | for a path C op, the Bitcoin transaction that carried it | 2,000 + 1 per byte |

A contract sees nothing else of Bitcoin: no transaction by ID, no address, no balance. To use any other transaction, the caller passes it in with a Merkle proof, and the contract checks the proof against a header. The SDK’s `btc` module parses headers and transactions and checks the proofs. The contract code on this page starts from `use ksana_contract_sdk::{self as sdk, btc, storage};`, as in [Write a contract](/docs/contracts/).

## What a contract can see {#depth}

A producer anchors each block `ANCHOR_DEPTH` blocks below the Bitcoin tip it sees: 0 on devnet, 1 on the signet and 2 on mainnet. A contract can read the headers at least `BTC_QUERY_DEPTH` blocks below that anchor, and `BTC_QUERY_DEPTH` is 6 on every network. So a Bitcoin block’s header becomes readable once the block has 7 + `ANCHOR_DEPTH` confirmations: 8 on the signet and 9 on mainnet, or more when a producer’s view of Bitcoin lags.

`btc_header` traps for a block that is not deep enough, and the op fails with the error `insufficient BTC block header depth`. Check the depth first, so that your contract decides what happens; here it reverts with its own reason:

```rust
/// A contract reads BTC headers at least this far below the anchor: 6 on every network.
const BTC_QUERY_DEPTH: u32 = 6;

/// The header of BTC block `height`, or a revert when it is not yet deep enough to read.
pub fn header_at(height: u32) -> Result<btc::BlockHeader, Vec<u8>> {
    // btc_header traps when the block is too shallow, so check first and revert with a reason
    let deepest = sdk::btc_anchor_height().checked_sub(BTC_QUERY_DEPTH);
    if deepest.is_none_or(|deepest| height > deepest) {
        return Err(b"the block is not deep enough yet".to_vec());
    }
    btc::BlockHeader::parse(&sdk::btc_header(height)).ok_or(b"malformed header".to_vec())
}
```

The header comes from the node’s own view of the anchor chain, so the contract needs no proof-of-work check. `BlockHeader` has the fields `version`, `prev_blockhash`, `merkle_root`, `time`, `bits` and `nonce`, and `block_hash()` computes its hash.

::: warning Byte order
Contracts see txids, block hashes and Merkle branches in Bitcoin’s internal byte order. Block explorers and bitcoind’s RPC show txids and block hashes reversed. Reverse a txid copied from an explorer before you compare it with one a contract computed.
:::

## Prove a payment {#proof}

To show a contract that a Bitcoin transaction paid a script, the caller passes:

- the height of the block that holds the transaction;
- the transaction, serialized without witness data (without the marker, the flag and the witnesses of a segwit transaction);
- its position in the block and its Merkle branch, from the leaf up;
- the block’s coinbase transaction, also without witness data, and the coinbase’s Merkle branch.

Bitcoin’s Merkle tree allows two known forgeries, and `btc::verify_tx_inclusion` blocks both. It rejects a transaction of exactly 64 bytes, so an inner node of the tree cannot pass as a transaction. The coinbase proof pins the depth of the tree: the coinbase is always the first transaction, and the transaction’s branch must be as long as the coinbase’s. A forged transaction therefore cannot hang below a real 64-byte one.

```rust
/// A transaction and the Merkle proofs that place it in a BTC block.
pub struct Proof<'a> {
    /// Height of the BTC block.
    pub height: u32,
    /// The transaction, serialized without witness data.
    pub raw_tx: &'a [u8],
    /// Its position in the block.
    pub index: u32,
    /// Its Merkle branch, from the leaf up.
    pub branch: &'a [[u8; 32]],
    /// The block's coinbase transaction, without witness data.
    pub coinbase_tx: &'a [u8],
    /// The coinbase's Merkle branch: as long as `branch`.
    pub coinbase_branch: &'a [[u8; 32]],
}

/// Checks that output `vout` of a proven transaction pays `script`; returns the txid and the sats.
pub fn proven_payment(
    proof: &Proof<'_>,
    vout: u32,
    script: &[u8],
) -> Result<([u8; 32], u64), Vec<u8>> {
    let header = header_at(proof.height)?;
    let txid = btc::verify_tx_inclusion(
        &header,
        proof.raw_tx,
        proof.index,
        proof.branch,
        proof.coinbase_tx,
        proof.coinbase_branch,
    )
    .ok_or(b"the transaction is not in that block".to_vec())?;
    let outputs = btc::parse_outputs(proof.raw_tx).ok_or(b"malformed transaction".to_vec())?;
    let output = usize::try_from(vout)
        .ok()
        .and_then(|i| outputs.get(i))
        .ok_or(b"no such output".to_vec())?;
    if output.script_pubkey != script {
        return Err(b"the output pays another script".to_vec());
    }
    Ok((txid, output.value))
}
```

The position does not identify a transaction. When a level of the tree has an odd number of nodes, Bitcoin pairs the last node with itself, so the last transactions of a block also verify at a position past the end. Key replay protection on the txid and the output, never on the position:

```rust
/// Marks output (txid, vout) as used; a second claim of the same output reverts.
pub fn use_once(txid: &[u8; 32], vout: u32) -> Result<(), Vec<u8>> {
    let key = [b"used".as_slice(), txid, &vout.to_le_bytes()].concat();
    if storage::get(&key).is_some() {
        return Err(b"already claimed".to_vec());
    }
    storage::set(&key, &[1]);
    Ok(())
}
```

A proof does not say who may use the payment: anyone who sees the transaction on Bitcoin, the producer included, could submit it first. The `btc-payment-trigger` example requires the paying transaction to commit to the beneficiary in an output `OP_RETURN <32-byte account>`, so a claim for anyone else fails. The whole proof travels in the op, and an op is at most 65,536 bytes, so a very large transaction cannot be proven this way.

### Build the proof

Your app builds the proof from the whole block. The signet’s public Bitcoin endpoint does not serve blocks, so read the block from your own bitcoind with `bitcoin-cli -signet getblock <hash> 0`, which prints it in hex. These functions use the [rust-bitcoin](https://crates.io/crates/bitcoin) crate:

```toml
[dependencies]
bitcoin = "0.32"
borsh = "1"
hex = "0.4"
```

```rust title="src/lib.rs"
//! Builds the proofs that `btc::verify_tx_inclusion` checks, from a block read from bitcoind.
use bitcoin::consensus::serialize;
use bitcoin::hashes::{sha256d, Hash};
use bitcoin::{Block, Transaction};

/// The parts of a proof that place a transaction in its block.
pub struct InclusionProof {
    /// The transaction, without witness data.
    pub raw_tx: Vec<u8>,
    /// Its Merkle branch, from the leaf up.
    pub branch: Vec<[u8; 32]>,
    /// The block's coinbase transaction, without witness data.
    pub coinbase_tx: Vec<u8>,
    /// The coinbase's Merkle branch.
    pub coinbase_branch: Vec<[u8; 32]>,
}

/// The transaction without witness data: the bytes its txid hashes.
pub fn without_witness(tx: &Transaction) -> Vec<u8> {
    let mut stripped = tx.clone();
    for input in &mut stripped.input {
        input.witness.clear();
    }
    serialize(&stripped)
}

/// The Merkle branch of transaction `index`, from the leaf up, in internal byte order.
pub fn merkle_branch(txids: &[[u8; 32]], mut index: usize) -> Vec<[u8; 32]> {
    let mut level = txids.to_vec();
    let mut branch = Vec::new();
    while level.len() > 1 {
        if level.len() % 2 == 1 {
            level.push(level[level.len() - 1]); // an odd level pairs its last node with itself
        }
        branch.push(level[index ^ 1]);
        level = level
            .chunks(2)
            .map(|pair| sha256d::Hash::hash(&[pair[0], pair[1]].concat()).to_byte_array())
            .collect();
        index /= 2;
    }
    branch
}

/// The proof of transaction `index` of `block`.
pub fn inclusion_proof(block: &Block, index: usize) -> InclusionProof {
    let txids: Vec<[u8; 32]> = block
        .txdata
        .iter()
        .map(|tx| tx.compute_txid().to_byte_array())
        .collect();
    InclusionProof {
        raw_tx: without_witness(&block.txdata[index]),
        branch: merkle_branch(&txids, index),
        coinbase_tx: without_witness(&block.txdata[0]),
        coinbase_branch: merkle_branch(&txids, 0),
    }
}

/// The Borsh arguments of `claim` in the btc-payment-trigger example, in hex for `--args`.
pub fn claim_args(
    block: &Block,
    height: u32,
    index: usize,
    vout: u32,
    beneficiary: [u8; 32],
) -> String {
    let p = inclusion_proof(block, index);
    let index = u32::try_from(index).expect("a block holds fewer than 2^32 transactions");
    let args = (
        height,
        p.raw_tx,
        index,
        p.branch,
        p.coinbase_tx,
        p.coinbase_branch,
        vout,
        beneficiary,
    );
    hex::encode(borsh::to_vec(&args).expect("encoding plain values cannot fail"))
}
```

Decode the hex with `bitcoin::consensus::encode::deserialize_hex::<Block>(hex.trim())`. rust-bitcoin’s `to_byte_array()` gives a hash in internal byte order, the order contracts use, and `to_string()` gives the reversed order that explorers show. `claim_args` produces the `--args` of a [ksana-cli](/docs/cli/) call to the `btc-payment-trigger` example.

## Read the op’s own transaction {#native-tx}

A path C op travels inside a Bitcoin transaction, in a KSN1 data output. Every producer must include it once that transaction has `NATIVE_CONFIRMATIONS` + `ANCHOR_DEPTH` confirmations: 2 on the signet and 5 on mainnet. The op’s signature covers the transaction’s first input, so a copy of the op in another transaction fails authentication. While the op runs, `native_tx()` returns the transaction’s txid and all its outputs, the KSN1 output included; for a path B op, and in a read-only call (the RPC method `ksana_call`), it returns `None`.

That lets one Bitcoin transaction both pay and ask a contract to act on the payment, with no proof to build. This function adds up what the transaction pays to a script:

```rust
/// What the BTC transaction carrying this op pays to `script`, in sats, and its txid.
pub fn paid_by_this_op(script: &[u8]) -> Result<([u8; 32], u64), Vec<u8>> {
    let tx = sdk::native_tx().ok_or(b"send this op through path C".to_vec())?;
    let mut paid = 0u64;
    for output in tx.outputs.iter().filter(|o| o.script == script) {
        paid = paid.checked_add(output.value).ok_or(b"overflow".to_vec())?;
    }
    Ok((tx.txid, paid))
}
```

Every level of the op reads the same transaction: calls to other contracts, `try_call`, `delegate_call` and the `init` of created contracts. A contract that a path C op calls twice sees the payment twice, so record each txid you credit. A path C op’s `max_gas` cannot exceed 1,000,000: above that, the op uses its nonce and fails.

[Operations and fees](/docs/submitting-ops/) explains how to send a path C op, and the [TypeScript SDK](/docs/sdk/) builds the transaction for a browser wallet.

## Test it natively

The SDK’s mock host plays the anchor chain in native tests. `mock::set_btc_header` stores a header, and `mock::set_btc_anchor_height` moves the anchor. `mock::set_native_tx` sets the transaction that carries the op, and `None`, the default, means a path B op. `mock::with_context(caller, contract, f)` runs `f` as if `contract` were executing a call from `caller`:

```rust title="tests/path_c.rs"
//! Native tests of the path C payment check, against the mock host.
#![cfg(not(target_arch = "wasm32"))]

use ksana_contract_sdk::{mock, NativeOutput, NativeTx};

const ALICE: [u8; 32] = [0xa1; 32];
const CONTRACT: [u8; 32] = [0xc0; 32];

#[test]
fn counts_what_the_carrying_transaction_pays() {
    mock::reset();
    let script = [&[0x51, 0x20][..], &[7; 32]].concat(); // a P2TR output script
    let pay = |value| NativeOutput {
        value,
        script: script.clone(),
    };
    let outputs = vec![pay(700), pay(300)];
    mock::set_native_tx(Some(NativeTx {
        txid: [3; 32],
        outputs,
    }));
    let paid = mock::with_context(ALICE, CONTRACT, || snippets::paid_by_this_op(&script));
    assert_eq!(paid, Ok(([3; 32], 1_000)));
    mock::set_native_tx(None); // a path B op from here on
    let paid = mock::with_context(ALICE, CONTRACT, || snippets::paid_by_this_op(&script));
    assert_eq!(paid, Err(b"send this op through path C".to_vec()));
}
```

Here the contract’s crate is named `snippets`; use your crate’s name. Like a node, the mock traps on `btc_header` for a block less than 6 blocks below the anchor, and for a header you did not set.

## The examples

Two of the [example contracts](/docs/example-contracts/) use Bitcoin:

- **`btc-payment-trigger`** issues its own asset to whoever proves a payment to a watched script. `claim` reads the header, checks the proof, requires the commitment to the beneficiary, accepts each output once, and issues the output’s value in sats times `units_per_sat`.
- **`ksa-exchange`** sells KSA for bitcoin, and top-ups use it. A seller locks KSA at a price for a buyer’s account. The buyer pays the lock’s script in the Bitcoin transaction that carries a path C `claim`. `claim` reads `native_tx()`, adds up the payment, records the txid against the lock, and pays the KSA it buys to the buyer.

Both are tested in the repository against the mock host, and the regtest end-to-end tests run them against a real bitcoind.
