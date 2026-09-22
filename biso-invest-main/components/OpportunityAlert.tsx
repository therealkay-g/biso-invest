'use client'

import { useEffect, useState } from 'react'
import { Bell, ArrowUpRight, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

interface Opportunity {
  id: string
  title: string
  message: string
  target_pack_id: string | null
}

export default function OpportunityAlert() {
  const [alert, setAlert] = useState<Opportunity | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    async function fetchAlert() {
      const { data, error } = await supabase
        .from('opportunity_alerts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!error && data) {
        setAlert(data)
        setIsVisible(true)
      }
    }

    fetchAlert()
  }, [])

  if (!isVisible || !alert) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="relative overflow-hidden bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl shadow-sm animate-fade-in"
      >
        <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-400/10 rounded-full blur-2xl" />

        <div className="flex items-start gap-4 relative z-10">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Opportunité</span>
              <span className="w-1 h-1 rounded-full bg-amber-300" />
              <span className="text-[10px] font-bold text-gray-500 dark:text-zinc-400">Offre Limitée</span>
            </div>
            <h3 className="text-sm font-black text-gray-900 dark:text-zinc-100 leading-tight mb-1">
              {alert.title}
            </h3>
            <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed mb-3">
              {alert.message}
            </p>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsVisible(false)}
                className="text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
              >
                Ignorer
              </button>
              {alert.target_pack_id && (
                <Link
                  href={`/invest`}
                  className="inline-flex items-center gap-1 text-xs font-black text-amber-700 dark:text-amber-400 hover:underline"
                >
                  En profiter <ArrowUpRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
