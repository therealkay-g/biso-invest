'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Investment } from '@/types'
import Header from '@/components/Header'
import { TableSkeleton } from '@/components/Skeleton'
import { useToast } from '@/components/ToastProvider'
import InvestmentCertificateModal from '@/components/InvestmentCertificateModal'
import { Package, TrendingUp, CheckCircle2, AlertCircle, DollarSign, Award, Clock, ArrowRight } from 'lucide-react'
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
  const [loading, setLoading] = useState(true)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [selectedCertInvestment, setSelectedCertInvestment] = useState<Investment | null>(null)
  const [userDisplayName, setUserDisplayName] = useState('Investisseur Biso')
  const toast = useToast()

  useEffect(() => {
    loadInvestments()
  }, [])

  async function loadInvestments() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth/login'
        return
      }

      // Fetch profile
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
    } catch (err) {
      console.error('Error loading investments:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClaim = async (investmentId: string, cycleId: string, availableAmount: number) => {
    if (availableAmount <= 0) {
      toast.error('Aucun bénéfice disponible à réclamer pour ce cycle.')
      return
    }

    setClaimingId(cycleId)

    try {
      const { data, error } = await supabase.rpc('claim_investment_profit', {
        p_investment_id: investmentId,
        p_cycle_id: cycleId,
        p_amount: availableAmount
      })

      if (error) throw error

      toast.success(`Bénéfice de ${availableAmount.toLocaleString('fr-FR')} FC réclamé avec succès !`)
      loadInvestments()
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la réclamation du bénéfice.')
    } finally {
      setClaimingId(null)
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
      <Header displayName="Mes Investissements" vipLevel="Rendements & Cycles" showBack={true} />

      <div className="p-4 max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h2 className="text-xl font-black text-gray-900">Mes Engagements Actifs</h2>
            <p className="text-xs text-gray-500">Suivi en direct des versements et cycles de rentabilité.</p>
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
              const dailyProfit = monthlyReturn / 30

              // Calculate overall progress across 365 days
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
                        className="bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-200/80 flex items-center space-x-1.5 transition-all active:scale-95 shadow-2xs"
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
                        className="bg-linear-to-r from-biso-600 to-emerald-400 h-2 rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>

                  {/* Financial Overview Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-biso-50/40 p-4 rounded-2xl text-xs border border-biso-100/60">
                    <div>
                      <span className="text-gray-500 text-[11px]">Bénéfice Journalier :</span>
                      <p className="font-black text-biso-700 tabular-nums mt-0.5">
                        +{dailyProfit.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FC / j
                      </p>
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

                  {/* Cycles List */}
                  <div className="space-y-3">
                    <h4 className="font-black text-gray-800 text-xs uppercase tracking-wider">Suivi des Cycles Mensuels</h4>
                    <div className="space-y-2">
                      {inv.cycles?.map((cycle) => {
                        const available = cycle.accumulated_profit - cycle.withdrawn_profit
                        const startDate = new Date(cycle.cycle_start_date)
                        const now = new Date()
                        const diffTime = Math.abs(now.getTime() - startDate.getTime())
                        const daysElapsed = Math.min(30, Math.floor(diffTime / (1000 * 60 * 60 * 24)))
                        const daysRemaining = Math.max(0, 30 - daysElapsed)

                        return (
                          <div
                            key={cycle.id}
                            className={`p-4 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all ${
                              cycle.status === 'ACTIVE'
                                ? 'bg-emerald-50/30 border-emerald-200 shadow-2xs'
                                : 'bg-gray-50 border-gray-200 opacity-90'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-black text-xs bg-biso-700 text-white px-2.5 py-0.5 rounded-lg">
                                  Cycle {cycle.cycle_number}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  cycle.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
                                }`}>
                                  {cycle.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500">
                                Du {new Date(cycle.cycle_start_date).toLocaleDateString('fr-FR')} au {new Date(cycle.cycle_end_date).toLocaleDateString('fr-FR')}
                                {cycle.status === 'ACTIVE' && ` • Reste ${daysRemaining} j`}
                              </p>
                              <p className="text-xs font-bold text-gray-800 tabular-nums">
                                Généré : {cycle.accumulated_profit.toLocaleString('fr-FR')} FC
                                {cycle.withdrawn_profit > 0 && ` (Réclamé : ${cycle.withdrawn_profit.toLocaleString('fr-FR')} FC)`}
                              </p>
                            </div>

                            <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
                              <div className="text-left sm:text-right">
                                <span className="text-[10px] text-gray-400 block">Disponible</span>
                                <span className="text-xs font-black text-emerald-700 tabular-nums">
                                  {available.toLocaleString('fr-FR')} FC
                                </span>
                              </div>
                              {available > 0 && cycle.status === 'ACTIVE' && (
                                <button
                                  onClick={() => handleClaim(inv.id, cycle.id, available)}
                                  disabled={claimingId === cycle.id}
                                  className="bg-biso-600 hover:bg-biso-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-xs transition-all active:scale-95 disabled:opacity-50"
                                >
                                  {claimingId === cycle.id ? 'Transfert...' : 'Réclamer'}
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
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
