---
title: 术语表
lede: 这些文档所用术语的简短定义，按英文术语的字母顺序排列，每条都链接到讲解它的页面。
description: Ksana 术语的定义，从账户、锚定块到两速难度、扣留区块。
---

## A

### ABI

合约与节点之间的二进制接口：模块导出的 `ksana_alloc` 和 `ksana_call`，一次调用经 Borsh 编码的输入和结果，以及导入模块 `ksana` 中的宿主函数。见[宿主函数](/docs/host-functions/)。

### 账户（Account）

一个 Taproot 地址的 32 字节输出公钥（BIP86），写成这个地址（signet 上以 `tb1p` 开头，主网上以 `bc1p` 开头），或者写成 64 位十六进制。持有你比特币的那把密钥，同样掌控着你的 KSA，而两者各自留在自己的链上。见[账户](/docs/accounts/)。

### 锚定块（Anchor）

每个 Ksana 区块在区块头里（`btc_anchor`）以高度和哈希指明的那个比特币区块。出块者锚定在自己的比特币链顶之下 `ANCHOR_DEPTH` 个区块处（signet 上为 1，主网上为 2），区块执行时从比特币读取的一切，都位于它的锚定块或更低处。见 [Ksana 的工作原理](/docs/how-it-works/)。

### 锚定失效的区块（Anchor-invalid block）

