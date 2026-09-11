'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Investment, ProfitClaim } from '@/types'
import Header from '@/components/Header'
import { TableSkeleton } from '@/components/Skeleton'
import Reveal from '@/components/Reveal'
import ProgressBar from '@/components/ProgressBar'
import PullToRefresh from '@/components/PullToRefresh'
import { RippleButton } from '@/components/RippleButton'
import { useToast } from '@/components/ToastProvider'
import InvestmentCertificateModal from '@/components/InvestmentCertificateModal'
import { Package, CheckCircle2, AlertCircle, Award, Clock, History, HandCoins, ArrowRight, Sprout, Beef, Fish } from 'lucide-react'
import Link from 'next/link'

interface InvestmentCycle {
  id: string
  investment_id: string
  cycle_number: number
  cycle_start_date: string
  cycle_end_date: string
  daily_profit: number
  accumulated_profit: number
  withdrawn_profit: number
  last_accrual_date: string
  status: 'ACTIVE' | 'COMPLETED'
}

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<(Investment & { cycles?: InvestmentCycle[] })[]>([])
  const [claims, setClaims] = useState<ProfitClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [sellLoading, setSellLoading] = useState<string | null>(null)
  const [sellSuccess, setSellSuccess] = useState<Record<string, boolean>>({})
  const [selectedCertInvestment, setSelectedCertInvestment] = useState<Investment | null>(null)
  const [userDisplayName, setUserDisplayName] = useState('Investisseur Biso')
  const toast = useToast()

  const loadInvestments = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth/login'
        return
      }

      const { data: prof } = await supabase.from('profiles').select('display_name, phone').eq('id', user.id).single()
      if (prof) {
        setUserDisplayName(prof.display_name || prof.phone)
      }

      const { data: invData } = await supabase
        .from('investments')
        .select('*, product:products(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (invData) {
        const enriched = await Promise.all(invData.map(async (inv: any) => {
          const { data: cyclesData } = await supabase
            .from('investment_cycles')
            .select('*')
            .eq('investment_id', inv.id)
            .order('cycle_number', { ascending: true })
          return { ...inv, cycles: cyclesData || [] }
        }))
        setInvestments(enriched)
      }

      const { data: claimData } = await supabase
        .from('profit_claims')
        .select('*')
        .eq('user_id', user.id)
        .order('profit_date', { ascending: false })
        .limit(300)
      setClaims(claimData || [])
    } catch (err) {
      console.error('Error loading investments:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInvestments()
  }, [loadInvestments])

  const todayKey = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const isInvestmentFinished = (inv: Investment) => {
    if (inv.status !== 'ACTIVE') return true
    const end = new Date(inv.created_at)
    end.setMonth(end.getMonth() + (inv.duration_months || 12))
    return new Date() >= end
  }

  const hasClaimedToday = (invId: string) => {
    const today = todayKey()
    return claims.some(c => c.investment_id === invId && c.profit_date === today)
  }

  const handleSell = async (invId: string) => {
    if (sellLoading) return
    setSellLoading(invId)
    try {
      const { data, error } = await supabase.rpc('claim_daily_profit')
      if (error) throw error

      if (data?.claimed_amount > 0) {
        toast.success(`Vente effectuée avec succès — Vous avez reçu : ${data.claimed_amount.toLocaleString('fr-FR')} FC`)
      } else {
        toast.info('Bénéfice du jour déjà réclamé. Revenez demain !')
      }
      await loadInvestments()
      if (data?.claimed_amount > 0) {
        setSellSuccess((s) => ({ ...s, [invId]: true }))
        setTimeout(() => {
          setSellSuccess((s) => {
            const next = { ...s }
            delete next[invId]
            return next
          })
        }, 1400)
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la vente du bénéfice du jour.")
    } finally {
      setSellLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header displayName="Mes Investissements" vipLevel="Chargement..." showBack={true} />
        <div className="p-4 max-w-4xl mx-auto space-y-6">
          <TableSkeleton rows={3} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28 page-enter">
      <Header displayName="Mes Investissements" vipLevel="Bénéfice du jour (VENDRE)" showBack={true} />

      <PullToRefresh onRefresh={() => window.location.reload()}>
      <div className="p-4 max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center mb-2 animate-fade-in">
          <div>
            <h2 className="text-xl font-black text-gray-900">Mes engagements actifs</h2>
            <p className="text-xs text-gray-500">Vendez chaque jour votre bénéfice journalier.</p>
          </div>
          <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-3.5 py-1.5 rounded-full border border-emerald-100">
            {investments.length} actif{investments.length > 1 ? 's' : ''}
          </span>
        </div>

        {investments.length === 0 ? (
          <div className="card p-8 text-center space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <Package className="w-8 h-8" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-bold text-gray-900">Aucun investissement actif</p>
              <p className="text-xs text-gray-400">Rejoignez l&apos;économie réelle congolaise dès 20 000 FC.</p>
            </div>
            <Link
              href="/invest"
              className="inline-flex items-center space-x-2 btn-primary text-xs px-6"
            >
              <span>Découvrir les packs</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {investments.map((inv, index) => {
              const capital = inv.total_amount
              const monthlyReturn = (inv.product?.monthly_return || 0) * inv.quantity
              const now = new Date()
              const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
              const currentMonthName = now.toLocaleDateString('fr-FR', { month: 'long' })
              const dailyProfit = monthlyReturn / daysInCurrentMonth

              const finished = isInvestmentFinished(inv)
              const claimedToday = hasClaimedToday(inv.id)
              const invClaims = claims.filter(c => c.investment_id === inv.id).slice(0, 12)

              const createdDate = new Date(inv.created_at).getTime()
              const totalDurationMs = (inv.duration_months || 12) * 30 * 24 * 60 * 60 * 1000
              const elapsedMs = Math.max(0, Date.now() - createdDate)
              const progressPercent = Math.min(100, Math.round((elapsedMs / totalDurationMs) * 100))

              return (
                <Reveal key={inv.id} delay={index * 60}>
                  <div className="card p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-black text-gray-900 text-base">{inv.product?.name || 'Pack Investissement'}</h3>
                        <span className="text-[11px] font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md">
                          x{inv.quantity}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">Souscrit le {new Date(inv.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedCertInvestment(inv)}
                        className="inline-flex items-center space-x-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-200/80 transition-all active:scale-95 shadow-sm"
                      >
                        <Award className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                        <span>Certificat</span>
                      </button>
                      <span className="text-xs font-black bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-200 tabular-nums">
                        {capital.toLocaleString('fr-FR')} FC
                      </span>
                    </div>
                  </div>

                  {/* Progression */}
                  <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-gray-600 flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-emerald-600" aria-hidden="true" /> Contrat ({inv.duration_months} mois)
                      </span>
                      <span className="text-emerald-700 tabular-nums">{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2 overflow-hidden">
                      <ProgressBar
                        value={progressPercent}
                        barClassName="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full"
                      />
                    </div>
                  </div>

                  {/* Bénéfice du jour — dominant */}
                  <div
                    className={`p-5 rounded-2xl border shadow-sm transition-all ${
                      finished
                        ? 'bg-gray-50 border-gray-200'
                        : claimedToday
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : 'bg-gradient-to-r from-emerald-800 to-emerald-950 border-emerald-900 text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-[11px] font-bold uppercase tracking-wider ${finished ? 'text-gray-500' : claimedToday ? 'text-emerald-700' : 'text-emerald-200'}`}>
                          Bénéfice du jour
                        </p>
                        <p className={`text-2xl font-black tabular-nums mt-1 ${finished ? 'text-gray-400' : claimedToday ? 'text-emerald-900' : 'text-white'}`}>
                          +{dailyProfit.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FC
                        </p>
                        <p className={`text-[10px] mt-0.5 ${finished ? 'text-gray-400' : claimedToday ? 'text-emerald-600' : 'text-emerald-200'}`}>
                          {monthlyReturn.toLocaleString('fr-FR')} FC / mois sur {daysInCurrentMonth} jours ({currentMonthName})
                        </p>
                      </div>

                      <div className="shrink-0">
                        {finished ? (
                          <span className="inline-flex items-center space-x-1.5 text-xs font-black text-gray-500 bg-white border border-gray-300 px-4 py-3 rounded-2xl">
                            <AlertCircle className="w-4 h-4" aria-hidden="true" />
                            <span>Terminé</span>
                          </span>
                        ) : (claimedToday || sellSuccess[inv.id]) ? (
                          <span className="inline-flex items-center space-x-1.5 text-xs font-black text-emerald-800 bg-white border border-emerald-300 px-4 py-3 rounded-2xl shadow-sm check-pop">
                            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                            <span>{sellSuccess[inv.id] ? 'Bénéfice vendu' : 'Déjà vendu aujourd\u2019hui'}</span>
                          </span>
                        ) : (
                          <>
                            <span className="block text-[10px] font-bold text-emerald-200 mb-1.5 text-right">
                              Disponible
                            </span>
                            <RippleButton
                              onClick={() => handleSell(inv.id)}
                              disabled={!!sellLoading}
                              className="inline-flex items-center space-x-2 bg-white text-emerald-900 font-black px-6 py-3 min-h-[44px] rounded-2xl text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50 w-full justify-center"
                            >
                              {sellLoading === inv.id ? (
                                <>
                                  <span className="spinner text-emerald-900" aria-hidden="true" />
                                  <span>Traitement...</span>
                                </>
                              ) : (
                                <>
                                  <HandCoins className="w-4 h-4" aria-hidden="true" />
                                  <span>VENDRE</span>
                                </>
                              )}
                            </RippleButton>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {!finished && (
                    <p className={`text-[11px] font-semibold -mt-2 ${claimedToday ? 'text-emerald-700' : 'text-gray-500'}`}>
                      {claimedToday
                        ? 'Bénéfice du jour déjà réclamé. Un bénéfice non réclamé un jour est perdu et ne sera jamais reporté.'
                        : 'Cliquez sur VENDRE pour créditer le bénéfice d\'aujourd\'hui. Un bénéfice non réclamé un jour est perdu.'}
                    </p>
                  )}

                  {/* Historique des réclamations */}
                  {!finished && invClaims.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-black text-gray-800 text-xs uppercase tracking-wider flex items-center">
                        <History className="w-3.5 h-3.5 mr-1.5 text-emerald-600" aria-hidden="true" /> Historique des bénéfices réclamés
                      </h4>
                      <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                        {invClaims.map((c) => (
                          <Reveal key={c.id} axis="x" from={8}>
                            <div className="flex justify-between items-center bg-gray-50 border border-gray-100 rounded-xl px-3.5 py-2.5">
                              <div>
                                <p className="text-[11px] font-bold text-gray-700">
                                  {new Date(c.profit_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                                <p className="text-[9px] text-gray-400">
                                  Réclamé le {new Date(c.claimed_at).toLocaleString('fr-FR')}
                                </p>
                              </div>
                              <span className="text-xs font-black text-emerald-700 tabular-nums">
                                +{c.amount.toLocaleString('fr-FR')} FC
                              </span>
                            </div>
                          </Reveal>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stats compactes */}
                  <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-xl text-[11px] border border-gray-100">
                    <div className="text-center">
                      <p className="text-gray-400 font-semibold">Bénéfice / jour</p>
                      <p className="font-black text-emerald-700 tabular-nums mt-0.5">
                        +{dailyProfit.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FC
                      </p>
                    </div>
                    <div className="text-center border-x border-gray-200">
                      <p className="text-gray-400 font-semibold">Rente / mois</p>
                      <p className="font-black text-emerald-800 tabular-nums mt-0.5">
                        +{monthlyReturn.toLocaleString('fr-FR')} FC
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 font-semibold">Durée</p>
                      <p className="font-bold text-gray-800 mt-0.5">{inv.duration_months} mois</p>
                    </div>
                  </div>

                  {/* Cycle timeline */}
                  {inv.cycles && inv.cycles.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-black text-gray-800 text-xs uppercase tracking-wider">Suivi des cycles mensuels</h4>
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                        {inv.cycles.map((cycle) => (
                          <div
                            key={cycle.id}
                            className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black border ${
                              cycle.status === 'ACTIVE'
                                ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {cycle.cycle_number}
                          </div>
                        ))}
                        <div className="shrink-0 text-[10px] text-gray-400 font-semibold ml-1">
                          {inv.cycles.filter(c => c.status === 'ACTIVE').length} cycle{inv.cycles.filter(c => c.status === 'ACTIVE').length > 1 ? 's' : ''} actif{inv.cycles.filter(c => c.status === 'ACTIVE').length > 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  )}
                  </div>
                </Reveal>
              )
            })}
          </div>
        )}
      </div>
      </PullToRefresh>

      {/* Modale certificat officiel */}
      {selectedCertInvestment && (
        <InvestmentCertificateModal
          investment={selectedCertInvestment}
          userName={userDisplayName}
          onClose={() => setSelectedCertInvestment(null)}
        />
      )}
    </div>
  )
}