# Capx Liquid Subgraph

[Capx Liquid](https://liquid.capx.fi/) is a decentralized platform that allows project teams, investors, and other vesting token holders to vest tokens using a "Smart Vesting Contract". This subgraph dynamically tracks any vesting schedule created by project teams, investors, or token holders, maintaining the state of vesting schedules.

## Example Query
#### Querying Derivatives Information of Capx Liquid subgraph

This query fetches aggregated data from all derivatives created by the protocol for each project. 

```graphql
{
        projects {
          nodes {
            id
            projectName
            projectTokenTicker
            projectOwnerAddress
            projectTokenAddress
            projectTokenDecimal
            projectDocHash
            derivative {
              nodes {
                id
                wrappedTokenTicker
                unlockTime
                totalSupply
              }
            }
            lock {
              nodes {
                id
                vestID
                address
                tokenAmount
                unlockTime
              }
            }
          }
        }
    }
```
## Query URLs

#### Karura

| Subgraph     | Query URL  |
|---------------------|--------------------------------------------------------------------|
| Liquid Subgraph     | https://api.subquery.network/sq/capxdev/capx-liquid	 |
