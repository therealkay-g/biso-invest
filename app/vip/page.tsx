'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { VipLevel, Profile, Wallet } from '@/types'
import Header from '@/components/Header'
import Reveal from '@/components/Reveal'
import ProgressBar from '@/components/ProgressBar'
import Confetti from '@/components/Confetti'
import { Crown, Lock, CheckCircle2, Sparkles, TrendingUp, Gem, Award } from 'lucide-react'

const TIER_STYLES: Record<string, { ring: string; badge: string; crown: string; glow: string; label: string }> = {
  VIP0: {
    ring: 'border-gray-200',
    badge: 'bg-gray-100 text-gray-600',
    crown: 'text-gray-400',
    glow: 'from-gray-100 to-gray-50',
    label: 'Découverte',
  },
  VIP1: {
    ring: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
    crown: 'text-emerald-500',
    glow: 'from-emerald-50 to-white',
    label: 'Bronze',
  },
  VIP2: {
    ring: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    crown: 'text-amber-400',
    glow: 'from-amber-50 to-white',
    label: 'Or',
  },
  VIP3: {
    ring: 'border-sky-200',
    badge: 'bg-sky-100 text-sky-700',
    crown: 'text-sky-500',
    glow: 'from-sky-50 to-white',
    label: 'Platine',
  },
  VIP4: {
    ring: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
    crown: 'text-purple-500',
    glow: 'from-purple-50 to-white',
    label: 'Eldorado',
  },
}

