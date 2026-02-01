import { http, createConfig } from 'wagmi'
import type { Config } from 'wagmi'
import { sepolia, baseSepolia, arbitrumSepolia } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

// WalletConnect project ID - organizations should provide their own
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

export const config: Config = createConfig({
  chains: [sepolia, baseSepolia, arbitrumSepolia],
  connectors: [
    injected(),
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      metadata: {
        name: 'Polar Checkout',
        description: 'Pay with crypto on Polar',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://polar.sh',
        icons: ['https://polar.sh/favicon.ico'],
      },
    }),
  ],
  transports: {
    // Free public RPCs (rpc.sepolia.org is often slow/overloaded; PublicNode/thirdweb are more reliable)
    [sepolia.id]: http('https://ethereum-sepolia-rpc.publicnode.com'),
    [baseSepolia.id]: http('https://84532.rpc.thirdweb.com'),
    [arbitrumSepolia.id]: http('https://arbitrum-sepolia-rpc.publicnode.com'),
  },
})

// Chain configurations for crypto payments
export const SUPPORTED_CHAINS = [
  {
    id: sepolia.id,
    name: 'Ethereum Sepolia',
    nativeCurrency: sepolia.nativeCurrency,
    blockExplorer: sepolia.blockExplorers?.default.url,
  },
  {
    id: baseSepolia.id,
    name: 'Base Sepolia',
    nativeCurrency: baseSepolia.nativeCurrency,
    blockExplorer: baseSepolia.blockExplorers?.default.url,
  },
  {
    id: arbitrumSepolia.id,
    name: 'Arbitrum Sepolia',
    nativeCurrency: arbitrumSepolia.nativeCurrency,
    blockExplorer: arbitrumSepolia.blockExplorers?.default.url,
  },
] as const

// USDC token addresses on testnets
export const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  [sepolia.id]: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC on Sepolia
  [baseSepolia.id]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia
  [arbitrumSepolia.id]: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // USDC on Arbitrum Sepolia
}

// Confirmation requirements per chain (1 is enough for testnets; use higher for mainnet)
export const CONFIRMATION_THRESHOLDS: Record<number, number> = {
  [sepolia.id]: 1,
  [baseSepolia.id]: 1,
  [arbitrumSepolia.id]: 1,
}

export type SupportedChainId = typeof sepolia.id | typeof baseSepolia.id | typeof arbitrumSepolia.id
