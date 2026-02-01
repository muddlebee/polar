'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { useCryptoPayment } from '../hooks/useCryptoPayment'
import { useTransactionMonitor } from '../hooks/useTransactionMonitor'
import { SUPPORTED_CHAINS } from '../config'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import Button from '@polar-sh/ui/components/atoms/Button'
import { cn } from '@polar-sh/ui/lib/utils'

// ============================================
// CRYPTO PAYMENT CONFIGURATION
// ============================================
// Set this to true to enable crypto payments
export const CRYPTO_ENABLED = true

// Test wallet addresses for each network (replace with real addresses in production)
const TEST_RECIPIENT_ADDRESSES: Record<number, `0x${string}`> = {
  11155111: '0x890d97E86E167B0D7130e9305F63601294CB4d44', // Ethereum Sepolia
  84532: '0x890d97E86E167B0D7130e9305F63601294CB4d44',    // Base Sepolia
  421614: '0x890d97E86E167B0D7130e9305F63601294CB4d44',   // Arbitrum Sepolia
}

// USDC token addresses on testnets
const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC on Sepolia
  84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',    // USDC on Base Sepolia
  421614: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',   // USDC on Arbitrum Sepolia
}

// For testing: Send only 0.01 USDC regardless of checkout amount
const USE_TEST_AMOUNT = true
const TEST_AMOUNT = '0.001' // 0.01 USDC for testing
// ============================================

interface CryptoPaymentElementProps {
  checkout: CheckoutPublic
  onPaymentSuccess: (txHash: string, chainId: number, fromAddress: string) => Promise<void>
  onPaymentError: (error: Error) => void
  disabled?: boolean
}

const WalletIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
  </svg>
)

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const ExternalLinkIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
)

const LoadingSpinner = ({ className }: { className?: string }) => (
  <svg
    className={cn('animate-spin', className)}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    width="16"
    height="16"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
)

