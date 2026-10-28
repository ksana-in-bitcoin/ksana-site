---
title: Run an indexer
lede: The indexer rebuilds the whole chain from Bitcoin alone. It reads what settlements wrote into Bitcoin, executes every main-chain block and checks each block’s state root, so you can verify a node without trusting it.
description: How to run ksana-indexer on Ksana’s public signet, read its JSON-RPC, compare its state roots with a node, and what its alarms, restarts and pruning mean.
---

`ksana-indexer` talks to no Ksana node. It needs only a bitcoind on the same Bitcoin network, from which it collects the block headers and bodies that settlements and republishes wrote into Bitcoin. From those it builds the same block DAG and main chain as a node, executes the main-chain blocks, and checks that every block’s `state_root` matches what it computed.

::: figure architecture
Nodes talk to each other and read and write Bitcoin; the indexer only reads Bitcoin, and its state roots must match theirs.
:::

## Why run one

- **Check a node.** When your indexer and a node report the same state root at a height, that node’s state there is exactly what the data on Bitcoin implies. This works for the hosted node too.
- **Depend on Bitcoin alone.** Everything the indexer uses is on Bitcoin, so it shows that the chain can be rebuilt even if every Ksana node disappeared.
- **Check finality.** It decides which blocks are final from Bitcoin with the same rules as a node, and raises an alarm when something does not add up.

The [signet wallet](/docs/wallet/)’s **Verify** page shows the same comparison for the hosted indexer and node.

## Build and run

The indexer builds with the node (see [Run a node](/docs/run-a-node/)), or on its own:

```sh
cargo build --release --locked -p ksana-indexer
```

