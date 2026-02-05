# Crypto Payments – Implementation Note (MVP)

**TL;DR:** EVM wallet payments (Sepolia, Base Sepolia, Arbitrum Sepolia) are now supported in Polar checkouts. Flow is **frontend-initiated, backend-verified**: wallet + tx on the client, payment record + fulfillment on the server.

---

## What shipped

- **Backend:** New `PaymentProcessor.crypto`, org `crypto_settings` (per-chain recipient addresses), `create_from_crypto_transaction()`, checkout `confirm()` accepts crypto payload (`tx_hash`, `chain_id`, `from_address`).
- **Frontend:** New crypto module in `clients/packages/checkout/src/crypto/` (Wagmi/viem, RainbowKit): wallet connect, chain picker, send tx, confirmation polling, then call backend with `tx_hash`.
- **Flow:** User connects wallet → picks chain → signs & broadcasts → frontend waits for confirmations (3 on Ethereum, 2 on L2s) → POSTs `tx_hash` to backend → backend creates `Payment`, fulfills order, fires webhooks.

---

## Where to look

| Area | Path |
|------|------|
| Backend enum + org crypto settings | `server/polar/enums.py`, `models/organization.py` |
| Payment creation | `server/polar/payment/service.py` → `create_from_crypto_transaction()` |
| Checkout confirm | `server/polar/checkout/service.py` (crypto branch in `confirm()`), `checkout/schemas.py` → `CheckoutConfirmCrypto` |
| Migration | `server/migrations/versions/` → `*add_crypto*` |
| Frontend crypto | `clients/packages/checkout/src/crypto/` (config, hooks, `CryptoPaymentElement.tsx`), `CryptoProvider.tsx` |

---

## How to try it

1. Run migration: `cd server && uv run task db_migrate`
2. Set org crypto: `crypto_settings` with `enabled: true` and `ethereum_address` / `base_address` / `arbitrum_address`.
3. Use a checkout for that org; crypto option appears when crypto is enabled.
4. Testnet only: use Sepolia (or Base/Arbitrum Sepolia) and testnet ETH from a faucet.

---

## Current limits (MVP)

- **ETH only** for now (USDC/tokens planned).
- **Testnet only** (mainnet will need process/approval).
- **No backend tx verification** – we trust `tx_hash`; production should verify via RPC.
- **No UI for org crypto settings** – configure via DB/API for now.

---

## Security note

We rely on `tx_hash` as unique `processor_id` (idempotency). For production: add server-side verification of recipient, amount, and chain before fulfilling; consider rate limits and higher confirmation counts on mainnet.

---

Full design and file list: see `CRYPTO_INTEGRATION.md`.
