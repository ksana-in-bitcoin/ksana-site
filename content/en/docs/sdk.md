---
title: TypeScript SDK
lede: The @ksana/sdk package builds, signs and sends Ksana operations from Node.js and browsers, connects Bitcoin wallets, and reads nodes and indexers.
description: How to install Ksana's TypeScript SDK from the repository, connect to a node, sign path B and path C operations with a key or a browser wallet, read state, call contracts, use KS-20 and KS-721 tokens and handle errors.
---

The SDK lives in `sdk/ts` of the repository, as the package `@ksana/sdk`. It runs in Node.js 20.19 or later and in browsers, and its library code uses only Web APIs. It speaks the node’s [JSON-RPC API](/docs/rpc/) for you: byte strings are `Uint8Array`, `u64` and `u128` values are `bigint`, and `u8` and `u32` values are `number`.

Every example on this page type-checks against the packed SDK, and the examples shown with their output ran against the public signet on 21 October 2026. Mainnet has not launched, so the examples use the signet.

## Install the SDK

The package is not on npm. Build it from the repository, pack it into a tarball, and install the tarball in your project:

```sh
git clone {{repo}}
(cd Ksana/sdk/ts && npm ci && npm run build && npm pack)
mkdir -p my-app/vendor && mv Ksana/sdk/ts/ksana-sdk-0.1.0.tgz my-app/vendor/
cd my-app
npm init -y
npm pkg set type=module
npm install ./vendor/ksana-sdk-0.1.0.tgz
```

npm records the tarball in `package.json`, so `npm ci` works later without the clone. Build before you pack: a tarball packed without `npm run build` holds no code.

The package is an ES module, and its types are reachable only through its `exports` map:

- In TypeScript, set `moduleResolution` to `node16`, `nodenext` or `bundler`. The older `node` setting cannot find the types.
- In a browser, use a bundler such as Vite or esbuild: the SDK imports its dependencies by package name.
- Import everything from `@ksana/sdk`. Deeper paths into the package are blocked.

::: warning Keep the SDK and the node together
The SDK rejects any result field it does not know. An SDK older than the node therefore fails with an `RpcTransportError` whose message starts with `malformed result`. Build the SDK from the same version of the repository as the node you use, and rebuild the tarball when the node moves ahead.
:::

## Connect to a node

```typescript title="connect.ts"
import { KsanaRpcClient, SIGNET } from '@ksana/sdk';

const rpc = new KsanaRpcClient('{{signet.rpc}}', { timeoutMs: 30_000 });
// The parameters to sign with. A node on another network throws ChainMismatchError here.
const params = await rpc.getParams(SIGNET);
const { tip, finalized } = await rpc.getChainInfo();
console.log(`chain ${params.chain_id}, tip ${tip.height}, finalized ${finalized.height}`);
```

```output
chain 1002, tip 60, finalized 38
```

`getParams` reads the node’s chain ID and returns that network’s parameters, which every builder and signer takes. With the network you expect as its argument, here `SIGNET`, it throws `ChainMismatchError` when the node is on another network, before you sign anything. The SDK has no default network; its three parameter sets are `DEVNET`, `SIGNET` and `MAINNET`.

`finalized` is the newest final block. The client also takes `headers` and a `fetch` function in its options, and it has no timeout unless you set `timeoutMs`.

## Keys and accounts

A Ksana account is the Taproot output key of a secret key: 32 bytes, the witness program of its `tb1p` address on the signet and its `bc1p` address on mainnet. The SDK has no key generator, so draw random bytes until they form a valid key. The key files of `ksana-cli` hold the secret key as 64 hex digits, and `ksana-cli --chain signet key alice.key` creates one:

```typescript title="keys.ts"
import { readFile } from 'node:fs/promises';
import { fromHex, isValidSecretKey, randomBytes } from '@ksana/sdk';

/** A new secret key: 32 random bytes that are a valid secp256k1 key. */
export function newSecretKey(): Uint8Array {
  for (;;) {
    const key = randomBytes(32);
    if (isValidSecretKey(key)) return key;
  }
}

/** Reads a key file of ksana-cli or ksana-keytool: the secret key as 64 hex digits. */
export async function readKeyFile(path: string): Promise<Uint8Array> {
  return fromHex((await readFile(path, 'utf8')).trim(), 32, path);
}
```

```typescript title="accounts.ts"
import { accountOf, accountToAddress, parseAccount, toHex } from '@ksana/sdk';
import { readKeyFile } from './keys.js';

const account = accountOf(await readKeyFile('alice.key')); // 32 bytes: the Taproot output key
const address = accountToAddress(account, 'signet');
console.log(toHex(account));
console.log(address);
// parseAccount takes 64 hex digits or a Taproot address of the given network
console.log(toHex(parseAccount(address, 'signet')) === toHex(account));
```

