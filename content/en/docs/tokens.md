---
title: Assets and tokens
lede: Ksana has built-in assets, which the VM keeps, and tokens, which contracts keep under two standards, KS-20 for fungible tokens and KS-721 for unique ones. How they differ, which to choose, and what every KS-20 token and KS-721 collection has in common.
description: Built-in assets, KS-20 tokens and KS-721 collections on Ksana, how to choose between them, how a contract declares a standard, capabilities, AssetRef, the shared revert reasons and the security notes for wallets and contracts.
---

## Three kinds

| | Built-in asset | KS-20 token | KS-721 collection |
| --- | --- | --- | --- |
| What it is | KSA, or an asset a contract creates with `asset_issue` or `asset_create` | a contract that keeps a ledger of amounts | a contract that keeps the owner of each unique token |
| Where balances live | the VM's balance table, beside each account's KSA | the token's storage | the collection's storage |
| How it moves | an `AssetTransfer` operation, or attached to a call | a call of the token: `transfer`, `transfer_and_call` | a call of the collection |
| Who reads it | the node's [`ksana_getAccount`](/docs/rpc/) lists it | a read-only call of the token's `balance_of` | a read-only call of `owner_of` |
| Rules of its own | only the capabilities its issuer declared when it created it, among `mint`, `freeze`, `allowlist` and `pause` | any, which the token reports in `capabilities()` | any, reported the same way |
| A transfer costs | 10,000 gas | about 84,000 gas for the reference token | about 176,000 gas for the test collection |

Every built-in asset has a name, a symbol, decimals and an ID of 32 bytes: KSA's ID is 32 zero bytes, and an issued asset's the SHA-256 of its contract's ID and a sub-ID ([Accounts](/docs/accounts/) explains balances). A token is named by its contract's ID. The two kinds of ID look alike, so a contract that takes either asks for an [`AssetRef`](#asset-ref), and the playground checks every ID before it deploys anything.

## Choosing a kind

| Need | Use |
| --- | --- |
| A currency, a points balance, an item counted by quantity | a built-in asset: the protocol itself knows it, so every node answers for it without an index, it can be attached to calls, and a transfer costs 10,000 gas |
| A currency whose issuer must be able to freeze an account, admit only the accounts it allows or pause every transfer, such as a payment stablecoin | a built-in asset created with those capabilities by `asset_create`: wallets show them, and the issuer can give them up but never gain one or take a balance |
| Balances with logic of their own: a fee on transfers, shares that earn, vote snapshots, vesting, dividends, data per holder, transfers that read or write other contracts | a [KS-20 token](/docs/ks-20/), which the web wallet and the explorer list beside built-in assets from a node’s index of the standards’ events |
| Items each unique: collectibles, tickets, names, position receipts | a [KS-721 collection](/docs/ks-721/) |
| Many fungible items from one contract | built-in assets: one contract issues any number of them, each with its own sub-ID |

Issue one kind for one brand. When it has to reach contracts that take only the other kind, such as a KS-20 token in a market that takes built-in assets alone, a wrapper contract locks the token one for one and issues a built-in asset whose name says so, such as `wXYZ`.

## How a contract declares a standard {#declare}

A token or a collection declares its standard itself. Its `init` emits the event `standards(ids)` and then `metadata`, before any `transfer`, and its view `standards()` returns the same list for its whole life: the standard first (`"KS-20"` or `"KS-721"`), then the extensions it implements. An indexer takes a contract's first `standards` event as its declaration, so tokens can be indexed from receipts alone, and wallets and other contracts ask the view at any time; in a contract, the SDK's `standard::standards_of(contract)` and `standard::declares(contract, id)` ask it.

A declaration is a claim, not a guarantee: a contract can declare KS-20 and break its rules, emit false events and answer false balances, though only its own. What a wallet trusts is the contract's identity, its ID and the hash of its code, which cannot change unless the contract delegates its code. A wallet can mark a contract whose code hash is that of a known build: the [playground's compile service](/docs/playground/) builds the same source into the same module on any machine.

## Capabilities

`capabilities() -> Vec<String>` reports what a contract's rules let someone do now, so that a wallet can mark the token:

| Name | Someone can |
| --- | --- |
| `mint` | create more tokens: a minter is set, or the collection can still mint |
| `freeze` | stop an account's tokens from moving |
| `allowlist` | limit who may hold or receive the tokens |
| `pause` | stop every transfer |
| `clawback` | take tokens from a holder without the holder's approval |
| `fee` | charge a fee on transfers |
| `upgrade` | change the contract's code, by delegating it |

The list holds each name once, in this order, with names the standards do not define after them. A capability that has ended is no longer reported: a token whose minter gave minting up reports no `mint`.

