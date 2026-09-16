'use client'

import { useMemo } from 'react'
import { TrendingUp, Calendar, Award, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { PredictiveEngine } from '@/utils/predictive-engine'
import { Wallet, Investment, Product } from '@/types'

interface PredictionCardProps {
  wallet: Wallet | null
  investments: (Investment & { product?: Product })[]
  vipLevels: any[]
  profile: any
}

export default function PredictionPanel({ wallet, investments, vipLevels, profile }: PredictionCardProps) {
  const predictions = useMemo(() => {
    return PredictiveEngine.calculateProjections(wallet!, investments)
  }, [wallet, investments])

  const vipPrediction = useMemo(() => {
    if (!wallet) return null
    return PredictiveEngine.predictNextVip(profile, wallet, vipLevels)
  }, [profile, wallet, vipLevels])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Gains Projections */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h3 className="font-black text-gray-900 dark:text-zinc-100 text-sm">Projections de Gains</h3>
          </div>
          <span className="text-[10px] font-bold text-gray-400 uppercase">Prévisions IA</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {predictions.map((p, idx) => (
            <div key={idx} className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-2xl border border-gray-100 dark:border-zinc-700 text-center space-y-1">
              <p className="text-[10px] font-bold text-gray-500 dark:text-zinc-400">{p.period}</p>
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                +{p.estimatedGain.toLocaleString('fr-FR')} FC
              </p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-500 dark:text-zinc-500 italic text-center">
          {predictions[0]?.insight}
        </p>
      </div>

      {/* VIP Evolution Prediction */}
      {vipPrediction && (
        <div className="card p-5 space-y-4 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-600" />
            <h3 className="font-black text-gray-900 dark:text-zinc-100 text-sm">Objectif VIP {vipPrediction.targetLevel}</h3>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              {vipPrediction.suggestion}
            </p>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-gray-400">Montant restant : {vipPrediction.missingAmount.toLocaleString('fr-FR')} FC</span>
            <Link href="/invest" className="text-xs font-black text-amber-600 hover:underline flex items-center gap-1">
              Accélérer <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
