'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export default function NetworkStatus() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false)
    }
    function handleOffline() {
      setIsOffline(true)
    }

    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine)
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="fixed bottom-16 md:bottom-4 left-4 right-4 md:left-auto md:right-4 z-50 bg-rose-600 text-white px-4 py-3 rounded-2xl shadow-xl border border-rose-700 flex items-center space-x-3 text-xs font-semibold animate-pulse">
      <WifiOff className="w-5 h-5 shrink-0" />
      <div>
        <p className="font-bold">Connexion Internet Interrompue</p>
        <p className="text-[11px] text-rose-100 font-normal">Vous êtes actuellement en mode hors-ligne. Les données peuvent ne pas être synchronisées.</p>
      </div>
    </div>
  )
}
