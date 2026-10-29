---
title: Quickstart
lede: Get test KSA on the public signet and send your first operation, from a browser wallet or from the command line, then watch it become final on Bitcoin.
description: Get test KSA from the signet faucet and send a first Ksana operation with Unisat, Xverse or ksana-cli, then follow it from fast-confirmed to final.
---

This page takes you from nothing to a transfer that is final on Bitcoin. Everything happens on the [public signet](/docs/signet/), Ksana’s test network on Bitcoin’s signet: the coins have no value, and mainnet has not launched.

Pick one route. [In the browser](#in-the-browser) needs a Bitcoin wallet extension and a few minutes. [From the command line](#from-the-command-line) needs a Rust toolchain and shows every value the network returns.

Either way, your operation passes three marks:

::: figure marks
An operation is fast-confirmed in seconds, on Bitcoin once the transaction that carries its block is mined, and final after six Bitcoin confirmations and five more blocks that secure the decision.
:::

| Mark | What it means | On the signet |
| --- | --- | --- |
| Fast-confirmed | A producer put your operation in a block and every node executed it. | about 5 seconds |
| On Bitcoin | The block’s data is in a Bitcoin block, readable by anyone. | usually the next Bitcoin block after the settlement is sent |
| Final | Every node and indexer decided from Bitcoin that the block is final when that data had six confirmations, and the Bitcoin block of that decision has six confirmations too. | six confirmations about 50 minutes after it reached Bitcoin, final about 50 minutes later |

[Confirmations](/docs/confirmations/) explains what each mark guarantees and how long to wait for each kind of payment.

## In the browser

You need Unisat or Xverse as a browser extension. The signet wallet page talks to the hosted signet node, so there is nothing to install besides the wallet.

::: steps

### Set up a Bitcoin wallet

Switch the wallet to **Bitcoin Signet** and use a **Taproot (P2TR)** address. Your Ksana account is your Taproot address: KSA and bitcoin share it, each on its own chain. Other address types cannot hold KSA.

- **Unisat**: choose the Taproot address type.
- **Xverse**: the account’s Ordinals address is the Taproot one, and the page uses it.

The page asks the wallet which network it is set to and refuses any other, because a `tb1…` address alone does not tell signet from testnet.

### Connect to the signet wallet

Open [{{signet.wallet}}]({{signet.wallet}}), choose **Wallet**, then **Connect wallet**, and pick your wallet. Approve the connection in the extension.

The page asks only for signatures. It never sees your keys and never holds your coins.

### Claim test KSA

An empty wallet shows **Claim test KSA** under its balance; the **Receive** page has the same faucet as **Get test KSA from the signet faucet**. Either sends 100 KSA to your account.

The faucet pays each account once a day. The KSA arrives in a few seconds, as soon as a producer includes the faucet’s transfer.

### Send KSA

Choose **Send**, paste a recipient (a `tb1p…` address, or an account as 64 hex digits) and an amount. Leave the way to submit at **Sponsored** (path B): the fee is a small amount of KSA, and the page suggests one.

Choose **Review and sign**, check the recipient’s first and last characters, then **Sign and submit**. The wallet asks you to sign one message (BIP322). No bitcoin moves and no Bitcoin fee is paid.

### Watch the three marks

After you sign, the Send page turns into the operation’s progress: **Pending**, **Fast-confirmed**, **On Bitcoin**, **BTC final**. It reaches Fast-confirmed within seconds. The other two follow the Bitcoin blocks, so leave the page open or come back later: the wallet’s **In progress** list and **Activity** keep track, and **View in explorer** shows each Bitcoin transaction involved.

:::

[The signet wallet](/docs/wallet/) covers the rest of the page: path C, top-ups, the explorer, and using your own node.

## From the command line

`ksana-cli` is the command-line client of a Ksana node. Here it talks to the hosted signet node over HTTPS; the faucet is a plain HTTP API, called with `curl`.

::: steps

### Build ksana-cli

The tested platform is Ubuntu 22.04. Install a C toolchain, `clang` and `libclang` (RocksDB is compiled from source), `git`, `curl`, `jq` (other pages use it to pick fields out of JSON) and `rustup`:

```sh title="Prerequisites on Ubuntu 22.04"
sudo apt-get update
sudo apt-get install -y build-essential clang libclang-dev git curl jq
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain none
. "$HOME/.cargo/env"
```

Clone the repository and build. `rustup toolchain install` reads `rust-toolchain.toml` and installs the pinned Rust (1.98.1). The first build compiles RocksDB and wasmtime and can take half an hour on a small machine.

```sh
git clone {{repo}}
cd ksana
rustup toolchain install
cargo build --release --locked -p ksana-cli
export PATH="$PWD/target/release:$PATH"
ksana-cli --version
```

```output
ksana-cli 0.1.0
```

### Make a key

Point the CLI at the signet node, then create a key file. `key` writes a new random secret key to the file (mode `0600`) when the file does not exist, and prints its account and address; it never prints the secret.

```sh
export KSANA_RPC={{signet.rpc}}
ksana-cli --chain signet key alice.key
```

```output
{
  "account": "db3fd0c741d4ba7641a00125bb7e76765ec923a4b86323b901dfb85fb16dea2b",
  "address": "tb1pmvlap36p6ja8vsdqqyjmklnkwe0vjgayhp3j8wgpm7u9lvtdag4s9ngk3n",
  "internal_key": "8ff637a4906fb51061c45cbff37ca22e753313b1d5d56bd7676c7dc5a17fc098",
  "script": "5120db3fd0c741d4ba7641a00125bb7e76765ec923a4b86323b901dfb85fb16dea2b"
}
```

`address` and `account` are the same 32 bytes, written two ways: the Taproot address and its output key in hex. `--chain signet` makes `key` print a signet address; on every other command it makes the CLI refuse a node on another network.

The key file is the only copy of the secret key: anyone who reads it controls the account, and losing it loses the account.

### Ask the faucet

Send your address to the faucet. Replace the address below with the `address` your `key` command printed.

```sh
curl -sS {{signet.faucet}} -H 'content-type: application/json' \
  --data '{"to": "tb1pmvlap36p6ja8vsdqqyjmklnkwe0vjgayhp3j8wgpm7u9lvtdag4s9ngk3n"}'
```

```output
{"op_id":"89a278baadbd3162118630a5119a456c18af6e3e7c5b5d0761c62bb20656d7f0","to":"db3fd0c741d4ba7641a00125bb7e76765ec923a4b86323b901dfb85fb16dea2b","amount":"10000000000","nonce":"1"}
```

The faucet sends 100 KSA (`10000000000` base units: KSA has 8 decimals) as an ordinary transfer, and `op_id` identifies it. It answers as soon as the node accepts the transfer. Each account can ask once a day; [Public signet](/docs/signet/) lists the other limits.

### Check your balance

A few seconds later the transfer is in a block:

```sh
ksana-cli account @alice.key
```

```output
{
  "account": "db3fd0c741d4ba7641a00125bb7e76765ec923a4b86323b901dfb85fb16dea2b",
  "address": "tb1pmvlap36p6ja8vsdqqyjmklnkwe0vjgayhp3j8wgpm7u9lvtdag4s9ngk3n",
  "at": {
    "hash": "d8a91f8bdec0fd69849615308b8b800eec04e6f0aee037ed6fa6e97950604cc1",
    "height": "26"
  },
  "balances": [
    {
      "amount": "10000000000",
      "asset": "0000000000000000000000000000000000000000000000000000000000000000"
    }
  ],
  "locked_fees": [],
  "nonce": "0"
}
```

`@alice.key` stands for the account of the key in that file; an address or 64 hex digits work too. The asset ID of KSA is 64 zeros. If `balances` is still empty, wait a few seconds and ask again.

### Send 1 KSA

Make a second key to send to, then transfer 1 KSA (`100000000` base units) to it on path B with a fee of 1 base unit:

```sh
ksana-cli --chain signet key bob.key
ksana-cli --chain signet transfer --key alice.key --to @bob.key \
  --amount 100000000 --fee-token 1 --wait
```

```output
{
  "account": "db3fd0c741d4ba7641a00125bb7e76765ec923a4b86323b901dfb85fb16dea2b",
  "nonce": "0",
  "op_id": "262b5d466a9f2fc69b2362c38352b635dce95d4385514ac994137891a8cf3dc9",
  "status": {
    "block": {
      "hash": "2681d67b65bc2dabad6ada543bffcb4562ed5dfdb89c8e57f1dc89f75a021e4f",
      "height": "27"
    },
    "index": 0,
    "receipt": {
      "asset_changes": [
        {
          "amount": "100000000",
          "asset": "0000000000000000000000000000000000000000000000000000000000000000",
          "events": 0,
          "from": "db3fd0c741d4ba7641a00125bb7e76765ec923a4b86323b901dfb85fb16dea2b",
          "kind": "transfer",
          "to": "9baa61325ed3b2e169065bdff5ffffe5f5b20ca90bf5f35301f44fb515d039cf"
        }
      ],
      "error": null,
      "events": [],
      "gas_used": "10000",
      "op_id": "262b5d466a9f2fc69b2362c38352b635dce95d4385514ac994137891a8cf3dc9",
      "output": "",
      "success": true
    },
    "status": "fast_confirmed"
  }
}
```

`--wait` polls the node until the operation is executed; this one was fast-confirmed in block 27 about four seconds after it was sent. `--fee-token` is the path B fee in KSA base units, paid to the producer. `ksana-cli estimate-fee` prints the node’s suggestion, which was `1` just before this transfer: the signet nodes include any fee of at least `1` while their blocks have room. The receipt’s `asset_changes` lists what the operation did to built-in assets, here the 1 KSA from alice’s account to bob’s, as this version of the node records it; the signet’s nodes executed this transfer before they recorded such changes, so for it they answer `null`.

### Follow it to final

The status of the operation changes from `fast_confirmed` to `btc_final` once its block is final:

```sh
ksana-cli op 262b5d466a9f2fc69b2362c38352b635dce95d4385514ac994137891a8cf3dc9
```

```output
{
  "block": {
    "hash": "2681d67b65bc2dabad6ada543bffcb4562ed5dfdb89c8e57f1dc89f75a021e4f",
    "height": "27"
  },
  "index": 0,
  "receipt": {
    "asset_changes": [
      {
        "amount": "100000000",
        "asset": "0000000000000000000000000000000000000000000000000000000000000000",
        "events": 0,
        "from": "db3fd0c741d4ba7641a00125bb7e76765ec923a4b86323b901dfb85fb16dea2b",
        "kind": "transfer",
        "to": "9baa61325ed3b2e169065bdff5ffffe5f5b20ca90bf5f35301f44fb515d039cf"
      }
    ],
    "error": null,
    "events": [],
    "gas_used": "10000",
    "op_id": "262b5d466a9f2fc69b2362c38352b635dce95d4385514ac994137891a8cf3dc9",
    "output": "",
    "success": true
  },
  "status": "btc_final"
}
```

In between, the block’s settlement shows the on-Bitcoin mark: `settled` turns `true` once the Bitcoin transactions carrying this block, and every block before it, are mined. This answer is from when they had four confirmations (`jq` leaves out `txs`, the raw transactions):

```sh
ksana-cli settlement 27 | jq 'del(.txs)'
```

```output
{
  "block": {
    "hash": "2681d67b65bc2dabad6ada543bffcb4562ed5dfdb89c8e57f1dc89f75a021e4f",
    "height": "27"
  },
  "btc_final": false,
  "carrier": {
    "hash": "338c18790906240dd8c9943ce84e3b983b24fe2469811e19c45df773f73d0250",
    "height": "31"
  },
  "carrier_account": "b40c816d58ee2578da0118a9c6feeca74b80280f92030bdfa510821ae2887954",
  "commit_txid": "393b36ea0b049dcd64ec8dfe39f558485965fecace3552d3da8cf95f463c5308",
  "commit_txid_rpc": "08533c465ff98cdad35235cecafe65594858f539fe8dec64cd9d040bea363b39",
  "confirmed": {
    "block": "c2d6d161fdef456778a3df4f2ffe65a4627ad100ccbd24122d78fd5006000000",
    "confirmations": 4,
    "height": 327281,
    "txid": "d2232fdbfa7d9b6f16c65cfc60645ccb4ca38fb6aa32f7711d0128b745124f5a"
  },
  "settled": true,
  "status": "confirmed",
  "txid": "d2232fdbfa7d9b6f16c65cfc60645ccb4ca38fb6aa32f7711d0128b745124f5a",
  "txid_rpc": "5a4f1245b728011d71f732aab68fa34ccb5c6460fc5cc6166f9b7dfadb2f23d2"
}
```

Block 27 had no settlement of its own: the settlement of block 31 carried its data (`carrier`), and signet block 327,281 included it. `btc_final` turns `true` five Bitcoin blocks after the sixth confirmation, once the Bitcoin block that gave it has six of its own. `txid_rpc` is the reveal transaction’s ID as explorers write it, as in [this one on mempool.space](https://mempool.space/signet/tx/5a4f1245b728011d71f732aab68fa34ccb5c6460fc5cc6166f9b7dfadb2f23d2).

:::

## How long it took

This page’s transfer went out on 21 October 2026 at 04:55:27 UTC. The times are when `ksana-cli` first showed each mark; after `--wait` returned, it was asked about every 15 seconds.

| Mark | Seen at (UTC) | After sending |
| --- | --- | --- |
| Fast-confirmed, in block 27 | 04:55:31 | 4 seconds |
| On Bitcoin, in signet block 327,281 | 05:02:04 | 7 minutes |
| Six confirmations, at signet block 327,286 | 05:31:42 | 36 minutes |
| Final, at signet block 327,291 | 05:44:09 | 49 minutes |

The settlement of block 19 was still waiting for a signet block when this transfer went out, so block 27 had no settlement of its own: its data went with the settlement of block 31, whose contract deployment, at over 10 KiB, is large enough to settle without waiting. Signet block 327,281, the first in 21 minutes, confirmed both settlements. The sixth confirmation came 30 minutes after the on-Bitcoin mark, and final 12 minutes after that: the ten signet blocks after 327,281 came between 2 seconds and 10 minutes apart, about 4 minutes on average. Signet blocks come every ten minutes on average, so expect about an hour to the sixth confirmation and about 110 minutes to final, and sometimes more.

## Where to go next

::: cards
- [How Ksana works](/docs/how-it-works/) The fast lane, settlement into Bitcoin, and finality decided from Bitcoin.
- [Operations and fees](/docs/submitting-ops/) Path B, path C and top-ups, and what each costs.
- [ksana-cli](/docs/cli/) Every command: queries, contracts, path C and the exchange.
- [Run a node](/docs/run-a-node/) Follow the signet yourself, check every block against Bitcoin, and mine.
:::
