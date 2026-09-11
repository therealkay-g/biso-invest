'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Profile, WithdrawalAccount, KycProfile, KycStatus } from '@/types'
import Header from '@/components/Header'
import { useToast } from '@/components/ToastProvider'
import {
  Shield, LogOut, Phone, Plus, ChevronRight, Wallet, TrendingUp,
  BadgeCheck, Users, Info, Crown, CircleDollarSign, Copy, X, FileCheck, Upload
} from 'lucide-react'
import Link from 'next/link'

export default function ProfilePage() {
  const router = useRouter()
  const toast = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [withdrawalAccounts, setWithdrawalAccounts] = useState<WithdrawalAccount[]>([])
  const [kycProfile, setKycProfile] = useState<KycProfile | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // New withdrawal account state
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [network, setNetwork] = useState<'Airtel Money' | 'Orange Money' | 'M-Pesa'>('Airtel Money')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [accountName, setAccountName] = useState('')

  // KYC upload state
  const [showKycForm, setShowKycForm] = useState(false)
  const [kycIdType, setKycIdType] = useState('PASSPORT')
  const [kycIdNumber, setKycIdNumber] = useState('')
  const [kycFile, setKycFile] = useState<File | null>(null)
  const [uploadingKyc, setUploadingKyc] = useState(false)

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

        const { data: kycData } = await supabase.from('kyc_profiles').select('*').eq('user_id', user.id).maybeSingle()
        setKycProfile(kycData)

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

      toast.success('Compte de retrait ajouté avec succès.')
      setPhoneNumber('')
      setAccountName('')
      setShowAddAccount(false)

      const { data: waData } = await supabase.from('withdrawal_accounts').select('*').eq('user_id', user.id)
      setWithdrawalAccounts(waData || [])
    } catch (err: any) {
      console.error('Error adding account:', err)
      toast.error(err?.message || 'Erreur lors de l\u2019ajout du compte')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const copyReferral = async () => {
    if (!profile?.referral_code) return
    try {
      await navigator.clipboard.writeText(profile.referral_code)
      toast.success('Code d\u2019invitation copié')
    } catch {
      toast.error('Impossible de copier')
    }
  }

  const handleKycUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!kycFile) {
      toast.error('Veuillez sélectionner un document')
      return
    }

    setUploadingKyc(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      const fileExt = kycFile.name.split('.').pop()
      const fileName = `kyc/${user.id}/${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('kyc-docs')
        .upload(fileName, kycFile)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('kyc-docs')
        .getPublicUrl(fileName)

      const { error: kycError } = await supabase.from('kyc_profiles').upsert({
        user_id: user.id,
        id_type: kycIdType,
        id_number: kycIdNumber,
        document_url: publicUrl,
        status: 'PENDING',
        updated_at: new Date().toISOString(),
      })

      if (kycError) throw kycError

      toast.success('Document d’identité soumis avec succès. En attente de validation.')
      setShowKycForm(false)

      const { data: kycData } = await supabase.from('kyc_profiles').select('*').eq('user_id', user.id).maybeSingle()
      setKycProfile(kycData)
    } catch (err: any) {
      console.error('Error uploading KYC:', err)
      toast.error(err?.message || 'Erreur lors de la soumission du KYC')
    } finally {
      setUploadingKyc(false)
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
    <div className="min-h-screen bg-gray-50 pb-28 page-enter">
      <Header displayName="Moi" vipLevel={profile?.current_vip || 'VIP0'} showBack={true} />

      <div className="p-4 max-w-4xl mx-auto space-y-5">
        {/* Carte profil premium */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 text-white rounded-3xl p-6 shadow-xl border border-emerald-500/30 animate-fade-in">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center space-x-4 relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-emerald-950 font-black text-2xl flex items-center justify-center shadow-lg border-2 border-amber-200/50">
              {profile?.phone?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black text-white truncate">{profile?.phone}</h2>
              <button
                onClick={copyReferral}
                className="mt-1.5 inline-flex items-center space-x-1.5 bg-white/10 border border-white/15 hover:bg-white/20 text-amber-100 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all min-h-[32px]"
              >
                <span>Code parrainage : {profile?.referral_code}</span>
                <Copy className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>
            <span className="shrink-0 bg-gradient-to-r from-amber-300 to-amber-500 text-emerald-950 font-black px-3 py-1.5 rounded-full text-[11px] shadow">
              {profile?.current_vip}
            </span>
          </div>
        </div>

        {/* Comptes de retrait */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Wallet className="w-5 h-5" aria-hidden="true" />
              </span>
              <h3 className="font-black text-gray-900 text-sm">Comptes Mobile Money</h3>
            </div>
            <button
              onClick={() => setShowAddAccount(!showAddAccount)}
              className="inline-flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all min-h-[36px]"
            >
              {showAddAccount ? <X className="w-3.5 h-3.5" aria-hidden="true" /> : <Plus className="w-3.5 h-3.5" aria-hidden="true" />}
              <span>{showAddAccount ? 'Annuler' : 'Ajouter'}</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {withdrawalAccounts.length === 0 && !showAddAccount && (
              <p className="text-xs text-gray-400 text-center py-4">
                Aucun compte de retrait. Ajoutez-en un pour recevoir vos retraits.
              </p>
            )}
            {withdrawalAccounts.map((acc) => (
              <div key={acc.id} className="flex justify-between items-center p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900">{acc.network}</p>
                    <p className="text-[10px] text-gray-500 truncate">{acc.phone_number}</p>
                  </div>
                </div>
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                  {acc.is_default ? 'Principal' : 'Actif'}
                </span>
              </div>
            ))}
          </div>

          {showAddAccount && (
            <form onSubmit={handleAddWithdrawalAccount} className="space-y-3 pt-3 border-t border-gray-100 animate-fade-in">
              <div className="grid grid-cols-1 gap-3">
                <select
                  value={network}
                  onChange={(e) => setNetwork(e.target.value as any)}
                  className="input-field"
                  aria-label="Réseau"
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
                  className="input-field"
                />
                <input
                  type="text"
                  placeholder="Nom du titulaire"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="input-field"
                />
              </div>
              <button
                type="submit"
                className="btn-primary w-full"
              >
                Ajouter le compte
              </button>
            </form>
          )}
        </div>

        {/* Vérification d'identité (KYC) */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <FileCheck className="w-5 h-5" aria-hidden="true" />
              </span>
              <h3 className="font-black text-gray-900 text-sm">Vérification d'identité</h3>
            </div>
            {!kycProfile && (
              <button
                onClick={() => setShowKycForm(true)}
                className="inline-flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all min-h-[36px]"
              >
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Vérifier</span>
              </button>
            )}
          </div>

          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-2 h-2 rounded-full ${
                kycProfile?.status === 'APPROVED' ? 'bg-emerald-500' :
                kycProfile?.status === 'REJECTED' ? 'bg-red-500' : 'bg-amber-500'
              }`} />
              <span className="text-xs font-bold text-gray-700">
                Statut : {kycProfile?.status === 'APPROVED' ? 'Vérifié' :
                           kycProfile?.status === 'REJECTED' ? 'Refusé' :
                           kycProfile ? 'En attente' : 'Non initié'}
              </span>
            </div>
            {kycProfile?.status === 'REJECTED' && (
              <button
                onClick={() => setShowKycForm(true)}
                className="text-xs font-bold text-red-600 hover:underline"
              >
                Réessayer
              </button>
            )}
          </div>

          {showKycForm && (
            <form onSubmit={handleKycUpload} className="space-y-3 pt-3 border-t border-gray-100 animate-fade-in">
              <div className="grid grid-cols-1 gap-3">
                <select
                  value={kycIdType}
                  onChange={(e) => setKycIdType(e.target.value)}
                  className="input-field"
                  aria-label="Type de document"
                >
                  <option value="PASSPORT">Passeport</option>
                  <option value="NATIONAL_ID">Carte Nationale d'Identité</option>
                  <option value="DRIVERS_LICENSE">Permis de conduire</option>
                </select>
                <input
                  type="text"
                  required
                  placeholder="Numéro du document"
                  value={kycIdNumber}
                  onChange={(e) => setKycIdNumber(e.target.value)}
                  className="input-field"
                />
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 ml-1">Photo du document</label>
                  <input
                    type="file"
                    required
                    accept="image/*,application/pdf"
                    onChange={(e) => setKycFile(e.target.files?.[0] || null)}
                    className="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={uploadingKyc}
                className="btn-primary w-full flex items-center justify-center space-x-2"
              >
                {uploadingKyc ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <span>Soumettre la vérification</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowKycForm(false)}
                className="w-full text-xs text-gray-400 font-bold py-2 hover:text-gray-600 transition-colors"
              >
                Annuler
              </button>
            </form>
          )}
        </div>

        {/* Espace Admin (affiché seulement si l'utilisateur a les droits) */}
        {isAdmin && (
          <div className="relative overflow-hidden bg-gradient-to-br from-amber-600 via-amber-500 to-amber-700 rounded-3xl p-5 text-emerald-950 shadow-xl border border-amber-400/40 animate-fade-in">
            <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-950/20 rounded-2xl">
                  <Shield className="w-6 h-6 text-white" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-black text-white text-sm">Espace Administrateur</h3>
                  <p className="text-[11px] text-white/80">Gestion des utilisateurs, dépôts et retraits</p>
                </div>
              </div>
              <Link
                href="/admin"
                className="bg-white text-amber-700 hover:bg-amber-50 text-xs font-black px-4 py-2.5 rounded-2xl shadow-md transition-colors inline-flex items-center space-x-1 shrink-0"
              >
                <span>Accéder</span>
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}

        {/* Menus */}
        <div className="card overflow-hidden divide-y divide-gray-100">
          <Link href="/wallet" className="menu-row">
            <span className="menu-icon bg-emerald-100 text-emerald-700">
              <CircleDollarSign className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-gray-900">Mon portefeuille</span>
              <span className="block text-[11px] text-gray-400">Solde, déposer, retirer</span>
            </span>
            <ChevronRight className="w-4 h-4 text-gray-300" aria-hidden="true" />
          </Link>
          <Link href="/investments" className="menu-row">
            <span className="menu-icon bg-emerald-100 text-emerald-700">
              <TrendingUp className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-gray-900">Mes investissements</span>
              <span className="block text-[11px] text-gray-400">Engagements actifs et historique</span>
            </span>
            <ChevronRight className="w-4 h-4 text-gray-300" aria-hidden="true" />
          </Link>
          <Link href="/vip" className="menu-row">
            <span className="menu-icon bg-amber-100 text-amber-700">
              <Crown className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-gray-900">Mon statut VIP</span>
              <span className="block text-[11px] text-gray-400">Avantages et prochains paliers</span>
            </span>
            <BadgeCheck className="w-4 h-4 text-amber-500" aria-hidden="true" />
            <ChevronRight className="w-4 h-4 text-gray-300" aria-hidden="true" />
          </Link>
          <Link href="/task" className="menu-row">
            <span className="menu-icon bg-emerald-100 text-emerald-700">
              <Users className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-gray-900">Mes tâches</span>
              <span className="block text-[11px] text-gray-400">Invitez et gagnez des récompenses</span>
            </span>
            <ChevronRight className="w-4 h-4 text-gray-300" aria-hidden="true" />
          </Link>
          <Link href="/about" className="menu-row">
            <span className="menu-icon bg-emerald-100 text-emerald-700">
              <Info className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-gray-900">À propos de BISO INVEST</span>
              <span className="block text-[11px] text-gray-400">Notre mission, nos engagements</span>
            </span>
            <ChevronRight className="w-4 h-4 text-gray-300" aria-hidden="true" />
          </Link>
        </div>

        {/* Déconnexion */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-2 bg-red-50 hover:bg-red-100 text-red-600 font-black py-4 px-4 rounded-2xl border border-red-200 transition-colors min-h-[52px]"
        >
          <LogOut className="w-5 h-5" aria-hidden="true" />
          <span className="text-sm">Se déconnecter</span>
        </button>
      </div>
    </div>
  )
}