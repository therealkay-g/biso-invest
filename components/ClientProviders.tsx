'use client'

import { ReactNode } from 'react'
import { ThemeProvider } from '@/components/ThemeProvider'
import SeasonalThemeProvider from '@/components/SeasonalThemeProvider'
import GlobalAnnouncementPopup from '@/components/GlobalAnnouncementPopup'
import OnboardingTour from '@/components/OnboardingTour'
import Chatbot from '@/components/Chatbot'

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <GlobalAnnouncementPopup />
      <OnboardingTour />
      <Chatbot />
      <SeasonalThemeProvider>
        {children}
      </SeasonalThemeProvider>
    </ThemeProvider>
  )
}
