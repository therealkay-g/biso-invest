'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

/**
 * Cloche de notifications : affiche le nombre de notifications non lues.
 * Rafraîchie au montage, au focus de la fenêtre et toutes les 30 secondes.
 */
export default function NotificationsBell() {
  const [unread, setUnread] = useState(0)
  const userRef = useRef<string | null>(null)

  const fetchCount = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUnread(0)
      return
    }
    userRef.current = user.id

    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)

    setUnread(count || 0)
  }, [])

  useEffect(() => {
    fetchCount()

    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchCount()
    }
    const onFocus = () => fetchCount()

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    const interval = setInterval(fetchCount, 30000)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [fetchCount])

  return (
    <Link
      href="/notifications"
      className="relative p-2.5 rounded-full hover:bg-gray-100 transition-colors"
      aria-label="Notifications"
    >
      <Bell className="w-5 h-5 text-gray-700" aria-hidden="true" />
      {unread > 0 && (
        <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center check-pop">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}