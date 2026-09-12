'use client'

import { useEffect, useRef } from 'react'
import anime from 'animejs'

interface ProgressBarProps {
  value: number
  max?: number
  className?: string
  barClassName?: string
  delay?: number
  duration?: number
}

/**
 * Barre de progression animée avec anime.js : tween fluide 0 → valeur réelle.
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
  const barRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ v: 0 })

  useEffect(() => {
    const el = barRef.current
    if (!el) return

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stateRef.current.v = pct
      el.style.width = `${pct}%`
      return
    }

    anime({
      targets: stateRef.current,
      v: pct,
      duration,
      delay,
      easing: 'easeOutExpo',
      update: () => {
        el.style.width = `${stateRef.current.v}%`
      },
      complete: () => {
        el.style.width = `${pct}%`
      },
    })
  }, [pct, duration, delay])

  return (
    <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${className}`}>
      <div
        ref={barRef}
        className={`h-full rounded-full ${barClassName}`}
        style={{ width: '0%' }}
      />
    </div>
  )
}