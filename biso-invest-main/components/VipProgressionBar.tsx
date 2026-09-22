'use client'

import { useMemo } from 'react'
import { Crown, TrendingUp } from 'lucide-react'

interface VipLevel {
  level_name: string
  min_investment: number
  display_order: number
}

interface VipProgressionProps {
  currentVip: string
  totalInvested: number
  vipLevels: VipLevel[]
}

export default function VipProgressionBar({ currentVip, totalInvested, vipLevels }: VipProgressionProps) {
  const { nextLevel, progress, remaining } = useMemo(() => {
    // Sort levels by order
    const sortedLevels = [...vipLevels].sort((a, b) => a.display_order - b.display_order)
    const currentIndex = sortedLevels.findIndex(l => l.level_name === currentVip)

    if (currentIndex === -1 || currentIndex === sortedLevels.length - 1) {
      return { nextLevel: null, progress: 100, remaining: 0 }
    }

    const next = sortedLevels[currentIndex + 1]
    const minRequired = next.min_investment
    const progressPercent = Math.min(100, Math.max(0, (totalInvested / minRequired) * 100))
    const remainingAmount = Math.max(0, minRequired - totalInvested)

    return {
      nextLevel: next.level_name,
      progress: progressPercent,
      remaining: remainingAmount
    }
  }, [currentVip, totalInvested, vipLevels])

  if (!nextLevel) {
    return (
      <div className="p-4 bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl text-white text-center shadow-lg animate-fade-in">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Crown className="w-5 h-5" />
          <span className="font-black uppercase text-xs">Statut Maximum Atteint</span>
        </div>
        <p className="text-sm font-medium opacity-90">Vous avez atteint le sommet de la hiérarchie VIP !</p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-gray-100 dark:border-zinc-700 shadow-sm space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
            Prochain palier : <span className="text-gray-900 dark:text-zinc-100">{nextLevel}</span>
          </span>
        </div>
        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
          {Math.round(progress)}%
        </span>
      </div>

      <div className="relative h-3 w-full bg-gray-100 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-1000 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-between items-center pt-1">
        <p className="text-[11px] text-gray-500 dark:text-zinc-500 italic">
          Encore <span className="font-bold text-gray-700 dark:text-zinc-300">{remaining.toLocaleString('fr-FR')} FC</span> pour évoluer
        </p>
        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <Crown className="w-3 h-3" />
          <span className="text-[10px] font-black uppercase">Évoluer</span>
        </div>
      </div>
    </div>
  )
}
