'use client'

import { useEffect, useState } from 'react'
import { X, Megaphone } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface Announcement {
  id: string
  title: string
  content: string
}

export default function GlobalAnnouncementPopup() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    async function fetchAnnouncement() {
      const { data, error } = await supabase
        .from('announcements')
        .select('id, title, content')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!error && data) {
        setAnnouncement(data)
        setIsOpen(true)
      }
    }

    fetchAnnouncement()
  }, [])

  if (!isOpen || !announcement) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden animate-slide-up">
        <div className="relative bg-gradient-to-r from-emerald-600 to-emerald-800 p-6 text-white">
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-xl">
              <Megaphone className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black uppercase tracking-tight">Annonce Importante</h2>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-zinc-100">
            {announcement.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
            {announcement.content}
          </p>

          <button
            onClick={() => setIsOpen(false)}
            className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
          >
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  )
}
