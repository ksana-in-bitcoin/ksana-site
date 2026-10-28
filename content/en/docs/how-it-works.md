---
title: How Ksana works
nav: How it works
lede: Ksana executes your operations in its own fast blocks within seconds, writes every block’s data into Bitcoin transactions, and decides from Bitcoin data alone which blocks are final.
description: The design of Ksana in plain words. The fast lane of proof-of-work blocks, settlement of every block’s data into Bitcoin, finality decided from Bitcoin, forced inclusion, the indexer and execution.
---

Ksana is a smart contract system whose record lives on Bitcoin. Producers mine blocks every few seconds and execute operations at once; the data of every block then goes into ordinary Bitcoin transactions, and a block becomes final once that data has six Bitcoin confirmations and five more blocks have secured the decision. Anyone with a Bitcoin node can rebuild and check the whole state from Bitcoin alone. Mainnet has not launched: the [public signet](/docs/signet/) runs everything this page describes.

## Two chains, one record

::: figure rails
Fast-lane blocks run above and Bitcoin blocks below: each settlement drops a stretch of the fast lane into a Bitcoin block, and its operations move from fast-confirmed to on Bitcoin to final. The break in both rails leaves out five Bitcoin blocks.
:::

Ksana splits the work between two chains. The **fast lane**, Ksana’s own chain of proof-of-work blocks, orders and executes operations within seconds. **Bitcoin** stores the data of every fast-lane block and decides finality: at six confirmations of that data every node decides the block final, and once that decision is six blocks deep too, undoing it takes a Bitcoin reorganization of at least six blocks.

So every operation passes three marks: **fast-confirmed** once a fast-lane block has executed it (about 5 seconds), **on Bitcoin** once the block’s data is in a Bitcoin block, and **final** once that data has six Bitcoin confirmations and five more blocks have secured the decision. [Confirmations](/docs/confirmations/) explains what each mark guarantees and how long to wait for it.

