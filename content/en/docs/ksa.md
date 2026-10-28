---
title: KSA, rewards and fees
nav: KSA and rewards
lede: KSA is Ksana’s built-in token. It pays path B fees and rewards the producers who make blocks and land their data on Bitcoin. On mainnet all of it is issued as block rewards on a fixed schedule, capped at 210,000,000 KSA.
description: How KSA works. Base units and the 210,000,000 cap, issuance by reward slots and halving periods, who gets each slot, unlocking once data is on Bitcoin, where fees go, and the genesis of each network.
---

KSA is a built-in asset of Ksana’s virtual machine, not a contract: its name is `KSA`, its asset ID is 32 zero bytes, and it has 8 decimals. Amounts are whole numbers of **base units**, and 1 KSA is 100,000,000 base units. You need KSA for path B fees; path C uses bitcoin alone ([Operations and fees](/docs/submitting-ops/)).

```sh
export KSANA_RPC={{signet.rpc}}
ksana-cli --chain signet asset
```

```output
{
  "asset": "0000000000000000000000000000000000000000000000000000000000000000",
  "at": {
    "hash": "d436b257794aeaec071c01a339dd61d175e9959ce4d837ef5151a49e34ae434f",
    "height": "61"
  },
  "capabilities": [],
  "decimals": 8,
  "issuer": "0000000000000000000000000000000000000000000000000000000000000000",
  "name": "KSA",
  "paused": false,
  "symbol": "KSA",
  "total_supply": "11001412730000000"
}
```

On the signet that total is 110,014,127.3 KSA: the 110,000,000 KSA of its genesis allocations plus the rewards paid so far. Signet KSA has no value, and mainnet has not launched.

## Supply and issuance

::: figure supply
KSA issued over the first 40 years of mainnet: the halvings and the 210,000,000 KSA cap.
:::

New KSA comes into existence only as block rewards. On mainnet the cap is 210,000,000 KSA (`KSA_MAX_SUPPLY`), there is no genesis allocation, and the reward schedule adds up to the cap: every slot of every period together pays 209,999,996 KSA, 4 KSA short because integer halving rounds down. The cap is also enforced when rewards are paid, so the total supply can never pass it.

### Reward slots

Rewards follow the DAA score, which grows by each block’s weight and advances one unit per 5 seconds on target. A block with entries has weight 1; an empty block has weight 12 to 120 ([Mining](/docs/mining/) explains why). A block of weight w takes w **reward slots**, the w DAA scores up to its own, and each slot pays the reward of its halving period: 4.2 KSA in mainnet’s first period. Empty and non-empty blocks therefore earn the same per unit of time, so producers gain nothing by making empty blocks on purpose, or by breaking a run of them.

The main-chain block and the blue blocks it merges are rewarded. Red blocks, the ones GHOSTDAG judges to have stayed out of sight too long, get no block reward, though the path B fees in them are still paid.

### Halving periods

The reward per slot halves at the end of each period. On mainnet a period is twice as long as the one before at each of the first two halvings, and from then on every period lasts 8 years:

| Period | About | KSA per slot | Issued by its end |
| --- | --- | --- | --- |
| 0 | Years 0 to 2 | 4.2 | 52,500,000 (25%) |
| 1 | Years 2 to 6 | 2.1 | 105,000,000 (50%) |
| 2 | Years 6 to 14 | 1.05 | 157,500,000 (75%) |
| 3 | Years 14 to 22 | 0.525 | 183,750,000 (87.5%) |
| 4 | Years 22 to 30 | 0.2625 | 196,875,000 (93.75%) |
| 5 to 28 | 8 years each | Half the period before | 209,999,996 (about 100%) |

Periods are counted in DAA score (12,500,000, then 25,000,000, then 50,000,000 each), so the years assume the 5-second target. The last base unit is paid in period 28, and from DAA score 1,387,500,000, about 220 years in, the reward is zero.

The signet and devnet use other values: 9.9 KSA per slot, periods of 25,228,800 DAA score (about 4 years) that all have the same length, and a cap of 1,000,000,000 KSA, which leaves room for test allocations. [Parameters](/docs/parameters/) lists every value.

## Who gets each slot

