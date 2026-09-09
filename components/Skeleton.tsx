'use client'

import React from 'react'

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-xl ${className}`}
    />
  )
}

export function WalletSkeleton() {
  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 shadow-xl space-y-4 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-4 w-28 bg-gray-700 rounded-md"></div>
        <div className="h-5 w-16 bg-gray-700 rounded-full"></div>
      </div>
      <div className="h-10 w-48 bg-gray-700 rounded-xl my-3"></div>
      <div className="grid grid-cols-3 gap-2 py-3 border-t border-gray-700/60">
        <div className="h-8 bg-gray-700 rounded-md"></div>
        <div className="h-8 bg-gray-700 rounded-md"></div>
        <div className="h-8 bg-gray-700 rounded-md"></div>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="h-10 bg-gray-700 rounded-xl"></div>
        <div className="h-10 bg-gray-700 rounded-xl"></div>
      </div>
    </div>
  )
}

export function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs animate-pulse">
      <div className="h-44 bg-gray-200 w-full"></div>
      <div className="p-4 space-y-3">
        <div className="h-4 w-3/4 bg-gray-200 rounded-md"></div>
        <div className="h-3 w-1/2 bg-gray-200 rounded-md"></div>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <div className="h-6 bg-gray-200 rounded-md"></div>
          <div className="h-6 bg-gray-200 rounded-md"></div>
        </div>
        <div className="h-10 bg-gray-200 rounded-xl mt-3"></div>
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3 animate-pulse">
      <div className="h-5 w-40 bg-gray-200 rounded-md mb-4"></div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
          <div className="space-y-1.5 w-1/2">
            <div className="h-3.5 bg-gray-200 rounded-md w-3/4"></div>
            <div className="h-2.5 bg-gray-200 rounded-md w-1/2"></div>
          </div>
          <div className="h-5 w-20 bg-gray-200 rounded-full"></div>
        </div>
      ))}
    </div>
  )
}
