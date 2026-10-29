---
title: The command-line client
nav: ksana-cli
lede: "`ksana-cli` talks to one Ksana node over JSON-RPC. It makes keys, reads accounts, blocks and operations, sends transfers and contract calls on path B or path C, and runs both sides of a top-up."
description: Every ksana-cli command with examples on the public signet, from keys and queries to transfers, contracts, path C through bitcoind, the exchange contract and top-ups.
---

`ksana-cli` reads the chain through a node’s JSON-RPC and signs operations on your machine with a key file, so no node ever sees your secret key. For path C and top-ups it also uses a wallet in your own bitcoind. The examples run against the [public signet](/docs/signet/), the network to use today; mainnet has not launched. Their receipts show `asset_changes` as this version of the node records them; for these operations, which the signet’s nodes executed before they recorded the changes, `ksana-cli` prints `null`.

## Install

Build it from the repository. The [quickstart](/docs/quickstart/) lists the Ubuntu packages and the `rustup` setup the build needs.

```sh
git clone {{repo}}
cd ksana
rustup toolchain install
cargo build --release --locked -p ksana-cli
target/release/ksana-cli --version
```

```output
ksana-cli 0.1.0
```

The binary is `target/release/ksana-cli`; put that directory on your `PATH` or copy the file into one. `ksana-cli --help` lists the commands, and `ksana-cli <command> --help` lists a command’s options.

## Global options

| Option | Default | What it sets |
| --- | --- | --- |
| `--rpc <URL>` | `http://127.0.0.1:8545`, or `KSANA_RPC` | The node’s JSON-RPC address, over HTTP or HTTPS. |
| `--chain <NETWORK>` | none | `devnet`, `signet` or `mainnet`: the network you expect the node to be on. |

Both may come before or after the command. Every command except `key` first reads the node’s chain ID and signs for that network. With `--chain`, a node on another network is refused before anything is signed or sent:

```output
ksana-cli: the node at {{signet.rpc}} is on signet (chain ID 1002), not devnet (--chain): refusing to sign for one network and send to another; drop --chain to use the node's network, or point --rpc at a devnet node
```

Pass `--chain signet` whenever you sign, so that a wrong `--rpc` cannot make you sign for another network.

### Environment variables

| Variable | Stands for |
| --- | --- |
| `KSANA_RPC` | `--rpc` |
| `KSANA_BTC_RPC_URL` | `--btc-rpc-url` (path C and top-ups) |
| `KSANA_BTC_RPC_USER` | `--btc-rpc-user` |
| `KSANA_BTC_RPC_PASS` | `--btc-rpc-pass` |

An option on the command line wins over its variable. `ksana-cli <command> --help` prints the current value of each variable next to its option, the bitcoind password included, so keep that output to yourself.

### Output and exit codes

Results go to standard output as JSON with sorted keys; amounts, nonces and heights are decimal strings. Errors go to standard error as `ksana-cli: <message>` and exit with code 1, and a mistake in the options exits with code 2. An operation that a block includes but whose execution fails still exits with 0 and shows `"failed"`, so scripts should check `.status.status`.

Wherever a command takes an account, you can write a Taproot address of the node’s network (`tb1p…` on the signet), the account as 64 hex digits, or `@<key file>` for the account of a key file. Amounts are always base units: KSA has 8 decimals, so 1 KSA is `100000000`.

## Keys

```sh
ksana-cli --chain signet key alice.key
```

```output
{
  "account": "42cc119256c7207f971d113d908d66dff579f2f94e62eed29027f61f4d524d2d",
  "address": "tb1pgtxpryjkcus8l9cazy7eprtxml6hnuhefe3wa55sylmp7n2jf5kshm2h5s",
  "internal_key": "99b49d4d105d713742dcb48a5e09fab5edf9b564869d99c7ff73ab65dd76e9f2",
  "script": "512042cc119256c7207f971d113d908d66dff579f2f94e62eed29027f61f4d524d2d"
}
```

`key` writes a new random secret key to the file (mode `0600`) when the file does not exist, and reads it when it does. It never contacts the node and never prints the secret. The file holds the secret key as 64 hex digits, the same format `ksana-keytool` and the node’s funding key use.

