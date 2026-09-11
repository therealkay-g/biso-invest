'use client'

import { Bell, ArrowLeft, Shield } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface HeaderProps {
  displayName?: string
  vipLevel?: string
  unreadNotificationsCount?: number
  showBack?: boolean
  backUrl?: string
  isAdmin?: boolean
  adminRole?: string
}

export default function Header({
  displayName = 'Utilisateur',
  vipLevel = 'VIP0',
  unreadNotificationsCount = 0,
  showBack = true,
  backUrl = '/dashboard',
  isAdmin = false,
  adminRole = 'ADMIN'
}: HeaderProps) {
  const initial = (displayName || 'B').replace(/[^A-Za-zÀ-ÿ0-9]/g, '').charAt(0).toUpperCase() || 'B'

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40 px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-3 min-w-0">
        {showBack && (
          <Link href={backUrl} className="p-2 rounded-full hover:bg-gray-100 mr-0.5 transition-colors shrink-0" aria-label="Retour">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </Link>
        )}
        <Link href="/dashboard" className="relative shrink-0" aria-label="BISO INVEST — Accueil">
          <Image
            src="/images/logo.png"
            alt="BISO INVEST"
            width={38}
            height={38}
            className="rounded-2xl shadow-sm border border-emerald-500/25 object-cover"
          />
        </Link>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">BISO INVEST</p>
          <div className="flex items-center space-x-2 min-w-0">
            {isAdmin ? (
              <span className="shrink-0 inline-flex items-center space-x-0.5 text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <Shield className="w-3 h-3 text-amber-600" aria-hidden="true" />
                <span>{adminRole}</span>
              </span>
            ) : (
              <span className="shrink-0 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                {vipLevel}
              </span>
            )}
            <span className="text-sm font-bold text-gray-800 truncate">{displayName}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-1.5 shrink-0">
        {isAdmin && (
          <Link
            href="/admin"
            className="inline-flex items-center space-x-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded-2xl text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        )}

        <Link href="/service?tab=notifications" className="relative p-2.5 rounded-full hover:bg-gray-100 transition-colors" aria-label="Notifications">
          <Bell className="w-5 h-5 text-gray-700" aria-hidden="true" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadNotificationsCount}
            </span>
          )}
        </Link>

        {/* Avatar utilisateur */}
        <Link href="/profile" className="shrink-0" aria-label="Mon profil">
          <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-900 text-white font-black text-sm flex items-center justify-center shadow-sm border border-emerald-500/30">
            {initial}
          </span>
        </Link>
      </div>
    </header>
  )
}