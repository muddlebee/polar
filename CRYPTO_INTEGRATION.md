# Crypto Payment Integration - MVP Implementation

## Overview

This MVP enables EVM wallet payments (Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia) for Polar checkouts. The integration follows a **frontend-initiated, backend-verified** architecture where:

- **Frontend**: Handles wallet connection, transaction signing, and blockchain interaction (using viem/wagmi)
- **Backend**: Records payment data, fulfills orders, and triggers webhooks

## Architecture

### Frontend-Driven Flow
```
1. Customer connects wallet (MetaMask, WalletConnect, etc.)
2. Customer selects chain (Sepolia/Base/Arbitrum)
3. Frontend creates transaction with recipient address from org settings
4. Customer signs & broadcasts transaction
5. Frontend monitors confirmations (3 for Ethereum, 2 for L2s)
6. Once confirmed, frontend calls backend with tx_hash
7. Backend creates Payment record → triggers order fulfillment
```

### Why Frontend-Heavy?

- **Wallet libraries are TypeScript-native** (viem, wagmi, WalletConnect)
- **Blockchain is public** - frontend can verify transactions directly via RPC
- **Consistent with Stripe pattern** - Stripe.js creates tokens, backend confirms
- **Better UX** - real-time feedback, wallet integration, gas estimation
- **Simpler backend** - minimal Python code, no heavy blockchain libraries needed

## Backend Changes

### 1. Models (`server/polar/`)

**New Enum** (`enums.py`):
```python
class PaymentProcessor(StrEnum):
    stripe = "stripe"
    crypto = "crypto"  # ← Added
```

**Organization Settings** (`models/organization.py`):
```python
class OrganizationCryptoSettings(TypedDict):
    enabled: bool
    ethereum_address: str | None  # Sepolia testnet
    base_address: str | None      # Base Sepolia
    arbitrum_address: str | None  # Arbitrum Sepolia

# Stored in organizations.crypto_settings (JSONB)
```

### 2. Payment Service (`payment/service.py`)

**New Method**:
```python
async def create_from_crypto_transaction(
    session: AsyncSession,
    *,
    tx_hash: str,           # Unique blockchain transaction hash
    chain_id: int,          # 11155111 (Sepolia), 84532 (Base), 421614 (Arbitrum)
    from_address: str,      # Customer's wallet address
    amount: int,            # Amount in cents
    currency: str,          # "eth" or "usdc"
    token_address: str | None,  # ERC-20 contract (None for native ETH)
    checkout: Checkout | None,
    order: Order | None,
) -> Payment
```

- Creates `Payment` record with `processor=crypto`
- Uses `tx_hash` as unique `processor_id` (prevents double-spend)
- Stores chain metadata in `method_metadata`

### 3. Checkout Service (`checkout/service.py`)

**Extended `confirm()` method**:
- Handles `CheckoutConfirmCrypto` schema (tx_hash, chain_id, from_address)
- Creates payment record
- Immediately calls `handle_success()` → creates order → triggers benefits

**Key difference from Stripe**:
- **Stripe**: Creates PaymentIntent, waits for webhook
- **Crypto**: Payment already confirmed on-chain, immediately fulfill

### 4. Schemas (`checkout/schemas.py`)

```python
class CheckoutConfirmCrypto(CheckoutConfirmBase):
    tx_hash: str               # 0x[64 hex chars]
    chain_id: int              # Chain ID
    from_address: str          # 0x[40 hex chars]
    token_address: str | None  # Optional for ERC-20
```

### 5. Database Migration

```bash
# Applied migration adds:
organizations.crypto_settings JSONB NOT NULL DEFAULT '{...}'
```

## Frontend Changes

### 1. New Dependencies (`clients/packages/checkout/package.json`)

```json
{
  "dependencies": {
    "viem": "^2.28.0",
    "wagmi": "^2.19.0",
    "@wagmi/core": "^2.19.0",
    "@wagmi/connectors": "^5.5.0",
    "@rainbow-me/rainbowkit": "^2.2.10",
    "@tanstack/react-query": "^5.64.2"
  }
}
```

### 2. Crypto Module (`src/crypto/`)

**config.ts** - Wagmi configuration:
- Supported chains: Sepolia, Base Sepolia, Arbitrum Sepolia
- Injected (MetaMask) + WalletConnect connectors
- USDC contract addresses per chain
- Confirmation thresholds (3 for Ethereum, 2 for L2s)

**hooks/useCryptoPayment.ts**:
```typescript
const { pay, txHash, isPending, isConfirming, isConfirmed } = useCryptoPayment()

await pay({
  recipientAddress: '0x...',
  amount: '10.00',  // USD amount
  chainId: 11155111,
  tokenAddress: undefined,  // ETH payment (USDC coming later)
})
```

**hooks/useTransactionMonitor.ts**:
- Polls blockchain for confirmations every 3 seconds
- Returns `{ confirmations, requiredConfirmations, isConfirmed }`

**components/CryptoPaymentElement.tsx**:
- Wallet connection UI
- Chain selector (Sepolia/Base/Arbitrum)
- Transaction submission button
- Real-time confirmation tracker
- Block explorer link

### 3. Provider (`src/providers/CryptoProvider.tsx`)

Wraps app with Wagmi + React Query:
```typescript
<CryptoProvider>
  <CheckoutProvider>
    {children}
  </CheckoutProvider>
</CryptoProvider>
```

## Configuration

### Organization Setup

Organizations need to configure their receiving addresses in settings:

