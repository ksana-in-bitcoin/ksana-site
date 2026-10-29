---
title: Security model
nav: Security
lede: What each mark of an operation relies on, the attacks Ksana is built to resist and how, what has been tested, and what is still open.
description: Ksana's security model, its threats and defences, its audits, simulations, fuzzing and soak tests, its known limitations, and how to report a vulnerability.
---

Ksana has not launched on mainnet. The public signet and devnet restart from genesis whenever a consensus change needs
it, and nothing on them holds value. This page describes what the code does today; the full threat table is §16 of the
[specification]({{repo}}/blob/main/docs/SPEC.md).

## What each mark relies on {#model}

An operation passes three marks, and each one rests on something different. Choose by amount which mark to wait for.

::: figure marks
An operation is fast-confirmed after about 5 seconds, on Bitcoin once the Bitcoin block that confirms its settlement is mined, and final after six Bitcoin confirmations and five more blocks that secure the decision.
:::

| Mark | What it rests on | What can still undo it |
| --- | --- | --- |
| Fast-confirmed (`fast_confirmed`) | The fast lane's proof of work: a main-chain block included and executed the operation | A heavier fast-lane branch, from an attacker with a share of the hashrate or after a Bitcoin reorg deeper than `ANCHOR_DEPTH` |
| On Bitcoin (`settled` for its block) | The data of the block, and of every block in its past, is in Bitcoin blocks, where anyone can read it and an indexer can execute it | The same as fast-confirmed, since the block is not final yet; a Bitcoin reorg can also take the data out of Bitcoin again |
| Final (`btc_final`) | Bitcoin's proof of work: that data had 6 confirmations (`BTC_FINALITY_CONFS`) at the Bitcoin block that decided it, which has 6 confirmations of its own, and the block's execution is valid | Only a Bitcoin reorg of at least 6 blocks, reaching the Bitcoin block that decided it; each Bitcoin block mined after that makes it harder |

Bitcoin stores Ksana's data and orders it, but it does not execute Ksana's rules. Every node and every indexer checks
every block itself, and the indexer recomputes the whole state from Bitcoin data alone, so a block that breaks a rule
cannot become final by landing on Bitcoin.

Finality is decided one Bitcoin block at a time, by the same function in every node and indexer. At each Bitcoin height
it walks the heaviest chain whose headers are on Bitcoin, starting from the last block decided final: each block whose
data has 6 confirmations, whose anchors are on the Bitcoin best chain and whose execution is valid is decided final, and
the main chain must pass through it. Nodes and indexers report such a block final (`btc_final`, `finalized`) once the
Bitcoin block of that decision has 6 confirmations too. A heavier chain that reaches Bitcoin later cannot replace a
final block, so fast-lane hashrate alone cannot undo one.

Decisions follow Bitcoin's best chain: after a Bitcoin reorg, every node and indexer decides again on the new branch,
from the data that branch holds. Only a Bitcoin reorganization can undo a final block, and it has to reach the Bitcoin
block that decided it, which had 6 confirmations when the block was reported final: a reorganization of fewer than 6
blocks never undoes one. With a heavier fast-lane chain on the new Bitcoin branch, a reorganization that deep takes the
block off the final chain; without one, the block is decided again on the new branch, and it leaves the final chain only
if the reorganization also removes its data, 5 blocks deeper still. Every later Bitcoin block makes that harder, as it
does for a Bitcoin transaction, and nodes and indexers raise their highest-level alarm when a block they reported final
is taken back.

## Threats and defences {#threats}

### Reversing a payment {#payment-reversal}

An attacker with a share of the fast lane's hashrate can mine a private branch from the parent of the block that holds
your payment, with a conflicting operation in it, and publish the branch if it becomes heavier. The chance falls the
longer you wait, and it is much higher while the chain is idle. Simulated with the real fork choice
(`reorg_race.rs`, below), an attacker with 10% of the hashrate reverses 6.5% of the payments accepted after one minute
on a busy chain and 0.91% after five, but 33% and 13% on an idle chain; [Confirmations](/docs/confirmations/) has the
full tables.

