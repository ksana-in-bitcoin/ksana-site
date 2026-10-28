---
title: The signet wallet
nav: Signet wallet
lede: The web wallet and block explorer at {{signet.wallet}}. Connect Unisat or Xverse, get test KSA, send on path B or path C, top up with signet bitcoin, and see where each operation landed on Bitcoin.
description: How to use Ksana's signet web wallet and explorer with Unisat or Xverse, the faucet, path B, path C, top-ups and your own node.
---

The signet wallet is a web page that is both a wallet and a block explorer for the [public signet](/docs/signet/). It keeps no keys: your browser wallet signs, and the page reads the chain from a Ksana node, an indexer and a Bitcoin RPC, the hosted ones unless you choose your own.

The page is built from the [ksana-web](https://github.com/ksana-in-bitcoin/ksana-web) repository. Its footer and **Settings** › **About** show the commit it was built from, and that repository's README explains how to rebuild that commit and compare the files byte for byte.

## Supported wallets

| Wallet | Set it to | Account the page uses |
| --- | --- | --- |
| Unisat | Bitcoin Signet, Taproot address type | the wallet’s Taproot address |
| Xverse | Signet | the Ordinals address, which is the Taproot one |

Your Ksana account is your Taproot (P2TR) address, so the page accepts no other address type. It also checks that the wallet is on signet before connecting, and again before it signs a path C or top-up transaction: a `tb1` address alone does not tell signet from testnet, so the page asks the wallet which network it is set to (Unisat’s `getChain`, Xverse’s `wallet_getNetwork`).

## Connect

Open [{{signet.wallet}}]({{signet.wallet}}), choose **Wallet**, then **Connect wallet**, pick your wallet and approve the request in the extension. The page asks only for signatures: path B operations are signed as one BIP322 message, path C and top-up transactions as a PSBT. **Settings** shows the connected address and **Disconnect wallet**.

The wallet home shows your balances, in this order:

- **Bitcoin · signet**: the sats on your address, read from mempool.space’s signet API through the hosted Bitcoin RPC proxy. The page reads them when the wallet opens and after each Bitcoin block; the corner button refreshes them.
- **Ksana · KSA**: your balance, split into the part that is already BTC-final and the changes that are not final yet (**BTC-final balance**, **Incoming, not final yet**, **Outgoing and fees, not final yet**, **Current balance (available now)**).
- **Tokens**: the other assets, [built-in assets and KS-20 tokens](/docs/tokens/) in one list, each with its BTC-final amount while part of it is not final. Under its symbol, a built-in asset names the contract that issued it (**Issued by**), and a KS-20 token its standard and its own contract (**KS-20 ·**).
- **NFTs**: the KS-721 collections you hold NFTs of, with how many.

Anyone can send any account a token under any name, so the wallet lists only what you asked for: KSA, the assets your own operations moved (you sent them, attached them to a call, called their contract, or were paid them by a call you made), and those you keep. It goes by the operations it has read: an asset that only operations older than those your activity shows moved stays folded until you choose **Show older operations** or keep it. Anything else is folded under **Other assets** (and **Other collections**), each with its whole ID, its contract and **Keep**, which keeps it in the list on this device; **Fold away** folds it again. Every symbol opens the asset’s page: its whole ID, its contract, its supply and the operations that moved it, with a token’s largest holders, or what a built-in asset’s issuer can still do (mint, freeze, allowlist, pause). Check them before you keep a token named like one you know.

## Get test KSA

With an empty wallet, the KSA card says “No KSA yet” and offers **Claim test KSA**. The **Receive** page has the same faucet as **Get test KSA from the signet faucet**, next to your address and its QR code. Either sends 100 KSA, once a day per account; when the faucet refuses, a notice gives its reason. [Public signet](/docs/signet/) lists the faucet’s limits.

## Send on path B

Path B is the default: you pay a small fee in KSA, and the producer that includes your operation pays the Bitcoin fee of settling it.

1. Choose **Send**. Paste a **Recipient**: a `tb1p…` address, or an account as 64 hex digits. Check the first and last 8 characters the page shows; it warns when the account has no record on the chain yet.
2. Choose the **Asset**, KSA unless you pick another, and enter the **Amount**. KSA has 8 decimals.
3. Under **How to submit**, keep **Sponsored**. The fee is the node’s suggestion, taken from the lowest path B fee rates of the last 20 blocks (1 base unit on the signet today). **Advanced** lets you set another fee and `max_gas`.
4. Choose **Review and sign**. The page states what you are doing in one sentence, shows the full recipient address, lists any warnings, and folds the exact operation (the VmOp and its signature hash) at the end.
5. Choose **Sign and submit** and sign the message in your wallet.

The Send page then follows the operation through **Pending**, **Fast-confirmed**, **On Bitcoin**, **6 BTC confirmations** and **BTC final**. **Send another** becomes available once it is fast-confirmed, so that the next operation does not reuse its nonce. [Confirmations](/docs/confirmations/) explains the marks.

### Send a token {#token}

A KS-20 token is sent the same way: choose it under **Asset**. Its transfer is a call of the token’s `transfer`, so before you review it the page asks the node to try it as you. What the try used, plus half, becomes the operation’s `max_gas`, which **Advanced** shows, and a transfer the token refuses, for too small a balance or by its own rules, is said on the page instead of failing on the chain with its fee paid. The page refuses the token’s own contract as the recipient, and warns when the recipient is a contract: a plain transfer does not tell a contract it received tokens, so one that does not take KS-20 tokens can neither use nor return them, and tokens go to a contract through its [`transfer_and_call`](/docs/ks-20/#pay-a-contract-in-one-operation). The review gives the token’s whole ID: check it against the token you mean, since anyone can give a token any name.

Incoming transfers follow a **Large-amount threshold**, 10,000 KSA unless you change it on **Receive** or in **Settings**. Below it, fast confirmation counts as received; at or above it, the wallet reminds you to wait for BTC final.

## Contract playground {#playground}

The [contract playground](/docs/playground/) is a page of its own, at [playground.ksana.network]({{playground}}): eight example contracts to use, edit, compile and deploy on the signet. The wallet links it in its top bar and footer and on its home, and a contract's page offers **Open in the playground**, which opens that contract there.

## Path C from the page

Path C puts your operation in a Bitcoin transaction of your own. Every producer must include it once the transaction has its confirmations, so no producer can keep it out; you pay the Bitcoin miner fee in sBTC and no KSA fee. [Operations and fees](/docs/submitting-ops/) compares the two paths.

Path C sits under **More ways to submit** on the Send page. It opens there by itself, marked **Recommended**, when you lack the KSA for a path B fee, when settlements are backlogged, or when producers have not included your operations. An operation that waited too long offers **Switch to Path C** (or **Resubmit via Path C**) with the same nonce.

- **Funds**: your Taproot address needs a little sBTC. A transfer at 2 sat/vB costs about 700 sats of fee. The page lists your address’s coins through mempool.space’s signet API; when that does not answer it says so, and you can try again or enter outputs by hand as `txid:vout:sats`.
- **Signing**: the page builds the transaction and the wallet signs its inputs as a PSBT. The operation’s signature is bound to the transaction’s first input, so it cannot be copied into another transaction.
- **Broadcast**: through the hosted Bitcoin RPC proxy. Without a broadcast route the page gives you the signed raw transaction to broadcast yourself.
- **Inclusion**: on the signet, the next fast-lane block anchored at or above the transaction’s Bitcoin block includes it, which takes 2 Bitcoin confirmations (`NATIVE_CONFIRMATIONS` 1 plus `ANCHOR_DEPTH` 1). Until then the node does not know the operation.

If a path B operation with the same nonce gets in first, the path C operation is recorded as failed and its miner fee is not refunded. The page explains this before you sign a resubmission.

## Top up

A top-up buys KSA with sBTC from a seller, in one Bitcoin transaction. The seller first locks KSA for your account in an exchange contract (the example `ksa-exchange` contract), with a price in KSA per sat, a payout address and an expiry height. Your payment to that address carries the claim operation as path C, and once it is included the contract credits the KSA to the account the seller named in the lock.

1. Get the exchange contract’s ID (64 hex digits) and the lock number from the seller.
2. Choose **Top up**, enter the **Exchange contract** and **Lock number**, and choose **Load**. The page shows the seller, the beneficiary (you), the price, the locked KSA, the payout address and how many Bitcoin blocks remain before the expiry.
3. Enter the **Amount to pay** in sats. **All** fills in the amount that buys all the locked KSA. Paying less buys part of it and leaves the rest locked for you; paying more buys nothing more.
4. Check the **BTC outputs** that pay for it and the **Miner fee**, then choose **Sign and broadcast** and sign the PSBT in your wallet.

The page refuses a lock whose beneficiary is someone else, and a payment when 3 or fewer Bitcoin blocks are left before the expiry; it warns when 4 or fewer are left. After broadcasting it shows the Bitcoin transaction, the claim operation, and the height before which the payment should confirm. The KSA arrives once the claim is force-included, 2 Bitcoin confirmations later on the signet.

The claim is signed with a one-time key made for this payment, not with your account’s key, so it uses none of your account’s nonces. There is no standing seller on the signet: someone with KSA has to lock some for you. To try a top-up alone, play the seller with a second key and the [`exchange` commands of ksana-cli](/docs/cli/#exchange), then pay from the page.

## History and the explorer

The wallet home lists operations that are not final yet under **In progress**, each with its progress and an estimate of when it will be final, and everything else under **Activity** (filter by **Sent**, **Received** or **Failed**). An operation marked **Stuck** has a reason in its details.

The explorer pages work without a wallet:

- **Overview**: the fast lane and Bitcoin as two lanes, the latest blocks and operations.
- **Blocks** and **Settlements**: every fast-lane block with its parents, entries and the settlement that carried it; settlement, path C and republish transactions with their commit and reveal structure.
- **Operations**: the latest operations, and an operation’s journey from its block to the Bitcoin transaction that carried it, with the changes it made to assets and its tokens’ events in their units.
- **Assets**: a page for each built-in asset, KSA’s included, and for each KS-20 token and KS-721 collection: its whole ID, its supply, what its issuer can still do or its largest holders, and the operations that moved it.
- **Verify**: the indexer’s state roots compared with the node’s, the two kinds of confirmation, and the network’s parameters.

The search box takes heights, block hashes, op IDs, Bitcoin txids and heights, contract IDs, accounts, and an asset’s symbol, name or ID. A Bitcoin transaction or block the node does not know links to mempool.space.

## Use your own node

The network chip in the top bar (**signet · node**) opens the **Data source** panel; **Settings** has the same panel. Enter the **Node JSON-RPC** URL of your node, choose the **signet** network, and connect.

- Your node must allow the page’s origin: start it with `--rpc-cors https://{{signet.host}}` (or `'*'`). [Run a node](/docs/run-a-node/) shows the command.
- **Indexer JSON-RPC** and **Bitcoin RPC** are optional, and work only as a path on the page’s own origin, because neither the indexer nor bitcoind sends CORS headers. On the hosted page you can keep the hosted ones, `/indexer` and `/btc`. Without an indexer, the Verify page has nothing to compare and the page notes that “BTC final” is then only the node’s word.
- The same choice fits in the address bar: `?rpc=<node URL>&indexer=<indexer URL>&btc=<Bitcoin RPC URL>&chain=signet`. `?source=sim` switches to the in-browser simulator, a devnet that needs no services.

The page reads the node’s chain ID before syncing and again before every signature, and refuses a node on another network. To run the page itself on your machine with proxies to your own node, indexer and bitcoind, follow the README of [ksana-web](https://github.com/ksana-in-bitcoin/ksana-web).

## Troubleshooting

| What you see | What to do |
| --- | --- |
| Extension not found | Install Unisat or Xverse, then reload the page. |
| … isn’t a Taproot address; switch to a Taproot account in your wallet. | Switch the wallet to its Taproot address (in Xverse, the Ordinals address). |
| … is set to …, but this page’s network runs on BTC signet | Switch the wallet’s Bitcoin network to signet. |
| The node is on another network | The page and the node disagree on the network: choose signet in the Data source panel, or connect to a signet node. |
| Can’t reach … Make sure the node is running and allows … via `--rpc-cors`. | Start your node with `--rpc-cors` for this page’s origin. |
| The faucet did not send KSA | The notice gives the faucet’s reason; most often the account already received KSA today. |
| Not enough KSA for the sponsor fee | Claim test KSA, top up, or send on path C. |
| No usable BTC output for the miner fee | Send sBTC to your address and wait for it to confirm. |
| Couldn’t read BTC outputs | mempool.space did not answer: try again, or enter outputs by hand. |
| Skipped, awaiting re-inclusion | The operation was in a parallel block that could not execute it. Nothing was charged; it returns to the pool and is included again. |
| Settlement backlog at limit; fast paths paused | Settlements are waiting on Bitcoin. Balances already in effect stay; path C still works. |
