---
title: 合约中的比特币
lede: 合约能读取比特币区块头，能凭一份证明核实某笔比特币交易向某个脚本付了款，还能读取携带当前这笔操作的那笔比特币交易。
description: Ksana 合约怎样读取比特币区块头、怎样用 Merkle 证明核验付款、怎样为路径 C 操作使用 native_tx，附经过测试的 Rust 代码。
---

每个 Ksana 区块都锚定在一个比特币区块上，每个节点都对照截至这个锚定块的比特币链来执行它。合约通过三个宿主函数共享这份比特币视图：

| 函数 | 返回 | gas |
| --- | --- | --- |
| `btc_anchor_height()` | 执行这笔操作的区块所锚定的比特币高度 | 100 |
| `btc_header(height)` | 比锚定块至少低 6 个区块的某个比特币区块的 80 字节区块头 | 2,000 |
| `native_tx()` | 对路径 C 操作而言，是携带它的那笔比特币交易 | 2,000 + 每字节 1 |

除此之外，合约看不到比特币的任何东西：不能按 ID 读取交易，也看不到地址或余额。要用到其他任何交易，得由调用者连同 Merkle 证明一起传进来，再由合约对照区块头检查这份证明。SDK 的 `btc` 模块负责解析区块头和交易，并检查这些证明。本页的合约代码都以 `use ksana_contract_sdk::{self as sdk, btc, storage};` 开头，和[编写合约](/docs/contracts/)里一样。

## 合约能看到什么 {#depth}

出块者把每个区块锚定在它所看到的比特币链顶之下 `ANCHOR_DEPTH` 个区块处：devnet 上为 0，signet 上为 1，主网上为 2。合约能读取的区块头，至少要比这个锚定块低 `BTC_QUERY_DEPTH` 个区块，而 `BTC_QUERY_DEPTH` 在每个网络上都是 6。所以，一个比特币区块要有 7 + `ANCHOR_DEPTH` 个确认，它的区块头才能读取：signet 上为 8 个，主网上为 9 个；出块者看到的比特币落后时，还要更多。

对深度不够的区块，`btc_header` 会 trap，操作随之失败，错误为 `insufficient BTC block header depth`。请先检查深度，由你的合约决定接下来怎么办；这里它带着自己的原因 revert：

```rust
/// 合约读取的 BTC 区块头至少要比锚定块低这么多个区块：每个网络上都是 6。
const BTC_QUERY_DEPTH: u32 = 6;

/// BTC 区块 `height` 的区块头；深度还不够、读不了时 revert。
pub fn header_at(height: u32) -> Result<btc::BlockHeader, Vec<u8>> {
    // 区块太浅时 btc_header 会 trap，所以先检查，再带着原因 revert
    let deepest = sdk::btc_anchor_height().checked_sub(BTC_QUERY_DEPTH);
    if deepest.is_none_or(|deepest| height > deepest) {
        return Err(b"the block is not deep enough yet".to_vec());
    }
    btc::BlockHeader::parse(&sdk::btc_header(height)).ok_or(b"malformed header".to_vec())
}
```

区块头来自节点自己所见的锚定链，所以合约不需要检查工作量证明。`BlockHeader` 有 `version`、`prev_blockhash`、`merkle_root`、`time`、`bits` 和 `nonce` 这几个字段，`block_hash()` 计算它的哈希。

::: warning 字节序
合约看到的 txid、区块哈希和 Merkle 分支，都按比特币的内部字节序排列。区块浏览器和 bitcoind 的 RPC 显示 txid 和区块哈希时，顺序是反过来的。从区块浏览器复制来的 txid，要先反转过来，再与合约算出的 txid 比较。
:::

## 证明一笔付款 {#proof}

要向合约证明一笔比特币交易付款给了某个脚本，调用者需要传入：

- 包含这笔交易的区块的高度；
- 这笔交易，序列化时不带见证数据（去掉隔离见证交易的 marker、flag 和见证）；
- 它在区块中的位置，以及它的 Merkle 分支，从叶子往上；
- 这个区块的 coinbase 交易（同样不带见证数据），以及 coinbase 的 Merkle 分支。

