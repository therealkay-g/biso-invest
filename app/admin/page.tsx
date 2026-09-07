'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Profile, Deposit, Withdrawal, Product, VipLevel, PaymentAccount, AdminLog } from '@/types'
import { Shield, Users, DollarSign, Package, CheckCircle2, XCircle, AlertCircle, Settings } from 'lucide-react'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [users, setUsers] = useState<Profile[]>([])
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [vipLevels, setVipLevels] = useState<VipLevel[]>([])
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([])
  const [logs, setLogs] = useState<AdminLog[]>([])
  const [loading, setLoading] = useState(true)

  // Rejection reason state
  const [rejectionReason, setRejectionReason] = useState('')
  const [targetDepositId, setTargetDepositId] = useState<string | null>(null)

  // Payment number edit state
  const [editNetwork, setEditNetwork] = useState('')
  const [newPhone, setNewPhone] = useState('')

  useEffect(() => {
    async function loadAdminData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          window.location.href = '/auth/login'
          return
        }

        // Fetch admin data
        const { data: uData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
        setUsers(uData || [])

        const { data: depData } = await supabase.from('deposits').select('*, profile:profiles(*)').order('created_at', { ascending: false })
        setDeposits(depData || [])

        const { data: witData } = await supabase.from('withdrawals').select('*, profile:profiles(*)').order('created_at', { ascending: false })
        setWithdrawals(witData || [])

        const { data: prodData } = await supabase.from('products').select('*').order('created_at')
        setProducts(prodData || [])

        const { data: vipData } = await supabase.from('vip_levels').select('*').order('display_order')
        setVipLevels(vipData || [])

        const { data: paData } = await supabase.from('payment_accounts').select('*')
        setPaymentAccounts(paData || [])

        const { data: logData } = await supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(20)
        setLogs(logData || [])

      } catch (err) {
        console.error('Error loading admin:', err)
      } finally {
        setLoading(false)
      }
    }

    loadAdminData()
  }, [])

  const handleValidateDeposit = async (deposit: Deposit) => {
    try {
      const { error: rpcError } = await supabase.rpc('approve_deposit', { p_deposit_id: deposit.id })
      if (rpcError) throw rpcError

      // Reload deposits
      const { data: depData } = await supabase.from('deposits').select('*, profile:profiles(*)').order('created_at', { ascending: false })
      setDeposits(depData || [])
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la validation')
    }
  }

  const handleRefuseDeposit = async (depositId: string) => {
    if (!rejectionReason) {
      alert('Veuillez saisir un motif de refus.')
      return
    }

    try {
      const { error: rpcError } = await supabase.rpc('reject_deposit', { p_deposit_id: depositId, p_reason: rejectionReason })
      if (rpcError) throw rpcError

      setTargetDepositId(null)
      setRejectionReason('')

      const { data: depData } = await supabase.from('deposits').select('*, profile:profiles(*)').order('created_at', { ascending: false })
      setDeposits(depData || [])
    } catch (err: any) {
      alert(err.message || 'Erreur lors du refus')
    }
  }

  const handleToggleVip = async (vipId: string, currentStatus: boolean) => {
    try {
      await supabase.from('vip_levels').update({ is_active: !currentStatus }).eq('id', vipId)
      const { data: vipData } = await supabase.from('vip_levels').select('*').order('display_order')
      setVipLevels(vipData || [])
    } catch (err) {
      console.error('Error toggling VIP:', err)
    }
  }

  const handleUpdatePaymentNumber = async (network: string, phone: string) => {
    try {
      await supabase.from('payment_accounts').update({ phone_number: phone, updated_at: new Date().toISOString() }).eq('network', network)
      const { data: paData } = await supabase.from('payment_accounts').select('*')
      setPaymentAccounts(paData || [])
      alert('Numéro Mobile Money mis à jour avec succès.')
    } catch (err) {
      console.error('Error updating payment account:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-biso-600"></div>
      </div>
    )
  }

  const pendingDeposits = deposits.filter(d => d.status === 'EN_ATTENTE')
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'EN_ATTENTE')

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-biso-900 text-white p-4 sticky top-0 z-40 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-2">
          <Shield className="w-6 h-6 text-biso-400" />
          <h1 className="font-extrabold text-base">PANNEAU ADMINISTRATION BISO INVEST</h1>
        </div>
        <a href="/dashboard" className="text-xs bg-biso-700 px-3 py-1.5 rounded-xl font-semibold hover:bg-biso-600">
          Retour au site
        </a>
      </div>

      <div className="p-4 max-w-7xl mx-auto space-y-6">
        {/* Admin Navigation */}
        <div className="flex space-x-2 overflow-x-auto bg-white p-2 rounded-2xl border border-gray-100 shadow-xs">
          {['dashboard', 'users', 'deposits', 'withdrawals', 'products', 'vip', 'payments', 'logs'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase whitespace-nowrap transition-all ${
                activeTab === tab ? 'bg-biso-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                <span className="text-xs text-gray-500">Total Utilisateurs</span>
                <p className="text-2xl font-extrabold text-gray-900 mt-1">{users.length}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                <span className="text-xs text-gray-500">Recharges en attente</span>
                <p className="text-2xl font-extrabold text-amber-600 mt-1">{pendingDeposits.length}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                <span className="text-xs text-gray-500">Retraits en attente</span>
                <p className="text-2xl font-extrabold text-amber-600 mt-1">{pendingWithdrawals.length}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                <span className="text-xs text-gray-500">Produits Actifs</span>
                <p className="text-2xl font-extrabold text-biso-600 mt-1">{products.length}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-4">
            <h3 className="font-bold text-gray-800 text-sm">Gestion des Utilisateurs ({users.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 uppercase">
                  <tr>
                    <th className="p-3">Téléphone</th>
                    <th className="p-3">Code Parrainage</th>
                    <th className="p-3">VIP</th>
                    <th className="p-3">Statut</th>
                    <th className="p-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="p-3 font-semibold text-gray-900">{u.phone}</td>
                      <td className="p-3 text-biso-700 font-bold">{u.referral_code}</td>
                      <td className="p-3 font-semibold">{u.current_vip}</td>
                      <td className="p-3">
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-semibold">{u.status}</span>
                      </td>
                      <td className="p-3 text-gray-500">{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'deposits' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-4">
            <h3 className="font-bold text-gray-800 text-sm">Gestion des Recharges ({deposits.length})</h3>
            <div className="space-y-3">
              {deposits.map((dep) => (
                <div key={dep.id} className="p-4 bg-gray-50 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-gray-900">{dep.profile?.phone || 'Utilisateur'} • {dep.amount.toLocaleString('fr-FR')} FC ({dep.network})</p>
                    <p className="text-[10px] text-gray-500">Ref: {dep.reference} • {new Date(dep.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      dep.status === 'VALIDEE' ? 'bg-emerald-50 text-emerald-700' : dep.status === 'REFUSEE' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {dep.status}
                    </span>
                    {dep.status === 'EN_ATTENTE' && (
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleValidateDeposit(dep)}
                          className="bg-biso-600 text-white p-2 rounded-lg text-xs font-semibold hover:bg-biso-700"
                        >
                          Valider
                        </button>
                        <button
                          onClick={() => setTargetDepositId(dep.id)}
                          className="bg-red-500 text-white p-2 rounded-lg text-xs font-semibold hover:bg-red-600"
                        >
                          Refuser
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {targetDepositId && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white p-6 rounded-2xl max-w-sm w-full space-y-4">
                  <h4 className="font-bold text-gray-900 text-sm">Motif du refus</h4>
                  <textarea
                    rows={3}
                    placeholder="Saisissez le motif obligatoire..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full p-3 bg-gray-50 border rounded-xl text-xs"
                  ></textarea>
                  <div className="flex space-x-2">
                    <button onClick={() => setTargetDepositId(null)} className="flex-1 bg-gray-100 py-2 rounded-xl text-xs">Annuler</button>
                    <button onClick={() => handleRefuseDeposit(targetDepositId)} className="flex-1 bg-red-500 text-white py-2 rounded-xl text-xs font-semibold">Confirmer Refus</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-4">
            <h3 className="font-bold text-gray-800 text-sm">Gestion des Retraits ({withdrawals.length})</h3>
            <div className="space-y-3">
              {withdrawals.map((wit) => (
                <div key={wit.id} className="p-4 bg-gray-50 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-gray-900">{wit.profile?.phone || 'Utilisateur'} • {wit.amount.toLocaleString('fr-FR')} FC ({wit.network})</p>
                    <p className="text-[10px] text-gray-500">Compte: {wit.phone_number} • {new Date(wit.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    wit.status === 'PAYE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {wit.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-4">
            <h3 className="font-bold text-gray-800 text-sm">Catalogue Produits ({products.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {products.map((p) => (
                <div key={p.id} className="p-4 bg-gray-50 rounded-xl space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs">{p.name}</h4>
                  <p className="text-xs text-biso-600 font-semibold">{p.price.toLocaleString('fr-FR')} FC</p>
                  <p className="text-[10px] text-gray-500">Versement: {p.monthly_return.toLocaleString('fr-FR')} FC / mois</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'vip' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-4">
            <h3 className="font-bold text-gray-800 text-sm">Gestion des Niveaux VIP (VIP0 - VIP7)</h3>
            <p className="text-xs text-gray-500">Les niveaux VIP5, VIP6 et VIP7 peuvent être activés ou désactivés ici.</p>
            <div className="space-y-3">
              {vipLevels.map((vip) => (
                <div key={vip.id} className="p-4 bg-gray-50 rounded-xl flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{vip.level_name}</h4>
                    <p className="text-xs text-gray-600">Min: {vip.min_investment.toLocaleString('fr-FR')} FC • Max packs: {vip.max_packs}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${vip.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                      {vip.is_active ? 'ACTIF' : 'DÉSACTIVÉ'}
                    </span>
                    <button
                      onClick={() => handleToggleVip(vip.id, vip.is_active)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white ${vip.is_active ? 'bg-red-500 hover:bg-red-600' : 'bg-biso-600 hover:bg-biso-700'}`}
                    >
                      {vip.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-4">
            <h3 className="font-bold text-gray-800 text-sm">Numéros Mobile Money Officiels</h3>
            <div className="space-y-4">
              {paymentAccounts.map((pa) => (
                <div key={pa.id} className="p-4 bg-gray-50 rounded-xl flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{pa.network}</h4>
                    <p className="text-xs text-biso-700 font-bold">{pa.phone_number}</p>
                    <p className="text-[10px] text-gray-500">{pa.account_name}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Nouveau numéro"
                      id={`phone-${pa.network}`}
                      className="p-2 border rounded-xl text-xs bg-white"
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById(`phone-${pa.network}`) as HTMLInputElement
                        if (input && input.value) {
                          handleUpdatePaymentNumber(pa.network, input.value)
                        }
                      }}
                      className="bg-biso-600 text-white px-3 py-2 rounded-xl text-xs font-semibold"
                    >
                      Modifier
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-4">
            <h3 className="font-bold text-gray-800 text-sm">Journal des Actions Admin (Audit Logs)</h3>
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="p-3 bg-gray-50 rounded-xl text-xs flex justify-between items-center">
                  <div>
                    <span className="font-bold text-biso-700">{log.action}</span>
                    <p className="text-gray-600">Objet : {log.target_object}</p>
                  </div>
                  <span className="text-[10px] text-gray-400">{new Date(log.created_at).toLocaleString('fr-FR')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
