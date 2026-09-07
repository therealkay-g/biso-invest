'use client'

import { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: string | number
  icon: ReactNode
  color?: string
}

export default function StatCard({ title, value, icon, color = 'bg-biso-50 text-biso-600' }: StatCardProps) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center space-x-3">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{title}</p>
        <p className="text-base font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}
