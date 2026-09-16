'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const toast = useToast()

  useEffect(() => {
    async function checkSubscription() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      setIsSubscribed(!!data)
    }

    checkSubscription()
  }, [])

  const subscribe = async () => {
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        toast.error('Permission de notification refusée.')
        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // VAPID public key would go here in a real production environment
        // applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const subscriptionData = subscription.toJSON()

      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subscriptionData.endpoint,
        p256dh: subscriptionData.keys?.p256dh ?? '',
        auth_token: subscriptionData.keys?.auth ?? '',
      })

      if (error) throw error

      setIsSubscribed(true)
      toast.success('Notifications activées !')
    } catch (err: any) {
      console.error('Push subscription error:', err)
      toast.error('Erreur lors de l\'activation des notifications.')
    }
  }

  const unsubscribe = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)

      if (error) throw error

      setIsSubscribed(false)
      toast.info('Notifications désactivées.')
    } catch (err: any) {
      console.error('Push unsubscribe error:', err)
      toast.error('Erreur lors de la désactivation.')
    }
  }

  return { isSubscribed, subscribe, unsubscribe }
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
