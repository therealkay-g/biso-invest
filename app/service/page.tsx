'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { SupportTicket, FaqItem, Announcement, NotificationItem } from '@/types'
import Header from '@/components/Header'
import { Headphones, HelpCircle, Bell, MessageSquare, Send } from 'lucide-react'

function ServiceContent() {
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'faq'
  const [activeTab, setActiveTab] = useState(defaultTab)

  const [faq, setFaq] = useState<FaqItem[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)

  // New ticket state
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [ticketSuccess, setTicketSuccess] = useState('')

  useEffect(() => {
    async function loadService() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          window.location.href = '/auth/login'
          return
        }

        const { data: faqData } = await supabase.from('faq').select('*').order('display_order')
        setFaq(faqData || [])

        const { data: annData } = await supabase.from('announcements').select('*').eq('is_published', true).order('created_at', { ascending: false })
        setAnnouncements(annData || [])

        const { data: notifData } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        setNotifications(notifData || [])

        const { data: tickData } = await supabase.from('support_tickets').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        setTickets(tickData || [])

      } catch (err) {
        console.error('Error loading service:', err)
      } finally {
        setLoading(false)
      }
    }

    loadService()
  }, [])

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    setTicketSuccess('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      const { data: ticketData, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({ user_id: user.id, subject, status: 'EN_ATTENTE' })
        .select()
        .single()

      if (ticketError) throw ticketError

      await supabase.from('support_messages').insert({
        ticket_id: ticketData.id,
        sender_id: user.id,
        is_admin: false,
        message
      })

      setTicketSuccess('Ticket de support créé avec succès.')
      setSubject('')
      setMessage('')

      // Reload tickets
      const { data: tickData } = await supabase.from('support_tickets').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      setTickets(tickData || [])

    } catch (err: any) {
      console.error('Error creating ticket:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-biso-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header displayName="Service Client" vipLevel="Support & FAQ" />

      <div className="p-4 max-w-4xl mx-auto space-y-6">
        {/* Tabs */}
        <div className="flex space-x-2 overflow-x-auto bg-white p-1 rounded-2xl border border-gray-100 shadow-xs">
          <button
            onClick={() => setActiveTab('faq')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'faq' ? 'bg-biso-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            FAQ
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'tickets' ? 'bg-biso-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Mes Tickets
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'announcements' ? 'bg-biso-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Annonces
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'notifications' ? 'bg-biso-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Notifications
          </button>
        </div>

        {activeTab === 'faq' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800 text-sm">Foire Aux Questions (FAQ)</h3>
            <div className="space-y-3">
              {faq.map((item) => (
                <div key={item.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-2">
                  <h4 className="font-bold text-gray-900 text-sm flex items-center space-x-2">
                    <HelpCircle className="w-4 h-4 text-biso-600 shrink-0" />
                    <span>{item.question}</span>
                  </h4>
                  <p className="text-xs text-gray-600 pl-6 leading-relaxed">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
              <h3 className="font-bold text-gray-900 text-base">Ouvrir un Ticket de Support</h3>
              {ticketSuccess && (
                <div className="bg-emerald-50 text-emerald-600 text-xs p-3 rounded-xl">
                  {ticketSuccess}
                </div>
              )}
              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Sujet</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Problème de recharge..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Message</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Décrivez votre demande en détail..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  ></textarea>
                </div>
                <button
                  type="submit"
                  className="bg-biso-600 hover:bg-biso-700 text-white font-semibold py-3 px-6 rounded-xl text-sm shadow-md flex items-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Envoyer le ticket</span>
                </button>
              </form>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-gray-800 text-sm">Historique de vos tickets</h3>
              {tickets.map((t) => (
                <div key={t.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{t.subject}</h4>
                    <p className="text-[10px] text-gray-500">{new Date(t.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                  <span className="text-xs font-bold bg-biso-50 text-biso-700 px-3 py-1 rounded-full">
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'announcements' && (
          <div className="space-y-3">
            <h3 className="font-bold text-gray-800 text-sm">Annonces Officielles</h3>
            {announcements.map((ann) => (
              <div key={ann.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-2">
                <h4 className="font-bold text-gray-900 text-base">{ann.title}</h4>
                <p className="text-xs text-gray-600 leading-relaxed">{ann.content}</p>
                <p className="text-[10px] text-gray-400">{new Date(ann.created_at).toLocaleDateString('fr-FR')}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-3">
            <h3 className="font-bold text-gray-800 text-sm">Notifications</h3>
            {notifications.map((notif) => (
              <div key={notif.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">{notif.title}</h4>
                  <p className="text-xs text-gray-600">{notif.message}</p>
                </div>
                <span className="text-[10px] text-gray-400">{new Date(notif.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ServicePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-gray-500">Chargement...</div>}>
      <ServiceContent />
    </Suspense>
  )
}