```output
b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09d
tb1pklkarsaaegsk2dxgh4ug9tru6q6x63gge8emdeltt8fpxm6r7zwse04hlm
true
```

`parseAccount(text, network)` takes 64 hex digits or a Taproot address of that network, and refuses other address types. A contract has an ID but no address, and `accountToAddress` cannot tell a contract ID from an account, since about half of all 32-byte strings are valid keys. The client’s methods take an account as bytes or 64 hex digits, never as an address, so run `parseAccount` on what users type.

## Send an op on path B

A path B op pays its fee in KSA and goes straight to a node. You need the account’s next nonce, a fee, a gas limit and a signature.

### With a key

```typescript title="transfer.ts"
import {
  type KsanaRpcClient,
  type Params,
  type UnsignedVmOp,
  VMOP_VERSION,
  accountOf,
  encodeVmOp,
  feeFor,
  ksaAssetId,
  opCost,
  signedVmop,
} from '@ksana/sdk';

/** Sends `amount` base units of KSA to `to` on path B and returns the op's ID. */
export async function transfer(
  rpc: KsanaRpcClient,
  params: Params,
  secretKey: Uint8Array,
  to: Uint8Array,
  amount: bigint,
): Promise<Uint8Array> {
  const account = accountOf(secretKey);
  const [{ nonce }, estimate] = await Promise.all([rpc.getAccount(account), rpc.estimateFee()]);
  const maxGas = 10_000n; // a KSA transfer uses exactly 10,000 gas
  const unsigned: UnsignedVmOp = {
    version: VMOP_VERSION,
    chain_id: params.chain_id,
    account,
    nonce, // the account's next nonce
    fee: { kind: 'Token', amount: estimate.path_b.amount },
    max_gas: maxGas,
    action: { kind: 'AssetTransfer', asset: ksaAssetId(), to, amount },
  };
  // The suggested rate is per KiB of the op's cost: measure the signed op, then sign the real fee.
  const cost = opCost(params, encodeVmOp(signedVmop(unsigned, secretKey)).length, maxGas);
  const fee = feeFor(estimate.path_b.per_kib, cost, estimate.path_b.amount);
  const op = signedVmop({ ...unsigned, fee: { kind: 'Token', amount: fee } }, secretKey);
  const { op_id } = await rpc.submitOp(op); // RpcError -32010 or -32011 when the node refuses it
  return op_id;
}
```

- **Nonce.** `getAccount` returns the account’s next nonce. A node queues up to 64 ops per account, so for a burst of ops you can count up from there.
- **Fee.** A flat amount of KSA in base units, charged even when the op fails. `estimateFee` suggests `path_b.amount` for a plain transfer and `path_b.per_kib` per KiB of an op’s cost: its encoded size or its gas limit converted to bytes, whichever is larger. The suggestion moves with recent blocks, and a signet node accepts 1 base unit.
- **Gas.** A KSA transfer uses exactly 10,000 gas. A call costs 20,000 plus 1 per byte of the contract’s code plus 10,000 per attached asset plus what the method uses: see [Host functions and gas](/docs/host-functions/).
- **Refusals.** `submitOp` throws `RpcError` -32010 for an invalid op, such as a used nonce or a balance that cannot cover the fees. It throws -32011 when the node’s policy refuses the op, such as a fee below the node’s floor.

