'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import anime from 'animejs'

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
 * Apparition fluide avec anime.js
 */
export default function Reveal({
  children,
  delay = 0,
  duration = 800,
  className = '',
  axis = 'y',
  from = 30,
  fromLeft = false,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }

    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            setVisible(true)
            hasAnimated.current = true

            anime({
              targets: el,
              opacity: [0, 1],
              translateX: axis === 'x' ? [fromLeft ? -from : from, 0] : [0, 0],
              translateY: axis === 'y' ? [from, 0] : [0, 0],
              duration: duration,
              delay: delay,
              easing: 'cubicBezier(0.22, 1, 0.36, 1)',
            })
            observer.disconnect()
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -20px 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [axis, from, fromLeft, duration, delay])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        willChange: 'transform, opacity',
      }}
    >
      {children}
    </div>
  )
}
