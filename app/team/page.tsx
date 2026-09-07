'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Profile, Referral, Commission } from '@/types'
import Header from '@/components/Header'
import { Users, Copy, Share2, Award, ArrowUpRight } from 'lucide-react'

export default function TeamPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [copied, setCopied] = useState(false)
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-biso-600"></div>
      </div>
    )
  }

  const teamA = referrals.filter(r => r.level === 'A')
  const teamB = referrals.filter(r => r.level === 'B')
  const teamC = referrals.filter(r => r.level === 'C')
  const teamD = referrals.filter(r => r.level === 'D')

  const totalCommissions = commissions.reduce((sum, c) => sum + c.commission_amount, 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header displayName="Mon Équipe" vipLevel="Parrainage 4 Niveaux" />

      <div className="p-4 max-w-4xl mx-auto space-y-6">
        {/* Referral Box */}
        <div className="bg-gradient-to-br from-biso-800 to-biso-950 text-white rounded-2xl p-6 shadow-xl space-y-4">
          <div>
            <span className="text-xs uppercase text-biso-300 font-semibold">Votre Code de Parrainage</span>
            <div className="flex items-center justify-between mt-1 bg-biso-900/80 p-3 rounded-xl border border-biso-700">
              <span className="text-xl font-extrabold tracking-wider">{profile?.referral_code}</span>
              <button
                onClick={() => copyToClipboard(profile?.referral_code || '')}
                className="bg-biso-500 hover:bg-biso-600 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center space-x-1"
              >
                <Copy className="w-4 h-4" />
                <span>{copied ? 'Copié !' : 'Copier'}</span>
              </button>
            </div>
          </div>

          <div>
            <span className="text-xs uppercase text-biso-300 font-semibold">Votre Lien d'Invitation</span>
            <div className="flex items-center justify-between mt-1 bg-biso-900/80 p-3 rounded-xl border border-biso-700">
              <span className="text-xs text-biso-200 truncate mr-2">{referralLink}</span>
              <button
                onClick={() => copyToClipboard(referralLink)}
                className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2 rounded-lg shrink-0 flex items-center space-x-1"
              >
                <Share2 className="w-4 h-4" />
                <span>Lien</span>
              </button>
            </div>
          </div>
        </div>

        {/* Team Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs text-center">
            <span className="text-xs text-gray-500">Équipe A (10%)</span>
            <p className="text-xl font-bold text-gray-900 mt-1">{teamA.length}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs text-center">
            <span className="text-xs text-gray-500">Équipe B (3%)</span>
            <p className="text-xl font-bold text-gray-900 mt-1">{teamB.length}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs text-center">
            <span className="text-xs text-gray-500">Équipe C (1%)</span>
            <p className="text-xl font-bold text-gray-900 mt-1">{teamC.length}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs text-center">
            <span className="text-xs text-gray-500">Équipe D (1%)</span>
            <p className="text-xl font-bold text-gray-900 mt-1">{teamD.length}</p>
          </div>
        </div>

        {/* Total Commissions */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Commissions Gagnées</p>
            <p className="text-2xl font-extrabold text-biso-600 mt-0.5">{totalCommissions.toLocaleString('fr-FR')} FC</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-biso-50 text-biso-600 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Commissions History */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
          <h3 className="font-bold text-gray-800 text-sm">Historique des Commissions</h3>
          <div className="space-y-3">
            {commissions.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">Aucune commission pour le moment.</p>
            ) : (
              commissions.map((comm) => (
                <div key={comm.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-none">
                  <div>
                    <span className="text-xs font-bold bg-biso-100 text-biso-800 px-2 py-0.5 rounded-md">Niveau {comm.level}</span>
                    <p className="text-xs text-gray-500 mt-1">{new Date(comm.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-600">+{comm.commission_amount.toLocaleString('fr-FR')} FC</p>
                    <span className="text-[10px] text-gray-400">Taux : {comm.rate}%</span>
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