When the node produces blocks, `submitOp` returns once its block template has taken the op, after at most 5 seconds. To call a contract, use the action `{ kind: 'Call', contract, method, args, funds }`, with `args` as described under [Call contracts](#call-contracts). Attached `funds` must be sorted by asset ID: pass them through `sortFunds`, then `checkFunds`.

### With a browser wallet

```typescript title="wallet.ts"
import {
  KsanaRpcClient,
  SIGNET,
  UnisatAdapter,
  type UnsignedVmOp,
  VMOP_VERSION,
  type WalletAdapter,
  XverseAdapter,
  btcNetworkOf,
  encodeVmOp,
  feeFor,
  fromHex,
  ksaAssetId,
  opCost,
  signVmopWithWallet,
} from '@ksana/sdk';

const rpc = new KsanaRpcClient('{{signet.rpc}}', { timeoutMs: 30_000 });

/** Connects Unisat or Xverse, checks its network, and returns its Ksana account. */
export async function connect(
  kind: 'unisat' | 'xverse',
): Promise<{ wallet: WalletAdapter; address: string; account: Uint8Array }> {
  const wallet: WalletAdapter = kind === 'unisat' ? new UnisatAdapter() : new XverseAdapter();
  const params = await rpc.getParams(SIGNET);
  // A tb1 address does not tell the signet from testnet: ask the wallet, which may not know.
  const network = await wallet.getNetwork?.();
  if (network !== undefined && network.network !== btcNetworkOf(params)) {
    throw new Error(`switch the wallet to Bitcoin Signet (it is on ${network.name})`);
  }
  const { address, account } = await wallet.getAccount(); // throws unless the address is Taproot
  return { wallet, address, account: fromHex(account, 32) };
}

/** Sends KSA on path B: the wallet signs a message, and no bitcoin moves. Returns the op's ID. */
export async function send(
  wallet: WalletAdapter,
  account: Uint8Array,
  to: Uint8Array,
  amount: bigint,
): Promise<Uint8Array> {
  const params = await rpc.getParams(SIGNET);
  const [{ nonce }, estimate] = await Promise.all([rpc.getAccount(account), rpc.estimateFee()]);
  const maxGas = 10_000n;
  const unsigned: UnsignedVmOp = {
    version: VMOP_VERSION,
    chain_id: params.chain_id,
    account,
    nonce,
    fee: { kind: 'Token', amount: estimate.path_b.amount },
    max_gas: maxGas,
    action: { kind: 'AssetTransfer', asset: ksaAssetId(), to, amount },
  };
  // A wallet's signature encodes in at most 67 bytes: size the op without asking the wallet twice.
  const placeholder = { kind: 'Bip322Simple' as const, bytes: new Uint8Array(67) };
  const cost = opCost(params, encodeVmOp({ ...unsigned, sig: placeholder }).length, maxGas);
  const fee = feeFor(estimate.path_b.per_kib, cost, estimate.path_b.amount);
  const final: UnsignedVmOp = { ...unsigned, fee: { kind: 'Token', amount: fee } };
  // The wallet shows a message to sign: the op's sighash in hex.
  const op = await signVmopWithWallet(final, wallet);
  return (await rpc.submitOp(op)).op_id;
}
```

- **Adapters.** `UnisatAdapter` and `XverseAdapter` wrap the wallets’ injected providers and throw when the extension is missing. Both implement `WalletAdapter`, which you can implement for another wallet.
- **Taproot only.** The wallet’s Taproot address is the Ksana account, and `getAccount` throws for any other address type. In Xverse, that is the Ordinals address.
- **No bitcoin.** For path B the wallet signs a text message with BIP322, the op’s sighash in hex, so it needs no coins.
- **Network.** A `tb1` address looks the same on the signet and on testnet, so ask the wallet with `getNetwork`, which may not know.

In tests, `MockUnisatWallet` plays Unisat with a local key: set `globalThis.unisat = new MockUnisatWallet({ secretKey, network: 'signet' })` before you connect. The wallet examples on this page ran that way, with nothing submitted or broadcast.

## Follow an op

```typescript title="follow.ts"
import type { KsanaRpcClient, OpStatus } from '@ksana/sdk';

/** Polls an op once a second until it is executed or final, or until `timeoutMs` passes. */
export async function waitFor(
  rpc: KsanaRpcClient,
  opId: Uint8Array,
  timeoutMs = 120_000,
): Promise<OpStatus> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const status = await rpc.getOpStatus(opId); // RpcError -32004 while the node does not know it
    if (status.status !== 'pending' && status.status !== 'skipped') return status;
    if (Date.now() > deadline) throw new Error(`still ${status.status} after ${timeoutMs} ms`);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}
```

| Status | Meaning |
| --- | --- |
| `pending` | in the node’s entry pool |
| `fast_confirmed` | executed successfully in a main-chain block |
| `failed` | included, but execution failed: the fee is charged, and `receipt.error` says why |
| `skipped` | included only by merged blocks that could not execute it; not charged, and back in the pool |
| `btc_final` | executed successfully, and its block is final |

A failed op never becomes `btc_final`. This example follows the transfer of the [quickstart](/docs/quickstart/#send-1-ksa), then reads its block’s settlement:

```typescript title="follow-demo.ts"
import { KsanaRpcClient, fromHex } from '@ksana/sdk';
import { waitFor } from './follow.js';

const rpc = new KsanaRpcClient('{{signet.rpc}}', { timeoutMs: 30_000 });
const opId = fromHex('262b5d466a9f2fc69b2362c38352b635dce95d4385514ac994137891a8cf3dc9', 32);
const status = await waitFor(rpc, opId);
console.log(`${status.status} in block ${status.block?.height}, gas ${status.receipt?.gas_used}`);
if (status.block !== null) {
  const s = await rpc.getSettlement(status.block.hash);
  const confirmations = s.confirmed?.confirmations ?? 0;
  console.log(`settlement ${s.status}, ${confirmations} confirmations`);
  console.log(`Bitcoin txid ${s.txid_rpc}`);
  console.log(`btc_final ${s.btc_final}`);
}
```

```output
btc_final in block 27, gas 10000
settlement confirmed, 11 confirmations
Bitcoin txid 5a4f1245b728011d71f732aab68fa34ccb5c6460fc5cc6166f9b7dfadb2f23d2
btc_final true
```

This run read the settlement the moment the op became `btc_final`, five Bitcoin blocks after the settlement’s sixth confirmation, so the count reads 11. The example passes the block’s hash to `getSettlement`, because a merged block has a settlement of its own, and `txid_rpc` is the Bitcoin transaction’s ID in the order explorers show. For a block with no settlement of its own, an empty block or one holding only path C operations, it throws `RpcError` -32004; [Confirmations](/docs/confirmations/#reading-the-marks) reads the marks from a later block instead.

A receipt’s `asset_changes` lists what the op did to built-in assets, in the order it did it, each an `AssetChange` told apart by its `kind` (the [RPC page](/docs/rpc/#ksana_getopstatus) lists the kinds). It is `null` when the node did not record them: a receipt it stored before it did, or any receipt of a node from before. With the `status` of the example above, and `toHex` imported from `@ksana/sdk` too:

```typescript
for (const change of status.receipt?.asset_changes ?? []) {
  if (change.kind === 'transfer' || change.kind === 'payout') {
    console.log(`${change.kind}: ${change.amount} to ${toHex(change.to)}`);
  }
}
```

## Watch new blocks

```typescript title="blocks.ts"
import { subscribeBlocks, toHex } from '@ksana/sdk';

const sub = subscribeBlocks(
  '{{signet.ws}}',
  (block) => {
    console.log(`block ${block.height} ${toHex(block.hash)}, ${block.entries} entries`);
    sub.close(); // one block is enough for this example
  },
  { onError: (error) => console.error('subscription:', error.message) },
);
```

```output
block 61 d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f, 0 entries
```

`subscribeBlocks` calls your function for each block the node connects to its main chain. It needs a global `WebSocket`, which browsers and Node.js 22 or later have; on Node.js 20, pass a WebSocket class in `options.WebSocket`.

The subscription does not reconnect, and it does not report a closed connection. When the chain is idle, blocks come minutes apart, so silence does not prove the socket is alive: call `getChainInfo` now and then, and subscribe again when it shows blocks the socket missed. After a reorganization the new blocks arrive, and nothing marks the ones removed.

## Read accounts and assets

```typescript title="state.ts"
import {
  KsanaRpcClient,
  equalBytes,
  formatOpPosition,
  ksaAssetId,
  parseAccount,
  toHex,
} from '@ksana/sdk';

const rpc = new KsanaRpcClient('{{signet.rpc}}', { timeoutMs: 30_000 });
const address = 'tb1pklkarsaaegsk2dxgh4ug9tru6q6x63gge8emdeltt8fpxm6r7zwse04hlm';
const account = parseAccount(address, 'signet');

const info = await rpc.getAccount(account);
const ksa = info.balances.find((b) => equalBytes(b.asset, ksaAssetId()))?.amount ?? 0n;
console.log(`nonce ${info.nonce}, ${ksa} base units of KSA, at block ${info.at.height}`);

// The account's ops, newest first: pass `next` as `before` for the next page
const page = await rpc.getAccountOps(account, { limit: 3 });
for (const op of page.ops) console.log(`${op.status} at ${op.block.height}: ${toHex(op.op_id)}`);
console.log('next', page.next === null ? null : formatOpPosition(page.next));
```

```output
nonce 9, 6975669407 base units of KSA, at block 61
fast_confirmed at 39: 85aa965def12e9cc329dc120f9fcabf2ad165b70731917fc47158e0b87b42f0d
btc_final at 38: 797d9dc411ae59e79ce0aa8a369ec151f9416f7afb18569c0181fe81ebecc2e0
btc_final at 37: 98db7cf37f05452b4f988a54bc3c53589cf44b41daf2c19883a7b02f64fed625
next 37:0:0
```

- `getAccount` returns the next nonce and the balances of built-in assets that are not zero. Tokens that live in a contract’s storage are not among them: `getAccountAssets` lists them, as under [Use KS-20 and KS-721 tokens](#use-ks-20-and-ks-721-tokens).
- `getAsset(id)` returns an asset’s name, symbol, decimals, supply and issuer, the capabilities its issuer holds and whether it is paused. KSA’s ID is `ksaAssetId()`, 32 zero bytes, and KSA has 8 decimals and no capabilities.
- `getAssetStatus(asset, account)` returns the account’s flags for the asset and whether the asset’s rules let it send and receive the asset now. Check it before sending an asset whose `capabilities` are not empty.
- `getBlock(id)` takes `'latest'`, a height or a hash, and `entries[i]` pairs with `receipts[i]`.
- `getAccountOps` and `getLatestOps` list ops newest first, at most 500 a page. Pass `page.next` as `before` until it is `null`.

## Call contracts

Contracts take and return raw bytes, by convention in Borsh: a method’s arguments are a tuple encoded back to back, one argument is encoded as itself, and none is empty bytes. The SDK exports `u32le`, `u64le` and the `ByteReader` class, but nothing for `u128`, strings or contract IDs, so add these helpers:

```typescript title="borsh.ts"
import { type ByteReader, concatBytes, sha256, u32le, u64le, utf8 } from '@ksana/sdk';

/** A deployed contract's ID: sha256(deployer, the deploy op's nonce as u64 LE, sha256(code)). */
export function contractId(deployer: Uint8Array, nonce: bigint, code: Uint8Array): Uint8Array {
  return sha256(concatBytes(deployer, u64le(nonce), sha256(code)));
}

/** Borsh u128: 16 bytes, little-endian. */
export function u128le(value: bigint): Uint8Array {
  if (value < 0n || value >= 1n << 128n) throw new RangeError(`not a u128: ${value}`);
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = Number((value >> BigInt(8 * i)) & 0xffn);
  return out;
}

/** Borsh String: the UTF-8 length as u32 LE, then the bytes. */
export function borshString(text: string): Uint8Array {
  const bytes = utf8(text);
  return concatBytes(u32le(bytes.length), bytes);
}

/** Borsh Vec<u8>: the length as u32 LE, then the bytes (not the SDK's varBytes). */
export function borshBytes(bytes: Uint8Array): Uint8Array {
  return concatBytes(u32le(bytes.length), bytes);
}

/** Reads a Borsh u128. */
export function readU128(reader: ByteReader): bigint {
  const bytes = reader.read(16);
  let value = 0n;
  for (let i = 15; i >= 0; i--) value = (value << 8n) | BigInt(bytes[i] ?? 0);
  return value;
}
```

`contractId` gives a deployed contract’s ID, which the deploy’s receipt does not return. For the tutorial’s token, `contractId(account, 0n, code)` gives `6569e81e…0c329658`, the ID the token has on the signet. Watch out for the SDK’s own `varBytes`: it writes Bitcoin’s length prefix, not Borsh’s.

`call` runs one method on the latest state, with no key, no fee and nothing on chain. This example reads the tutorial’s pool and simulates a swap:

```typescript title="call.ts"
import {
  ByteReader,
  KsanaRpcClient,
  type Receipt,
  concatBytes,
  fromHex,
  ksaAssetId,
} from '@ksana/sdk';
import { readU128, u128le } from './borsh.js';

const rpc = new KsanaRpcClient('{{signet.rpc}}', { timeoutMs: 30_000 });
const pool = fromHex('eb5ca55289984d64598a12303a0638ee9dd6edc50f4bebe6d43a7a46121fc745', 32);
const me = fromHex('b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09d', 32);

/** The output of a successful call; a revert or any other failure throws. */
function output(receipt: Receipt): ByteReader {
  if (!receipt.success) throw new Error(receipt.error ?? 'the call failed');
  return new ByteReader(receipt.output, 'output');
}

// reserves() -> (u128, u128): no arguments, so empty bytes
const noArgs = new Uint8Array(0);
const reserves = output(await rpc.call({ contract: pool, method: 'reserves', args: noArgs }));
const [tut, ksa] = [readU128(reserves), readU128(reserves)];
reserves.finish(); // throws if bytes are left over
console.log(`reserves: ${tut} TUT, ${ksa} KSA (base units)`);

// swap(id_in, amount_in, min_out) -> u128, simulated as `me` with 1 KSA attached
const amountIn = 100_000_000n;
const quote = await rpc.call({
  contract: pool,
  method: 'swap',
  args: concatBytes(ksaAssetId(), u128le(amountIn), u128le(1n)),
  funds: [{ asset: ksaAssetId(), amount: amountIn }],
  caller: me,
});
console.log(`1 KSA buys ${readU128(output(quote))} TUT base units; gas ${quote.gas_used}`);
```

```output
reserves: 4952249151934 TUT, 2524330584 KSA (base units)
1 KSA buys 188160627188 TUT base units; gas 169247
```

- **Caller.** It defaults to 32 zero bytes. Set `caller` when the method reads its caller, or when you attach `funds`, which the simulation moves out of the caller’s balance.
- **Gas.** `gas_used` is what the same call uses in an op: the tutorial’s real swap used 169,247 gas too. A failed call reports its `max_gas`, which defaults to the block limit of 100,000,000.
- **Failures.** A revert or a missing contract gives `success: false` and the reason in `error`, such as `revert: unknown method`.
- **Load.** A node runs at most 4 calls at once and answers a fifth with error -32009.

## Use KS-20 and KS-721 tokens

A contract that follows a token standard, KS-20 for fungible tokens or KS-721 for NFTs, says so in its view `standards()`. The SDK speaks both [standards]({{repo}}/blob/main/docs/STANDARDS.md): it reads their views with `call`, builds their operations as actions and decodes their events.

```typescript title="tokens.ts"
import {
  type KsanaRpcClient,
  type Receipt,
  decodeStandardEvent,
  equalBytes,
  ks20BalanceOf,
  ks20Transfer,
  readKs20,
} from '@ksana/sdk';

/** What a wallet shows of a KS-20 token, or null for a contract that does not declare KS-20. */
export async function tokenRow(rpc: KsanaRpcClient, token: Uint8Array, holder: Uint8Array) {
  const info = await readKs20(rpc, token); // standards(), then metadata(), total_supply() and capabilities()
  if (info === null) return null;
  const balance = await ks20BalanceOf(rpc, token, holder); // in base units
  return { ...info, balance };
}

/** The action that sends `amount` base units of the token: sign it into a VmOp as on path B. */
export function sendToken(token: Uint8Array, to: Uint8Array, amount: bigint) {
  return ks20Transfer(token, to, amount);
}

/** The token's own events in an op's receipt, read by its declaration. */
export function tokenEvents(receipt: Receipt, token: Uint8Array, standards: string[]) {
  return receipt.events
    .filter((event) => equalBytes(event.contract, token))
    .flatMap((event) => decodeStandardEvent(standards, event.data) ?? []);
}
```

- **Discovery.** `readStandards` returns a contract’s declaration, the standard first and then its extensions, such as `KS-20-burnable` or `KS-721-enumerable`, or `null` for a contract that declares none. `readKs20` and `readKs721` read the rest one view at a time, since a node runs at most 4 calls at once.
- **Capabilities.** `capabilities` lists what the token’s rules let someone do now, in this order: `mint`, `freeze`, `allowlist`, `pause`, `clawback`, `fee` and `upgrade`. A token with `fee` gives the recipient less than the amount sent, and the sender’s balance drops by exactly the amount.
- **Operations.** The builders return a `Call` action: `ks20Transfer`, `ks20TransferFrom`, `ks20Approve`, `ks20TransferAndCall` and the others, and `ks721Transfer`, `ks721SetOperator` and the others for NFTs. They refuse a zero amount and the zero account or the token itself as recipient, which every token would refuse on chain after charging the op’s fee. `ks20TransferAndCall` moves tokens into a contract and calls that contract in the same op. `assetTransfer` sends either kind of asset, a built-in one or a KS-20 token, named by an `AssetRef`.
- **Approvals.** `ks20Approve(token, spender, amount, expiresAt)` sets an allowance that counts until the block timestamp reaches `expiresAt`, in seconds, or for good when it is `null`. Approve the amount you need, with an expiry; `0n` revokes the allowance.
- **Refusals.** A view the contract refuses throws `StandardCallError`, whose `reason` is the revert reason: one of the standards’ fixed English phrases, or `rejected: …` for the token’s own rules.
- **NFT IDs.** KS-721 token IDs are 32 bytes. `ks721TokenId(7n)` is the ID of serial number 7, and `ks721Serial` reads the number back, or gives `null` for an ID that holds a hash.

A node indexes the standards’ events, and six methods read its index: `getAccountAssets` lists everything an account holds, `getNfts` its NFTs and `getApprovals` the approvals it gave; `getToken`, `getTokenHolders` and `getContract` describe a contract. The lists come a page at a time: pass `after: page.next` until `next` is `null`.

```typescript title="assets.ts"
import type { AccountAsset, KsanaRpcClient } from '@ksana/sdk';

/** Everything an account holds by the node’s index: built-in assets, then KS-20 tokens and KS-721 collections. */
export async function allAssets(rpc: KsanaRpcClient, account: Uint8Array): Promise<AccountAsset[]> {
  const assets: AccountAsset[] = [];
  let after: string | null = null;
  do {
    const page = await rpc.getAccountAssets(account, { after, limit: 500 });
    assets.push(...page.assets);
    after = page.next;
  } while (after !== null);
  return assets;
}
```

- **What and how much.** The index tells what an account holds, and the token’s views tell how much: read `ks20BalanceOf` before you send. The index lists an allowance as it was approved, and `ks20Allowance` gives what is left of it.
- **Kinds.** An `AccountAsset` is a built-in asset (`kind: 'asset'`), a KS-20 token (`'token'`, with its `balance`) or a KS-721 collection (`'nft'`, with the `count` of NFTs held). An approval is an `allowance`, an `operator` or the approval of one NFT (`'token'`); its `expires_at` is a block timestamp in seconds, or `null`.
- **Tokens.** `getToken` gives a token’s standard, metadata, supply and number of holders, and `irregular` is `true` once the index had to leave out one of its events. It and `getTokenHolders` throw `RpcError` -32004 for a contract that declared neither standard.
- **Older nodes.** A node without the index throws `RpcError` -32601 (`RPC_ERROR_CODES.METHOD_NOT_FOUND`).

## Send an op on path C

A path C op travels in a Bitcoin transaction that your wallet signs and pays for, and it needs no KSA. Producers must include it once the transaction has 2 confirmations on the signet, 5 on mainnet. [Operations and fees](/docs/submitting-ops/) explains the path, and this function builds the transaction:

```typescript title="pathc.ts"
import {
  type KsanaRpcClient,
  type Params,
  type UnsignedVmOp,
  type Utxo,
  VMOP_VERSION,
  type WalletAdapter,
  buildNativeTx,
  extractTransaction,
  ksaAssetId,
  nativeFirstInput,
  opId,
  signVmopWithWallet,
} from '@ksana/sdk';

/**
 * Builds a path C KSA transfer: the op rides in a Bitcoin transaction that the wallet signs and
 * pays for. Returns the raw transaction to broadcast and the op's ID.
 */
export async function nativeTransfer(
  rpc: KsanaRpcClient,
  params: Params,
  wallet: WalletAdapter,
  account: Uint8Array,
  utxos: Utxo[], // the account's confirmed coins
  to: Uint8Array,
  amount: bigint,
  feeRate: number, // sat/vB
): Promise<{ raw: Uint8Array; opId: Uint8Array }> {
  const first = utxos[0];
  if (first === undefined) throw new Error('no coins to pay the Bitcoin fee');
  const unsigned: UnsignedVmOp = {
    version: VMOP_VERSION,
    chain_id: params.chain_id,
    account,
    nonce: (await rpc.getAccount(account)).nonce, // plus your path C ops still waiting
    fee: { kind: 'BtcNative' }, // no KSA fee: the Bitcoin transaction pays
    max_gas: 10_000n, // at most params.native_max_gas
    action: { kind: 'AssetTransfer', asset: ksaAssetId(), to, amount },
  };
  // The signature covers the transaction's first input, so choose that coin before signing.
  const op = await signVmopWithWallet(unsigned, wallet, { firstInput: nativeFirstInput(first) });
  const draft = buildNativeTx({ op, utxos, changeScript: first.script, feeRate, params });
  const signed = await wallet.signPsbt(draft.psbt, draft.inputs.map((_, index) => ({ index })));
  return { raw: extractTransaction(signed), opId: opId(op) };
}
```

- **Coins.** The SDK does not list coins: get the account’s confirmed coins from your own bitcoind or an Esplora API. A `Utxo` holds the txid in internal byte order (`txidFromRpc` converts an explorer’s), `vout`, `value` in sats, `script` and the wallet’s `tapInternalKey`. For the account’s own address the script is `p2trScriptFromOutputKey(account)`.
- **The transaction.** Output 0 carries the op in a KSN1 `OP_RETURN`, then come any `payments`, then the change. Only Taproot key-path and P2WPKH coins can be spent.
- **Broadcast.** Send `toHex(raw)` with bitcoind’s `sendrawtransaction`. Bitcoin Core 30 and later relay the large `OP_RETURN` by default; older versions need `-datacarriersize=100000`.
- **Tracking.** `getOpStatus` answers -32004 until a block includes the op, and `getAccount` does not count path C ops still waiting.
- **Gas.** `max_gas` can be at most 1,000,000, `params.native_max_gas`.

With a key instead of a wallet, sign the op with `signedVmop(unsigned, secretKey, undefined, nativeFirstInput(first))`, and the transaction with `extractTransaction(signNativeTx(draft.psbt, secretKey))`.

## Top up with KSA

A top-up buys KSA with bitcoin from a seller’s lock in a [`ksa-exchange` contract](/docs/example-contracts/#ksa-exchange). One Bitcoin transaction pays the lock’s script and carries a path C op that calls `claim`:

```typescript title="topup.ts"
import {
  type KsanaRpcClient,
  SIGNET,
  type Utxo,
  type WalletAdapter,
  buildTopUp,
  extractTransaction,
  fromHex,
  getLock,
  p2trScriptFromOutputKey,
  quoteTopUp,
} from '@ksana/sdk';

/**
 * Buys all the KSA that lock `lockId` of a ksa-exchange contract still holds, for the wallet's
 * own account. Returns the raw transaction to broadcast, the claim op's ID, and the Bitcoin
 * height the transaction must confirm by.
 */
export async function topUp(
  rpc: KsanaRpcClient,
  wallet: WalletAdapter,
  utxos: Utxo[], // the wallet's confirmed coins
  exchange: Uint8Array,
  lockId: bigint,
  btcHeight: number, // the Bitcoin tip, for the expiry check
  feeRate: number, // sat/vB
): Promise<{ raw: Uint8Array; opId: Uint8Array; payBy: number }> {
  const params = await rpc.getParams(SIGNET);
  const buyer = fromHex((await wallet.getAccount()).account, 32);
  const lock = await getLock(rpc, exchange, lockId);
  const { satsForAll } = quoteTopUp(lock, 0n); // the sats that buy everything still locked
  const draft = buildTopUp({
    exchange,
    lockId,
    lock,
    beneficiary: buyer, // refused unless it is the lock's beneficiary
    sats: satsForAll,
    currentBtcHeight: btcHeight,
    utxos,
    changeScript: p2trScriptFromOutputKey(buyer),
    feeRate,
    params,
  });
  const signed = await wallet.signPsbt(draft.psbt, draft.inputs.map((_, index) => ({ index })));
  return { raw: extractTransaction(signed), opId: draft.opId, payBy: draft.payBy };
}
```

- `getLock` reads the lock. `quoteTopUp(lock, sats)` gives the KSA that `sats` buy, and `satsForAll`, the sats that buy all of it.
- `buildTopUp` refuses a lock whose beneficiary is not the buyer, a lock that is not open, and a lock that expires within 3 Bitcoin blocks (`expiryMargin`). It also refuses an amount other than `satsForAll`, unless you pass `allowPartial` or `allowOverpay`.
- A fresh one-time key signs the claim op with nonce 0, so it uses none of your account’s nonces.
- The transaction must confirm by Bitcoin height `payBy`. After that, the seller’s `release` may run first.

## Query the indexer

```typescript title="indexer.ts"
import { IndexerRpcClient, KsanaRpcClient, equalBytes } from '@ksana/sdk';

const rpc = new KsanaRpcClient('{{signet.rpc}}', { timeoutMs: 30_000 });
const indexer = new IndexerRpcClient('{{signet.indexer}}', {
  timeoutMs: 30_000,
});

// The indexer rebuilds the state from Bitcoin alone; compare its state root with the node's block.
const status = await indexer.status();
const { header } = await rpc.getBlock(status.height);
console.log(`indexer at ${status.height}, Bitcoin ${status.btc_height}, halted ${status.halted}`);
console.log('same state root as the node:', equalBytes(status.state_root, header.state_root));
```

```output
indexer at 51, Bitcoin 327291, halted null
same state root as the node: true
```

The indexer rebuilds Ksana’s state from Bitcoin alone, so a state root that matches the node’s shows that the node’s state follows from what is on Bitcoin. It trails the node, because it executes a block only once the block has 2 confirmations or is final. `stateRoot(id)` gives the root of one block it has verified, and [Run an indexer](/docs/run-an-indexer/) explains the rest.

::: note Calls from web pages
On the public signet, only `{{signet.rpc}}` answers pages from other origins. `{{signet.indexer}}`, `{{signet.btc}}` and `{{signet.faucet}}` answer servers and the signet’s own page, so reach them through your own server.
:::

## Handle errors

```typescript title="errors.ts"
import {
  ChainMismatchError,
  KsanaRpcClient,
  MAINNET,
  RPC_ERROR_CODES,
  RpcError,
} from '@ksana/sdk';

const rpc = new KsanaRpcClient('{{signet.rpc}}', { timeoutMs: 30_000 });

try {
  await rpc.getOpStatus(new Uint8Array(32)); // no op has this ID
} catch (e) {
  if (!(e instanceof RpcError) || e.code !== RPC_ERROR_CODES.NOT_FOUND) throw e;
  console.log(e.code, e.message);
}

try {
  await rpc.getParams(MAINNET); // the node is on the signet
} catch (e) {
  if (!(e instanceof ChainMismatchError)) throw e;
  console.log(e.chainId, e.expected, e.message.split(':')[0]);
}
```

```output
-32004 ksana_getOpStatus: unknown op
1002 1000 the node is on signet (chain ID 1002), not mainnet (chain ID 1000)
```

| Error | When |
| --- | --- |
| `RpcError` | the node answered with a JSON-RPC error: `code` holds its code, and the message starts with the method |
| `RpcTransportError` | the request failed or timed out, or the answer could not be parsed |
| `ChainMismatchError` | the node is on another network than the one you passed |
| `StandardCallError` | a contract refused a view of a token standard: `reason` holds its revert reason |
| `Error`, `RangeError`, `TypeError` | a builder refused its input, before anything was sent |

`RPC_ERROR_CODES` names -32601, -32602, -32603, -32004, -32010 and -32011. It does not name -32009, the answer to a fifth concurrent `call`, so compare that code directly. The [JSON-RPC API](/docs/rpc/#errors) explains every code.