`account` is the Taproot output key, which is your account; `address` is the same 32 bytes as a Taproot address; `internal_key` is the key before the Taproot tweak, and `script` the address’s output script. Without `--chain` or `--network`, `key` prints a devnet address (`bcrt1p…`); `--network regtest|signet|testnet|mainnet` picks the address encoding directly. [Accounts](/docs/accounts/) explains how keys, accounts and addresses relate.

::: warning Back up your key files
A key file is the only copy of its secret key: whoever reads it controls the account, and losing it loses the account. Keep keys for the signet apart from keys that hold anything of value.
:::

## Read the chain

These commands only read. Each answer names the block it was read at in `at`.

### `account`

```sh
ksana-cli account @bob.key
```

```output
{
  "account": "7e3f2a17f6af3db190101f3e5d55347a7f0eb83184c2be79ec8ac464da617f41",
  "address": "tb1p0clj59lk4u7mryqsrul964f50flsawp3snptu70v3tzxfknp0aqsey62tx",
  "at": {
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f",
    "height": "61"
  },
  "balances": [
    {
      "amount": "100000000",
      "asset": "0000000000000000000000000000000000000000000000000000000000000000"
    }
  ],
  "locked_fees": [],
  "nonce": "0"
}
```

`balances` lists what the account can spend now, one entry per asset; KSA is the asset of 64 zeros. `nonce` is the nonce the account’s next operation must carry. `locked_fees` lists income that is not unlocked yet, such as a producer’s fees and block rewards, one entry per block; it moves into `balances` once the block’s data is on Bitcoin. An account that has never been used shows nonce `0` and empty lists.

With a node that indexes the token standards, `account` also lists `tokens`, the KS-20 tokens the account holds with their balances, `[{ "contract", "balance" }]`, and `nfts`, the KS-721 collections it holds NFTs of with how many, `[{ "contract", "count" }]`. A node without the index leaves both out.

### `asset`

```sh
ksana-cli asset
```

```output
{
  "asset": "0000000000000000000000000000000000000000000000000000000000000000",
  "at": {
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f",
    "height": "61"
  },
  "capabilities": [],
  "decimals": 8,
  "issuer": "0000000000000000000000000000000000000000000000000000000000000000",
  "name": "KSA",
  "paused": false,
  "symbol": "KSA",
  "total_supply": "11001412730000000"
}
```

Without an argument it shows KSA; give an asset ID (64 hex digits) for another asset. KSA’s `total_supply` is the genesis allocation plus the block rewards unlocked so far.

### `contract`

