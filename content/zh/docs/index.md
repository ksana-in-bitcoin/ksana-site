---
title: Ksana 文档
nav: 概览
lede: 从公开 signet 起步：怎样使用 Ksana，怎样在它上面开发，怎样自己运行它。
description: Ksana 的文档：从快速上手、Ksana 的工作原理和确认，到公开 signet、钱包、ksana-cli、TypeScript SDK、合约，以及运行节点或索引器。
---

Ksana 是一条智能合约链，区块约五秒确认，并写进比特币。出块者用自己的工作量证明挖出区块，把每个区块的数据放进比特币交易，比特币手续费由他们自己支付。区块是否最终，只凭比特币的链判定，中间没有跨链桥、委员会或排序器：区块的数据满 6 个比特币确认、再过 5 个区块加固判定，即为最终。你的账户就是你的 Taproot 地址，合约是用 Rust 编写的 WebAssembly 模块，任何有比特币节点的人都能重建整条链。

::: cards
- [快速上手](/docs/quickstart/) 领取测试 KSA，发出你的第一笔操作，在浏览器里或终端里都行。
- [Ksana 的工作原理](/docs/how-it-works/) 快轨、写进比特币的结算，以及由比特币判定的最终性。
- [确认与最终性](/docs/confirmations/) 快轨确认、已写入比特币、BTC 最终：每道印记意味着什么，要等多久。
- [Signet 钱包](/docs/wallet/) 公开 signet 的网页钱包和区块浏览器，配合 Unisat 或 Xverse 使用。
:::

## 你想做什么

### 使用 signet

- [公开 signet](/docs/signet/)：服务地址、水龙头，以及 signet 与主网的区别
- [Signet 钱包](/docs/wallet/)：走路径 B 或路径 C 发送、充值、浏览链上数据
- [账户](/docs/accounts/)：你的地址、密钥和余额
- [操作与手续费](/docs/submitting-ops/)：每条路径上一笔操作要花多少

### 开发应用

- [TypeScript SDK](/docs/sdk/)：密钥、钱包、操作和 RPC 客户端，适用于 Node.js 和浏览器
- [JSON-RPC](/docs/rpc/)：节点和索引器的每一个方法
- [ksana-cli](/docs/cli/)：命令行客户端，适合写脚本和快速查看
- [确认与最终性](/docs/confirmations/)：根据一笔付款采取行动之前，该等到哪道印记

### 编写合约

- [你的第一个合约](/docs/first-contract/)：用 Playground 在浏览器里编写、编译并部署一个投票合约
- [编写合约](/docs/contracts/)：一个 Rust 合约，从空项目一直到部署
- [合约 SDK](/docs/contract-sdk/)：合约用到的每个函数、类型和常量
- [宿主函数](/docs/host-functions/)：合约能调用什么，每次调用花多少 gas
- [合约中的比特币](/docs/bitcoin-in-contracts/)：在合约里核验比特币付款
- [资产与代币](/docs/tokens/)：内置资产、[KS-20](/docs/ks-20/) 代币和 [KS-721](/docs/ks-721/) 合集
- [示例合约](/docs/example-contracts/)和[代币与资金池教程](/docs/token-and-pool/)
- 给 AI 助手：一个文件的[合约资料]({{origin}}/llms-contracts.txt)，以及英文文档的 [llms.txt]({{origin}}/llms.txt) 和 [llms-full.txt]({{origin}}/llms-full.txt)

### 运行节点或索引器

- [运行节点](/docs/run-a-node/)：跟随 signet，出块，并把区块结算到比特币上
- [运行索引器](/docs/run-an-indexer/)：只凭比特币重建这条链，并核对节点
- [挖矿](/docs/mining/)：工作量证明、难度、奖励，以及结算的花费
- [参数](/docs/parameters/)：devnet、signet 和主网的每一个协议参数值

其余内容见 [KSA 与奖励](/docs/ksa/)、[安全](/docs/security/)、[常见问题](/docs/faq/)和[术语表](/docs/glossary/)。

## 项目进展

- **规范已冻结**。[`docs/SPEC.md`]({{repo}}/blob/main/docs/SPEC.md) 中的共识规则已于 2026 年 10 月 5 日冻结。此后的改动，要么走规范所定义的升级机制，要么在主网上线之前，让测试网络从创世重新开始。
- **公开 signet**。自 2026 年 10 月 13 日起，[公开 signet](/docs/signet/) 运行在比特币的 signet 上，有托管的种子节点、索引器、网页钱包和水龙头。上面的币都是没有价值的测试币。
- **主网尚未上线**。signet 要先运行至少四周，在真实的比特币手续费市场上观察结算和携带者报酬。

源代码、规范和设计决定都在仓库 [{{repo}}]({{repo}}) 里。
