---
title: Confirmations and finality
nav: Confirmations
lede: An operation passes three marks. It is fast-confirmed within seconds, on Bitcoin once its block’s data is in a Bitcoin block, and final after six Bitcoin confirmations and five more blocks that secure the decision. This page says what each mark protects against and how long to wait.
description: The three marks of a Ksana operation (fast-confirmed, on Bitcoin, final), the RPC statuses, what can still undo each mark, how long each takes, and how long to wait by what is at stake.
---

Every operation you send passes three marks, and you choose which one to wait for by what is at stake. A fast confirmation is protected only by the fast lane’s own proof of work; a final block can be undone only by reorganizing at least six blocks of Bitcoin. Mainnet has not launched, and the public signet, where you can watch the marks today, has too little hashrate for its fast confirmations to protect much ([see below](#on-the-signet)).

## The three marks

::: figure marks
The three marks of an operation, and the six confirmations before the last: fast-confirmed in about 5 seconds, on Bitcoin with the next Bitcoin block after its settlement, six Bitcoin confirmations about an hour after you send, and final five Bitcoin blocks later.
:::

| Mark | What has happened | Typical time |
| --- | --- | --- |
| Fast-confirmed | The node’s main chain accepted the operation, and it executed successfully. | About 5 seconds |
| On Bitcoin | The data of the block that accepted it, and of every block before it, is in a Bitcoin block. | The next Bitcoin block after its settlement goes out |
| Final | Every node and indexer decided from Bitcoin that the block is final when that data had 6 confirmations, and the Bitcoin block of that decision has 6 confirmations too. | From about 110 minutes |

On the way to final, the data reaches six Bitcoin confirmations about an hour after you send. That is the depth Bitcoin wallets treat as settled, and the Bitcoin block that gives it is where every node decides the block final. The [signet wallet](/docs/wallet/) shows it as a step of its own, but it is not a status of the RPC, and not final yet: see [Final](#final).

## Statuses in the RPC

`ksana_getOpStatus`, which `ksana-cli op` and the SDK’s `getOpStatus` call, answers with one of five statuses:

| Status | Meaning |
| --- | --- |
| `pending` | In this node’s entry pool, not in a block yet. |
| `fast_confirmed` | Included and executed successfully: the fast-confirmed mark. |
| `failed` | Included, but it failed, and its changes were rolled back. The fee is still paid, and the nonce is used, except by a path C operation that failed its checks (version, chain ID, length, fee mode, signature or nonce). |
| `skipped` | Included only by merged blocks that could not execute it (a duplicate, a nonce already used, a balance already spent). No fee is charged, and the status can still change. |
| `btc_final` | Executed successfully, and the main-chain block that accepted it is final. |

What to watch for when you read them:

- **On Bitcoin is not an op status.** Ask for the settlement of the op’s block with `ksana_getSettlement`: `settled` turns true once the data of the main-chain block that accepted it, and of everything before it, is on Bitcoin, and `btc_final` once it is final. A block with no settlement of its own, an empty block or one holding only path C operations, answers `-32004`. Once a main-chain block is settled or final, so is every block below it, so read the marks from the next block up that has a settlement.
- **A failed op stays `failed`**, even after its block is final. Check `btc_final` of its block’s settlement to know that the failure itself is final.
- **`skipped` is not the end.** A skipped op that is still valid returns to the entry pool and can be included again, so it may read `pending` and then `fast_confirmed`.
- **An unknown op is an error**, code `-32004`. A path C operation is unknown to the nodes until a block includes it, and an op that left the entry pool (replaced by one with a higher fee, or evicted from a full pool) returns the same error.
- **`block`** gives the hash of the block that included the op and, as `height`, the height of the main-chain block that accepted it: for a merged block, the height where its operations took effect.

## What each mark guarantees

### Fast-confirmed {#fast-confirmed}

Your operation has executed on the node’s main chain: balances and contract state include it, and later operations build on it. Only the fast lane’s proof of work protects it. Until its block is final, a heavier fast-lane chain can replace the block, and a payment is reversed if the sender gets a conflicting operation (another one with the same nonce) into that chain.

A Bitcoin reorganization can also take a fast-confirmed block back. One of at most `ANCHOR_DEPTH` blocks (1 on signet, 2 on mainnet) orphans no anchor and leaves the main chain as it is, and a deeper one takes the blocks anchored on the orphaned Bitcoin blocks off the main chain. Their path B operations return to the entry pool and are included again with the same op ID, so an honest payment comes back by itself; only a sender who gets a different operation with the same nonce in first turns such a reorganization into a reversal.

### On Bitcoin {#on-bitcoin}

The data of the block that accepted your operation, and of every block before it, is in a Bitcoin block. From now on anyone with a Bitcoin node can read the operation and recompute its effect without any Ksana node, and an indexer executes the block once it is 2 blocks deep in the fast lane or decided final. The rewards and fees of the block can now be paid out.

This mark is about availability, not finality. A heavier fast-lane chain can still replace the block until it is final, and a Bitcoin reorganization can take the transaction that carries the data out of its block until it confirms again.

### Final {#final}

The main-chain block that accepted your operation is on the final chain. When its data and the data of the blocks it merges had 6 Bitcoin confirmations and its execution was checked, every node and indexer reached the same decision from Bitcoin data alone: the block is final. They report it final once the Bitcoin block of that decision has 6 confirmations too, so at the earliest five Bitcoin blocks after the sixth confirmation of the data. Until then a heavier fast-lane chain together with a Bitcoin reorganization of fewer than 6 blocks could still replace the block, so the six confirmations alone are not final. Once final, no fast-lane chain can replace it, however much hashrate is behind it: a competing chain counts only if its headers reached Bitcoin by the Bitcoin block that gave your block’s data its sixth confirmation. Undoing it takes a Bitcoin reorganization of at least 6 blocks that reaches the Bitcoin block of the decision. With a heavier fast-lane chain on the new Bitcoin branch, that is enough; without one, your block is decided again on the new branch, and it leaves the final chain only if the reorganization also removes its data, 5 blocks deeper still. A final block grows safer with every Bitcoin block after it, as a Bitcoin transaction does ([Security](/docs/security/#bitcoin-reorgs)).

## How long each mark takes

- **Fast-confirmed**: about 5 seconds for path B on signet and mainnet alike. A path C operation is fast-confirmed only once its Bitcoin transaction has `NATIVE_CONFIRMATIONS` + `ANCHOR_DEPTH` confirmations: 2 on signet, 5 on mainnet.
- **On Bitcoin**: a settlement goes out once the block is 2 fast-lane blocks deep, and its data lands in the next Bitcoin block that takes it, about 10 minutes on average on both networks. While an earlier settlement is still waiting to confirm, your block’s data waits for the next one, which adds about one Bitcoin block.
- **Final**: the data has six confirmations five Bitcoin blocks after it lands, about an hour after you send the operation; every node decides the block final there, and reports it final five Bitcoin blocks later, once the Bitcoin block of that decision has six confirmations too: from about 110 minutes after you send.

On a quiet chain the 2 blocks after yours are usually empty blocks, which take minutes ([Mining](/docs/mining/) explains why), so the settlement leaves a few minutes later than on a busy chain. Here is the transfer of the [quickstart](/docs/quickstart/#how-long-it-took), on the signet on 21 October 2026, with each step at the time it was first seen:

| Time (UTC) | What happened | Mark |
| --- | --- | --- |
| 04:55:31 | Block 27 includes a KSA transfer, while the settlement of block 19 still waits for a signet block. | Fast-confirmed |
| 04:56:35 | Block 31 holds a contract deployment of over 10 KiB, enough to settle without waiting, and carries a settlement with block 27’s body. | |
| 04:56:52 | Block 33 makes block 31 2 blocks deep, and its settlement goes out. | |
| 05:02:04 | Signet block 327,281, the first in 21 minutes, confirms that settlement and block 19’s. | On Bitcoin, after 7 minutes |
| 05:31:42 | Signet block 327,286 gives it 6 confirmations: block 27 is decided final. | Six confirmations, after 36 minutes |
| 05:44:09 | Signet block 327,291 gives signet block 327,286, which decided it, its sixth confirmation. | Final, after 49 minutes |

## How long to wait

How safe a fast confirmation is depends on the attacker’s share of the fast lane’s hashrate and on whether the chain is busy. In the model of [SPEC §10.4]({{repo}}/blob/main/docs/SPEC.md#104-the-two-confirmation-statuses), an attacker with a share α of the hashrate mines a private branch from the parent of the block that holds your payment and publishes it if it pulls ahead. These tables give the chance that a payment you accepted after the given wait is reversed (the best of three attacker strategies, 50,000 simulated races per cell).

A busy chain, where blocks carry other users’ operations:

| Wait | α = 5% | α = 10% | α = 20% |
| --- | --- | --- | --- |
| 30 seconds | 2.0% | 7.5% | 27% |
| 1 minute | 1.5% | 6.5% | 25% |
| 5 minutes | 0.06% | 0.91% | 9.3% |
| 10 minutes | 0.03% | 0.37% | 5.7% |
| 30 minutes | 0.002% | 0.05% | 2.3% |

An idle chain, where only empty blocks follow yours:

| Wait | α = 5% | α = 10% | α = 20% |
| --- | --- | --- | --- |
| 30 seconds | 26% | 43% | 69% |
| 1 minute | 20% | 33% | 58% |
| 5 minutes | 4.3% | 13% | 37% |
| 10 minutes | 1.8% | 7.7% | 28% |
| 30 minutes | 0.38% | 2.6% | 13% |

On an idle chain the honest work arrives in empty blocks of weight 12 to 120, each taking minutes, so for minutes your payment is protected by little more than its own block. On a busy chain an attacker’s lucky empty block weighs as much as 12 honest blocks and counts as soon as it is found, which is why even there short waits carry some risk.

So choose by what is at stake:

- **Small amounts**: fast-confirmed is enough.
- **Moderate amounts on a busy chain**: wait about 5 minutes.
- **Large amounts, or anything that matters on an idle chain**: wait for final.

A miner who can reorganize Bitcoin is a different threat: against such a miner a fast confirmation is worth only its anchor’s Bitcoin confirmations. Reversing a block made m Bitcoin blocks ago takes a reorganization of at least `ANCHOR_DEPTH` + 1 + m blocks, 3 + m on mainnet; such a miner could double-spend bitcoin as well. Undoing a final block takes a Bitcoin reorganization of at least 6 blocks, as [Final](#final) explains.

### On the signet {#on-the-signet}

The signet’s difficulty was set for its two seed nodes, which mine on one CPU core each, so a computer with a few cores can outpace them. Use the signet to see how the marks behave, not to judge how safe they are; signet coins have no value anyway.

## Reading the marks

Ask a node for the op’s status, then for the settlement of the block that included it:

::: code-group client

```typescript title="TypeScript"
import { KsanaRpcClient, RpcError, SIGNET } from '@ksana/sdk';

const rpc = new KsanaRpcClient('{{signet.rpc}}');
await rpc.getParams(SIGNET); // throws ChainMismatchError for a node on another network

const opId = '262b5d466a9f2fc69b2362c38352b635dce95d4385514ac994137891a8cf3dc9';
const status = await rpc.getOpStatus(opId); // throws RpcError -32004 for an unknown op
let mark = 'none yet';
if (status.block !== null && (status.status === 'fast_confirmed' || status.status === 'btc_final')) {
  mark = 'fast-confirmed';
  // From the op's height up, the first main-chain block with a settlement of its own
  const tip = (await rpc.getChainInfo()).tip.height;
  for (let height = status.block.height; height <= tip; height++) {
    try {
      const settlement = await rpc.getSettlement(height);
      if (settlement.settled) mark = 'on Bitcoin';
      if (settlement.btc_final) mark = 'final';
      break;
    } catch (e) {
      if (!(e instanceof RpcError && e.code === -32004)) throw e; // none of its own
    }
  }
}
console.log(status.status, mark);
```

```sh title="CLI"
export KSANA_RPC={{signet.rpc}}
ksana-cli --chain signet op 262b5d466a9f2fc69b2362c38352b635dce95d4385514ac994137891a8cf3dc9
ksana-cli --chain signet settlement \
  2681d67b65bc2dabad6ada543bffcb4562ed5dfdb89c8e57f1dc89f75a021e4f \
  | jq '{status, settled, btc_final}'
```

```sh title="curl"
op=262b5d466a9f2fc69b2362c38352b635dce95d4385514ac994137891a8cf3dc9
curl -s {{signet.rpc}} -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"ksana_getOpStatus","params":["'$op'"]}' \
  | jq .result
```

:::

The op status, as `ksana-cli` printed it for the transfer in the timeline above, with its `asset_changes` as this version of the node records them (the signet’s nodes executed this transfer before they recorded such changes, so for it they answer `null`):

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

And the settlement of block 27, which a later block carried:

```output
{
  "status": "confirmed",
  "settled": true,
  "btc_final": true
}
```

`status` here is the settlement’s own progress: `pending` before it is broadcast (the block is not 2 blocks deep yet, or no block carries its data yet), `broadcast` while it waits for a Bitcoin block, and `confirmed` once the data is in one; `confirmed.confirmations` then counts its Bitcoin confirmations. For the chain as a whole, `ksana_getChainInfo` reports the newest final block as `finalized`: an operation accepted at or below `finalized.height` on the node’s main chain is final. The indexer’s `indexer_status` reports `finalized` from Bitcoin alone, so comparing the two checks the node. The [signet wallet](/docs/wallet/) shows the same marks for every operation it sends, and the sixth confirmation as a milestone before final.
