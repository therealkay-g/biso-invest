'use client'

import { Children, ReactNode, useLayoutEffect, useRef } from 'react'
import anime from 'animejs'

interface StaggerInProps {
  children: ReactNode
  className?: string
  stagger?: number
  duration?: number
  delay?: number
  axis?: 'y' | 'x'
  from?: number
  fromLeft?: boolean
  threshold?: number
}

/**
 * Apparition en cascade (stagger) des enfants directs avec anime.js.
 * Un seul tween anime.js anime tous les éléments via anime.stagger().
 * Respecte prefers-reduced-motion (éléments directement visibles).
 */
export default function StaggerIn({
  children,
  className = '',
  stagger = 60,
  duration = 650,
  delay = 0,
  axis = 'y',
  from = 24,
  fromLeft = false,
  threshold = 0.05,
}: StaggerInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const count = Children.count(children)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const items = Array.from(el.children) as HTMLElement[]
    if (items.length === 0) return

    items.forEach((item) => {
      item.style.opacity = '0'
      item.style.willChange = 'transform, opacity'
    })

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          observer.disconnect()

          anime({
            targets: items,
            opacity: [0, 1],
            translateX: axis === 'x' ? [fromLeft ? -from : from, 0] : [0, 0],
            translateY: axis === 'y' ? [from, 0] : [0, 0],
            duration,
            delay: anime.stagger(stagger, { start: delay }),
            easing: 'cubicBezier(0.22, 1, 0.36, 1)',
          })
        })
      },
      { threshold, rootMargin: '0px 0px -20px 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [count, stagger, duration, delay, axis, from, fromLeft, threshold])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}