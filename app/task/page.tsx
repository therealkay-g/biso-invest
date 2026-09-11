'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Profile, ReferralTask, ReferralTaskStats, ReferralTaskReward } from '@/types'
import Header from '@/components/Header'
import Reveal from '@/components/Reveal'
import ProgressBar from '@/components/ProgressBar'
import PullToRefresh from '@/components/PullToRefresh'
import Confetti from '@/components/Confetti'
import { useToast } from '@/components/ToastProvider'
import { Sparkles, Users, Share2, Gift, Award, CheckCircle2, Lock, History, Copy, ChevronDown, ChevronUp } from 'lucide-react'

export default function TaskPage() {
  const toast = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<ReferralTaskStats | null>(null)
  const [history, setHistory] = useState<ReferralTaskReward[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showConfetti, setShowConfetti] = useState(false)

  const CONFETTI_KEY = 'biso_confetti_task_rewards'

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

        if (typeof window !== 'undefined' && sData?.tasks) {
          const tasks = sData.tasks as ReferralTask[]
          const stored: string[] = JSON.parse(localStorage.getItem(CONFETTI_KEY) || '[]')
          const newly = tasks.filter(t => t.claimed && !stored.includes(t.id))
          if (newly.length > 0) {
            localStorage.setItem(
              CONFETTI_KEY,
              JSON.stringify(tasks.filter(t => t.claimed).map(t => t.id))
            )
            setShowConfetti(true)
          }
        }
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
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/register?recommendCode=${profile.referral_code}`
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
        <Header displayName="Tâches" vipLevel="Chargement..." showBack={true} />
        <div className="p-4 max-w-4xl mx-auto space-y-6">
          <div className="h-60 bg-emerald-100 rounded-3xl animate-pulse" />
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
    <div className="min-h-screen bg-gray-50 pb-28 page-enter">
      <Header displayName="Tâche" vipLevel={profile?.current_vip || 'VIP0'} showBack={true} />

      <PullToRefresh onRefresh={() => window.location.reload()}>
      <div className="p-4 max-w-4xl mx-auto space-y-6">
        {/* Hero — Invitez et gagnez */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 text-white rounded-3xl p-6 shadow-xl border border-emerald-500/30 space-y-5 animate-fade-in">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-amber-400/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-8 -bottom-8 w-28 h-28 bg-white/5 rounded-full blur-xl pointer-events-none" />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <span className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/25 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-300" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider">Invitez vos amis</h2>
                <p className="text-[10px] text-emerald-100">Et gagnez des récompenses importantes.</p>
              </div>
            </div>
            <span className="bg-white/15 border border-white/20 text-white px-3 py-1.5 rounded-full text-[11px] font-bold tabular-nums">
              {validInvites} membre{validInvites > 1 ? 's' : ''} valide{validInvites > 1 ? 's' : ''}
            </span>
          </div>

          <div className="relative space-y-2.5">
            <span className="text-[11px] uppercase text-emerald-200 font-bold block">Votre lien d&apos;invitation</span>
            <div className="flex items-center justify-between bg-white/10 border border-white/15 p-3 rounded-2xl backdrop-blur-sm space-x-2">
              <span className="text-[11px] text-emerald-100 truncate font-mono">{invitationLink}</span>
              <button
                onClick={() => copyToClipboard(invitationLink, 'Lien d\u2019invitation copié')}
                className="shrink-0 text-amber-300 hover:text-amber-200 transition-colors"
                aria-label="Copier le lien"
              >
                <Copy className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="relative grid grid-cols-2 gap-2">
            <button
              onClick={shareLink}
              className="w-full bg-white text-emerald-800 hover:bg-emerald-50 font-black py-3.5 rounded-2xl text-[11px] tracking-wider uppercase shadow-md transition-all active:scale-95 inline-flex items-center justify-center space-x-1.5"
            >
              <Share2 className="w-4 h-4" aria-hidden="true" />
              <span>Partager le lien</span>
            </button>
            <button
              onClick={() => copyToClipboard(profile?.referral_code || '', 'Code d\u2019invitation copié')}
              className="w-full bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold py-3.5 rounded-2xl text-[11px] tracking-wider uppercase shadow-md transition-all active:scale-95 inline-flex items-center justify-center space-x-1.5"
            >
              <Gift className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copier le code</span>
            </button>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in">
          {[
            { label: 'Mon équipe', value: stats?.total_team || 0, color: 'text-gray-900' },
            { label: 'Valides', value: validInvites, color: 'text-emerald-700' },
            { label: 'En attente', value: stats?.pending_invites || 0, color: 'text-amber-600' },
            { label: 'Récompenses (FC)', value: (stats?.total_rewards || 0).toLocaleString('fr-FR'), color: 'text-emerald-600' },
          ].map((s) => (
            <div key={s.label} className="card-sm p-3.5 text-center space-y-1">
              <p className={`text-xl font-black tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-gray-400 font-semibold">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Progression vers prochaine récompense */}
        {nextReward && (
          <Reveal delay={80}>
            <div className="card p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-700">Prochaine récompense</span>
                <span className="text-xs font-black text-emerald-700">
                  {validInvites} / {nextReward.required_invites.toLocaleString('fr-FR')}
                </span>
              </div>
              <ProgressBar
                value={validInvites}
                max={nextReward.required_invites}
                className="h-3"
                duration={700}
                barClassName="bg-gradient-to-r from-emerald-600 to-amber-400"
              />
              <p className="text-[11px] text-gray-500">
                Encore {Math.max(nextReward.required_invites - validInvites, 0)} invitation{Math.max(nextReward.required_invites - validInvites, 0) > 1 ? 's' : ''} valide{Math.max(nextReward.required_invites - validInvites, 0) > 1 ? 's' : ''} pour gagner{' '}
                <strong className="text-gray-800">{nextReward.reward_amount.toLocaleString('fr-FR')} FC</strong>.
              </p>
            </div>
          </Reveal>
        )}

        {/* Tous les paliers de récompenses */}
        <section className="space-y-3">
          <h2 className="font-black text-gray-900 text-sm uppercase tracking-wider">Paliers de récompenses</h2>
          <div className="space-y-2.5">
            {(stats?.tasks || []).map((task: ReferralTask, tIdx) => {
              return (
                <Reveal key={task.id} delay={tIdx * 60}>
                <div
                  className={`card-sm p-4 flex items-center justify-between gap-4 ${
                    task.claimed ? 'bg-emerald-50/40 border-emerald-200' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                      task.claimed
                        ? 'bg-emerald-100 text-emerald-700 check-pop'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {task.claimed ? (
                        <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                      ) : (
                        <Lock className="w-5 h-5" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900">
                        {task.required_invites} invitation{task.required_invites > 1 ? 's' : ''} valide{task.required_invites > 1 ? 's' : ''}
                      </p>
                      <p className="text-[11px] font-semibold text-emerald-700 mt-0.5 tabular-nums">
                        Récompense : {task.reward_amount.toLocaleString('fr-FR')} FC
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-gray-500 font-bold tabular-nums mb-1">
                      {Math.min(validInvites, task.required_invites)}/{task.required_invites}
                    </p>
                    {task.claimed ? (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-black bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full check-pop">
                        <Award className="w-3 h-3" aria-hidden="true" />
                        <span>Attribué</span>
                      </span>
                    ) : (
                      <ProgressBar
                        value={validInvites}
                        max={task.required_invites}
                        className="w-20 h-1.5"
                        delay={Math.min(tIdx * 80, 400)}
                        duration={600}
                        barClassName="bg-gradient-to-r from-emerald-600 to-amber-400"
                      />
                    )}
                  </div>
                </div>
                </Reveal>
              )
            })}
            {(stats?.tasks || []).length === 0 && (
              <div className="card p-6 text-center">
                <p className="text-xs text-gray-400">Aucune tâche disponible pour le moment.</p>
              </div>
            )}
          </div>
        </section>

        {/* How it works */}
        <div className="card p-5 space-y-4 animate-fade-in">
          <h3 className="font-black text-gray-900 text-sm">Comment ça fonctionne ?</h3>
          <ol className="space-y-3">
            {[
              { title: 'Partagez votre lien', text: 'Envoyez votre lien d\'invitation à vos amis via WhatsApp, SMS ou réseaux sociaux.' },
              { title: 'Votre ami s\'inscrit', text: 'Il crée un compte en utilisant votre code ou lien de parrainage.' },
              { title: 'Il investit', text: 'Votre ami souscrit un pack d\'investissement dans l\'une de nos 3 catégories.' },
              { title: 'Vous gagnez !', text: 'Dès que son investissement est validé, votre récompense est créditée automatiquement.' },
            ].map((step, i) => (
              <li key={i} className="flex space-x-3">
                <span className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-xs font-bold text-gray-900">{step.title}</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Historique des récompenses */}
        <div className="card p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-amber-600" aria-hidden="true" />
              <div>
                <p className="text-xs text-gray-500 font-semibold">Revenus des tâches d&apos;invitation</p>
                <p className="text-2xl font-black text-emerald-700 mt-0.5 tabular-nums">
                  {(stats?.total_rewards || 0).toLocaleString('fr-FR')} FC
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 font-bold py-3 rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2 min-h-[44px]"
          >
            <History className="w-4 h-4" aria-hidden="true" />
            <span>Voir l&apos;historique</span>
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
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
                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md uppercase tracking-wider">
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
      </PullToRefresh>

      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
    </div>
  )
}