比特币的 Merkle 树有两种已知的伪造手法，`btc::verify_tx_inclusion` 把两种都挡住了。它拒绝恰好 64 字节的交易，这样树的内部节点就无法冒充交易。coinbase 的证明固定了树的深度：coinbase 总是第一笔交易，而待证明交易的分支必须和 coinbase 的一样长。因此，伪造的交易没法挂在一笔真实的 64 字节交易下面。

```rust
/// 一笔交易，以及把它定位到某个 BTC 区块里的 Merkle 证明。
pub struct Proof<'a> {
    /// BTC 区块的高度。
    pub height: u32,
    /// 这笔交易，序列化时不带见证数据。
    pub raw_tx: &'a [u8],
    /// 它在区块中的位置。
    pub index: u32,
    /// 它的 Merkle 分支，从叶子往上。
    pub branch: &'a [[u8; 32]],
    /// 这个区块的 coinbase 交易，不带见证数据。
    pub coinbase_tx: &'a [u8],
    /// coinbase 的 Merkle 分支：与 `branch` 一样长。
    pub coinbase_branch: &'a [[u8; 32]],
}

/// 检查已证明交易的输出 `vout` 付款给 `script`；返回 txid 和聪数。
pub fn proven_payment(
    proof: &Proof<'_>,
    vout: u32,
    script: &[u8],
) -> Result<([u8; 32], u64), Vec<u8>> {
    let header = header_at(proof.height)?;
    let txid = btc::verify_tx_inclusion(
        &header,
        proof.raw_tx,
        proof.index,
        proof.branch,
        proof.coinbase_tx,
        proof.coinbase_branch,
    )
    .ok_or(b"the transaction is not in that block".to_vec())?;
    let outputs = btc::parse_outputs(proof.raw_tx).ok_or(b"malformed transaction".to_vec())?;
    let output = usize::try_from(vout)
        .ok()
        .and_then(|i| outputs.get(i))
        .ok_or(b"no such output".to_vec())?;
    if output.script_pubkey != script {
        return Err(b"the output pays another script".to_vec());
    }
    Ok((txid, output.value))
}
```

位置并不能确定是哪一笔交易。树的某一层节点数为奇数时，比特币把最后一个节点和它自己配对，所以区块最后的几笔交易，在超出末尾的位置上也能通过验证。防重放要以 txid 和输出为键，绝不能以位置为键：

```rust
/// 把输出 (txid, vout) 标记为已使用；第二次领取同一个输出会 revert。
pub fn use_once(txid: &[u8; 32], vout: u32) -> Result<(), Vec<u8>> {
    let key = [b"used".as_slice(), txid, &vout.to_le_bytes()].concat();
    if storage::get(&key).is_some() {
        return Err(b"already claimed".to_vec());
    }
    storage::set(&key, &[1]);
    Ok(())
}
```

证明并不说明谁可以使用这笔付款：任何在比特币上看到这笔交易的人，包括出块者，都可能抢先提交它。示例 `btc-payment-trigger` 要求付款交易用一个 `OP_RETURN <32-byte account>` 输出承诺受益账户，所以以其他任何人为受益账户的领取都会失败。整份证明都随操作一起传递，而一笔操作最多 65,536 字节，所以非常大的交易没法用这种方式证明。

### 构造证明