锚定块（或它合并的某个区块的锚定块）不在比特币最优链上的区块，通常出现在比特币重组之后。节点仍把它当作历史接受，但它永远不可能成为最终，所以出块者从不合并它，主链也从不纳入它。见[安全模型](/docs/security/#unanchored-blocks)。

### Argon2id

Ksana 的工作量证明对每个区块头计算的内存困难型函数（RFC 9106）：2 MiB 内存，一遍，一个通道，在一个 CPU 核心上每次哈希约 1 毫秒。浏览器也能验证区块头。见[挖矿](/docs/mining/)。

### ASERT

难度调整算法（aserti3-2d）。它按链领先或落后于“每 5 秒一个单位 DAA 分数”这一计划的程度，设定每个区块的目标值，半衰期为 7,200 秒。见[挖矿](/docs/mining/)。

### 资产（Asset）

账户的余额里持有的东西：要么是 KSA，资产 ID 为 32 个零字节；要么是合约发行的资产，ID 是合约 ID 与一个子 ID 的 SHA-256 哈希。代币合约是另一回事，比如 KS-20 代币：它把余额记在自己的存储里。见[资产与代币](/docs/tokens/)。

### 附带资产（Attached funds）

操作或合约调用随附转给它所调用或部署的合约的内置资产：最多 16 项（`MAX_CALL_FUNDS`），按资产 ID 严格升序排列，每项都大于零。它们在合约运行之前转给合约；不符合这些规则的列表会让操作失败。见[操作与手续费](/docs/submitting-ops/)。

## B

### 最小单位（Base unit）

KSA 的最小金额：1 KSA 等于 100,000,000 个最小单位。RPC、`ksana-cli` 和创世配置都把金额写成整数个最小单位。见 [KSA 与奖励](/docs/ksa/)。

### BIP322

比特币用地址为消息签名的标准。Unisat、Xverse 等浏览器钱包用你的 Taproot 地址，以 BIP322 simple 签名的形式签署操作，被签的消息是十六进制写出的操作签名哈希。见[账户](/docs/accounts/)。

### BIP340

Taproot 的 Schnorr 签名方案。`ksana-cli` 和 TypeScript SDK 直接用 BIP340 签署操作，用的是你账户那个 Taproot 地址经过调整的密钥。见[账户](/docs/accounts/)。

### 区块（Block）

快轨区块：一个区块头（版本、高度、父块、锚定块、条目根、状态根、出块者、时间戳、难度 bits 和 nonce）加上它的条目列表。出块者通过工作量证明找到它，GHOSTDAG 为它在排序中定好位置。见 [Ksana 的工作原理](/docs/how-it-works/)。

### 区块 DAG（Block DAG）

Ksana 的区块构成的图：一个区块最多可以有 10 个父块，所以同时找到的区块会被合并，而不是被丢弃。GHOSTDAG 为这张图排序。见[挖矿](/docs/mining/)。

### 区块分享（Block share）

在协议规则设有区块分享的期间，奖励槽里先于携带者和出块者、付给创世配置指定的区块分享账户的那一部分。见 [KSA 与奖励](/docs/ksa/#who-gets-each-slot)。

### 蓝块与红块（Blue and red blocks）

GHOSTDAG 为一个区块所合并的各个区块染色：能放进一个连接紧密的集合的染成蓝色，否则染成红色；一个蓝块的反锥（anticone）中最多有 `GHOSTDAG_K` 个、即 16 个蓝块。两者的条目都会执行，但只有主链区块和蓝块能得到出块奖励。见[挖矿](/docs/mining/)。

### 蓝分数与蓝工作量（Blue score and blue work）

一个区块的蓝分数是它的祖先中蓝块的个数，蓝工作量是这些蓝块工作量证明的总和。`MERGE_DEPTH` 和剪枝深度都以蓝分数计量。见[挖矿](/docs/mining/)。

### Borsh

Ksana 的操作、区块头和合约调用所用的二进制编码：字段按固定顺序排列，整数为小端序，每个列表或字符串前面都有 4 字节的长度。字段顺序就是格式本身，所以改动它就是共识变更。见[操作与手续费](/docs/submitting-ops/)。

### BTC 最终（BTC-final）

RPC 对操作或区块第三道印记的称呼（`btc_final`）。见[最终](#final)。

## C

### 携带者（Carrier）

把一个区块的数据写进比特币、并因此获得报酬的账户：其结算最先携带了这些数据的那个区块的出块者；或者一份补发载荷的收款账户，前提是这份载荷写入数据的比特币区块，比该区块的锚定块高出超过 `ANCHOR_DEPTH` + 2 个区块。携带者得到该区块各奖励槽的 5%，以及该区块路径 B 手续费的一半。见 [KSA 与奖励](/docs/ksa/)。

### 链 ID（Chain ID）

网络的编号：devnet 为 1001，signet 为 1002，主网为 1000。每个 VmOp 都带着它，所以为一个网络签名的操作在另一个网络上无效。见[参数](/docs/parameters/)。

### 链工作量（Chain work）

一个区块的蓝工作量加上它自身的工作量。分叉选择和选定父块都按它来定，所以一个重的区块一公布就算数，不必等到有区块建在它之上。见[安全模型](/docs/security/)。

### 检查点（Checkpoint）

节点或索引器数据目录中的 `pruning.ckpt` 文件：记录剪枝后保留在内存里的内容（区块 DAG、最终性状态、区块体和比特币视图），重启时就从它继续。见[运行节点](/docs/run-a-node/)。

### Coinbase

每个比特币区块的第一笔交易，付款给这个区块的矿工。coinbase 从不携带路径 C 操作；核验付款的合约还会要求提供 coinbase 的 Merkle 证明，因为它固定了区块交易树的深度。见[合约中的比特币](/docs/bitcoin-in-contracts/)。

### 提交交易与揭示交易（Commit and reveal transactions）

一次结算的两笔比特币交易。提交交易花费出块者的资金，创建一个承诺了一段 Taproot 脚本的输出；揭示交易花费这个输出，在它的见证里亮出这段脚本，也就是装着载荷的信封。见 [Ksana 的工作原理](/docs/how-it-works/)。

### 紧凑编码（Compact encoding）

让载荷保持小巧的办法：每个区块头都相对于它前面的区块头来写，一份载荷中的条目共用一个键字典。一串连续的空块中，第一个之后的每个区块头只占 14 字节。见 [Ksana 的工作原理](/docs/how-it-works/)。

### 竞争链（Competing chain）

比节点的主链轻、但到目前为止写进比特币的链工作量比节点自己的链更多的分叉。它出现后过了一个比特币区块，如果仍然如此，节点就以能进入下一个区块的费率，补发自己直到链顶的区块头，让更重的那条链及时上链，赶得上成为最终。见[安全模型](/docs/security/#competing-chains)。

### 合约（Contract）

由部署操作存放到 Ksana 上、通过调用来运行的 WebAssembly 程序。它有合约 ID、自己的存储和余额，可以调用其他合约，也能读取比特币数据。见[编写合约](/docs/contracts/)。

### 合约 ID（Contract ID）

合约的 32 字节 ID，写成 64 位十六进制；合约没有地址。部署出来的合约，ID 是部署账户、那笔部署操作的 nonce 和代码哈希合在一起的 SHA-256 哈希；由合约用 `create_contract` 创建的合约，ID 是创建者合约的 ID、一个 32 字节的盐值和代码哈希合在一起的哈希。见[账户](/docs/accounts/)。

### CPFP 加速（CPFP bump）

Child pays for parent，即子交易为父交易付费：节点自己发出的一笔结算在比特币内存池里等待时，节点用一笔手续费更高的子交易花掉揭示交易那个 240 聪的 P2A 输出，借此提高这笔结算的手续费。见[挖矿](/docs/mining/)。

## D

### DAA 分数（DAA score）

区块用于难度、奖励和升级的时间度量：它所有祖先区块（创世块除外）的权重之和，加上它自己的权重。有条目的区块权重为 1，空块为 12 到 120；目标是每 5 秒一个单位的 DAA 分数。见[挖矿](/docs/mining/)。

### 确定性（Determinism）

每个节点和索引器都从同样的区块算出同样的状态：共识代码不使用浮点运算、系统时间和无序遍历。有一项测试在 x86_64 和 aarch64 上，用两个进程运行同一条链，并把每个区块的状态根与固定值比较。见 [Ksana 的工作原理](/docs/how-it-works/)。

### devnet

运行在比特币 regtest 上、供开发用的本地网络（链 ID 1001）；`devnet/docker-compose.yml` 会启动它的 bitcoind，加上 `--profile nodes` 还会启动三个节点和一个索引器。见[参数](/docs/parameters/)。

### 被取消主链资格的区块（Disqualified block）

违反了只有执行它才能检查的规则的区块，比如状态根对不上，或者某个条目在严格模式下失败。它和选定链经过它的每个区块都不能进入主链，但它仍留在区块 DAG 里，其他区块也可以合并它。见[安全模型](/docs/security/#invalid-blocks)。

## E

### 空块（Empty block）

没有条目的区块。它所需的工作量是有条目区块的 12 倍，此后每多一个连续的空块，这个倍数就翻一番，最高到 120 倍，所以空闲的链大约每 1 到 10 分钟出一个区块。见[挖矿](/docs/mining/)。

### 连续空块数（Empty-block streak）

选定链上截至某个区块（含该区块）连续出现的空块个数：有条目的区块为 0。它决定空块的权重：第一个为 12，之后每个翻一番，最高 120。见[挖矿](/docs/mining/)。

### 条目（Entry）

区块列表中的一项：强制收录条目（路径 C 操作）、解锁条目或路径 B 条目，按此顺序排列。见[操作与手续费](/docs/submitting-ops/)。

### 条目池（Entry pool）

节点里存放等待进入区块的路径 B 操作的池子，也就是节点的内存池。默认最多容纳 10,000 笔操作，每个账户 64 笔，只接纳手续费不低于本节点中继门槛的操作。见[操作与手续费](/docs/submitting-ops/)。

### 信封（Envelope）

揭示交易见证中携带载荷的那段 Taproot 脚本：`<key> OP_CHECKSIG OP_FALSE OP_IF KSN1 <chunks> OP_ENDIF`。提交交易的输出承诺了这段脚本，所以谁也无法调换载荷。见 [Ksana 的工作原理](/docs/how-it-works/)。

### 事件（Event）

合约运行时发出的记录（`emit_event`）。事件出现在操作的回执里，不计入状态根；操作失败时会被丢弃。见[宿主函数](/docs/host-functions/)。

### 兑换合约（Exchange contract）

出售 KSA 换取 BTC 的合约，比如示例合约 `ksa-exchange`。卖方按某个价格为买方锁定 KSA，买方的一笔比特币交易既付款给卖方，又领取这些 KSA（即充值）。见[操作与手续费](/docs/submitting-ops/)。

### 被排除的区块（Excluded block）

最终性规则在某个比特币高度上略过的区块，原因是它锚定在比特币最优链之外，或者它的执行无效。选定链经过它的每个区块都随它一起被排除；比特币重组可以撤销这种排除。见[安全模型](/docs/security/#invalid-blocks)。

## F

### 失败的操作（Failed operation）

已被收录、但没有生效的操作，它所在的区块仍然有效。动作失败时（gas 耗尽、合约 revert 或余额不足），动作做出的改动会回滚，但 nonce 照样用掉，路径 B 操作也照付手续费。没通过检查（版本、链 ID、长度、手续费模式、签名或 nonce）的路径 C 操作会被记为失败，但不用掉它的 nonce。见[操作与手续费](/docs/submitting-ops/)。

### 快轨（Fast lane）

Ksana 自己的工作量证明链，约 5 秒内为操作排好顺序并执行；它的数据由比特币保存，最终性也由比特币决定。见 [Ksana 的工作原理](/docs/how-it-works/)。

### 快轨确认（Fast-confirmed）

操作的第一道印记，经路径 B 提交后约 5 秒即可得到：一个主链区块收录并执行了它（RPC 中为 `fast_confirmed`）。它只靠快轨的算力保障。见[确认与最终性](/docs/confirmations/)。

### 水龙头（Faucet）

位于 `{{signet.faucet}}` 的 signet 服务，每天向一个账户发送一次 100 个测试 KSA。见[公开 signet](/docs/signet/)。

### 费率（Fee rate）

对路径 B 操作而言，是它每 KiB 成本所付的手续费，其中成本取它编码后的大小与把 `max_gas` 换算成的字节数两者中较大的一个；出块者按费率打包操作。对比特币交易而言，是每虚拟字节多少聪。见[操作与手续费](/docs/submitting-ops/)。

### 最终（Final）

操作的第三道印记（BTC 最终，RPC 中为 `btc_final`）：接受它的区块位于已最终的链上。在判定它为最终的那个比特币区块上，这个区块的数据，以及它所有祖先区块的数据，都有了 6 个比特币确认，这个比特币区块自己也有了 6 个确认，而且它的执行有效。只靠快轨算力推翻不了它：那需要一次至少 6 个区块的比特币重组。见[确认与最终性](/docs/confirmations/)。

### 最终性（Finality）

只凭比特币数据、一个比特币区块接一个地判定哪些 Ksana 区块已最终的规则。每个节点和索引器都会得出同样的答案；一条更重的链如果太晚才写进比特币，就取代不了已最终的区块。见 [Ksana 的工作原理](/docs/how-it-works/)。

### 最终链顶（Finalized tip）

最新的已被判定为最终的区块，主链必须经过它。`ksana_getChainInfo` 和 `indexer_status` 报告的 `finalized` 则是 BTC 最终链顶：最新的已报告为最终的区块，判定它的那个比特币区块已有 6 个确认。见[确认与最终性](/docs/confirmations/)。

### 强制收录（Forced inclusion）

一条规则：每个区块都必须以它的收录区间内在比特币上确认的路径 C 交易开头，并按比特币上的顺序排列；漏掉其中任何一笔的区块无效。一笔交易有了 `NATIVE_CONFIRMATIONS` 加 `ANCHOR_DEPTH` 个确认，就到了必须收录的时候：signet 上为 2 个，主网上为 5 个。见[操作与手续费](/docs/submitting-ops/)。

### 分叉选择（Fork choice）

挑选主链的规则：在有资格的顶端中选链工作量最多的那个，工作量相同时哈希较大者胜出。一个区块，如果它自己或它合并的某个区块锚定在比特币最优链之外，就没有资格。见[安全模型](/docs/security/)。

### 出资密钥（Funding key）

出块者用它的币支付结算的比特币密钥（`--btc-funding-key-file`）；它的 Taproot 地址里必须有已确认的比特币。在 signet 和主网上，节点通过自己 bitcoind 里的一个仅观察钱包（`--btc-funding-wallet`）找到这些币。见[运行节点](/docs/run-a-node/)。

## G

### Gas

执行成本的单位：1 gas 就是 wasmtime 的一个 fuel 单位，宿主函数和内置动作另有固定的价格。每笔操作设定自己的 `max_gas`；一个区块的各条目合计最多 100,000,000 gas（`BLOCK_GAS_LIMIT`），只有强制收录条目能超出这个上限。见[宿主函数](/docs/host-functions/)。

### 创世配置（Genesis config）

一个网络的每个节点和索引器都从它启动的那个 JSON 文件：起始时间、比特币锚定块、难度、分配和区块分享账户。signet 的创世配置是 `signet/genesis.json`。见[参数](/docs/parameters/#genesis-configurations)。

### GHOSTDAG

为区块 DAG 排序的协议，定义和算法都沿用 Kaspa：它为每个区块挑出选定父块，把被合并的区块染成蓝色或红色，并把所有区块排成唯一的顺序。Ksana 取 K = 16。见[挖矿](/docs/mining/)。

## H

### 减半周期（Halving period）

一段 DAA 分数区间，期间每个奖励槽发放相同的数额；每进入一个新周期，奖励就减半。在主网上，各周期依次约为 2 年、4 年，之后每期 8 年；在 signet 上每期约 4 年。见 [KSA 与奖励](/docs/ksa/)。

### 高度（Height）

区块的高度等于它选定父块的高度加一。被合并区块中的操作，在合并它的主链区块的高度生效，RPC 报告的也是这个高度。见 [JSON-RPC](/docs/rpc/)。

### 宿主函数（Host function）

虚拟机提供给合约的函数，比如 `storage_get`、`call_contract`、`asset_transfer`、`emit_event`、`btc_header` 和 `native_tx`。每个都有以 gas 计的价格，有些按字节计价。见[宿主函数](/docs/host-functions/)。

## I

### 空闲时的区块头间隔（Idle header interval）

没有东西可收录时区块之间的间隔：第一个空块约 1 分钟，此后每多一个空块就翻一番，最长约 10 分钟。第一笔到来的操作，就让链恢复到约 5 秒一个区块。见[挖矿](/docs/mining/)。

### 索引器（Indexer）

`ksana-indexer`：只凭 bitcoind 重建 Ksana 链及其状态，不与任何节点通信，并核对每个区块的状态根。见[运行索引器](/docs/run-an-indexer/)。

### 无效区块（Invalid block）

违反某条共识规则的区块，例如工作量证明不对、漏了强制收录，或者区块体大到一个载荷装不下。节点会拒绝它以及建在它之上的每个区块；而失败的操作并不影响所在区块的有效性。见[操作与手续费](/docs/submitting-ops/)。

## K

### KS-20

同质化代币的标准，余额由合约记录：它的方法、事件和拒绝原因，带有效期的授权额度，以及在一个操作里付款给一个合约并调用它的 `transfer_and_call`。见 [KS-20](/docs/ks-20/)。

### KS-721

独一无二的代币组成的合集的标准，每个代币有一个 32 字节的 ID，以及由合集记录的所有者。见 [KS-721](/docs/ks-721/)。

### KSA

Ksana 的原生资产，8 位小数，资产 ID 为 32 个零字节。路径 B 的手续费用它支付，出块者以出块奖励的形式挣得它；主网的总量上限是 210,000,000 KSA。见 [KSA 与奖励](/docs/ksa/)。

### ksana-cli

命令行客户端：它生成密钥、查询节点，并经路径 B 提交操作，或者借助一个 bitcoind 钱包经路径 C 提交。见 [ksana-cli](/docs/cli/)。

### ksana-keytool

一个小工具：创建或读取密钥文件，并打印它的账户和各个地址，用来准备出块者的 `--producer` 账户和出资密钥。见[运行节点](/docs/run-a-node/)。

### ksana-node

节点程序：它通过 P2P 跟随这条链，对照比特币检查每个区块，并提供 JSON-RPC。加上 `--producer`，它还会挖矿出块；再给它一把出资密钥，它就结算这些区块。见[运行节点](/docs/run-a-node/)。

### KSN1

比特币上 Ksana 数据开头的标记（`MAGIC`），既用在路径 C 交易的 `OP_RETURN` 输出里，也用在结算载荷或补发载荷的信封里。见 [Ksana 的工作原理](/docs/how-it-works/)。

## L

### 宽松执行与严格执行（Lenient and strict execution）

主链区块先以宽松模式执行它合并集中的其他区块，与前面条目冲突的条目会被跳过；再以严格模式执行它自己的条目，这时出现这样的条目，就会让这个区块被取消主链资格。见 [Ksana 的工作原理](/docs/how-it-works/)。

### 本地故障（Local fault）

某个节点自身的错误，比如它的存储或它的 bitcoind 出了故障，有别于区块或操作本身的问题。节点绝不会因为本地故障而判定区块无效。见[操作与手续费](/docs/submitting-ops/)。

### 锁定（Lock）

兑换合约里的一份报价：卖方为一位买方（即受益账户）预留的 KSA，按每聪的价格出售，付款要付到卖方指定的一个比特币收款脚本，而这个脚本从未被其他任何锁定用过。买方通过充值领取它；从锁定的到期高度之后 6 个比特币区块起，卖方就可以释放剩下的部分。见[操作与手续费](/docs/submitting-ops/)。

### 锁定的手续费（Locked fees）

尚未解锁的区块欠一个账户的款项，`ksana_getAccount` 在 `locked_fees` 下按区块逐条列出：出块者的出块奖励和路径 B 手续费、携带者的那一份，以及区块分享账户的区块分享。区块已结算后，等某个解锁条目为这个区块付款，这些款项就转入余额。见 [KSA 与奖励](/docs/ksa/)。

## M

### 主链（Main chain）

从最优的、有资格的顶端沿选定父块一路回到创世块的那条链。它决定区块的执行顺序，而且必须经过最终链顶。见 [Ksana 的工作原理](/docs/how-it-works/)。

### 主网（mainnet）

运行在比特币主网上的网络（链 ID 1000）。它尚未上线：参数已经定好，创世配置还只是一个模板。见[参数](/docs/parameters/)。

### 印记（Mark）

一笔操作要经过的三个阶段之一：快轨确认、已写入比特币、BTC 最终。每道印记依靠的东西各不相同，所以应用按金额决定等到哪一道。见[确认与最终性](/docs/confirmations/)。

### 合并深度（Merge depth）

`MERGE_DEPTH`，即 720 蓝分数：按每 5 秒一个区块算，相当于一小时的区块。一个区块只能合并这样的区块：蓝分数与它选定父块的蓝分数相差不超过这个距离，并且选定链经过它的合并深度根。见[挖矿](/docs/mining/)。

### 合并集（Merge set）

一个区块在其选定父块的祖先之外，新加入自己祖先之列的那些区块：选定父块本身，以及它合并的平行块，最多 128 个。这些被合并的区块按 GHOSTDAG 顺序执行，排在该区块自己的条目之前。见[挖矿](/docs/mining/)。

### Merkle 证明（Merkle proof）

证明一笔交易在某个比特币区块里的凭据：从它的 txid 一路到区块头中 Merkle 根的路径上的那些哈希，也叫 Merkle 分支。合约用 SDK 的 `btc::verify_tx_inclusion`，对照 `btc_header` 给出的区块头检查它，同时检查同一区块 coinbase 的证明，后者固定了树的深度。见[合约中的比特币](/docs/bitcoin-in-contracts/)。

### 模拟宿主（Mock host）

你把合约编译给本机而不是 WebAssembly 时，`ksana-contract-sdk` 用来顶替宿主函数的内存实现，这样 `cargo test` 不需要节点就能运行合约。见[编写合约](/docs/contracts/)。

## N

### 原生交易（Native transaction）

一笔比特币交易，它唯一的 KSN1 `OP_RETURN` 输出携带一笔签了名的操作：路径 C 就是这样传递的。见[操作与手续费](/docs/submitting-ops/)。

### Nonce

每个账户各自的计数器。每笔操作都带着账户的下一个 nonce，所以无法被重放；节点的条目池按 nonce 顺序保存一个账户的操作。见[账户](/docs/accounts/)。

## O

### 已写入比特币（On Bitcoin）

操作的第二道印记：它所在区块的数据，以及该区块所有祖先区块的数据，都已落进比特币区块（`ksana_getSettlement` 中的 `settled`）。现在任何人都能从比特币核对这笔操作，但它尚未最终。见[确认与最终性](/docs/confirmations/)。

### 一次性密钥（One-time key）

为单次充值生成的密钥。它只签领取操作，nonce 为 0，所以领取不占用你账户的任何 nonce，几笔充值也能以任意顺序确认。见[操作与手续费](/docs/submitting-ops/)。

### 操作 ID（Op ID）

操作完整编码（含签名）的 SHA-256 哈希（`op_id`）。你用它来跟踪操作。见[操作与手续费](/docs/submitting-ops/)。

### 操作（Operation）

发给 Ksana 的一条签了名的指令（也简称 op），编码为 VmOp：资产转账、合约调用或合约部署。你经路径 B 或路径 C 提交它。见[操作与手续费](/docs/submitting-ops/)。

### 操作状态（Operation status）

`ksana_getOpStatus` 报告的状态：`pending`（在条目池里）、`fast_confirmed`、`failed`（已收录，执行失败，手续费已付）、`skipped` 和 `btc_final`。见[确认与最终性](/docs/confirmations/)。

### 输出点（Outpoint）

对一笔比特币交易中某个输出的引用：交易的 ID 加上输出的序号。路径 C 签名覆盖携带这笔操作的交易中第一个输入所花费的输出点，所以把这笔操作复制到其他任何交易里都会失败。见[账户](/docs/accounts/)。

### 输出公钥（Output key）

Taproot 地址所编码的 32 字节公钥：它的内部公钥按 BIP86 的方式调整后的结果。Ksana 账户就是一个输出公钥，所以你的账户和你的 Taproot 地址是同样的字节。见[账户](/docs/accounts/)。

## P

### P2A 输出（P2A output）

每笔揭示交易都带有的、金额 240 聪的锚点输出（pay-to-anchor）。任何人都能在一笔子交易里花掉它，提高一笔在比特币内存池里等待的结算的手续费。见[挖矿](/docs/mining/)。

### 打包门槛（Packing floor）

出块者放进自己区块的路径 B 操作所需的最低手续费（`--min-token-fee`，默认 1 个最小单位）和最低费率（`--min-fee-per-kib`，默认 0）。见[操作与手续费](/docs/submitting-ops/)。

### 平行块（Parallel block）

与另一个区块几乎同时找到、彼此都不是对方祖先的区块。后来的区块会合并它，而不是丢弃它；它的操作照样执行，除非与排在前面的操作冲突。见[挖矿](/docs/mining/)。

### 路径 B：代付（Path B, sponsored）

把带 KSA 手续费的操作提交给节点。你只签一条消息，出块者几秒内就会收录这笔操作，结算它所需的比特币手续费由出块者支付。见[操作与手续费](/docs/submitting-ops/)。

### 路径 C：原生（Path C, native）

通过一个 KSN1 `OP_RETURN` 输出，把操作放进你自己的比特币交易里提交。你只付比特币手续费；交易一经确认，每个出块者都必须收录这笔操作；它的签名绑定这笔交易的第一个输入，所以谁也复制不了它。见[操作与手续费](/docs/submitting-ops/)。

### 载荷（Payload）

结算交易或补发交易装在信封里携带的数据：紧凑编码的区块头，以及需要区块体的那些区块的区块体，最多 81,920 字节、500 个区块头。路径 C 交易的载荷是一笔操作。见 [Ksana 的工作原理](/docs/how-it-works/)。

### 出块者（Producer）

挖矿出块的节点：它对出块模板计算 Argon2id，挣得的 KSA 付到 `--producer` 指定的账户。任何人都可以出块。见[挖矿](/docs/mining/)。

### 剪枝（Pruning）

内存中只保留从剪枝点起的区块 DAG，更早的历史从磁盘应答，让内存占用保持有界。剪枝点比剪枝根至少低 2,209 蓝分数；剪枝根是至少 144 个比特币区块之前就已判定为最终的最高区块。见[运行节点](/docs/run-a-node/)。

### PSBT

部分签名的比特币交易（partially signed Bitcoin transaction，BIP174）。对于路径 C 和充值，网页钱包和 TypeScript SDK 会构建一个 PSBT，交给你的浏览器钱包签名。见 [Signet 钱包](/docs/wallet/)。

## R

### 只读调用（Read-only call）

通过 RPC 方法 `ksana_call`、而不是通过操作进行的合约调用。它在最新状态上按下一个区块的情形运行，不付手续费，不用 nonce，也不改变链上任何东西。见 [JSON-RPC](/docs/rpc/)。

### 回执（Receipt）

执行一笔操作的结果：成功或失败、用掉的 gas、返回值、事件，以及它对内置资产做的变动。失败操作的回执把它全部的 `max_gas` 都记为已用。见[操作与手续费](/docs/submitting-ops/)。

### 中继门槛（Relay floor）

节点接纳进条目池并转发给对等节点的最低路径 B 手续费（`--min-relay-token-fee`，默认等于打包门槛；两者中较低的那个起作用）。见[操作与手续费](/docs/submitting-ops/)。

### 重组（Reorg）

重组（reorganization）：链的一部分被一条更重的分支取代。不超过 `ANCHOR_DEPTH` 个区块的比特币重组，不会动任何 Ksana 区块；更深的重组会把锚定在成为孤块的比特币区块上的区块移出主链。只有至少 6 个区块的比特币重组才能推翻已最终的区块。见[安全模型](/docs/security/#bitcoin-reorgs)。

### 补发（Republish）

用一份新载荷把区块头（必要时连同区块体）再次写进比特币：为了让没有结算携带的数据上链，或者让节点自己的链在比特币上赶到竞争链前面。任何节点都可以补发，载荷中指定一个收款账户，它可能挣得携带者报酬。见 [Ksana 的工作原理](/docs/how-it-works/)。

### 救援（Rescue）

节点用自己的资金重建一笔卡住的结算：把同样的载荷放进一对新的提交交易和揭示交易。区块自己的出块者先来，然后是它之后各主链区块的出块者，彼此相隔一个比特币区块，最后是其他任何节点。见 [Ksana 的工作原理](/docs/how-it-works/)。

### revert 与 trap

合约调用失败的两种方式。方法返回一个错误时就是 revert，原因显示在回执的 `error` 里；遇到 WebAssembly 故障（比如 `unreachable`、越界访问或除以零）时就是 trap。两者都会让整笔操作失败，除非这次调用是通过 `try_call_contract` 发起的，那样只回滚被调用方。见[宿主函数](/docs/host-functions/)。

### 奖励槽（Reward slot）

出块奖励的单位：权重为 w 的区块占用截至它 DAA 分数的那 w 个槽，每个槽按所在减半周期的奖励发放（主网第一个周期为 4.2 KSA）。见 [KSA 与奖励](/docs/ksa/)。

## S

### 种子节点（Seed node）

项目托管的两个 signet 节点之一，它们负责出块和结算。新节点用 `--peer` 传入第一个种子节点 `{{signet.p2p}}`，就能加入网络。见[运行节点](/docs/run-a-node/)。

### 选定父块（Selected parent）

链工作量最多的那个父块。从一个顶端沿选定父块往回走，得到它的选定链；主链就是最优顶端的选定链。见[挖矿](/docs/mining/)。

### 已结算（Settled）

一个区块的数据，以及它所有祖先区块的数据，都写进比特币之后，这个区块就已结算：即[已写入比特币](#on-bitcoin)这道印记。之后它的奖励和手续费就可以解锁，索引器也可以执行它。见 [KSA 与奖励](/docs/ksa/)。

### 结算（Settlement）

出块者用来把一个区块的数据（常常连同更早区块的区块头和区块体）写进比特币的那对提交交易与揭示交易，比特币手续费也由出块者支付。没有区块体要上链的区块，即空块或只含路径 C 操作的区块，只有在携带其他区块的区块体时，才有自己的结算；否则由后来的某次结算把它的区块头送上链。见 [Ksana 的工作原理](/docs/how-it-works/)。

### 结算积压上限（Settlement backlog limit）

一条安全规则：一个区块的区块体在它的锚定块之后等了 6 个比特币区块（`SETTLEMENT_TIMEOUT`）仍未上链时，新区块只能包含强制收录条目，于是路径 B 暂停，直到这些数据上链。见[安全模型](/docs/security/#unsettled-data)。

### 批量结算（Settlement batching）

有一次结算在途时，出块者先把新区块的区块体留着，等这次结算确认后，用下一次结算把它们一并带上链。等待中的区块体、或者某个新区块自己的区块体超过 10 KiB（载荷上限的八分之一）时，这个新区块会立刻带上一次结算。批量结算默认开启。见[挖矿](/docs/mining/)。

### signet

Ksana 运行在比特币公开 signet 上的公开测试网络（链 ID 1002），在 `{{signet.host}}` 上托管着两个种子节点、一个索引器、网页钱包和水龙头。它的币没有价值。见[公开 signet](/docs/signet/)。

### Signet BTC

比特币公开 signet 上的币（sBTC），可以从任何 signet 水龙头免费领取，不值任何钱。走路径 C、充值以及发出结算时，你需要一点 sBTC。见[公开 signet](/docs/signet/)。

### 被跳过（Skipped）

一笔操作的状态：只有被合并的区块收录过它，而且这些区块被合并时它无法执行，比如它已经在别处执行过了。它不付手续费；只要仍然有效，就会回到条目池。见[确认与最终性](/docs/confirmations/)。

### 浸泡测试（Soak test）

在 devnet 上长时间运行（默认 5 小时）的测试：不断提交随机的路径 B 和路径 C 操作，还可以加上随机的比特币重组，并逐个区块地对照节点检查索引器。见[安全模型](/docs/security/#testing)。

### 状态根（State root）

一个区块执行后整个状态的 Merkle 树的根，写在区块头里。索引器根据比特币上的数据重新计算它，以此核对每个区块。见[运行索引器](/docs/run-an-indexer/)。

## T

### Taproot

由 BIP341 定义的比特币输出类型，地址以 `bc1p` 开头（signet 上为 `tb1p`）。Ksana 账户是一个 Taproot 输出公钥，信封是一段 Taproot 脚本。见[账户](/docs/accounts/)。

### 链顶（Tip）

一条链上最新的区块：主链的链顶是它最高的区块，比特币链顶是比特币最优链上最新的区块。区块 DAG 可以同时有好几个顶端，由分叉选择挑出其中一个。见 [Ksana 的工作原理](/docs/how-it-works/)。

### 充值（Top-up）

从卖方在兑换合约里的锁定中用 BTC 买 KSA：你的一笔比特币交易既付款给卖方，又携带一个路径 C 领取操作，把 KSA 记到你名下。见[操作与手续费](/docs/submitting-ops/)。

### 两速难度（Two-speed difficulty）

空块比有条目的区块需要更多工作量：起初是 12 倍，此后每多一个空块就翻一番，最高 120 倍。繁忙的链约每 5 秒出一个区块，空闲的链约每 1 到 10 分钟出一个，单位时间的奖励相同。见[挖矿](/docs/mining/)。

### Txid

比特币交易的 ID：不含见证的交易的双重 SHA-256。Ksana 按比特币的内部字节序存储 txid 和比特币区块哈希，与 bitcoind 和区块浏览器显示的十六进制顺序相反，所以 RPC 也会按显示顺序给出结算的 txid（`txid_rpc`）。见 [JSON-RPC](/docs/rpc/)。

## U

### 解锁（Unlock）

区块已结算后，把锁定的奖励和路径 B 手续费发放出去。一个区块最多含一个解锁条目，它按主链接受区块的顺序，最多为 1,024 个区块（`MAX_UNLOCK_BATCH`）发放款项。见 [KSA 与奖励](/docs/ksa/)。

### 升级（Upgrade）

从某个设定的 DAA 分数起生效的新协议版本，取自 `params.rs` 中的升级表。目前任何网络上都没有排定升级，所以协议版本是 2。见[参数](/docs/parameters/#upgrades)。

### UTXO

未花费的交易输出（unspent transaction output）：比特币上的一枚币，由它的输出点指明，可以被一笔新交易花费。路径 C 交易、充值和结算都从 UTXO 中支付；TypeScript SDK 以 `Utxo` 值的形式接收要花费的 UTXO，但不会替你列出它们。见 [TypeScript SDK](/docs/sdk/)。

## V

### 裁决（Verdict）

把一个最终性候选区块当作主链区块、在最终链顶上执行所得的结果：有效；或者无效，并被排除。同一条比特币链上的每个节点和索引器，都会得出同样的裁决。见[安全模型](/docs/security/#invalid-blocks)。

### 虚拟字节（Virtual byte, vB）

比特币为计算手续费而衡量交易大小的单位：见证之外的每个字节算一个，见证里的每个字节算四分之一个。比特币的费率以每虚拟字节多少聪（一聪是一亿分之一个比特币）给出，写作 sat/vB。见[操作与手续费](/docs/submitting-ops/)。

### VmOp

操作编码后的形式：版本、链 ID、账户、nonce、手续费（路径 B 为一笔 KSA 数额，路径 C 标为原生）、`max_gas`、动作，以及一个 BIP340 或 BIP322 签名，最长 65,536 字节。见[操作与手续费](/docs/submitting-ops/)。

## W

### 钱包适配器（Wallet adapter）

TypeScript SDK 连接浏览器钱包的接口 `WalletAdapter`：它读取钱包的 Taproot 账户，让钱包签署 PSBT 和 BIP322 消息，还能询问钱包当前设在哪个比特币网络上。`UnisatAdapter` 和 `XverseAdapter` 封装了这两个扩展，你也可以为别的钱包实现这个接口。见 [TypeScript SDK](/docs/sdk/)。

### 网页钱包（Web wallet）

位于 `{{signet.wallet}}` 的 signet 钱包和区块浏览器：连接 Unisat 或 Xverse，领取测试 KSA，经路径 B 或路径 C 发送操作，充值，并跟踪操作和区块一路写进比特币。见 [Signet 钱包](/docs/wallet/)。

### WebAssembly

Ksana 合约的格式：不带标准库、编译到 `wasm32` 的 Rust 代码，由 wasmtime 运行，gas 精确计量，不允许浮点运算。见[编写合约](/docs/contracts/)。

### 权重（Weight）

区块的权重：有条目的区块为 1，空块为 12 到 120。区块的工作量证明目标值要除以它，它还计入 DAA 分数，并决定奖励槽的个数。见[挖矿](/docs/mining/)。

### 扣留区块（Withholding）

私下挖出区块、过后再公布（即自私挖矿），用来把诚实的区块变成红块、夺走它们的奖励，或者撤销一笔付款。分叉选择把区块自身的工作量计算在内，再加上 `GHOSTDAG_K` 取 16，限制了这种做法能得到的好处。见[安全模型](/docs/security/#withholding)。
