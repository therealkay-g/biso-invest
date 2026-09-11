'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  duration?: number
  format?: (display: number) => string
  className?: string
}

/**
 * Compteur numérique : part de la valeur précédente et rejoint progressivement
 * `value` (easing cubic ease-out). N'altère jamais la donnée : pure mise en forme.
 * Respecte prefers-reduced-motion (affichage direct de la valeur finale).
 */
export default function AnimatedNumber({ value, duration = 700, format, className = '' }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0)
  const prevRef = useRef(0)

  useEffect(() => {
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const from = prevRef.current
    prevRef.current = value

    if (reduced || from === value) {
      setDisplay(value)
      return
    }

    let raf = 0
    let start: number | null = null

    const step = (ts: number) => {
      if (start === null) start = ts
      const elapsed = ts - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(from + (value - from) * eased)
      if (progress < 1) {
        raf = requestAnimationFrame(step)
      } else {
        setDisplay(value)
      }
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return <span className={className}>{format ? format(display) : Math.round(display).toLocaleString('fr-FR')}</span>
}