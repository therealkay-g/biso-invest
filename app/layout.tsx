import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import BottomNavigation from '@/components/BottomNavigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BISO INVEST — Ensemble, construisons demain.',
  description: 'Plateforme d’investissement dans l’économie réelle en RDC (Agriculture, Élevage, Commerce, Énergie, Transport, Restauration).',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased min-h-screen pb-20 md:pb-0`}>
        <div className="max-w-md mx-auto md:max-w-4xl lg:max-w-6xl min-h-screen bg-white shadow-xl relative flex flex-col justify-between">
          <main className="flex-1 pb-16 md:pb-0">
            {children}
          </main>
          <BottomNavigation />
        </div>
      </body>
    </html>
  )
}