`ksana-cli contract <contract ID>` shows a contract’s `code_hash`, its `deployer`, the `standards` it declared and the position of the operation that declared them. It works for any contract; [`ksana_getContract`](/docs/rpc/#ksana_getcontract) describes the fields.

### `token`

`ksana-cli token <contract ID>` shows what the node’s index knows of a KS-20 token or a KS-721 collection: its standard and extensions, name, symbol and decimals, its supply and number of holders, and `irregular`, `true` when the index had to leave out one of its events. [`ksana_getToken`](/docs/rpc/#ksana_gettoken) describes the fields.

### `holders`

`ksana-cli holders <contract ID>` lists a token’s or a collection’s holders, the largest balance first. A page holds 50 by default; `--limit <N>` asks for 1 to 500, and `--after <next>` continues after an earlier page, given that page’s `next`. `nfts` and `approvals` page the same way.

### `nfts`

`ksana-cli nfts <account>` lists the NFTs an account holds, by collection and then token ID. `--contract <ID>` keeps the NFTs of one collection.

### `approvals`

`ksana-cli approvals <account>` lists the approvals an account gave: KS-20 allowances, KS-721 operators and the accounts approved to move single NFTs, as their latest events set them, expired or not. What is left of an allowance is the token’s `allowance` view, which [`query`](#query) reads.

A node without the index refuses `contract`, `token`, `holders`, `nfts` and `approvals` with error `-32601`. The index tells what an account holds; ask the contract with `query` for an amount you act on.

### `op`

```sh
ksana-cli op 032d7d956cff983e57db09411a345aae134aa12b8b0c72305f8cdccfad4bb4b2
```

```output
{
  "block": {
    "hash": "8948675528f5bdfd5f928bc0ee70ebeec9b3a96612738a4a883247824d9bf4d8",
    "height": "28"
  },
  "index": 0,
  "receipt": {
    "asset_changes": [
      {
        "amount": "10000000000",
        "asset": "0000000000000000000000000000000000000000000000000000000000000000",
        "events": 0,
        "from": "de6603f052fd5bfaae5678a2a20ae6ae4fe4ae00c89db70a2efea7429851afc0",
        "kind": "transfer",
        "to": "42cc119256c7207f971d113d908d66dff579f2f94e62eed29027f61f4d524d2d"
      }
    ],
    "error": null,
    "events": [],
    "gas_used": "10000",
    "op_id": "032d7d956cff983e57db09411a345aae134aa12b8b0c72305f8cdccfad4bb4b2",
    "output": "",
    "success": true
  },
  "status": "btc_final"
}
```

`block.height` is the height of the main-chain block that accepted the operation’s block, `index` its place among the block’s entries, and `receipt` the result of executing it, whose `asset_changes` lists what the op did to built-in assets, in order (the [RPC page](/docs/rpc/#ksana_getopstatus) lists the kinds). `status` is one of these:

| Status | Meaning |
| --- | --- |
| `pending` | In the node’s entry pool, not in a block yet. |
| `fast_confirmed` | Included and executed successfully. |
| `failed` | Included, but the execution failed; the fee is charged anyway. |
| `skipped` | Included only by a parallel block that could not execute it; nothing is charged, and it goes back to the pool to be included again. |
| `btc_final` | Executed successfully, and its block is final on Bitcoin. |

An operation the node does not know is an error, `ErrorObject { code: ServerError(-32004), message: "unknown op", … }`. A path C operation stays unknown until a block includes it. [Confirmations](/docs/confirmations/) explains what each status guarantees.

### `block`

`ksana-cli block` takes `latest`, a height or a block hash. A height names the main-chain block at that height; a hash can name any block, parallel blocks included.

::: details The block that included this page’s transfer
```sh
ksana-cli block 29
```

```output
{
  "accepted_height": "29",
  "entries": [
    {
      "Sponsored": {
        "op": {
          "account": "42cc119256c7207f971d113d908d66dff579f2f94e62eed29027f61f4d524d2d",
          "action": {
            "AssetTransfer": {
              "amount": "100000000",
              "asset": "0000000000000000000000000000000000000000000000000000000000000000",
              "to": "7e3f2a17f6af3db190101f3e5d55347a7f0eb83184c2be79ec8ac464da617f41"
            }
          },
          "chain_id": 1002,
          "fee": {
            "Token": {
              "amount": "1"
            }
          },
          "max_gas": "1000000",
          "nonce": "0",
          "sig": {
            "Bip340": "8ee2feb60ec2b4ab2861db2a8a756703ac527b43409f67594a0686f0a832bd356d219e01a72a5a1377e7c9f9152e0148b4788ce4ce1e9c63d7d3fa565cec124b"
          },
          "version": 2
        }
      }
    }
  ],
  "hash": "88ab3dd805eac5654cdd752dc1a0a50c2c8d4fac581e2c46b2bd65bc7f35bb50",
  "header": {
    "bits": 520499087,
    "btc_anchor": {
      "hash": "c770c385e86ae4792f479f8a8c0fd3fde68b3fb604d47911afa42c5103000000",
      "height": 327279
    },
    "entries_root": "11677bbe5187d3b8021bcc06edc2e6cf7eeda32fcd804c8d38bc155120cca92d",
    "height": "29",
    "nonce": "1357",
    "parents": [
      "8948675528f5bdfd5f928bc0ee70ebeec9b3a96612738a4a883247824d9bf4d8"
    ],
    "producer": "ccc06c3ce8d176b3c10138dd4e70873939a9c6dc05597f45aace147ef2c07d3d",
    "state_root": "2138690c600b998a923498e86eea30bef23c9ae5ee5d4eea79527e9a04d25f78",
    "timestamp": "1792558561",
    "version": 2
  },
  "merged": [],
  "receipts": [
    {
      "asset_changes": [
        {
          "amount": "100000000",
          "asset": "0000000000000000000000000000000000000000000000000000000000000000",
          "events": 0,
          "from": "42cc119256c7207f971d113d908d66dff579f2f94e62eed29027f61f4d524d2d",
          "kind": "transfer",
          "to": "7e3f2a17f6af3db190101f3e5d55347a7f0eb83184c2be79ec8ac464da617f41"
        }
      ],
      "error": null,
      "events": [],
      "gas_used": "10000",
      "op_id": "9e3c9bbeacd422ef8888c9992dc0f7024e1b8ae08edec0ed8dc5897495766503",
      "output": "",
      "success": true
    }
  ],
  "settlement": null
}
```
:::

The header names the block’s `parents`, the Bitcoin block it is anchored to (`btc_anchor`, whose hash is in Bitcoin’s internal byte order), its `producer` and its `state_root`. `entries` and `receipts` pair up by position; `merged` lists the parallel blocks this block merges, and `settlement` holds the commit and reveal transactions the block carries, or `null`.

### `settlement`

`ksana-cli settlement <block>` shows the Bitcoin transactions that carry a block’s data, and where they are:

- `status`: `pending` (not sent yet), `broadcast` (sent, waiting for a Bitcoin block) or `confirmed`, with the Bitcoin block and its confirmation count under `confirmed`.
- `settled`: `true` once this block and every block before it are on Bitcoin. This is the on-Bitcoin mark.
- `btc_final`: `true` once the block is final.
- `carrier`: the later block whose settlement carried this block’s data, when producers batched it; `null` when the block carries its own.
- `carrier_account`: the account paid the carrier reward for landing the block’s data on Bitcoin, the producer of the block whose settlement carried it or a republisher’s payee; `null` when there is none, and the producer keeps that part.
- `txid_rpc` and `commit_txid_rpc`: the reveal and commit transaction IDs as Bitcoin explorers write them; `txid` and `commit_txid` are the same in internal byte order, as are the hashes under `confirmed`.

A block with no body to land, an empty block or one holding only path C operations, has no settlement unless it carries one itself: the command answers `-32004` with `that block has no settlement transactions`. The [quickstart](/docs/quickstart/#follow-it-to-final) shows a full answer.

### `estimate-fee`

```sh
ksana-cli estimate-fee
```

```output
{
  "at": {
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f",
    "height": "61"
  },
  "feerate_sat_vb": "2",
  "path_b": {
    "amount": "1",
    "per_kib": "4"
  }
}
```

`path_b.amount` is the node’s suggested `--fee-token` for a plain KSA transfer, in base units, and `path_b.per_kib` the suggested fee per KiB of an operation’s cost, for larger operations. `feerate_sat_vb` is the Bitcoin fee rate the node pays for its own settlements now, a reference for `--btc-fee-rate`. All three are suggestions; [Operations and fees](/docs/submitting-ops/) explains how fees work.

## Send a transfer

```sh
ksana-cli --chain signet transfer --key alice.key --to @bob.key \
  --amount 100000000 --fee-token 1 --wait
```

```output
{
  "account": "42cc119256c7207f971d113d908d66dff579f2f94e62eed29027f61f4d524d2d",
  "nonce": "0",
  "op_id": "9e3c9bbeacd422ef8888c9992dc0f7024e1b8ae08edec0ed8dc5897495766503",
  "status": {
    "block": {
      "hash": "88ab3dd805eac5654cdd752dc1a0a50c2c8d4fac581e2c46b2bd65bc7f35bb50",
      "height": "29"
    },
    "index": 0,
    "receipt": {
      "asset_changes": [
        {
          "amount": "100000000",
          "asset": "0000000000000000000000000000000000000000000000000000000000000000",
          "events": 0,
          "from": "42cc119256c7207f971d113d908d66dff579f2f94e62eed29027f61f4d524d2d",
          "kind": "transfer",
          "to": "7e3f2a17f6af3db190101f3e5d55347a7f0eb83184c2be79ec8ac464da617f41"
        }
      ],
      "error": null,
      "events": [],
      "gas_used": "10000",
      "op_id": "9e3c9bbeacd422ef8888c9992dc0f7024e1b8ae08edec0ed8dc5897495766503",
      "output": "",
      "success": true
    },
    "status": "fast_confirmed"
  }
}
```

`transfer` moves `--amount` base units of KSA to `--to`; `--asset <ID>` sends another asset. Without `--wait` the command prints `account`, `nonce` and `op_id` as soon as the node accepts the operation, and you follow it with `ksana-cli op`.

### Options for sending

`transfer`, `deploy`, `call` and the `exchange` commands that change state (`deposit`, `withdraw`, `lock`, `release`) share these options. Each needs `--key` and exactly one of `--fee-token` and `--native`.

| Option | Default | What it does |
| --- | --- | --- |
| `--key <FILE>` | required | The key file that signs; its account sends the operation. |
| `--fee-token <AMOUNT>` | | Path B: the fee in KSA base units, paid to the producer. |
| `--native` | | Path C: carry the operation in your own Bitcoin transaction ([below](#path-c-with-bitcoind)). |
| `--nonce <N>` | the account’s nonce | The operation’s nonce. |
| `--max-gas <GAS>` | `1000000` | The execution limit; a failed operation uses all of it. |
| `--sig <SCHEME>` | `bip340` | `bip340`, or `bip322`, the scheme browser wallets use. |
| `--wait` | off | Wait until a block includes the operation ([below](#waiting-and-timeouts)). |
| `--timeout <SECONDS>` | `120` | How long `--wait` waits. |

The default nonce is the account’s nonce at the chain tip, and it does not count operations still waiting in the node’s pool. If you send a second operation before the first is in a block, both carry the same nonce and the node refuses the second with `-32011`: `an op with the same nonce already exists; replacing it needs a sponsored fee of at least <FEE>`. Use `--wait` between operations, or give each one its `--nonce`. With the same nonce, a `--fee-token` of at least the fee the message names replaces an operation that is still waiting: a tenth more than its fee, and at least the node’s relay floor more.

## Contracts

Contracts are WebAssembly modules. [Write a contract](/docs/contracts/) covers building one, and the [token and pool tutorial](/docs/token-and-pool/) deploys and uses two on the signet step by step.

### `deploy`

```sh
ksana-cli --chain signet deploy --key alice.key \
  --code crates/ksana-execution/tests/data/token.wasm \
  --init-args 040000005465737403000000545354080010a5d4e80000000000000000000000 \
  --fee-token 1 --wait | tee deploy.json
```

`--code` is the wasm file and `--init-args` the hex of the arguments the contract’s `init` receives (none by default). `--fund` attaches assets to `init` ([below](#arguments-and-attached-funds)). The repository keeps a built token at `crates/ksana-execution/tests/data/token.wasm`; its `init` takes a name, a symbol, the decimals and the supply, here `"Test"`, `"TST"`, 8 and 1,000,000,000,000 base units.

Deploying costs 100,000 gas plus 20 gas per byte of code before `init` runs, so the default `--max-gas` of 1,000,000 covers code up to about 40 KB. A whole operation, code included, must fit in 64 KiB (`MAX_OP_BYTES`).

### Find the contract ID

`deploy` does not print the new contract’s ID: you compute it. It is the SHA-256 of the deploying account, the deploy operation’s nonce as an 8-byte little-endian integer, and the SHA-256 of the code. This shell function computes it with Python:

```sh
contract_id() {  # account nonce wasm-file
  python3 -c 'import hashlib, sys
code = hashlib.sha256(open(sys.argv[3], "rb").read()).digest()
seed = bytes.fromhex(sys.argv[1]) + int(sys.argv[2]).to_bytes(8, "little") + code
print(hashlib.sha256(seed).hexdigest())' "$@"
}
contract_id 6b77bade530385d352e9d68ab6af57d110a4bb27d92dcc3221fe32f8f683bd8a 0 \
  crates/ksana-execution/tests/data/token.wasm
```

```output
e36da19a8adccf6dcfd8c73dccf16a64c032067dc89f28b2ceecdf14c27d392d
```

That is a token deployed on the signet from account `6b77bade…` with nonce 0, with the code and the `init` arguments of the `deploy` above, and the `query` below reads it. For your own deployment, pass the `account` and `nonce` that `deploy` printed (this uses `jq`):

```sh
TOKEN=$(contract_id "$(jq -r .account deploy.json)" "$(jq -r .nonce deploy.json)" \
  crates/ksana-execution/tests/data/token.wasm)
```

When `init` emits an event, as the token’s does, the deploy receipt’s `events[].contract` shows the same ID.

### `query`

`query` runs a contract method on the node without sending anything, so it costs no fee and needs no key:

```sh
ksana-cli query --contract e36da19a8adccf6dcfd8c73dccf16a64c032067dc89f28b2ceecdf14c27d392d \
  --method metadata
```

```output
{
  "asset_changes": [],
  "error": null,
  "events": [],
  "gas_used": "37555",
  "op_id": null,
  "output": "04000000546573740300000054535408",
  "success": true
}
```

`output` is the method’s return value in hex, here the Borsh encoding of `("Test", "TST", 8)`. `--args` passes arguments, `--caller <ACCOUNT>` sets the caller the method sees (32 zero bytes by default), and `--fund` simulates attached assets.

### `call`

`call` sends a contract call as an operation. This one moves 250 base units of the token you deployed above, which `init` gave to your account, to another account; the arguments `(to, amount)` are encoded as Borsh:

```sh
TO=7e3f2a17f6af3db190101f3e5d55347a7f0eb83184c2be79ec8ac464da617f41
AMOUNT=fa000000000000000000000000000000   # 250 as a 16-byte little-endian integer
ksana-cli --chain signet call --key alice.key --contract "$TOKEN" \
  --method transfer --args "$TO$AMOUNT" --fee-token 1 --wait
```

The result has the same shape as a transfer’s. A method that reverts gives `"status": "failed"` with the reason in `.status.receipt.error`, and the command still exits with 0.

### Arguments and attached funds

`--args` and `--init-args` take the raw argument bytes in hex (a `0x` prefix is allowed); `ksana-cli` does not encode anything for you. The example contracts read Borsh: a tuple of the arguments in order, a single argument as itself, and no bytes for none.

| Type | Borsh encoding |
| --- | --- |
| `u8`, `u32`, `u64`, `u128` | little-endian, 1, 4, 8 or 16 bytes |
| `[u8; 32]` (an account or contract ID) | the 32 bytes |
| `String`, `Vec<u8>` | the length as a 4-byte little-endian integer, then the bytes |

`--fund` attaches assets to `deploy`, `call` and `query`: `--fund 5000` attaches 5,000 base units of KSA, and `--fund <asset ID>:<amount>` another asset. Repeat it for several assets, at most 16, each asset once.

## Path C with bitcoind

With `--native`, the operation travels in a Bitcoin transaction of your own instead of a node’s pool: you pay the Bitcoin fee and no KSA fee, and every producer must include the operation once the transaction has its confirmations. [Operations and fees](/docs/submitting-ops/) explains when that helps.

`ksana-cli` builds the transaction, has a bitcoind wallet add inputs and change and sign them, signs the operation over the transaction’s first input, and broadcasts it. You need:

- your own bitcoind on the same Bitcoin network as the node (signet for the public signet), reachable over plain `http://`: the CLI has no TLS for bitcoind;
- a wallet in it holding some sBTC; a transfer at the default 2 sat/vB costs about 700 sats of fee;
- Bitcoin Core 30 or later, or `-datacarriersize=100000`, so that your bitcoind relays the transaction’s large `OP_RETURN` output.

The hosted Bitcoin RPC proxy has no wallet methods, so it cannot do this. [Run a node](/docs/run-a-node/) shows how to set up bitcoind on signet.

```sh
export KSANA_BTC_RPC_URL=http://127.0.0.1:38332
export KSANA_BTC_RPC_USER=ksana
export KSANA_BTC_RPC_PASS=<password>
ksana-cli --chain signet transfer --key alice.key --to @bob.key --amount 100000000 \
  --native --btc-wallet <wallet>
```

The command prints `account`, `nonce`, `op_id` and `btc_txid`, the Bitcoin transaction ID as explorers write it. `--btc-wallet` names the bitcoind wallet that pays (bitcoind’s only loaded wallet when you leave it out), and `--btc-fee-rate` sets the fee rate in sat/vB (default 2).

On the signet a block includes the operation once its transaction has 2 Bitcoin confirmations (`NATIVE_CONFIRMATIONS` 1 plus `ANCHOR_DEPTH` 1); on mainnet it will take 5. Until then `ksana-cli op <op_id>` answers `unknown op`. Leave out `--wait`, or give it `--timeout 3600`: the default 120 seconds runs out long before.

::: warning Keep the account quiet until it is included
A path C operation carries the account’s nonce. If a path B operation of the same account takes that nonce first, the path C operation fails when it is included and its Bitcoin fee is spent. On path C, `--max-gas` must stay at or below 1,000,000 (`NATIVE_MAX_GAS`), or the operation fails on chain and uses its nonce.
:::

## Exchange

A top-up sells KSA for bitcoin through an exchange contract: the seller locks KSA for one buyer, and the buyer’s Bitcoin payment carries the claim. The `exchange` commands are the seller’s side, written for the example contract `ksa-exchange`. On the signet nobody runs a standing exchange, so to try it you deploy one yourself.

```sh
(cd contracts && cargo rustc --release --locked --target wasm32-unknown-unknown \
  --package ksa-exchange --crate-type cdylib)
WASM=contracts/target/wasm32-unknown-unknown/release/ksa_exchange.wasm
ksana-cli --chain signet deploy --key seller.key --code $WASM --fee-token 1 --wait \
  | tee exchange.json
EXCHANGE=$(contract_id "$(jq -r .account exchange.json)" "$(jq -r .nonce exchange.json)" $WASM)
```

The contract’s `init` takes no arguments, and `contract_id` is the function from [Find the contract ID](#find-the-contract-id). Then, as the seller:

```sh
ksana-cli --chain signet exchange lock --key seller.key --fee-token 1 \
  --exchange "$EXCHANGE" --ksa 3000000 --price 100 --fund 3000000 \
  --address <a fresh tb1 address of yours> --beneficiary <buyer's account> \
  --expiry <Bitcoin height> --wait
```

This locks 3,000,000 base units of KSA for the buyer at 100 base units per sat, so 30,000 sats buy all of it. The result’s `lock` field is the lock number; give it and the exchange ID to the buyer.

- `--fund` attaches KSA to the call, which goes into your available balance in the contract before the lock takes `--ksa` from it. `exchange deposit --amount <N>` adds to that balance ahead of time, and `exchange withdraw --amount <N>` takes from it; neither touches a lock.
- `--address` (or `--script <hex>`) is where the buyer pays. Use a fresh address for every lock: the contract refuses a payment script that any earlier lock used.
- `--expiry` is a Bitcoin height above the one the current block is anchored to (`header.btc_anchor.height` in `ksana-cli block latest`). Signet makes a block about every ten minutes, so add enough for the buyer to pay.
- `exchange release --lock <N>` returns what is still locked to your available balance. It works only once the anchored Bitcoin height reaches the expiry plus 6 blocks.

Two commands only read:

```sh
ksana-cli exchange show --exchange "$EXCHANGE" --lock 0
ksana-cli exchange balance --exchange "$EXCHANGE" --seller @seller.key
```

`show` prints the lock’s `seller`, `beneficiary`, payment `script`, `price`, the `ksa` still locked, `expiry`, `sats_for_all` (the sats that buy all of it) and its `state`: `open`, `released`, or `claimed` with what was paid. `balance` prints your available balance in the contract.

## Top-up

`top-up` is the buyer’s side. One Bitcoin transaction pays the lock’s address and carries the claim as a path C operation, signed with a one-time key, so your own account signs nothing and spends no nonce.

```sh
ksana-cli --chain signet top-up --exchange <exchange ID> --lock <lock number> \
  --beneficiary @buyer.key --sats 30000 --btc-wallet <wallet>
```

Before paying, the command reads the lock and refuses to pay when:

- its beneficiary is not `--beneficiary`, since the KSA would go to someone else;
- it is not open;
- 3 or fewer Bitcoin blocks are left before its expiry (`--expiry-margin`, default 3);
- `--sats` differs from what buys all the KSA still locked. `--allow-partial` lets you buy part of it and leave the rest locked for you; `--allow-overpay` lets you pay more, which buys nothing more.

It needs bitcoind as [path C](#path-c-with-bitcoind) does, and prints the `op_id` of the claim, the `btc_txid`, the Bitcoin fee, the `ksa` you get and the lock’s terms. The KSA reaches the beneficiary when a block includes the claim, 2 Bitcoin confirmations later on the signet. The [signet wallet](/docs/wallet/) does the same from a browser.

## Waiting and timeouts

`--wait` asks the node for the operation’s status every half second and returns at `fast_confirmed`, `failed` or `btc_final`; a `pending` or `skipped` operation keeps it waiting. After `--timeout` seconds (default 120) it prints the status if the last one it saw was `skipped`, and otherwise stops with an error and exit code 1:

```output
ksana-cli: timed out waiting for the op to be included (120 seconds)
```

::: note The operation may still be on its way
A timeout does not cancel anything: the operation was sent, and with path C or `top-up` the Bitcoin transaction was broadcast. The error also replaces the result, so the `op_id` and `btc_txid` are not printed.
:::

To find out what happened:

- Run `ksana-cli account` for the sending account: when `nonce` has gone up, a block has included the operation.
- For path C, look for the transaction in the funding wallet (`bitcoin-cli -signet -rpcwallet=<wallet> listtransactions`) and wait for its confirmations.
- List the account’s latest operations, newest first, with the node’s `ksana_getAccountOps` method. It takes the account as 64 hex digits and gives each operation’s `op_id` and status (this uses `jq`):

```sh
ACCOUNT=$(ksana-cli account @alice.key | jq -r .account)
BODY='{"jsonrpc":"2.0","id":1,"method":"ksana_getAccountOps","params":["'$ACCOUNT'",null,5]}'
curl -sS {{signet.rpc}} -H 'content-type: application/json' \
  --data "$BODY" | jq .result
```

```output
{
  "ops": [
    {
      "op_id": "9e3c9bbeacd422ef8888c9992dc0f7024e1b8ae08edec0ed8dc5897495766503",
      "status": "btc_final",
      "block": {
        "height": "29",
        "hash": "88ab3dd805eac5654cdd752dc1a0a50c2c8d4fac581e2c46b2bd65bc7f35bb50"
      },
      "index": 0,
      "position": "29:0:0"
    },
    {
      "op_id": "032d7d956cff983e57db09411a345aae134aa12b8b0c72305f8cdccfad4bb4b2",
      "status": "btc_final",
      "block": {
        "height": "28",
        "hash": "8948675528f5bdfd5f928bc0ee70ebeec9b3a96612738a4a883247824d9bf4d8"
      },
      "index": 0,
      "position": "28:0:0"
    }
  ],
  "next": null,
  "at": {
    "height": "61",
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f"
  }
}
```

The list covers the operations the account signed, the transfers it received and the operations whose token events or changes to built-in assets name it; the second one here is the faucet’s. Do not send an operation again with a new nonce until you know the first one failed, or both can go through. The [JSON-RPC reference](/docs/rpc/) describes `ksana_getAccountOps` and its paging.

## Common errors

| Message | What to do |
| --- | --- |
| `reading the chain ID of the node at …: … Connection refused` | The node is not running or `--rpc` is wrong. |
| `… Method not found …` while reading the chain ID | `--rpc` points at something other than a node, such as an indexer. |
| `invalid account: invalid address: validation error` | The address belongs to another network than the node’s. |
| `the following required arguments were not provided: <--fee-token <FEE_TOKEN>\|--native>` | Choose path B (`--fee-token`) or path C (`--native`). |
| `-32011` … `an op with the same nonce already exists` | An earlier operation is still waiting; wait for it or set `--nonce`. |
| `bitcoind …: … https feature is not enabled` | Use `http://` for bitcoind. |
| `bitcoind fundrawtransaction: … Method not found` | That bitcoind has no wallet, as with the hosted proxy. Use your own bitcoind with a wallet. |
