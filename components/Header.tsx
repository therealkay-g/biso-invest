'use client'

import { Bell, ShieldCheck, ArrowLeft, Shield } from 'lucide-react'
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
  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40 px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-3">
        {showBack && (
          <Link href={backUrl} className="p-2 rounded-full hover:bg-gray-100 mr-1 transition-colors" aria-label="Retour">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </Link>
        )}
        <div className="relative">
          <Image
            src="/icon.svg"
            alt="BISO INVEST"
            width={40}
            height={40}
            className="rounded-2xl shadow-sm border border-emerald-500/20 object-cover"
          />
        </div>
        <div>
          <h1 className="text-sm font-bold text-gray-900 flex items-center space-x-1">
            <span>Bonjour 👋</span>
          </h1>
          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
            {isAdmin ? (
              <span className="text-[10px] font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 flex items-center">
                <Shield className="w-3 h-3 mr-0.5 text-amber-600 inline" />
                {adminRole}
              </span>
            ) : (
              <span className="text-xs font-bold text-biso-700 bg-biso-50 px-2 py-0.5 rounded-full border border-biso-200">
                {vipLevel}
              </span>
            )}
            <span className="text-xs text-gray-600 font-medium truncate max-w-[140px] sm:max-w-none">{displayName}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center space-x-1.5 bg-gradient-to-r from-[#0b1e36] to-emerald-900 hover:from-black hover:to-emerald-950 text-white px-3 py-1.5 rounded-full text-xs font-black shadow-sm transition-all border border-amber-400/40 active:scale-95"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>Espace Admin</span>
          </Link>
        )}

        <Link href="/service?tab=notifications" className="relative p-2 rounded-full hover:bg-gray-100 transition-colors" aria-label="Notifications">
          <Bell className="w-5 h-5 text-gray-700" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadNotificationsCount}
            </span>
          )}
        </Link>
        
        {!isAdmin && (
          <Link href="/vip" className="hidden sm:flex items-center space-x-1 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full text-xs font-semibold text-amber-800">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <span>Avantages VIP</span>
          </Link>
        )}
      </div>
    </header>
  )
}
