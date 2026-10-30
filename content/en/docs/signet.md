---
title: The public signet
nav: Public signet
lede: Ksana’s public test network runs on Bitcoin’s signet. Use it to try wallets, apps, contracts and nodes with coins that have no value.
description: Endpoints, faucet, limits and parameters of Ksana’s public signet, the test network on Bitcoin’s signet with chain ID 1002.
---

The public signet is the Ksana network to use today. It runs on Bitcoin’s public signet, the test network Bitcoin Core joins with `-signet`, so its settlements are real Bitcoin transactions in real signet blocks, mined by signet’s miners. Mainnet has not launched.

| | |
| --- | --- |
| Network name | `signet` (`--chain signet` for the node, the indexer and the CLI) |
| Chain ID | 1002 |
| Bitcoin network | signet: addresses start with `tb1`, accounts with `tb1p` |
| Started | 21 October 2026, anchored at signet height 327,273 |
| Genesis config | [`signet/genesis.json`]({{repo}}/blob/main/signet/genesis.json) in the repository |

::: warning Test coins only
Signet KSA and signet bitcoin (sBTC) have no value. Keep test keys and real keys apart, and never send real bitcoin to an address you made for the signet.
:::

## What the project hosts

The project runs one server at `{{signet.host}}` with Bitcoin Core on signet, two seed nodes that produce and settle blocks, an indexer that checks them, the web wallet, a KSA faucet and a small Bitcoin RPC proxy. Everything else on the network is run by whoever joins: you can follow the chain with [your own node](/docs/run-a-node/), check it with [your own indexer](/docs/run-an-indexer/), and mine.

| Service | Address | Called from other origins |
| --- | --- | --- |
| Web wallet and explorer | `{{signet.wallet}}` | |
| Node JSON-RPC over HTTP | `{{signet.rpc}}` | yes |
| Node JSON-RPC over WebSocket | `{{signet.ws}}` | yes |
| Indexer JSON-RPC | `{{signet.indexer}}` | no |
| Bitcoin RPC proxy | `{{signet.btc}}` | no |
| KSA faucet | `{{signet.faucet}}` | no |
| Seed node P2P | `{{signet.p2p}}` | |

Only the node’s RPC answers browser pages from other origins (it is served with CORS `*`). A web app on its own domain can call `{{signet.rpc}}` directly from the browser, but reaches the indexer, the Bitcoin RPC proxy and the faucet only through its own server. Command-line tools and servers can call all of them.

```sh title="Ask the node for the chain tip"
curl -sS {{signet.rpc}} -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"ksana_getChainInfo","params":[]}'
```

```output
{"jsonrpc":"2.0","id":1,"result":{"chain_id":1002,"tip":{"height":"61","hash":"d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f"},"daa_score":"1860","protocol_version":2,"next_upgrade":null,"max_known_version":2,"finalized":{"height":"38","hash":"ab3fe1dcb95f0d76cd171210567f571fcd81cc8f7559d68da7dd38348eec7cf2"}}}
```

The [JSON-RPC reference](/docs/rpc/) lists every method of the node and the indexer.

## The faucet

The faucet sends 100 KSA from its genesis allocation to any signet account, as an ordinary path B transfer. The web wallet calls it for you; from anywhere else, `POST` a JSON body with your account:

```sh
curl -sS {{signet.faucet}} -H 'content-type: application/json' \
  --data '{"to": "tb1pgtxpryjkcus8l9cazy7eprtxml6hnuhefe3wa55sylmp7n2jf5kshm2h5s"}'
```

```output
{"op_id":"032d7d956cff983e57db09411a345aae134aa12b8b0c72305f8cdccfad4bb4b2","to":"42cc119256c7207f971d113d908d66dff579f2f94e62eed29027f61f4d524d2d","amount":"10000000000","nonce":"2"}
```

`to` takes a signet Taproot address or the account as 64 hex digits. The answer comes once the node has accepted the transfer into its pool, not once a block includes it: follow `op_id` with `ksana-cli op` or `ksana_getOpStatus`. `amount` is in base units (KSA has 8 decimals).

A `GET` returns the faucet’s own state:

```sh
curl -sS {{signet.faucet}}
```

```output
{"chain_id":1002,"account":"de6603f052fd5bfaae5678a2a20ae6ae4fe4ae00c89db70a2efea7429851afc0","address":"tb1pmenq8uzjl4dl4tjk0z32yzhx4e87ftsqezwmwz3wl6n59xz34lqqlgaqc2","balance":"9999949999999995","amount":"10000000000","cooldown_hours":24,"waiting":0}
```

`waiting` counts the transfers the faucet has sent that no block has included yet.

### Faucet limits