Built-in assets use the first four names for their issuer capabilities, which the issuing contract declares when it creates the asset and can only give up. [`ksana_getAsset`](/docs/rpc/#ksana_getasset) lists them in the same order, so a wallet marks both kinds alike. A built-in asset never has `clawback`, `fee` or `upgrade`, and none of its capabilities moves a balance ([Host functions](/docs/host-functions/#assets) gives the rules).

## Either kind in one argument {#asset-ref}

A contract that takes any fungible asset in one argument, such as a pool or a market, uses the SDK's `standard::AssetRef`:

```abi title="AssetRef"
enum AssetRef { Token(ContractId), Asset([u8; 32]) }   // a KS-20 token; a built-in asset (KSA is 32 zero bytes)
```

Its Borsh encoding is one byte for the variant, `00` for `Token` and `01` for `Asset`, then the 32-byte ID: `01` and 32 zero bytes is KSA. The [example AMM](/docs/example-contracts/#amm) takes its two sides this way. In a contract, `AssetRef::balance_of` reads the token's `balance_of` or the built-in balance, and `AssetRef::pay` pays from the contract's own balance with the token's `transfer` or with `asset_transfer`.

## Revert reasons

A refusal is the text of the method's error, which the receipt shows as `revert: <reason>`. The standards fix these reasons as English phrases, so that wallets can translate them and contracts can compare them:

| Case | Reason |
| --- | --- |
| A method the contract does not have | `unknown method` |
| Arguments that do not decode, or bytes left after them | `malformed arguments` |
| Funds attached to a method that takes none | `unexpected attached funds` |
| An amount of 0 (KS-20) | `zero amount` |
| The zero account as recipient, spender, operator or minter | `zero account` |
| The token or the collection itself as recipient | `recipient is this contract` |
| Too small a balance (KS-20) | `insufficient balance` |
| Too small an allowance (KS-20) | `insufficient allowance` |
| An expired allowance (KS-20) | `allowance expired` |
| `approve` for oneself (KS-20) | `spender is the caller` |
| A token that does not exist (KS-721) | `unknown token` |
| `transfer` or `transfer_and_call` by anyone but the owner (KS-721) | `not the owner` |
| `transfer_from`, `approve` or `burn` by an account that may not (KS-721) | `not authorized` |
| `transfer_from` naming another `from` than the owner (KS-721) | `wrong owner` |
| A transfer to the owner (KS-721) | `already the owner` |
| The owner as the approved account (KS-721) | `spender is the owner` |
| `set_operator` for oneself (KS-721) | `operator is the caller` |
| A mint of an ID a token has, or had (KS-721) | `token exists`, `token was burned` |
| A recipient's answer that is not `Bytes` | `malformed return value` |
| `mint` or `set_minter` by anyone but the minter (KS-20-mintable) | `not the minter`, or `minting has ended` once there is none |
| A mint past the cap (KS-20-mintable) | `cap exceeded` |
| A refusal by the contract's own rules | `rejected: <reason>` |

When the recipient of `transfer_and_call` refuses, the receipt shows the recipient's reason. A contract's own `init` and limits may use other reasons.

## Security

- **Impersonation**: anyone can deploy a token named KSA. Wallets clean names and symbols, compare them with KSA and BTC, show an unverified token's whole ID, and fold away tokens nobody asked for.
- **Allowances**: an allowance lets the spender take up to its amount at any time. Approve the amount one operation needs, with an expiry, revoke what you no longer use, and prefer `transfer_and_call`, which needs none.
- **Callbacks**: a contract that receives tokens checks `caller()`, since anyone can call `on_token_received` or `on_nft_received` directly. The token moves before it calls, and calls nest at most 8 deep.
- **Stuck tokens**: tokens never go to the zero account or to the contract itself, and methods that take no funds refuse them. A plain `transfer` to a contract that cannot move tokens strands them, so wallets suggest `transfer_and_call` when the recipient is a contract.
- **Spam**: transfers of 0 are refused, so nobody can fill an account's history with them.
- **Upgradeable tokens**: a contract that delegates its code can change what it does; it reports `upgrade`, and the reference implementations delegate nothing.
- **Rules that refuse**: a token's own rules, and a built-in asset's capabilities, may refuse a transfer with a reason that starts with `rejected: `. A pool or a market treats it as it treats too small a balance.
- **NFT media**: wallets show a token's image with `<img>` only, never as a document that runs scripts, and load remote media through a proxy or on demand.

## Next steps

::: cards
- [KS-20 tokens](/docs/ks-20/) The interface, rules and extensions of fungible tokens, and how to build one.
- [KS-721 collections](/docs/ks-721/) Unique tokens: IDs, URIs, approvals and operators.
- [Token and pool tutorial](/docs/token-and-pool/) Deploy a KS-20 token and trade it in a pool, one operation at a time.
:::
