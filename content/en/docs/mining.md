---
title: Mining and producing blocks
nav: Mining
lede: Anyone can produce Ksana blocks with an ordinary CPU. Run a node with a producer account and a Bitcoin funding wallet, mine with Argon2id, and earn KSA for the blocks you make and the data you land on Bitcoin.
description: Producing Ksana blocks. What a producer needs, the Argon2id proof of work, aserti3-2d difficulty by DAA score, two-speed difficulty for empty blocks, GHOSTDAG, settlement costs, batching, CPFP bumps, the fee policy flags and the rewards.
---

Producing blocks is open to anyone: no stake, no registration and no permission. A producer is a `ksana-node` that collects operations, executes them, solves a proof of work, and pays to land its blocks’ data on Bitcoin; it earns KSA in return. Mainnet has not launched, so today you mine on the [public signet](/docs/signet/). [Run a node](/docs/run-a-node/) has the setup step by step.

## What a producer needs

- **A node and bitcoind**: `ksana-node` with `--producer <account>`, the account that receives your rewards, connected to a bitcoind on the same network (started with `-txindex`) and to peers.
- **A funding key**: `--btc-funding-key-file`, a separate key whose Taproot address holds the bitcoin that pays for settlements. On signet and mainnet the node also needs `--btc-funding-wallet`, a watch-only wallet in the same bitcoind that lists the funding address’s coins, because scanning signet’s whole UTXO set takes 30 to 50 seconds.
- **A CPU core**: `ksana-node` mines on a single thread.

The funding key is optional. Without one, the node still produces blocks with path B operations, and other producers land their data and take the carrier reward. If no one does, the backlog limit stops path B after 6 Bitcoin blocks ([How it works](/docs/how-it-works/)).

Each block you make follows the same steps: pick the anchor, `ANCHOR_DEPTH` Bitcoin blocks below your tip; merge the other tips of the DAG; put in the path C entries the block must force, then an unlock entry, then path B operations by fee rate; execute; solve the proof of work; sign the settlement, if the block carries one; and broadcast the block to peers. The settlement goes to Bitcoin once the block is 2 blocks deep.

## Argon2id proof of work

The proof of work is Argon2id (RFC 9106) over the Borsh-encoded block header, with 2 MiB of memory, one pass and one lane. The salt is `ksana-pow` followed by the chain ID, so work done for one network is worthless on another, and the 32-byte output is read as a little-endian number that must not exceed the block’s target. The block hash, the block’s identifier, stays `sha256d` of the header.

One evaluation takes about 1 ms on one core of an ordinary CPU, and a header takes about 13 ms to verify in JavaScript, so a browser can check a block itself. Syncing a busy year of headers costs about 1.7 hours of one core.

Why Argon2id:

- **Not SHA-256.** Bitcoin’s ASIC hashrate could be rented to overwhelm an independent SHA-256 chain, and ordinary computers could not take part.
- **Not RandomX.** Verifying one header would take 33 ms and 256 MB of memory (or 2 GB kept resident), and browsers have no practical way to run it.
- **Not merged mining.** Every merged-mined header would have to carry a Bitcoin header, a coinbase and a Merkle branch, 700 to 900 bytes, onto Bitcoin with it.
- **Not proof of stake.** Ksana’s security comes from Bitcoin and from hashrate, and holding KSA should not decide who produces blocks.

Argon2id is not CPU-only. At 2 MiB its speed is bound by memory bandwidth, a GPU has 10 to 30 times an ordinary CPU’s, and its advantage in hashrate per unit of cost is estimated to be of the same order: far smaller than that of ASICs on SHA-256, but not zero, and not measured yet. Before mainnet the memory and the number of passes may be retuned by the measured GPU advantage.

## Difficulty

Difficulty adjusts every block with aserti3-2d, Bitcoin Cash’s algorithm, anchored at the genesis block and counted by DAA score: the target is one unit of DAA score every 5 seconds, with a half-life of 7,200 seconds. A 10-fold change of hashrate takes about 10,000 blocks to absorb, and an idle chain’s difficulty wanders by about 20%.

| Network | Lowest difficulty (`POW_LIMIT_BITS`) | What it means |
| --- | --- | --- |
| mainnet | `0x1f00ffff` | About 65,536 evaluations per block: about 13 cores for a block every 5 seconds |
| signet, devnet | `0x207fffff` | Bitcoin regtest’s easiest target |

A genesis config can start harder: the signet’s genesis `bits`, `0x1f068db8`, expects about 10,000 evaluations per block, sized for its two seed nodes on one core each.

A block’s timestamp must be later than the median of the 11 blocks before it on its selected chain, at most 15 seconds ahead of the receiving node’s clock, and at most 4 hours ahead of its anchor’s Bitcoin block time. The last rule keeps a privately mined chain from borrowing a large difficulty discount with made-up times; it also means the fast lane pauses if Bitcoin finds no block for more than about 4 hours.

## Two-speed difficulty

When a producer has nothing to include, no operation and no unlock entry, it makes an **empty block**, and empty blocks are harder. The first empty block after a block with entries has weight 12; each further one in a row on the selected chain doubles, up to 120: 12, 24, 48, 96, then 120. A block of weight w must meet a target w times smaller, adds w to the DAA score and takes w reward slots. So an idle chain makes a block about every 1, 2, 4, 8 and then 10 minutes.

The moment an operation reaches the entry pool, producers drop the empty-block template and mine a block of weight 1, at the normal target: the first operation waits about one ordinary block, 5 seconds. Empty and non-empty blocks with the same parents have the same `bits`, so nothing else changes.

