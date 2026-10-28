---
title: Contract playground
nav: Playground
lede: Eight example contracts with a page each, on the public signet. Use them, edit their Rust source, compile it in the browser and deploy your version.
description: The Ksana contract playground at playground.ksana.network: eight example contracts (counter, asset, KS-20 token, NFT, AMM, lending, multisig, vesting) to use, edit, compile and deploy on the signet, the ABI block its forms follow, and the limits of its compile service.
---

The [contract playground]({{playground}}) is a page of its own, beside the [signet wallet](/docs/wallet/). It runs on the [public signet](/docs/signet/), signs every operation in your own wallet and pays the fees in test KSA. The wallet links it from its top bar, its footer and its home, and from a contract's page.

## The examples

| Example | What it shows | Crate |
| --- | --- | --- |
| Counter | the smallest contract: one number anyone can increase | `playground-counter` |
| Asset | a built-in asset that wallets list: mint up to a cap, burn, send | `mintable-token` |
| KS-20 token | a [KS-20](/docs/ks-20/) token: send, approve with an expiry, take with an allowance, burn, mint up to a cap | `token` |
| NFT | a [KS-721](/docs/ks-721/) collection: mint, send, approve and sell for a fixed price | `nft` |
| AMM | swaps between two assets, and liquidity shares that earn the fees | `amm` |
| Lending | supply to earn interest, borrow against collateral, liquidations | `lending` |
| Multisig | a wallet whose owners approve and run proposals together | `multisig` |
| Vesting | tokens that release over time to a beneficiary | `vesting` |

