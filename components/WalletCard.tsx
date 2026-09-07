'use client'

import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Plus, Send } from 'lucide-react'
import Link from 'next/link'

interface WalletCardProps {
  balance: number
  totalInvested: number
  totalEarned: number
  todayEarned: number
}

export default function WalletCard({ balance, totalInvested, totalEarned, todayEarned }: WalletCardProps) {
  return (
    <div className="bg-gradient-to-br from-biso-800 to-biso-950 text-white rounded-2xl p-5 shadow-xl relative overflow-hidden">
      {/* Background decorative circles */}
      <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-biso-600 rounded-full opacity-20 blur-2xl"></div>
      <div className="absolute left-10 -top-10 w-32 h-32 bg-emerald-400 rounded-full opacity-10 blur-xl"></div>

      <div className="relative z-10">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center space-x-2 text-biso-200">
            <WalletIcon className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Solde Disponible</span>
          </div>
          <span className="text-xs bg-biso-700/60 text-biso-100 px-2.5 py-1 rounded-full backdrop-blur-xs font-medium">
            FC (CDF)
          </span>
        </div>

        <div className="mb-4">
          <h2 className="text-3xl font-extrabold tracking-tight">
            {balance.toLocaleString('fr-FR', { minimumFractionDigits: 0 })} <span className="text-lg font-normal text-biso-300">FC</span>
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-2 py-3 border-t border-biso-700/60 mb-4 text-center">
          <div>
            <p className="text-[11px] text-biso-300">Total Investi</p>
            <p className="text-sm font-bold">{totalInvested.toLocaleString('fr-FR')} FC</p>
          </div>
          <div className="border-x border-biso-700/60">
            <p className="text-[11px] text-biso-300">Revenus Total</p>
            <p className="text-sm font-bold text-emerald-300">{totalEarned.toLocaleString('fr-FR')} FC</p>
          </div>
          <div>
            <p className="text-[11px] text-biso-300">Aujourd'hui</p>
            <p className="text-sm font-bold text-emerald-300">+{todayEarned.toLocaleString('fr-FR')} FC</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/wallet?tab=deposit"
            className="bg-biso-500 hover:bg-biso-600 text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>RECHARGER</span>
          </Link>
          <Link
            href="/wallet?tab=withdraw"
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all backdrop-blur-xs active:scale-98"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>RETIRER</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
