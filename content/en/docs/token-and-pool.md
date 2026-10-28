---
title: Tutorial: a token and a pool
nav: Token and pool tutorial
lede: Deploy the reference KS-20 token on the public signet, open a pool that trades it against KSA, add liquidity and swap both ways in one operation each, all with `ksana-cli`.
description: Deploy the token, amm and amm-factory example contracts on Ksana’s public signet with ksana-cli, then add liquidity and swap with KS-20’s transfer_and_call, with real commands and output.
---

In this tutorial you deploy three of the [example contracts](/docs/example-contracts/) and use them from the command line:

- `token`, the reference [KS-20](/docs/ks-20/) token, whose balances live in the contract’s own storage;
- `amm`, a constant-product pool with your token on one side and KSA on the other;
- `amm-factory`, a contract that creates pools at IDs you can compute in advance.

A KS-20 token pays a contract with `transfer_and_call`, which moves the tokens and calls the contract in the same operation, so every deposit and swap below is one operation, with nothing to approve.

Every command and output on this page comes from one run on 21 October 2026 on the public signet. Your IDs, hashes, heights and amounts will differ. Signet coins have no value, and mainnet has not launched: run this on the signet.

## Before you start

You need:

- `ksana-cli` on your `PATH`, built from the repository as in the [quickstart](/docs/quickstart/) ([ksana-cli](/docs/cli/) describes every command);
- the repository’s Rust toolchain with the `wasm32-unknown-unknown` target: `rustup toolchain install`, run inside the clone, installs both from `rust-toolchain.toml`;
- `bash`, `python3` and `jq`, for the helper functions below;
- about 51 KSA on the signet. The faucet’s 100 KSA is enough, and the liquidity you remove comes back to you.

Run every command from the root of your clone, in one `bash` session: later steps use the shell variables that earlier steps set. Each op costs a fee of 1 base unit here.

::: steps

### Build the contracts

The contracts are a separate Cargo workspace in `contracts/`. Build each one from inside that directory, as a `cdylib` alone, so that `contracts/.cargo/config.toml` applies and the module stays small:

```sh
cd contracts
for p in token amm amm-factory; do
  cargo rustc --release --locked --target wasm32-unknown-unknown --package $p --crate-type cdylib
done
cd ..
W=contracts/target/wasm32-unknown-unknown/release
wc -c $W/token.wasm $W/amm.wasm $W/amm_factory.wasm
```

```output
28720 contracts/target/wasm32-unknown-unknown/release/token.wasm
25427 contracts/target/wasm32-unknown-unknown/release/amm.wasm
 9598 contracts/target/wasm32-unknown-unknown/release/amm_factory.wasm
63745 total
```

The module bytes depend on the absolute path of your checkout, so your code hashes, and with them your contract IDs, differ from the ones below.

### Load the helpers

`ksana-cli` takes contract arguments as the hex of their Borsh encoding and does no encoding for you. Save these functions as `helpers.sh`:

```sh title="helpers.sh"
# Borsh values for --args and --init-args, contract IDs, and short receipts (python3, jq)
enc_u128() { python3 -c 'import sys; print(int(sys.argv[1]).to_bytes(16, "little").hex())' "$1"; }
enc_string() {
  python3 -c 'import sys; b = sys.argv[1].encode()
print(len(b).to_bytes(4, "little").hex() + b.hex())' "$1"
}
enc_bytes() {  # Bytes from hex: a u32 length, then the bytes
  python3 -c 'import sys; b = bytes.fromhex(sys.argv[1])
print(len(b).to_bytes(4, "little").hex() + b.hex())' "$1"
}
dec_u128() {  # one or more u128 values, back to back
  python3 -c 'import sys; b = bytes.fromhex(sys.argv[1])
print(*(int.from_bytes(b[i:i + 16], "little") for i in range(0, len(b), 16)))' "$1"
}
dec_answer() {  # the u128 a pool answers through transfer_and_call: Bytes, so skip its u32 length
  dec_u128 "${1:8}"
}
dec_strings() {  # a Vec<String>: a u32 count, then each string with its u32 length
  python3 -c 'import sys; b = bytes.fromhex(sys.argv[1]); i = 4; out = []
for _ in range(int.from_bytes(b[:4], "little")):
    n = int.from_bytes(b[i:i + 4], "little"); out.append(b[i + 4:i + 4 + n].decode()); i += 4 + n
print(*out)' "$1"
}
code_hash() {
  python3 -c 'import hashlib, sys
print(hashlib.sha256(open(sys.argv[1], "rb").read()).hexdigest())' "$1"
}
contract_id() {  # sha256(account + nonce as u64 little-endian + sha256(code))
  python3 -c 'import hashlib, sys
code = hashlib.sha256(open(sys.argv[3], "rb").read()).digest()
seed = bytes.fromhex(sys.argv[1]) + int(sys.argv[2]).to_bytes(8, "little") + code
print(hashlib.sha256(seed).hexdigest())' "$@"
}
brief() {  # the parts of a --wait result this tutorial reads
  jq '{nonce, op_id, status: .status.status, block: .status.block.height,
    gas_used: .status.receipt.gas_used, error: .status.receipt.error,
    output: .status.receipt.output}' "$@"
}
```

