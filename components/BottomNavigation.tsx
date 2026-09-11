'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, TrendingUp, Gift, User } from 'lucide-react'

export default function BottomNavigation() {
  const pathname = usePathname()

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
              <span className="absolute -top-1.5 w-8 h-1 rounded-full bg-emerald-500 nav-indicator" />
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