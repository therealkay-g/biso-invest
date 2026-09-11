'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'

interface PullToRefreshProps {
  children: ReactNode
  onRefresh: () => void | Promise<void>
  className?: string
}

const THRESHOLD = 80

/**
 * Pull-to-refresh tactile (uniquement sur écran tactile) : tire le contenu vers
 * le bas quand on est en haut de page, déclenche `onRefresh` au-delà de 80px.
 * Désactivé sur desktop et avec prefers-reduced-motion.
 */
export default function PullToRefresh({ children, onRefresh, className = '' }: PullToRefreshProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(false)
  const [pull, setPull] = useState(0)
  const startY = useRef(0)
  const pulling = useRef(false)
  const refreshing = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse = window.matchMedia('(pointer: coarse)').matches
    setEnabled(!reduced && coarse)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 0 && !refreshing.current) {
        startY.current = e.touches[0].clientY
        pulling.current = true
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || refreshing.current) return
      const dy = e.touches[0].clientY - startY.current
      if (dy > 0 && window.scrollY <= 0) {
        setPull(Math.min(dy, 96))
        if (el.scrollHeight > 0 && dy > 0) e.preventDefault?.()
      } else {
        setPull(0)
      }
    }

    const onTouchEnd = () => {
      if (!pulling.current) return
      pulling.current = false
      if (pull >= THRESHOLD) {
        refreshing.current = true
        setPull(THRESHOLD)
        Promise.resolve(onRefresh()).finally(() => {
          refreshing.current = false
          setPull(0)
        })
      } else {
        setPull(0)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [enabled, onRefresh, pull])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div
        className="absolute inset-x-0 top-0 flex justify-center transition-transform duration-200 overflow-hidden"
        style={{ transform: `translateY(${pull - 64}px)`, opacity: pull > 0 ? 1 : 0 }}
        aria-hidden={pull === 0}
      >
        <div className={`spinner text-emerald-600 ${pull >= THRESHOLD ? 'opacity-100' : 'opacity-60'}`} />
      </div>
      {children}
    </div>
  )
}