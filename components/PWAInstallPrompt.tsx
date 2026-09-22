'use client'

import { useEffect, useState } from 'react'
import { Download, X, Smartphone } from 'lucide-react'

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Vérifier si l'utilisateur a déjà fermé la bannière récemment
    const dismissed = localStorage.getItem('biso_pwa_dismissed')
    if (dismissed && Date.now() - parseInt(dismissed) < 1000 * 60 * 60 * 24 * 7) {
      return
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('biso_pwa_dismissed', Date.now().toString())
  }

  if (!showPrompt) return null

  return (
    <div className="fixed top-2 left-4 right-4 md:max-w-md md:left-auto md:right-4 z-50 bg-gradient-to-r from-biso-900 to-biso-950 text-white p-3.5 rounded-2xl shadow-2xl border border-biso-700/50 backdrop-blur-md flex items-center justify-between space-x-3 animate-in fade-in slide-in-from-top-4">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-biso-500/20 border border-biso-400/30 flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5 text-biso-400" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-white">Application BISO INVEST</h4>
          <p className="text-[11px] text-biso-200">Installez sur votre écran d'accueil pour un accès instantané.</p>
        </div>
      </div>
      <div className="flex items-center space-x-2 shrink-0">
        <button
          onClick={handleInstall}
          className="bg-biso-500 hover:bg-biso-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 flex items-center space-x-1"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Installer</span>
        </button>
        <button
          onClick={handleDismiss}
          className="text-white/60 hover:text-white p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
