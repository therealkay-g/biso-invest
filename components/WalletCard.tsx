'use client'

import React, { useState, useEffect } from 'react'
import { Wallet as WalletIcon, ArrowUpRight, Plus, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface WalletCardProps {
  balance: number
  totalInvested: number
  totalEarned: number
  todayEarned: number
  userName?: string
  vipLevel?: string
}

export default function WalletCard({
  balance,
  totalInvested,
  totalEarned,
  todayEarned,
  userName = 'MEMBRE PRIVILÈGE',
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

  // Taux indicatif de conversion (1 USD = 2400 CDF)
  const EXCHANGE_RATE = 2400
  const usdBalance = (balance / EXCHANGE_RATE).toFixed(2)

  const formatAmount = (val: number, unit = 'FC') => {
    if (!showBalance) return '••••••'
    return `${val.toLocaleString('fr-FR', { minimumFractionDigits: 0 })} ${unit}`
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-emerald-950 text-white shadow-2xl border border-emerald-500/20 p-6 transition-all">
      {/* Glossy & Metallic Ambient Glow */}
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -left-12 -bottom-12 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 flex flex-col justify-between space-y-5">
        {/* Top bar: Brand, VIP badge & Eye toggle */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2.5">
            <Image
              src="/images/logo.png"
              alt="BISO INVEST"
              width={34}
              height={34}
              className="rounded-xl shadow-md border border-emerald-500/30 object-cover"
            />
            <div>
              <span className="text-xs font-black tracking-widest text-zinc-200 uppercase">BISO BLACK CARD</span>
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center">
                  <ShieldCheck className="w-3 h-3 mr-0.5 inline" /> Garanti
                </span>
                <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.2 rounded-md border border-amber-500/30">
                  {vipLevel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={toggleVisibility}
              aria-label={showBalance ? 'Masquer le solde' : 'Afficher le solde'}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white transition-all active:scale-95 border border-white/10 backdrop-blur-sm"
            >
              {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full font-bold border border-emerald-500/30">
              CDF
            </span>
          </div>
        </div>

        {/* EMV Chip & Contactless Visuals */}
        <div className="flex items-center justify-between py-1">
          <div className="w-11 h-8 rounded-lg bg-gradient-to-tr from-amber-300 via-amber-200 to-amber-400 border border-amber-500/50 shadow-inner flex items-center justify-around px-1">
            <div className="w-full h-4 border border-amber-600/40 rounded-xs flex flex-col justify-between py-0.5">
              <div className="w-full h-px bg-amber-600/50"></div>
              <div className="w-full h-px bg-amber-600/50"></div>
            </div>
          </div>
          <span className="font-mono text-zinc-400 text-xs tracking-widest">
            •••• •••• •••• 5042
          </span>
        </div>

        {/* Balance Display with Tabular Nums and USD conversion */}
        <div>
          <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">Solde Disponible</span>
          <div className="flex items-baseline space-x-2 mt-0.5">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight tabular-nums text-white">
              {formatAmount(balance, '')}
              {showBalance && <span className="text-xl font-medium text-emerald-400 ml-1">FC</span>}
            </h2>
          </div>
          {showBalance && (
            <p className="text-xs text-zinc-400 mt-0.5 tabular-nums">
              ≈ <span className="text-amber-300 font-semibold">{usdBalance} $</span> USD
              <span className="text-[10px] text-zinc-500 ml-2">(1 $ ≈ 2 800 FC)</span>
            </p>
          )}
        </div>

        {/* Financial Sub-Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 py-3 border-t border-zinc-800 text-center">
          <div>
            <p className="text-[10px] uppercase text-zinc-400 font-medium">Investi</p>
            <p className="text-xs sm:text-sm font-bold text-zinc-200 tabular-nums">
              {formatAmount(totalInvested)}
            </p>
          </div>
          <div className="border-x border-zinc-800">
            <p className="text-[10px] uppercase text-zinc-400 font-medium">Revenus Total</p>
            <p className="text-xs sm:text-sm font-bold text-emerald-400 tabular-nums">
              {formatAmount(totalEarned)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-zinc-400 font-medium">Aujourd'hui</p>
            <p className="text-xs sm:text-sm font-bold text-emerald-300 tabular-nums">
              {showBalance ? `+${todayEarned.toLocaleString('fr-FR')} FC` : '••••••'}
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Link
            href="/wallet?tab=deposit"
            className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-3 px-4 rounded-2xl flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950 transition-all active:scale-95 text-xs tracking-wide"
          >
            <Plus className="w-4 h-4" />
            <span>RECHARGER</span>
          </Link>
          <Link
            href="/wallet?tab=withdraw"
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold py-3 px-4 rounded-2xl flex items-center justify-center space-x-2 transition-all backdrop-blur-sm active:scale-95 text-xs tracking-wide shadow-md"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>RETIRER</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
