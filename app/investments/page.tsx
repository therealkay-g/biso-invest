'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Investment, ProfitClaim } from '@/types'
import Header from '@/components/Header'
import { TableSkeleton } from '@/components/Skeleton'
import { useToast } from '@/components/ToastProvider'
import InvestmentCertificateModal from '@/components/InvestmentCertificateModal'
import { Package, CheckCircle2, AlertCircle, Award, Clock, History, ArrowRight, HandCoins } from 'lucide-react'
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
  const [selling, setSelling] = useState(false)
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

  const handleSell = async () => {
    if (selling) return
    setSelling(true)
    try {
      const { data, error } = await supabase.rpc('claim_daily_profit')
      if (error) throw error

      if (data?.claimed_amount > 0) {
        toast.success(`Vente effectuée avec succès — Vous avez reçu : ${data.claimed_amount.toLocaleString('fr-FR')} FC`)
      } else {
        toast.info('Bénéfice du jour déjà réclamé. Revenez demain !')
      }
      await loadInvestments()
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la vente du bénéfice du jour.")
    } finally {
      setSelling(false)
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
    <div className="min-h-screen bg-gray-50 pb-28">
      <Header displayName="Mes Investissements" vipLevel="Bénéfice du jour (VENDRE)" showBack={true} />

      <div className="p-4 max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h2 className="text-xl font-black text-gray-900">Mes Engagements Actifs</h2>
            <p className="text-xs text-gray-500">Cliquez chaque jour sur VENDRE pour créditer votre bénéfice journalier.</p>
          </div>
          <span className="text-xs font-bold bg-biso-50 text-biso-700 px-3.5 py-1.5 rounded-full border border-biso-200">
            {investments.length} actif(s)
          </span>
        </div>

        {investments.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-xs space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-biso-50 text-biso-600 flex items-center justify-center mx-auto">
              <Package className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-bold text-gray-900">Vous n'avez pas encore d'investissements actifs</p>
              <p className="text-xs text-gray-400">Rejoignez l'économie réelle congolaise dès 30 000 FC.</p>
            </div>
            <Link
              href="/invest"
              className="inline-flex items-center space-x-2 bg-biso-600 hover:bg-biso-700 text-white font-bold px-6 py-3 rounded-2xl text-xs uppercase tracking-wider shadow-md transition-all active:scale-95"
            >
              <span>Découvrir les packs</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {investments.map((inv) => {
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
                <div key={inv.id} className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6 space-y-5">
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
                        className="bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-200/80 flex items-center space-x-1.5 transition-all active:scale-95 shadow-sm"
                      >
                        <Award className="w-3.5 h-3.5 text-amber-600" />
                        <span>Certificat Officiel</span>
                      </button>
                      <span className="text-xs font-black bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-200 tabular-nums">
                        {capital.toLocaleString('fr-FR')} FC
                      </span>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="space-y-1.5 bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-gray-600 flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-biso-600" /> Progression du contrat ({inv.duration_months} mois)
                      </span>
                      <span className="text-biso-700 tabular-nums">{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        style={{ width: `${progressPercent}%` }}
                        className="bg-gradient-to-r from-biso-600 to-emerald-400 h-2 rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>

                  {/* Dominant : Bénéfice du jour */}
                  <div
                    className={`p-5 rounded-2xl border shadow-sm transition-all ${
                      finished
                        ? 'bg-gray-50 border-gray-200'
                        : claimedToday
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : 'bg-gradient-to-r from-biso-700 to-emerald-800 border-biso-800 text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-[11px] font-bold uppercase tracking-wider ${finished ? 'text-gray-500' : claimedToday ? 'text-emerald-700' : 'text-emerald-300'}`}>
                          Bénéfice du jour
                        </p>
                        <p className={`text-2xl font-black tabular-nums mt-1 ${finished ? 'text-gray-400' : claimedToday ? 'text-emerald-900' : 'text-white'}`}>
                          +{dailyProfit.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FC
                        </p>
                        <p className={`text-[10px] mt-0.5 ${finished ? 'text-gray-400' : claimedToday ? 'text-emerald-600' : 'text-emerald-200'}`}>
                          {monthlyReturn.toLocaleString('fr-FR')} FC / mois répartis sur {daysInCurrentMonth} jours ({currentMonthName})
                        </p>
                      </div>

                      {finished ? (
                        <div className="text-right">
                          <span className="inline-flex items-center space-x-1.5 text-xs font-black text-gray-500 bg-white border border-gray-300 px-4 py-3 rounded-2xl">
                            <AlertCircle className="w-4 h-4" />
                            <span>Investissement terminé</span>
                          </span>
                        </div>
                      ) : claimedToday ? (
                        <div className="text-right">
                          <span className="inline-flex items-center space-x-1.5 text-xs font-black text-emerald-800 bg-white border border-emerald-300 px-4 py-3 rounded-2xl shadow-sm">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Déjà vendu aujourd&apos;hui</span>
                          </span>
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="block text-[10px] font-bold text-emerald-200 mb-1.5">
                            Votre bénéfice du jour est disponible
                          </span>
                          <button
                            onClick={handleSell}
                            disabled={selling}
                            className="inline-flex items-center space-x-2 bg-white text-biso-800 font-black px-6 py-3 rounded-2xl text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50"
                          >
                            <HandCoins className="w-4 h-4" />
                            <span>{selling ? 'Vente...' : 'VENDRE'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {!finished && (
                    <p className={`text-[11px] font-semibold -mt-2 ${claimedToday ? 'text-emerald-700' : 'text-gray-500'}`}>
                      {claimedToday
                        ? 'Bénéfice du jour déjà réclamé. Un bénéfice non réclamé un jour est perdu et ne sera jamais reporté.'
                        : 'Cliquez sur VENDRE pour créditer le bénéfice d\'aujourd\'hui. Un bénéfice non réclamé un jour est perdu et ne sera jamais reporté.'}
                    </p>
                  )}

                  {/* Historique des réclamations */}
                  {!finished && invClaims.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-black text-gray-800 text-xs uppercase tracking-wider flex items-center">
                        <History className="w-3.5 h-3.5 mr-1.5 text-biso-600" /> Historique des bénéfices réclamés
                      </h4>
                      <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                        {invClaims.map((c) => (
                          <div key={c.id} className="flex justify-between items-center bg-gray-50 border border-gray-100 rounded-xl px-3.5 py-2.5">
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
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Financial Overview Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-biso-50/40 p-4 rounded-2xl text-xs border border-biso-100/60">
                    <div>
                      <span className="text-gray-500 text-[11px]">Bénéfice Journalier :</span>
                      <p className="font-black text-biso-700 tabular-nums mt-0.5">
                        +{dailyProfit.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FC / j
                      </p>
                      <p className="text-[9px] text-biso-400 mt-0.5">{daysInCurrentMonth} j. en {currentMonthName}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[11px]">Rente Mensuelle :</span>
                      <p className="font-black text-emerald-800 tabular-nums mt-0.5">
                        +{monthlyReturn.toLocaleString('fr-FR')} FC / mois
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[11px]">Durée Contractuelle :</span>
                      <p className="font-bold text-gray-800 mt-0.5">{inv.duration_months} mois (12 cycles)</p>
                    </div>
                  </div>

                  {/* Compact 12-cycle timeline */}
                  {inv.cycles && inv.cycles.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-black text-gray-800 text-xs uppercase tracking-wider">Suivi des Cycles Mensuels</h4>
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                        {inv.cycles.map((cycle) => (
                          <div
                            key={cycle.id}
                            className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black border ${
                              cycle.status === 'ACTIVE'
                                ? 'bg-biso-700 text-white border-biso-800 shadow-sm'
                                : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {cycle.cycle_number}
                          </div>
                        ))}
                        <div className="shrink-0 text-[10px] text-gray-400 font-semibold ml-1">
                          {inv.cycles.filter(c => c.status === 'ACTIVE').length} cycle(s) actif(s)
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Official Certificate Modal */}
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