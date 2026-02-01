import { useState, useCallback } from 'react'
import { useAccount, usePublicClient, useSendTransaction, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { parseUnits, type Address, type Hash, encodeFunctionData } from 'viem'
import { CONFIRMATION_THRESHOLDS } from '../config'

// ERC-20 Transfer ABI
const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export interface CryptoPaymentParams {
  recipientAddress: Address
  amount: string
  chainId: number
  tokenAddress?: Address
}

export interface CryptoPaymentResult {
  txHash: Hash
  chainId: number
  fromAddress: Address
  tokenAddress: Address | null
}

export function useCryptoPayment() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { 
    sendTransactionAsync, 
    data: nativeTxHash, 
    isPending: isNativePending, 
    error: nativeSendError,
    reset: resetNative
  } = useSendTransaction()
  
  const {
    writeContractAsync,
    data: tokenTxHash,
    isPending: isTokenPending,
    error: tokenSendError,
    reset: resetToken,
  } = useWriteContract()

  const txHash = nativeTxHash || tokenTxHash
  const isPending = isNativePending || isTokenPending
  const sendError = nativeSendError || tokenSendError
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations: txHash ? CONFIRMATION_THRESHOLDS[publicClient?.chain?.id ?? 11155111] : undefined,
  })

  const [paymentResult, setPaymentResult] = useState<CryptoPaymentResult | null>(null)

  const pay = useCallback(
    async (params: CryptoPaymentParams): Promise<CryptoPaymentResult> => {
      if (!isConnected || !address) {
        throw new Error('Wallet not connected')
      }

      if (!publicClient || publicClient.chain?.id !== params.chainId) {
        throw new Error('Wrong network selected. Please switch to the correct network.')
      }

      const { recipientAddress, amount, tokenAddress } = params

      let hash: Hash

      if (tokenAddress) {
        // ERC-20 token transfer (USDC)
        // USDC uses 6 decimals
        const decimals = 6
        const value = parseUnits(amount, decimals)

        hash = await writeContractAsync({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [recipientAddress, value],
        })
      } else {
        // Native ETH transfer
        const decimals = 18
        const value = parseUnits(amount, decimals)

        hash = await sendTransactionAsync({
          to: recipientAddress,
          value,
        })
      }

      const result: CryptoPaymentResult = {
        txHash: hash,
        chainId: params.chainId,
        fromAddress: address,
        tokenAddress: tokenAddress || null,
      }

      setPaymentResult(result)
      return result
    },
    [isConnected, address, publicClient, sendTransactionAsync, writeContractAsync]
  )

  const reset = useCallback(() => {
    resetNative()
    resetToken()
  }, [resetNative, resetToken])

  return {
    pay,
    txHash,
    isPending,
    isConfirming,
    isConfirmed,
    paymentResult,
    error: sendError,
    reset,
  }
}