```typescript
{
  "crypto_settings": {
    "enabled": true,
    "ethereum_address": "0x1234...",  // Where to receive Sepolia ETH/USDC
    "base_address": "0x5678...",      // Where to receive Base Sepolia ETH/USDC
    "arbitrum_address": "0x9abc..."   // Where to receive Arbitrum Sepolia ETH/USDC
  }
}
```

### Environment Variables (Frontend)

```bash
# Optional: Custom WalletConnect project ID
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

Get your project ID at: https://cloud.walletconnect.com/

## Testing

### Prerequisites

1. **Testnet wallet** with Sepolia ETH:
   - Get from https://sepoliafaucet.com/ or https://faucets.chain.link/

2. **MetaMask** or compatible wallet installed

### Test Flow

1. **Backend**: Run migrations
   ```bash
   cd server
   uv run task db_migrate
   ```

2. **Configure organization**:
   ```sql
   UPDATE organizations 
   SET crypto_settings = '{
     "enabled": true,
     "ethereum_address": "0xYOUR_ADDRESS_HERE",
     "base_address": "0xYOUR_ADDRESS_HERE",
     "arbitrum_address": "0xYOUR_ADDRESS_HERE"
   }'::jsonb
   WHERE slug = 'your-org';
   ```

3. **Start dev servers**:
   ```bash
   # Terminal 1 - Backend
   cd server
   uv run task api

   # Terminal 2 - Frontend
   cd clients
   pnpm dev
   ```

4. **Create checkout** with crypto-enabled org

5. **Pay with crypto**:
   - Connect wallet
   - Select Sepolia network
   - Click "Pay [amount] ETH"
   - Confirm transaction in wallet
   - Wait for confirmations (shown in UI)
   - Order automatically fulfilled!

## Network Details

| Network | Chain ID | RPC | Faucet | Explorer |
|---------|----------|-----|--------|----------|
| Ethereum Sepolia | 11155111 | Public | sepoliafaucet.com | sepolia.etherscan.io |
| Base Sepolia | 84532 | Public | docs.base.org/docs/tools/network-faucets | sepolia.basescan.org |
| Arbitrum Sepolia | 421614 | Public | faucet.quicknode.com/arbitrum/sepolia | sepolia.arbiscan.io |

## Current Limitations (MVP)

1. **ETH payments only** - USDC/token support coming next
2. **No automatic recurring** - crypto can't do "save card & charge later"
3. **Testnet only** - need org approval process for mainnet
4. **Manual address entry** - no UI for org settings yet
5. **No backend verification** - trusts tx_hash (audit job recommended for production)

## Production Roadmap

### Phase 2: Token Support
- Add ERC-20 token transfers (USDC, USDT, DAI)
- Price oracle integration for volatile tokens (ETH, native currencies)
- Multi-token support in checkout UI

### Phase 3: Verification & Security
- Background job to verify transactions on-chain
- Admin dashboard "verify" button
- Rate limiting on crypto confirmations
- Fraud detection (wallet blacklists, transaction patterns)

### Phase 4: Mainnet
- Mainnet chain support
- Organization approval workflow
- KYC/AML compliance checks
- Higher confirmation thresholds
- Gas price estimation

### Phase 5: Advanced Features
- Smart contract allowances for recurring payments
- Gasless transactions (meta-transactions)
- Multi-sig organization wallets
- Automatic crypto → fiat conversion
- Refund handling workflow

## Files Changed

### Backend
- `server/polar/enums.py` - Added `PaymentProcessor.crypto`
- `server/polar/models/organization.py` - Added `crypto_settings`
- `server/polar/models/payment.py` - Supports crypto processor
- `server/polar/payment/service.py` - `create_from_crypto_transaction()`
- `server/polar/checkout/service.py` - Handle crypto in `confirm()`
- `server/polar/checkout/schemas.py` - `CheckoutConfirmCrypto`
- `server/migrations/versions/2026-01-30-2056_add_crypto_*.py` - Migration

### Frontend  
- `clients/packages/checkout/package.json` - Added viem, wagmi, etc.
- `clients/packages/checkout/src/crypto/` - New crypto module
  - `config.ts` - Wagmi setup
  - `hooks/useCryptoPayment.ts` - Payment hook
  - `hooks/useTransactionMonitor.ts` - Confirmation tracker
  - `components/CryptoPaymentElement.tsx` - UI component
- `clients/packages/checkout/src/providers/CryptoProvider.tsx` - Provider wrapper
- `clients/packages/checkout/src/providers/index.ts` - Export provider

## Security Considerations

### What We Trust
- **Blockchain is source of truth** - transaction hash is unique & immutable
- **Public verification** - anyone can verify tx on block explorer
- **Idempotency** - `tx_hash` is unique in database (prevents double-credit)

### What We Don't Verify (Yet)
- ❌ Recipient address matches org settings (frontend responsibility)
- ❌ Amount matches checkout total (frontend responsibility)  
- ❌ Token contract is correct (frontend responsibility)

### Recommendations for Production
1. **Add backend verification** - Verify tx details via RPC before fulfilling
2. **Audit trail** - Log all crypto payments for manual review
3. **Rate limiting** - Prevent abuse of confirmation endpoint
4. **Wallet reputation** - Check against blacklists (Chainalysis, TRM Labs)
5. **Higher confirmations** - Use 12+ for mainnet Ethereum
6. **Multi-sig wallets** - Organizations should use Gnosis Safe for receiving funds

## Questions?

This MVP demonstrates the architecture. Ready to:
1. Test the payment flow
2. Add ERC-20 token support
3. Implement backend verification
4. Build org settings UI
5. Prepare for mainnet launch
