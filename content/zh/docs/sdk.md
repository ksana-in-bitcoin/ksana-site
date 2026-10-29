---
title: TypeScript SDK
lede: @ksana/sdk 包在 Node.js 和浏览器中构建、签名并发送 Ksana 操作，连接比特币钱包，并从节点和索引器读取数据。
description: 如何从仓库安装 Ksana 的 TypeScript SDK、连接节点、用密钥或浏览器钱包签署路径 B 和路径 C 操作、读取状态、调用合约、使用 KS-20 和 KS-721 代币，以及处理错误。
---

SDK 位于仓库的 `sdk/ts` 目录，包名是 `@ksana/sdk`。它能在 Node.js 20.19 及更高版本和浏览器中运行，库代码只用到 Web API。它替你和节点的 [JSON-RPC](/docs/rpc/) 接口打交道：字节串是 `Uint8Array`，`u64` 和 `u128` 值是 `bigint`，`u8` 和 `u32` 值是 `number`。

本页的每个示例都已用打包好的 SDK 通过类型检查，附有输出的示例还于 2026 年 10 月 21 日在公开 signet 上实际运行过。主网尚未上线，所以示例都用 signet。

## 安装 SDK

这个包没有发布到 npm 上。请从仓库构建它，打成一个 tarball，再在你的项目里安装这个 tarball：

```sh
git clone {{repo}}
(cd ksana/sdk/ts && npm ci && npm run build && npm pack)
mkdir -p my-app/vendor && mv ksana/sdk/ts/ksana-sdk-0.1.0.tgz my-app/vendor/
cd my-app
npm init -y
npm pkg set type=module
npm install ./vendor/ksana-sdk-0.1.0.tgz
```

npm 会把这个 tarball 记进 `package.json`，所以以后即使没有克隆下来的仓库，`npm ci` 也能正常工作。打包之前要先构建：没有运行 `npm run build` 就打出的 tarball 里没有任何代码。

这个包是 ES 模块，类型只能经由它的 `exports` 映射找到：

- 在 TypeScript 中，把 `moduleResolution` 设为 `node16`、`nodenext` 或 `bundler`。旧的 `node` 设置找不到这些类型。
- 在浏览器中，要用 Vite 或 esbuild 这类打包工具：SDK 按包名导入它的依赖。
- 一切都从 `@ksana/sdk` 导入。包内更深的路径都被屏蔽了。

::: warning SDK 与节点要配套
SDK 会拒绝任何它不认识的结果字段。因此，比节点旧的 SDK 会失败，抛出一个 `RpcTransportError`，其消息以 `malformed result` 开头。请用与你所用节点同一版本的仓库构建 SDK；节点更新之后，重新构建 tarball。
:::

## 连接节点

```typescript title="connect.ts"
import { KsanaRpcClient, SIGNET } from '@ksana/sdk';

const rpc = new KsanaRpcClient('{{signet.rpc}}', { timeoutMs: 30_000 });
// 签名要用的参数。节点若在别的网络上，这里会抛出 ChainMismatchError。
const params = await rpc.getParams(SIGNET);
const { tip, finalized } = await rpc.getChainInfo();
console.log(`chain ${params.chain_id}, tip ${tip.height}, finalized ${finalized.height}`);
```

```output
chain 1002, tip 60, finalized 38
```

`getParams` 读取节点的链 ID，返回那个网络的参数，每个构建函数和签名函数都要用到这些参数。调用时传入你预期的网络（这里是 `SIGNET`），节点若在别的网络上，它就会在你签任何东西之前抛出 `ChainMismatchError`。SDK 没有默认网络；它的三组参数是 `DEVNET`、`SIGNET` 和 `MAINNET`。

`finalized` 是最新的已最终区块。客户端的选项里还可以传入 `headers` 和一个 `fetch` 函数；除非你设置 `timeoutMs`，否则它没有超时。

## 密钥与账户

Ksana 账户是一把私钥的 Taproot 输出公钥：32 个字节，也就是它在 signet 上的 `tb1p` 地址、在主网上的 `bc1p` 地址的见证程序。SDK 没有密钥生成器，所以要反复抽取随机字节，直到它们构成一把有效的密钥。`ksana-cli` 的密钥文件以 64 位十六进制保存私钥，`ksana-cli --chain signet key alice.key` 会创建一个：

