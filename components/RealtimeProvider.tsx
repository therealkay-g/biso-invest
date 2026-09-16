'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Wallet } from '@/types'

interface RealtimeContextType {
  wallet: Wallet | null
  setWallet: (wallet: Wallet | null) => void
  isLoading: boolean
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined)

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let channel: any

    async function initRealtime() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setIsLoading(false)
          return
        }

        // Initial fetch
        const { data: initialWallet } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', user.id)
          .single()
        setWallet(initialWallet)

        // Subscribe to updates
        channel = supabase
          .channel(`wallet-realtime-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'wallets',
              filter: `user_id=eq.${user.id}`,
            },
            (payload: any) => {
              console.log('Realtime Wallet Update:', payload)
              setWallet(payload.new as Wallet)
            }
          )
          .subscribe()
      } catch (err) {
        console.error('Realtime Provider Error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    initRealtime()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  return (
    <RealtimeContext.Provider value={{ wallet, setWallet, isLoading }}>
      {children}
    </RealtimeContext.Provider>
  )
}

export function useRealtimeWallet() {
  const context = useContext(RealtimeContext)
  if (context === undefined) {
    throw new Error('useRealtimeWallet must be used within a RealtimeProvider')
  }
  return context
}
