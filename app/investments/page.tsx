'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Investment } from '@/types'
import Header from '@/components/Header'
import { Package, TrendingUp, CheckCircle2, AlertCircle, DollarSign } from 'lucide-react'

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
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

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
      setMessage({ text: 'Aucun bénéfice disponible à réclamer pour ce cycle.', type: 'error' })
      return
    }

    setClaimingId(cycleId)
    setMessage(null)

    try {
      const { data, error } = await supabase.rpc('claim_investment_profit', {
        p_investment_id: investmentId,
        p_cycle_id: cycleId,
        p_amount: availableAmount
      })

      if (error) throw error

      setMessage({ text: `Bénéfice de ${availableAmount.toLocaleString('fr-FR')} FC réclamé avec succès !`, type: 'success' })
      loadInvestments()
    } catch (err: any) {
      setMessage({ text: err.message || 'Erreur lors de la réclamation du bénéfice.', type: 'error' })
    } finally {
      setClaimingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-biso-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header displayName="Mes Investissements" vipLevel="Rendement & Cycles" />

      <div className="p-4 max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-extrabold text-gray-900">Mes Produits & Cycles</h2>
          <span className="text-xs font-semibold bg-biso-50 text-biso-700 px-3 py-1 rounded-full border border-biso-200">
            {investments.length} actif(s)
          </span>
        </div>

        {message && (
          <div className={`p-4 rounded-xl text-xs flex items-center space-x-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {investments.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-xs">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Vous n'avez pas encore d'investissements actifs.</p>
            <a href="/invest" className="mt-4 inline-block bg-biso-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm shadow-md">
              Explorer les packs
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {investments.map((inv) => {
              const capital = inv.total_amount
              const dailyProfit = (inv.product?.monthly_return || 0) / 30

              return (
                <div key={inv.id} className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">{inv.product?.name || 'Pack Investissement'}</h3>
                      <p className="text-xs text-gray-500">Quantité : {inv.quantity} • Acheté le {new Date(inv.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">
                      Capital : {capital.toLocaleString('fr-FR')} FC
                    </span>
                  </div>

                  {/* Financial Overview */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl text-xs">
                    <div>
                      <span className="text-gray-500">Bénéfice Journalier :</span>
                      <p className="font-bold text-biso-600">{dailyProfit.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} FC / jour</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Bénéfice Mensuel :</span>
                      <p className="font-bold text-emerald-700">{(inv.product?.monthly_return || 0).toLocaleString('fr-FR')} FC / mois</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Durée :</span>
                      <p className="font-bold text-gray-900">{inv.duration_months} mois (12 cycles)</p>
                    </div>
                  </div>

                  {/* Cycles List */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Suivi des 12 Cycles de 30 jours</h4>
                    <div className="space-y-2">
                      {inv.cycles?.map((cycle) => {
                        const available = cycle.accumulated_profit - cycle.withdrawn_profit
                        const startDate = new Date(cycle.cycle_start_date)
                        const endDate = new Date(cycle.cycle_end_date)
                        const now = new Date()
                        const diffTime = Math.abs(now.getTime() - startDate.getTime())
                        const daysElapsed = Math.min(30, Math.floor(diffTime / (1000 * 60 * 60 * 24)))
                        const daysRemaining = Math.max(0, 30 - daysElapsed)

                        return (
                          <div key={cycle.id} className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${cycle.status === 'ACTIVE' ? 'bg-biso-50/50 border-biso-200' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-extrabold text-xs bg-biso-600 text-white px-2.5 py-0.5 rounded-md">Cycle {cycle.cycle_number}</span>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${cycle.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'}`}>
                                  {cycle.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-600">
                                Généré : <strong className="text-gray-900">{cycle.accumulated_profit.toLocaleString('fr-FR')} FC</strong> • Retiré : <strong className="text-gray-900">{cycle.withdrawn_profit.toLocaleString('fr-FR')} FC</strong>
                              </p>
                              <p className="text-[10px] text-gray-500">
                                Jours écoulés : {daysElapsed}j / Restants : {daysRemaining}j ({startDate.toLocaleDateString('fr-FR')} → {endDate.toLocaleDateString('fr-FR')})
                              </p>
                            </div>

                            <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
                              <div className="text-left sm:text-right">
                                <span className="text-[10px] text-gray-500 block">Disponible</span>
                                <span className="font-extrabold text-emerald-600 text-sm">{available.toLocaleString('fr-FR')} FC</span>
                              </div>
                              <button
                                onClick={() => handleClaim(inv.id, cycle.id, available)}
                                disabled={available <= 0 || claimingId === cycle.id}
                                className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all ${
                                  available > 0
                                    ? 'bg-biso-600 hover:bg-biso-700 text-white'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                              >
                                {claimingId === cycle.id ? 'Réclamation...' : 'Réclamer'}
                              </button>
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
    </div>
  )
}
