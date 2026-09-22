'use client'

import { Crown } from 'lucide-react'

interface UserAvatarProps {
  name?: string
  vipLevel?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const VIP_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  VIP0: { bg: 'bg-gray-200', text: 'text-gray-600', border: 'border-gray-300' },
  VIP1: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  VIP2: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  VIP3: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  VIP4: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  VIP5: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  VIP6: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  VIP7: { bg: 'bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500', text: 'text-amber-900', border: 'border-amber-400' },
}

export default function UserAvatar({ name, vipLevel = 'VIP0', size = 'md', className = '' }: UserAvatarProps) {
  const style = VIP_STYLES[vipLevel] || VIP_STYLES.VIP0
  const initial = (name || 'U').replace(/[^A-Za-zÀ-ÿ0-9]/g, '').charAt(0).toUpperCase() || 'U'

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-2xl',
  }

  return (
    <div className={`relative flex items-center justify-center rounded-2xl font-black shadow-sm border-2 transition-all duration-300 ${sizeClasses[size]} ${style.bg} ${style.text} ${style.border} ${className}`}>
      {initial}
      {vipLevel !== 'VIP0' && (
        <div className="absolute -top-1 -right-1 p-0.5 bg-white dark:bg-zinc-900 rounded-full border border-gray-100 dark:border-zinc-800">
          <Crown className="w-2 h-2 text-amber-500" />
        </div>
      )}
    </div>
  )
}