It needs bitcoind on signet with `-txindex=1`, synced past the signet’s genesis anchor; [Run a node](/docs/run-a-node/#run-bitcoind-on-signet) shows how to start one. Then, from the repository’s directory:

```sh
export KSANA_BTC_RPC_PASS='<your bitcoind RPC password>'
target/release/ksana-indexer --chain signet --data-dir ~/ksana-signet/indexer \
  --genesis signet/genesis.json \
  --btc-rpc-url http://127.0.0.1:38332 --btc-rpc-user ksana
```

`--chain signet` and the genesis config must be the same as the nodes’, and the data directory remembers the genesis config it was made with. The password comes from `KSANA_BTC_RPC_PASS` (or `--btc-rpc-pass`), and bitcoind is reached over plain `http://` only.

| Flag | Default | What it sets |
| --- | --- | --- |
| `--rpc-addr <IP:PORT>` | `127.0.0.1:8546` | Where the JSON-RPC listens. |
| `--poll-ms <ms>` | `500` | The pause between two rounds of reading bitcoind. |
| `--no-pruning` | pruning on | Keep the whole history in memory. |

The indexer has no CORS option: a browser page reaches it only through a proxy on the page’s own origin, as the hosted wallet does with `{{signet.indexer}}`.

At startup it logs `[ksana-indexer] started: verified height …, state root …` to standard error and `ksana-indexer rpc=127.0.0.1:8546` to standard output. As it catches up it logs `verified up to height … (block tree main-chain height …, BTC height …)`, `decided final: block … at height …` when finality moves forward, and `BTC-final: block … at height …` when the BTC-final tip follows. A first sync of the signet takes as long as reading its Bitcoin blocks since the genesis anchor.

### How far it trails the node

The indexer sees a block only once a settlement or republish has carried the block’s data into a Bitcoin block. It then verifies a main-chain block once that block has 2 confirmations on its main chain (`SETTLEMENT_DEPTH` on the signet) or is final. So its verified height trails a node’s tip by the blocks whose data has not reached a Bitcoin block yet, usually the last several minutes of blocks on the signet.

## The JSON-RPC

The indexer answers two methods, over HTTP and WebSocket. `indexer_status` reports how far it got:

```sh
curl -sS {{signet.indexer}} -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"indexer_status","params":[]}'
```

```output
{"jsonrpc":"2.0","id":1,"result":{"height":"51","hash":"5b69b10223571ab01bdee3080d8e1ed25c8ace4fc420f744d23b7d8d5db15981","state_root":"bd7ad23935fc366400a48eb8591696171be864520fd981c3204f9d5e64cc0963","btc_height":327291,"finalized":{"height":"38","hash":"ab3fe1dcb95f0d76cd171210567f571fcd81cc8f7559d68da7dd38348eec7cf2"},"halted":null}}
```

- `height`, `hash` and `state_root`: the highest block it has executed and verified.
- `btc_height`: the Bitcoin height it has read up to (a number, unlike the fast-lane heights).
- `finalized`: its BTC-final tip, from Bitcoin by the same rule as a node’s.
- `halted`: `null` while all is well; otherwise why it stopped ([below](#alarms)).

`indexer_stateRoot` takes a height, `"latest"` or a block hash, and answers for verified blocks only; for any other it returns `-32004`, `the block has not yet been executed and verified by the indexer`:

```sh
curl -sS {{signet.indexer}} -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"indexer_stateRoot","params":["29"]}'
```

```output
{"jsonrpc":"2.0","id":1,"result":{"height":"29","hash":"88ab3dd805eac5654cdd752dc1a0a50c2c8d4fac581e2c46b2bd65bc7f35bb50","state_root":"2138690c600b998a923498e86eea30bef23c9ae5ee5d4eea79527e9a04d25f78"}}
```

`ksana-cli` cannot talk to an indexer, as it needs a node’s methods; use `curl` or the [TypeScript SDK](/docs/sdk/)’s indexer client.

## Compare state roots with a node

This script compares the last five heights the indexer verified with the node’s blocks at the same heights. Set `NODE` and `INDEXER` to yours, or keep the hosted ones; it needs `curl` and `jq`.

```sh title="compare-roots.sh"
NODE={{signet.rpc}}
INDEXER={{signet.indexer}}
call() {  # url method params
  curl -sS "$1" -H 'content-type: application/json' \
    --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$2\",\"params\":$3}" | jq -c .result
}
top=$(call "$INDEXER" indexer_status '[]' | jq -r .height)
for h in $(seq $((top - 4)) "$top"); do
  a=$(call "$INDEXER" indexer_stateRoot "[\"$h\"]" | jq -c '[.hash, .state_root]')
  b=$(call "$NODE" ksana_getBlock "[\"$h\"]" | jq -c '[.hash, .header.state_root]')
  if [ "$a" = "$b" ]; then echo "$h same $a"; else echo "$h DIFFERENT indexer $a node $b"; fi
done
```

```output
47 same ["c52236bffa3e7c70c065fb44c81ce32c5926384a32e290cb6ef0fdadc9c777f6","2b467e3a07620190a59be9fc28fd31e913c132178f5fa4773011e51e9cb523ea"]
48 same ["2ca734d18afaae94bf0ac04c55a5d17a47a198f4512a19eb19f1c1b867635e41","e99d23768dbb247f974ca842623c26072832101b82db58a64cbf5d177f8e45e8"]
49 same ["ce36e3736a66c3773ed309cae018dd6e51fe2e4ad1e11b7d46893238026882a6","bd7ad23935fc366400a48eb8591696171be864520fd981c3204f9d5e64cc0963"]
50 same ["a8975ea2295f05403e1f943a09a3c28467415449302481dae475602f4ab4c8b5","bd7ad23935fc366400a48eb8591696171be864520fd981c3204f9d5e64cc0963"]
51 same ["5b69b10223571ab01bdee3080d8e1ed25c8ace4fc420f744d23b7d8d5db15981","bd7ad23935fc366400a48eb8591696171be864520fd981c3204f9d5e64cc0963"]
```

The block hashes must match as well as the state roots. Blocks 48 and 49 here each hold an operation, which changes the state root; 50 and 51 are empty blocks, which change no state, so they keep the root of 49.

A difference right after a Bitcoin reorganization or a switch of main chain can last until both sides have followed it. A difference that stays at heights both have long passed means that the node and the indexer executed the same block differently: keep both data directories and report it as the [Security](/docs/security/) page describes.

## Alarms

The indexer reports problems on standard error as lines that start with `[ksana-indexer] alarm`. Most describe something it handles by itself:

| Alarm | What the indexer does |
| --- | --- |
| `block … at height … is invalid (…)` | The nodes reject that block too; it leaves it out and chooses the main chain again. |
| `block … cannot land (…)` | It leaves the block out and chooses the main chain again. |
| `a BTC reorg took the anchor of main-chain block … off the BTC best chain` | It retreats below that block and chooses the main chain again. |
| `block … met the BTC finality condition but is invalid` | It keeps that block, and every block built on it, out of finality. |

A Bitcoin reorg that revokes only decisions not reported yet is not an alarm: the indexer logs `a BTC reorg revoked finality decisions, taking back nothing reported as BTC-final` and decides again on the new chain.

Four alarms of the highest level need you:

- `alarm (highest level): … processing halted`, also shown in `indexer_status` as `halted`, stops the indexer. A block that Bitcoin made final turned out invalid: either the fast lane finalized an invalid block, or Ksana’s software computes differently on different machines. Keep the data directory and report it.
- `alarm (highest level): a BTC reorg took back BTC-final block … at height …` means that a Bitcoin reorganization of at least 6 blocks reached the Bitcoin block that decided a block the indexer had reported final. The indexer goes on with the new chain and reports the block final again if it is decided again; whatever you counted as final from that block on needs checking.
- `the payload contains a block header of protocol version …, but this indexer only supports up to …` means the network has upgraded its rules. The indexer stops before the change; update it from the repository.
- `cannot check block header … in the payload` means this machine could not compute a header’s proof of work, a local fault such as memory it could not allocate. The indexer judges nothing, logs `sync failed (will retry later)` and tries again; if the alarm keeps coming back, look at the machine.

## Restarts and pruning

The indexer keeps its work in the data directory (`state/`, `index/`, `indexer.json` and `pruning.ckpt`). After a restart it first checks its stored state against the data on Bitcoin, waiting while bitcoind is behind, and then logs `verification against the BTC data complete: continuing from height …`.

Pruning is on by default and works as on a node: memory keeps only what the main chains it can still follow need, the verified main chain below that is answered from the index on disk, and each pruning writes a checkpoint the next start continues from. In a 10-hour devnet soak test the indexer ended at 67 MiB of resident memory with a data directory of about 45 MB after 7,308 blocks.

The indexer starts over from the genesis anchor by itself when it cannot continue from what it kept: after a Bitcoin reorganization deeper than that, when the main chain leaves its pruning root, or when its index is lost. It logs an alarm and rebuilds everything from bitcoind, which takes as long as a first sync. After a signet [restart from genesis](/docs/signet/#restarts-from-genesis), give it the new genesis config and a new data directory.
