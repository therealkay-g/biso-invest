'use client'

import { useEffect, useRef, useState } from 'react'
import anime from 'animejs'

interface AnimatedNumberProps {
  value: number
  duration?: number
  format?: (display: number) => string
  className?: string
}

/**
 * Compteur numérique fluide avec anime.js
 */
export default function AnimatedNumber({ value, duration = 1200, format, className = '' }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0)
  const numberRef = useRef({ current: 0 })

  useEffect(() => {
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const startValue = numberRef.current.current

    if (reduced || startValue === value) {
      setDisplay(value)
      return
    }

    anime({
      targets: numberRef.current,
      current: {
        value: value,
      },
      duration: duration,
      easing: 'easeOutExpo',
      update: () => {
        setDisplay(Math.round(numberRef.current.current))
      },
      complete: () => {
        setDisplay(value)
      }
    })
  }, [value, duration])

  return <span className={className}>{format ? format(display) : Math.round(display).toLocaleString('fr-FR')}</span>
}
