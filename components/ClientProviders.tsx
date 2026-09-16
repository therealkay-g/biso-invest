'use client'

import { ReactNode } from 'react'
import { ThemeProvider } from '@/components/ThemeProvider'
import { RealtimeProvider } from '@/components/RealtimeProvider'
import SeasonalThemeProvider from '@/components/SeasonalThemeProvider'
import GlobalAnnouncementPopup from '@/components/GlobalAnnouncementPopup'
import OnboardingTour from '@/components/OnboardingTour'
import Chatbot from '@/components/Chatbot'
import AIAdvisor from '@/components/AIAdvisor'
import VoiceAssistant from '@/components/VoiceAssistant'

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <RealtimeProvider>
      <ThemeProvider>
        <GlobalAnnouncementPopup />
        <OnboardingTour />
        <Chatbot />
        <AIAdvisor />
        <VoiceAssistant />
        <SeasonalThemeProvider>
          {children}
        </SeasonalThemeProvider>
      </ThemeProvider>
    </RealtimeProvider>
  )
}
