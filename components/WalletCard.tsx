'use client'

import React, { useState, useEffect } from 'react'
import { Wallet as WalletIcon, ArrowUpRight, Plus, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import AnimatedNumber from './AnimatedNumber'
import { RippleLink } from './RippleButton'
import { USD_TO_FC } from '../utils/constants'

interface WalletCardProps {
  balance: number
  totalInvested: number
  totalEarned: number
  todayEarned: number
  totalWithdrawn?: number
  userName?: string
  vipLevel?: string
}

export default function WalletCard({
  balance,
  totalInvested,
  totalEarned,
  todayEarned,
  totalWithdrawn = 0,
  userName = 'Membre BISO',
  vipLevel = 'VIP0'
}: WalletCardProps) {
  const [showBalance, setShowBalance] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('biso_hide_balance')
    if (saved === 'true') {
      setShowBalance(false)
    }
  }, [])

  const toggleVisibility = () => {
    const nextState = !showBalance
    setShowBalance(nextState)
    localStorage.setItem('biso_hide_balance', (!nextState).toString())
  }

  const usdValue = balance / USD_TO_FC

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 text-white shadow-xl border border-emerald-400/20 transition-all animate-slide-up">
      {/* Décor organique premium */}
      <div className="absolute -right-16 -top-16 w-56 h-56 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-12 -bottom-16 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '22px 22px' }} />

      <div className="relative z-10 p-6 flex flex-col space-y-5">
        {/* Top bar */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2.5">
            <span className="w-9 h-9 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center backdrop-blur-sm">
              <WalletIcon className="w-4.5 h-4.5 text-emerald-200" aria-hidden="true" />
            </span>
            <div>
              <span className="text-[10px] font-black tracking-widest text-emerald-200/90 uppercase">{userName}</span>
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-1.5 py-0.5 rounded-md border border-amber-400/25">
                  {vipLevel}
                </span>
                <span className="text-[9px] text-emerald-300/80 font-semibold flex items-center">
                  <ShieldCheck className="w-3 h-3 mr-0.5 inline" aria-hidden="true" /> Garanti
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={toggleVisibility}
            aria-label={showBalance ? 'Masquer le solde' : 'Afficher le solde'}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-emerald-100 transition-all active:scale-95 border border-white/10 backdrop-blur-sm"
          >
            {showBalance ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
          </button>
        </div>

        {/* Balance */}
        <div>
          <span className="text-[11px] uppercase tracking-wider text-emerald-100/70 font-semibold">Solde disponible</span>
          <div className="flex items-baseline space-x-2 mt-0.5 balance-pulse">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight tabular-nums text-white">
              {showBalance ? (
                <AnimatedNumber
                  value={balance}
                  format={(v) => `${Math.round(v).toLocaleString('fr-FR')}`}
                />
              ) : '••••••'}
              {showBalance && <span className="text-xl font-bold text-emerald-300 ml-1">FC</span>}
            </h2>
          </div>
          {showBalance && (
            <p className="text-xs text-emerald-200/70 mt-0.5 tabular-nums">
              ≈ <span className="text-amber-300 font-semibold">
                <AnimatedNumber
                  value={usdValue}
                  duration={800}
                  format={(v) => `${v.toFixed(2)}`}
                /> $
              </span> USD
              <span className="text-[10px] text-emerald-300/50 ml-2">(1 $ ≈ {USD_TO_FC} FC)</span>
            </p>
          )}
        </div>

        {/* Sub-metrics */}
        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/10">
          <div>
            <p className="text-[10px] uppercase text-emerald-200/60 font-medium">Investissement</p>
            <p className="text-xs sm:text-sm font-bold text-white tabular-nums mt-0.5">
              {showBalance ? (
                <AnimatedNumber value={totalInvested} format={(v) => `${Math.round(v).toLocaleString('fr-FR')} FC`} />
              ) : '••••••'}
            </p>
          </div>
          <div className="border-x border-white/10 px-2">
            <p className="text-[10px] uppercase text-emerald-200/60 font-medium">Revenus du jour</p>
            <p className="text-xs sm:text-sm font-bold text-amber-300 tabular-nums mt-0.5">
              {showBalance ? (
                <AnimatedNumber value={todayEarned} duration={500} format={(v) => `+${Math.round(v).toLocaleString('fr-FR')} FC`} />
              ) : '••••••'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase text-emerald-200/60 font-medium">Total gagné</p>
            <p className="text-xs sm:text-sm font-bold text-emerald-300 tabular-nums mt-0.5">
              {showBalance ? (
                <AnimatedNumber value={totalEarned} duration={800} format={(v) => `${Math.round(v).toLocaleString('fr-FR')} FC`} />
              ) : '••••••'}
            </p>
          </div>
        </div>

        {totalWithdrawn > 0 && (
          <p className="text-[10px] text-emerald-200/50 -mt-2">
            Retraits effectués : <strong className="text-emerald-100">
              {showBalance ? (
                <AnimatedNumber value={totalWithdrawn} duration={600} format={(v) => `${Math.round(v).toLocaleString('fr-FR')} FC`} />
              ) : '••••••'}
            </strong>
          </p>
        )}

        {/* CTA */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <RippleLink
            href="/wallet?tab=deposit"
            className="inline-flex items-center justify-center space-x-2 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black py-3.5 px-4 rounded-2xl text-xs tracking-wide shadow-lg shadow-emerald-950/40 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>RECHARGER</span>
          </RippleLink>
          <RippleLink
            href="/wallet?tab=withdraw"
            className="inline-flex items-center justify-center space-x-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold py-3.5 px-4 rounded-2xl text-xs tracking-wide transition-all backdrop-blur-sm active:scale-95"
          >
            <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            <span>RETIRER</span>
          </RippleLink>
        </div>
      </div>
    </div>
  )
}