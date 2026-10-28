---
title: Protocol parameters
nav: Parameters
lede: Every protocol parameter of devnet, signet and mainnet, with the name of the constant that holds it, so that you can find each value in the code. Mainnet has not launched; the public signet is the network to use.
description: Ksana's protocol parameters for devnet, signet and mainnet, with constant names, units, genesis configurations, local policy defaults and ports.
---

All protocol parameters live in one file, `crates/ksana-primitives/src/params.rs`: the struct `Params` and one constant
for each network, `DEVNET`, `SIGNET` and `MAINNET`. This page names each parameter as the specification and the code
comments do (`CHAIN_ID`, `ANCHOR_DEPTH`). The field in `Params` is the same name in lowercase, with a unit suffix on six
of them (`target_block_time_secs`, `asert_half_life_secs`, `max_future_block_time_secs`,
`max_timestamp_ahead_of_anchor_secs`, `min_settlement_feerate_sat_vb`, `max_wasm_memory_bytes`).

Amounts are in base units: KSA has 8 decimals, so 1 KSA is 100,000,000 base units. Times given in seconds or years
assume the target of one unit of DAA score every 5 seconds. Mainnet has not launched: its values are the ones the
[specification]({{repo}}/blob/main/docs/SPEC.md) freezes, and its section 13.1 gives the reason for each and marks the
few still to be measured before launch, such as the Argon2id parameters.

## The three networks

