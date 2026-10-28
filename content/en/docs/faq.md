---
title: Frequently asked questions
nav: FAQ
lede: Short answers to the questions people ask most about Ksana, each with a link to the page that explains more.
description: Answers about Ksana's design, mainnet, wallets, fees, finality, mining, censorship, Bitcoin reorgs, audits and KSA.
---

## About Ksana

### What is Ksana?

Ksana runs WebAssembly contracts on its own proof-of-work chain, the fast lane, and uses Bitcoin to store that chain's
data and to decide when its blocks are final. Operations are fast-confirmed in about 5 seconds, every block's data is
written to Bitcoin, and anyone can rebuild the whole state from a Bitcoin node alone. See
[How it works](/docs/how-it-works/).

### Is Ksana an L2?

Not in the usual sense, and it is not a sidechain or a rollup either. Unlike a sidechain, it has no peg: your bitcoin
never moves to Ksana, and Ksana's blocks become final only through data on Bitcoin. Unlike a rollup, no operator or
sequencer orders operations: producers compete by proof of work, and Bitcoin stores and orders the data without
executing it, while every Ksana node and indexer applies the rules itself. See [How it works](/docs/how-it-works/).

### Is there a bridge for BTC?

No. Ksana holds no one's bitcoin: BTC stays on Bitcoin, and a BTC transfer is an ordinary Bitcoin transaction. Contracts
can read Bitcoin headers and transactions instead, so a contract can act on a payment made on Bitcoin, as the exchange
contract does for top-ups. See [Bitcoin in contracts](/docs/bitcoin-in-contracts/).

### Is mainnet live?

No. Mainnet has not launched, and the public signet is the network to use. Most mainnet parameters are fixed and a few
wait on measurements, and before a launch the signet runs for at least four weeks without a consensus change. The work
that remains includes the mainnet genesis config, runs of paths B and C with real wallets on the signet, those
measurements, and an independent security audit. See [Public signet](/docs/signet/).

### Will the signet be reset?

It can be. A consensus change before mainnet restarts the signet from a new genesis config, and every balance starts
over; its coins have no value in any case. See [Public signet](/docs/signet/).

## Using Ksana

### Which wallets work?

Unisat and Xverse, switched to Bitcoin Signet, with a Taproot address (in Xverse, the Ordinals address). Your account
is that address, so other address types cannot hold KSA. On the command line, `ksana-cli` keeps its own key files, and
the TypeScript SDK signs with a key or through a wallet. See [Signet wallet](/docs/wallet/).

### Do I need KSA?

No. On path C you submit an operation in your own Bitcoin transaction and pay only its Bitcoin fee, and every producer
must include it once your transaction has its confirmations (2 on the signet). KSA lets you use path B, which confirms
in seconds; you can buy KSA with BTC in a top-up, and on the signet the faucet gives you some for free. See [Operations
and fees](/docs/submitting-ops/).

### How do I get test coins?

Test KSA comes from the faucet, in the web wallet or at `{{signet.faucet}}`: 100 KSA per account once a day. Signet
BTC comes free from any Bitcoin signet faucet, and you need a little of it for path C, top-ups and settling blocks you
produce. See [Public signet](/docs/signet/).

### What does an operation cost?

On path B you set a fee in KSA: a producer includes the operation when the fee reaches its packing floor (1 base unit
by default), producers fill blocks by fee rate, and `ksana-cli estimate-fee` (`ksana_estimateFee`) suggests an amount.
On path C you pay your transaction's Bitcoin fee: a plain transfer is about 330 virtual bytes, about 660 sats at
2 sat/vB, and a top-up about 381 virtual bytes. See [Operations and fees](/docs/submitting-ops/).

### Who pays the Bitcoin fees?

For path B, producers do. A settlement is a commit and reveal pair of about 320 to 380 virtual bytes plus a 240-sat
anchor output, about 1,000 sats at 2 sat/vB, and producers are paid in KSA: path B fees and block rewards, which unlock
once the data is on Bitcoin, with a share for the block's carrier, usually the producer whose settlement lands the data.
For path C and top-ups, you pay the fee of your own transaction. See [KSA and rewards](/docs/ksa/).

### When is my operation final?

On path B it is fast-confirmed in about 5 seconds, and on Bitcoin once the Bitcoin block that confirms its settlement is
mined. Once that data has 6 Bitcoin confirmations, about an hour after you send, every node decides the block final, and
reports it final five Bitcoin blocks later, once the Bitcoin block of that decision has 6 confirmations of its own:
about 110 minutes in all on signet and mainnet, whose Bitcoin blocks come about every 10 minutes. A path C operation
first waits for its own transaction's confirmations (2 on signet, 5 on mainnet) before a block includes it. See
[Confirmations](/docs/confirmations/).

### Do BTC and KSA share addresses?