export default function VipPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [vipLevels, setVipLevels] = useState<VipLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !profile?.current_vip) return
    const stored = localStorage.getItem('biso_confetti_vip')
    if (stored && stored !== profile.current_vip) {
      setShowConfetti(true)
    }
    localStorage.setItem('biso_confetti_vip', profile.current_vip)
  }, [profile?.current_vip])

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

        // Paliers officiels : VIP0=0, VIP1=20 000, VIP2=50 000, VIP3=100 000, VIP4=250 000
        const OFFICIAL_VIP: Record<string, { min_investment: number; max_packs: number; benefits: string }> = {
          VIP0: { min_investment: 0, max_packs: 1, benefits: 'Accessible à tous — Maximum 1 pack actif' },
          VIP1: { min_investment: 20000, max_packs: 3, benefits: 'Investissement cumulé de 20 000 FC — Maximum 3 packs' },
          VIP2: { min_investment: 50000, max_packs: 5, benefits: 'Investissement cumulé de 50 000 FC — Maximum 5 packs' },
          VIP3: { min_investment: 100000, max_packs: 8, benefits: 'Investissement cumulé de 100 000 FC — Maximum 8 packs' },
          VIP4: { min_investment: 250000, max_packs: 10, benefits: 'Investissement cumulé de 250 000 FC — Maximum 10 packs' },
        }

        const normalizedLevels = (vData || []).map((v: VipLevel) => {
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
    <div className="min-h-screen bg-gray-50 pb-28 page-enter">
      <Header displayName="Niveaux VIP" vipLevel={profile?.current_vip || 'VIP0'} showBack={true} />

      <div className="p-4 max-w-4xl mx-auto space-y-5">
        {/* Statut VIP actuel */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 text-white rounded-3xl p-6 shadow-xl border border-emerald-500/30 animate-fade-in">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-400/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-8 -bottom-8 w-28 h-28 bg-white/5 rounded-full blur-xl pointer-events-none" />

          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-emerald-200 font-bold">Votre niveau actuel</p>
              <div className="flex items-center space-x-2 mt-1.5">
                <Crown className="w-6 h-6 text-amber-300" aria-hidden="true" />
                <span className="text-3xl font-black text-white">
                  {profile?.current_vip || 'VIP0'}
                </span>
              </div>
              <p className="text-[11px] text-emerald-100 mt-1">
                {TIER_STYLES[profile?.current_vip || 'VIP0']?.label || 'Membre'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-emerald-200 font-bold">Investi au total</p>
              <p className="text-2xl font-black text-amber-300 mt-1.5 tabular-nums">
                {currentTotalInvested.toLocaleString('fr-FR')} FC
              </p>
            </div>
          </div>

          {/* Progression */}
          <div className="relative mt-5">
            <div className="flex justify-between text-[10px] font-bold pb-1.5">
              {['VIP0', 'VIP1', 'VIP2', 'VIP3', 'VIP4'].map((lvl, i) => {
                const level = vipLevels.find(v => v.level_name === lvl)
                const reached = profile && vipLevels.findIndex(v => v.level_name === profile.current_vip) >= (i - 1) || currentTotalInvested >= (level?.min_investment || 0)
                const isCurrent = profile?.current_vip === lvl
                return (
                  <div key={lvl} className="flex flex-col items-center gap-1">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        isCurrent
                          ? 'bg-amber-400 text-emerald-950 shadow-lg'
                          : reached
                            ? 'bg-white/20 text-white'
                            : 'bg-white/10 text-white/40'
                      }`}
                    >
                      {reached ? <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> : <Lock className="w-3 h-3" aria-hidden="true" />}
                    </span>
                    <span className={isCurrent ? 'text-white' : reached ? 'text-emerald-100' : 'text-white/40'}>{lvl}</span>
                  </div>
                )
              })}
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <ProgressBar
                value={Math.min(currentTotalInvested, 250000)}
                max={250000}
                duration={700}
                className="h-1.5 bg-white/10"
                barClassName="h-full bg-gradient-to-r from-amber-300 to-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Paliers VIP */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-gray-900 text-sm uppercase tracking-wider">Paliers & avantages</h3>
            <span className="text-[10px] font-bold text-gray-400 flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
              <span>Débloquez votre potentiel</span>
            </span>
          </div>

          <div className="space-y-2.5">
            {activeVipLevels.map((vip, vIdx) => {
              const style = TIER_STYLES[vip.level_name] || TIER_STYLES.VIP0
              const isCurrent = profile?.current_vip === vip.level_name
              const isUnlocked = currentTotalInvested >= vip.min_investment
              const isNext = !isUnlocked && !isCurrent

              return (
                <Reveal key={vip.id} delay={vIdx * 60} axis="x" from={8} fromLeft>
                <div
                  className={`relative overflow-hidden bg-white rounded-3xl border p-4 shadow-sm transition-all ${
                    isCurrent ? `${style.ring} ring-2 ring-offset-1 vip-current` : style.ring
                  }`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${style.glow} pointer-events-none`} />

                  <div className="relative flex items-center gap-4">
                    <span className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-white to-gray-50 border flex items-center justify-center shrink-0 shadow-sm ${style.crown}`}>
                      <Crown className="w-6 h-6" aria-hidden="true" />
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-black text-gray-900 text-base">{vip.level_name}</h4>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${style.badge}`}>
                          {style.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">{vip.benefits}</p>
                    </div>

                    {isCurrent ? (
                      <span className="shrink-0 inline-flex items-center space-x-1 text-[10px] font-black bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full">
                        <Award className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Actuel</span>
                      </span>
                    ) : isUnlocked ? (
                      <span className="shrink-0 inline-flex items-center space-x-1 text-[10px] font-black bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Atteint</span>
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center space-x-1 text-[10px] font-black bg-gray-100 text-gray-400 px-3 py-1.5 rounded-full">
                        <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Verrouillé</span>
                      </span>
                    )}
                  </div>

                  <div className="relative mt-3.5 grid grid-cols-2 gap-2">
                    <div className="bg-white/70 backdrop-blur-sm border border-black/5 rounded-2xl p-3">
                      <p className="text-[10px] text-gray-400 font-bold">Condition d&apos;accès</p>
                      <p className="text-sm font-black text-gray-900 tabular-nums mt-0.5">
                        {vip.min_investment.toLocaleString('fr-FR')} FC
                      </p>
                      {isNext && (
                        <p className="text-[10px] text-amber-600 font-bold mt-1 tabular-nums">
                          Plus que {Math.max(vip.min_investment - currentTotalInvested, 0).toLocaleString('fr-FR')} FC
                        </p>
                      )}
                    </div>
                    <div className="bg-white/70 backdrop-blur-sm border border-black/5 rounded-2xl p-3">
                      <p className="text-[10px] text-gray-400 font-bold">Packs simultanés</p>
                      <p className="text-sm font-black text-gray-900 tabular-nums mt-0.5">
                        {vip.max_packs} packs
                      </p>
                      <p className="text-[10px] text-gray-400 font-bold mt-1">
                        <span className="inline-flex items-center space-x-0.5 text-emerald-600">
                          <Gem className="w-3 h-3" aria-hidden="true" />
                          <span>Plus d&apos;engagements</span>
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
                </Reveal>
              )
            })}
          </div>
        </section>

        {/* Note */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" aria-hidden="true" />
            <h4 className="font-black text-gray-900 text-sm">Comment monter de niveau ?</h4>
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Votre niveau VIP est calculé sur le <strong className="text-gray-800">total investi</strong> dans vos packs.
            Chaque augmentation de votre niveau débloque davantage de packs actifs et maximise vos revenus.
          </p>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Rendez-vous sur la page <strong className="text-gray-800">Investir</strong> pour choisir un nouveau pack et progresser.
          </p>
        </div>
      </div>

      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
    </div>
  )
}