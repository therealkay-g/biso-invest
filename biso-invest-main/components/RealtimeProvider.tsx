'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Wallet, Profile } from '@/types'

interface RealtimeContextType {
  wallet: Wallet | null
  setWallet: (wallet: Wallet | null) => void
  profile: Profile | null
  isLoading: boolean
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined)

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let walletChannel: any
    let profileChannel: any

    async function initRealtime() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setIsLoading(false)
          return
        }

        // Initial fetch wallet
        const { data: initialWallet } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', user.id)
          .single()
        setWallet(initialWallet)

        // Initial fetch profile
        const { data: initialProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setProfile(initialProfile)

        // Subscribe to wallet updates
        walletChannel = supabase
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

        // Subscribe to profile updates (nom, VIP, statut)
        profileChannel = supabase
          .channel(`profile-realtime-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${user.id}`,
            },
            (payload: any) => {
              console.log('Realtime Profile Update:', payload)
              setProfile(payload.new as Profile)
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
      if (walletChannel) supabase.removeChannel(walletChannel)
      if (profileChannel) supabase.removeChannel(profileChannel)
    }
  }, [])

  return (
    <RealtimeContext.Provider value={{ wallet, setWallet, profile, isLoading }}>
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

export function useRealtimeProfile() {
  const context = useContext(RealtimeContext)
  if (context === undefined) {
    throw new Error('useRealtimeProfile must be used within a RealtimeProvider')
  }
  return context.profile
}
