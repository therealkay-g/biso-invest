'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/dashboard')
      } else {
        router.push('/auth/login')
      }
    }
    checkUser()
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-16 h-16 bg-biso-600 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl shadow-lg mb-4 animate-pulse">
        BI
      </div>
      <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">BISO INVEST</h1>
      <p className="text-xs text-gray-500 mt-1">« Ensemble, construisons demain. »</p>
      <div className="mt-6 animate-spin rounded-full h-8 w-8 border-b-2 border-biso-600"></div>
    </div>
  )
}