Yes. Your Ksana account is your Taproot address, so the same key holds your bitcoin on Bitcoin and your KSA on Ksana,
each on its own chain. KSA sent to your address arrives in your Ksana account, and BTC sent to it arrives on Bitcoin.
See [Accounts](/docs/accounts/).

## Blocks and mining

### Why are idle blocks minutes apart?

Because of two-speed difficulty: a block with no entries needs 12 times the usual work, and each further empty block in
a row doubles that, up to 120 times. While nothing happens, blocks come about 1, 2, 4, 8 and then 10 minutes apart,
which keeps the number of headers written to Bitcoin low, and the reward per unit of time stays the same. The first
operation that arrives brings blocks back to about 5 seconds apart. See [Mining](/docs/mining/).

### Why Argon2id and not SHA-256?

Merged mining with Bitcoin was ruled out, because its proof of work would have to land on Bitcoin with every header. On
a chain of its own, SHA-256 would let rented Bitcoin mining hardware overwhelm the fast lane and would shut ordinary
computers out. Argon2id with 2 MiB of memory lets CPUs mine and browsers verify; GPUs keep an advantage, estimated at
10 to 30 times but not yet measured, far smaller than that of SHA-256 ASICs. See [Mining](/docs/mining/).

### Can I mine on my computer?

Yes. A node mines on one CPU thread when you give it `--producer` and your account, and the blocks it finds pay their
rewards to that account once their data is on Bitcoin. To settle your own blocks you also need a funding key holding a
little signet BTC; without one, other producers carry your blocks' data and take the carrier's share. See
[Mining](/docs/mining/).

### Can I run a node myself?

Yes. A node needs its own bitcoind on the same Bitcoin network, with `-txindex`; on signet its first sync takes a few
hours and about 30 GB of disk. The project develops on Ubuntu 22.04, and in its latest 10-hour devnet soak tests
each node ended at about 130 to 150 MiB of memory. Open TCP port 9000 if you want other nodes to connect to yours. See
[Run a node](/docs/run-a-node/).

## Safety

### Can producers censor me?

A producer can leave your path B operation out of its blocks, but any other producer can include it. Path C cannot be
left out: once your Bitcoin transaction has its confirmations, every block must include it, and a block that does not
is invalid. Bitcoin miners still decide when your transaction confirms, as for any Bitcoin transaction. See
[Security](/docs/security/#censorship).

### Can a payment be reversed?

Before it is final, yes: an attacker with a share of the fast lane's hashrate can reverse a fast-confirmed payment, with
a chance that falls with every minute you wait and is higher while the chain is idle. Rely on a fast confirmation only
for small amounts, wait about 5 minutes on a busy chain for moderate ones, and wait until final for large amounts or on
an idle chain. Undoing a final payment takes a reorganization of at least 6 Bitcoin blocks, which grows harder with
every Bitcoin block after it. See [Security](/docs/security/#payment-reversal).

### What if Bitcoin reorganizes?

A Bitcoin reorg of at most `ANCHOR_DEPTH` blocks (1 on signet, 2 on mainnet) leaves every Ksana block in place. A deeper
one takes the Ksana blocks anchored on the orphaned Bitcoin blocks off the main chain, and their operations are included
again on the new branch. A final block can be undone only by a Bitcoin reorg of at least 6 blocks, and each Bitcoin
block mined after it became final makes that harder. See [Security](/docs/security/#bitcoin-reorgs).

### What if a block never settles?

Other nodes land it for the producer: any node can broadcast the settlement the block carries, rebuild it with its own
funding if it is stuck, or republish the block's data, and later producers carry the data of blocks without a
settlement. Until it lands, the rewards and fees of that block and of every block after it stay locked, and after 6
Bitcoin blocks new blocks may hold only path C operations. A block whose data could not fit in a payload is invalid in
the first place. See [Security](/docs/security/#unsettled-data).

### What if every node vanished?

The chain's data stays on Bitcoin. An indexer rebuilds the whole state from a Bitcoin node alone, a new node with no
peers follows the finalized chain by rebuilding its blocks from Bitcoin data, and producers can mine on from there. Only
blocks whose data never reached Bitcoin would be lost, and none of them was final. See
[Run an indexer](/docs/run-an-indexer/).

### Has Ksana been audited?

Two internal security audits reviewed the code in October 2026, and their consensus fixes are now rules; the second
report is in the repository. They do not replace the independent audit that is listed before mainnet. Simulations,
fuzzing and long soak tests run alongside them. See [Security](/docs/security/#testing).

## KSA

### Is there a premine or sale?

Not in the protocol. Mainnet has no genesis allocation (a mainnet genesis config with one cannot start), and KSA comes
into existence only as block rewards. The signet's genesis allocation of 110,000,000 test KSA funds its faucet and its
operator, and is worth nothing. See [KSA and rewards](/docs/ksa/).
