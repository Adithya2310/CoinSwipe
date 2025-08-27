# Backend Structure (CoinSwipe on Base)

## Overview
For the MVP, we are keeping the architecture **frontend-only** with direct integration to **Supabase** for persistence.  
No custom backend (e.g., Node/Express with Socket.io) is required initially.  
A clean **service layer** in the frontend ensures we can migrate to a backend later if needed.

---

## Database Schema (Supabase)

### users
| Column         | Type        | Notes                             |
|----------------|-------------|-----------------------------------|
| address        | text (PK)   | Wallet address (primary key)      |
| email          | text        | Optional (for login/notifications)|
| default_amount | numeric     | Default trade amount (ETH), default = 0.01 |
| created_at     | timestamptz | Auto                              |

### portfolio
| Column        | Type     | Notes                                     |
|---------------|----------|-------------------------------------------|
| user_address  | text FK → users.address | Primary key (one per user) |
| tokens        | jsonb    | Array of Token objects (holdings)         |
| updated_at    | timestamptz | Auto                                   |

### watchlist
| Column        | Type     | Notes                                     |
|---------------|----------|-------------------------------------------|
| user_address  | text FK → users.address | Primary key (one per user) |
| tokens        | jsonb    | Array of Token objects (starred tokens)   |
| updated_at    | timestamptz | Auto                                   |

### activities
| Column        | Type     | Notes                                      |
|---------------|----------|--------------------------------------------|
| id            | uuid (PK)| Unique activity id                         |
| user_address  | text FK → users.address |                              |
| token         | jsonb    | Token object (for trade reference)         |
| action        | text     | “BUY” / “SELL”                             |
| amount        | numeric  | Amount traded (ETH or token qty)           |
| created_at    | timestamptz | Timestamp of trade                      |

---

## Token Object (JSON Schema)

```json
{
  "address": "0x4200000000000000000000000000000000000006",
  "name": "Ethereum",
  "symbol": "ETH",
  "logo": "https://...",
  "price": 24.55,
  "amount": 2.5,
  "value_usd": 61.37
}
```

- In **portfolio** → `amount` and `value_usd` are required.  
- In **watchlist** → only metadata + price.  
- In **activities** → snapshot of token at time of action.

---

## Data Flow

1. **User Login**
   - Authenticate using MetaMask Embedded Wallet.
   - If new user → insert into `users` with `default_amount = 0.01`.

2. **Trending Tokens** (For MVP)
   - Fetch only tokens available on Base using the Dexscreener API.
   - Logic isolated in `/services/tokens.js`.

<!-- 2. **Trending Tokens**(Future Scope)
   - Fetch from **Base RPC (mainnet)** and price data via **Uniswap V3** or other Base DEX aggregators.
   - Logic isolated in `/services/tokens.js`. -->

3. **Trade (Swipe Right)**
   - Execute swap using Uniswap V3 or Base DEX aggregator.
   - On success:
     - Insert into `activities`.
     - Update `portfolio.tokens`.

4. **Watchlist (Star Icon)**
   - Add/remove token from `watchlist.tokens`.

5. **Portfolio View**
   - Query `portfolio.tokens` & `watchlist.tokens`.

---

## Frontend Service Organization

```
/src
  /services
    tokens.js   (fetch trending tokens from Base RPC/DEX aggregators)
    wallet.js   (MetaMask Embedded wallet integration for Base)
    supabase.js (helper for Supabase CRUD)
  /features
    Trending/   (swipe cards UI)
    Portfolio/  (holdings + watchlist)
  /utils
    tokenClass.js (Token object constructor/schema validation)
```

---

## Future Backend (Optional for v2)
- Node/Express server with Socket.io for real-time price updates.
- Cron workers for portfolio valuation refresh.
- APIs for token discovery, trending logic, and caching.
