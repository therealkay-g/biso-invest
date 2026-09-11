'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'

interface RevealProps {
  children: ReactNode
  delay?: number
  duration?: number
  className?: string
}

/**
 * Apparition progressive au scroll : opacity 0→1 + translateY 15px→0.
 * Le stagger se fait via la prop `delay` (60–90ms par carte).
 * Respecte prefers-reduced-motion (apparition instantanée).
 */
export default function Reveal({ children, delay = 0, duration = 400, className = '' }: RevealProps) {
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

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(15px)',
        transitionProperty: 'opacity, transform',
        transitionDuration: reducedRef.current ? '0ms' : `${duration}ms`,
        transitionDelay: reducedRef.current ? '0ms' : `${delay}ms`,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: visible ? 'auto' : 'opacity, transform',
      }}
    >
      {children}
    </div>
  )
}