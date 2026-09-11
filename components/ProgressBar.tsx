'use client'

import { useEffect, useState } from 'react'

interface ProgressBarProps {
  value: number
  max?: number
  className?: string
  barClassName?: string
  delay?: number
  duration?: number
}

/**
 * Barre de progression animée : part de 0% et rejoint la valeur réelle
 * (500–800 ms, easing doux). S'active à l'apparition dans le viewport.
 * Respecte prefers-reduced-motion (valeur immédiate).
 */
export default function ProgressBar({
  value,
  max = 100,
  className = '',
  barClassName = '',
  delay = 0,
  duration = 600,
}: ProgressBarProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setWidth(pct)
      return
    }

    let cancelled = false
    const timer = setTimeout(() => {
      if (!cancelled) setWidth(pct)
    }, delay)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [pct, delay])

  return (
    <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-[width] ${barClassName}`}
        style={{
          width: `${width}%`,
          transitionDuration: `${duration}ms`,
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />
    </div>
  )
}