Bitcoin never moves into Ksana. A contract can check that a Bitcoin payment happened, with a Merkle proof against a Bitcoin header or by reading the transaction that carried its operation, but no Ksana rule can spend bitcoin. BTC changes hands only in Bitcoin transactions that you sign yourself, as in a [top-up](/docs/submitting-ops/#top-up).

## The fast lane

### Producers and proof of work

Anyone can produce blocks: start `ksana-node` with a producer account and it mines. A producer collects operations, executes them, writes the resulting state root into the block header and solves a proof of work. The work is Argon2id with 2 MiB of memory, about 1 ms per attempt on one CPU core, chosen so that ordinary computers can mine and a browser can verify a header.

The difficulty adjusts at every block so that blocks come about every 5 seconds while there are operations to include; with nothing to include, producers mine empty blocks, which are harder and come minutes apart. Producers earn KSA for their blocks. [Mining](/docs/mining/) covers the algorithm, the difficulty and the costs, and [KSA and rewards](/docs/ksa/) the rewards.

### A block DAG, not a chain

At one block every 5 seconds, two producers often find blocks at nearly the same moment. Instead of discarding one, Ksana keeps both: a block names up to 10 parents, so the blocks form a directed acyclic graph (DAG), and GHOSTDAG, the protocol Kaspa uses, puts the whole graph in one order.

Each block has a **selected parent**, the parent with the most work behind it, and following selected parents back from the best tip gives the **main chain**. A main-chain block merges the blocks in its past that nothing has ordered yet, its **merge set**: it executes their entries first, in a fixed order, then its own. An operation in a merged block takes effect at the height of the main-chain block that merges it; an entry that conflicts with one ordered before it (the same operation twice, a nonce already used, a balance already spent) is skipped and pays no fee.

GHOSTDAG also colors blocks blue or red. A blue block was visible to the rest of the network in good time; a red block stayed out of sight too long, possibly an attacker’s, and still has its entries executed but earns no block reward.

### Anchors

Every block names a Bitcoin block, its **anchor**. A producer anchors `ANCHOR_DEPTH` blocks below its Bitcoin tip (1 on signet, 2 on mainnet, 0 on devnet) and never below the anchors of the block’s parents. Execution reads Bitcoin only up to the anchor: the path C transactions a block must include, the Bitcoin headers a contract may read, and which blocks’ data has landed. So every node computes the same result whatever its own Bitcoin tip.

The depth absorbs shallow Bitcoin reorganizations: one of at most `ANCHOR_DEPTH` blocks orphans no anchor, so the main chain and its state stay as they are. A deeper one takes the blocks anchored on the orphaned Bitcoin blocks off the main chain, and their path B operations return to the entry pool to be included again with the same op ID.

## Settlement into Bitcoin

::: figure settlement
A settlement is a commit and reveal pair: the producer’s funding pays the commit, and the reveal’s Taproot witness carries the KSN1 envelope with the block’s data.
:::

A block’s data reaches Bitcoin in a **settlement** of two transactions. The **commit transaction** spends the producer’s own bitcoin and creates a Taproot output committing to a script that holds the data. The **reveal transaction** spends that output, so the data appears in its witness, inside a `KSN1` envelope. The reveal also pays 240 sats to a P2A anchor output, which lets anyone raise the pair’s fee with a child transaction (CPFP), and has an empty `OP_RETURN` output that keeps it above Bitcoin Core’s minimum transaction size.

Two transactions are needed because in a single one the data could sit only in a witness element that no signature covers, which any relayer could swap without changing the transaction ID; committing to the script in an output first fixes it. In the witness, each byte of data costs a quarter of a vbyte.

The **payload** in the envelope holds the block’s header and entries, the headers of earlier blocks that are not on Bitcoin yet, and the entries (bodies) of earlier blocks that carried no settlement. Headers and entries are encoded compactly: in a run of empty blocks each header after the first takes 14 bytes, and a path B KSA transfer takes 79 to 143 bytes. An ordinary settlement measured 154 vB for the commit and 209 vB for the reveal on regtest. A block with no entries, or only path C entries, needs only its header on Bitcoin, because anyone can derive its entries from Bitcoin.

A producer broadcasts a settlement once the block that carries it is 2 blocks deep on the main chain (`SETTLEMENT_DEPTH`), so that a brief fork of the fast lane does not send two conflicting settlements to Bitcoin. The signed transactions travel inside the block, so any node can broadcast them.

### Batching and who pays

Not every block carries a settlement. By default a block carries one when there is a body to land (its own or an earlier block’s) and no earlier settlement is still waiting to confirm; otherwise it leaves its body for the next settlement, unless the bodies waiting, or its own, pass 10 KiB (an eighth of the payload limit). A busy chain therefore sends about one settlement per Bitcoin block, carrying everything since the last one.

The producer whose block carries a settlement pays its Bitcoin fee from its own funding wallet. In return it becomes the **carrier** of every block whose data that settlement lands first, and earns 5% of those blocks’ rewards and half of their path B fees. You pay only KSA on path B, and only your own Bitcoin fee on path C.

### When data does not land

The fast lane depends on its data reaching Bitcoin, so the rules make sure someone lands it:

- **Rescue**: when a settlement cannot confirm (its funding was spent, or its fee stays too low), other nodes rebuild the same payload with their own funding, taking turns in main-chain order.
- **Republish**: anyone may send missing headers and bodies in a payload that names a payee. The payee becomes the carrier of the blocks whose data it lands first, when that data lands more than `ANCHOR_DEPTH` + 2 Bitcoin blocks above their anchor (more than 3 on the signet), which leaves the producers’ own settlements time to land first.
- **Unlock**: nobody receives a block’s rewards or fees until the data of that block and of every block before it is on Bitcoin, so every later producer wants missing data landed.
- **Backlog limit**: when a body is still missing 6 Bitcoin blocks after its block’s anchor (`SETTLEMENT_TIMEOUT`), new blocks may hold only path C entries until it lands. Path B pauses; path C keeps working.

## Finality from Bitcoin

Every node and every indexer decides finality with the same function of Bitcoin data, so they reach the same answer without trusting one another. The headers that have appeared in payloads on Bitcoin form a DAG of their own. At each Bitcoin height, the function takes the heaviest fast-lane chain among those headers and walks it from the last block decided final: a block is **decided final** when its data, and the data of the blocks it merges, has 6 Bitcoin confirmations (`BTC_FINALITY_CONFS`) and executing it gives a valid result. Nodes and indexers report it **final** (`btc_final`) once the Bitcoin block of that decision has 6 confirmations too, so at the earliest five Bitcoin blocks after the sixth confirmation of its data.

What this means when someone builds a competing fast-lane chain:

- Until a block is final, a heavier chain can replace it. That is the risk you weigh when you accept a fast confirmation.
- A heavier chain that keeps its data off Bitcoin cannot become final. A lighter chain that lands its data in time is finalized first, and the heavier one is finalized out.
- When a lighter competing chain appears on Bitcoin and a node’s own chain is still missing there one Bitcoin block later, the node republishes its headers at the next-block fee rate, so the honest chain lands before the other side’s data has six confirmations.
- Fast-lane hashrate alone cannot undo a final block: that takes a Bitcoin reorganization of at least 6 blocks, reaching the Bitcoin block that decided it, and every Bitcoin block mined after that makes the reorganization deeper. [Security](/docs/security/#bitcoin-reorgs) covers Bitcoin reorgs.

Only a valid block is decided final. A block whose anchor, or the anchor of a block it merges, is not on the Bitcoin best chain is excluded first, and a block whose execution is invalid is excluded together with every block built on it; the function then takes the next best chain. Every node’s main chain must pass through the blocks decided final, and a node that lacks one rebuilds it from the data on Bitcoin. `ksana_getChainInfo` reports the newest final block as `finalized`.

## Getting an operation in

You can send an operation in two ways:

- **Path B (sponsored)**: sign the operation with a fee in KSA and send it to any node. A producer includes it within seconds and pays the Bitcoin fee that lands it.
- **Path C (native)**: put the operation in a Bitcoin transaction of your own, in a `KSN1` data output, and pay the Bitcoin fee. Once the transaction has 2 confirmations on signet (5 on mainnet), the fast lane must include it, ahead of every other entry: **forced inclusion**.

A producer may refuse path B operations, but a block that leaves out a path C operation is invalid. Path C is the guarantee that no producer can keep you out, and the way to act with bitcoin alone: in a top-up, one Bitcoin transaction pays a seller for KSA held in an exchange contract. [Operations and fees](/docs/submitting-ops/) covers both paths, the fees and top-ups.

## The indexer

::: figure architecture
Wallets and apps call a node’s JSON-RPC, nodes anchor to Bitcoin and land their settlements there, and the indexer rebuilds the chain from bitcoind alone and checks the state roots.
:::

The indexer connects only to bitcoind, never to a Ksana node. It reads the payloads on Bitcoin, rebuilds the block DAG, chooses the main chain by the same rules as the nodes, executes every block with the same code and checks each block’s state root against its header. It runs the same finality function and reports the same `finalized` block.

So the record does not depend on any Ksana node staying online or honest: if every node vanished, anyone could rebuild the full state from Bitcoin. The indexer disqualifies a block with an invalid body or a wrong state root and chooses its main chain again. [Run an indexer](/docs/run-an-indexer/) shows how to run one and compare it with a node.

## Execution

Contracts are WebAssembly modules, usually written in Rust with `ksana-contract-sdk`, and run by wasmtime 49.0.1. The rules exclude everything that could differ between machines (floating point, unbounded memory and stack, a changing wasmtime version), so the same state and the same entries give the same state root on every computer. Accounts, KSA and other built-in assets are native modules: a transfer needs no contract.

Every operation carries a gas limit, `max_gas`. Ordinary WebAssembly instructions cost 1 gas, host functions and built-in actions have fixed prices (a KSA transfer costs 10,000), and an operation that would use more than its limit fails. An operation that fails while it runs still pays its fee and uses its nonce; everything else it did is rolled back.

State lives in a Jellyfish Merkle tree, and each block header carries the tree’s root after the block executes: the **state root** that nodes and indexers compare. A block that holds no entries and merges none writes no state, so its state root equals its selected parent’s. [Write a contract](/docs/contracts/) starts the contract side.

## The full rules

The specification, `docs/SPEC.md`, holds every rule this page summarizes:

- [§6 Fast-lane blocks, consensus and fork choice]({{repo}}/blob/main/docs/SPEC.md#6-fast-lane-blocks-consensus-and-fork-choice): GHOSTDAG, anchors, difficulty, and [§6.5 BTC-anchored finality]({{repo}}/blob/main/docs/SPEC.md#65-btc-anchored-finality).
- [§7 Settlement transactions and forced inclusion]({{repo}}/blob/main/docs/SPEC.md#7-settlement-transactions-and-forced-inclusion): the data format, settlement, rescue, forced inclusion, batching and republishing.
- [§8 Fees, incentives and unlocking]({{repo}}/blob/main/docs/SPEC.md#8-fees-incentives-and-unlocking): fees, rewards, the carrier and unlocking.
- [§9 VM and execution environment]({{repo}}/blob/main/docs/SPEC.md#9-vm-and-execution-environment) and [§10.3 Standalone indexer]({{repo}}/blob/main/docs/SPEC.md#103-standalone-indexer).
