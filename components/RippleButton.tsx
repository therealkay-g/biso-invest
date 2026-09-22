'use client'

import { MouseEvent, ReactNode, useRef } from 'react'
import Link from 'next/link'
import anime from 'animejs'

interface RippleButtonProps {
  children: ReactNode
  onClick?: (e: MouseEvent<HTMLElement>) => void
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit'
}

export function RippleButton({ children, onClick, className = '', disabled = false, type = 'button' }: RippleButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    spawnRipple(e, ref.current)
    onClick?.(e)
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={handleClick}
      className={`btn-ripple ${className}`}
    >
      {children}
    </button>
  )
}

interface RippleLinkProps {
  children: ReactNode
  href: string
  className?: string
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
}

export function RippleLink({ children, href, className = '', onClick }: RippleLinkProps) {
  const ref = useRef<HTMLAnchorElement>(null)

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    spawnRipple(e, ref.current)
    onClick?.(e)
  }

  return (
    <Link href={href} ref={ref} onClick={handleClick} className={`btn-ripple ${className}`}>
      {children}
    </Link>
  )
}

function spawnRipple(e: MouseEvent<HTMLElement>, host: HTMLElement | null) {
  if (!host || typeof window === 'undefined') return

  const prefersReduced =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReduced) return

  const isTouch = window.matchMedia('(pointer: coarse)').matches
  const rect = host.getBoundingClientRect()
  const size = isTouch ? Math.max(rect.width, rect.height) * 1.4 : 28
  const x = e.clientX - rect.left - size / 2
  const y = e.clientY - rect.top - size / 2

  const ink = document.createElement('span')
  ink.className = 'ripple-ink'
  ink.style.animation = 'none'
  ink.style.transform = 'scale(0.2)'
  ink.style.opacity = '0.35'
  ink.style.width = `${size}px`
  ink.style.height = `${size}px`
  ink.style.left = `${x}px`
  ink.style.top = `${y}px`

  host.appendChild(ink)

  anime({
    targets: ink,
    scale: [0.2, 1],
    opacity: [0.35, 0],
    duration: isTouch ? 550 : 450,
    easing: 'easeOutExpo',
    complete: () => ink.remove(),
  })
}