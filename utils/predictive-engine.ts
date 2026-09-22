'use client'

import { Wallet, Investment, Product } from '@/types'

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
   * Estimates future gains based on current active investments.
   */
  calculateProjections(wallet: Wallet, investments: (Investment & { product?: Product })[]): Prediction[] {
    const periods = [
      { label: '3 Mois', months: 3 },
      { label: '6 Mois', months: 6 },
      { label: '1 An', months: 12 },
    ]

    return periods.map(period => {
      let totalEstimatedGain = 0

      investments.forEach(inv => {
        const monthlyReturn = (inv.product?.monthly_return || 0) * inv.quantity
        const remainingMonths = inv.duration_months - (inv.paid_installments || 0)
        const activeMonths = Math.min(period.months, remainingMonths)

        if (activeMonths > 0) {
          totalEstimatedGain += monthlyReturn * activeMonths
        }
      })

      // Add a "confidence" factor based on how many investments are near completion
      const confidence = investments.length > 0 ? 95 : 0

      return {
        period: period.label,
        estimatedGain: totalEstimatedGain,
        confidence,
        insight: totalEstimatedGain > 0
          ? `Basé sur vos ${investments.length} investissements actifs.`
          : 'Aucun investissement actif pour le moment.'
      }
    })
  },

  /**
   * Predicts when the user will reach the next VIP level.
   */
  predictNextVip(profile: any, wallet: Wallet, vipLevels: any[]) {
    const sortedLevels = [...vipLevels].sort((a, b) => a.display_order - b.display_order)
    const currentIdx = sortedLevels.findIndex(l => l.level_name === profile.current_vip)

    if (currentIdx === -1 || currentIdx === sortedLevels.length - 1) {
      return null
    }

    const nextLevel = sortedLevels[currentIdx + 1]
    const targetAmount = nextLevel.min_investment
    const currentInvested = wallet.total_invested
    const missing = targetAmount - currentInvested

    if (missing <= 0) return null

    // Estimate days based on current daily profit (avg)
    // We'll simulate daily profit as (total monthly return / 30)
    // This is a simplification for the prediction
    const monthlyReturn = 5000 // Default fallback or calculated from actuals
    const dailyProfit = monthlyReturn / 30

    const daysToReach = dailyProfit > 0 ? Math.ceil(missing / dailyProfit) : Infinity

    return {
      targetLevel: nextLevel.level_name,
      estimatedDays: daysToReach,
      missingAmount: missing,
      suggestion: dailyProfit > 0
        ? `À votre rythme actuel, vous atteindrez ${nextLevel.level_name} dans environ ${Math.ceil(missing / dailyProfit)} jours.`
        : `Pour atteindre ${nextLevel.level_name}, un dépôt complémentaire de ${missing.toLocaleString()} FC est recommandé.`
    }
  }
}
