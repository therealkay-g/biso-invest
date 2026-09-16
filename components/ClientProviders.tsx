'use client'

import { ReactNode } from 'react'
import { ThemeProvider } from '@/components/ThemeProvider'
import SeasonalThemeProvider from '@/components/SeasonalThemeProvider'
import GlobalAnnouncementPopup from '@/components/GlobalAnnouncementPopup'

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <GlobalAnnouncementPopup />
      <SeasonalThemeProvider>
        {children}
      </SeasonalThemeProvider>
    </ThemeProvider>
  )
}
