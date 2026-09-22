import { NextResponse } from 'next/server'
import webPush from 'web-push'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contact@biso-invest.com'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

// Client service role (optional) — bypasses RLS pour l'admin/cleanup.
// Créé paresseusement pour éviter un crash au build si la clé est absente.
let serviceClient: ReturnType<typeof createServiceClient> | null = null
function getService() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  if (!serviceClient) {
    serviceClient = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
  }
  return serviceClient
}

export async function POST(req: Request) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Push notifications not configured (missing VAPID keys)' }, { status: 500 })
  }

  try {
    const { userId, title, body, url } = await req.json()
    if (!userId || !title || !body) {
      return NextResponse.json({ error: 'Missing userId, title, or body' }, { status: 400 })
    }

    // Auth verification via cookies — le demandeur doit être l'utilisateur lui-même ou un admin
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: adminRow } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (user.id !== userId && !adminRow) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Lecteur des abonnements : la RLS autorise l'utilisateur sur ses propres lignes
    // et l'admin sur toutes. La clé service (si présente) est un filet de sécurité.
    const reader = getService() || supabase

    const { data: subs, error: subErr } = await reader
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_token')
      .eq('user_id', userId)

    if (subErr) throw subErr
    if (!subs || subs.length === 0) {
      return NextResponse.json({ success: true, sent: 0, reason: 'no subscriptions' })
    }

    const payload = JSON.stringify({
      title,
      body,
      data: { url: url || '/dashboard' },
    })

    let sent = 0
    const toDelete: string[] = []

    await Promise.all(
      subs.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth_token },
        }

        try {
          await webPush.sendNotification(pushSubscription, payload)
          sent++
        } catch (err: any) {
          // 404/410 = abonnement expiré → nettoyage (uniquement si la clé service est dispo)
          if ((err.statusCode === 404 || err.statusCode === 410)) {
            toDelete.push(sub.id)
          } else {
            console.error('Push send error (will skip):', err.message || err.statusCode)
          }
        }
      })
    )

    if (toDelete.length > 0) {
      const cleaner = getService()
      if (cleaner) {
        await cleaner.from('push_subscriptions').delete().in('id', toDelete)
      }
    }

    return NextResponse.json({ success: true, sent, total: subs.length, cleaned: toDelete.length })
  } catch (err: any) {
    console.error('Push notify route error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}