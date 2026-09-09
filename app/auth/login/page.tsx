'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase/client'
import { Lock, Phone, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const email = `${phone.replace(/[^0-9]/g, '')}@bisoinvest.com`

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        throw authError
      }

      // Si l'utilisateur est un administrateur, redirection directe vers le panel admin
      if (data?.user) {
        const { data: adminRow } = await supabase
          .from('admin_users')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle()

        if (adminRow) {
          router.push('/admin')
          return
        }
      }

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion. Vérifiez vos identifiants.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:flex-row min-h-screen bg-[#0b1e36]">
      {/* Left column - Logo + Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8 md:py-12 bg-gray-50 md:max-w-md lg:max-w-lg md:min-w-[420px]">
        <div className="w-full max-w-sm mx-auto">
          {/* Logo */}
          <div className="text-center mb-8">
            <Image
              src="/images/logo.png"
              alt="BISO INVEST"
              width={72}
              height={72}
              className="mx-auto rounded-2xl shadow-lg mb-4"
              priority
            />
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">BISO INVEST</h2>
            <p className="text-sm text-gray-500 mt-1">« Ensemble, construisons demain. »</p>
          </div>

          {/* Form card */}
          <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-gray-100">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Numéro de téléphone</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="+243..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-biso-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-gray-700">Mot de passe</label>
                  <Link href="/auth/forgot-password" className="text-[11px] text-biso-600 font-bold hover:underline">
                    Mot de passe oublié ?
                  </Link>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-biso-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-biso-600 hover:bg-biso-700 text-white font-semibold py-3 px-4 rounded-xl text-sm flex items-center justify-center space-x-2 transition-all shadow-md mt-6"
              >
                <span>{loading ? 'Connexion en cours...' : 'SE CONNECTER'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-gray-500">
              Pas encore de compte ?{' '}
              <Link href="/auth/register" className="text-biso-600 font-bold hover:underline">
                S&apos;inscrire
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Right column - Banner image (hidden on mobile, visible md+) */}
      <div className="hidden md:block flex-1 relative">
        <Image
          src="/images/login-banner.jpg"
          alt="Investissez dans l'économie réelle en RDC"
          fill
          className="object-cover"
          priority
        />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#0b1e36]/40" />
        <div className="absolute bottom-8 left-8 right-8 text-white">
          <h3 className="text-2xl font-bold drop-shadow-lg">Investissez dans l&apos;économie réelle</h3>
          <p className="text-sm mt-2 text-white/80 drop-shadow">Agriculture · Élevage · Commerce · Énergie · Transport · Restauration</p>
        </div>
      </div>

      {/* Mobile banner (compact, visible only on small screens) */}
      <div className="md:hidden relative h-32 w-full">
        <Image
          src="/images/login-banner.jpg"
          alt="Investissez dans l'économie réelle en RDC"
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[#0b1e36]/50 flex items-center justify-center">
          <p className="text-white text-xs font-semibold text-center px-4">Agriculture · Élevage · Commerce · Énergie · Transport · Restauration</p>
        </div>
      </div>
    </div>
  )
}
