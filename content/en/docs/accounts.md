---
title: Accounts and addresses
nav: Accounts
lede: Your Ksana account is your Taproot address. The key behind a `tb1p` or `bc1p` address receives bitcoin on Bitcoin, holds KSA and tokens on Ksana, and signs your operations.
description: Ksana accounts are Taproot output keys (BIP86). How addresses map to accounts, how wallets and key files sign (BIP322, BIP340), how nonces work, where balances and assets live, and why contracts have IDs instead of addresses.
---

## One key, one address

A Ksana account is 32 bytes: the output key of a Taproot address (a BIP86 key-path key, with no script tree). The address is the bech32m spelling of the same 32 bytes, so an account and its address convert into each other both ways. Wherever Ksana asks for an account (ksana-cli, the TypeScript SDK, the node’s `--producer`), you can give the address or the 64 hex digits.

| Network | Address starts with | Bitcoin network |
| --- | --- | --- |
| devnet | `bcrt1p` | regtest |
| signet | `tb1p` | signet |
| mainnet | `bc1p` | mainnet (Ksana mainnet has not launched) |

There is one thing to copy and nothing to convert: the address someone gives you for bitcoin is the one you use to send them KSA, and pasting it in the wrong place still lands on their key. Other address types (`tb1q` P2WPKH, P2SH, legacy) cannot be accounts. Only a Taproot address is a single 32-byte key that signs, and clients refuse to read anything else as an account.

`ksana-cli key` creates a key file when it does not exist (64 hex digits, file mode 0600) and prints both forms:

```sh
ksana-cli --chain signet key alice.key
```

```output
{
  "account": "5b276a0956672ea3037ef7758651f99ac7d0bd18b7a6ba31d913fe3855a29f03",
  "address": "tb1ptvnk5z2kvuh2xqm77a6cv50entrap0gck7nt5vwez0lrs4dznupsucam9p",
  "internal_key": "50515c21347f82ea2eb7fdadc95c50d812ea1490e042e67289144278e79931d8",
  "script": "51205b276a0956672ea3037ef7758651f99ac7d0bd18b7a6ba31d913fe3855a29f03"
}
```

`account` is the Taproot output key that operations name, and `address` is the same bytes as a signet address. `internal_key` is the untweaked key inside it, and `script` is the address’s output script, `OP_1` followed by the account. With the SDK, `parseAccount` reads either form and `accountToAddress` spells an account as an address:

```typescript
import { accountToAddress, parseAccount, toHex } from '@ksana/sdk';

const address = 'tb1ptvnk5z2kvuh2xqm77a6cv50entrap0gck7nt5vwez0lrs4dznupsucam9p';
const account = parseAccount(address, 'signet'); // 32 bytes: the Taproot output key
console.log(toHex(account)); // 5b276a0956672ea3037ef7758651f99ac7d0bd18b7a6ba31d913fe3855a29f03
console.log(accountToAddress(account, 'signet') === address); // true
```

::: warning A key file is a Bitcoin key too
Whoever holds `alice.key` can spend the bitcoin sent to its address as well as its KSA. Keep test keys for test networks: the same key is the same account on every network, and its `bc1p` spelling is a real Bitcoin address.
:::

## Keys and signatures

Every operation carries a signature by its account. Two forms are accepted, and both prove control of the same Taproot key:

- **BIP340**, used by ksana-cli and by the SDK with a local key: a Schnorr signature verified against the account itself. Because the account is the tweaked output key, the signer signs with the BIP86-tweaked private key, as a Taproot key-path spend does.
- **BIP322 simple**, used by browser wallets: the wallet signs a text message, the operation’s signature hash written as 64 lowercase hex digits, with its Taproot address. Unisat signs with `signMessage(message, 'bip322-simple')`; Xverse signs with its Ordinals address, which is Taproot. Xverse’s payment address, usually P2SH-P2WPKH, cannot be an account.

The signature hash is a tagged hash (`Ksana/VmOp/v1`) of the operation without its signature; for path C it also covers the outpoint that the carrying Bitcoin transaction’s first input spends. The tag keeps a Ksana signature from ever being valid as a Bitcoin transaction signature. The chain ID in the operation keeps it from being replayed on another network, and the nonce keeps it from running twice on this one.

::: danger Read what you sign
The protection is one-way. A page that asks your wallet for a BIP322 signature of a “random” string of 64 hex digits may be showing you the signature hash of a Ksana operation that spends your KSA. Sign Ksana operations only where you see the decoded operation first, as the [signet wallet](/docs/wallet/) shows it before you sign.
:::

## Nonces

Each account has a nonce: 0 for a new account, and one higher after each of its operations that runs, whether it succeeds or fails. An operation’s nonce must equal the account’s nonce when it executes, so each operation runs once, in the order you numbered them.