export function CryptoPaymentElement({
  checkout,
  onPaymentSuccess,
  onPaymentError,
  disabled = false,
}: CryptoPaymentElementProps) {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain()
  const { pay, isPending: isPayPending, txHash, error: payError, reset: resetPayment } = useCryptoPayment()
  
  const [selectedChainId, setSelectedChainId] = useState<number>(11155111)
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentComplete, setPaymentComplete] = useState(false)

  const { confirmations, requiredConfirmations, isConfirmed } = useTransactionMonitor(
    txHash,
    selectedChainId
  )

  const selectedChain = useMemo(
    () => SUPPORTED_CHAINS.find((c) => c.id === selectedChainId),
    [selectedChainId]
  )

  const totalAmount = checkout.totalAmount ?? 0
  const currency = checkout.currency ?? 'usd'

  // Display amount (what user sees)
  const displayAmount = useMemo(() => {
    if (!totalAmount) return '0.00'
    return (totalAmount / 100).toFixed(2)
  }, [totalAmount])

  // Actual amount to send (for testing, use 0.01 USDC)
  const actualAmount = USE_TEST_AMOUNT ? TEST_AMOUNT : displayAmount

  const handleConnect = useCallback(async () => {
    setPaymentError(null)
    const injectedConnector = connectors.find((c) => c.id === 'injected')
    if (injectedConnector) {
      try {
        connect({ connector: injectedConnector })
      } catch (err) {
        setPaymentError('Failed to connect wallet. Please try again.')
      }
    } else {
      setPaymentError('No wallet detected. Please install MetaMask or another Web3 wallet.')
    }
  }, [connect, connectors])

  const handleDisconnect = useCallback(() => {
    disconnect()
    setPaymentError(null)
    setPaymentComplete(false)
    resetPayment?.()
  }, [disconnect, resetPayment])

  const handleChainSelect = useCallback(async (chainId: number) => {
    setSelectedChainId(chainId)
    setPaymentError(null)
    
    if (isConnected && chain?.id !== chainId) {
      try {
        switchChain({ chainId })
      } catch (err) {
        // User will see the "Switch Network" button if chain doesn't match
      }
    }
  }, [isConnected, chain?.id, switchChain])

  const handleSwitchNetwork = useCallback(async () => {
    setPaymentError(null)
    try {
      switchChain({ chainId: selectedChainId })
    } catch (err) {
      setPaymentError('Failed to switch network. Please switch manually in your wallet.')
    }
  }, [switchChain, selectedChainId])

  // Use hardcoded test addresses - skip backend validation for now
  const getRecipientAddress = useCallback((): `0x${string}` | null => {
    return TEST_RECIPIENT_ADDRESSES[selectedChainId] || null
  }, [selectedChainId])

  // Get USDC token address for selected chain
  const getTokenAddress = useCallback((): `0x${string}` | null => {
    return USDC_ADDRESSES[selectedChainId] || null
  }, [selectedChainId])

  const handlePay = useCallback(async () => {
    setPaymentError(null)
    
    const recipientAddress = getRecipientAddress()
    if (!recipientAddress) {
      setPaymentError('Network not supported.')
      return
    }

    const tokenAddress = getTokenAddress()
    if (!tokenAddress) {
      setPaymentError('USDC not available on this network.')
      return
    }

    if (!address) {
      setPaymentError('Please connect your wallet first.')
      return
    }

    setIsProcessing(true)

    try {
      const result = await pay({
        recipientAddress: recipientAddress as `0x${string}`,
        amount: actualAmount,
        chainId: selectedChainId,
        tokenAddress: tokenAddress,
      })

      if (result?.txHash) {
        await onPaymentSuccess(result.txHash, result.chainId, result.fromAddress)
      }
    } catch (err: any) {
      const errorMessage = err?.shortMessage || err?.message || 'Transaction failed. Please try again.'
      setPaymentError(errorMessage)
      onPaymentError(err as Error)
    } finally {
      setIsProcessing(false)
    }
  }, [pay, actualAmount, selectedChainId, address, getRecipientAddress, getTokenAddress, onPaymentSuccess, onPaymentError])

  useEffect(() => {
    if (isConfirmed && txHash && !paymentComplete) {
      setPaymentComplete(true)
      // Clear any previous errors on success
      setPaymentError(null)
    }
  }, [isConfirmed, txHash, paymentComplete])

  useEffect(() => {
    if (payError) {
      const errorMessage = (payError as any)?.shortMessage || payError?.message || 'Transaction failed'
      setPaymentError(errorMessage)
    }
  }, [payError])

  const isWrongNetwork = isConnected && chain?.id !== selectedChainId
  const isPending = isPayPending || isProcessing
  const canPay = isConnected && !isWrongNetwork && !isPending && !txHash && !disabled

  return (
    <div className="flex flex-col gap-y-4">
      {/* Wallet Connection */}
      {!isConnected ? (
        <div className="flex flex-col gap-y-3">
          <p className="dark:text-polar-400 text-sm text-gray-600">
            Connect your Web3 wallet to pay with cryptocurrency
          </p>
          <Button
            onClick={handleConnect}
            loading={isConnecting}
            disabled={disabled}
            variant="secondary"
            size="lg"
            className="w-full gap-x-2"
          >
            <WalletIcon className="h-5 w-5" />
            Connect Wallet
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-y-4">
          {/* Connected Wallet Display */}
          <div className="dark:bg-polar-800 dark:border-polar-700 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-x-3">
              <div className="dark:bg-polar-700 flex h-8 w-8 items-center justify-center rounded-full bg-gray-200">
                <WalletIcon className="dark:text-polar-400 h-4 w-4 text-gray-600" />
              </div>
              <div>
                <p className="dark:text-polar-400 text-xs text-gray-500">Connected</p>
                <p className="font-mono text-sm font-medium dark:text-white">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="text-sm font-medium text-red-500 transition-colors hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
            >
              Disconnect
            </button>
          </div>

          {/* Network Selection */}
          <div className="flex flex-col gap-y-2">
            <label className="dark:text-polar-300 text-sm font-medium text-gray-700">
              Network
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SUPPORTED_CHAINS.map((supportedChain) => {
                const isSelected = selectedChainId === supportedChain.id
                const isCurrentChain = chain?.id === supportedChain.id
                return (
                  <button
                    key={supportedChain.id}
                    onClick={() => handleChainSelect(supportedChain.id)}
                    disabled={isPending || !!txHash}
                    className={cn(
                      'relative flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                      isSelected
                        ? 'bg-blue-500 text-white dark:bg-blue-600'
                        : 'dark:bg-polar-800 dark:text-polar-300 dark:hover:bg-polar-700 bg-gray-100 text-gray-700 hover:bg-gray-200',
                      (isPending || !!txHash) && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    {supportedChain.name.replace(' Sepolia', '')}
                    {isSelected && isCurrentChain && (
                      <CheckIcon className="absolute right-2 h-4 w-4" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Payment Summary */}
          <div className="dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <span className="dark:text-polar-400 text-sm text-gray-600">Amount</span>
              <div className="text-right">
                <p className="text-lg font-semibold dark:text-white">
                  ${displayAmount} {currency.toUpperCase()}
                </p>
                <p className="dark:text-polar-500 text-xs text-gray-500">
                  Pay with {actualAmount} USDC
                </p>
              </div>
            </div>
          </div>

          {/* Transaction Status */}
          {txHash && (
            <div
              className={cn(
                'flex flex-col gap-y-3 rounded-xl p-4',
                isConfirmed
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-blue-50 dark:bg-blue-900/20'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-x-2">
                  {isConfirmed ? (
                    <CheckIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <LoadingSpinner className="text-blue-600 dark:text-blue-400" />
                  )}
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isConfirmed
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-blue-700 dark:text-blue-300'
                    )}
                  >
                    {isConfirmed ? 'Payment Confirmed' : 'Confirming Transaction'}
                  </span>
                </div>
                <span
                  className={cn(
                    'font-mono text-sm',
                    isConfirmed
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-blue-600 dark:text-blue-400'
                  )}
                >
                  {confirmations}/{requiredConfirmations}
                </span>
              </div>
              
              <a
                href={`${selectedChain?.blockExplorer}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center gap-x-1 text-sm transition-colors',
                  isConfirmed
                    ? 'text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300'
                    : 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
                )}
              >
                View on Explorer
                <ExternalLinkIcon />
              </a>
            </div>
          )}

          {/* Error Message */}
          {paymentError && !txHash && (
            <div className="rounded-xl bg-red-50 p-4 dark:bg-red-900/20">
              <p className="text-sm text-red-600 dark:text-red-400">{paymentError}</p>
            </div>
          )}

          {/* Action Button */}
          {!txHash && (
            <>
              {isWrongNetwork ? (
                <Button
                  onClick={handleSwitchNetwork}
                  loading={isSwitchingChain}
                  disabled={disabled}
                  size="lg"
                  className="w-full"
                >
                  Switch to {selectedChain?.name || 'Network'}
                </Button>
              ) : (
                <Button
                  onClick={handlePay}
                  loading={isPending}
                  disabled={!canPay}
                  size="lg"
                  className="w-full"
                >
                  Pay {actualAmount} USDC (${displayAmount})
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
