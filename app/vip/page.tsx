'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { VipLevel, Profile, Wallet } from '@/types'
import Header from '@/components/Header'
import { ShieldCheck, Lock, CheckCircle2 } from 'lucide-react'

export default function VipPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [vipLevels, setVipLevels] = useState<VipLevel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadVip() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          window.location.href = '/auth/login'
          return
        }

        const { data: pData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(pData)

        const { data: wData } = await supabase.from('wallets').select('*').eq('user_id', user.id).single()
        setWallet(wData)

        const { data: vData } = await supabase.from('vip_levels').select('*').order('display_order')
        
        // Paliers officiels demandés : VIP1=30 000 FC, VIP2=50 000 FC, VIP3=100 000 FC, VIP4=250 000 FC
        const OFFICIAL_VIP: Record<string, { min_investment: number; max_packs: number; benefits: string }> = {
          VIP0: { min_investment: 0, max_packs: 1, benefits: 'Condition 0 FC — Maximum 1 pack' },
          VIP1: { min_investment: 30000, max_packs: 3, benefits: 'Pack 30 000 FC — Maximum 3 packs' },
          VIP2: { min_investment: 50000, max_packs: 5, benefits: 'Pack 50 000 FC — Maximum 5 packs' },
          VIP3: { min_investment: 100000, max_packs: 8, benefits: 'Pack 100 000 FC — Maximum 8 packs' },
          VIP4: { min_investment: 250000, max_packs: 10, benefits: 'Pack 250 000 FC — Maximum 10 packs' },
        }

        const normalizedLevels = (vData || []).map((v) => {
          if (OFFICIAL_VIP[v.level_name]) {
            return {
              ...v,
              ...OFFICIAL_VIP[v.level_name],
            }
          }
          return v
        })

        setVipLevels(normalizedLevels)
      } catch (err) {
        console.error('Error loading VIP:', err)
      } finally {
        setLoading(false)
      }
    }

    loadVip()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-biso-600"></div>
      </div>
    )
  }

  const activeVipLevels = vipLevels.filter(v => v.is_active)
  const currentTotalInvested = wallet?.total_invested || 0

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header displayName="Niveaux VIP" vipLevel={profile?.current_vip || 'VIP0'} showBack={true} />

      <div className="p-4 max-w-4xl mx-auto space-y-6">
        {/* Current VIP Status Card */}
        <div className="bg-gradient-to-br from-biso-800 to-biso-950 text-white rounded-2xl p-6 shadow-xl space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs uppercase text-biso-300 font-semibold">Votre Niveau VIP Actuel</span>
            <span className="bg-biso-600 text-white px-3 py-1 rounded-full text-xs font-bold">
              {profile?.current_vip || 'VIP0'}
            </span>
          </div>
          <div>
            <p className="text-sm text-biso-200">Total Investi : <strong className="text-white">{currentTotalInvested.toLocaleString('fr-FR')} FC</strong></p>
          </div>
        </div>

        {/* Levels list */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-800 text-sm">Avantages & Niveaux Actifs</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activeVipLevels.map((vip) => {
              const isCurrent = profile?.current_vip === vip.level_name
              const isUnlocked = currentTotalInvested >= vip.min_investment

              return (
                <div key={vip.id} className={`bg-white p-5 rounded-2xl border shadow-xs space-y-3 ${isCurrent ? 'border-biso-500 ring-2 ring-biso-500/20' : 'border-gray-100'}`}>
                  <div className="flex justify-between items-center">
                    <h4 className="font-extrabold text-gray-900 text-base">{vip.level_name}</h4>
                    {isCurrent ? (
                      <span className="text-xs bg-biso-100 text-biso-800 font-bold px-2.5 py-1 rounded-full flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-biso-600" />
                        <span>Actuel</span>
                      </span>
                    ) : isUnlocked ? (
                      <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full">Atteint</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 font-bold px-2.5 py-1 rounded-full flex items-center space-x-1">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Verrouillé</span>
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-gray-600">
                    <p>Condition d'accès : <strong className="text-gray-900">{vip.min_investment.toLocaleString('fr-FR')} FC</strong></p>
                    <p>Maximum de packs : <strong className="text-gray-900">{vip.max_packs} packs</strong></p>
                    <p className="text-gray-500">{vip.benefits}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
