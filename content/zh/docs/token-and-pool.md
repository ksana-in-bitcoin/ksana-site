---
title: 教程：代币与资金池
nav: 代币与资金池教程
lede: 在公开 signet 上部署参考 KS-20 代币，为它和 KSA 开一个资金池，添加流动性，再双向兑换，每一步都只用一笔操作，全程只用 `ksana-cli`。
description: 用 ksana-cli 在 Ksana 的公开 signet 上部署 token、amm 和 amm-factory 三个示例合约，再用 KS-20 的 transfer_and_call 添加流动性并兑换，附真实的命令和输出。
---

在本教程中，你会部署[示例合约](/docs/example-contracts/)中的三个，并在命令行里使用它们：

- `token`：参考 [KS-20](/docs/ks-20/) 代币，余额记在合约自己的存储里；
- `amm`：一个恒定乘积资金池，一侧是你的代币，另一侧是 KSA；
- `amm-factory`：一个创建资金池的合约，资金池的 ID 可以事先算出。

KS-20 代币用 `transfer_and_call` 向合约付款，它在同一笔操作里转移代币并调用那个合约，所以下面的每一次存入和兑换都只是一笔操作，不需要任何授权。

本页的每条命令和输出，都来自 2026 年 10 月 21 日在公开 signet 上的同一次运行。你得到的 ID、哈希、高度和数额都会不同。signet 上的币没有价值，主网也尚未上线：请在 signet 上运行。

## 开始之前

你需要：

- `ksana-cli`，按[快速上手](/docs/quickstart/)的做法从仓库构建，并放在 `PATH` 中（[ksana-cli](/docs/cli/) 一页讲解了每一条命令）；
- 仓库所用的 Rust 工具链，以及 `wasm32-unknown-unknown` 编译目标：在克隆目录里运行 `rustup toolchain install`，就会按 `rust-toolchain.toml` 把两者都装好；
- `bash`、`python3` 和 `jq`，下面的辅助函数要用到它们；
- signet 上约 51 KSA。水龙头给的 100 KSA 就够了，你移除的流动性会回到你手里。

所有命令都在你克隆的仓库根目录下、在同一个 `bash` 会话里运行：后面的步骤要用到前面步骤设置的 shell 变量。这里每笔操作的手续费是 1 个最小单位。

::: steps

### 构建合约

这些合约是 `contracts/` 里一个独立的 Cargo workspace。在这个目录里逐个构建，只产出 `cdylib`，这样 `contracts/.cargo/config.toml` 才会生效，模块也能保持小巧：

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

模块的字节取决于你检出目录的绝对路径，所以你的代码哈希会和下面的不同，合约 ID 也随之不同。

### 载入辅助函数

`ksana-cli` 接受的合约参数是其 Borsh 编码的十六进制，它不会替你做任何编码。把下面这些函数存为 `helpers.sh`：

```sh title="helpers.sh"
# 给 --args 和 --init-args 用的 Borsh 值、合约 ID，以及精简的回执（python3、jq）
enc_u128() { python3 -c 'import sys; print(int(sys.argv[1]).to_bytes(16, "little").hex())' "$1"; }
enc_string() {
  python3 -c 'import sys; b = sys.argv[1].encode()
print(len(b).to_bytes(4, "little").hex() + b.hex())' "$1"
}
enc_bytes() {  # 由十六进制得到 Bytes：u32 长度，然后是这些字节
  python3 -c 'import sys; b = bytes.fromhex(sys.argv[1])
print(len(b).to_bytes(4, "little").hex() + b.hex())' "$1"
}
dec_u128() {  # 一个或多个依次相连的 u128 值
  python3 -c 'import sys; b = bytes.fromhex(sys.argv[1])
print(*(int.from_bytes(b[i:i + 16], "little") for i in range(0, len(b), 16)))' "$1"
}
dec_answer() {  # 资金池通过 transfer_and_call 回答的 u128：它在 Bytes 里，所以跳过 u32 长度
  dec_u128 "${1:8}"
}
dec_strings() {  # Vec<String>：u32 个数，然后是各个字符串，每个前面是它的 u32 长度
  python3 -c 'import sys; b = bytes.fromhex(sys.argv[1]); i = 4; out = []
for _ in range(int.from_bytes(b[:4], "little")):
    n = int.from_bytes(b[i:i + 4], "little"); out.append(b[i + 4:i + 4 + n].decode()); i += 4 + n
print(*out)' "$1"
}
code_hash() {
  python3 -c 'import hashlib, sys
print(hashlib.sha256(open(sys.argv[1], "rb").read()).hexdigest())' "$1"
}
contract_id() {  # sha256(账户 + 写成小端 u64 的 nonce + sha256(代码))
  python3 -c 'import hashlib, sys
code = hashlib.sha256(open(sys.argv[3], "rb").read()).digest()
seed = bytes.fromhex(sys.argv[1]) + int(sys.argv[2]).to_bytes(8, "little") + code
print(hashlib.sha256(seed).hexdigest())' "$@"
}
brief() {  # --wait 结果中本教程要读的部分
  jq '{nonce, op_id, status: .status.status, block: .status.block.height,
    gas_used: .status.receipt.gas_used, error: .status.receipt.error,
    output: .status.receipt.output}' "$@"
}
```