```typescript title="keys.ts"
import { readFile } from 'node:fs/promises';
import { fromHex, isValidSecretKey, randomBytes } from '@ksana/sdk';

/** 一把新私钥：32 个随机字节，且是一把有效的 secp256k1 密钥。 */
export function newSecretKey(): Uint8Array {
  for (;;) {
    const key = randomBytes(32);
    if (isValidSecretKey(key)) return key;
  }
}

/** 读取 ksana-cli 或 ksana-keytool 的密钥文件：64 位十六进制的私钥。 */
export async function readKeyFile(path: string): Promise<Uint8Array> {
  return fromHex((await readFile(path, 'utf8')).trim(), 32, path);
}
```

```typescript title="accounts.ts"
import { accountOf, accountToAddress, parseAccount, toHex } from '@ksana/sdk';
import { readKeyFile } from './keys.js';

const account = accountOf(await readKeyFile('alice.key')); // 32 字节：Taproot 输出公钥
const address = accountToAddress(account, 'signet');
console.log(toHex(account));
console.log(address);
// parseAccount 接受 64 位十六进制，或给定网络上的 Taproot 地址
console.log(toHex(parseAccount(address, 'signet')) === toHex(account));
```

```output
b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09d
tb1pklkarsaaegsk2dxgh4ug9tru6q6x63gge8emdeltt8fpxm6r7zwse04hlm
true
```

`parseAccount(text, network)` 接受 64 位十六进制，或那个网络上的 Taproot 地址，并拒绝其他类型的地址。合约只有 ID，没有地址；`accountToAddress` 却分不清合约 ID 和账户，因为在所有 32 字节串中，约有一半是有效的密钥。客户端的方法接受字节或 64 位十六进制形式的账户，从不接受地址，所以要先对用户输入的内容运行 `parseAccount`。

## 走路径 B 发送操作

路径 B 操作用 KSA 付手续费，直接发给节点。你需要账户的下一个 nonce、一笔手续费、一个 gas 上限和一个签名。

### 用密钥

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

