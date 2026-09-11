'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'

interface RevealProps {
  children: ReactNode
  delay?: number
  duration?: number
  className?: string
  axis?: 'y' | 'x'
  from?: number
  fromLeft?: boolean
}

/**
 * Apparition progressive au scroll : opacity 0→1 + translate → 0.
 * - axis "y" (défaut) : arrive par le bas (translateY +from).
 * - axis "x" : arrive par la droite (fromLeft=false) ou la gauche (fromLeft=true).
 * Le stagger se fait via la prop `delay` (60ms par carte).
 * Respecte prefers-reduced-motion (apparition instantanée).
 */
export default function Reveal({
  children,
  delay = 0,
  duration = 300,
  className = '',
  axis = 'y',
  from = 12,
  fromLeft = false,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const reducedRef = useRef(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      reducedRef.current = true
      setVisible(true)
      return
    }

    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.05, rootMargin: '0px 0px -20px 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const hiddenTransform =
    axis === 'x'
      ? `translateX(${fromLeft ? -from : from}px)`
      : `translateY(${from}px)`

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translate(0, 0)' : hiddenTransform,
        transitionProperty: 'opacity, transform',
        transitionDuration: reducedRef.current ? '0ms' : `${duration}ms`,
        transitionDelay: reducedRef.current ? '0ms' : `${delay}ms`,
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        willChange: visible ? 'auto' : 'opacity, transform',
      }}
    >
      {children}
    </div>
  )
}