载入这些函数，让 CLI 指向 signet 节点，再把 KSA 的 ID（32 个零字节）放在手边：

```sh
source ./helpers.sh
export KSANA_RPC={{signet.rpc}}
KSA=0000000000000000000000000000000000000000000000000000000000000000
```

步骤之后的[参数如何编码](#encoding)一节，解释了这些辅助函数生成的字节。

### 生成密钥并领取 KSA

创建一个密钥文件，把你的账户存进 `ACCOUNT`，再把你的地址发给水龙头：

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

向水龙头申请时，请填上你自己的 `address`。水龙头每天给每个账户发一次 100 KSA（10,000,000,000 个最小单位）；几秒钟后，`ksana-cli account @alice.key` 就会显示这笔余额。如果你手上已有 signet KSA，就跳过水龙头。

### 部署代币

代币的 `init` 接受 `(name: String, symbol: String, decimals: u8, supply: u128, minter: Option<[u8; 32]>, cap: Option<u128>)`，并把总量全部发给部署者。增发者可以在上限以内增发更多；两者都给 `00` 就是都不设，总量因此固定。这次运行创建 1,000,000 TUT，有 8 位小数：

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

`--fee-token 1` 让操作走路径 B，手续费为 1 个最小单位，这是节点默认的打包门槛，signet 的种子节点也沿用这个值。运行 `ksana-cli estimate-fee`，可以看到你的节点建议多少。`--wait` 会一直轮询，直到有区块收录这笔操作：`fast_confirmed` 是它的[三道印记](/docs/confirmations/)中的第一道。完整的结果连同回执里的事件，都保存在 `token.json` 中。

### 算出代币的 ID

没有哪个地方会报告新合约的 ID：要你自己算。它是你的账户、部署操作的 nonce（写成小端 u64）和代码的 SHA-256 三者的 SHA-256：

```sh
TOKEN=$(contract_id $ACCOUNT $(jq -r .nonce token.json) $W/token.wasm)
echo $TOKEN
jq -r '.status.receipt.events[0].contract' token.json
```

```output
6569e81e9aa68a0ae8058c3f749de4b0f13d2f3448f12831d8ccf0960c329658
6569e81e9aa68a0ae8058c3f749de4b0f13d2f3448f12831d8ccf0960c329658
```

第二行用来交叉核对：代币的 `init` 会发出四个事件，`standards`、`metadata`、`minter`（这里没有增发者）和总量的 `transfer`，而每个事件都写明了发出它的合约。现在把这个代币读回来。`query` 在节点上运行一个方法，不提交任何东西，所以不花手续费：

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

第一行是代币的声明：KS-20，以及参考代币实现的两个扩展。接下来是 Borsh 编码的 `(name, symbol, decimals)` 和你的余额，余额是一个 u128：`dec_u128 00407a10f35a00000000000000000000` 打印出 `100000000000000`，正是全部总量。

### 部署资金池

资金池的 `init` 接受它的两侧，每一侧是一个 [`AssetRef`](/docs/tokens/#asset-ref)：先是表示种类的一个字节（`00` 表示 KS-20 代币，`01` 表示 KSA 这样的内置资产），后接 32 字节的 ID。A 侧是你的代币，B 侧是 KSA：

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

资金池的方法按两侧的顺序接受数额：先 TUT，后 KSA。

### 添加流动性

由代币向资金池付款：`transfer_and_call(to, amount, data)` 把 `amount` 的 TUT 转给 `to`，并在同一笔操作里带着 `data` 调用它的 `on_token_received`。对资金池来说，`data` 装的是一个 `PoolAction`：`01` 后接 `amount_other: u128` 和 `min_shares: u128`，表示把收到的代币连同至多 `amount_other` 的另一侧一起存入；`enc_bytes` 在它前面加上 `Bytes` 的 u32 长度。KSA 是内置资产，所以要用 `--fund` 把它附带在调用上，代币会把它转交给资金池。这次存入把 100,000 TUT 和 50 KSA 放进资金池：

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

这笔操作调用的是代币，它的输出是资金池的回答，由代币原样返回：一个 `Bytes`，先是 u32 长度（`10000000`，即 16），然后是一个 u128，即你得到的资金池份额数，`dec_answer` 读出的就是它。第一笔存入得到的份额，是两个数额乘积的整数平方根。之后的存入按储备的比例得到份额；资金池只收下当前比例所需的数额，多出的部分会退回。

`min_shares`（这里是 1）让存入在份额低于这个数时失败。这里只有你在存入，所以 1 就够了；在别人也在交易的资金池里，要把它设得比同一个调用用 `query` 得到的份额略低。两个合约的事件都留在同一张回执里：

```sh
jq -c '.status.receipt.events[] | {contract, data}' add.json
```

```output
{"contract":"6569e81e9aa68a0ae8058c3f749de4b0f13d2f3448f12831d8ccf0960c329658","data":"080000007472616e73666572b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09deb5ca55289984d64598a12303a0638ee9dd6edc50f4bebe6d43a7a46121fc74500a0724e180900000000000000000000"}
{"contract":"eb5ca55289984d64598a12303a0638ee9dd6edc50f4bebe6d43a7a46121fc745","data":"0d0000006164645f6c6971756964697479b7edd1c3bdca216534c8bd7882ac7cd0346d4508c9f3b6e7eb59d2136f43f09d00a0724e18090000000000000000000000f2052a010000000000000000000000b5f50010340000000000000000000000"}
```

每个事件的 `data` 先是它的名字（一个 Borsh `String`），然后是它的各个字段。排在前面的是代币的 `transfer`，100,000 TUT 从你转给资金池；然后是资金池的 `add_liquidity`，写明提供者是你，以及两个数额和你的份额。

### 查询兑换报价

资金池自己的 `swap` 接受 `(id_in: [u8; 32], amount_in: u128, min_out: u128)`，并为资金池留下 0.3% 的手续费。要看一次兑换会返回多少，就用 `query` 运行它，附带同样的资产，并以你的账户作为调用者，这样模拟的转账才有 KSA 可转：

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

按目前的储备，1 KSA 大约能买到 1,955.02 TUT。`MIN_OUT` 容许最多少换 1%，以防另一笔交易抢在你之前推动了价格。

### 用 KSA 换 TUT

把同样的兑换作为操作发出，以 `MIN_OUT` 作为下限：

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

输出是你换到的 TUT，195,501,696,178 个最小单位：这期间没有别的交易，所以报价完全准确。假如价格的变动越过了 `MIN_OUT`，这笔操作就会失败：失败的操作照样付手续费、用掉 nonce，除此之外什么也不改变。

### 用 TUT 换 KSA

卖出 TUT 只要代币的一次 `transfer_and_call`，它的动作是兑换：`00` 后接 `min_out: u128`。先用 `query` 运行同一个调用来询价，它回答资金池会付出多少：

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

然后兑换：

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

1,000 TUT 换到了 51,338,834 个最小单位的 KSA，约 0.513 KSA，只用了一笔操作，无需任何授权。资金池的 `swap` 和 `add_liquidity` 仍然可以按老办法接受代币一侧：你先 `approve` 资金池，它再用代币的 `transfer_from` 拉取，一共两笔操作。

### 移除流动性

`remove_liquidity` 接受 `(shares: u128, min_a: u128, min_b: u128)`，按这些份额所占的比例付出两侧的储备，向下取整；任一数额低于它的下限时就失败。读出你的份额，然后移除其中一半：

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

输出是 `(u128, u128)`：49,522.49151888 TUT 和 25.24330582 KSA 回到了你的账户。

### 用工厂合约创建资金池

`amm-factory` 用 `create_contract` 创建资金池，后者用链上已经存有的代码实例化新合约：你在上面部署的资金池，已经把 `amm` 的代码存到了链上。工厂合约的 `init` 接受这份代码的哈希：

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

`create_pair` 接受两侧，创建资金池，并返回它的 ID。`get_pair` 能再找到它，两侧按哪种顺序给都行；它返回一个 Borsh `Option`：`01` 加上 ID，没有这样的资金池时为 `00`。新资金池的 `tokens` 显示它的两侧：

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

工厂合约把两侧排成同一种顺序，所以同样的两侧只对应一个资金池。KSA 的 ID 全是零，所以在这个资金池里，A 侧是 KSA，B 侧是 TUT，正如 `tokens` 所示：先是 `01` 和 KSA 的 ID，然后是 `00` 和你的代币的 ID。新资金池是空的，与你自己部署的那个互不相干。用同样的办法为它注资：不管代币在哪一侧，都由 `transfer_and_call` 送来，`amount_other` 就是附带的 KSA：

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

储备按两侧的顺序排列：先是 5 KSA，然后是 10,000 TUT。

### 跟踪一笔操作到最终

你的操作都已快轨确认。一旦携带某笔操作所在区块的结算在比特币上得到确认，这笔操作就已写入比特币；让这笔结算得到第 6 个确认的那个比特币区块判定该区块为最终，等这个比特币区块自己也有了 6 个确认，操作就是最终的。查询部署操作，以及它所在区块 31 的结算：

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

这笔操作在它的区块产出约 48 分钟后成为最终，那时携带该区块结算的比特币交易已有 11 个确认：一笔操作在这笔交易的第 6 个确认之后再过 5 个比特币区块变为 `btc_final`。这次运行期间，signet 大约每 4 分钟出一个块；按平常的每 10 分钟一个块，大约要在它的区块产出两小时之后。`txid_rpc` 是这笔交易在区块浏览器里显示的 ID；`confirmed.txid` 和 `confirmed.block` 则按比特币的内部字节序书写。随着各自区块的结算走到这一步，你的其他操作也会相继变为最终；失败的操作永远不会显示 `btc_final`：即使它的区块已经最终，它的状态也一直是 `failed`。

:::

## 参数如何编码 {#encoding}

方法的参数是一个 Borsh 元组：各个参数的编码依次紧挨着排列。只有一个参数的方法，接受的就是这个参数的编码；没有参数的方法，接受空的字节。返回值遵循同样的规则。

| 类型 | Borsh 字节 | 辅助函数或示例 |
| --- | --- | --- |
| `u8` | 1 字节 | `08` |
| `u128` | 16 字节，小端 | `enc_u128 5000000000`、`dec_u128` |
| `String` | u32 长度（小端），然后是 UTF-8 | `enc_string TUT` 得到 `03000000545554` |
| `Bytes`、`Vec<u8>` | u32 长度（小端），然后是这些字节 | `enc_bytes`；`dec_answer` 读出其中的 u128 |
| `Vec<String>` | u32 个数（小端），然后是各个 `String` | `standards` 的输出，由 `dec_strings` 读出 |
| `[u8; 32]` | 这 32 个字节本身，不带长度 | 账户、合约 ID、`$KSA` |
| `Option<T>` | `00`，或 `01` 后接 `T` | `init` 的增发者和上限、`get_pair` 的输出 |
| `AssetRef` | `00`（KS-20 代币）或 `01`（内置资产），后接 ID | `00${TOKEN}`、`01${KSA}` |
| `PoolAction` | `00` 后接 `min_out: u128`（兑换），或 `01` 后接 `amount_other: u128` 和 `min_shares: u128`（存入） | 发给资金池的 `transfer_and_call` 的 `data`，放在 `Bytes` 里 |

[编写合约](/docs/contracts/)从合约的角度讲解这些约定。

## 出了问题时

- **状态是 `failed`**。`error` 会说明原因，比如价格在你兑换之前越过了你的下限时，它是 `revert: output below min_out`；重新询价，再发一次。失败的操作仍会用掉它的 nonce，并支付手续费；用 `query` 运行同一个调用，不花钱就能看到这个错误。
- **`revert: insufficient allowance`**。你把 TUT 一侧交给了资金池自己的 `swap` 或 `add_liquidity`，资金池要用 `transfer_from` 拉取它。改用代币的 `transfer_and_call` 发送 TUT，或者先 `approve` 资金池。
- **`revert: unexpected attached funds`**。资金附带到了没有人接收的地方，比如在卖出 TUT 的兑换上附带了 KSA。只在存入时，或在卖出 KSA 的兑换上附带 KSA。
- **`--wait` 超时**。等满 120 秒（`--timeout`）后，CLI 只打印一条错误，不带操作 ID，尽管操作已经发出。运行 `ksana-cli account @alice.key`：如果 `nonce` 增加了，操作就已在区块里，[JSON-RPC API](/docs/rpc/) 中的 `ksana_getAccountOps` 会列出它。
- **节点拒收操作**。手续费低于节点的门槛时，节点会拒收。CLI 从账户的状态读取 nonce，所以在第一笔操作进入区块之前发出的第二笔，会拿到同一个 nonce：节点要么拒收它，要么在它的手续费更高时，丢弃第一笔、换成它。像本页这样，用 `--wait` 一次只发一笔操作。

## 下一步

::: cards
- [KS-20 代币](/docs/ks-20/) 同质化代币的接口、规则和扩展，以及怎样构建一个。
- [示例合约](/docs/example-contracts/) 代币、资金池和工厂合约的每一个方法，以及其他示例。
- [编写合约](/docs/contracts/) 开始写你自己的合约，测试它，再部署它。
- [TypeScript SDK](/docs/sdk/) 在网页应用或脚本里调用同样的合约。
:::
