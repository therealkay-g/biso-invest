'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface SeasonalTheme {
  primary_color: string
  secondary_color: string | null
  is_active: boolean
}

export default function SeasonalThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<SeasonalTheme | null>(null)

  useEffect(() => {
    async function fetchTheme() {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('seasonal_themes')
        .select('primary_color, secondary_color, is_active')
        .eq('is_active', true)
        .lt('start_date', now)
        .gt('end_date', now)
        .maybeSingle()

      if (!error && data) {
        setTheme(data)
        // Inject CSS variables into the root element
        document.documentElement.style.setProperty('--color-primary', data.primary_color)
        if (data.secondary_color) {
          document.documentElement.style.setProperty('--color-secondary', data.secondary_color)
        }
      }
    }

    fetchTheme()
  }, [])

  return <>{children}</>
}
