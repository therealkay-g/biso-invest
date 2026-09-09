'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { Lock, Phone, Gift, ArrowRight } from 'lucide-react'
import Image from 'next/image'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) {
      setReferralCode(ref)
    }
  }, [searchParams])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)

    try {
      const email = `${phone.replace(/[^0-9]/g, '')}@bisoinvest.com`
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            phone,
            referral_code: referralCode || null,
          },
        },
      })

      if (authError) throw authError

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'inscription.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <div className="w-16 h-16 bg-biso-600 rounded-2xl mx-auto flex items-center justify-center text-white font-extrabold text-2xl shadow-lg mb-4">
          BI
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Créer un compte Biso Invest</h2>
        <p className="text-sm text-gray-500 mt-1">« Ensemble, construisons demain. »</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white py-8 px-6 shadow-xl rounded-2xl border border-gray-100">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
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
            <label className="block text-xs font-semibold text-gray-700 mb-1">Mot de passe</label>
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

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Confirmer le mot de passe</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-biso-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Code de parrainage (facultatif)</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Gift className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Ex: BISO1234"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-biso-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-biso-600 hover:bg-biso-700 text-white font-semibold py-3 px-4 rounded-xl text-sm flex items-center justify-center space-x-2 transition-all shadow-md mt-6"
          >
            <span>{loading ? 'Création en cours...' : 'S’INSCRIRE'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-500">
          Déjà un compte ?{' '}
          <Link href="/auth/login" className="text-biso-600 font-bold hover:underline">
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-gray-500">Chargement...</div>}>
      <RegisterForm />
    </Suspense>
  )
}