On an idle chain the honest work arrives in empty blocks that take minutes each, so a payment is protected by little
more than its own block for minutes. On a busy chain an attacker's lucky empty block is worth 12 honest blocks and
counts as soon as it is found. So treat a fast confirmation as final only for small amounts; on a busy chain, wait
about 5 minutes for moderate amounts; on an idle chain, or for large amounts, wait until the operation is final.

With most of the hashrate, an attacker can roll back any block that is not final yet, and renting CPU or GPU hashrate
against Argon2id costs far less than attacking Bitcoin. Final blocks stay out of its reach unless it can also reorganize
Bitcoin, as [What each mark relies on](#model) describes.

### Withholding blocks {#withholding}

Withholding, or selfish mining, means mining blocks in private and publishing them later, so that honest blocks turn
red and lose their rewards. Two forms matter on Ksana.

- **Cheap blocks against a heavy one.** On an idle chain a miner hides more than `GHOSTDAG_K` weight-1 blocks while the
  honest network finds one heavy empty block. When the fork choice counted only blue work, a 5%, 10% or 20% miner took
  30%, 45% or 56% of the honest reward slots this way at no cost. The fork choice now counts a tip's own work, so the
  heavy block wins as soon as it is published and the withheld blocks turn red: in simulation the honest loss is at
  most 1.2% (for a 30% miner), and the attacker loses a tenth to almost half of its own income.
- **A heavy block against cheap ones.** A miner keeps an empty block private, extends it with weight-1 blocks, and
  publishes it before the honest blocks found meanwhile outweigh it; honest blocks beyond the first `GHOSTDAG_K` turn
  red. `GHOSTDAG_K` 16 leaves room for the honest blocks a weight-12 empty block can overtake. Simulated over 2,400
  hours per cell, the attacker takes this share of the honest reward slots and loses none of its own:

| Attacker's hashrate | Busy chain | Idle chain |
| --- | --- | --- |
| 5% | 0 | 0.50% |
| 10% | 0.02% | 2.9% |
| 20% | 1.1% | 9.6% |
| 30% | 10% | 16% |

The idle-chain figures remain open: there the honest blocks are empty blocks found minutes apart, and a private chain
can still put more than `GHOSTDAG_K` blocks in the anticone of one of them.

### Racing a chain onto Bitcoin {#competing-chains}

Finality counts only data that lands on Bitcoin in time. A heavier chain that was withheld and published later cannot
replace final blocks, because the main chain must pass through them. The opposite attack lands a lighter chain's
headers on Bitcoin first, while the network is idle or while honest settlements wait behind a fee spike, so that the
lighter chain's blocks reach 6 confirmations first.

When such a chain has been on Bitcoin for one Bitcoin block and a node's own chain there is still lighter, the node
republishes its headers up to its tip at the next-block fee rate (up to `--max-settlement-feerate`) and bumps its own
waiting settlements to that rate through their P2A output. Once the honest chain is connected on Bitcoin, the candidate
with more chain work is decided final. What remains is the case where no operator pays to land the honest chain's data
for 6 Bitcoin blocks.

### Censorship and path C {#censorship}

Producers choose path B operations freely, so one producer can leave yours out, but any other producer can include it,
and who produces the next block changes with the hashrate. Path C is the guarantee: once your Bitcoin transaction has
`NATIVE_CONFIRMATIONS` plus `ANCHOR_DEPTH` confirmations (2 on signet, 5 on mainnet), every block must include it, in
Bitcoin order, and a block that leaves it out is invalid. Forced-inclusion entries are not bound by the block gas
limit.

Nobody can copy your path C operation into another transaction: its signature commits to the first input of the
transaction that carries it, so a copy fails authentication and does not use your nonce. Bitcoin miners still decide
when your transaction confirms, as for any Bitcoin transaction, and Bitcoin Core relays its large `OP_RETURN` output by
default from version 30. If producers ever became concentrated and censored, the specification names inclusion lists,
added through a protocol upgrade, as the answer.

### Data that never lands {#unsettled-data}

A producer can mine a block and never put its data on Bitcoin. Ksana answers in four ways:

- **Anyone can land it.** Any node can rebuild the settlement with its own funding (a rescue) or republish the data:
  the block's producer goes first, then the producers of the main-chain blocks after it, then every other node. A
  settlement claim in the Bitcoin mempool holds a rescue back for at most 8 Bitcoin blocks (`CLAIM_PATIENCE`), and a
  node bumps a settlement of its own that waits 2 Bitcoin blocks below bitcoind's fee estimate, or 2 Bitcoin blocks at
  all while the mempool has room (`BUMP_AFTER`).
- **Nobody is paid until it lands.** Rewards and path B fees unlock only once a block and its whole past are settled,
  so every later producer has a reason to land the missing data. The carrier's share goes to the producer whose
  settlement first carries the data, or to the payee of a republish that lands it more than `ANCHOR_DEPTH` + 2 Bitcoin
  blocks above the block's anchor.
- **The backlog limit.** When a body has waited 6 Bitcoin blocks after its anchor (`SETTLEMENT_TIMEOUT`), new blocks may
  hold only forced-inclusion entries until it lands. Path B pauses rather than build on data nobody can check, path C
  goes on, and the fast lane does not roll back.
- **No block that cannot land.** A block whose body would not fit in a payload is invalid, and a settlement
  transaction must have `nLockTime` 0 and `nSequence` `0xFFFFFFFD` on every input, so it cannot carry a time lock.

### Bitcoin reorgs {#bitcoin-reorgs}

Producers anchor `ANCHOR_DEPTH` blocks below their Bitcoin tip, so a Bitcoin reorg of at most that depth (1 on signet,
2 on mainnet) moves no Ksana block. A deeper reorg takes the Ksana blocks anchored on the orphaned Bitcoin blocks off
the main chain. Their path B operations return to the entry pool and are included again on the new branch with the
same op ID; their path C operations are included again once their transactions confirm on the new chain, or are gone
if the reorg double-spent them.

A Bitcoin miner able to make reorgs deeper than `ANCHOR_DEPTH` can prepare a double spend in a fast-lane branch
anchored on its withheld Bitcoin blocks: against it, a fast confirmation is worth its anchor's Bitcoin confirmations,
and reversing a block produced m Bitcoin blocks ago takes a reorg of at least `ANCHOR_DEPTH` + 1 + m blocks. With
pruning on, a reorg that reaches below what a node keeps, at least 144 blocks deep, stops the node for a resync and
makes an indexer start again from the genesis anchor.

Final blocks follow Bitcoin's best chain too (see [What each mark relies on](#model)): only a Bitcoin reorg of at least
6 blocks can undo one, each Bitcoin block mined after it became final makes that harder, and a reorg deep enough to
orphan the block's anchor, which lies below its data, takes the block off the main chain like any block anchored there.

### Blocks anchored off Bitcoin {#unanchored-blocks}

A block can name a Bitcoin block that is not on the Bitcoin best chain, because its anchor was forged or because a
reorg orphaned it. Such a block, and any block that merges it, is excluded from finality before anything else is asked
about it. Producers never merge it, the main chain never takes it, and a node holds back a block from a peer that
anchors above the node's own Bitcoin tip less `ANCHOR_DEPTH` (unless its parents already anchor that high) until its
Bitcoin view catches up. Its forced-inclusion entries must also be checkable against the current Bitcoin chain, so it
cannot carry a body that the indexer could never determine.

### Invalid blocks {#invalid-blocks}

Every node checks every block: proof of work, anchor, timestamps, forced inclusion, body size, gas and, after executing
it, the state root. A block that breaks a rule is rejected together with every block built on it. A block that fails
only in execution is disqualified: it stays in the block DAG, other blocks can merge it, but neither it nor any block
whose selected chain passes through it can be on the main chain.

Bitcoin cannot tell an invalid block from a valid one, so an attacker could land one on Bitcoin first. Before a block is
decided final, finality asks for its verdict: the result of executing it on the finalized tip, the same execution the
indexer runs. An invalid candidate is excluded, with every block whose selected chain passes through it, and the next
best candidate is judged instead. Every node and indexer on the same Bitcoin chain reaches the same verdict, so a final
block could be invalid only through a non-determinism bug; the indexer would then stop and every node raise an alert.

Determinism has its own guards: consensus code uses no floating point, no system time and no unordered iteration,
returns errors instead of panicking, and a two-process test compares every block's state root with fixed values on
x86_64 and aarch64.

### Other defences {#other-defences}

| Threat | Defence |
| --- | --- |
| Timestamps pushed ahead to lower the difficulty | A timestamp may be at most 4 hours past the anchor's Bitcoin block time (`MAX_TIMESTAMP_AHEAD_OF_ANCHOR`), so one block can raise the next block's target at most 4 times |
| Empty blocks spammed onto Bitcoin | An empty block needs 12 to 120 times the work for the same reward per unit of time, and in a run each header takes 14 bytes |
| A signature replayed elsewhere | Tagged hashes, the chain ID and the nonce in every VmOp; a path C signature commits to its transaction's first input |
| KSA sent to a Bitcoin address, or BTC to a Ksana account | An account is a Taproot address, so both land on the same key, and clients refuse other address types as accounts. A contract ID is not a key: never send bitcoin to one ([Accounts](/docs/accounts/#contracts-have-ids-not-addresses)) |
| Contracts that exhaust a node | Exact gas metering, memory, instance, call depth and stack limits, and the block gas limit; a read-only `ksana_call` gets at most `BLOCK_GAS_LIMIT` gas, 4 at a time per node |
| Spam through the entry pool or P2P | Signature, nonce and balance checks on admission, per-account limits, a byte cap with eviction, a capped orphan pool, peer scoring and bans |
| A client signing for the wrong network | `ksana-cli` and the web wallet take the network from the node's chain ID before anything is signed, and the TypeScript SDK has no default network |
| A producer's hot wallet stolen | The funding key is separate from the `--producer` account, and `--revenue-address` with `--hot-wallet-cap-sat` sends settlement change elsewhere above a cap |

::: warning Signing a hex message
A browser wallet signs a Ksana operation as a BIP322 message of 64 hex digits, the operation's signature hash. A site
that asks you to sign a "random" 64-hex-digit string may be presenting one of your operations, so sign such messages
only on pages you trust.
:::

## What has been tested {#testing}

Two internal security audits reviewed the code on 2026-10-06. They do not replace an independent audit, which the
specification lists as work to do before mainnet.

| Audit | Findings | Outcome |
| --- | --- | --- |
| First internal audit (`ef07411`) | 42 | Fixed through local hardening (D-098) and new consensus rules (D-100, with devnet and signet restarted from genesis); all three critical findings and four of the five high ones are fixed, and the fifth waits for the gas calibration |
| Second internal audit (`11f0576`, re-checked at `5819b26`) | 22 (2 critical, 1 high, 9 medium, 10 low) and 8 notes | The critical and high findings and three medium ones were fixed before the code merged, the four other medium ones later (D-102, D-106, D-130, D-135) and two low ones with them (D-135); 8 are open (all low) and 2 partly fixed |

The second report, with the status of every finding of both audits, is
[audits/2026-10-06-second-internal-audit.md]({{repo}}/blob/main/audits/2026-10-06-second-internal-audit.md); the first
report is not in the repository.

Beyond the audits, these checks run:

| Check | What it shows | When |
| --- | --- | --- |
| Unit, property and vector tests | Each rule; the encodings against test vectors shared by Rust and TypeScript | CI |
| Determinism test | Two processes reach the same state root for every block of a fixed scenario, against golden values | CI, on x86_64 and aarch64 |
| Fuzzing (cargo-fuzz) | Five targets (VmOp decoding, payload decoding, settlement transactions, host function parameters, BIP322 witnesses) never crash, and decoding stays canonical | CI, 60 seconds per target |
| Differential fuzzing | The TypeScript SDK and the contract playground's codec read every input as the Rust code does: operations, payloads, Bitcoin transactions and their data carriers, addresses, signatures, PoW, rewards, token events and contract values | CI: 60 seconds of fuzzing, and a sweep of the shared vectors and generated inputs |
| Regtest end-to-end tests | Paths B and C, top-ups, settlement and the indexer against a real bitcoind | CI |
| Devnet smoke test | Three nodes converge, a transfer goes through, and the indexer's state root matches the node's at every height; then 3 minutes of random operations | CI |
| Soak test | Random path B and path C operations for hours, optionally with random Bitcoin reorgs of 1 to 3 blocks, checking the indexer against the nodes throughout | On demand: 5 hours on a GitHub runner, 10 hours on the project owner's Mac |
| Adversarial simulations | Payment reversal, withholding, and Bitcoin reorgs of 1 to `ANCHOR_DEPTH` + 2, 6 and 7 blocks against anchor depths 0 to 3 | On demand |

Recent 10-hour soak tests on the project owner's Mac ran 4,007 path B and 2,010 path C operations without a failure,
ending with the three nodes and the indexer at the same height (7,231); and, with 39 random Bitcoin reorgs, 3,675 path B
and 1,863 path C operations, after each of which finality passed the fast-lane tip again. In that run 9 path C
operations failed after a reorg, the limitation described below.

You can run the simulations yourself from the repository:

```sh title="Adversarial simulations"
cargo test -p ksana-consensus --release --test reorg_race -- --ignored --nocapture
cargo test -p ksana-consensus --release --test selfish_mining -- --ignored --nocapture
cargo test -p ksana-indexer --release --test deep_reorg -- --ignored --nocapture
```

`KSANA_RACE_TRIALS` sets the number of races and `KSANA_SM_HOURS` the simulated hours; `KSANA_SM_K` and `KSANA_SM_N`
replay the withholding table with other values of `GHOSTDAG_K` and `EMPTY_BLOCK_DIFFICULTY`.

## Known limitations {#limitations}

- **Idle-chain confirmations.** A payment made while the chain is idle is weakly protected for minutes (see
  [Reversing a payment](#payment-reversal)); wait until it is final.
- **Withholding a heavy block on an idle chain.** A 5% to 30% miner can still take 0.50% to 16% of the honest reward
  slots (see [Withholding blocks](#withholding)).
- **Values still to measure.** The GPU advantage on Argon2id (estimated at 10 to 30 times), the propagation delay of a
  real network (`GHOSTDAG_K` 16 tolerates about 17.6 seconds), the gas table behind `BLOCK_GAS_LIMIT`, and
  `SETTLEMENT_TIMEOUT` and the carrier reward on a real fee market are to be measured before mainnet.
- **Landing races.** A lighter chain can become final if nobody pays to land the honest chain's data for 6 Bitcoin
  blocks.
- **Path C after a deep Bitcoin reorg.** An operation that is included again runs in the new Bitcoin order and fails if
  its nonce is then out of turn. The account's later operations wait until the gap is filled, a node's entry pool keeps
  at most 8 of them, and you resubmit the failed one.
- **Rescue costs.** A rescue copies the payload, so the carrier reward stays with the block's original producer while
  the rescuer pays the Bitcoin fee.
- **Open audit findings.** Mostly local denial-of-service hardening: valid side-branch headers on Bitcoin, which every
  node keeps until pruning at the price of their proof of work, the gas price of compiling contract code, and
  client-side items in `ksana-cli`, the SDK and the web wallet.
- **Outside the audits.** wasmtime's own correctness, Bitcoin Core, the browser wallets, performance under real
  network load, and reward economics beyond the simulations.

## Report a vulnerability {#reporting}

Do not describe a vulnerability in an issue, a discussion or a pull request. Report it privately through GitHub's
private vulnerability reporting, with [Report a vulnerability]({{repo}}/security/advisories/new) in the repository's
Security tab, or send it to a maintainer of the `ksana-in-bitcoin` organization through a private channel you already
share with them. Include:

- the affected component (crate, SDK, contract or web app) and the commit you looked at;
- what an attacker can do, what it costs them, and who is affected (one node, every node, the indexer, users' funds);
- the steps or a test that reproduces it.

The report and its follow-up stay private until the fix is merged. What counts as a vulnerability (consensus
divergence, stopping production, settlement, finality or the indexer, denial of service, funds taken, locked or
created outside the rules, crashes from external input) is listed in
[SECURITY.md]({{repo}}/blob/main/SECURITY.md).