Each slot is paid when its block unlocks. The block’s carrier gets 5% of it, 0.21 KSA in mainnet’s first period and 0.495 KSA on the signet, and the producer gets the rest, apart from the block share that slots carry while the protocol’s rules set one, paid to the account the genesis config names. When the block has no carrier, or its producer is its carrier, the producer keeps the carrier’s part too. If a payout runs into the cap, the block share is paid first, then the carrier, and the producer takes what remains.

### The carrier

The **carrier** of a block is whoever first landed its data on Bitcoin. For a settlement, that is the producer of the block that carried it; for a republish, the payee it names, but only when the data lands more than `ANCHOR_DEPTH` + 2 Bitcoin blocks above the block’s anchor (more than 3 on the signet, more than 4 on mainnet), so that nobody earns by racing to land data that its own producer was about to land. The carrier gets 5% of each slot of the block (`CARRIER_BPS`) and half of the block’s path B fees (`CARRIER_FEE_BPS`).

Landing other blocks’ data costs bitcoin, and the carrier reward pays for it: that is what lets one settlement per Bitcoin block carry the data of many blocks. In mainnet’s first period, carriers together earn at most about 3,629 KSA a day from rewards. A rescue copies the original payload, so the original carrier keeps the reward and the rescuer pays without income.

## Paid at unlock

Rewards and path B fees are not credited when a block is made. They are paid at **unlock**: a later main-chain block carries an unlock entry that pays everything up to some position, and it may reach a block only once the data of that block and of every block before it is on Bitcoin. Until then they show under `locked_fees` in `ksana_getAccount`. Here is a signet producer’s list:

```sh
ksana-cli --chain signet account tb1penqxc08g69mt8sgp8rw5uuy88yu6n3kuq4vh73d2ec28aukq057s0vh4h2 \
  | jq '.locked_fees[0:4]'
```

```output
[
  {
    "amount": "9504000000",
    "block_hash": "4e84fb7c6994100d9182bb223c5fc185eeefc48b4572b85944f0a11f2b50a6e5"
  },
  {
    "amount": "19008000000",
    "block_hash": "ade1d16fe24a8426c8044347828d451604770174aaecedc1c0509d27741909cf"
  },
  {
    "amount": "95040000000",
    "block_hash": "794b6cdc4b766205404b3845f0629294ad65a9842154ae860c2d43e8ebea76ad"
  },
  {
    "amount": "19008000000",
    "block_hash": "64f7c7796e8c4dd91bd9e38f7d1a6be9c4de409dcc25d50c8e426cf27af75331"
  }
]
```

All four are empty blocks this producer made, of weight 12, 24, 120 and 24, so they pay 12, 24, 120 and 24 slots: the producer’s share together with the carrier’s, because it landed their data itself or nobody has landed it yet. When it lands another producer’s block first, the list also holds that block’s carrier part: 5% of each slot, 0.495 KSA on the signet. The node projects these amounts from the current chains, so one can still change, for example when another producer’s settlement lands a block’s data first.

Paying only after the data is on Bitcoin makes producers want every block’s data landed, their own and everyone else’s: one block with missing data holds back the income of every block after it.

## Where fees go

- **Path B fees** (KSA): taken from you before the operation runs, locked with the block, and paid at unlock, half to the block’s carrier and half to its producer (all to the producer when it carried its own block or nobody qualifies as carrier).
- **Bitcoin fees for settlements**: paid in BTC by whoever lands the data, usually the producer whose block carries the settlement. Producers earn KSA and pay bitcoin; an exchange contract lets them sell KSA for bitcoin.
- **Path C fees**: paid in BTC to Bitcoin miners only. Producers receive no fee for them.

Nothing is burned: fees go to producers and carriers in full. A contract can burn KSA it holds with `asset_burn`, which lowers the total supply.

## Genesis

| Network | Genesis allocation | Block share account |
| --- | --- | --- |
| mainnet | None: the rewards alone reach the cap | A placeholder that no node accepts, to be filled in before launch |
| signet | 100,000,000 KSA to the faucet, 10,000,000 KSA to the operator | Set in `signet/genesis.json` |
| devnet | 10,000 KSA to a test account, written by `devnet/init.sh` | A generated account |

On mainnet no KSA exists before the first block, and every KSA after it is a block reward. The full rules are in [SPEC §8.5]({{repo}}/blob/main/docs/SPEC.md#85-locking-and-cumulative-unlock-of-sponsored-fees) (unlocking) and [§8.6]({{repo}}/blob/main/docs/SPEC.md#86-ksa-and-block-rewards) (KSA and block rewards).
