---
title: Glossary
lede: Short definitions of the terms these docs use, in alphabetical order, each with a link to the page that explains it.
description: Definitions of Ksana's terms, from account and anchor to two-speed difficulty and withholding.
---

## A

### ABI

The binary interface between a contract and the node: the module's exports `ksana_alloc` and `ksana_call`, the
Borsh-encoded input and result of a call, and the host functions of the import module `ksana`. See
[Host functions](/docs/host-functions/).

### Account

The 32-byte output key (BIP86) of a Taproot address, written as that address (`tb1p` on signet, `bc1p` on mainnet) or
as 64 hex digits. The key that holds your bitcoin also controls your KSA, and each stays on its own chain. See
[Accounts](/docs/accounts/).

### Anchor

The Bitcoin block, by height and hash, that every Ksana block names in its header (`btc_anchor`). Producers anchor
`ANCHOR_DEPTH` blocks below their Bitcoin tip (1 on signet, 2 on mainnet), and everything a block's execution reads
from Bitcoin lies at or below its anchor. See [How it works](/docs/how-it-works/).

### Anchor-invalid block

A block anchored, or merging a block anchored, on a Bitcoin block that is not on the Bitcoin best chain, usually after
a Bitcoin reorg. Nodes still accept it as history, but it can never become final, so producers never merge it and the
main chain never takes it. See [Security](/docs/security/#unanchored-blocks).

### Argon2id

The memory-hard function (RFC 9106) that Ksana's proof of work evaluates on each block header: 2 MiB of memory, one
pass and one lane, about 1 ms per evaluation on one CPU core. A browser can verify a header too. See
[Mining](/docs/mining/).

### ASERT

The difficulty adjustment (aserti3-2d). It sets each block's target from how far the chain runs ahead of or behind a
schedule of one unit of DAA score every 5 seconds, with a half-life of 7,200 seconds. See [Mining](/docs/mining/).

### Asset

What an account holds in its balances: KSA, whose asset ID is 32 zero bytes, or an asset that a contract issues, whose
ID is the SHA-256 hash of the contract's ID and a sub-ID. A token contract, such as a KS-20 token, is something else: it
keeps its balances in its own storage. See [Assets and tokens](/docs/tokens/).

### Attached funds

Built-in assets that an operation or a contract call sends along to the contract it calls or deploys: at most 16
(`MAX_CALL_FUNDS`), in strictly ascending order of asset ID, each above zero. They move to the contract before it runs,
and a list that breaks these rules fails the operation. See [Operations and fees](/docs/submitting-ops/).

## B

### Base unit

The smallest amount of KSA: 1 KSA is 100,000,000 base units. The RPC, `ksana-cli` and genesis configs write every
amount as a whole number of base units. See [KSA and rewards](/docs/ksa/).

### BIP322

Bitcoin's standard for signing a message with an address. Browser wallets such as Unisat and Xverse sign an operation
as a BIP322 simple signature of your Taproot address, and the message is the operation's signature hash in hex. See
[Accounts](/docs/accounts/).

### BIP340

The Schnorr signature scheme of Taproot. `ksana-cli` and the TypeScript SDK sign operations with BIP340 directly, using
the tweaked key of your account's Taproot address. See [Accounts](/docs/accounts/).

### Block

A fast-lane block: a header (version, height, parents, anchor, entries root, state root, producer, timestamp,
difficulty bits and nonce) and its list of entries. A producer finds it by proof of work, and GHOSTDAG gives it its
place in the order. See [How it works](/docs/how-it-works/).

### Block DAG

The graph that Ksana's blocks form: a block can have up to 10 parents, so blocks found at the same time are merged
rather than thrown away. GHOSTDAG orders it. See [Mining](/docs/mining/).

### Block share

The part of a reward slot paid to the block share account that the genesis config names, before the carrier and the
producer, while the protocol's rules set one. See [KSA and rewards](/docs/ksa/#who-gets-each-slot).

### Blue and red blocks

GHOSTDAG colors the blocks that a block merges: blue when they fit a well-connected set (a blue block has at most
`GHOSTDAG_K`, 16, blue blocks in its anticone), red otherwise. The entries of both execute, but only main-chain and
blue blocks earn block rewards. See [Mining](/docs/mining/).

### Blue score and blue work

A block's blue score counts the blue blocks in its past, and its blue work sums their proof of work. `MERGE_DEPTH` and
the pruning depth are measured in blue score. See [Mining](/docs/mining/).

### Borsh

The binary encoding of Ksana's operations, block headers and contract calls: fields in a fixed order, integers
little-endian, and a 4-byte length before each list or string. The field order is the format, so changing it is a
consensus change. See [Operations and fees](/docs/submitting-ops/).

### BTC-final

The RPC's name (`btc_final`) for the third mark of an operation or a block. See [Final](#final).

## C

### Carrier

The account credited for landing a block's data on Bitcoin: the producer of the block whose settlement first carried
it, or the payee of a republish payload that landed it more than `ANCHOR_DEPTH` + 2 Bitcoin blocks above the block's
anchor. The carrier receives 5% of the block's reward slots and half of its path B fees. See
[KSA and rewards](/docs/ksa/).

### Chain ID

The number of a network: 1001 for devnet, 1002 for signet and 1000 for mainnet. Every VmOp carries it, so an operation
signed for one network is invalid on another. See [Parameters](/docs/parameters/).

### Chain work

A block's blue work plus its own work. The fork choice and the selected parent go by it, so a heavy block counts as
soon as it is published, not only once a block is built on it. See [Security](/docs/security/).

### Checkpoint

The file `pruning.ckpt` in a node's or indexer's data directory: what pruning keeps in memory (the block DAG, the
finality state, the bodies and the Bitcoin view), so that a restart continues from it. See
[Run a node](/docs/run-a-node/).

### Coinbase

The first transaction of every Bitcoin block, which pays its miner. A coinbase never carries a path C operation, and a
contract that checks a payment asks for the coinbase's Merkle proof too, because it pins the depth of the block's
transaction tree. See [Bitcoin in contracts](/docs/bitcoin-in-contracts/).

### Commit and reveal transactions

The two Bitcoin transactions of a settlement. The commit transaction spends the producer's funding and creates an
output that commits to a Taproot script; the reveal transaction spends that output and shows the script, the envelope
holding the payload, in its witness. See [How it works](/docs/how-it-works/).

### Compact encoding

How payloads stay small: each header is written relative to the ones before it, and the entries of a payload share one
dictionary of keys. In a run of empty blocks, each header after the first takes 14 bytes. See
[How it works](/docs/how-it-works/).

### Competing chain

A fork that is lighter than a node's main chain but has put more chain work on Bitcoin than the node's own chain has
so far. If that is still so one Bitcoin block after it appeared, the node republishes its own headers up to its tip at
the next-block fee rate, so that the heavier chain lands in time to become final. See
[Security](/docs/security/#competing-chains).

### Contract

A WebAssembly program stored on Ksana by a deploy operation and run by calls. It has a contract ID, its own storage and
balances, and it can call other contracts and read Bitcoin data. See [Write a contract](/docs/contracts/).

### Contract ID

The 32-byte ID of a contract, written as 64 hex digits; a contract has no address. A deployed contract's ID is the
SHA-256 hash of the deploying account, that operation's nonce and the code's hash; one that a contract creates with
`create_contract` gets the hash of the creating contract's ID, a 32-byte salt and the code's hash. See
[Accounts](/docs/accounts/).

### CPFP bump

Child pays for parent: a node raises the fee of a settlement it sent that waits in the Bitcoin mempool, by spending the
reveal transaction's 240-sat P2A output in a child transaction with a higher fee. See [Mining](/docs/mining/).

## D

### DAA score

A block's measure of time for difficulty, rewards and upgrades: the weights of all the blocks in its past (the genesis
block aside) plus its own. A block with entries weighs 1 and an empty block 12 to 120, and the target is one unit of
DAA score every 5 seconds. See [Mining](/docs/mining/).

### Determinism

Every node and indexer computes the same state from the same blocks: consensus code uses no floating point, no system
time and no unordered iteration. A test runs the same chain in two processes, on x86_64 and on aarch64, and compares
each block's state root with fixed values. See [How it works](/docs/how-it-works/).

### devnet

A local network on Bitcoin regtest (chain ID 1001) for development; `devnet/docker-compose.yml` starts its bitcoind,
and with `--profile nodes` three nodes and an indexer. See [Parameters](/docs/parameters/).

### Disqualified block

A block that breaks a rule only its execution can check, such as a state root that does not match or an entry that
fails in strict mode. It and every block whose selected chain passes through it are kept off the main chain, but it
stays in the block DAG and other blocks can merge it. See [Security](/docs/security/#invalid-blocks).

## E

### Empty block

A block with no entries. It needs 12 times the work of a block with entries, and each further empty block in a row
doubles that, up to 120 times, so an idle chain makes a block about every 1 to 10 minutes. See
[Mining](/docs/mining/).

### Empty-block streak

The number of empty blocks in a row on the selected chain, up to and including a block: 0 for a block with entries.
It sets an empty block's weight: 12 for the first, doubling with each one after it, at most 120. See
[Mining](/docs/mining/).

### Entry

One item of a block's list: a forced-inclusion entry (a path C operation), an unlock entry or a path B entry, in that
order. See [Operations and fees](/docs/submitting-ops/).

### Entry pool

A node's pool of path B operations waiting for a block, its mempool. By default it holds up to 10,000 operations, 64
per account, and admits only fees at or above the node's relay floor. See
[Operations and fees](/docs/submitting-ops/).

### Envelope

The Taproot script in a reveal transaction's witness that carries a payload:
`<key> OP_CHECKSIG OP_FALSE OP_IF KSN1 <chunks> OP_ENDIF`. The commit transaction's output commits to it, so nobody can
swap the payload. See [How it works](/docs/how-it-works/).

### Event

A record that a contract emits while it runs (`emit_event`). Events appear in the operation's receipt, not in the state
root, and are dropped when the operation fails. See [Host functions](/docs/host-functions/).

### Exchange contract

A contract that sells KSA for BTC, such as the example `ksa-exchange`. A seller locks KSA for a buyer at a price, and
the buyer's Bitcoin transaction pays the seller and claims the KSA (a top-up). See
[Operations and fees](/docs/submitting-ops/).

### Excluded block

A block that the finality rule passes over at some Bitcoin height, because it is anchored off the Bitcoin best chain
or its execution is invalid. Every block whose selected chain passes through it is excluded with it, and a Bitcoin
reorg can revoke the exclusion. See [Security](/docs/security/#invalid-blocks).

## F

### Failed operation

An included operation that did not take effect, while its block stays valid. When its action fails (it runs out of
gas, a contract reverts or a balance is short), the action's changes are rolled back but its nonce is used, and a
path B operation still pays its fee. A path C operation that fails its checks (version, chain ID, length, fee mode,
signature or nonce) is recorded as failed without using its nonce. See [Operations and fees](/docs/submitting-ops/).

### Fast lane

Ksana's own proof-of-work chain, which orders and executes operations in about 5 seconds, while Bitcoin stores its data
and decides its finality. See [How it works](/docs/how-it-works/).

### Fast-confirmed

The first mark of an operation, about 5 seconds after you submit it on path B: a main-chain block included and executed
it (`fast_confirmed` in the RPC). It rests on the fast lane's hashrate alone. See
[Confirmations](/docs/confirmations/).

### Faucet

The signet service at `{{signet.faucet}}` that sends 100 test KSA to an account once a day. See
[Public signet](/docs/signet/).

### Fee rate

For a path B operation, its fee per KiB of cost, where cost is the larger of its encoded size and its `max_gas`
converted to bytes; producers pack operations by fee rate. For a Bitcoin transaction, sats per virtual byte. See
[Operations and fees](/docs/submitting-ops/).

### Final

The third mark of an operation (BTC-final, `btc_final` in the RPC): the block that accepted it is on the finalized
chain. Its data, and the data of every block in its past, had 6 Bitcoin confirmations at the Bitcoin block that decided
it final, which has 6 confirmations of its own, and its execution is valid. Fast-lane hashrate alone cannot undo it:
that takes a Bitcoin reorg of at least 6 blocks. See [Confirmations](/docs/confirmations/).

### Finality

The rule that decides, from Bitcoin data alone and one Bitcoin block at a time, which Ksana blocks are final. Every
node and indexer reaches the same answer, and a heavier chain that lands on Bitcoin too late cannot replace a final
block. See [How it works](/docs/how-it-works/).

### Finalized tip

The newest block decided final; the main chain must pass through it. The `finalized` that `ksana_getChainInfo` and
`indexer_status` report is the BTC-final tip instead: the newest block reported final, once the Bitcoin block of its
decision has 6 confirmations. See [Confirmations](/docs/confirmations/).

### Forced inclusion

The rule that every block must begin with the path C transactions that confirmed on Bitcoin within its window, in
Bitcoin order; a block that leaves one out is invalid. A transaction is due once it has `NATIVE_CONFIRMATIONS` plus
`ANCHOR_DEPTH` confirmations: 2 on signet, 5 on mainnet. See [Operations and fees](/docs/submitting-ops/).

### Fork choice

The rule that picks the main chain: the eligible tip with the most chain work, the larger hash winning a tie. A block
is not eligible when it, or a block it merges, is anchored off the Bitcoin best chain. See
[Security](/docs/security/).

### Funding key

The Bitcoin key (`--btc-funding-key-file`) whose coins pay for a producer's settlements; its Taproot address must hold
confirmed bitcoin. On signet and mainnet the node finds those coins through a watch-only wallet of its bitcoind
(`--btc-funding-wallet`). See [Run a node](/docs/run-a-node/).

## G

### Gas

The unit of execution cost: 1 gas is one unit of wasmtime fuel, and host functions and built-in actions add fixed
prices. Each operation sets its `max_gas`, and a block's entries may add up to 100,000,000 gas (`BLOCK_GAS_LIMIT`),
which only forced-inclusion entries can exceed. See [Host functions](/docs/host-functions/).

### Genesis config

The JSON file that every node and indexer of a network starts from: start time, Bitcoin anchor, difficulty,
allocations and block share account. The signet's is `signet/genesis.json`. See
[Parameters](/docs/parameters/#genesis-configurations).

### GHOSTDAG

The protocol that orders the block DAG, with the definitions and algorithms Kaspa uses: it picks each block's selected
parent, colors merged blocks blue or red, and puts every block in one order. Ksana uses K = 16. See
[Mining](/docs/mining/).

## H

### Halving period

A stretch of DAA score during which each reward slot pays the same; the reward halves with each new period. On mainnet
the periods last about 2, 4 and then 8 years each, and on signet about 4 years each. See
[KSA and rewards](/docs/ksa/).

### Height

A block's height is its selected parent's height plus one. An operation in a merged block takes effect at the height of
the main-chain block that merges it, and the RPC reports that height. See [JSON-RPC](/docs/rpc/).

### Host function

A function that the virtual machine offers contracts, such as `storage_get`, `call_contract`, `asset_transfer`,
`emit_event`, `btc_header` and `native_tx`. Each has a price in gas, some per byte. See
[Host functions](/docs/host-functions/).

## I

### Idle header interval

The time between blocks while there is nothing to include: about 1 minute for the first empty block, doubling with each
further one up to about 10 minutes. The first operation that arrives brings the chain back to blocks about 5 seconds
apart. See [Mining](/docs/mining/).

### Indexer

`ksana-indexer`, which rebuilds the Ksana chain and its state from bitcoind alone, without talking to any node, and
checks every block's state root. See [Run an indexer](/docs/run-an-indexer/).

### Invalid block

A block that breaks a consensus rule, for example with bad proof of work, a missing forced inclusion or a body too
large for a payload. Nodes reject it and every block built on it, whereas a failed operation leaves its block valid.
See [Operations and fees](/docs/submitting-ops/).

## K

### KS-20

The standard for fungible tokens whose balances a contract keeps: its methods, events and refusals, allowances with
an expiry, and `transfer_and_call`, which pays a contract and calls it in one operation. See [KS-20](/docs/ks-20/).

### KS-721

The standard for collections of unique tokens, each with a 32-byte ID and an owner the collection keeps. See
[KS-721](/docs/ks-721/).

### KSA

Ksana's native asset, with 8 decimals and an asset ID of 32 zero bytes. Path B fees are paid in it and producers earn
it as block rewards; mainnet's cap is 210,000,000 KSA. See [KSA and rewards](/docs/ksa/).

### ksana-cli

The command-line client: it makes keys, queries a node, and submits operations on path B or, through a bitcoind
wallet, on path C. See [ksana-cli](/docs/cli/).

### ksana-keytool

A small tool that creates or reads a key file and prints its account and its addresses, for a producer's `--producer`
account and funding key. See [Run a node](/docs/run-a-node/).

### ksana-node

The node: it follows the chain over P2P, checks every block against Bitcoin and serves JSON-RPC. With `--producer` it
also mines blocks, and with a funding key it settles them. See [Run a node](/docs/run-a-node/).

### KSN1

The marker (`MAGIC`) that starts Ksana data on Bitcoin, both in the `OP_RETURN` output of a path C transaction and in
the envelope of a settlement or republish payload. See [How it works](/docs/how-it-works/).

## L

### Lenient and strict execution

A main-chain block first executes the other blocks of its merge set in lenient mode, where an entry that conflicts
with earlier ones is skipped, then its own entries in strict mode, where such an entry disqualifies the block. See
[How it works](/docs/how-it-works/).

### Local fault

An error of one node's own, such as a failure of its storage or of its bitcoind, as opposed to a fault in a block or an
operation. A node never judges a block invalid because of a local fault. See
[Operations and fees](/docs/submitting-ops/).

### Lock

An offer in an exchange contract: KSA that a seller sets aside for one buyer, the beneficiary, at a price per sat,
payable to a Bitcoin payment script the seller names, which no other lock has ever used. The buyer claims it with a
top-up; from 6 Bitcoin blocks after the lock's expiry height, the seller can release whatever is left. See
[Operations and fees](/docs/submitting-ops/).

### Locked fees

What an account is owed by blocks that are not unlocked yet, listed per block as `locked_fees` by `ksana_getAccount`:
a producer's block rewards and path B fees, a carrier's part, and the block share for the block share account. They
move to the balance when an unlock entry pays the block out, once it is settled. See [KSA and rewards](/docs/ksa/).

## M

### Main chain

The chain from the best eligible tip back to the genesis block along selected parents. It fixes the order in which
blocks execute, and it must pass through the finalized tip. See [How it works](/docs/how-it-works/).

### mainnet

The network on Bitcoin mainnet (chain ID 1000). It has not launched: its parameters are set, and its genesis config is
a template. See [Parameters](/docs/parameters/).

### Mark

One of the three stages an operation passes: fast-confirmed, on Bitcoin and final. Each rests on something different,
so an application chooses by amount which one to wait for. See [Confirmations](/docs/confirmations/).

### Merge depth

`MERGE_DEPTH`, 720 blue score: an hour of blocks at one every 5 seconds. A block may merge only blocks whose blue score
is within that distance of its selected parent's, and whose selected chain passes through its merge-depth root. See
[Mining](/docs/mining/).

### Merge set

The blocks a block adds to its past beyond its selected parent's past: the selected parent itself and the parallel
blocks it merges, at most 128. The merged blocks execute in GHOSTDAG order before the block's own entries. See
[Mining](/docs/mining/).

### Merkle proof

Proof that a transaction is in a Bitcoin block: the hashes on the path from its txid up to the Merkle root in the
block's header, also called a Merkle branch. A contract checks one with the SDK's `btc::verify_tx_inclusion` against a
header from `btc_header`, together with the proof of the same block's coinbase, which pins the depth of the tree. See
[Bitcoin in contracts](/docs/bitcoin-in-contracts/).

### Mock host

The in-memory stand-in for the host functions that `ksana-contract-sdk` uses when you build a contract for your own
machine instead of WebAssembly, so that `cargo test` runs it without a node. See [Write a contract](/docs/contracts/).

## N

### Native transaction

A Bitcoin transaction whose one KSN1 `OP_RETURN` output carries a signed operation: how path C travels. See
[Operations and fees](/docs/submitting-ops/).

### Nonce

A counter per account. Each operation carries the account's next nonce, so it cannot be replayed, and a node's entry
pool keeps an account's operations in nonce order. See [Accounts](/docs/accounts/).

## O

### On Bitcoin

The second mark of an operation: the data of its block, and of every block in that block's past, has landed in
Bitcoin blocks (`settled` in `ksana_getSettlement`). Anyone can now check the operation from Bitcoin, but it is not
final yet. See [Confirmations](/docs/confirmations/).

### One-time key

A key made for a single top-up. It signs only the claim operation, at nonce 0, so the claim uses none of your account's
nonces and several top-ups can confirm in any order. See [Operations and fees](/docs/submitting-ops/).

### Op ID

The SHA-256 hash of an operation's full encoding, signature included (`op_id`). You track an operation by it. See
[Operations and fees](/docs/submitting-ops/).

### Operation

A signed instruction to Ksana (an op), encoded as a VmOp: a transfer of an asset, a contract call or a contract
deployment. You submit it on path B or path C. See [Operations and fees](/docs/submitting-ops/).

### Operation status

What `ksana_getOpStatus` reports: `pending` (in the entry pool), `fast_confirmed`, `failed` (included, execution
failed, fee paid), `skipped` and `btc_final`. See [Confirmations](/docs/confirmations/).

### Outpoint

A reference to one output of a Bitcoin transaction: the transaction's ID and the output's index. A path C signature
covers the outpoint that the carrying transaction's first input spends, so a copy of the operation in any other
transaction fails. See [Accounts](/docs/accounts/).

### Output key

The 32-byte key that a Taproot address encodes: its internal key tweaked as BIP86 describes. A Ksana account is an
output key, which is why your account and your Taproot address are the same bytes. See [Accounts](/docs/accounts/).

## P

### P2A output

The 240-sat pay-to-anchor output of every reveal transaction. Anyone can spend it in a child transaction to raise the
fee of a settlement that waits in the Bitcoin mempool. See [Mining](/docs/mining/).

### Packing floor

The smallest path B fee (`--min-token-fee`, 1 base unit by default) and fee rate (`--min-fee-per-kib`, 0 by default)
that a producer puts in its own blocks. See [Operations and fees](/docs/submitting-ops/).

### Parallel block

A block found at about the same time as another, so that neither is in the other's past. A later block merges it
instead of discarding it, and its operations still execute unless they conflict with earlier ones. See
[Mining](/docs/mining/).

### Path B (sponsored)

Submitting an operation to a node with a fee in KSA. You sign one message, a producer includes the operation within
seconds, and producers pay the Bitcoin fees that settle it. See [Operations and fees](/docs/submitting-ops/).

### Path C (native)

Submitting an operation in your own Bitcoin transaction, through a KSN1 `OP_RETURN` output. You pay only the Bitcoin
fee, every producer must include the operation once the transaction confirms, and its signature binds the
transaction's first input so that nobody can copy it. See [Operations and fees](/docs/submitting-ops/).

### Payload

The data that a settlement or republish transaction carries in its envelope: compact block headers and the bodies of
the blocks that need them, at most 81,920 bytes and 500 headers. A path C transaction's payload is one operation. See
[How it works](/docs/how-it-works/).

### Producer

A node that mines blocks: it evaluates Argon2id on block templates and is paid in KSA at the account given by
`--producer`. Anyone can produce. See [Mining](/docs/mining/).

### Pruning

Keeping in memory only the block DAG from the pruning point on and answering older history from disk, so that memory
stays bounded. The pruning point lies at least 2,209 blue score below the pruning root, the highest block decided final
at least 144 Bitcoin blocks ago. See [Run a node](/docs/run-a-node/).

### PSBT

A partially signed Bitcoin transaction (BIP174). For path C and top-ups, the web wallet and the TypeScript SDK build
one for your browser wallet to sign. See [Signet wallet](/docs/wallet/).

## R

### Read-only call

A contract call made with the RPC method `ksana_call` instead of an operation. It runs on the latest state as if in the
next block, pays no fee, uses no nonce and changes nothing on chain. See [JSON-RPC](/docs/rpc/).

### Receipt

The result of executing an operation: success or failure, gas used, return value, events and the changes it made to
built-in assets. A failed operation's receipt records its whole `max_gas` as used. See
[Operations and fees](/docs/submitting-ops/).

### Relay floor

The smallest path B fee that a node admits to its entry pool and forwards to its peers (`--min-relay-token-fee`, the
packing floor by default; the lower of the two applies). See [Operations and fees](/docs/submitting-ops/).

### Reorg

A reorganization: part of a chain replaced by a heavier branch. A Bitcoin reorg of at most `ANCHOR_DEPTH` blocks leaves
every Ksana block in place, and a deeper one takes the blocks anchored on the orphaned Bitcoin blocks off the main
chain. Only a Bitcoin reorg of at least 6 blocks can undo a final block. See [Security](/docs/security/#bitcoin-reorgs).

### Republish

Writing block headers, and bodies where needed, to Bitcoin again in a new payload: to land data that no settlement
carried, or to put a node's own chain ahead of a competing chain on Bitcoin. Any node can do it, and the payload names
a payee who can earn the carrier reward. See [How it works](/docs/how-it-works/).

### Rescue

A node rebuilding a stuck settlement with its own funding: the same payload in a new commit and reveal pair. The
block's producer goes first, then the producers of the main-chain blocks after it, one Bitcoin block apart, then any
other node. See [How it works](/docs/how-it-works/).

### Revert and trap

Two of the ways a contract call fails. A method reverts when it returns an error, whose reason the receipt's `error`
shows; it traps on a WebAssembly fault such as `unreachable`, an access out of bounds or a division by zero. Either
fails the whole operation, unless the call was made with `try_call_contract`, which rolls back only the callee. See
[Host functions](/docs/host-functions/).

### Reward slot

A unit of block reward: a block of weight w takes the w slots that end at its DAA score, and each slot pays the reward
of its halving period (4.2 KSA in mainnet's first period). See [KSA and rewards](/docs/ksa/).

## S

### Seed node

One of the two signet nodes that the project hosts, which produce and settle blocks. A new node joins the network by
passing the first, `{{signet.p2p}}`, with `--peer`. See [Run a node](/docs/run-a-node/).

### Selected parent

The parent with the most chain work. Following selected parents from a tip gives its selected chain, and the main
chain is the selected chain of the best tip. See [Mining](/docs/mining/).

### Settled

A block is settled once its data and the data of every block in its past have landed on Bitcoin: the
[On Bitcoin](#on-bitcoin) mark. Its rewards and fees can then unlock, and the indexer can execute it. See
[KSA and rewards](/docs/ksa/).

### Settlement

The commit and reveal transactions through which a producer writes a block's data to Bitcoin, often with the headers
and bodies of earlier blocks, and pays their Bitcoin fee. A block with no body to land, an empty block or one holding
only path C operations, has a settlement of its own only when it carries other blocks' bodies; otherwise a later
settlement lands its header. See [How it works](/docs/how-it-works/).

### Settlement backlog limit

A safety rule: once a block's body has waited 6 Bitcoin blocks after its anchor (`SETTLEMENT_TIMEOUT`) without landing,
new blocks may hold only forced-inclusion entries, which pauses path B until the data lands. See
[Security](/docs/security/#unsettled-data).

### Settlement batching

While a settlement is in flight, producers keep the new blocks' bodies back and carry them all in the next settlement
once it confirms. When the bodies waiting, or a new block's own, pass 10 KiB (an eighth of the payload limit), the new
block carries a settlement at once. It is on by default. See [Mining](/docs/mining/).

### signet

Ksana's public test network (chain ID 1002) on Bitcoin's public signet, with two seed nodes, an indexer, a web wallet
and a faucet hosted at `{{signet.host}}`. Its coins have no value. See [Public signet](/docs/signet/).

### Signet BTC

The coins of Bitcoin's public signet (sBTC), free from any signet faucet and worth nothing. You need a little for
path C, top-ups and producing settlements. See [Public signet](/docs/signet/).

### Skipped

The status of an operation that only merged blocks included and that could not execute when they were merged, for
example because it had already run elsewhere. It pays no fee and, while still valid, goes back to the entry pool. See
[Confirmations](/docs/confirmations/).

### Soak test

A long devnet run (5 hours by default) that keeps submitting random path B and path C operations, optionally with
random Bitcoin reorgs, and checks the indexer against the nodes block by block. See [Security](/docs/security/#testing).

### State root

The root of the Merkle tree of the whole state after a block, written in the block's header. The indexer recomputes it
from Bitcoin data to check every block. See [Run an indexer](/docs/run-an-indexer/).

## T

### Taproot

Bitcoin's output type defined by BIP341, with addresses that start `bc1p` (`tb1p` on signet). A Ksana account is a
Taproot output key, and the envelope is a Taproot script. See [Accounts](/docs/accounts/).

### Tip

The newest block of a chain: the main chain's tip is its highest block, and the Bitcoin tip is the newest block of
the Bitcoin best chain. A block DAG can have several tips at once, and the fork choice picks one. See
[How it works](/docs/how-it-works/).

### Top-up

Buying KSA with BTC from a seller's lock in an exchange contract: one Bitcoin transaction of yours pays the seller and
carries a path C claim that credits the KSA to you. See [Operations and fees](/docs/submitting-ops/).

### Two-speed difficulty

Empty blocks need more work than blocks with entries: 12 times at first, doubling with each further empty block up to
120 times. A busy chain makes a block about every 5 seconds and an idle one about every 1 to 10 minutes, with the same
reward per unit of time. See [Mining](/docs/mining/).

### Txid

A Bitcoin transaction's ID: the double SHA-256 of the transaction without its witness. Ksana stores txids and Bitcoin
block hashes in Bitcoin's internal byte order, the reverse of the hex that bitcoind and block explorers show, so the
RPC also gives settlement txids in display order (`txid_rpc`). See [JSON-RPC](/docs/rpc/).

## U

### Unlock

Paying out locked rewards and path B fees once their blocks are settled. A block holds at most one unlock entry, which
pays out up to 1,024 blocks (`MAX_UNLOCK_BATCH`) in the order the main chain accepted them. See
[KSA and rewards](/docs/ksa/).

### Upgrade

A new protocol version from a set DAA score, taken from the upgrade table in `params.rs`. None is scheduled on any
network, so the protocol version is 2. See [Parameters](/docs/parameters/#upgrades).

### UTXO

An unspent transaction output: a Bitcoin coin, named by its outpoint, that a new transaction can spend. Path C
transactions, top-ups and settlements are paid from UTXOs; the TypeScript SDK takes the ones to spend as `Utxo` values
and does not list them for you. See [TypeScript SDK](/docs/sdk/).

## V

### Verdict

The result of executing a candidate for finality as a main-chain block on the finalized tip: valid, or invalid and
excluded. Every node and indexer on the same Bitcoin chain reaches the same verdict. See
[Security](/docs/security/#invalid-blocks).

### Virtual byte (vB)

Bitcoin's measure of a transaction's size for fees: a byte outside the witness counts as one, a witness byte as a
quarter. Bitcoin fee rates are given in sats (hundred-millionths of a bitcoin) per virtual byte, sat/vB. See
[Operations and fees](/docs/submitting-ops/).

### VmOp

The encoded form of an operation: version, chain ID, account, nonce, fee (a KSA amount for path B, native for path C),
`max_gas`, the action and a BIP340 or BIP322 signature, at most 65,536 bytes. See
[Operations and fees](/docs/submitting-ops/).

## W

### Wallet adapter

The TypeScript SDK's interface to a browser wallet, `WalletAdapter`: it reads the wallet's Taproot account, has the
wallet sign PSBTs and BIP322 messages, and can ask which Bitcoin network the wallet is set to. `UnisatAdapter` and
`XverseAdapter` wrap the two extensions, and you can implement it for another wallet. See [TypeScript SDK](/docs/sdk/).

### Web wallet

The signet wallet and explorer at `{{signet.wallet}}`: connect Unisat or Xverse, get test KSA, send operations on
path B or C, top up, and follow operations and blocks to Bitcoin. See [Signet wallet](/docs/wallet/).

### WebAssembly

The format of Ksana contracts: Rust compiled to `wasm32` without the standard library, run by wasmtime with exact gas
metering and no floating point. See [Write a contract](/docs/contracts/).

### Weight

A block's weight: 1 for a block with entries, 12 to 120 for an empty block. It divides the block's proof-of-work
target, adds to the DAA score and sets the number of reward slots. See [Mining](/docs/mining/).

### Withholding

Mining blocks in private and publishing them later (selfish mining), to turn honest blocks red and take their rewards,
or to reverse a payment. Counting a block's own work in the fork choice, and `GHOSTDAG_K` 16, limit what it gains. See
[Security](/docs/security/#withholding).
