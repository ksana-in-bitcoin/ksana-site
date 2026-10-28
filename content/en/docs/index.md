---
title: Ksana documentation
nav: Overview
lede: How to use Ksana, build on it and run it, starting from the public signet.
description: Ksana’s documentation, from the quickstart, how Ksana works and confirmations to the public signet, the wallet, ksana-cli, the TypeScript SDK, contracts and running a node or an indexer.
---

Ksana is a smart-contract chain whose blocks confirm in about five seconds and are written into Bitcoin. Producers mine its blocks with their own proof of work and put each block’s data into Bitcoin transactions, paying the Bitcoin fees themselves. Which blocks are final is decided from Bitcoin’s chain alone, with no bridge, committee or sequencer in between, and a block is final once its data has six Bitcoin confirmations and five more blocks have secured the decision. Your account is your Taproot address, contracts are WebAssembly modules written in Rust, and anyone with a Bitcoin node can rebuild the whole chain.

::: cards
- [Quickstart](/docs/quickstart/) Get test KSA and send your first operation, in a browser or from a terminal.
- [How Ksana works](/docs/how-it-works/) The fast lane, settlement into Bitcoin, and finality decided from Bitcoin.
- [Confirmations](/docs/confirmations/) Fast-confirmed, on Bitcoin and final: what each mark means and how long to wait.
- [Signet wallet](/docs/wallet/) The web wallet and explorer of the public signet, with Unisat or Xverse.
:::

## By what you want to do

### Use the signet

- [The public signet](/docs/signet/): endpoints, the faucet and how the signet differs from mainnet
- [The signet wallet](/docs/wallet/): send on path B or path C, top up, and explore
- [Accounts](/docs/accounts/): your address, your keys and your balances
- [Operations and fees](/docs/submitting-ops/): what an operation costs on each path

### Build an app

- [TypeScript SDK](/docs/sdk/): keys, wallets, operations and the RPC clients, for Node.js and browsers
- [JSON-RPC](/docs/rpc/): every method of the node and the indexer
- [ksana-cli](/docs/cli/): the command-line client, for scripts and quick checks
- [Confirmations](/docs/confirmations/): which mark to wait for before you act on a payment

### Write a contract

- [Your first contract](/docs/first-contract/): a poll written, compiled and deployed in the browser, with the playground
- [Write a contract](/docs/contracts/): a Rust contract from an empty project to a deployment
- [The contract SDK](/docs/contract-sdk/): every function, type and constant a contract uses
- [Host functions](/docs/host-functions/): what a contract can call, and the gas each call costs
- [Bitcoin in contracts](/docs/bitcoin-in-contracts/): verify Bitcoin payments from a contract
- [Assets and tokens](/docs/tokens/): built-in assets, [KS-20](/docs/ks-20/) tokens and [KS-721](/docs/ks-721/) collections
- [Example contracts](/docs/example-contracts/) and the [token and pool tutorial](/docs/token-and-pool/)
- For AI assistants: the [contract reference]({{origin}}/llms-contracts.txt) in one file, and these docs as [llms.txt]({{origin}}/llms.txt) and [llms-full.txt]({{origin}}/llms-full.txt)

### Run a node or an indexer

- [Run a node](/docs/run-a-node/): follow the signet, produce blocks and settle them on Bitcoin
- [Run an indexer](/docs/run-an-indexer/): rebuild the chain from Bitcoin alone and check the nodes
- [Mining](/docs/mining/): proof of work, difficulty, rewards and what settling costs
- [Parameters](/docs/parameters/): every protocol value of devnet, signet and mainnet

[KSA and rewards](/docs/ksa/), [Security](/docs/security/), the [FAQ](/docs/faq/) and the [Glossary](/docs/glossary/) cover the rest.

## Where the project stands

- **Specification frozen.** The consensus rules in [`docs/SPEC.md`]({{repo}}/blob/main/docs/SPEC.md) were frozen on 5 October 2026. A change from then on goes through the upgrade mechanism the specification defines or, before mainnet, a restart of the test networks from genesis.
- **Public signet.** The [public signet](/docs/signet/) has run on Bitcoin’s signet since 13 October 2026, with hosted seed nodes, an indexer, the web wallet and a faucet. Its coins are test coins with no value.
- **Mainnet not launched.** The signet runs for at least four weeks first, to watch settlements and the carrier reward on a real Bitcoin fee market.

The source code, the specification and the design decisions are in the repository at [{{repo}}]({{repo}}).