/** 走路径 B 把 `amount` 个最小单位的 KSA 发给 `to`，返回操作 ID。 */
export async function transfer(
  rpc: KsanaRpcClient,
  params: Params,
  secretKey: Uint8Array,
  to: Uint8Array,
  amount: bigint,
): Promise<Uint8Array> {
  const account = accountOf(secretKey);
  const [{ nonce }, estimate] = await Promise.all([rpc.getAccount(account), rpc.estimateFee()]);
  const maxGas = 10_000n; // 一笔 KSA 转账正好用 10,000 gas
  const unsigned: UnsignedVmOp = {
    version: VMOP_VERSION,
    chain_id: params.chain_id,
    account,
    nonce, // 账户的下一个 nonce
    fee: { kind: 'Token', amount: estimate.path_b.amount },
    max_gas: maxGas,
    action: { kind: 'AssetTransfer', asset: ksaAssetId(), to, amount },
  };
  // 建议费率按操作成本每 KiB 计：先量出签好名的操作有多大，再签上真正的手续费。
  const cost = opCost(params, encodeVmOp(signedVmop(unsigned, secretKey)).length, maxGas);
  const fee = feeFor(estimate.path_b.per_kib, cost, estimate.path_b.amount);
  const op = signedVmop({ ...unsigned, fee: { kind: 'Token', amount: fee } }, secretKey);
  const { op_id } = await rpc.submitOp(op); // 节点拒绝时抛出 RpcError -32010 或 -32011
  return op_id;
}
```

- **nonce**：`getAccount` 返回账户的下一个 nonce。节点为每个账户最多排队 64 笔操作，所以要连续发出一批操作时，可以从这个 nonce 往上数。
- **手续费**：一个固定的 KSA 数额，以最小单位计，操作失败也照扣。`estimateFee` 为普通转账建议 `path_b.amount`，并按操作成本给出每 KiB 的建议值 `path_b.per_kib`；操作的成本是它编码后的大小与它的 gas 上限换算成的字节数两者中较大的那个。建议值随最近的区块变动，signet 节点接受 1 个最小单位。
- **gas**：一笔 KSA 转账正好用 10,000 gas。一次调用花 20,000，加上合约代码每字节 1，每附带一种资产再加 10,000，再加上方法本身的用量：见[宿主函数与 gas](/docs/host-functions/)。
- **拒绝**：操作无效时，`submitOp` 抛出 `RpcError` -32010，比如 nonce 已被用过，或者余额不够付手续费。节点的策略拒绝这笔操作时，它抛出 -32011，比如手续费低于节点的门槛。

如果节点在出块，`submitOp` 要等它的出块模板收下这笔操作才返回，最多 5 秒。要调用合约，就用动作 `{ kind: 'Call', contract, method, args, funds }`，`args` 的写法见[调用合约](#call-contracts)。附带的 `funds` 必须按资产 ID 排序：先交给 `sortFunds`，再交给 `checkFunds`。

### 用浏览器钱包

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

/** 连接 Unisat 或 Xverse，检查它所在的网络，返回它的 Ksana 账户。 */
export async function connect(
  kind: 'unisat' | 'xverse',
): Promise<{ wallet: WalletAdapter; address: string; account: Uint8Array }> {
  const wallet: WalletAdapter = kind === 'unisat' ? new UnisatAdapter() : new XverseAdapter();
  const params = await rpc.getParams(SIGNET);
  // 光凭 tb1 地址分不清 signet 和 testnet：要问钱包，而钱包未必知道。
  const network = await wallet.getNetwork?.();
  if (network !== undefined && network.network !== btcNetworkOf(params)) {
    throw new Error(`switch the wallet to Bitcoin Signet (it is on ${network.name})`);
  }
  const { address, account } = await wallet.getAccount(); // 地址不是 Taproot 就抛出异常
  return { wallet, address, account: fromHex(account, 32) };
}

/** 走路径 B 发送 KSA：钱包签一条消息，不动用任何比特币。返回操作 ID。 */
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
  // 钱包的签名编码后最多 67 字节：这样不必让钱包签两次，就能算出操作的大小。
  const placeholder = { kind: 'Bip322Simple' as const, bytes: new Uint8Array(67) };
  const cost = opCost(params, encodeVmOp({ ...unsigned, sig: placeholder }).length, maxGas);
  const fee = feeFor(estimate.path_b.per_kib, cost, estimate.path_b.amount);
  const final: UnsignedVmOp = { ...unsigned, fee: { kind: 'Token', amount: fee } };
  // 钱包会显示一条待签的消息：写成十六进制的操作签名哈希。
  const op = await signVmopWithWallet(final, wallet);
  return (await rpc.submitOp(op)).op_id;
}
```

- **适配器**：`UnisatAdapter` 和 `XverseAdapter` 封装了这两个钱包注入的 provider，扩展不存在时抛出异常。两者都实现了 `WalletAdapter`，你也可以为别的钱包实现它。
- **只认 Taproot**：钱包的 Taproot 地址就是 Ksana 账户，对其他任何类型的地址，`getAccount` 都会抛出异常。在 Xverse 里，那就是 Ordinals 地址。
- **不需要比特币**：走路径 B 时，钱包用 BIP322 签一条文本消息，即写成十六进制的操作签名哈希，所以不需要任何币。
- **网络**：`tb1` 地址在 signet 和 testnet 上看起来一模一样，所以要用 `getNetwork` 问钱包，而钱包未必知道。

测试时，`MockUnisatWallet` 用一把本地密钥扮演 Unisat：连接之前，先设置 `globalThis.unisat = new MockUnisatWallet({ secretKey, network: 'signet' })`。本页的钱包示例就是这样运行的，没有提交或广播任何东西。

## 跟踪操作

```typescript title="follow.ts"
import type { KsanaRpcClient, OpStatus } from '@ksana/sdk';

/** 每秒轮询一次操作，直到它执行完毕或已最终，或者过了 `timeoutMs`。 */
export async function waitFor(
  rpc: KsanaRpcClient,
  opId: Uint8Array,
  timeoutMs = 120_000,
): Promise<OpStatus> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const status = await rpc.getOpStatus(opId); // 节点还不知道这笔操作时，抛出 RpcError -32004
    if (status.status !== 'pending' && status.status !== 'skipped') return status;
    if (Date.now() > deadline) throw new Error(`still ${status.status} after ${timeoutMs} ms`);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}
```