你的应用要用整个区块来构造证明。signet 的公开比特币接口不提供区块，所以请用 `bitcoin-cli -signet getblock <hash> 0` 从你自己的 bitcoind 读取区块，它会以十六进制打印出来。下面这些函数用到 [rust-bitcoin](https://crates.io/crates/bitcoin) 这个 crate：

```toml
[dependencies]
bitcoin = "0.32"
borsh = "1"
hex = "0.4"
```

```rust title="src/lib.rs"
//! 用从 bitcoind 读到的区块，构造 `btc::verify_tx_inclusion` 所检查的证明。
use bitcoin::consensus::serialize;
use bitcoin::hashes::{sha256d, Hash};
use bitcoin::{Block, Transaction};

/// 证明中把一笔交易定位到它所在区块的那几部分。
pub struct InclusionProof {
    /// 这笔交易，不带见证数据。
    pub raw_tx: Vec<u8>,
    /// 它的 Merkle 分支，从叶子往上。
    pub branch: Vec<[u8; 32]>,
    /// 这个区块的 coinbase 交易，不带见证数据。
    pub coinbase_tx: Vec<u8>,
    /// coinbase 的 Merkle 分支。
    pub coinbase_branch: Vec<[u8; 32]>,
}

/// 不带见证数据的交易：也就是它的 txid 所哈希的那些字节。
pub fn without_witness(tx: &Transaction) -> Vec<u8> {
    let mut stripped = tx.clone();
    for input in &mut stripped.input {
        input.witness.clear();
    }
    serialize(&stripped)
}

/// 第 `index` 笔交易的 Merkle 分支，从叶子往上，按内部字节序。
pub fn merkle_branch(txids: &[[u8; 32]], mut index: usize) -> Vec<[u8; 32]> {
    let mut level = txids.to_vec();
    let mut branch = Vec::new();
    while level.len() > 1 {
        if level.len() % 2 == 1 {
            level.push(level[level.len() - 1]); // 节点数为奇数的一层，把最后一个节点和它自己配对
        }
        branch.push(level[index ^ 1]);
        level = level
            .chunks(2)
            .map(|pair| sha256d::Hash::hash(&[pair[0], pair[1]].concat()).to_byte_array())
            .collect();
        index /= 2;
    }
    branch
}

/// `block` 中第 `index` 笔交易的证明。
pub fn inclusion_proof(block: &Block, index: usize) -> InclusionProof {
    let txids: Vec<[u8; 32]> = block
        .txdata
        .iter()
        .map(|tx| tx.compute_txid().to_byte_array())
        .collect();
    InclusionProof {
        raw_tx: without_witness(&block.txdata[index]),
        branch: merkle_branch(&txids, index),
        coinbase_tx: without_witness(&block.txdata[0]),
        coinbase_branch: merkle_branch(&txids, 0),
    }
}

/// 示例 btc-payment-trigger 中 `claim` 的 Borsh 参数，写成十六进制，供 `--args` 使用。
pub fn claim_args(
    block: &Block,
    height: u32,
    index: usize,
    vout: u32,
    beneficiary: [u8; 32],
) -> String {
    let p = inclusion_proof(block, index);
    let index = u32::try_from(index).expect("a block holds fewer than 2^32 transactions");
    let args = (
        height,
        p.raw_tx,
        index,
        p.branch,
        p.coinbase_tx,
        p.coinbase_branch,
        vout,
        beneficiary,
    );
    hex::encode(borsh::to_vec(&args).expect("encoding plain values cannot fail"))
}
```

用 `bitcoin::consensus::encode::deserialize_hex::<Block>(hex.trim())` 解码这段十六进制。rust-bitcoin 的 `to_byte_array()` 给出内部字节序的哈希，也就是合约使用的顺序；`to_string()` 给出区块浏览器所显示的反向顺序。`claim_args` 生成的，就是用 [ksana-cli](/docs/cli/) 调用示例 `btc-payment-trigger` 时的 `--args`。

## 读取操作自己的交易 {#native-tx}

路径 C 操作放在一笔比特币交易的 KSN1 数据输出里传递。这笔交易有了 `NATIVE_CONFIRMATIONS` + `ANCHOR_DEPTH` 个确认之后，每个出块者都必须收录这笔操作：signet 上为 2 个，主网上为 5 个。操作的签名覆盖这笔交易的第一个输入，所以把这笔操作复制到另一笔交易里，副本通不过认证。操作运行期间，`native_tx()` 返回这笔交易的 txid 和它的全部输出，KSN1 输出也在内；对路径 B 操作，以及在只读调用（RPC 方法 `ksana_call`）里，它返回 `None`。

这样，一笔比特币交易就能既付款，又请合约根据这笔付款行事，不需要构造任何证明。下面这个函数把这笔交易付给某个脚本的金额加起来：

```rust
/// 携带这笔操作的 BTC 交易付给 `script` 的聪数，以及它的 txid。
pub fn paid_by_this_op(script: &[u8]) -> Result<([u8; 32], u64), Vec<u8>> {
    let tx = sdk::native_tx().ok_or(b"send this op through path C".to_vec())?;
    let mut paid = 0u64;
    for output in tx.outputs.iter().filter(|o| o.script == script) {
        paid = paid.checked_add(output.value).ok_or(b"overflow".to_vec())?;
    }
    Ok((tx.txid, paid))
}
```

这笔操作的每一层读到的都是同一笔交易：对其他合约的调用、`try_call`、`delegate_call`，以及被创建合约的 `init`。一个合约如果在一笔路径 C 操作里被调用两次，就会两次看到这笔付款，所以每入账一笔，都要记下它的 txid。路径 C 操作的 `max_gas` 不能超过 1,000,000：超过的话，操作会用掉它的 nonce，并且失败。

[操作与手续费](/docs/submitting-ops/)讲解怎样发送路径 C 操作，[TypeScript SDK](/docs/sdk/) 能为浏览器钱包构造这笔交易。

## 在本机测试

在本机测试中，SDK 的模拟宿主扮演锚定链。`mock::set_btc_header` 存入一个区块头，`mock::set_btc_anchor_height` 移动锚定高度。`mock::set_native_tx` 设置携带操作的交易，默认值 `None` 表示路径 B 操作。`mock::with_context(caller, contract, f)` 运行 `f`，就像 `contract` 正在执行一次来自 `caller` 的调用：

```rust title="tests/path_c.rs"
//! 路径 C 付款检查的本机测试，在模拟宿主上运行。
#![cfg(not(target_arch = "wasm32"))]

use ksana_contract_sdk::{mock, NativeOutput, NativeTx};

const ALICE: [u8; 32] = [0xa1; 32];
const CONTRACT: [u8; 32] = [0xc0; 32];

#[test]
fn counts_what_the_carrying_transaction_pays() {
    mock::reset();
    let script = [&[0x51, 0x20][..], &[7; 32]].concat(); // 一个 P2TR 输出脚本
    let pay = |value| NativeOutput {
        value,
        script: script.clone(),
    };
    let outputs = vec![pay(700), pay(300)];
    mock::set_native_tx(Some(NativeTx {
        txid: [3; 32],
        outputs,
    }));
    let paid = mock::with_context(ALICE, CONTRACT, || snippets::paid_by_this_op(&script));
    assert_eq!(paid, Ok(([3; 32], 1_000)));
    mock::set_native_tx(None); // 从这里起是路径 B 操作
    let paid = mock::with_context(ALICE, CONTRACT, || snippets::paid_by_this_op(&script));
    assert_eq!(paid, Err(b"send this op through path C".to_vec()));
}
```

这里合约的 crate 名叫 `snippets`，请换成你自己 crate 的名字。和节点一样，区块比锚定块低不到 6 个区块，或者区块头是你没有设置过的，模拟宿主的 `btc_header` 都会 trap。

## 示例

[示例合约](/docs/example-contracts/)中有两个用到了比特币：

- **`btc-payment-trigger`** 发行自己的资产：谁证明了一笔付给被监视脚本的付款，就发给谁。`claim` 读取区块头，检查证明，要求交易承诺了受益账户，每个输出只接受一次，并按输出的聪数乘以 `units_per_sat` 发行资产。
- **`ksa-exchange`** 出售 KSA 换取比特币，充值用的就是它。卖方以某个价格为买方的账户锁定 KSA。买方在携带路径 C `claim` 的那笔比特币交易里，向锁定的脚本付款。`claim` 读取 `native_tx()`，加总付款，把 txid 记在这个锁定名下，再把买到的 KSA 付给买方。

两者在仓库里都有基于模拟宿主的测试，regtest 端到端测试还让它们对接真实的 bitcoind 运行。
