'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { NotificationItem } from '@/types'
import Header from '@/components/Header'
import PageEnter from '@/components/PageEnter'
import StaggerIn from '@/components/StaggerIn'
import PullToRefresh from '@/components/PullToRefresh'
import { Bell, HandCoins, Users, CheckCircle2, CheckCheck, MailOpen } from 'lucide-react'

const TYPE_META: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  profit: { icon: HandCoins, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  referral: { icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
  withdrawal: { icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50' },
}

function groupLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const isSame = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  if (isSame(d, today)) return "Aujourd'hui"
  if (isSame(d, yesterday)) return 'Hier'
  const byYear = d.getFullYear() !== today.getFullYear()
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    ...(byYear ? { year: 'numeric' } : {}),
  })
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMoreUnread, setHasMoreUnread] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/auth/login'
      return
    }

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })

    const items = (data || []) as NotificationItem[]
    setNotifications(items)
    setHasMoreUnread(items.some((n) => !n.is_read))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const markAsRead = async (notif: NotificationItem) => {
    if (notif.is_read) return
    await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id)
    setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)))
    setHasMoreUnread((prev) => prev && notifications.some((n) => !n.is_read && n.id !== notif.id))
  }

  const markAllRead = async () => {
    if (!hasMoreUnread) return
    await supabase.rpc('mark_notifications_read')
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setHasMoreUnread(false)
  }

  // Group by day, keeping order
  const groups: { label: string; items: NotificationItem[] }[] = []
  notifications.forEach((n) => {
    const label = groupLabel(n.created_at)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(n)
    else groups.push({ label, items: [n] })
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="spinner w-8 h-8" aria-hidden="true" />
      </div>
    )
  }

  return (
    <PageEnter className="min-h-screen bg-gray-50 pb-28">
      <Header displayName="Notifications" vipLevel="Centre de notifications" showBack={true} />

      <PullToRefresh onRefresh={() => window.location.reload()}>
        <main className="p-4 max-w-4xl mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-gray-900">Notifications</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Bénéfices, équipe et retraits.
              </p>
            </div>
            <button
              onClick={markAllRead}
              disabled={!hasMoreUnread}
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-2xl transition-colors hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCheck className="w-4 h-4" aria-hidden="true" />
              <span>Tout marquer comme lu</span>
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="card p-10 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <MailOpen className="w-8 h-8" aria-hidden="true" />
              </div>
              <p className="text-sm font-bold text-gray-800">Aucune notification</p>
              <p className="text-xs text-gray-500">
                Vous serez alerté dès qu&apos;un bénéfice sera disponible, qu&apos;un filleul rejoindra votre équipe ou qu&apos;un retrait sera validé.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <section key={group.label} className="space-y-2">
                  <h2 className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                    {group.label}
                  </h2>
                  <StaggerIn className="space-y-2.5" stagger={50}>
                    {group.items.map((notif) => {
                      const meta = TYPE_META[notif.type] || { icon: Bell, color: 'text-gray-600', bg: 'bg-gray-100' }
                      const Icon = meta.icon
                      return (
                        <button
                          key={notif.id}
                          onClick={() => markAsRead(notif)}
                          className={`w-full text-left card p-4 flex items-start space-x-3.5 transition-all active:scale-[0.99] ${
                            notif.is_read ? 'opacity-70' : 'border-l-4 border-l-emerald-500'
                          }`}
                        >
                          <span className={`w-10 h-10 rounded-2xl ${meta.bg} ${meta.color} flex items-center justify-center shrink-0`}>
                            <Icon className="w-5 h-5" aria-hidden="true" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className={`text-sm ${notif.is_read ? 'font-semibold text-gray-700' : 'font-black text-gray-900'}`}>
                                {notif.title}
                              </h3>
                              {!notif.is_read && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5" aria-hidden="true" />
                              )}
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed mt-0.5">{notif.message}</p>
                          </div>
                        </button>
                      )
                    })}
                  </StaggerIn>
                </section>
              ))}
            </div>
          )}
        </main>
      </PullToRefresh>
    </PageEnter>
  )
}