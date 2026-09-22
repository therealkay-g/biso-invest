'use client'

import { ReactNode, useLayoutEffect, useRef } from 'react'
import anime from 'animejs'

interface PageEnterProps {
  children: ReactNode
  className?: string
  duration?: number
}

/**
 * Entrée de page animée avec anime.js : fondu + léger glissement vers le haut.
 * Respecte prefers-reduced-motion (aucune animation).
 */
export default function PageEnter({ children, className = '', duration = 700 }: PageEnterProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    el.style.opacity = '0'
    el.style.willChange = 'transform, opacity'

    anime({
      targets: el,
      opacity: [0, 1],
      translateY: [18, 0],
      duration,
      easing: 'cubicBezier(0.22, 1, 0.36, 1)',
      complete: () => {
        el.style.willChange = 'auto'
      },
    })
  }, [duration])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}