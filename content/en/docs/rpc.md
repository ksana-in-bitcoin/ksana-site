---
title: JSON-RPC API
nav: JSON-RPC
lede: Every method of a Ksana node’s JSON-RPC interface and of the indexer’s, with the JSON conventions, the errors, and real calls to the public signet.
description: Reference for the Ksana node and indexer JSON-RPC methods, their parameters, results and error codes, with curl examples against the public signet.
---

A Ksana node answers JSON-RPC 2.0 over HTTP and WebSocket on one port. The indexer answers two methods of its own. Wallets, apps, [ksana-cli](/docs/cli/) and the [TypeScript SDK](/docs/sdk/) all use this interface.

Every example on this page is a real call to the public signet, made on 21 October 2026. Mainnet has not launched. The receipts show `asset_changes` as this version of the node records them; for these operations, which the signet’s nodes executed before they recorded the changes, the nodes answer `null`.

## Endpoints

| Service | Default address | Public signet |
| --- | --- | --- |
| Node, HTTP | `127.0.0.1:8545` (`ksana-node --rpc-addr`) | `{{signet.rpc}}` |
| Node, WebSocket | the same port | `{{signet.ws}}` |
| Indexer, HTTP | `127.0.0.1:8546` (`ksana-indexer --rpc-addr`) | `{{signet.indexer}}` |

Calls take positional parameters: `params` is a JSON array, in the order the sections below list them. Send `content-type: application/json`.

### Calls from web pages

Browsers call another origin only when the server allows it (CORS). A node allows none by default; start it with `--rpc-cors '*'` to allow every origin, or with a comma-separated list of origins. Command-line tools and servers are not affected.

On the public signet, the node’s RPC allows every origin and the indexer allows none. A preflight request shows the difference:

```sh
curl -sS -i -X OPTIONS {{signet.rpc}} -H 'origin: https://example.org' \
  -H 'access-control-request-method: POST' -H 'access-control-request-headers: content-type' \
  | grep -i -E '^(HTTP/2|access-control)'
```

```output
HTTP/2 200
access-control-allow-headers: content-type
access-control-allow-methods: POST,GET,OPTIONS
access-control-allow-origin: *
```

The same request to `{{signet.indexer}}` gets `HTTP/2 405`. Call the indexer from a server or a command line.

### Limits {#limits}

The node and the indexer apply the same limits to every client. They are local policy, not consensus rules, and the server answers what passes one with an error of its own:

| Limit | Value | Beyond it |
| --- | --- | --- |
| Calls in one batch | 64 | The whole batch is refused with one error, `-32010`, whose `id` is `null`; none of its calls runs |
| Request body, or one WebSocket message | 1 MiB | `-32007`, with HTTP status 413 |
| Response | 10 MiB | `-32008`; for a batch, `-32011` with `id` `null` |
| Connections at once, HTTP and WebSocket together | 100 | HTTP status 429 |
| Subscriptions on one WebSocket connection | 16 | `-32006` |

A batch refused for its size has run nothing: send its calls again in smaller batches. `ksana_submitOp` answers `-32010` and `-32011` too, when the node refuses an operation; an error that answers a whole batch has `id` `null`, one that answers a call has the call's `id`.

## A first call

Ask the node for its chain tip:

```sh
curl -sS {{signet.rpc}} -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"ksana_getChainInfo","params":[]}' | jq
```

```output
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "chain_id": 1002,
    "tip": {
      "height": "61",
      "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f"
    },
    "daa_score": "1860",
    "protocol_version": 2,
    "next_upgrade": null,
    "max_known_version": 2,
    "finalized": {
      "height": "38",
      "hash": "ab3fe1dcb95f0d76cd171210567f571fcd81cc8f7559d68da7dd38348eec7cf2"
    }
  }
}
```

The other examples use a small shell function and print only `result`. It needs `curl` and `jq`:

```sh
NODE={{signet.rpc}}
INDEXER={{signet.indexer}}
rpc() {  # rpc <url> <method> [params as a JSON array]
  curl -sS "$1" -H 'content-type: application/json' \
    --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$2\",\"params\":${3:-[]}}"
}
ACCOUNT=b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09d
KSA=0000000000000000000000000000000000000000000000000000000000000000
```

`ACCOUNT` is the account of the [token and pool tutorial](/docs/token-and-pool/), and `KSA` is the asset ID of KSA.

## JSON conventions {#conventions}

- **Bytes** (hashes, accounts, asset and contract IDs, Borsh encodings) are lowercase hex strings without `0x`.
- **`u64` and `u128` values** (heights, nonces, amounts, gas) are decimal strings, because JavaScript numbers hold only 53 bits. `u8` and `u32` values (decimals, BTC heights, counts) are JSON numbers.
- **Block identifiers** are `"latest"`, a decimal height such as `"33"`, or a 64-digit block hash. A height names a block of the main chain; a hash can name any block the node knows.
- **Bitcoin IDs** (`txid`, BTC block hashes) are in Bitcoin’s internal byte order, the reverse of what explorers show. Fields that end in `_rpc` give the explorer order.
- **Protocol types** (block headers, entries, VmOps) use the JSON form of the repository’s test vectors: an enum is an object with one key, its variant, such as `{"Token": {"amount": "1"}}`.

