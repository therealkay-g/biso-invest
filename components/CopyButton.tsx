'use client'

import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CopyButtonProps {
  textToCopy: string
  label?: string
  className?: string
  iconOnly?: boolean
}

export default function CopyButton({ textToCopy, label, className = '', iconOnly = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Erreur copie presse-papier:', err)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copier"
      className={`inline-flex items-center space-x-1.5 transition-all active:scale-95 ${
        copied
          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
          : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
      } border px-2.5 py-1 rounded-xl text-xs font-semibold ${className}`}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          {!iconOnly && <span>Copié !</span>}
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          {!iconOnly && <span>{label || 'Copier'}</span>}
        </>
      )}
    </button>
  )
}
