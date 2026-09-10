'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Profile, ReferralTask, ReferralTaskStats, ReferralTaskReward } from '@/types'
import Header from '@/components/Header'
import { useToast } from '@/components/ToastProvider'
import { Sparkles, Users, Share2, Gift, Award, CheckCircle2, Lock, History, Copy, ArrowRight } from 'lucide-react'

export default function TaskPage() {
  const toast = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<ReferralTaskStats | null>(null)
  const [history, setHistory] = useState<ReferralTaskReward[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth/login'
        return
      }

      const { data: pData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(pData)

      const { data: sData, error: sError } = await supabase.rpc('get_referral_task_data')
      if (!sError) {
        setStats(sData as ReferralTaskStats)
      }

      const { data: hData } = await supabase
        .from('referral_task_rewards')
        .select('*')
        .order('claimed_at', { ascending: false })

      setHistory(hData || [])
    } catch (err) {
      console.error('Erreur chargement tâches:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const invitationLink = profile
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?recommendCode=${profile.referral_code}`
    : ''

  const copyToClipboard = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(message)
    } catch {
      toast.error('Impossible de copier')
    }
  }

  const shareLink = async () => {
    if (!invitationLink) return
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'BISO INVEST',
          text: 'Rejoins BISO INVEST et investis avec moi !',
          url: invitationLink,
        })
      } catch {
        await copyToClipboard(invitationLink, 'Lien d\u2019invitation copié')
      }
    } else {
      await copyToClipboard(invitationLink, 'Lien d\u2019invitation copié')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header displayName="Mes Tâches" vipLevel="Chargement..." showBack={true} />
        <div className="p-4 max-w-4xl mx-auto space-y-6">
          <div className="h-52 bg-biso-100 rounded-3xl animate-pulse" />
          <div className="h-32 bg-gray-200 rounded-2xl animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-28 bg-gray-200 rounded-2xl animate-pulse" />
            <div className="h-28 bg-gray-200 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  const validInvites = stats?.valid_invites || 0
  const nextReward = stats?.next_reward

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <Header displayName="Tâche" vipLevel={profile?.current_vip || 'VIP0'} showBack={true} />

      <div className="p-4 max-w-4xl mx-auto space-y-6">
        {/* Grande carte violette — Mon équipe */}
        <div className="bg-gradient-to-br from-biso-700 via-biso-800 to-biso-950 text-white rounded-3xl p-6 shadow-2xl border border-biso-500/30 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">Mon équipe</h3>
                <p className="text-[10px] text-biso-200">Invite, investissez, gagnez ensemble.</p>
              </div>
            </div>
            <span className="bg-biso-600 text-white px-3 py-1 rounded-full text-xs font-bold">
              {validInvites} membre{validInvites > 1 ? 's' : ''} valide{validInvites > 1 ? 's' : ''}
            </span>
          </div>

          <div>
            <span className="text-[11px] uppercase text-biso-300 font-bold block mb-1">Votre lien personnel d&apos;invitation</span>
            <div className="flex items-center justify-between bg-white/5 border border-white/10 p-3 rounded-2xl backdrop-blur-sm space-x-2">
              <span className="text-[11px] text-biso-200 truncate font-mono">{invitationLink}</span>
              <button
                onClick={() => copyToClipboard(invitationLink, 'Lien d\u2019invitation copié')}
                className="shrink-0 text-amber-300 hover:text-amber-200 transition-colors"
                aria-label="Copier le lien"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={shareLink}
              className="w-full bg-white text-biso-800 hover:bg-biso-50 font-black py-3.5 rounded-2xl text-xs tracking-wider uppercase shadow-md transition-all active:scale-98 flex items-center justify-center space-x-2"
            >
              <Share2 className="w-4 h-4" />
              <span>Copier et partager le lien</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => copyToClipboard(profile?.referral_code || '', 'Code d\u2019invitation copié')}
                className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-3 rounded-2xl text-[11px] tracking-wider uppercase transition-all active:scale-98 flex items-center justify-center space-x-1.5"
              >
                <Gift className="w-3.5 h-3.5" />
                <span>Copier le code</span>
              </button>
              <button
                onClick={shareLink}
                className="bg-amber-400 hover:bg-amber-300 text-biso-950 font-bold py-3 rounded-2xl text-[11px] tracking-wider uppercase shadow-md transition-all active:scale-98 flex items-center justify-center space-x-1.5"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Inviter des amis</span>
              </button>
            </div>
          </div>
        </div>

        {/* Statistiques de l'équipe */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-center space-y-1">
            <p className="text-xl font-black text-gray-900 tabular-nums">{stats?.total_team || 0}</p>
            <p className="text-[10px] text-gray-400 font-semibold">Mon équipe</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm text-center space-y-1">
            <p className="text-xl font-black text-emerald-600 tabular-nums">{validInvites}</p>
            <p className="text-[10px] text-gray-400 font-semibold">Invitations valides</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-center space-y-1">
            <p className="text-xl font-black text-amber-600 tabular-nums">{stats?.pending_invites || 0}</p>
            <p className="text-[10px] text-gray-400 font-semibold">En attente</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-biso-100 shadow-sm text-center space-y-1">
            <p className="text-xl font-black text-biso-700 tabular-nums">{(stats?.total_rewards || 0).toLocaleString('fr-FR')}</p>
            <p className="text-[10px] text-gray-400 font-semibold">Total récompenses</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-center space-y-1 col-span-2 sm:col-span-1">
            <p className="text-xl font-black text-purple-600 tabular-nums">
              {nextReward ? `${nextReward.required_invites.toLocaleString('fr-FR')} inv.` : '—'}
            </p>
            <p className="text-[10px] text-gray-400 font-semibold">Prochaine récompense</p>
          </div>
        </div>

        {/* Progression vers la prochaine récompense */}
        {nextReward && (
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-gray-700">Prochaine récompense</span>
              <span className="text-xs font-black text-biso-700">
                {validInvites} / {nextReward.required_invites.toLocaleString('fr-FR')}
              </span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-biso-600 to-biso-400 rounded-full transition-all"
                style={{ width: `${Math.min((validInvites / nextReward.required_invites) * 100, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-500">
              Encore {Math.max(nextReward.required_invites - validInvites, 0)} invitation(s) valide(s) pour gagner{' '}
              <strong className="text-gray-800">{nextReward.reward_amount.toLocaleString('fr-FR')} FC</strong>.
            </p>
          </div>
        )}

        {/* Cartes de récompenses */}
        <div>
          <h3 className="font-bold text-gray-800 text-sm mb-3">Récompenses des tâches</h3>
          <div className="space-y-3">
            {(stats?.tasks || []).map((task: ReferralTask) => {
              const pct = Math.min((Math.min(validInvites, task.required_invites) / task.required_invites) * 100, 100)
              return (
                <div
                  key={task.id}
                  className={`bg-white p-5 rounded-2xl border shadow-sm space-y-3 ${
                    task.claimed ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-100'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-black text-gray-900">{task.required_invites} invitation{task.required_invites > 1 ? 's' : ''} valide{task.required_invites > 1 ? 's' : ''}</p>
                      <p className="text-xs text-biso-700 font-semibold mt-0.5">Récompense : {task.reward_amount.toLocaleString('fr-FR')} FC</p>
                    </div>
                    {task.claimed ? (
                      <span className="flex items-center space-x-1 text-[10px] font-black bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full uppercase">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Attribué</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-[10px] font-black bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full uppercase">
                        <Lock className="w-3.5 h-3.5" />
                        <span>En cours</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                      <span>Progression</span>
                      <span className="font-bold tabular-nums">
                        {Math.min(validInvites, task.required_invites)} / {task.required_invites}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-biso-600 to-biso-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className={`w-full py-3 rounded-2xl text-xs font-black tracking-wider uppercase text-center ${
                    task.claimed ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {task.claimed ? 'Créditée automatiquement' : 'Attribuée automatiquement dès validation'}
                  </div>
                </div>
              )
            })}
            {(stats?.tasks || []).length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6 bg-white rounded-2xl border border-gray-100">
                Aucune tâche disponible pour le moment.
              </p>
            )}
          </div>
        </div>

        {/* Revenus des tâches d'invitation */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-500 font-semibold">Revenus des tâches d&apos;invitation (CDF)</p>
              <p className="text-2xl font-black text-biso-700 mt-0.5 tabular-nums">
                {(stats?.total_rewards || 0).toLocaleString('fr-FR')} FC
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 font-bold py-3 rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2"
          >
            <History className="w-4 h-4" />
            <span>Voir l&apos;historique</span>
            <ArrowRight className={`w-3.5 h-3.5 transition-transform ${showHistory ? 'rotate-90' : ''}`} />
          </button>

          {showHistory && (
            <div className="space-y-2.5 pt-1">
              {history.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">
                  Aucune récompense réclamée pour le moment.
                </p>
              )}
              {history.map((r) => (
                <div key={r.id} className="flex justify-between items-center p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                  <div>
                    <span className="text-[10px] font-black bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      Tâche {r.required_invites} invitation{r.required_invites > 1 ? 's' : ''}
                    </span>
                    <p className="text-[11px] text-gray-500 mt-1">{new Date(r.claimed_at).toLocaleString('fr-FR')}</p>
                  </div>
                  <p className="text-sm font-black text-emerald-600 tabular-nums">
                    +{r.reward_amount.toLocaleString('fr-FR')} FC
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}