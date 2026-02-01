Great question! Let me clarify the **fund flow** and what's missing:

## Current Implementation: Non-Custodial (Direct to Merchant)

**What Happens Now:**
```
Customer Wallet → [Polar UI] → Organization's Wallet (directly)
                       ↓
                  Records payment
                  Fulfills order
```

**Polar NEVER holds the crypto** - it goes directly from customer to organization.

### What's Missing: Organization Wallet Setup UI

Right now, organizations need to manually configure their wallet addresses. Let me show you what needs to be added:

**1. Organization Settings Page** (needs to be built):
```typescript
// In dashboard: /dashboard/{org}/settings/crypto-payments

<form>
  <h2>Crypto Payment Settings</h2>
  
  <Toggle name="enabled" label="Enable Crypto Payments" />
  
  <Input 
    label="Ethereum Sepolia Address"
    placeholder="0x..."
    pattern="^0x[a-fA-F0-9]{40}$"
    helperText="Where customers' Sepolia ETH/USDC will be sent"
  />
  
  <Input 
    label="Base Sepolia Address"
    helperText="You can use the same address for all chains"
  />
  
  <Input 
    label="Arbitrum Sepolia Address"
  />
  
  <Alert>
    ⚠️ Use a wallet YOU control. Recommended:
    - MetaMask
    - Ledger hardware wallet
    - Gnosis Safe multi-sig
    
    Never use an exchange address for direct payments.
  </Alert>
  
  <Button>Save Addresses</Button>
</form>
```

**2. API Endpoint to Update Settings** (needs to be built):
```python
# server/polar/organization/endpoints.py

@router.patch("/{id}/crypto-settings")
async def update_crypto_settings(
    id: UUID,
    settings: CryptoSettingsUpdate,
    auth_subject: OrganizationWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Update organization crypto payment settings"""
    # Validate addresses are valid EVM addresses
    # Update organization.crypto_settings
    # Return updated org
```

### Typical Organization Setup Flow

**Step 1: Organization Creates/Connects Wallet**
```
Option A: Use existing wallet (most common)
- Already has MetaMask/Ledger
- Just copy address from wallet
- Paste into Polar settings

Option B: Create new wallet for business
1. Install MetaMask
2. Create new wallet
3. Backup seed phrase (CRITICAL!)
4. Copy address
5. Add to Polar settings

Option C: Multi-sig for teams (recommended for big orgs)
1. Create Gnosis Safe
2. Add team members as signers
3. Copy Safe address
4. Add to Polar settings
```

**Step 2: Organization Enables Crypto Payments**
```
1. Go to Dashboard → Settings → Payments
2. Toggle "Enable Crypto Payments" ON
3. Enter wallet address(es)
4. Save
5. Polar validates addresses & enables crypto checkout option
```

**Step 3: Customer Pays**
```
Customer → Polar Checkout → Connects wallet → Sends ETH
                                                  ↓
                                    Org's wallet receives ETH
                                                  ↓
                                    Polar records tx_hash
                                                  ↓
                                    Order fulfilled
```

### Current State: Manual Configuration

For testing right now, you'd need to:

```sql
-- Manually set wallet address in database
UPDATE organizations 
SET crypto_settings = jsonb_set(
  crypto_settings,
  '{enabled}',
  'true'
) || jsonb_build_object(
  'ethereum_address', '0xYOUR_WALLET_ADDRESS',
  'base_address', '0xYOUR_WALLET_ADDRESS',
  'arbitrum_address', '0xYOUR_WALLET_ADDRESS'
)
WHERE slug = 'your-org';
```

### What Should I Build Next?

**Option 1: Settings UI (Quick Win)**
Add a form in the dashboard for orgs to input addresses. This is essential for MVP.

**Option 2: Wallet Validation**
Validate addresses on the backend:
```python
from eth_utils import is_address

def validate_evm_address(address: str) -> bool:
    return is_address(address)
```

**Option 3: Guided Setup Wizard**
Walk orgs through:
1. "Do you have a crypto wallet?"
2. If no: "Here's how to create one"
3. If yes: "Enter your address"
4. Test payment (send 0.001 ETH to verify)

**Option 4: Wallet Connection (Advanced)**
Let orgs connect their wallet to Polar, sign a message to prove ownership, then automatically populate addresses.

Want me to build the **Settings UI + API endpoint** so organizations can actually configure their wallets through the dashboard? That's the critical missing piece for the full flow!