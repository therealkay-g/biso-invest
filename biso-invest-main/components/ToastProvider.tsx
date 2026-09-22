'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import anime from 'animejs'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextType {
  toast: {
    success: (message: string, duration?: number) => void
    error: (message: string, duration?: number) => void
    info: (message: string, duration?: number) => void
  }
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

const EXIT_MS = 220

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [exiting, setExiting] = useState<string[]>([])
  const elsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const enteredRef = useRef<Set<string>>(new Set())

  const setEl = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) elsRef.current.set(id, el)
    else elsRef.current.delete(id)
  }, [])

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    toasts.forEach((t) => {
      if (enteredRef.current.has(t.id)) return
      enteredRef.current.add(t.id)

      const el = elsRef.current.get(t.id)
      if (!el) return
      if (reduced) return

      anime({
        targets: el,
        opacity: [0, 1],
        translateY: [12, 0],
        scale: [0.95, 1],
        duration: 320,
        easing: 'spring(1, 120, 14, 0)',
      })
    })
  }, [toasts])

  const removeToast = useCallback((id: string) => {
    setExiting((prev) => {
      if (prev.includes(id)) return prev
      return [...prev, id]
    })

    const el = elsRef.current.get(id)
    const finish = () => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      setExiting((prev) => prev.filter((x) => x !== id))
      enteredRef.current.delete(id)
    }

    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || !el) {
      finish()
      return
    }

    anime({
      targets: el,
      opacity: [1, 0],
      translateY: [0, 12],
      scale: [1, 0.96],
      duration: EXIT_MS,
      easing: 'easeInCubic',
      complete: finish,
    })
  }, [])

  const addToast = useCallback((message: string, type: ToastType, duration = 2500) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: Toast = { id, message, type, duration }

    setToasts((prev) => [...prev, newToast])
    setExiting((prev) => prev.filter((x) => x !== id))

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [removeToast])

  const toast = {
    success: (msg: string, dur?: number) => addToast(msg, 'success', dur),
    error: (msg: string, dur?: number) => addToast(msg, 'error', dur),
    info: (msg: string, dur?: number) => addToast(msg, 'info', dur),
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 pointer-events-none space-y-2">
        {toasts.map((t) => {
          const isSuccess = t.type === 'success'
          const isError = t.type === 'error'
          const isExiting = exiting.includes(t.id)

          return (
            <div
              key={t.id}
              ref={(el) => setEl(t.id, el)}
              className={`pointer-events-auto flex items-start space-x-3 p-4 rounded-2xl shadow-xl border backdrop-blur-md ${
                isExiting ? 'opacity-0' : ''
              } ${
                isSuccess
                  ? 'bg-emerald-900/95 text-white border-emerald-500/30'
                  : isError
                  ? 'bg-rose-900/95 text-white border-rose-500/30'
                  : 'bg-zinc-900/95 text-white border-zinc-700/40'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {isError && <AlertCircle className="w-5 h-5 text-rose-400" />}
                {!isSuccess && !isError && <Info className="w-5 h-5 text-amber-400" />}
              </div>
              <div className="flex-1 text-xs font-semibold leading-relaxed">
                {t.message}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 text-white/60 hover:text-white transition-colors"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context.toast
}