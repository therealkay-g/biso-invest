'use client'

import { useEffect, useMemo, useRef } from 'react'

interface ConfettiProps {
  onDone?: () => void
}

const FRAGMENTS = 24

/**
 * Confettis 100% CSS : 24 fragments qui tombent avec rotation/vitesse aléatoires
 * pendant 1.2s. À utiliser UNIQUEMENT pour un événement réel (celui du backend).
 * Respecte prefers-reduced-motion (ne rend rien).
 */
export default function Confetti({ onDone }: ConfettiProps) {
  const doneRef = useRef(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDone?.()
      return
    }

    const timer = setTimeout(() => {
      doneRef.current = true
      onDone?.()
    }, 1250)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fragments = useMemo(
    () =>
      Array.from({ length: FRAGMENTS }).map(() => {
        const side = Math.random() > 0.5 ? 1 : -1
        return {
          left: `${Math.random() * 100}%`,
          x: `${side * (60 + Math.random() * 140)}px`,
          y: `${80 + Math.random() * 160}px`,
          rot: `${side * (120 + Math.random() * 240)}deg`,
          color: ['#10b981', '#f59e0b', '#34d399', '#fde68a', '#6ee7b7'][Math.floor(Math.random() * 5)],
          delay: `${Math.random() * 120}ms`,
        }
      }),
    []
  )

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none overflow-hidden" aria-hidden="true">
      {fragments.map((f, i) => (
        <span
          key={i}
          className="confetti-fragment"
          style={
            {
              left: f.left,
              backgroundColor: f.color,
              animationDelay: f.delay,
              '--confetti-x': f.x,
              '--confetti-y': f.y,
              '--confetti-rot': f.rot,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}