| 状态 | 含义 |
| --- | --- |
| `pending` | 在节点的条目池里 |
| `fast_confirmed` | 在一个主链区块里执行成功 |
| `failed` | 已收录，但执行失败：手续费照扣，`receipt.error` 说明原因 |
| `skipped` | 只被无法执行它的被合并区块收录；不收费，并已回到条目池 |
| `btc_final` | 执行成功，且所在区块已最终 |

失败的操作永远不会变成 `btc_final`。这个例子跟踪[快速上手](/docs/quickstart/#send-1-ksa)里的那笔转账，然后读取它所在区块的结算：

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

这次运行是在操作刚变成 `btc_final` 时读取结算的，那时离结算的第 6 个确认已过了 5 个比特币区块，所以确认数是 11。传给 `getSettlement` 的是区块的哈希，因为被合并的区块有它自己的结算；`txid_rpc` 是这笔比特币交易的 ID，按区块浏览器显示的顺序书写。对没有自己的结算的区块，即空块或只含路径 C 操作的区块，`getSettlement` 会抛出 `RpcError` -32004；[确认与最终性](/docs/confirmations/#reading-the-marks)一页则改从后面的区块读取印记。

回执的 `asset_changes` 按先后顺序列出这个操作对内置资产做了什么，每一项是一个 `AssetChange`，用 `kind` 区分（各种变动见 [RPC 页面](/docs/rpc/#ksana_getopstatus)）。节点没有记录时它为 `null`：节点在开始记录之前存下的回执，或者更早版本的节点给出的任何回执。沿用上面例子里的 `status`，再从 `@ksana/sdk` 导入 `toHex`：

```typescript
for (const change of status.receipt?.asset_changes ?? []) {
  if (change.kind === 'transfer' || change.kind === 'payout') {
    console.log(`${change.kind}: ${change.amount} to ${toHex(change.to)}`);
  }
}
```

## 监听新区块

```typescript title="blocks.ts"
import { subscribeBlocks, toHex } from '@ksana/sdk';

const sub = subscribeBlocks(
  '{{signet.ws}}',
  (block) => {
    console.log(`block ${block.height} ${toHex(block.hash)}, ${block.entries} entries`);
    sub.close(); // 这个例子有一个区块就够了
  },
  { onError: (error) => console.error('subscription:', error.message) },
);
```

```output
block 61 d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f, 0 entries
```

节点每把一个区块接入它的主链，`subscribeBlocks` 就调用一次你的函数。它需要一个全局的 `WebSocket`，浏览器和 Node.js 22 及更高版本都有；在 Node.js 20 上，要在 `options.WebSocket` 中传入一个 WebSocket 类。

订阅不会自动重连，连接关闭时也不会告诉你。链空闲时，区块要隔几分钟才来一个，所以一直没有消息并不能证明连接还活着：要不时调用一下 `getChainInfo`，发现有连接漏掉的区块时，就重新订阅。重组之后，新的区块会照常送达，但被移除的那些区块不会有任何标记。

## 读取账户与资产

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

// 账户的操作，最新的在前：把 `next` 作为 `before` 传入，就能取下一页
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

- `getAccount` 返回下一个 nonce，以及不为零的各项内置资产余额。存在合约存储里的代币不在其中：`getAccountAssets` 会列出它们，见[使用 KS-20 和 KS-721 代币](#use-ks-20-and-ks-721-tokens)。
- `getAsset(id)` 返回资产的名称、符号、小数位数、总量和发行者，以及发行方拥有的能力和资产是否暂停。KSA 的 ID 是 `ksaAssetId()`，即 32 个零字节；KSA 有 8 位小数，没有任何能力。
- `getAssetStatus(asset, account)` 返回账户在该资产上的标记，以及资产的规则现在是否允许它发送和接收这个资产。发送 `capabilities` 不为空的资产之前，先查一下它。
- `getBlock(id)` 接受 `'latest'`、高度或哈希；`entries[i]` 与 `receipts[i]` 一一对应。
- `getAccountOps` 和 `getLatestOps` 按从新到旧列出操作，每页最多 500 笔。把 `page.next` 作为 `before` 传入，直到它为 `null`。

## 调用合约

合约接收和返回的都是原始字节，按惯例用 Borsh 编码：一个方法的多个参数组成一个元组，依次紧挨着编码；单个参数就编码它本身；没有参数时，就是空的字节串。SDK 导出了 `u32le`、`u64le` 和 `ByteReader` 类，但没有处理 `u128`、字符串或合约 ID 的函数，所以要加上下面这些辅助函数：

```typescript title="borsh.ts"
import { type ByteReader, concatBytes, sha256, u32le, u64le, utf8 } from '@ksana/sdk';

/** 已部署合约的 ID：把 deployer、部署操作的 nonce（u64 LE）和 sha256(code) 连在一起，再取 sha256。 */
export function contractId(deployer: Uint8Array, nonce: bigint, code: Uint8Array): Uint8Array {
  return sha256(concatBytes(deployer, u64le(nonce), sha256(code)));
}

/** Borsh u128：16 字节，小端。 */
export function u128le(value: bigint): Uint8Array {
  if (value < 0n || value >= 1n << 128n) throw new RangeError(`not a u128: ${value}`);
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = Number((value >> BigInt(8 * i)) & 0xffn);
  return out;
}

/** Borsh String：先是 UTF-8 编码的长度（u32 LE），再是这些字节。 */
export function borshString(text: string): Uint8Array {
  const bytes = utf8(text);
  return concatBytes(u32le(bytes.length), bytes);
}

/** Borsh Vec<u8>：先是长度（u32 LE），再是这些字节（不同于 SDK 的 varBytes）。 */
export function borshBytes(bytes: Uint8Array): Uint8Array {
  return concatBytes(u32le(bytes.length), bytes);
}

/** 读取一个 Borsh u128。 */
export function readU128(reader: ByteReader): bigint {
  const bytes = reader.read(16);
  let value = 0n;
  for (let i = 15; i >= 0; i--) value = (value << 8n) | BigInt(bytes[i] ?? 0);
  return value;
}
```

`contractId` 算出已部署合约的 ID，部署操作的回执不会返回这个 ID。对教程里的代币，`contractId(account, 0n, code)` 得出 `6569e81e…0c329658`，正是这个代币在 signet 上的 ID。当心 SDK 自带的 `varBytes`：它写的是比特币的长度前缀，不是 Borsh 的。

`call` 在最新的状态上运行一个方法：不用密钥，不收手续费，也不在链上留下任何东西。下面这个例子读取教程里的资金池，并模拟一次兑换：

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

/** 成功调用的输出；revert 或其他任何失败都会抛出异常。 */
function output(receipt: Receipt): ByteReader {
  if (!receipt.success) throw new Error(receipt.error ?? 'the call failed');
  return new ByteReader(receipt.output, 'output');
}

// reserves() -> (u128, u128)：没有参数，所以是空字节
const noArgs = new Uint8Array(0);
const reserves = output(await rpc.call({ contract: pool, method: 'reserves', args: noArgs }));
const [tut, ksa] = [readU128(reserves), readU128(reserves)];
reserves.finish(); // 有剩余字节时抛出异常
console.log(`reserves: ${tut} TUT, ${ksa} KSA (base units)`);

// swap(id_in, amount_in, min_out) -> u128，以 `me` 的身份模拟，附带 1 KSA
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

- **调用者**：默认是 32 个零字节。方法要读取它的调用者时，或者你附带了 `funds` 时，要设置 `caller`；模拟时，附带的资产会从调用者的余额中转出。
- **gas**：`gas_used` 就是同样的调用放在一笔操作里的用量：教程里真实的那次兑换也用了 169,247 gas。失败的调用报告的是它的 `max_gas`，默认是区块的 gas 上限 100,000,000。
- **失败**：revert 或合约不存在时，结果是 `success: false`，原因写在 `error` 里，比如 `revert: unknown method`。
- **负载**：一个节点同一时间最多运行 4 个调用，第五个会得到错误 -32009。

## 使用 KS-20 和 KS-721 代币

遵循代币标准的合约（同质化代币是 KS-20，NFT 是 KS-721）会在视图 `standards()` 里声明这一点。SDK 两种[标准]({{repo}}/blob/main/docs/STANDARDS.md)都支持：用 `call` 读取它们的视图，把它们的操作构建成动作，并解码它们的事件。

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

/** 钱包显示一个 KS-20 代币要用的信息；合约没有声明 KS-20 时返回 null。 */
export async function tokenRow(rpc: KsanaRpcClient, token: Uint8Array, holder: Uint8Array) {
  const info = await readKs20(rpc, token); // 先问 standards()，再问 metadata()、total_supply() 和 capabilities()
  if (info === null) return null;
  const balance = await ks20BalanceOf(rpc, token, holder); // 以最小单位计
  return { ...info, balance };
}

/** 发送 `amount` 个最小单位代币的动作：像路径 B 那样把它签进一笔 VmOp。 */
export function sendToken(token: Uint8Array, to: Uint8Array, amount: bigint) {
  return ks20Transfer(token, to, amount);
}

/** 一笔操作的回执里这个代币自己的事件，按它的声明来解读。 */
export function tokenEvents(receipt: Receipt, token: Uint8Array, standards: string[]) {
  return receipt.events
    .filter((event) => equalBytes(event.contract, token))
    .flatMap((event) => decodeStandardEvent(standards, event.data) ?? []);
}
```

- **发现**：`readStandards` 返回合约的声明，先是标准，然后是它实现的扩展，比如 `KS-20-burnable` 或 `KS-721-enumerable`；合约什么都没声明时返回 `null`。`readKs20` 和 `readKs721` 一个视图接一个视图地读取其余信息，因为一个节点同一时间最多运行 4 个调用。
- **能力**：`capabilities` 列出代币的规则眼下允许某人做什么，顺序是 `mint`、`freeze`、`allowlist`、`pause`、`clawback`、`fee` 和 `upgrade`。带 `fee` 的代币，收款方收到的会少于发送的数额，发送方的余额则正好减少这个数额。
- **操作**：这些构建函数返回一个 `Call` 动作：`ks20Transfer`、`ks20TransferFrom`、`ks20Approve`、`ks20TransferAndCall` 等，NFT 则有 `ks721Transfer`、`ks721SetOperator` 等。数额为零、收款方是零账户或代币自己时，它们直接拒绝；这些情况每个代币在链上也会拒绝，但那时操作的手续费已经扣了。`ks20TransferAndCall` 在同一笔操作里把代币转进一个合约，并调用这个合约。`assetTransfer` 发送一个 `AssetRef` 指明的资产，内置资产和 KS-20 代币都可以。
- **授权**：`ks20Approve(token, spender, amount, expiresAt)` 设定一笔授权额度，在区块时间戳到达 `expiresAt`（以秒计）之前有效，为 `null` 时一直有效。需要多少就授权多少，并设个到期时间；`0n` 撤销这笔授权。
- **拒绝**：合约拒绝一个视图时抛出 `StandardCallError`，它的 `reason` 是 revert 原因：标准规定的某个固定英文短语，或者代币自己的规则给出的 `rejected: …`。
- **NFT ID**：KS-721 的代币 ID 是 32 个字节。`ks721TokenId(7n)` 是序号 7 的 ID，`ks721Serial` 把序号读回来；ID 存的是哈希时，它返回 `null`。

节点为两个标准的事件建了索引，有六个方法读取它：`getAccountAssets` 列出一个账户持有的一切，`getNfts` 列出它的 NFT，`getApprovals` 列出它给出的授权；`getToken`、`getTokenHolders` 和 `getContract` 描述一个合约。这些列表一页一页地返回：把 `after: page.next` 传进去，直到 `next` 为 `null`。

```typescript title="assets.ts"
import type { AccountAsset, KsanaRpcClient } from '@ksana/sdk';

/** 按节点的索引，列出一个账户持有的一切：先是内置资产，然后是 KS-20 代币和 KS-721 合集。 */
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

- **持有什么与持有多少**：索引告诉你一个账户持有什么，代币的视图告诉你持有多少：发送之前要先读 `ks20BalanceOf`。索引按批准时的数额列出授权额度，`ks20Allowance` 给出它还剩多少。
- **种类**：`AccountAsset` 可以是内置资产（`kind: 'asset'`）、KS-20 代币（`'token'`，带它的 `balance`）或者 KS-721 合集（`'nft'`，带持有的 NFT 个数 `count`）。授权可以是 `allowance`、`operator`，或者对单个 NFT 的授权（`'token'`）；它的 `expires_at` 是一个以秒计的区块时间戳，或者 `null`。
- **代币**：`getToken` 给出代币的标准、元数据、总量和持有者数；索引不得不略过它的某个事件之后，`irregular` 为 `true`。对两个标准都没有声明的合约，它和 `getTokenHolders` 抛出 `RpcError` -32004。
- **旧节点**：没有这份索引的节点会让这些方法抛出 `RpcError` -32601（`RPC_ERROR_CODES.METHOD_NOT_FOUND`）。

## 走路径 C 发送操作

路径 C 操作搭载在一笔由你的钱包签名并付费的比特币交易里，不需要任何 KSA。这笔交易在 signet 上有了 2 个确认、在主网上有了 5 个确认之后，出块者就必须收录它。[操作与手续费](/docs/submitting-ops/)一页讲解了这条路径，下面这个函数构建这笔交易：

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
 * 构建一笔路径 C 的 KSA 转账：操作搭载在一笔比特币交易里，由钱包签名并付费。
 * 返回待广播的原始交易和操作 ID。
 */
export async function nativeTransfer(
  rpc: KsanaRpcClient,
  params: Params,
  wallet: WalletAdapter,
  account: Uint8Array,
  utxos: Utxo[], // 账户已确认的币
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
    nonce: (await rpc.getAccount(account)).nonce, // 还要加上你仍在等待的路径 C 操作笔数
    fee: { kind: 'BtcNative' }, // 不付 KSA 手续费：由比特币交易付费
    max_gas: 10_000n, // 最多 params.native_max_gas
    action: { kind: 'AssetTransfer', asset: ksaAssetId(), to, amount },
  };
  // 签名覆盖交易的第一个输入，所以要在签名之前选定这枚币。
  const op = await signVmopWithWallet(unsigned, wallet, { firstInput: nativeFirstInput(first) });
  const draft = buildNativeTx({ op, utxos, changeScript: first.script, feeRate, params });
  const signed = await wallet.signPsbt(draft.psbt, draft.inputs.map((_, index) => ({ index })));
  return { raw: extractTransaction(signed), opId: opId(op) };
}
```

- **币**：SDK 不负责列出币，请从你自己的 bitcoind 或某个 Esplora API 获取账户已确认的币。一个 `Utxo` 包含按内部字节序书写的 txid（`txidFromRpc` 可以转换区块浏览器显示的 txid）、`vout`、以聪计的 `value`、`script`，以及钱包的 `tapInternalKey`。对账户自己的地址，脚本就是 `p2trScriptFromOutputKey(account)`。
- **交易**：输出 0 是一个 KSN1 `OP_RETURN`，里面装着操作；接着是 `payments`（如果有的话），最后是找零。只有 Taproot 密钥路径和 P2WPKH 的币可以花费。
- **广播**：用 bitcoind 的 `sendrawtransaction` 发送 `toHex(raw)`。Bitcoin Core 30 及以后的版本默认就会中继这么大的 `OP_RETURN`；更早的版本需要 `-datacarriersize=100000`。
- **跟踪**：在某个区块收录这笔操作之前，`getOpStatus` 都返回 -32004；`getAccount` 也不计入仍在等待的路径 C 操作。
- **gas**：`max_gas` 最多为 1,000,000，即 `params.native_max_gas`。

用密钥而不是钱包时，用 `signedVmop(unsigned, secretKey, undefined, nativeFirstInput(first))` 签署操作，用 `extractTransaction(signNativeTx(draft.psbt, secretKey))` 签署交易。

## 充值 KSA

充值是用比特币，从 [`ksa-exchange` 合约](/docs/example-contracts/#ksa-exchange)中某位卖方的锁定里买 KSA。一笔比特币交易既向锁定的收款脚本付款，又携带一个调用 `claim` 的路径 C 操作：

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
 * 为钱包自己的账户，买下 ksa-exchange 合约中锁定 `lockId` 仍持有的全部 KSA。
 * 返回待广播的原始交易、领取操作的 ID，以及这笔交易最晚要在哪个比特币高度确认。
 */
export async function topUp(
  rpc: KsanaRpcClient,
  wallet: WalletAdapter,
  utxos: Utxo[], // 钱包已确认的币
  exchange: Uint8Array,
  lockId: bigint,
  btcHeight: number, // 比特币链顶的高度，用于检查到期
  feeRate: number, // sat/vB
): Promise<{ raw: Uint8Array; opId: Uint8Array; payBy: number }> {
  const params = await rpc.getParams(SIGNET);
  const buyer = fromHex((await wallet.getAccount()).account, 32);
  const lock = await getLock(rpc, exchange, lockId);
  const { satsForAll } = quoteTopUp(lock, 0n); // 买下仍锁定的全部 KSA 所需的聪数
  const draft = buildTopUp({
    exchange,
    lockId,
    lock,
    beneficiary: buyer, // 不是锁定的受益账户就会被拒绝
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

- `getLock` 读取锁定。`quoteTopUp(lock, sats)` 给出 `sats` 聪能买到的 KSA，以及 `satsForAll`，即买下全部所需的聪数。
- `buildTopUp` 会拒绝受益账户不是买方的锁定、不处于开放状态的锁定，以及 3 个比特币区块之内就会到期的锁定（`expiryMargin`）。金额不等于 `satsForAll` 时它也会拒绝，除非你传入 `allowPartial` 或 `allowOverpay`。
- 领取操作由一把新生成的一次性密钥以 nonce 0 签名，所以不占用你账户的任何 nonce。
- 交易最晚必须在比特币高度 `payBy` 确认。过了这个高度，卖方的 `release` 就可能抢先执行。

## 查询索引器

```typescript title="indexer.ts"
import { IndexerRpcClient, KsanaRpcClient, equalBytes } from '@ksana/sdk';

const rpc = new KsanaRpcClient('{{signet.rpc}}', { timeoutMs: 30_000 });
const indexer = new IndexerRpcClient('{{signet.indexer}}', {
  timeoutMs: 30_000,
});

// 索引器只凭比特币重建状态；拿它的状态根与节点的区块比对。
const status = await indexer.status();
const { header } = await rpc.getBlock(status.height);
console.log(`indexer at ${status.height}, Bitcoin ${status.btc_height}, halted ${status.halted}`);
console.log('same state root as the node:', equalBytes(status.state_root, header.state_root));
```

```output
indexer at 51, Bitcoin 327291, halted null
same state root as the node: true
```

索引器只凭比特币重建 Ksana 的状态，所以状态根与节点的一致，就表明节点的状态正是从比特币上的数据推导出来的。它落后于节点，因为一个区块要有了 2 个确认或者已经最终，它才会执行这个区块。`stateRoot(id)` 给出它已核对过的某个区块的状态根，其余内容见[运行索引器](/docs/run-an-indexer/)。

::: note 从网页调用
在公开 signet 上，只有 `{{signet.rpc}}` 会应答来自其他来源的页面。`{{signet.indexer}}`、`{{signet.btc}}` 和 `{{signet.faucet}}` 应答的是服务器和 signet 自己的页面，所以要经由你自己的服务器访问它们。
:::

## 处理错误

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
  await rpc.getOpStatus(new Uint8Array(32)); // 没有哪笔操作的 ID 是这个
} catch (e) {
  if (!(e instanceof RpcError) || e.code !== RPC_ERROR_CODES.NOT_FOUND) throw e;
  console.log(e.code, e.message);
}

try {
  await rpc.getParams(MAINNET); // 节点在 signet 上
} catch (e) {
  if (!(e instanceof ChainMismatchError)) throw e;
  console.log(e.chainId, e.expected, e.message.split(':')[0]);
}
```

```output
-32004 ksana_getOpStatus: unknown op
1002 1000 the node is on signet (chain ID 1002), not mainnet (chain ID 1000)
```

| 错误 | 何时抛出 |
| --- | --- |
| `RpcError` | 节点以一个 JSON-RPC 错误作答：`code` 是它的错误码，消息以方法名开头 |
| `RpcTransportError` | 请求失败或超时，或者应答无法解析 |
| `ChainMismatchError` | 节点所在的网络不是你传入的那个 |
| `StandardCallError` | 合约拒绝了代币标准的某个视图：`reason` 是它的 revert 原因 |
| `Error`、`RangeError`、`TypeError` | 某个构建函数拒绝了它的输入，这时还什么都没有发出 |

`RPC_ERROR_CODES` 给 -32601、-32602、-32603、-32004、-32010 和 -32011 起了名字。它没有给 -32009 起名字，那是第五个并发的 `call` 得到的应答，所以要直接比较这个错误码。[JSON-RPC](/docs/rpc/#errors) 一页解释了每一个错误码。