Load them, point the CLI at the signet node, and keep the ID of KSA (32 zero bytes) at hand:

```sh
source ./helpers.sh
export KSANA_RPC={{signet.rpc}}
KSA=0000000000000000000000000000000000000000000000000000000000000000
```

[How arguments are encoded](#encoding), below the steps, explains the bytes the helpers produce.

### Make a key and get KSA

Create a key file, keep your account in `ACCOUNT`, and send your address to the faucet:

```sh
ksana-cli --chain signet key alice.key
ACCOUNT=$(ksana-cli --chain signet key alice.key | jq -r .account)
curl -sS {{signet.faucet}} -H 'content-type: application/json' \
  --data '{"to": "tb1pklkarsaaegsk2dxgh4ug9tru6q6x63gge8emdeltt8fpxm6r7zwse04hlm"}' | jq
```

```output
{
  "account": "b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09d",
  "address": "tb1pklkarsaaegsk2dxgh4ug9tru6q6x63gge8emdeltt8fpxm6r7zwse04hlm",
  "internal_key": "e8ad3e8fc1e17bc0918445a0973c6111867e7236c025121d2215eb559ea78ccf",
  "script": "5120b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09d"
}
{
  "op_id": "a91054efcbde256b412d0d5286d922ce5377ac6a3ea0941a2eabe41cbaaf090e",
  "to": "b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09d",
  "amount": "10000000000",
  "nonce": "3"
}
```

Put your own `address` in the faucet request. The faucet sends 100 KSA (10,000,000,000 base units) once a day per account; `ksana-cli account @alice.key` shows the balance a few seconds later. If you already hold signet KSA, skip the faucet.

### Deploy the token

The token’s `init` takes `(name: String, symbol: String, decimals: u8, supply: u128, minter: Option<[u8; 32]>, cap: Option<u128>)` and gives the supply to the deployer. A minter could mint more up to the cap; `00` for each leaves both out, so the supply is fixed. This run creates 1,000,000 TUT with 8 decimals:

```sh
INIT=$(enc_string "Tutorial Token")$(enc_string TUT)08$(enc_u128 100000000000000)0000
echo $INIT
ksana-cli deploy --key alice.key --code $W/token.wasm --init-args $INIT \
  --fee-token 1 --wait | tee token.json | brief
```

```output
0e0000005475746f7269616c20546f6b656e030000005455540800407a10f35a000000000000000000000000
{
  "nonce": "0",
  "op_id": "6e5c44290d388596929b8b9e6f3250d99e0629e7beb1679e2952177144ff8150",
  "status": "fast_confirmed",
  "block": "31",
  "gas_used": "776169",
  "error": null,
  "output": ""
}
```

`--fee-token 1` sends the op through path B with a fee of 1 base unit, the default packing floor of a node, which the signet’s seed nodes keep. Run `ksana-cli estimate-fee` to see what your node suggests. `--wait` polls until a block includes the op: `fast_confirmed` is the first of its [three marks](/docs/confirmations/). The whole result, with the receipt’s events, stays in `token.json`.

### Find the token’s ID

Nothing reports a new contract’s ID: you compute it. It is the SHA-256 of your account, the nonce of the deploy op as a little-endian u64, and the SHA-256 of the code:

```sh
TOKEN=$(contract_id $ACCOUNT $(jq -r .nonce token.json) $W/token.wasm)
echo $TOKEN
jq -r '.status.receipt.events[0].contract' token.json
```

```output
6569e81e9aa68a0ae8058c3f749de4b0f13d2f3448f12831d8ccf0960c329658
6569e81e9aa68a0ae8058c3f749de4b0f13d2f3448f12831d8ccf0960c329658
```

The second line is a cross-check: the token’s `init` emits four events, `standards`, `metadata`, `minter` (none here) and the `transfer` of the supply, and every event names the contract that emitted it. Now read the token back. `query` runs a method on the node without submitting anything, so it costs no fee:

```sh
dec_strings $(ksana-cli query --contract $TOKEN --method standards | jq -r .output)
ksana-cli query --contract $TOKEN --method metadata
ksana-cli query --contract $TOKEN --method balance_of --args $ACCOUNT | jq -r .output
```

```output
KS-20 KS-20-burnable KS-20-mintable
{
  "asset_changes": [],
  "error": null,
  "events": [],
  "gas_used": "56186",
  "op_id": null,
  "output": "0e0000005475746f7269616c20546f6b656e0300000054555408",
  "success": true
}
00407a10f35a00000000000000000000
```

The first line is the token’s declaration: KS-20, and the two extensions the reference token implements. Then come `(name, symbol, decimals)` in Borsh and your balance, a u128: `dec_u128 00407a10f35a00000000000000000000` prints `100000000000000`, the whole supply.

### Deploy a pool

A pool’s `init` takes its two sides, each an [`AssetRef`](/docs/tokens/#asset-ref): one byte for its kind (`00` for a KS-20 token, `01` for a built-in asset such as KSA) followed by a 32-byte ID. Side A is your token and side B is KSA:

```sh
ksana-cli deploy --key alice.key --code $W/amm.wasm --init-args 00${TOKEN}01${KSA} \
  --fee-token 1 --wait | tee pool.json | brief
POOL=$(contract_id $ACCOUNT $(jq -r .nonce pool.json) $W/amm.wasm)
echo $POOL
```

```output
{
  "nonce": "1",
  "op_id": "b37ca78fd6d0d1a3434c505afd14b766f0a061e1a560b8800c7c050cf7218304",
  "status": "fast_confirmed",
  "block": "32",
  "gas_used": "672844",
  "error": null,
  "output": ""
}
eb5ca55289984d64598a12303a0638ee9dd6edc50f4bebe6d43a7a46121fc745
```

The pool’s methods take amounts in side order: TUT first, then KSA.

### Add liquidity

The token pays the pool: `transfer_and_call(to, amount, data)` moves `amount` of TUT to `to` and calls its `on_token_received` with `data`, in the same operation. For a pool, `data` holds a `PoolAction`: `01`, then `amount_other: u128` and `min_shares: u128`, deposits the tokens with up to `amount_other` of the other side, and `enc_bytes` puts the u32 length of `Bytes` in front. KSA is a built-in asset, so you attach it to the call with `--fund`, and the token passes it on to the pool. This deposit puts 100,000 TUT and 50 KSA into the pool:

```sh
ksana-cli call --key alice.key --contract $TOKEN --method transfer_and_call \
  --args $POOL$(enc_u128 10000000000000)$(enc_bytes 01$(enc_u128 5000000000)$(enc_u128 1)) \
  --fund 5000000000 --fee-token 1 --wait | tee add.json | brief
dec_answer $(jq -r .status.receipt.output add.json)
```

```output
{
  "nonce": "2",
  "op_id": "314c6927c5e955c040cf1b62018090bc46f42ab31b135cc8bb70afc27b6d033f",
  "status": "fast_confirmed",
  "block": "33",
  "gas_used": "214928",
  "error": null,
  "output": "10000000b5f50010340000000000000000000000"
}
223606797749
```

The op called the token, and its output is the pool’s answer, which the token returns unchanged: `Bytes`, a u32 length (`10000000`, 16) and then a u128, your number of pool shares, which `dec_answer` reads. The first deposit receives the integer square root of the product of the two amounts. A later deposit receives shares in proportion to the reserves; the pool takes only what the current ratio needs and sends the rest back.

`min_shares`, 1 here, makes the deposit fail below that many shares. You are the only one depositing, so 1 will do; in a pool that others trade in, set it a little below the shares a `query` of the same call returns. Both contracts left their events in the one receipt:

```sh
jq -c '.status.receipt.events[] | {contract, data}' add.json
```

```output
{"contract":"6569e81e9aa68a0ae8058c3f749de4b0f13d2f3448f12831d8ccf0960c329658","data":"080000007472616e73666572b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09deb5ca55289984d64598a12303a0638ee9dd6edc50f4bebe6d43a7a46121fc74500a0724e180900000000000000000000"}
{"contract":"eb5ca55289984d64598a12303a0638ee9dd6edc50f4bebe6d43a7a46121fc745","data":"0d0000006164645f6c6971756964697479b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09d00a0724e18090000000000000000000000f2052a010000000000000000000000b5f50010340000000000000000000000"}
```

Each event’s `data` starts with its name as a Borsh `String`, then its fields. The token’s `transfer` of 100,000 TUT from you to the pool comes first, then the pool’s `add_liquidity`, which names you as the provider, the two amounts and your shares.

### Quote a swap

The pool’s own `swap` takes `(id_in: [u8; 32], amount_in: u128, min_out: u128)` and keeps a fee of 0.3% for the pool. To see what a swap returns, run it as a `query` with the same funds attached, and with your account as the caller so that the simulated transfer has KSA to move:

```sh
QUOTE=$(ksana-cli query --contract $POOL --method swap \
  --args $KSA$(enc_u128 100000000)$(enc_u128 1) --fund 100000000 --caller $ACCOUNT \
  | jq -r .output)
dec_u128 $QUOTE
MIN_OUT=$(( $(dec_u128 $QUOTE) * 99 / 100 ))
echo $MIN_OUT
```

```output
195501696178
193546679216
```

At these reserves, 1 KSA buys about 1,955.02 TUT. `MIN_OUT` accepts up to 1% less, in case another trade moves the price before yours.

### Swap KSA for TUT

Send the same swap as an op, with `MIN_OUT` as the limit:

```sh
ksana-cli call --key alice.key --contract $POOL --method swap \
  --args $KSA$(enc_u128 100000000)$(enc_u128 $MIN_OUT) --fund 100000000 \
  --fee-token 1 --wait | tee swap1.json | brief
```

```output
{
  "nonce": "3",
  "op_id": "019c46f11df1d8097a2acefe942e78ab1c3c225617b132838ecf2c22ef286b0d",
  "status": "fast_confirmed",
  "block": "34",
  "gas_used": "169247",
  "error": null,
  "output": "b224cf842d0000000000000000000000"
}
```

The output is the TUT you received, 195,501,696,178 base units: nothing traded in between, so the quote was exact. Had the price moved past `MIN_OUT`, the op would have failed: a failed op keeps its fee and its nonce, and changes nothing else.

### Swap TUT for KSA

Selling TUT takes one `transfer_and_call` of the token, whose action is a swap: `00`, then `min_out: u128`. Quote it with a `query` of the same call, which answers what the pool would pay out:

```sh
QUOTE=$(ksana-cli query --contract $TOKEN --method transfer_and_call \
  --args $POOL$(enc_u128 100000000000)$(enc_bytes 00$(enc_u128 1)) --caller $ACCOUNT | jq -r .output)
echo $QUOTE
dec_answer $QUOTE
MIN_OUT=$(( $(dec_answer $QUOTE) * 99 / 100 ))
echo $MIN_OUT
```

```output
10000000525e0f03000000000000000000000000
51338834
50825445
```

Then swap:

```sh
ksana-cli call --key alice.key --contract $TOKEN --method transfer_and_call \
  --args $POOL$(enc_u128 100000000000)$(enc_bytes 00$(enc_u128 $MIN_OUT)) \
  --fee-token 1 --wait | tee swap2.json | brief
dec_answer $(jq -r .status.receipt.output swap2.json)
```

```output
{
  "nonce": "4",
  "op_id": "ea50a2fe329d5c76117afb8d3663971c71514a178db51daa73cb0b22b13a751c",
  "status": "fast_confirmed",
  "block": "35",
  "gas_used": "172426",
  "error": null,
  "output": "10000000525e0f03000000000000000000000000"
}
51338834
```

1,000 TUT bought 51,338,834 base units of KSA, about 0.513 KSA, in one op with nothing to approve. The pool’s `swap` and `add_liquidity` can still take a token side the old way, pulling it with the token’s `transfer_from` after you `approve` the pool, in two ops.

### Remove liquidity

`remove_liquidity` takes `(shares: u128, min_a: u128, min_b: u128)` and pays out that fraction of both reserves, rounded down; it fails when either amount falls below its minimum. Read your shares and remove half of them:

```sh
SHARES=$(dec_u128 $(ksana-cli query --contract $POOL --method shares_of --args $ACCOUNT | jq -r .output))
echo $SHARES
ksana-cli call --key alice.key --contract $POOL --method remove_liquidity \
  --args $(enc_u128 $(( SHARES / 2 )))$(enc_u128 1)$(enc_u128 1) --fee-token 1 --wait | tee remove.json | brief
dec_u128 $(jq -r .status.receipt.output remove.json)
```

```output
223606797749
{
  "nonce": "5",
  "op_id": "dfb53e962a874922cddff07f2c4fdeccc3aea2b5de555a6ca4db65c0b31b30b2",
  "status": "fast_confirmed",
  "block": "36",
  "gas_used": "195421",
  "error": null,
  "output": "90310d09810400000000000000000000563a7696000000000000000000000000"
}
4952249151888 2524330582
```

The output is `(u128, u128)`: 49,522.49151888 TUT and 25.24330582 KSA came back to your account.

### Create a pool with the factory

`amm-factory` creates pools with `create_contract`, which instantiates code already stored on chain: the pool you deployed above stored the `amm` code. The factory’s `init` takes the hash of that code:

```sh
ksana-cli deploy --key alice.key --code $W/amm_factory.wasm \
  --init-args $(code_hash $W/amm.wasm) --fee-token 1 --wait | tee factory.json | brief
FACTORY=$(contract_id $ACCOUNT $(jq -r .nonce factory.json) $W/amm_factory.wasm)
echo $FACTORY
```

```output
{
  "nonce": "6",
  "op_id": "98db7cf37f05452b4f988a54bc3c53589cf44b41daf2c19883a7b02f64fed625",
  "status": "fast_confirmed",
  "block": "37",
  "gas_used": "326178",
  "error": null,
  "output": ""
}
7ed0c04c348385122cc496d3c67ea4d1c9cc15fadcc66fe3f1fbf499304fd115
```

`create_pair` takes two sides, creates the pool, and returns its ID. `get_pair` finds it again, with the sides in either order, and returns a Borsh `Option`: `01` and the ID, or `00` when there is no such pool. The new pool’s `tokens` shows its sides:

```sh
ksana-cli call --key alice.key --contract $FACTORY --method create_pair \
  --args 00${TOKEN}01${KSA} --fee-token 1 --wait | tee pair.json | brief
PAIR=$(jq -r .status.receipt.output pair.json)
ksana-cli query --contract $FACTORY --method get_pair --args 01${KSA}00${TOKEN} | jq -r .output
ksana-cli query --contract $PAIR --method tokens | jq -r .output
```

```output
{
  "nonce": "7",
  "op_id": "797d9dc411ae59e79ce0aa8a369ec151f9416f7afb18569c0181fe81ebecc2e0",
  "status": "fast_confirmed",
  "block": "38",
  "gas_used": "243181",
  "error": null,
  "output": "2a220d0a8c6910fb557785daf4fdfed5eaea6f4690aeaedd9e0acb0ac008efb6"
}
012a220d0a8c6910fb557785daf4fdfed5eaea6f4690aeaedd9e0acb0ac008efb6
010000000000000000000000000000000000000000000000000000000000000000006569e81e9aa68a0ae8058c3f749de4b0f13d2f3448f12831d8ccf0960c329658
```

The factory sorts the two sides into one order, so each pair of sides gets one pool. KSA’s ID is all zeros, so in this pool side A is KSA and side B is TUT, as `tokens` shows: `01` and KSA’s ID, then `00` and your token’s. The new pool is empty and separate from the one you deployed yourself. Fund it the same way: whichever side the token is, `transfer_and_call` sends it, and `amount_other` is the KSA attached:

```sh
ksana-cli call --key alice.key --contract $TOKEN --method transfer_and_call \
  --args $PAIR$(enc_u128 1000000000000)$(enc_bytes 01$(enc_u128 500000000)$(enc_u128 1)) \
  --fund 500000000 --fee-token 1 --wait | tee pairadd.json | brief
dec_answer $(jq -r .status.receipt.output pairadd.json)
dec_u128 $(ksana-cli query --contract $PAIR --method reserves | jq -r .output)
```

```output
{
  "nonce": "8",
  "op_id": "85aa965def12e9cc329dc120f9fcabf2ad165b70731917fc47158e0b87b42f0d",
  "status": "fast_confirmed",
  "block": "39",
  "gas_used": "215556",
  "error": null,
  "output": "100000005ee5cc34050000000000000000000000"
}
22360679774
500000000 1000000000000
```

The reserves are in side order: 5 KSA, then 10,000 TUT.

### Follow an op to final

Your ops are fast-confirmed. Each one is on Bitcoin once a settlement carrying its block confirms on Bitcoin, and final once the Bitcoin block that gives that settlement its sixth confirmation, which decides the block final, has six confirmations of its own. Ask for the deploy op and for the settlement of its block, 31:

```sh
ksana-cli op $(jq -r .op_id token.json) | jq '{status, block: .block.height}'
ksana-cli settlement 31 | jq '{status, txid_rpc, confirmed, settled, btc_final}'
```

```output
{
  "status": "btc_final",
  "block": "31"
}
{
  "status": "confirmed",
  "txid_rpc": "5a4f1245b728011d71f732aab68fa34ccb5c6460fc5cc6166f9b7dfadb2f23d2",
  "confirmed": {
    "block": "c2d6d161fdef456778a3df4f2ffe65a4627ad100ccbd24122d78fd5006000000",
    "confirmations": 11,
    "height": 327281,
    "txid": "d2232fdbfa7d9b6f16c65cfc60645ccb4ca38fb6aa32f7711d0128b745124f5a"
  },
  "settled": true,
  "btc_final": true
}
```

The op was final about 48 minutes after its block, when the Bitcoin transaction carrying the block’s settlement had 11 confirmations: an op becomes `btc_final` five Bitcoin blocks after that transaction’s sixth confirmation. Signet blocks came about every 4 minutes during this run; at their usual 10 minutes, it takes about two hours after the block. `txid_rpc` is that transaction’s ID as explorers show it, while `confirmed.txid` and `confirmed.block` are in Bitcoin’s internal byte order. Your other ops follow as the settlements of their blocks get there. A failed op never shows `btc_final`: it stays `failed` even once its block is final.

:::

## How arguments are encoded {#encoding}

A method’s arguments are a Borsh tuple: the encodings of its parameters, back to back. A method with one parameter takes that parameter’s encoding, and a method with none takes empty bytes. Return values follow the same rules.

| Type | Borsh bytes | Helper or example |
| --- | --- | --- |
| `u8` | 1 byte | `08` |
| `u128` | 16 bytes, little-endian | `enc_u128 5000000000`, `dec_u128` |
| `String` | u32 length, little-endian, then UTF-8 | `enc_string TUT` gives `03000000545554` |
| `Bytes`, `Vec<u8>` | u32 length, little-endian, then the bytes | `enc_bytes`; `dec_answer` reads a u128 in it |
| `Vec<String>` | u32 count, little-endian, then each `String` | the output of `standards`, read by `dec_strings` |
| `[u8; 32]` | the 32 bytes, with no length | an account, a contract ID, `$KSA` |
| `Option<T>` | `00`, or `01` then `T` | the minter and the cap of `init`, the output of `get_pair` |
| `AssetRef` | `00` (KS-20 token) or `01` (built-in asset), then the ID | `00${TOKEN}`, `01${KSA}` |
| `PoolAction` | `00` then `min_out: u128` (a swap), or `01` then `amount_other: u128` and `min_shares: u128` (a deposit) | the `data` of `transfer_and_call` to a pool, in `Bytes` |

[Write a contract](/docs/contracts/) explains the conventions from the contract’s side.

## If something goes wrong

- **The status is `failed`.** `error` says why, for example `revert: output below min_out` when the price moved past your limit before your swap; quote again and send it again. A failed op still uses its nonce and pays its fee, and a `query` of the same call shows the error for nothing.
- **`revert: insufficient allowance`.** You gave the pool’s own `swap` or `add_liquidity` the TUT side, which the pool pulls with `transfer_from`. Send TUT with the token’s `transfer_and_call` instead, or `approve` the pool first.
- **`revert: unexpected attached funds`.** Funds went where nothing takes them, such as KSA attached to a swap of TUT. Attach KSA to a deposit, or to a swap that sells KSA.
- **`--wait` times out.** After 120 seconds (`--timeout`) the CLI prints only an error, without the op ID, although the op was sent. Run `ksana-cli account @alice.key`: when `nonce` has gone up, the op is in a block, and `ksana_getAccountOps` in the [JSON-RPC API](/docs/rpc/) lists it.
- **The node refuses the op.** It refuses a fee below its floor. The CLI takes the nonce from the account’s state, so a second op sent before the first is in a block gets the same nonce: the node refuses it, or, when its fee is higher, drops the first op for it. Send ops one at a time with `--wait`, as on this page.

## Next steps

::: cards
- [KS-20 tokens](/docs/ks-20/) The interface, rules and extensions of fungible tokens, and how to build one.
- [Example contracts](/docs/example-contracts/) Every method of the token, the pool and the factory, and the other examples.
- [Write a contract](/docs/contracts/) Start your own contract, test it, and deploy it.
- [TypeScript SDK](/docs/sdk/) Call the same contracts from a web app or a script.
:::
