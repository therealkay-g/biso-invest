'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, TrendingUp, Gift, User } from 'lucide-react'
import anime from 'animejs'

export default function BottomNavigation() {
  const pathname = usePathname()
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const nav = navRef.current
    if (!nav) return

    const indicator = nav.querySelector<HTMLElement>('.nav-indicator')
    if (indicator) {
      indicator.style.transform = 'scaleX(0)'
      anime({
        targets: indicator,
        scaleX: [0, 1],
        duration: 400,
        easing: 'spring(1, 100, 12, 0)',
      })
    }

    const icon = nav.querySelector<HTMLElement>('.nav-icon-active')
    if (icon) {
      icon.style.transform = 'translateY(-3px) scale(1.08)'
      anime({
        targets: icon,
        keyframes: [
          { translateY: [6, -3], scale: [0.9, 1.08], duration: 320 },
          { translateY: [-3, -1], scale: [1.08, 0.96], duration: 220 },
          { translateY: [-1, -3], scale: [0.96, 1.08], duration: 180 },
        ],
        easing: 'easeOutExpo',
      })
    }
  }, [pathname])

  if (pathname?.startsWith('/auth') || pathname?.startsWith('/admin')) {
    return null
  }

  const navItems = [
    { href: '/dashboard', label: 'Accueil', icon: Home },
    { href: '/invest', label: 'Investir', icon: TrendingUp },
    { href: '/task', label: 'Tâche', icon: Gift },
    { href: '/profile', label: 'Moi', icon: User },
  ]

  return (
    <nav
      ref={navRef}
      aria-label="Navigation principale"
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 z-50 px-2 pb-2 pt-1.5 flex justify-around items-stretch"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-2xl transition-all ${
              isActive ? 'text-emerald-700' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {isActive && (
              <span className="absolute -top-1.5 w-8 h-1 rounded-full bg-emerald-500 nav-indicator" style={{ animation: 'none' }} />
            )}
            <span className={`w-10 h-8 rounded-xl flex items-center justify-center transition-colors ${isActive ? 'bg-emerald-50' : ''}`}>
              <Icon
                className={`w-[22px] h-[22px] nav-icon tap-icon ${isActive ? 'nav-icon-active text-emerald-600' : ''}`}
                strokeWidth={isActive ? 2.4 : 2}
                aria-hidden="true"
              />
            </span>
            <span className={`text-[10px] font-bold nav-label ${isActive ? 'nav-label-active text-emerald-700' : 'nav-label-inactive text-gray-400'}`}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}