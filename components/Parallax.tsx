'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'

interface ParallaxProps {
  children: ReactNode
  className?: string
  max?: number
}

/**
 * Parallax léger (desktop uniquement, pas d'écran tactile) : déplace le contenu
 * de ±max px en suivant la souris, recentré au départ de la souris.
 * Respecte prefers-reduced-motion (aucun déplacement).
 */
export default function Parallax({ children, className = '', max = 6 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse = window.matchMedia('(pointer: coarse)').matches
    setEnabled(!reduced && !coarse)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return

    let raf = 0
    let tx = 0
    let ty = 0

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      tx = (e.clientX - rect.left - rect.width / 2) * (max / Math.max(rect.width, 1))
      ty = (e.clientY - rect.top - rect.height / 2) * (max / Math.max(rect.height, 1))
    }

    const onLeave = () => {
      tx = 0
      ty = 0
    }

    const tick = () => {
      el.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`
      raf = requestAnimationFrame(tick)
    }

    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    raf = requestAnimationFrame(tick)

    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [enabled, max])

  return (
    <div ref={ref} className={className} style={{ willChange: enabled ? 'transform' : 'auto' }}>
      {children}
    </div>
  )
}