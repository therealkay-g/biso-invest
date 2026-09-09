'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase/client'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // Si l'utilisateur est admin, vérifier et router vers /admin ou /dashboard
        try {
          const { data: adminRow } = await supabase
            .from('admin_users')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle()
          if (adminRow) {
            router.push('/admin')
            return
          }
        } catch {}
        router.push('/dashboard')
      } else {
        router.push('/auth/login')
      }
    }
    checkUser()
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <Image
        src="/images/logo.png"
        alt="BISO INVEST"
        width={72}
        height={72}
        className="rounded-2xl shadow-xl mb-4 animate-pulse"
        priority
      />
      <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">BISO INVEST</h1>
      <p className="text-xs text-gray-500 mt-1">« Ensemble, construisons demain. »</p>
      <div className="mt-6 animate-spin rounded-full h-8 w-8 border-b-2 border-biso-600"></div>
    </div>
  )
}