Why empty blocks weigh more:

- **Every header lands on Bitcoin**, and the indexer and finality need them all. Compared with a fixed weight of 12, the streak cuts an idle day from about 1,440 headers (about 26 KB) to about 144 (about 2.6 KB).
- **Banning empty blocks would cost more.** Rewards make miners produce the cheapest valid block the difficulty allows, so they would fill blocks with self-transfers instead, about 70 times the bytes.
- **The cap matches Bitcoin.** At 120 an idle chain still makes about one header per Bitcoin block, so finality can advance block by block.
- **Rewards are fair either way.** A block of weight w earns w slots, so the expected reward per unit of time is the same for empty and non-empty blocks, and neither making empty blocks nor breaking a streak pays.

## GHOSTDAG

Blocks found at nearly the same time are all kept: a block names up to 10 parents, and GHOSTDAG orders the DAG. K = 16 bounds how many blue blocks a blue block may have outside its own past and future; blocks beyond that, ones that stayed out of sight too long, are red. Red blocks still have their entries executed and their path B fees paid, but they earn no block reward.

A block’s merge set holds at most 128 blocks, its selected parent included, and only blocks whose blue score is at most 720 below its selected parent’s (`MERGE_DEPTH`, about an hour at 5-second blocks) and whose selected chain passes through its merge-depth root. That keeps every check close to the tip, so a long side chain forked from an old block can never be merged.

The selected parent and the main chain go by **chain work**: the work of a block’s blue past plus its own. Counting a block’s own work matters on an idle chain. Without it, a miner could withhold a run of cheap weight-1 blocks while an honest heavy empty block was being found, then publish them and turn the honest block red.

## Settlement costs

The producer whose block carries a settlement pays its Bitcoin fee. A commit and reveal pair costs about 265 vB plus a quarter of a vbyte per payload byte, plus the 240 sats of the reveal’s P2A output; on regtest an ordinary pair measured 154 vB for the commit and 209 vB for the reveal, with a 390-byte payload. An idle network still sends a pair about every two Bitcoin blocks, because the unlock entry that pays out rewards is an entry, so its block needs a body on Bitcoin. On the idle signet that is 62 to 72 pairs a day for the whole network, about 1,000 sats each at 2 sat/vB.

Settlement batching is on by default: a block leaves its body to the next settlement while an earlier one is still waiting to confirm, so a busy chain sends about one settlement per Bitcoin block. `--no-settlement-batching` makes every block with a body carry its own settlement: its operations become final sooner, at the cost of more Bitcoin fees.

Settlements spend only confirmed outputs and never each other, so you can fund at most as many settlements per Bitcoin block as your funding address has confirmed outputs. `--funding-pool-target` (default 64) keeps that many by splitting the largest output into pieces of at least 100,000 sats; 0 turns splitting off.

### Fee policy

These flags are your own policy. They decide what your node pays for every Bitcoin transaction it sends: settlements, rescues, republishes, splits and fee bumps.

| Flag | Default | Effect |
| --- | --- | --- |
| `--settlement-conf-target` | 3 | Bitcoin blocks for bitcoind’s `estimatesmartfee`; the next block while a lighter competing chain is on Bitcoin |
| `--settlement-feerate` | 2 sat/vB | The floor: paid while bitcoind’s mempool holds at most half a block, and when bitcoind has no estimate |
| `--max-settlement-feerate` | 100 sat/vB | The cap |
| `--revenue-address` | none | With `--hot-wallet-cap-sat` (1,000,000 sats): settlement change goes here while the funding address keeps at least the cap |

A pair your node sent that waits 2 Bitcoin blocks below bitcoind’s estimate gets a child transaction (CPFP) spending the reveal’s P2A output and one funding output, which lifts both to the estimate; if the estimate rises again, a richer child replaces it. While the mempool has room, a pair still waiting after 2 Bitcoin blocks is lifted to at least twice its own rate, and twice that again for every further block, up to the cap, whatever bitcoind estimates. Anyone can spend that P2A output, so someone may attach a large, cheap child to it first, which your child would have to outbid in full; when bitcoind refuses your child for that reason, your node sends the pair’s data again in a new pair of its own at the same rate instead. When a settlement cannot confirm at all, other nodes rescue it with their own funding, in turns that follow the main chain.

The signet’s two seed nodes run with `--settlement-feerate 2 --max-settlement-feerate 5 --min-block-interval-ms 1000 --funding-pool-target 0` and a watch-only funding wallet; `signet/ksana-signet.sh` in the repository has their full command line.

## Rewards for producers

You earn, for each block you make, the producer’s part of its reward slots at unlock, and the carrier’s 5% too when you carried the block yourself. You also earn its path B fees (half of them when someone else carried it), and as a carrier, 5% of each slot and half of the path B fees of other blocks whose data your settlements land first. Everything is paid only once the data is on Bitcoin; [KSA and rewards](/docs/ksa/) explains the split and the unlock.

The full rules are in [SPEC §6.6]({{repo}}/blob/main/docs/SPEC.md#66-ghostdag-and-work) (GHOSTDAG, work and two-speed difficulty), [§6.7]({{repo}}/blob/main/docs/SPEC.md#67-difficulty-adjustment-asert) (difficulty) and [§7.7]({{repo}}/blob/main/docs/SPEC.md#77-the-producers-funding-wallet) (the funding wallet and fee rate).
