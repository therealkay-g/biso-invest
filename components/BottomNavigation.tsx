'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Package, Headphones, Users, User } from 'lucide-react'

export default function BottomNavigation() {
  const pathname = usePathname()

  // Hide on auth or admin pages if needed
  if (pathname?.startsWith('/auth') || pathname?.startsWith('/admin')) {
    return null
  }

  const navItems = [
    { href: '/dashboard', label: 'Accueil', icon: Home },
    { href: '/invest', label: 'Investir', icon: Package },
    { href: '/service', label: 'Service', icon: Headphones },
    { href: '/team', label: 'Équipe', icon: Users },
    { href: '/profile', label: 'Moi', icon: User },
  ]

  return (
    <nav aria-label="Navigation principale" className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 px-4 py-2 flex justify-around items-center shadow-lg">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
              isActive ? 'text-biso-600 font-semibold' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon className={`w-6 h-6 mb-1 ${isActive ? 'text-biso-600' : 'text-gray-500'}`} />
            <span className="text-xs">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