## Methods at a glance

| Method | Parameters | Result |
| --- | --- | --- |
| [`ksana_getChainInfo`](#ksana_getchaininfo) | none | chain ID, tip, DAA score, versions, finalized tip |
| [`ksana_estimateFee`](#ksana_estimatefee) | none | suggested path B fee and the node’s BTC fee rate |
| [`ksana_getAccount`](#ksana_getaccount) | account | nonce, balances, locked fees |
| [`ksana_getAsset`](#ksana_getasset) | asset ID | name, symbol, decimals, total supply, issuer, capabilities |
| [`ksana_getAssetStatus`](#ksana_getassetstatus) | asset ID, account | the account’s flags, whether it can send and receive the asset |
| [`ksana_getContract`](#ksana_getcontract) | contract ID | code hash, deployer, declared standards |
| [`ksana_getAccountAssets`](#ksana_getaccountassets) | account, `after`, `limit` | a page of an account’s assets, tokens and NFTs |
| [`ksana_getToken`](#ksana_gettoken) | contract ID | a token’s standard, metadata, supply and holder count |
| [`ksana_getTokenHolders`](#ksana_gettokenholders) | contract ID, `after`, `limit` | a page of a token’s holders, the largest first |
| [`ksana_getNfts`](#ksana_getnfts) | account, `contract`, `after`, `limit` | a page of an account’s NFTs |
| [`ksana_getApprovals`](#ksana_getapprovals) | account, `after`, `limit` | a page of the approvals an account gave |
| [`ksana_submitOp`](#ksana_submitop) | VmOp (Borsh, hex) | op ID |
| [`ksana_getOpStatus`](#ksana_getopstatus) | op ID | status, block, receipt |
| [`ksana_getAccountOps`](#ksana_getaccountops) | account, `before`, `limit` | a page of an account’s ops |
| [`ksana_getLatestOps`](#ksana_getlatestops) | `before`, `limit` | a page of the chain’s ops |
| [`ksana_getBlock`](#ksana_getblock) | block identifier | header, entries, receipts |
| [`ksana_getSettlement`](#ksana_getsettlement) | block identifier | the settlement and its Bitcoin status |
| [`ksana_call`](#ksana_call) | call request | receipt of a read-only call |
| [`ksana_subscribeBlocks`](#ksana_subscribeblocks) | none (WebSocket) | a notification per new block |
| [`indexer_status`](#indexer_status) | none | the indexer’s verified tip |
| [`indexer_stateRoot`](#indexer_stateroot) | block identifier | a verified block’s state root |

## Chain and fees

### `ksana_getChainInfo`

No parameters. The result, shown in [A first call](#a-first-call):

| Field | Meaning |
| --- | --- |
| `chain_id` | 1002 on the signet, 1001 on devnet, 1000 on mainnet |
| `tip` | the main chain’s tip, `{ "height", "hash" }` |
| `daa_score` | the tip’s DAA score; each block adds its weight (an empty block weighs more) |
| `protocol_version` | the tip’s block header version |
| `next_upgrade` | the next scheduled upgrade, `{ "version", "daa_score" }`, or `null` |
| `max_known_version` | the highest protocol version this node’s software supports |
| `finalized` | the BTC-final tip: the newest block decided final at a Bitcoin block that now has 6 confirmations; the main chain passes through it, and only a Bitcoin reorganization of at least 6 blocks can take it back |

When the network’s `protocol_version` passes `max_known_version`, the node’s software needs an upgrade. Before any block is final, `finalized` is the genesis block.

### `ksana_estimateFee`

No parameters. It suggests fees; it does not change what the node accepts.

```sh
rpc $NODE ksana_estimateFee | jq .result
```

```output
{
  "feerate_sat_vb": "2",
  "path_b": {
    "amount": "1",
    "per_kib": "4"
  },
  "at": {
    "height": "61",
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f"
  }
}
```

- `feerate_sat_vb` is the fee rate, in sat/vB, at which this node pays for its settlements now. Use it as a reference for path C transactions and top-ups.
- `path_b.per_kib` is a suggested fee rate for path B: base units of KSA per KiB of cost. The cost of an op is the larger of its encoded size and its `max_gas` converted to bytes (`max_gas × 81,920 / 100,000,000`). The node takes the median, over its last 20 main-chain blocks, of each block’s lowest path B fee rate, and never goes below its own `--min-fee-per-kib`.
- `path_b.amount` is the suggested fee of an ordinary KSA transfer at that rate, never below the node’s `--min-token-fee`. For another op, multiply its cost by `per_kib`.
- `at` is the tip the estimate was read at.

[Operations and fees](/docs/submitting-ops/) explains the fee rules.

## Accounts and assets

### `ksana_getAccount`

Parameter: the account, as 64 hex digits (the Taproot output key, not the `tb1p` address).

```sh
rpc $NODE ksana_getAccount "[\"$ACCOUNT\"]" | jq .result
```

```output
{
  "account": "b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09d",
  "nonce": "9",
  "balances": [
    {
      "asset": "0000000000000000000000000000000000000000000000000000000000000000",
      "amount": "6975669407"
    }
  ],
  "locked_fees": [],
  "at": {
    "height": "61",
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f"
  }
}
```

- `nonce` is the account’s next nonce on the main chain. Ops still waiting in the entry pool are not counted.
- `balances` lists the available balance of each built-in asset, in base units. A token kept in a contract’s storage, such as the `token` example, does not appear here: [`ksana_getAccountAssets`](#ksana_getaccountassets) lists the KS-20 tokens and KS-721 NFTs an account holds, and the contract answers how much.
- `locked_fees` lists what the account is owed by blocks that are not unlocked yet, one entry per block, `[{ "block_hash", "amount" }]`: its reward and path B fees as the block’s producer, its part as the block’s carrier, and the block share for the block share account. It is empty for an account owed nothing.
- `at` is the block the answer was read at.

### `ksana_getAsset`

Parameter: the asset ID. KSA’s ID is 64 zeros.

```sh
rpc $NODE ksana_getAsset "[\"$KSA\"]" | jq .result
```

```output
{
  "asset": "0000000000000000000000000000000000000000000000000000000000000000",
  "name": "KSA",
  "symbol": "KSA",
  "decimals": 8,
  "total_supply": "11001412730000000",
  "issuer": "0000000000000000000000000000000000000000000000000000000000000000",
  "capabilities": [],
  "paused": false,
  "at": {
    "height": "61",
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f"
  }
}
```

`total_supply` is in base units: the genesis allocation plus the block rewards issued so far, minus burns. `issuer` is the contract that issued the asset, or zeros for KSA. An unknown asset returns `-32004`.

`capabilities` lists what the issuing contract can still do to the asset, in the order `mint`, `freeze`, `allowlist`, `pause`: issue more, freeze an account, admit only the accounts it allows, pause every account but its own. It is empty for KSA and for an asset with a fixed supply that nobody can stop. Capabilities are only ever given up, and none moves a balance. `paused` is `true` while the issuing contract has paused the asset. [Host functions](/docs/host-functions/#assets) explains the rules.

### `ksana_getAssetStatus`

Parameters: the asset ID and the account.

```sh
rpc $NODE ksana_getAssetStatus "[\"$KSA\", \"$ACCOUNT\"]" | jq .result
```

```output
{
  "asset": "0000000000000000000000000000000000000000000000000000000000000000",
  "account": "b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09d",
  "status": [],
  "can_send": true,
  "can_receive": true,
  "at": {
    "height": "61",
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f"
  }
}
```

- `status` lists the account’s flags for the asset, `frozen` and `allowed`. A flag counts only while the asset still has the matching capability.
- `can_send` is whether the asset’s rules let the account send it now: it is not frozen, it is allowed when the asset has an allowlist, and the asset is not paused, unless the account is the issuing contract. Its balance is not considered.
- `can_receive` is whether the rules let the account receive the asset now.
- Check both before sending an asset with capabilities: an op the rules refuse still pays its fee. An unknown asset returns `-32004`.

## Tokens and NFTs

A node indexes the events of KS-20 tokens and KS-721 collections, the contracts that follow the [token standards]({{repo}}/blob/main/docs/STANDARDS.md), from the receipts of the operations its main chain executes. The methods of this section read that index. It is the node’s own bookkeeping, not part of consensus, and the node keeps it in step with its main chain, reorganizations included.

- **What counts.** A contract’s first `standards` event is its declaration, and from then on the index counts the events of the standard it names first. An event that breaks the standard, such as a transfer of more than the sender holds by the token’s own events, is left out, and the token is marked `irregular`.
- **The index and the contract.** The index tells what an account holds; the contract tells how much. Read `balance_of`, `allowance` or `owner_of` with [`ksana_call`](#ksana_call) before you act on an amount. An allowance is listed as its latest `approve` event set it: spending it emits no new event, so `amount` stays what was approved while the token’s `allowance` gives what is left. Approvals stay listed after they expire, until a new event changes them.
- **Pages.** Pass the previous page’s `next` as `after` to continue, and `null` (or nothing) for the first page. `limit` is 1 to 500, 50 by default, and `next` is `null` at the end. `at` is the tip the page was read at; an item that moved between two pages, such as a holder whose balance changed, can be missed or listed twice.
- **Older nodes.** A node from before the index, or one whose index is not built, returns `-32601`, as it does for the op listings. A malformed ID or `after`, or a `limit` out of range, returns `-32602`.

### `ksana_getContract`

Parameter: a contract ID. It answers for any contract, standard or not:

| Field | Meaning |
| --- | --- |
| `contract` | the contract ID |
| `code_hash` | the SHA-256 of the contract’s code: compare it with a known build |
| `deployer` | the account that deployed it |
| `standards` | its declaration, the standard first and then its extensions, such as `["KS-20", "KS-20-burnable"]`; empty when it declared nothing |
| `declared` | the [position](#ksana_getaccountops) of the operation that made the declaration, or `null` |
| `at` | the block the answer was read at |

An ID that is not a contract returns `-32004`.

A token or a collection that keeps its standard declares itself in its `init`, so `declared` is the position of its deployment, the op whose events also hold its first `metadata`. [`ksana_getAccountOps`](#ksana_getaccountops) never lists a deployment under the contract it deploys: to read the deployment, call [`ksana_getLatestOps`](#ksana_getlatestops) with `limit` 1 and `before` one entry past it (for `"412:1:3"`, pass `"412:1:4"`).

### `ksana_getAccountAssets`

Parameters: `account`, `after` (optional), `limit` (optional). Everything the account holds, in one list: its built-in assets by asset ID, then its KS-20 tokens and KS-721 collections by contract ID. Each item has a `kind`:

| `kind` | Fields | Meaning |
| --- | --- | --- |
| `asset` | `asset`, `balance` | a built-in asset, with the balance [`ksana_getAccount`](#ksana_getaccount) shows |
| `token` | `contract`, `balance` | a KS-20 token, with the balance its events add up to |
| `nft` | `contract`, `count` | a KS-721 collection, with how many of its NFTs the account holds |

Amounts are base units, in decimal strings. A token or a collection is listed while the account holds some of it.

### `ksana_getToken`

Parameter: the contract ID of a token or a collection.

| Field | Meaning |
| --- | --- |
| `contract` | the contract ID |
| `standard` | `KS-20` or `KS-721` |
| `extensions` | the extensions it declared, such as `KS-20-mintable` |
| `name`, `symbol` | from its latest `metadata` event, or `null` before one |
| `decimals` | a token’s decimals, a number; `null` for a collection |
| `supply` | the token’s supply in base units, or how many NFTs of the collection exist |
| `holders` | how many accounts hold some |
| `declared` | the position of the operation that made its declaration |
| `irregular` | `true` once the index left out one of its events: its balances may then differ from what the contract says |
| `at` | the block the answer was read at |

A contract that declared neither standard, or an ID that is not a contract, returns `-32004`.

### `ksana_getTokenHolders`

Parameters: the contract ID, `after` (optional), `limit` (optional). The holders of a token or a collection, the largest first, each `{ "account", "balance" }`; for a collection, `balance` is a number of NFTs. Holders with the same balance come by account, the highest first. A contract `ksana_getToken` does not know returns `-32004`.

### `ksana_getNfts`

Parameters: `account`, `contract` (optional), `after` (optional), `limit` (optional). The NFTs the account holds, each `{ "contract", "token_id" }`, by collection and then token ID; with `contract`, only that collection’s. A token ID is 32 bytes, and the [SDK](/docs/sdk/#use-ks-20-and-ks-721-tokens) turns serial numbers into IDs and back.

### `ksana_getApprovals`

Parameters: `account`, `after` (optional), `limit` (optional). The approvals the account gave, by contract and then kind:

| `kind` | Fields | Meaning |
| --- | --- | --- |
| `allowance` | `contract`, `spender`, `amount`, `expires_at` | a KS-20 allowance, as its latest `approve` event set it |
| `operator` | `contract`, `operator`, `expires_at` | a KS-721 operator, who may move all of the account’s NFTs in the collection |
| `token` | `contract`, `token_id`, `spender` | the account approved to move one NFT; the approval goes when the NFT changes owner |

`expires_at` is a block timestamp in seconds, as a decimal string, from which the approval no longer counts, or `null` when it has no end. To revoke an approval, send the standard’s call that clears it: `approve` with an amount of 0 for an allowance, `set_operator` with `approved` false for an operator, `approve` with no spender for one NFT.

## Operations

### `ksana_submitOp`

Parameter: a signed path B VmOp, Borsh-encoded, in hex. Result: `{ "op_id" }`.

The node checks the op against the consensus rules (version, chain ID, size, signature, a nonce not below the account’s) and against its own policy (minimum fee, capacity). A producing node answers once the op is in its next block template, or after 5 seconds at most.

- A path C op does not go through this method: it travels in a Bitcoin transaction, and `ksana_submitOp` refuses it with `-32010`.
- An op that breaks a consensus rule returns `-32010`; an op the node’s policy refuses (fee too low, pool full, a replacement that does not raise the fee enough) returns `-32011`.
- Bytes that do not decode return `-32602`:

```sh
rpc $NODE ksana_submitOp '["00"]' | jq .error
```

```output
{
  "code": -32602,
  "message": "VmOp decode failed: Borsh decode failed: Unexpected length of input"
}
```

The [TypeScript SDK](/docs/sdk/) and [ksana-cli](/docs/cli/) build, sign and encode ops for you.

### `ksana_getOpStatus`

Parameter: the op ID. The example asks for a faucet transfer:

```sh
OP=a91054efcbde256b412d0d5286d922ce5377ac6a3ea0941a2eabe41cbaaf090e
rpc $NODE ksana_getOpStatus "[\"$OP\"]" | jq .result
```

```output
{
  "status": "btc_final",
  "block": {
    "height": "30",
    "hash": "f564dcd99ab57f8cc2a38e76232a717a2b4a0a3cc2707fcb55ca22e04c687e01"
  },
  "index": 0,
  "receipt": {
    "op_id": "a91054efcbde256b412d0d5286d922ce5377ac6a3ea0941a2eabe41cbaaf090e",
    "success": true,
    "error": null,
    "gas_used": "10000",
    "output": "",
    "events": [],
    "asset_changes": [
      {
        "kind": "transfer",
        "asset": "0000000000000000000000000000000000000000000000000000000000000000",
        "from": "de6603f052fd5bfaae5678a2a20ae6ae4fe4ae00c89db70a2efea7429851afc0",
        "to": "b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09d",
        "amount": "10000000000",
        "events": 0
      }
    ]
  }
}
```

| `status` | Meaning |
| --- | --- |
| `pending` | in the entry pool, not yet in a block |
| `fast_confirmed` | in a block of the main chain and executed successfully |
| `failed` | in a block, but its execution failed: the state is rolled back and the fee is charged |
| `skipped` | included only by a merged block and could not be executed; no fee is charged, and the op can return to the entry pool |
| `btc_final` | executed successfully, and the block that accepted it is BTC-final |

`block.hash` is the block that included the op. `block.height` is the height of the main-chain block that accepted it: an op in a merged block takes effect at the height of the block that merges it. `index` is the entry’s place in its block. An unknown op returns `-32004`, and [Confirmations](/docs/confirmations/) explains the marks behind these statuses.

`receipt.asset_changes` lists what the op did to built-in assets, in the order it did it: here the transfer itself. Each change has a `kind` and an `asset`, and `events` counts the op’s events before it, so that the two lists read in the op’s order:

| `kind` | Fields | The change |
| --- | --- | --- |
| `transfer` | `from`, `to`, `amount` | an `AssetTransfer` op, from its signer |
| `funds` | `from`, `to`, `amount` | assets attached to a call or a deployment, by the op’s signer or by a contract to a contract it calls or creates |
| `payout` | `from`, `to`, `amount` | a contract paying from its own balance |
| `issue` | `to`, `amount` | the issuing contract issuing more |
| `burn` | `from`, `amount` | a burn |
| `create` | `capabilities` | the asset’s creation, its capabilities named as [`ksana_getAsset`](#ksana_getasset) names them; the issuance follows as an `issue`, unless it is of 0 |
| `freeze` | `account`, `frozen` | the issuing contract freezing an account, or unfreezing it |
| `allow` | `account`, `allowed` | the issuing contract putting an account on its allowlist, or taking it off |
| `pause` | `paused` | the issuing contract pausing the asset, or resuming it |
| `renounce` | `capabilities` | the capabilities the issuing contract gave up, none if the asset no longer had them |

A failed op has no changes, and neither fees nor movements of 0 are changes. `asset_changes` is `null` in the receipts a node stored before it recorded them, and a node from before has no such field.

### `ksana_getAccountOps`

Parameters: `account`, `before` (optional), `limit` (optional). It lists the ops of one account on the main chain, newest first: the ops it signed, the transfers to it, the calls to it as a contract, the ops whose [token events](#tokens-and-nfts) name it or were emitted by it, and the ops whose [changes to built-in assets](#ksana_getopstatus) name it, other than its own deployment. Given the ID of an asset other than KSA, it lists the ops that changed that asset.

```sh
rpc $NODE ksana_getAccountOps "[\"$ACCOUNT\", null, 2]" | jq .result
```

```output
{
  "ops": [
    {
      "op_id": "85aa965def12e9cc329dc120f9fcabf2ad165b70731917fc47158e0b87b42f0d",
      "status": "fast_confirmed",
      "block": {
        "height": "39",
        "hash": "7a485752fb81319c9d454215968acb3010139cc79f52457feff6d8f25653c5c6"
      },
      "index": 0,
      "position": "39:0:0"
    },
    {
      "op_id": "797d9dc411ae59e79ce0aa8a369ec151f9416f7afb18569c0181fe81ebecc2e0",
      "status": "btc_final",
      "block": {
        "height": "38",
        "hash": "ab3fe1dcb95f0d76cd171210567f571fcd81cc8f7559d68da7dd38348eec7cf2"
      },
      "index": 0,
      "position": "38:0:0"
    }
  ],
  "next": "38:0:0",
  "at": {
    "height": "61",
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f"
  }
}
```

- `position` is an op’s place on the main chain, `"height:slot:entry"`: the height of the main-chain block that accepted it, the place of its block among the blocks that one accepted, and the entry’s index. Listings run from the highest position down.
- `before` is a position: the page lists the ops below it. Pass the previous page’s `next` to continue, and `null` (or nothing) for the newest ops.
- `limit` is 1 to 500, 50 by default.
- `next` is `null` once the listing reaches the genesis block. A page can hold fewer ops than `limit`, even none, while `next` is not `null`: keep following `next`.

The next page continues below `38:0:0`:

```sh
rpc $NODE ksana_getAccountOps "[\"$ACCOUNT\", \"38:0:0\", 2]" \
  | jq -c '.result.ops[].position, .result.next'
```

```output
"37:0:0"
"36:0:0"
"36:0:0"
```

Listings include path B and path C ops, not unlock entries. A node from before these methods existed, or one whose op index is not built, returns `-32601`. A malformed account or position, or a `limit` out of range, returns `-32602`.

### `ksana_getLatestOps`

Parameters: `before` (optional), `limit` (optional). The same listing as `ksana_getAccountOps`, for every account:

```sh
rpc $NODE ksana_getLatestOps '[null, 1]' | jq .result
```

```output
{
  "ops": [
    {
      "op_id": "54dfe7da3eccfadafdaf89422d718ead59ee35a7100fa1c96553b38c2ca230bb",
      "status": "fast_confirmed",
      "block": {
        "height": "49",
        "hash": "ce36e3736a66c3773ed309cae018dd6e51fe2e4ad1e11b7d46893238026882a6"
      },
      "index": 0,
      "position": "49:0:0"
    }
  ],
  "next": "49:0:0",
  "at": {
    "height": "61",
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f"
  }
}
```

## Blocks and settlements

### `ksana_getBlock`

Parameter: a block identifier. The result holds `hash`, `header`, `entries`, `settlement`, `receipts`, `accepted_height` and `merged`. The example leaves out `entries` and `receipts` to stay short:

```sh
rpc $NODE ksana_getBlock '["33"]' | jq '.result | del(.entries, .receipts)'
```

```output
{
  "hash": "8f3d978dd672b44bf040d325af63e4701a00d9e04e620178480a5b36b636b593",
  "header": {
    "version": 2,
    "height": "33",
    "parents": [
      "5131d895b03d85d20262c6bc70417a36bb3d8c46c03059167d29267e7118a1b4"
    ],
    "btc_anchor": {
      "height": 327279,
      "hash": "c770c385e86ae4792f479f8a8c0fd3fde68b3fb604d47911afa42c5103000000"
    },
    "entries_root": "418ccbe2a7af7e2dd1e10948e51a1558358ac3b3f20fdc3efd09e5351bba20d1",
    "state_root": "bcd3279d347647192768169d53610bb36fe0681b0213e46a3e8193fae792f8ad",
    "producer": "b40c816d58ee2578da0118a9c6feeca74b80280f92030bdfa510821ae2887954",
    "timestamp": "1792558601",
    "bits": 520499867,
    "nonce": "371"
  },
  "settlement": null,
  "accepted_height": "33",
  "merged": []
}
```

- `header.parents` lists the block’s parents in the block DAG; `btc_anchor` is the Bitcoin block it anchors to; `producer` is the account that made it.
- `entries` lists the block’s entries, each an object with one key: `Sponsored` (a path B op), `Forced` (a path C op with the `btc_txid` that carried it) or `Unlock`.
- `receipts` holds one receipt per entry, from when the main chain accepted the block. An entry whose `error` starts with `skipped` was not executed.
- `settlement` holds the block’s own commit and reveal transactions, `{ "commit", "reveal" }`, as hex, or `null` when it carries none.
- `accepted_height` is the height of the main-chain block that accepted this one: its own height on the main chain, the merging block’s height for a merged block, `null` while no main-chain block has accepted it.
- `merged` lists the blocks it merges, in the order their entries run.

The entry of block 33, without its signature:

```sh
rpc $NODE ksana_getBlock '["33"]' | jq '.result.entries[0].Sponsored.op | del(.sig)'
```

```output
{
  "version": 2,
  "chain_id": 1002,
  "account": "b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09d",
  "nonce": "2",
  "fee": {
    "Token": {
      "amount": "1"
    }
  },
  "max_gas": "1000000",
  "action": {
    "Call": {
      "contract": "6569e81e9aa68a0ae8058c3f749de4b0f13d2f3448f12831d8ccf0960c329658",
      "method": "transfer_and_call",
      "args": "eb5ca55289984d64598a12303a0638ee9dd6edc50f4bebe6d43a7a46121fc74500a0724e180900000000000000000000210000000100f2052a01000000000000000000000001000000000000000000000000000000",
      "funds": [
        {
          "asset": "0000000000000000000000000000000000000000000000000000000000000000",
          "amount": "5000000000"
        }
      ]
    }
  }
}
```

`sig` is `{"Bip340": "<64 bytes>"}` for a key signature or `{"Bip322Simple": "<bytes>"}` for a wallet signature. `fee` is `{"Token": {"amount"}}` for path B and `"BtcNative"` for path C. `action` is `Deploy`, `Call` or `AssetTransfer`.

### `ksana_getSettlement`

Parameter: a block identifier. It tells you whether the block’s data is on Bitcoin. The example leaves out `txs`, the two raw transactions (`{ "commit", "reveal" }` in hex):

```sh
rpc $NODE ksana_getSettlement '["38"]' | jq '.result | del(.txs)'
```

```output
{
  "block": {
    "height": "38",
    "hash": "ab3fe1dcb95f0d76cd171210567f571fcd81cc8f7559d68da7dd38348eec7cf2"
  },
  "txid": "a31ec70b067407708454acf3cea6af68851c4e2cea4d682c737dc76003943921",
  "txid_rpc": "2139940360c77d732c684dea2c4e1c8568afa6cef3ac5484700774060bc71ea3",
  "commit_txid": "97080af7841e539719cb93c78562f11d9f9e4f155930785224c460f32e99f702",
  "commit_txid_rpc": "02f7992ef360c42452783059154f9e9f1df16285c793cb1997531e84f70a0897",
  "carrier_account": "ccc06c3ce8d176b3c10138dd4e70873939a9c6dc05597f45aace147ef2c07d3d",
  "carrier": null,
  "status": "confirmed",
  "confirmed": {
    "txid": "a31ec70b067407708454acf3cea6af68851c4e2cea4d682c737dc76003943921",
    "height": 327281,
    "block": "c2d6d161fdef456778a3df4f2ffe65a4627ad100ccbd24122d78fd5006000000",
    "confirmations": 11
  },
  "settled": true,
  "btc_final": true
}
```

- `txid` is the reveal transaction, which carries the payload in its Taproot witness; `commit_txid` is the commit transaction it spends. The `_rpc` fields give them in explorer order.
- `status` is `pending` (not broadcast yet: a settlement waits until the block has 2 fast-lane confirmations), `broadcast`, or `confirmed`.
- `confirmed` describes the first confirmed Bitcoin transaction that put the block’s data on Bitcoin, `{ "txid", "height", "block", "confirmations" }`. That can be the block’s own settlement, a later block’s, or a republish.
- `settled` is `true` once the data of the block that accepted it, and of every main-chain block before that one, is on Bitcoin; `btc_final` is `true` once the block that accepted it is final.
- `carrier_account` is the account paid as the block’s carrier, or `null` when the producer keeps the reward. It is answered from the current Bitcoin chain and main chain.

A block can have its body carried by a later block’s settlement (batching). Its `carrier` then names that block, and the transaction fields describe that block’s settlement; while no block carries it yet, they are `null` and `status` is `pending`. An empty block, or one holding only path C operations, has no body to land, so it returns `-32004` when it carries no settlement itself.

## Read-only calls

### `ksana_call`

Parameter: one call request object. It runs a contract method on the latest state without a fee, without a nonce, and without writing anything:

| Field | Required | Meaning |
| --- | --- | --- |
| `contract` | yes | the contract ID |
| `method` | yes | the method name |
| `args` | yes | the arguments, Borsh-encoded, in hex (`""` for none) |
| `funds` | no | attached assets, `[{ "asset", "amount" }]`, moved from `caller` in the simulation |
| `caller` | no | the simulated caller, 32 zero bytes by default |
| `max_gas` | no | a decimal string, at most `BLOCK_GAS_LIMIT` (100,000,000, also the default) |

Read a pool’s reserves (the tutorial’s pool, `(u128, u128)` little-endian):

```sh
POOL=eb5ca55289984d64598a12303a0638ee9dd6edc50f4bebe6d43a7a46121fc745
rpc $NODE ksana_call "[{\"contract\": \"$POOL\", \"method\": \"reserves\", \"args\": \"\"}]" \
  | jq .result
```

```output
{
  "op_id": null,
  "success": true,
  "error": null,
  "gas_used": "50570",
  "output": "be310d09810400000000000000000000583a7696000000000000000000000000",
  "events": [],
  "asset_changes": []
}
```

Attached funds come out of `caller`’s balance, so a simulation that attaches funds needs a funded `caller`. Here a quote for swapping 1 KSA in that pool, without `caller`, fails, and a failed call reports all of `max_gas` as used:

```sh
ARGS=${KSA}00e1f50500000000000000000000000001000000000000000000000000000000
rpc $NODE ksana_call "[{\"contract\": \"$POOL\", \"method\": \"swap\", \"args\": \"$ARGS\",
  \"funds\": [{\"asset\": \"$KSA\", \"amount\": \"100000000\"}], \"max_gas\": \"500000\"}]" \
  | jq .result
```

```output
{
  "op_id": null,
  "success": false,
  "error": "attached funds transfer failed: insufficient balance",
  "gas_used": "500000",
  "output": "",
  "events": [],
  "asset_changes": []
}
```

With `"caller": "$ACCOUNT"` added, the call succeeds and returns the quote:

```output
{
  "op_id": null,
  "success": true,
  "error": null,
  "gas_used": "169247",
  "output": "f4513fcf2b0000000000000000000000"
}
```

(That output leaves out `events` and `asset_changes`.) The receipt is `{ "op_id", "success", "error", "gas_used", "output", "events", "asset_changes" }`, the same shape as an op’s receipt with `op_id` set to `null`, and `asset_changes` lists the changes the call would make to built-in assets, the attached funds first. `output` is the hex of the bytes the method returned, and each event is `{ "contract", "data" }`.

The call sees the environment of the next block: its height is the tip’s plus one, with the tip’s timestamp and Bitcoin anchor. `native_tx()` returns nothing. A `max_gas` above the limit returns `-32602`. A node runs at most 4 calls at a time; further calls return `-32009` until one finishes.

## Subscriptions

### `ksana_subscribeBlocks`

Over WebSocket only. The answer is a subscription ID. Then every block that joins the main chain, including the blocks a reorganization connects, arrives as a `ksana_block` notification. To stop, call `ksana_unsubscribeBlocks` with the subscription ID.

This JavaScript runs in a browser or in Node.js 22 and later (`node subscribe.mjs`). It subscribes, prints the first notification, and unsubscribes:

```javascript title="subscribe.mjs"
const ws = new WebSocket("{{signet.ws}}");
const send = (id, method, params) =>
  ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
ws.onopen = () => send(1, "ksana_subscribeBlocks", []);
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log(JSON.stringify(message, null, 2));
  if (message.method === "ksana_block") {
    // One block is enough here: unsubscribe, then close once the node confirms
    send(2, "ksana_unsubscribeBlocks", [message.params.subscription]);
  }
  if (message.id === 2) ws.close();
};
ws.onclose = (event) => console.log("closed", event.code);
```

```output
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": 8723730946419982
}
{
  "jsonrpc": "2.0",
  "method": "ksana_block",
  "params": {
    "subscription": 8723730946419982,
    "result": {
      "height": "63",
      "hash": "8f9221ec3639c5f48bf56afed0a2e8b692d5a229470ca108f8137c37e8b3202b",
      "entries": 0,
      "timestamp": "1792562771"
    }
  }
}
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": true
}
closed 1005
```

Each notification is `{ "height", "hash", "entries", "timestamp" }`: `entries` is the block’s number of entries and `timestamp` is in seconds.

A subscriber that falls behind skips the notifications it missed and continues with later blocks. Nothing reconnects for you: when the connection closes, open a new one, subscribe again, and read the blocks you missed with `ksana_getBlock`. On an idle signet, blocks can be minutes apart.

## Indexer methods

The [indexer](/docs/run-an-indexer/) rebuilds the chain from bitcoind alone and checks every state root. Its two methods follow the same conventions.

### `indexer_status`

No parameters.

```sh
rpc $INDEXER indexer_status | jq .result
```

```output
{
  "height": "51",
  "hash": "5b69b10223571ab01bdee3080d8e1ed25c8ace4fc420f744d23b7d8d5db15981",
  "state_root": "bd7ad23935fc366400a48eb8591696171be864520fd981c3204f9d5e64cc0963",
  "btc_height": 327291,
  "finalized": {
    "height": "38",
    "hash": "ab3fe1dcb95f0d76cd171210567f571fcd81cc8f7559d68da7dd38348eec7cf2"
  },
  "halted": null
}
```

- `height`, `hash` and `state_root` describe the highest block the indexer has executed and verified. It verifies a block once the block’s data is on Bitcoin and the block has 2 confirmations on the indexer’s main chain, or once it is decided final, so it trails the node.
- `btc_height` is the Bitcoin tip it has scanned, `null` before it has synced with bitcoind.
- `finalized` is the BTC-final tip, by the same rule as the node’s.
- `halted` is `null` in normal operation. The indexer stops, and `halted` gives the reason, only when a block that Bitcoin made final turns out invalid; an invalid block that is not final is left out, and the indexer chooses its main chain again ([alarms](/docs/run-an-indexer/#alarms)).

### `indexer_stateRoot`

Parameter: a block identifier. It answers only for blocks the indexer has verified; others return `-32004`, and a malformed identifier returns `-32602`.

```sh
rpc $INDEXER indexer_stateRoot '["51"]' | jq .result
rpc $NODE ksana_getBlock '["51"]' | jq -r .result.header.state_root
```

```output
{
  "height": "51",
  "hash": "5b69b10223571ab01bdee3080d8e1ed25c8ace4fc420f744d23b7d8d5db15981",
  "state_root": "bd7ad23935fc366400a48eb8591696171be864520fd981c3204f9d5e64cc0963"
}
bd7ad23935fc366400a48eb8591696171be864520fd981c3204f9d5e64cc0963
```

The two state roots match: the node’s block 51 is the block the indexer rebuilt from Bitcoin alone.

## Errors

An error answer has an `error` object instead of `result`, with `code` and `message`, sometimes `data`:

```sh
rpc $NODE ksana_getOpStatus "[\"$KSA\"]" | jq .error
rpc $NODE ksana_getBlock '["0x10"]' | jq .error
rpc $NODE ksana_getBlockCount | jq .error
```

```output
{
  "code": -32004,
  "message": "unknown op"
}
{
  "code": -32602,
  "message": "block identifier must be \"latest\", a decimal height or a 64-digit hex hash"
}
{
  "code": -32601,
  "message": "Method not found"
}
```

| Code | Meaning |
| --- | --- |
| `-32601` | no such method, or not available on this node (the op listings and the token methods without their index) |
| `-32602` | a malformed parameter: hex, decoding, length, range |
| `-32010` | the op breaks a consensus rule, or is a path C op; with `id` `null`, a batch of more than 64 calls ([limits](#limits)) |
| `-32011` | the node’s policy refuses the op: fee too low, pool full, replacement fee not high enough; with `id` `null`, a batch whose answers would pass 10 MiB |
| `-32004` | the object does not exist: op, block, asset, settlement, unverified block |
| `-32009` | the node is busy: too many `ksana_call` requests at once; try again later |
| `-32603` | an internal error of the node |
| `-32006` | too many subscriptions on one WebSocket connection ([limits](#limits)) |
| `-32007` | the request is longer than 1 MiB |
| `-32008` | the answer would be longer than 10 MiB |
