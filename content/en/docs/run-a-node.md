---
title: Run a node
lede: A Ksana node follows the chain from its peers and checks every block against Bitcoin through your own bitcoind. Give it an account and it produces blocks; give it a funding key and it settles them on Bitcoin.
description: How to run ksana-node on Ksana’s public signet, from the requirements, the build and bitcoind on signet to following the chain, producing and settling blocks, pruning and checks.
---

A node keeps the fast lane’s block DAG, executes every block it accepts, and serves JSON-RPC to wallets, apps and `ksana-cli`. It reads Bitcoin through a bitcoind you run, which is how it checks anchors, settlements, forced inclusion of path C operations and finality without trusting anyone. This page sets one up on the [public signet](/docs/signet/); mainnet has not launched.

## What a node does

- **Following**: with no account given, the node syncs blocks from its peers, checks each one, relays blocks and operations, and answers RPC calls.
- **Producing**: with `--producer <account>`, it also mines blocks (Argon2id proof of work on one CPU core) and earns their rewards and path B fees.
- **Settling**: with a funding key as well, it pays the Bitcoin transactions that write its blocks’ data into Bitcoin. Without one, other producers carry that data and take the carrier’s part of the reward.

[Mining](/docs/mining/) explains how producing and settling pay; this page covers the setup.

## Requirements

| Need | What to provide |
| --- | --- |
| System | Ubuntu 22.04 is the tested platform. |
| Rust | the version in `rust-toolchain.toml` (1.98.1), installed by `rustup` |
| Bitcoin | Bitcoin Core on signet with `-txindex=1`, on the same machine or reachable over plain HTTP |
| Disk | about 30 GB for bitcoind’s signet chain with its index; the node’s own data directory is small |
| Memory | about 150 MiB for the node; bitcoind needs its own |
| CPU | one core while producing, as mining keeps it busy |
| Ports | TCP 9000 open for P2P; keep the node’s RPC (8545) and bitcoind’s RPC (38332) local |

For scale: the hosted signet runs bitcoind, two producing nodes, the indexer and the web services on one server with 4 cores and 8 GB of memory, and its operator’s guide asks for at least 2 cores, 4 GB and 80 GB of disk with one producing node. In a 10-hour devnet soak test, each node ended at 130 to 149 MiB of resident memory, and a node’s data directory held about 58 MB after 7,308 blocks.

## Build

Install the build tools and `rustup` as in the [quickstart](/docs/quickstart/), then build the node, the indexer, the CLI and the key tool in one go:

```sh
git clone {{repo}}
cd Ksana
rustup toolchain install
cargo build --release --locked -p ksana-node -p ksana-indexer -p ksana-cli --bins
```

This leaves `ksana-node`, `ksana-keytool`, `ksana-indexer` and `ksana-cli` in `target/release/`. The first build compiles RocksDB, wasmtime and, for the node and the indexer, jemalloc from source: it takes about half an hour on 2 cores, and on a machine with 4 GB of memory it needs some swap.

## Run bitcoind on signet

