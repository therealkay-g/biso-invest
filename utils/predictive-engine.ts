'use client'

import { Wallet, Investment, Product } from '@/types'
import {
  getRemainingContractDays,
  projectContractGains,
  roundToTwoDecimals,
} from './financial.mjs'

export interface Prediction {
  period: string
  estimatedGain: number
  confidence: number
  insight: string
}

export interface VipPrediction {
  targetLevel: string
  estimatedDays: number
  missingAmount: number
  suggestion: string
}

export const PredictiveEngine = {
  /**
   * Deterministic projections based on real remaining contract dates and the
   * immutable 10% daily rule. Every horizon is capped by the contract end.
   */
  calculateProjections(wallet: Wallet, investments: (Investment & { product?: Product })[]): Prediction[] {
    const now = new Date()
    const periods = [
      { label: '3 Mois', months: 3 },
      { label: '6 Mois', months: 6 },
      { label: '1 An', months: 12 },
    ]
    const projected = projectContractGains(investments, now, periods.map(period => period.months))
    const activeInvestments = investments.filter(investment => {
      if (investment.status !== 'ACTIVE') return false
      return getRemainingContractDays(investment, now) > 0
    })

    return periods.map((period, index) => {
      const estimatedGain = roundToTwoDecimals(projected[index]?.estimatedGain || 0)
      return {
        period: period.label,
        estimatedGain,
        confidence: activeInvestments.length > 0 ? 100 : 0,
        insight: estimatedGain > 0
          ? `Calcul déterministe sur vos ${activeInvestments.length} investissement${activeInvestments.length > 1 ? 's' : ''} actif${activeInvestments.length > 1 ? 's' : ''}.`
          : 'Aucun investissement actif pour le moment.',
      }
    })
  },

  /**
   * VIP depends on invested capital (including any explicit reinvestment), not
   * on daily earnings. No time-to-VIP estimate is therefore invented here.
   */
  predictNextVip(profile: any, wallet: Wallet, vipLevels: any[]): VipPrediction | null {
    if (!profile?.current_vip || !Array.isArray(vipLevels) || vipLevels.length === 0) return null

    const sortedLevels = [...vipLevels].sort((a, b) => {
      const orderDifference = Number(a.display_order || 0) - Number(b.display_order || 0)
      return orderDifference || String(a.level_name).localeCompare(String(b.level_name))
    })
    const currentIdx = sortedLevels.findIndex(level => level.level_name === profile.current_vip)
    if (currentIdx === -1 || currentIdx === sortedLevels.length - 1) return null

    const nextLevel = sortedLevels[currentIdx + 1]
    const targetAmount = Number(nextLevel.min_investment) || 0
    const currentInvested = Number(wallet.total_invested) || 0
    const missingAmount = roundToTwoDecimals(Math.max(0, targetAmount - currentInvested))
    if (missingAmount <= 0) return null

    return {
      targetLevel: nextLevel.level_name,
      estimatedDays: Infinity,
      missingAmount,
      suggestion: `Le niveau ${nextLevel.level_name} dépend du capital investi, pas des bénéfices journaliers. Un dépôt complémentaire de ${missingAmount.toLocaleString('fr-FR')} FC est nécessaire.`,
    }
  },
}
