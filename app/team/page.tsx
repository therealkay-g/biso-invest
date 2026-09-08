'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Profile, Referral, Commission } from '@/types'
import Header from '@/components/Header'
import CopyButton from '@/components/CopyButton'
import { TableSkeleton } from '@/components/Skeleton'
import { Users, Share2, Award, ArrowUpRight, TrendingUp, Sparkles } from 'lucide-react'

export default function TeamPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadTeam() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          window.location.href = '/auth/login'
          return
        }

        const { data: pData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(pData)

        if (pData) {
          const { data: refData } = await supabase
            .from('referrals')
            .select('*, child_profile:profiles(*)')
            .eq('parent_id', user.id)

          setReferrals(refData || [])

          const { data: comData } = await supabase
            .from('commissions')
            .select('*')
            .eq('beneficiary_id', user.id)
            .order('created_at', { ascending: false })

          setCommissions(comData || [])
        }
      } catch (err) {
        console.error('Error loading team:', err)
      } finally {
        setLoading(false)
      }
    }

    loadTeam()
  }, [])

  const referralLink = profile ? `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/register?ref=${profile.referral_code}` : ''

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header displayName="Mon Équipe" vipLevel="Chargement..." showBack={true} />
        <div className="p-4 max-w-4xl mx-auto space-y-6">
          <div className="h-44 bg-gray-200 rounded-3xl animate-pulse" />
          <TableSkeleton rows={4} />
        </div>
      </div>
    )
  }

  const teamA = referrals.filter(r => r.level === 'A')
  const teamB = referrals.filter(r => r.level === 'B')
  const teamC = referrals.filter(r => r.level === 'C')
  const teamD = referrals.filter(r => r.level === 'D')

  const totalCommissions = commissions.reduce((sum, c) => sum + c.commission_amount, 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <Header displayName="Mon Réseau & Équipe" vipLevel="Affiliation 4 Niveaux" showBack={true} />

      <div className="p-4 max-w-4xl mx-auto space-y-6">
        {/* Referral Gold Box */}
        <div className="bg-linear-to-br from-zinc-950 via-zinc-900 to-emerald-950 text-white rounded-3xl p-6 shadow-2xl border border-emerald-500/20 space-y-5">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-zinc-950 font-black flex items-center justify-center text-xs shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-wider">Programme Partenaire BISO</h3>
              <p className="text-[10px] text-zinc-400">Touchez jusqu'à 10% de commissions sur vos filleuls.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-[11px] uppercase text-zinc-400 font-bold block mb-1">Votre Code de Parrainage</span>
              <div className="flex items-center justify-between bg-white/5 border border-white/10 p-3 rounded-2xl backdrop-blur-xs">
                <span className="text-xl font-black text-amber-300 font-mono tracking-widest">{profile?.referral_code}</span>
                <CopyButton textToCopy={profile?.referral_code || ''} label="Copier Code" />
              </div>
            </div>

            <div>
              <span className="text-[11px] uppercase text-zinc-400 font-bold block mb-1">Votre Lien Unique d'Invitation</span>
              <div className="flex items-center justify-between bg-white/5 border border-white/10 p-3 rounded-2xl backdrop-blur-xs space-x-2">
                <span className="text-xs text-zinc-300 truncate font-mono">{referralLink}</span>
                <CopyButton textToCopy={referralLink} label="Copier Lien" />
              </div>
            </div>
          </div>
        </div>

        {/* Team Levels 4 Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs text-center space-y-1">
            <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              Niveau A • 10%
            </span>
            <p className="text-2xl font-black text-gray-900 tabular-nums">{teamA.length}</p>
            <p className="text-[10px] text-gray-400">Directs</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs text-center space-y-1">
            <span className="text-[10px] font-black uppercase text-biso-700 bg-biso-50 px-2 py-0.5 rounded-md">
              Niveau B • 3%
            </span>
            <p className="text-2xl font-black text-gray-900 tabular-nums">{teamB.length}</p>
            <p className="text-[10px] text-gray-400">Génération 2</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs text-center space-y-1">
            <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
              Niveau C • 1%
            </span>
            <p className="text-2xl font-black text-gray-900 tabular-nums">{teamC.length}</p>
            <p className="text-[10px] text-gray-400">Génération 3</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs text-center space-y-1">
            <span className="text-[10px] font-black uppercase text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
              Niveau D • 1%
            </span>
            <p className="text-2xl font-black text-gray-900 tabular-nums">{teamD.length}</p>
            <p className="text-[10px] text-gray-400">Génération 4</p>
          </div>
        </div>

        {/* Total Commissions Earned */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500 font-semibold">Total Commissions Réseau Cumulées</p>
            <p className="text-2xl font-black text-biso-700 mt-0.5 tabular-nums">
              {totalCommissions.toLocaleString('fr-FR')} FC
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Commissions History */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-4">
          <h3 className="font-black text-gray-900 text-sm">Historique des Gains d'Affiliation</h3>
          <div className="space-y-3">
            {commissions.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">
                Aucune commission enregistrée. Invitez vos proches pour commencer à générer des revenus d'équipe.
              </p>
            ) : (
              commissions.map((comm) => (
                <div key={comm.id} className="flex justify-between items-center p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                  <div>
                    <span className="text-[10px] font-black bg-biso-100 text-biso-800 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      Filleul Niveau {comm.level}
                    </span>
                    <p className="text-[11px] text-gray-500 mt-1">{new Date(comm.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-700 tabular-nums">
                      +{comm.commission_amount.toLocaleString('fr-FR')} FC
                    </p>
                    <span className="text-[10px] text-gray-400 font-semibold">Commission {comm.rate}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