| Limit | Answer when it is reached |
| --- | --- |
| One request per account every 24 hours | 429 `this account already received KSA; it can ask again in N hour(s)` |
| Five requests per client address a day | 429 `this address has asked too often today` |
| 30 requests per client address a minute | 429 `too many requests from this address; slow down` |
| About 120 transfers an hour for everyone together | 429 `the faucet is busy; try again in a few minutes` |
| 48 transfers waiting for a block | 503 `the faucet has many transfers waiting for a block; try again in a minute` |

Every error is a JSON object `{"error": "<message>"}`, and the 429 and 503 answers carry a `Retry-After` header in seconds where the wait is known. A malformed body or account gets 400 with the reason, and a refusal by the node 502 `the node refused the transfer: …`.

## The Bitcoin RPC proxy

`{{signet.btc}}` lets the web wallet build and broadcast path C and top-up transactions without a Bitcoin node of your own. It passes four bitcoind methods, one JSON-RPC request per call, with their parameters checked:

| Method | Notes |
| --- | --- |
| `getblockcount` | cached for 2 seconds |
| `getblockchaininfo` | cached for 2 seconds |
| `estimatesmartfee` | a target of 1 to 1008 blocks, cached for 60 seconds |
| `sendrawtransaction` | the signed transaction in hex |

```sh
curl -sS {{signet.btc}} -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"estimatesmartfee","params":[2]}'
```

```output
{"jsonrpc":"2.0","id":1,"result":{"feerate":0.00020055,"blocks":2}}
```

It also passes two `GET` paths of mempool.space’s signet API: `esplora/block-height/0` and `esplora/address/<tb1p…>/utxo`, which lists the coins of a signet Taproot address. Every other method is refused, `scantxoutset` included: one scan of signet’s UTXO set takes 30 to 50 seconds. Each client address may make 120 requests a minute, 20 of them broadcasts and 30 of them Esplora requests.

The proxy has no wallet methods. `ksana-cli`’s path C and `top-up` commands fund their transactions from a wallet in your own bitcoind, as [ksana-cli](/docs/cli/) shows.

## Signet bitcoin

You need sBTC only for what pays Bitcoin fees yourself: a path C operation, a top-up, or settling the blocks you mine. Path B transfers and the faucet need none. Get sBTC from any public Bitcoin signet faucet; the project does not run one.

Send it to your Taproot address, the same one that holds your KSA. A path C transfer at 2 sat/vB costs about 700 sats of fee, so a few thousand sats go a long way. A producer that settles its own blocks needs more: [Run a node](/docs/run-a-node/) gives the amounts.

## How the signet differs from mainnet

The signet runs the same rules as mainnet and shares most of its values: blocks every 5 seconds, GHOSTDAG with K = 16, finality decided at six Bitcoin confirmations and secured by five more blocks, the same gas limits, Argon2id with 2 MiB, and the same carrier shares. These values differ:

| Parameter | Signet | Mainnet |
| --- | --- | --- |
| Chain ID | 1002 | 1000 |
| `ANCHOR_DEPTH` (how far a block’s anchor trails the Bitcoin tip) | 1 | 2 |
| `NATIVE_CONFIRMATIONS` | 1 | 3 |
| A path C operation is included after | 2 Bitcoin confirmations | 5 Bitcoin confirmations |
| Reward per reward slot | 9.9 KSA | 4.2 KSA |
| Halving period, in DAA score | 25,228,800, every period the same | 12,500,000, then 25,000,000, then 50,000,000 |
| KSA cap | 1,000,000,000 | 210,000,000 |
| Genesis allocation | 100,000,000 KSA to the faucet, 10,000,000 to the operator account | none |
| Lowest difficulty (`pow_limit_bits`) | `0x1f0fffff` | `0x1f00ffff` |

devnet, the local network on Bitcoin’s regtest, has the signet’s values except chain ID 1001, `ANCHOR_DEPTH` 0 and the lowest difficulty `0x207fffff`. [Parameters](/docs/parameters/) lists every value for the three networks.

When nobody sends operations, the signet’s producers make empty blocks, which are up to 120 times harder than a block with entries, so an idle signet slows from about a block a minute to about one every ten minutes. The first operation brings back blocks every few seconds. [Mining](/docs/mining/) explains this two-speed difficulty.

## Restarts from genesis

Before mainnet, a change to the consensus rules restarts the signet from genesis with a new `signet/genesis.json`. A restart starts a new chain: balances, contracts and operation history do not carry over, while your keys and addresses stay valid and hold nothing on the new chain.

After a restart:

- Pull the repository for the new `signet/genesis.json` and the code that goes with it.
- Start your node and indexer with a new data directory. A data directory keeps the genesis config it was made with, and the node and the indexer refuse it with `data directory belongs to a different genesis config`.
- Ask the faucet for test KSA again.