- **Several path B operations**: a node’s entry pool keeps up to 64 operations per account, numbered from the account’s nonce, at most 8 of them behind a gap in the numbering. A new operation with the same nonce replaces the waiting one only with a fee at least a tenth higher, and higher by at least the node’s relay floor. ksana-cli fills in the account’s nonce from the node, so to send a second operation before the first is included, pass `--nonce` with the next number.
- **Path C**: an operation with the wrong nonce, or a signature that does not check out, fails without using the nonce. Path B and path C share the nonce, and a path C operation runs only after its Bitcoin confirmations, so a path B operation with the same nonce that gets in first makes the path C operation fail, and its Bitcoin fee is lost. While a path C operation waits, give your path B operations the nonces after it.
- **Top-ups** sign their claim with a one-time key at nonce 0, so they never compete with your account’s operations ([Operations and fees](/docs/submitting-ops/#top-up)).

## Balances and assets

The chain keeps one balance table for every 32-byte account, people and contracts alike, with an amount per asset:

- **KSA**, the built-in token: asset ID of 32 zero bytes, 8 decimals. Amounts are whole numbers of base units: 1 KSA is 100,000,000 base units.
- **Built-in assets issued by contracts**: a contract creates its own assets with the `asset_create` or `asset_issue` host function. Each asset ID is the SHA-256 of the contract ID followed by a 32-byte `sub_id` that the contract picks. These assets move with the same transfer action as KSA and can be attached to contract calls. An asset’s issuer may hold capabilities it declared when it created the asset, such as freezing an account or pausing the asset; `ksana_getAsset` lists them, and none of them lets the issuer take a balance ([Host functions](/docs/host-functions/#assets)).
- **Token contracts**, such as the `token` example, keep balances in their own storage. You move those by calling the contract, and the account query does not list them: ask the contract, for example with its `balance_of` method.

`ksana-cli account` (the RPC method `ksana_getAccount`) shows an account’s nonce and built-in balances. This is the signet faucet’s account:

```sh
export KSANA_RPC={{signet.rpc}}
ksana-cli --chain signet account tb1pmenq8uzjl4dl4tjk0z32yzhx4e87ftsqezwmwz3wl6n59xz34lqqlgaqc2
```

```output
{
  "account": "de6603f052fd5bfaae5678a2a20ae6ae4fe4ae00c89db70a2efea7429851afc0",
  "address": "tb1pmenq8uzjl4dl4tjk0z32yzhx4e87ftsqezwmwz3wl6n59xz34lqqlgaqc2",
  "at": {
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f",
    "height": "61"
  },
  "balances": [
    {
      "amount": "9999949999999995",
      "asset": "0000000000000000000000000000000000000000000000000000000000000000"
    }
  ],
  "locked_fees": [],
  "nonce": "5"
}
```

`at` is the block the answer comes from. `locked_fees` lists, for a producer, the rewards and fees that will be credited once its blocks’ data is on Bitcoin ([KSA and rewards](/docs/ksa/)).

## Contracts have IDs, not addresses

A contract is named by a 32-byte contract ID:

- deployed from an account: the SHA-256 of the deployer’s account, the deploy operation’s nonce as 8 little-endian bytes, and the SHA-256 of the code, one after another;
- created by another contract: the SHA-256 of the creating contract’s ID, a 32-byte salt it chooses, and the SHA-256 of the code.

A contract ID is not a key: nobody can sign for it, and only the contract’s own code moves its assets. That is why a contract has no address, and why you write it as 64 hex digits. It shares the balance table with every other account, so you can send KSA to a contract ID with an ordinary transfer.

::: warning Never send bitcoin to a contract ID
Some contract IDs happen to be valid Taproot keys, and for those ksana-cli’s `account` command and the SDK’s `accountToAddress` print a `tb1p` address. Nobody holds a key for it: bitcoin sent there can never be spent.
:::

## Bitcoin and KSA stay apart

Your address holds bitcoin on Bitcoin and KSA on Ksana, and the two ledgers never mix:

- Bitcoin sent to your address gives you no KSA, and KSA cannot be withdrawn as bitcoin.
- Your Bitcoin wallet shows your bitcoin; the [signet wallet](/docs/wallet/), ksana-cli or any node shows your KSA.
- To turn bitcoin into KSA, [top up](/docs/submitting-ops/#top-up): one Bitcoin transaction pays a seller who has locked KSA in an exchange contract, and the contract credits you.

The full rules for accounts, signatures and nonces are in [SPEC §4]({{repo}}/blob/main/docs/SPEC.md#4-accounts-signatures-and-vmop).
