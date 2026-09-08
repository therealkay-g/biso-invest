'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Profile, WithdrawalAccount } from '@/types'
import Header from '@/components/Header'
import { User, Shield, LogOut, Phone, Plus, CreditCard, Info, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [withdrawalAccounts, setWithdrawalAccounts] = useState<WithdrawalAccount[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // New withdrawal account state
  const [network, setNetwork] = useState<'Airtel Money' | 'Orange Money' | 'M-Pesa'>('Airtel Money')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accSuccess, setAccSuccess] = useState('')

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/auth/login')
          return
        }

        const { data: pData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(pData)

        const { data: waData } = await supabase.from('withdrawal_accounts').select('*').eq('user_id', user.id)
        setWithdrawalAccounts(waData || [])

        // Vérification des droits administrateur
        try {
          const { data: isAdminRpc } = await supabase.rpc('is_admin')
          if (isAdminRpc) {
            setIsAdmin(true)
          } else {
            const { data: adminRow } = await supabase
              .from('admin_users')
              .select('role')
              .eq('id', user.id)
              .maybeSingle()
            if (adminRow) {
              setIsAdmin(true)
            }
          }
        } catch (e) {
          console.warn('Erreur vérification admin:', e)
        }
      } catch (err) {
        console.error('Error loading profile:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [router])

  const handleAddWithdrawalAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setAccSuccess('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      const { error } = await supabase.from('withdrawal_accounts').insert({
        user_id: user.id,
        network,
        phone_number: phoneNumber,
        account_name: accountName,
        is_default: withdrawalAccounts.length === 0
      })

      if (error) throw error

      setAccSuccess('Compte de retrait ajouté avec succès.')
      setPhoneNumber('')
      setAccountName('')

      const { data: waData } = await supabase.from('withdrawal_accounts').select('*').eq('user_id', user.id)
      setWithdrawalAccounts(waData || [])
    } catch (err: any) {
      console.error('Error adding account:', err)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
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
      <Header displayName={profile?.phone || 'Profil'} vipLevel={profile?.current_vip || 'VIP0'} showBack={true} />

      <div className="p-4 max-w-4xl mx-auto space-y-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-biso-100 text-biso-700 font-extrabold text-2xl flex items-center justify-center">
            {profile?.phone?.charAt(0) || 'U'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{profile?.phone}</h2>
            <p className="text-xs text-gray-500">Parrainage : <strong className="text-biso-700">{profile?.referral_code}</strong></p>
            <span className="inline-block mt-2 text-xs font-bold bg-biso-50 text-biso-700 px-3 py-0.5 rounded-full border border-biso-200">
              {profile?.current_vip}
            </span>
          </div>
        </div>

        {/* Withdrawal Accounts Management */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-4">
          <h3 className="font-bold text-gray-800 text-sm">Comptes de Retrait Mobile Money</h3>
          <div className="space-y-2">
            {withdrawalAccounts.map((acc) => (
              <div key={acc.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-xs font-bold text-gray-900">{acc.network} - {acc.phone_number}</p>
                  <p className="text-[10px] text-gray-500">{acc.account_name || 'Titulaire'}</p>
                </div>
                <span className="text-xs text-biso-600 font-semibold">Actif</span>
              </div>
            ))}
          </div>

          {accSuccess && <p className="text-xs text-emerald-600">{accSuccess}</p>}

          <form onSubmit={handleAddWithdrawalAccount} className="space-y-3 pt-4 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-700">Ajouter un nouveau compte</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value as any)}
                className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold"
              >
                <option value="Airtel Money">Airtel Money</option>
                <option value="Orange Money">Orange Money</option>
                <option value="M-Pesa">M-Pesa</option>
              </select>
              <input
                type="text"
                required
                placeholder="Numéro de téléphone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs"
              />
              <input
                type="text"
                placeholder="Nom du titulaire"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs"
              />
            </div>
            <button
              type="submit"
              className="bg-biso-600 hover:bg-biso-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs shadow-xs"
            >
              Ajouter le compte
            </button>
          </form>
        </div>

        {/* Espace Admin (affiché seulement si l'utilisateur a les droits) */}
        {isAdmin && (
          <div className="bg-gradient-to-r from-biso-900 to-biso-800 rounded-2xl p-5 text-white shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-biso-700/60 rounded-xl">
                  <Shield className="w-6 h-6 text-biso-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Espace Administrateur</h3>
                  <p className="text-xs text-biso-200">Gestion des utilisateurs, dépôts et retraits</p>
                </div>
              </div>
              <Link
                href="/admin"
                className="bg-white text-biso-900 hover:bg-gray-100 text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition-colors flex items-center space-x-1"
              >
                <span>Accéder</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Links */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden divide-y divide-gray-100">
          <Link href="/about" className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-3">
              <Info className="w-5 h-5 text-biso-600" />
              <span className="text-sm font-semibold text-gray-800">À propos de Biso Invest</span>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-4 hover:bg-red-50 transition-colors text-red-600"
          >
            <div className="flex items-center space-x-3">
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-semibold">Déconnexion</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
