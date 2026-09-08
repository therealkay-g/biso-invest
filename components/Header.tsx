'use client'

import { Bell, ShieldCheck, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface HeaderProps {
  displayName?: string
  vipLevel?: string
  unreadNotificationsCount?: number
  showBack?: boolean
  backUrl?: string
}

export default function Header({ 
  displayName = 'Utilisateur', 
  vipLevel = 'VIP0', 
  unreadNotificationsCount = 0,
  showBack = true,
  backUrl = '/dashboard'
}: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40 px-4 py-3 flex items-center justify-between shadow-xs">
      <div className="flex items-center space-x-3">
        {showBack && (
          <Link href={backUrl} className="p-2 rounded-full hover:bg-gray-100 mr-1 transition-colors" aria-label="Retour">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </Link>
        )}
        <div className="w-10 h-10 rounded-full bg-biso-100 flex items-center justify-center text-biso-700 font-bold text-lg">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-sm font-medium text-gray-800">Bonjour 👋</h1>
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-bold text-biso-700 bg-biso-50 px-2 py-0.5 rounded-full border border-biso-200">
              {vipLevel}
            </span>
            <span className="text-xs text-gray-500 font-medium">{displayName}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <Link href="/service?tab=notifications" className="relative p-2 rounded-full hover:bg-gray-100 transition-colors">
          <Bell className="w-5 h-5 text-gray-700" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadNotificationsCount}
            </span>
          )}
        </Link>
        <Link href="/vip" className="hidden sm:flex items-center space-x-1 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full text-xs font-semibold text-amber-800">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          <span>Avantages VIP</span>
        </Link>
      </div>
    </header>
  )
}
