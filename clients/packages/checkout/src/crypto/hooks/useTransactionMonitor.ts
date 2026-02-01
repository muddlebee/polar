import { useState, useEffect } from 'react'
import { usePublicClient, type Hash } from 'wagmi'
import { CONFIRMATION_THRESHOLDS } from '../config'

export interface TransactionStatus {
  confirmations: number
  requiredConfirmations: number
  isConfirmed: boolean
  blockNumber?: bigint
}

export function useTransactionMonitor(txHash: Hash | undefined, chainId: number) {
  const publicClient = usePublicClient({ chainId })
  const [status, setStatus] = useState<TransactionStatus>({
    confirmations: 0,
    requiredConfirmations: CONFIRMATION_THRESHOLDS[chainId] ?? 2,
    isConfirmed: false,
  })

  useEffect(() => {
    if (!txHash || !publicClient) return

    let isActive = true

    const checkTransaction = async () => {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash })
        const currentBlock = await publicClient.getBlockNumber()
        
        if (!receipt) {
          return
        }

        const confirmations = Number(currentBlock - receipt.blockNumber) + 1
        const requiredConfirmations = CONFIRMATION_THRESHOLDS[chainId] ?? 2
        const isConfirmed = confirmations >= requiredConfirmations

        if (isActive) {
          setStatus({
            confirmations,
            requiredConfirmations,
            isConfirmed,
            blockNumber: receipt.blockNumber,
          })
        }

        // Keep polling until confirmed
        if (!isConfirmed && isActive) {
          setTimeout(checkTransaction, 3000) // Poll every 3 seconds
        }
      } catch (error) {
        console.error('Error monitoring transaction:', error)
        // Retry after error
        if (isActive) {
          setTimeout(checkTransaction, 5000)
        }
      }
    }

    checkTransaction()

    return () => {
      isActive = false
    }
  }, [txHash, publicClient, chainId])

  return status
}