| Network | `CHAIN_ID` | Runs on | Account addresses |
| --- | --- | --- | --- |
| devnet | 1001 | Bitcoin regtest, on your machine | Taproot, starting `bcrt1p` |
| signet | 1002 | Bitcoin's public signet | Taproot, starting `tb1p` |
| mainnet | 1000 | Bitcoin mainnet (Ksana's mainnet has not launched) | Taproot, starting `bc1p` |

The project hosts two seed nodes, an indexer and the web wallet of the signet at `{{signet.host}}` (see
[Public signet](/docs/signet/)). The node and the indexer pick the network with `--chain devnet|signet|mainnet` and
default to `devnet`. `ksana-cli` takes the network from the chain ID of the node it talks to, and its `--chain` only
states the network you expect.

The chain ID is written into every VmOp, so an operation signed for one network is invalid on the others. It is also
part of the Argon2id salt of the proof of work.

## What differs between networks

| Constant | devnet | signet | mainnet |
| --- | --- | --- | --- |
| `CHAIN_ID` | 1001 | 1002 | 1000 |
| `ANCHOR_DEPTH` | 0 | 1 | 2 |
| `NATIVE_CONFIRMATIONS` | 1 | 1 | 3 |
| `POW_LIMIT_BITS` | `0x207fffff` | `0x207fffff` | `0x1f00ffff` |
| `BLOCK_REWARD` | 990,000,000 (9.9 KSA) | 990,000,000 (9.9 KSA) | 420,000,000 (4.2 KSA) |
| `REWARD_HALVING_INTERVAL` | 25,228,800 | 25,228,800 | 12,500,000 |
| `REWARD_INTERVAL_DOUBLINGS` | 0 | 0 | 2 |
| `KSA_MAX_SUPPLY` | 1,000,000,000 KSA | 1,000,000,000 KSA | 210,000,000 KSA |

Every other parameter on this page has the same value on all three networks. Signet differs from devnet only in
`CHAIN_ID` and `ANCHOR_DEPTH`, which a test in `params.rs` checks.

A path C transaction is force-included once it has `NATIVE_CONFIRMATIONS` + `ANCHOR_DEPTH` Bitcoin confirmations:
1 on devnet, 2 on signet and 5 on mainnet. A block anchored at Bitcoin height A must include the native transactions up
to height A − `NATIVE_CONFIRMATIONS` + 1, and producers anchor `ANCHOR_DEPTH` blocks below their Bitcoin tip
(`crates/ksana-btc/src/native.rs`).

## Proof of work and difficulty

| Constant | Value | Meaning |
| --- | --- | --- |
| `TARGET_BLOCK_TIME` | 5 seconds | Target time per unit of DAA score |
| `ASERT_HALF_LIFE` | 7,200 seconds | Half-life of the aserti3-2d difficulty adjustment, computed by DAA score with the genesis block as its anchor |
| `POW_ALGORITHM` | Argon2id | RFC 9106, version 0x13: the message is the Borsh-encoded block header, the salt is `ksana-pow` followed by the chain ID as 4 little-endian bytes, and the 32-byte output is read as a little-endian number |
| `POW_ARGON2_MEMORY` | 2,048 KiB (2 MiB) | Memory of one evaluation (`Argon2Params::memory_kib`) |
| `POW_ARGON2_ITERATIONS` | 1 | Passes (`iterations`) |
| `POW_ARGON2_LANES` | 1 | Parallelism (`lanes`) |
| `POW_LIMIT_BITS` | By network, above | The easiest target, and the genesis block's `bits` when its config gives none |
| `EMPTY_BLOCK_DIFFICULTY` | 12 | Weight of the first empty block after a non-empty block |
| `MAX_EMPTY_BLOCK_WEIGHT` | 120 | Cap on the weight of consecutive empty blocks |

One Argon2id evaluation takes about 1 ms on one core of an ordinary CPU. On mainnet, `0x1f00ffff` is a target of about
2^240: about 65,536 evaluations per block at the limit, so about 13 cores find a block every 5 seconds there. A genesis
config can set a harder `bits` to match the hashrate expected at launch. Devnet and signet use `0x207fffff`, the easiest
target of Bitcoin regtest.

**Two-speed difficulty.** A block with entries has weight 1. The s-th empty block in a row on a selected chain has
weight min(N × 2^(s − 1), N_MAX), with N = `EMPTY_BLOCK_DIFFICULTY` and N_MAX = `MAX_EMPTY_BLOCK_WEIGHT`: 12, 24, 48,
96, then 120 for every further one (`Params::empty_block_weight`). The weight divides the block's PoW target, adds to the
DAA score and counts the block's reward slots, so an idle chain makes a block about every 1, 2, 4, 8 and then 10
minutes. See [Mining](/docs/mining/).

## Timestamps

| Constant | Value | Meaning |
| --- | --- | --- |
| `MEDIAN_TIME_SPAN` | 11 | Reception rule: a new block's timestamp must exceed the median of the 11 blocks before it on its selected chain |
| `MAX_FUTURE_BLOCK_TIME` | 15 seconds | Reception rule: how far a new block's timestamp may be ahead of the receiving node's clock |
| `MAX_TIMESTAMP_AHEAD_OF_ANCHOR` | 14,400 seconds (4 hours) | Consensus rule: how far a timestamp may be ahead of the time of the Bitcoin block its anchor names |

A node checks a reception rule only when it receives a new block. A consensus rule holds for every block, including
blocks synced from history or rebuilt from Bitcoin.

## Block DAG

| Constant | Value | Meaning |
| --- | --- | --- |
| `GHOSTDAG_K` | 16 | Most blue blocks that a blue block's anticone may hold |
| `MAX_BLOCK_PARENTS` | 10 | Most parents of a block |
| `MAX_MERGESET_SIZE` | 128 | Largest merge set, the selected parent included |
| `MERGE_DEPTH` | 720 blue score (about an hour of 5-second blocks) | A merged block's blue score may be at most this far below the selected parent's, and its selected chain must pass through the merge-depth root |
| `REORG_WINDOW` | 1,000 blocks | Deepest switch of the main chain by work; a forced switch to the finalized chain is not bound by it |

Pruning keeps a node's memory bounded. The pruning point lies at least
`GhostdagParams::min_pruning_depth` = 3 × (`MERGE_DEPTH` + `GHOSTDAG_K`) + 1 = 2,209 blue score below the pruning root
(`crates/ksana-consensus/src/ghostdag.rs`). How far back the root is, and how often a node prunes, are local settings,
listed under [Local policy defaults](#local-policy-defaults).

## Bitcoin anchoring and finality

| Constant | Value | Meaning |
| --- | --- | --- |
| `ANCHOR_DEPTH` | 0, 1, 2 | How many blocks below its Bitcoin tip a producer anchors a new block (devnet, signet, mainnet) |
| `MAX_ANCHOR_LAG` | 1 Bitcoin block | How far a new block's anchor may lag behind the receiving node's Bitcoin tip, beyond `ANCHOR_DEPTH` |
| `NATIVE_CONFIRMATIONS` | 1, 1, 3 | Bitcoin confirmations, counted at a block's anchor, after which that block must include a path C transaction (devnet, signet, mainnet) |
| `SETTLEMENT_DEPTH` | 2 blocks | Fast-lane confirmations before a block's settlement is broadcast; also what the indexer waits for before it executes a main-chain block that is not final yet |
| `SETTLEMENT_TIMEOUT` | 6 Bitcoin blocks | When a block's body has not landed on Bitcoin this many blocks after its anchor, new blocks may hold only forced-inclusion entries until it lands (the settlement backlog limit) |
| `BTC_FINALITY_CONFS` | 6 | Bitcoin confirmations that a block's data, and the data of the blocks it merges, needs before the block is decided final; the Bitcoin block of that decision then needs as many before the block is reported final |
| `BTC_QUERY_DEPTH` | 6 | A contract reads only the Bitcoin headers at least this many blocks below its block's anchor height |
| `MIN_SETTLEMENT_FEERATE` | 1 sat/vB | Lowest fee rate of a commit or reveal transaction (a consensus rule; nodes pay 2 sat/vB or more by default) |
| `CARRIER_REPOST_DELAY` | 2 Bitcoin blocks | The payee of a republish payload earns the carrier reward only when the block's data landed more than `ANCHOR_DEPTH` + 2 Bitcoin blocks after its anchor |

[Confirmations](/docs/confirmations/) explains what these numbers mean for the time an operation takes to become final.

## Data limits

| Constant | Value | Meaning |
| --- | --- | --- |
| `MAGIC` | `KSN1` | Marker of KSN1 data outputs and envelopes |
| `MAX_OP_BYTES` | 65,536 bytes (64 KiB) | Largest encoded VmOp, contract code included |
| `MAX_BLOCK_DATA_BYTES` | 81,920 bytes (80 KiB) | Largest payload, settlement or republish; a block that needs a body is valid only if its body fits in a republish payload of its own |
| `MAX_SETTLEMENT_HEADERS` | 500 | Most block headers in one payload, checked before any header is decoded |
| `MAX_CHUNK` | 520 bytes | Largest data push in a KSN1 output or envelope (`crates/ksana-btc/src/data.rs`) |
| `MAX_SETTLEMENT_TX_BYTES` | 400,000 bytes | Largest commit or reveal transaction; `MAX_SETTLEMENT_WEIGHT` caps its weight at 400,000 WU (`crates/ksana-btc/src/settlement.rs`) |
| `P2A_AMOUNT_SAT` | 240 sats | Value of the reveal transaction's P2A anchor output, which a CPFP child spends to raise the pair's fee |
| `PRODUCER_SEQUENCE` | `0xFFFFFFFD` | The `nSequence` that every input of a commit and reveal transaction must have |
| `MAX_BIP322_SIG_BYTES` | 1,024 bytes | Largest BIP322 simple signature (`crates/ksana-crypto/src/bip322.rs`) |
| `MAX_CALL_FUNDS` | 16 | Most assets attached to one call |
| `VMOP_VERSION` | 2 | Version of the VmOp format |
| `BLOCK_VERSION` | 2 | Block header version, the protocol version while no upgrade has activated |

The last three are in `crates/ksana-primitives/src/lib.rs`. These limits are consensus rules too: changing one is a
consensus change, the same as changing a field of `Params`.

## Gas and execution limits

| Constant | Value | Meaning |
| --- | --- | --- |
| `BLOCK_GAS_LIMIT` | 100,000,000 | Most gas in one block, counted as the sum of the entries' `max_gas`; a forced-inclusion entry counts `min(max_gas, NATIVE_MAX_GAS)` and is not bound by the limit, an unlock entry counts 0 |
| `NATIVE_MAX_GAS` | 1,000,000 | Most gas a path C operation may ask for; one that passes its checks but asks for more fails, and its nonce is used |
| `MAX_WASM_MEMORY` | 16 MiB (16,777,216 bytes) | Linear memory of a contract |
| `MAX_CALL_DEPTH` | 8 | Deepest chain of contract-to-contract calls |

The virtual machine adds fixed limits in `crates/ksana-vm/src/limits.rs` (and `MAX_CALL_INPUT_BYTES` in `engine.rs`):

| Constant | Value | Limits |
| --- | --- | --- |
| `MAX_STORAGE_KEY_BYTES` | 256 bytes | A storage key |
| `MAX_STORAGE_VALUE_BYTES` | 65,536 bytes | A storage value |
| `MAX_CALL_INPUT_BYTES` | 65,536 bytes | A call's input, the Borsh-encoded method and arguments |
| `MAX_OUTPUT_BYTES` | 65,536 bytes | A contract's return value |
| `MAX_EVENT_BYTES` | 16,384 bytes | One event |
| `MAX_ASSET_META_BYTES` | 1,024 bytes | The metadata of `asset_issue` and `asset_create` |
| `MAX_ASSET_NAME_BYTES` | 64 bytes | An asset's name, at least 1 byte |
| `MAX_ASSET_SYMBOL_BYTES` | 16 bytes | An asset's symbol, at least 1 byte |
| `MAX_ASSET_DECIMALS` | 18 | An asset's decimals |
| `MAX_TABLE_ELEMENTS` | 4,096 | Elements of a WebAssembly table |
| `STACK_BUDGET` | 262,144 bytes | Estimated stack of the call chain in one contract instance, metered at run time |
| `MAX_INSTANCES_PER_OP` | 64 | Contract instances that one operation creates (every call creates one) |
| `MAX_TOTAL_MEMORY_PER_OP` | 268,435,456 bytes (256 MiB) | Linear memory of all instances of one operation |

The gas table, which prices every host function, is in [Host functions](/docs/host-functions/).

## Rewards and supply

KSA is issued only as block rewards. Each block takes as many reward slots as its weight, at the DAA scores it covers,
and each slot pays the reward of its halving period. Period k lasts `REWARD_HALVING_INTERVAL` × 2^min(k,
`REWARD_INTERVAL_DOUBLINGS`) DAA score and pays `BLOCK_REWARD` / 2^k per slot, rounded down to whole base units
(`Params::reward_period_at`, `block_reward_at`).

| Mainnet period | DAA scores | Reward per slot | About |
| --- | --- | --- | --- |
| 0 | 0 to 12,499,999 | 4.2 KSA | Years 0 to 2 |
| 1 | 12,500,000 to 37,499,999 | 2.1 KSA | Years 2 to 6 |
| 2 | 37,500,000 to 87,499,999 | 1.05 KSA | Years 6 to 14 |
| 3 | 87,500,000 to 137,499,999 | 0.525 KSA | Years 14 to 22 |
| 4 and later | 50,000,000 each | Half the period before | 8 years each |

On mainnet the last base unit is paid in period 28, and from DAA score 1,387,500,000 (about year 220) the reward is 0.
All of mainnet's slots together pay 20,999,999,600,000,000 base units, 4 KSA short of the cap. The bound
`Params::max_total_rewards` = `BLOCK_REWARD` × `REWARD_HALVING_INTERVAL` × (`REWARD_INTERVAL_DOUBLINGS` + 2) is exactly
`KSA_MAX_SUPPLY` on mainnet, so mainnet has no genesis allocation.

On devnet and signet every period lasts 25,228,800 DAA score (about 4 years) and the first pays 9.9 KSA per slot; the
reward is 0 from DAA score 756,864,000 (period 30). The bound on their rewards is 499,530,240 KSA, which leaves at most
500,469,760 KSA for genesis allocations under their 1,000,000,000 KSA cap.

| Constant | Value | Meaning |
| --- | --- | --- |
| `CARRIER_BPS` | 500 (5%) | Share of each reward slot that goes to the block's carrier, taken out of the producer's part |
| `CARRIER_FEE_BPS` | 5,000 (50%) | Carrier's share of the block's path B fees; the rest goes to the producer |
| `MAX_UNLOCK_BATCH` | 1,024 | Most blocks that one unlock entry pays out, in the order the main chain accepted them |

The carrier's part is 0.21 KSA of a 4.2 KSA slot on mainnet and 0.495 KSA of a 9.9 KSA slot on signet; when no carrier
qualifies, it stays with the producer.

Rewards and fees are paid at unlock, once the data of the block and of every block in its past has landed on Bitcoin.
[KSA and rewards](/docs/ksa/) explains the schedule, the carrier and unlocking.

## Upgrades

`Params::upgrades` is empty on all three networks: blocks have protocol version 2 (`BLOCK_VERSION`) and accept VmOp
version 2. An upgrade item raises the protocol version from a given DAA score and can set new values for these rules:
`BLOCK_GAS_LIMIT`, `NATIVE_MAX_GAS`, the accepted VmOp versions, `BLOCK_SHARE_BPS`, `BLOCK_SHARE_END`, `CARRIER_BPS`
and `CARRIER_FEE_BPS`. Other changes, such as new execution rules or encodings, branch on the protocol version in the
code and activate with the same item.

Some parameters are fixed for the life of a network and stay out of the upgrade table: `ASERT_HALF_LIFE`,
`EMPTY_BLOCK_DIFFICULTY`, `MAX_EMPTY_BLOCK_WEIGHT`, the Argon2id parameters, `REWARD_INTERVAL_DOUBLINGS` and
`CARRIER_REPOST_DELAY`. A node reports its chain ID, protocol version and next scheduled upgrade with
`ksana_getChainInfo`:

```sh title="Read the signet's chain info"
curl -s -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"ksana_getChainInfo","params":[]}' \
  {{signet.rpc}} | jq .result
```

```output
{
  "chain_id": 1002,
  "tip": {
    "height": "281",
    "hash": "d18e91c9383400d27166695177decadb89399456e55d79eb6e6164d625edaf95"
  },
  "daa_score": "12199",
  "protocol_version": 2,
  "next_upgrade": null,
  "max_known_version": 2,
  "finalized": {
    "height": "241",
    "hash": "0cb65c0a51c1200757560f9ed1a2aa28f5a01a236bbdda8005120eb609a8ae6b"
  }
}
```

The DAA score runs far ahead of the height because the signet was mostly idle: its empty blocks weigh 12 to 120 each.

## Genesis configurations

Every node and indexer of a network starts from the same genesis config, a JSON file
(`crates/ksana-execution/src/genesis_file.rs`). A data directory records the config's fingerprint and refuses to open
with another one.

| Field | devnet | signet | mainnet |
| --- | --- | --- | --- |
| `timestamp` | When `devnet/init.sh` ran | 1792553063 (2026-10-21 03:24:23 UTC) | To be filled in at launch |
| `btc_anchor` | The regtest tip | Signet height 327,273 | To be filled in, at least 2 blocks below the tip |
| `bits` | Not given (`0x207fffff`) | 520523192 (`0x1f068db8`) | Optional, `0x1f00ffff` when not given |
| `allocations` | 10,000 KSA to a test account | 110,000,000 KSA to two accounts | None allowed |
| `block_share_account` | A generated account | Set, see below | A placeholder that no node accepts |

- **devnet** has no committed file: `devnet/init.sh` writes a new one, with new random keys, each time the devnet
  starts from scratch.
- **signet** uses the committed `signet/genesis.json`. Its `bits` expects about 10,000 Argon2id evaluations per block,
  sized for the two seed nodes that mine on one thread each (`signet/ksana-signet.sh`). The first allocation,
  100,000,000 KSA, funds the [faucet](/docs/signet/); the second, 10,000,000 KSA, belongs to the operator.
- **mainnet** has only the template `mainnet/genesis.json`. A node or indexer refuses any config whose block share
  account is the placeholder `KSANA_BLOCK_SHARE_ACCOUNT_TBD___`, and on mainnet it also requires a block share account,
  no allocations, and a real anchor and timestamp. Mainnet does not start yet, whatever its config holds: the block
  share's values are not published, and nodes and indexers refuse mainnet until they are set in the code.

```json title="signet/genesis.json"
{
  "timestamp": "1792553063",
  "btc_anchor": {
    "height": 327273,
    "hash": "41cb1fa60f4a0803b02024c7c0fd9cabb094f2935e7fcc4e7a63f03011000000"
  },
  "bits": 520523192,
  "allocations": [
    {
      "account": "de6603f052fd5bfaae5678a2a20ae6ae4fe4ae00c89db70a2efea7429851afc0",
      "amount": "10000000000000000"
    },
    {
      "account": "6431409abb9b8434defe68b0e066cf76610ac7b1cf49f2d02bc807543877dc0e",
      "amount": "1000000000000000"
    }
  ],
  "block_share_account": "0073719af1ae0718ca4fde1055e6c5c34157eefd54302c9b19deb28927ce8d8c"
}
```

The anchor hash is in Bitcoin's internal byte order, the reverse of what `bitcoin-cli getblockhash` prints. A consensus
change before mainnet restarts the signet from a new genesis config, and balances do not carry over.

## Local policy defaults

These are a node's own settings, not consensus rules: each operator can change them, and nodes with different settings
still agree on the chain. [Run a node](/docs/run-a-node/) explains the flags.

| Setting | Default | Meaning |
| --- | --- | --- |
| `--min-token-fee` | 1 base unit | Packing floor: the smallest path B fee this node puts in its blocks |
| `--min-relay-token-fee` | The packing floor | Relay floor: the smallest fee this node admits and forwards (the lower of the two applies) |
| `--min-fee-per-kib` | 0 | Smallest fee rate this node packs, in base units per KiB of cost |
| Entry pool | 10,000 ops, 32 MiB | At most 64 ops per account, 8 of them behind a nonce gap (no flags) |
| `--settlement-feerate` | 2 sat/vB | Floor of this node's Bitcoin fee rate: paid while bitcoind's mempool has room, and when bitcoind has no estimate |
| `--max-settlement-feerate` | 100 sat/vB | Cap of this node's Bitcoin fee rate, CPFP bumps and competing-chain races included |
| `--settlement-conf-target` | 3 Bitcoin blocks | Target of `estimatesmartfee`; 1 while a lighter competing chain is on Bitcoin |
| Room in the mempool | 500,000 vB | While bitcoind's mempool holds at most half a block (`ROOMY_MEMPOOL_VSIZE`), this node's new Bitcoin transactions pay the floor, or the mempool's minimum when that is higher, instead of the estimate; not while a lighter competing chain is on Bitcoin |
| `BUMP_AFTER` | 2 Bitcoin blocks | A settlement pair this node sent that waits this long below bitcoind's estimate is bumped to it through the P2A output; while the mempool has room, one still waiting is bumped to at least twice its own rate, doubling for every further block, up to the cap |
| `CLAIM_PATIENCE` | 8 Bitcoin blocks | Longest a settlement claim in the Bitcoin mempool holds back a rescue (`RESCUE_ORDER_WINDOW` 6 + `RESCUE_DELAY` 2) |
| `--hot-wallet-cap-sat` | 1,000,000 sats | With `--revenue-address`: when the funding wallet, less the funding a settlement spends, still holds at least this much, the settlement's change goes to the revenue address |
| `--funding-pool-target` | 64 | Confirmed funding outputs to keep, by splitting the largest into pieces of at least 100,000 sats |
| Settlement batching | On | While a settlement is in flight (carried by a block anchored at most 2 Bitcoin blocks below the tip, `IN_FLIGHT_BTC_BLOCKS`, and not landed yet), new blocks leave their bodies for the next settlement, unless the bodies waiting, or a block's own, pass 10 KiB (`MAX_BLOCK_DATA_BYTES` / `PAYLOAD_BODY_TRIGGER` 8); `--no-settlement-batching` makes every block that needs a body carry its own settlement |
| Pruning | On | The pruning root is the highest block decided final at least 144 Bitcoin blocks below the tip (`PRUNE_BTC_MARGIN`), and a node prunes again once the pruning point can advance 1,000 blue score (`PRUNE_STEP`); `--no-pruning` keeps everything |
| Orphan pool | 256 blocks, 32 MiB | `MAX_ORPHANS`, `MAX_ORPHAN_BYTES` |
| P2P connections | 100 inbound, 32 in the handshake | At most 4 inbound from one address (an IPv6 address by its /64) and 2 with one peer; loopback and private addresses count only in the totals (no flags) |
| P2P quotas | Blocks 20/s, ops 1,000/s, sync requests 50/s | Token buckets of the address a peer connects from, with bursts of 100, 5,000 and 200, kept across reconnections; a peer banned by score (3 points, for 60 seconds) bans its address too |
| Gossip awaiting validation | 256 MiB of blocks, 32 MiB of ops | At most a quarter of each from one address; an op longer than `MAX_OP_BYTES` is refused before it is decoded |
| Sync serving | 4 requests at a time | At most 16 in flight from one address, and 256 MiB of responses being sent, a quarter of it from one address; a `GetMempool` response holds at most 4 MiB |
| RPC limits | Batches of 64 calls, bodies of 1 MiB | Responses of 10 MiB, 100 connections and 16 subscriptions per WebSocket connection, for the node and the indexer ([JSON-RPC limits](/docs/rpc/#limits)) |
| `--btc-poll-ms` | 500 | Interval between syncs with bitcoind |
| `--min-block-interval-ms` | 0 | Smallest gap between this node's own blocks |

A read-only `ksana_call` runs with at most `BLOCK_GAS_LIMIT` gas, and a node runs at most 4 of them at a time.

## Default ports

| Service | Default | Set with |
| --- | --- | --- |
| Node JSON-RPC, HTTP and WebSocket | `127.0.0.1:8545` | `--rpc-addr` |
| Indexer JSON-RPC | `127.0.0.1:8546` | `--rpc-addr` |
| Node P2P | Off; port 9000 by convention | `--p2p-listen /ip4/0.0.0.0/tcp/9000` |
| bitcoind RPC (node, indexer, `ksana-cli`) | `http://127.0.0.1:18443` (regtest) | `--btc-rpc-url`; signet's bitcoind listens on 38332, mainnet's on 8332 |
| Node URL of `ksana-cli` | `http://127.0.0.1:8545` | `--rpc` or `KSANA_RPC` |

The devnet in Docker Compose publishes bitcoind on 18443 (P2P on 18444), its three nodes on 18545 to 18547 and its
indexer on 18548. The signet's first seed node is `{{signet.p2p}}`, and its other endpoints are listed on
[Public signet](/docs/signet/).