Each example has four tabs: **App**, a page made for it; **Code**, its Rust source; **Methods**, a form for every method; and **Activity**, the operations this browser sent. The examples build on each other: the AMM, lending and vesting pages offer to deploy an asset first, the asset page starts a pool or a lending market with its asset filled in and links to vesting, and the KS-20 token page starts a pool with the token as a side. [Assets and tokens](/docs/tokens/) explains when to use which. The crates live in `contracts/examples/` of the repository with their native tests; [Example contracts](/docs/example-contracts/#playground-examples) lists them with the others.

## Start

::: steps

### Connect a wallet

Use Unisat, OneKey or Xverse with a Taproot (`tb1p…`) account on Bitcoin signet, as for [the signet wallet](/docs/wallet/#connect). The playground asks the wallet for signatures only and never sees your keys.

### Get test KSA

**Get test KSA** asks the faucet for 100 KSA, once a day for each account. Deployments and calls are path B operations that pay their fee in KSA, and a deployment's fee grows with the module's size.

### Deploy an example

**Deploy new** fills in the example's `init` arguments, which you can change. Asset IDs and contract IDs look alike, so before anything is sent the page checks that each asset ID names an asset and that each of the AMM's token sides names a token contract, and offers the asset to use instead when an ID leads to one. Review the operation, then sign it in the wallet; the page shows the predicted contract ID until a block includes the deployment. To use a contract someone else deployed, open their link or **Open by ID**.

### Use it

The **App** tab is the example's own page: swaps and liquidity for the AMM, supply, borrow and repay for lending, proposals for the multisig. A KS-20 side pays the pool with the token's own `transfer_and_call`, so a swap or a deposit is one operation with nothing to approve; a token written before KS-20 is pulled with its `transfer_from`, so the AMM page asks you to approve the amount for the pool first, with a button of its own. Every write goes through the same review, which runs the operation read-only against the latest state first and warns you when it would fail.

:::

## Edit and compile

The **Code** tab holds the example's `src/lib.rs`. The editor builds that one file against `ksana-contract-sdk`, as the repository builds the examples. [Your first contract](/docs/first-contract/) writes a contract of your own here, step by step.

- **Compile** sends the source to the compile service. Errors and warnings come back on their lines.
- **Deploy this build** deploys your module as a new contract, and the forms of the **Methods** tab follow the ABI block of your source. The example's own **App** page may not match edited code, and says so.
- The example's source, unchanged, compiles to the very module the playground ships, byte for byte (`playground/src/examples/wasm/builds.json` holds the hashes). An example's deployment can be checked against the source the page shows.
- A copy of the playground without a compile service still deploys the published modules. Build a module yourself as [Example contracts](/docs/example-contracts/#build-and-test-them) shows, and upload the `.wasm` on the **Code** tab.

### Limits of the compile service

- One source of at most 128 KiB, built as one of the eight example crates, with that crate's dependencies and no others. The build runs without network access and stops after 120 seconds.
- The module may be at most 1 MiB, but one operation carries at most 64 KiB, so a module that deploys stays below that.
- Six builds a minute from one address. Builds wait in a short queue, and a full queue answers that the service is busy.

## With an AI assistant {#ai}

The playground’s **AI assistants** page ([`#/ai`]({{playground}}#/ai)) holds a reference for ChatGPT, Claude, Gemini and other AI assistants: how Ksana contracts run, every function of the [contract SDK](/docs/contract-sdk/), gas, limits, the token standards, the ABI block and complete contracts, in one Markdown file that the repository’s tests hold to the code. Copy it, download it, or open it as text at [{{origin}}/llms-contracts.txt]({{origin}}/llms-contracts.txt), and give it to the assistant before you ask for a contract. The page has prompts to start from.

On an example’s **Code** tab, **Copy for an AI assistant** copies the reference together with the source in the editor, the page and the crate it builds as, and the compiler’s messages about that source, ending with what the assistant is to do: fix the errors, or what you ask next. **Only the code and errors** leaves the reference out, for a conversation that already has it. The text is English, which assistants follow best; copied from the Chinese page, it asks for answers in Chinese.

The assistant answers with a whole `src/lib.rs` and the page that builds it: the Counter page for a contract on the plain SDK, the KS-20 token, NFT or AMM page for one that uses the token standards. Paste it into that page’s **Code** tab and compile it before you deploy.

## The ABI block

A contract describes its methods to the playground in its own documentation: a fenced block marked `abi` in the `//!` comment at the top of `src/lib.rs`, one declaration per line, with an optional `//` description. The counter's:

````rust
//! ```abi
//! init()                          // starts the count at 0
//! call increment() -> u64         // adds one; returns the new count
//! call add(amount: u64) -> u64    // adds 1 to 1000 at a time; returns the new count
//! view get() -> u64               // the count
//! event changed(by: Account, value: u64)
//! ```
````

- `init` runs once, at deployment; `call` declares a method that changes state, sent as an operation; `view` one that only reads, run without a signature. `payable` before `init` or `call` means the method takes attached funds.
- `struct` and `enum` declare the types the methods use, and `event` the events the contract emits.
- Types: the integers `u8` to `u128` and `i8` to `i128`, `bool`, `String`, `Bytes`, `[u8; N]`, `Account`, `ContractId`, `AssetId`, `Hash`, `TokenId` (32 bytes each), `Option<T>`, `Vec<T>`, tuples, `()`, and the declared structs and enums; not an `Option` directly inside an `Option`, whose `Some(None)` would read as `None`. Arguments and results are Borsh, as for every Ksana contract ([Contracts](/docs/contracts/)).

The block is documentation for people as well: rustdoc shows it as a code block. A source without one still compiles and deploys, but gets no forms.

## Open a contract

A contract's page in the [wallet's explorer](/docs/wallet/#history-and-the-explorer) offers **Open in the playground**. A deployment of an example opens on that example's page; any other contract gets forms once you paste its source, or just its ABI block. On the playground's home, **Any contract** does the same with a contract ID.

## Things to know

- The playground runs on the signet only. Signet KSA has no value, and the examples are for learning, not audited software.
- A failed operation still pays its fee and uses its nonce.
- The page remembers the contracts you deployed or opened, and the operations it sent, for each chain, which it names by its genesis block: after a network starts again from genesis, it lists none of the contracts from before.
- Each write is recorded in this browser before it is sent. An operation whose answer was lost keeps its nonce reserved until the node shows it; **Release this nonce** removes only that local reservation and cancels nothing, since another node may still include the old operation. Clearing the site's data loses this protection.