Install Bitcoin Core from [bitcoincore.org](https://bitcoincore.org/) (the hosted signet runs 31.1), choose an RPC password, and start it on signet with a transaction index:

```sh
export KSANA_BTC_RPC_PASS='<a password of your choice>'
bitcoind -signet -daemon -server -txindex=1 -rpcuser=ksana -rpcpassword="$KSANA_BTC_RPC_PASS" \
  -rpcbind=127.0.0.1 -rpcallowip=127.0.0.1
BCLI="bitcoin-cli -signet -rpcuser=ksana -rpcpassword=$KSANA_BTC_RPC_PASS"
$BCLI getblockchaininfo | jq '{blocks, initialblockdownload}'
```

The first sync downloads the signet chain and takes a few hours. Wait until `initialblockdownload` is `false`: the node refuses to start while bitcoind’s best chain does not yet contain the signet’s genesis anchor (`the genesis anchor block (height 327273) is not on bitcoind's best chain`). bitcoind’s signet RPC port is 38332.

Bitcoin Core 30 or later also relays the large `OP_RETURN` output of the path C transactions you send with `ksana-cli`; earlier versions need `-datacarriersize=100000` for that. Settlements carry their data in a Taproot witness, which every version relays.

## The genesis config

Every node and indexer of a network starts from the same genesis config. The signet’s is `signet/genesis.json` in the repository:

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

It fixes the start time, the Bitcoin block the chain is anchored to (its hash in Bitcoin’s internal byte order, the reverse of what explorers show), the starting difficulty, the genesis allocations (the faucet’s and the operator’s KSA) and the block share account. A data directory remembers the config it was made with, and the node refuses another one with `data directory belongs to a different genesis config`. When the signet [restarts from genesis](/docs/signet/#restarts-from-genesis), pull the repository and start with a new data directory.

## Follow the signet

From the repository’s directory, with `KSANA_BTC_RPC_PASS` set as above:

```sh
target/release/ksana-node --chain signet --data-dir ~/ksana-signet/node \
  --genesis signet/genesis.json \
  --btc-rpc-url http://127.0.0.1:38332 --btc-rpc-user ksana \
  --p2p-listen /ip4/0.0.0.0/tcp/9000 --peer {{signet.p2p}}
```

- `--chain signet` selects the signet’s parameters; without it the node runs devnet.
- `--data-dir` holds the block store, the state, the node’s P2P identity (`p2p.key`) and its pruning checkpoint. The directory is created when missing.
- `--btc-rpc-url` and `--btc-rpc-user` reach bitcoind, and the node reads the password from `KSANA_BTC_RPC_PASS`, which keeps it out of the process list (`--btc-rpc-pass` works too). Only `http://` URLs work.
- `--p2p-listen` turns on the P2P network and `--peer` dials the hosted seed node; repeat `--peer` for more peers. The node takes up to 100 inbound peers, at most 4 from one address, and a peer that sends three invalid blocks or operations is banned for a minute, with its address ([local policy defaults](/docs/parameters/#local-policy-defaults)).

The node logs to standard error. It prints `[ksana-node] network layer started: peer id …` and `[ksana-node] started: main-chain height …, tip …`, then `ksana-node rpc=127.0.0.1:8545` on standard output once its RPC listens. It then syncs from the seed node, and each time finality moves forward it logs `[ksana-node] BTC final: block … at height …`. Ctrl-C or `SIGTERM` stops it.

### The RPC

The node answers JSON-RPC over HTTP and WebSocket on `--rpc-addr`, by default `127.0.0.1:8545` (an IP address and port; a host name is refused). The RPC has no authentication, so keep it local, or put it behind a proxy you control if others should use it. It takes batches of at most 64 calls and bodies of at most 1 MiB, and holds at most 100 connections and 16 subscriptions on each WebSocket connection ([limits](/docs/rpc/#limits)); these have no flags, and a proxy in front of it can limit each client further.

Point `ksana-cli --rpc http://127.0.0.1:8545` or your app at it. A browser page on another origin needs `--rpc-cors`: `--rpc-cors https://{{signet.host}}` lets the [signet wallet](/docs/wallet/) use your node as its data source, `--rpc-cors '*'` allows every origin, and a comma-separated list allows several.

### Check that it works

Once your node has caught up, its tip matches the hosted node’s (give or take the newest block):

```sh
for rpc in http://127.0.0.1:8545 {{signet.rpc}}; do
  curl -sS "$rpc" -H 'content-type: application/json' \
    --data '{"jsonrpc":"2.0","id":1,"method":"ksana_getChainInfo","params":[]}' | jq -c .result.tip
done
```

Then:

- Watch the log for `decided final` and `BTC final` lines: they show that your node decides finality from your bitcoind.
- Read an account through your node, for example `ksana-cli --rpc http://127.0.0.1:8545 account @alice.key`.
- Run an [indexer](/docs/run-an-indexer/) next to it and compare state roots.

## Produce blocks

### Choose a payee account

`--producer` names the account that receives your blocks’ rewards and path B fees: a `tb1p…` address from a wallet you control, or the `account` of a key file:

```sh
target/release/ksana-keytool producer.key | jq .
```

```output
{
  "account": "02ee9753ea3f23d2cdd3c1d5b5caba98acc43e07074f8e8ec59db63d7dffe6fe",
  "funding_script": "512002ee9753ea3f23d2cdd3c1d5b5caba98acc43e07074f8e8ec59db63d7dffe6fe",
  "internal_key": "e7798d3c642863091e43f81dc4cc24acd6726b23702e4ebce8ae00cdffd50084",
  "mainnet_address": "bc1pqthfw5l28u3a9nwnc82mtj46nzkvg0s8qa8cark9nkmr6l0lumlqgkmm4q",
  "regtest_address": "bcrt1pqthfw5l28u3a9nwnc82mtj46nzkvg0s8qa8cark9nkmr6l0lumlqj88j64",
  "signet_address": "tb1pqthfw5l28u3a9nwnc82mtj46nzkvg0s8qa8cark9nkmr6l0lumlql7d500"
}
```

`ksana-keytool <file>` creates the key file (mode `0600`) when it does not exist and prints the key’s account and its addresses. Use `account`, not `internal_key`: the account is the Taproot output key. `ksana-cli key` reads the same files, so `ksana-cli account @producer.key` later shows what the account has earned.

Add `--producer <account>` to the command above. The node then mines on one core. Each block pays its producer a part of the 9.9 KSA of each of its reward slots on the signet, plus the path B fees it includes; it unlocks once the block’s data is on Bitcoin, and until then `ksana-cli account` lists it under `locked_fees`. [KSA and rewards](/docs/ksa/) has the details.

### Settle your own blocks

Without a funding key your blocks still include path B operations, and other producers’ settlements carry their data to Bitcoin. The node that lands a block’s data is its carrier: out of your part, it takes 5% of each of the block’s reward slots and half of its path B fees.

To settle your blocks yourself, give the node a funding key: a hot wallet on signet whose sBTC pays for the commit and reveal transactions. On the signet the node lists the key’s coins through a watch-only wallet in your bitcoind and refuses to start without one, because a scan of signet’s whole UTXO set takes 30 to 50 seconds.

::: steps

### Make the funding key

```sh
target/release/ksana-keytool funding.key | jq .
```

`signet_address` is where the sBTC goes, and `funding_script` is its output script.

### Make the watch-only wallet

Do this before you send the sBTC, so that the wallet sees it arrive:

```sh
SCRIPT=$(target/release/ksana-keytool funding.key | jq -r .funding_script)
$BCLI -named createwallet wallet_name=ksana-funding disable_private_keys=true blank=true \
  load_on_startup=true
DESC=$($BCLI getdescriptorinfo "raw($SCRIPT)" | jq -r .descriptor)
$BCLI -rpcwallet=ksana-funding importdescriptors '[{"desc": "'"$DESC"'", "timestamp": "now"}]'
```

If the sBTC confirmed before the import, rescan from a signet height before it arrived: `$BCLI -rpcwallet=ksana-funding rescanblockchain <height>`.

### Fund the address

Send sBTC to `signet_address` in at least three outputs, since each settlement in flight uses one. 0.006 sBTC in all is enough to start; a node that produces a third of the blocks spends about 0.00025 sBTC a day at 2 sat/vB (up to 0.0005 with traffic), so 0.02 sBTC lasts it about six weeks. Wait for the outputs to confirm.

### Start the node with the key

```sh
target/release/ksana-node --chain signet --data-dir ~/ksana-signet/node \
  --genesis signet/genesis.json \
  --btc-rpc-url http://127.0.0.1:38332 --btc-rpc-user ksana \
  --p2p-listen /ip4/0.0.0.0/tcp/9000 --peer {{signet.p2p}} \
  --producer <account> --btc-funding-key-file funding.key \
  --btc-funding-wallet ksana-funding --funding-pool-target 0
```

The node checks the wallet at startup and logs `the funding outputs are listed from bitcoind's wallet ksana-funding`. If the wallet does not watch the address it refuses to start, naming the descriptor to import.

:::

A settlement pair is about 316 to 383 vB plus a 240-sat anchor output, so about 1,000 sats at 2 sat/vB. Even an idle signet sends one about every two Bitcoin blocks, paid by the producer of the block that carries it. Check the funds with `$BCLI -rpcwallet=ksana-funding listunspent 0` and top up below 0.002 sBTC or three outputs: a node out of funds keeps producing, but its blocks’ data waits for another producer to carry it.

`--funding-pool-target 0` keeps the outputs as you sent them. By default (64) the node splits its largest output into pieces of at least 100,000 sats whenever it has fewer than 64 usable ones; the hosted seed nodes run with 0 and are funded with several outputs instead.

::: warning The funding key is a hot wallet
The node signs with it automatically, and anyone who reads `funding.key` can spend what the address holds. Keep only what settlements need there; a revenue address takes the rest.
:::

### Fee policy

These flags set what your node pays for its own Bitcoin transactions (settlements, rescues and republishes). They are local policy: other nodes do not check them.

| Flag | Default | What it sets |
| --- | --- | --- |
| `--settlement-feerate` | `2` | The lowest fee rate in sat/vB: paid while the next Bitcoin block has room, and when bitcoind has no estimate. |
| `--max-settlement-feerate` | `100` | The highest fee rate, bumps included. |
| `--settlement-conf-target` | `3` | The confirmation target, in Bitcoin blocks, for bitcoind’s `estimatesmartfee`. |

While bitcoind’s mempool holds at most half a block (500,000 vB), the next Bitcoin block has room for everything waiting, and the node pays the floor, or the mempool’s own minimum when that is higher. When the mempool holds more, it pays bitcoind’s estimate within the floor and the cap. While a lighter competing chain is on Bitcoin it aims for the next block instead, whatever room there is. A settlement pair that has waited 2 Bitcoin blocks while paying less than the estimate gets a CPFP child that spends its anchor output; while the mempool has room, one still waiting after 2 blocks gets a child that lifts it to at least twice its own rate, and twice that again for every further block, up to the cap. Keep the floor at 2 on the signet: on 13 October 2026 signet’s blocks took nothing below 2 sat/vB while transactions at 1 sat/vB waited. Cap it at 5 like the hosted seed nodes (`--max-settlement-feerate 5`): bitcoind’s estimate can stay far above what signet’s blocks take, as it stayed at 100 sat/vB from 16 October 2026.

Path B has its own local policy: `--min-token-fee` (default 1) is the lowest fee in KSA base units your blocks include, `--min-relay-token-fee` the lowest your node admits and relays (by default the same), and `--min-fee-per-kib` (default 0, no limit) a floor on the fee rate. [Operations and fees](/docs/submitting-ops/) explains how they apply.

### Revenue address

`--revenue-address <tb1… address>` keeps the hot wallet small. When the funding address would still hold at least `--hot-wallet-cap-sat` (default 1,000,000 sats) without the coins a settlement spends, that settlement’s change goes to the revenue address instead of back to the funding address. It needs `--btc-funding-key-file`, and the address must be a standard signet address other than the funding address.

### Other producer flags

| Flag | Default | What it does |
| --- | --- | --- |
| `--carrier-payee <account>` | the `--producer` account | Receives the carrier reward when your node’s republish lands another block’s data. |
| `--no-settlement-batching` | batching on | Each block that needs a settlement sends its own, instead of the next block carrying a backlog in one pair. |
| `--min-block-interval-ms <ms>` | `0` | The shortest gap between two of your blocks; the seed nodes use 1000. |

## Pruning and memory

Pruning is on by default and keeps the node’s memory bounded. Once a block has been BTC-final for 144 Bitcoin blocks (about a day on the signet), the node drops from memory what no chain it can still switch to needs, in steps of 1,000 blocks. Each pruning writes `pruning.ckpt` to the data directory, and a restart continues from it. The block store on disk keeps every block, so the node still serves old blocks to peers that sync from far behind.

`--no-pruning` keeps the whole history in memory, which grows with the chain. On Linux the node allocates with jemalloc and bounds RocksDB’s write buffers and cache; at each pruning it logs RocksDB’s memory use.

A Bitcoin reorganization deeper than what a pruned node keeps stops it with a message that it must be resynced: start it again with an empty data directory. Such a reorganization would have to undo blocks that were final for a day.

## Common startup errors

| Message | Cause |
| --- | --- |
| `BTC data source error: … Connection refused` | bitcoind is not running, or `--btc-rpc-url` is wrong. |
| `the genesis anchor block (height 327273) is not on bitcoind's best chain` | bitcoind has not synced that far, or runs on another network. |
| `data directory belongs to a different genesis config` | The directory belongs to another network or an earlier signet. |
| `--btc-funding-key-file on signet needs --btc-funding-wallet as well` | Add the watch-only wallet. |
| `--peer requires --p2p-listen as well` | Add `--p2p-listen`. |
