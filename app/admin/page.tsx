'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Profile, Deposit, Withdrawal, Product, VipLevel, PaymentAccount, AdminLog, AdminTaskOverviewRow } from '@/types'
import { useToast } from '@/components/ToastProvider'
import { Shield, Users, DollarSign, Package, CheckCircle2, XCircle, AlertCircle, Settings, Download, ChevronLeft, ChevronRight, History } from 'lucide-react'

export default function AdminPage() {
  const router = useRouter()
  const toast = useToast()
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [users, setUsers] = useState<Profile[]>([])
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [vipLevels, setVipLevels] = useState<VipLevel[]>([])
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([])
  const [paymentAccountHistory, setPaymentAccountHistory] = useState<any[]>([])
  const [logs, setLogs] = useState<AdminLog[]>([])
  const [taskOverview, setTaskOverview] = useState<AdminTaskOverviewRow[]>([])
  const [loading, setLoading] = useState(true)

  // Pagination states (10 items / page)
  const PAGE_SIZE = 10
  const [pageUsers, setPageUsers] = useState(1)
  const [pageDeposits, setPageDeposits] = useState(1)
  const [pageWithdrawals, setPageWithdrawals] = useState(1)

  // Rejection reason state
  const [rejectionReason, setRejectionReason] = useState('')
  const [targetDepositId, setTargetDepositId] = useState<string | null>(null)

  // Withdrawal management state
  const [targetWithdrawalId, setTargetWithdrawalId] = useState<string | null>(null)
  const [withdrawalAction, setWithdrawalAction] = useState<'approve' | 'reject' | null>(null)
  const [withdrawalPaymentRef, setWithdrawalPaymentRef] = useState('')
  const [withdrawalRejectReason, setWithdrawalRejectReason] = useState('')

  // Payment number edit state
  const [editNetwork, setEditNetwork] = useState('')
  const [newPhone, setNewPhone] = useState('')

  useEffect(() => {
    async function loadAdminData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/auth/login')
          return
        }

        // Vérification des droits administrateur
        let authorized = false
        try {
          const { data: isAdminRpc } = await supabase.rpc('is_admin')
          if (isAdminRpc) {
            authorized = true
          } else {
            const { data: adminRow } = await supabase
              .from('admin_users')
              .select('role')
              .eq('id', user.id)
              .maybeSingle()
            if (adminRow) {
              authorized = true
            }
          }
        } catch (e) {
          console.warn('Erreur vérification admin:', e)
        }

        if (!authorized) {
          toast.error('Accès refusé : cet espace est réservé aux administrateurs.')
          router.push('/dashboard')
          return
        }

        setIsAdmin(true)

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

        const { data: pahData } = await supabase.from('payment_account_history').select('*').order('created_at', { ascending: false }).limit(20)
        setPaymentAccountHistory(pahData || [])

        const { data: logData } = await supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(20)
        setLogs(logData || [])

        const { data: taskData } = await supabase.rpc('admin_referral_task_overview')
        if (taskData) setTaskOverview(taskData as AdminTaskOverviewRow[])

      } catch (err) {
        console.error('Error loading admin:', err)
      } finally {
        setLoading(false)
      }
    }

    loadAdminData()
  }, [router, toast])

  const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    ].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportCsv = (type: 'users' | 'deposits' | 'withdrawals' | 'tasks') => {
    if (type === 'tasks') {
      const headers = ['Utilisateur', 'Code_Parrainage', 'Mon_Equipe', 'Filleuls_Valides', 'Recompenses_FC', 'Historique']
      const rows = taskOverview.map(row => [
        row.phone,
        row.referral_code,
        row.total_team,
        row.valid_invites,
        row.total_rewards,
        row.history.map(h => `${h.required_invites} inv. +${h.reward_amount} FC`).join(' | ')
      ])
      downloadCsv('biso_taches_invitation_export.csv', headers, rows)
      toast.success('Export CSV des tâches d\u2019invitation téléchargé.')
    } else if (type === 'deposits') {
      const headers = ['ID', 'Utilisateur', 'Montant_FC', 'Reseau', 'Reference', 'Statut', 'Date']
      const rows = deposits.map(d => [
        d.id,
        (d as any).profile?.phone || d.user_id,
        d.amount,
        d.network,
        d.reference,
        d.status,
        new Date(d.created_at).toLocaleString('fr-FR')
      ])
      downloadCsv('biso_depots_export.csv', headers, rows)
      toast.success('Export CSV des dépôts téléchargé.')
    } else if (type === 'withdrawals') {
      const headers = ['ID', 'Utilisateur', 'Montant_Brut_FC', 'Frais_15_FC', 'Net_Verse_FC', 'Reseau', 'Numero', 'Reference_MM', 'Statut', 'Date']
      const rows = withdrawals.map(w => {
        const fee = w.fee ?? Math.round(w.amount * 0.15)
        const net = w.net_amount ?? (w.amount - fee)
        return [
          w.id,
          (w as any).profile?.phone || w.user_id,
          w.amount,
          fee,
          net,
          w.network,
          w.phone_number,
          w.payment_reference || '',
          w.status,
          new Date(w.created_at).toLocaleString('fr-FR')
        ]
      })
      downloadCsv('biso_retraits_export.csv', headers, rows)
      toast.success('Export CSV des retraits téléchargé.')
    } else if (type === 'users') {
      const headers = ['ID', 'Telephone', 'Nom', 'VIP', 'Code_Parrain', 'Date_Inscription']
      const rows = users.map(u => [
        u.id,
        u.phone,
        u.display_name || '',
        u.current_vip,
        u.referral_code,
        new Date(u.created_at).toLocaleString('fr-FR')
      ])
      downloadCsv('biso_utilisateurs_export.csv', headers, rows)
      toast.success('Export CSV des utilisateurs téléchargé.')
    }
  }

  const handleValidateDeposit = async (deposit: Deposit) => {
    try {
      const { error: rpcError } = await supabase.rpc('approve_deposit', { p_deposit_id: deposit.id })
      if (rpcError) throw rpcError

      toast.success(`Dépôt de ${deposit.amount.toLocaleString('fr-FR')} FC validé avec succès !`)

      // Reload deposits
      const { data: depData } = await supabase.from('deposits').select('*, profile:profiles(*)').order('created_at', { ascending: false })
      setDeposits(depData || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la validation')
    }
  }

  const handleRefuseDeposit = async (depositId: string) => {
    if (!rejectionReason) {
      toast.error('Veuillez saisir un motif de refus.')
      return
    }

    try {
      const { error: rpcError } = await supabase.rpc('reject_deposit', { p_deposit_id: depositId, p_reason: rejectionReason })
      if (rpcError) throw rpcError

      toast.info('Demande de recharge rejetée avec motif notifié.')
      setTargetDepositId(null)
      setRejectionReason('')

      const { data: depData } = await supabase.from('deposits').select('*, profile:profiles(*)').order('created_at', { ascending: false })
      setDeposits(depData || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du refus')
    }
  }

  const handleApproveWithdrawal = async (withdrawalId: string) => {
    if (!withdrawalPaymentRef.trim()) {
      toast.error('Veuillez saisir la référence de paiement Mobile Money réelle.')
      return
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('approve_withdrawal', {
        p_withdrawal_id: withdrawalId,
        p_payment_reference: withdrawalPaymentRef.trim()
      })
      if (rpcError) throw rpcError

      const result = data as { success: boolean; net_amount: number }
      toast.success(`Retrait validé ! Montant net versé : ${result?.net_amount?.toLocaleString('fr-FR') || '—'} FC`)
      setTargetWithdrawalId(null)
      setWithdrawalAction(null)
      setWithdrawalPaymentRef('')

      const { data: witData } = await supabase.from('withdrawals').select('*, profile:profiles(*)').order('created_at', { ascending: false })
      setWithdrawals(witData || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la validation du retrait')
    }
  }

  const handleRejectWithdrawal = async (withdrawalId: string) => {
    if (!withdrawalRejectReason.trim()) {
      toast.error('Veuillez saisir un motif de refus obligatoire.')
      return
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('reject_withdrawal', {
        p_withdrawal_id: withdrawalId,
        p_reason: withdrawalRejectReason.trim()
      })
      if (rpcError) throw rpcError

      const result = data as { success: boolean; refunded_amount: number }
      toast.info(`Retrait refusé. ${result?.refunded_amount?.toLocaleString('fr-FR') || '—'} FC remboursés sur le wallet de l'utilisateur.`)
      setTargetWithdrawalId(null)
      setWithdrawalAction(null)
      setWithdrawalRejectReason('')

      const { data: witData } = await supabase.from('withdrawals').select('*, profile:profiles(*)').order('created_at', { ascending: false })
      setWithdrawals(witData || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du refus du retrait')
    }
  }

  const handleToggleVip = async (vipId: string, currentStatus: boolean) => {
    try {
      await supabase.from('vip_levels').update({ is_active: !currentStatus }).eq('id', vipId)
      const { data: vipData } = await supabase.from('vip_levels').select('*').order('display_order')
      setVipLevels(vipData || [])
      toast.success('Statut du palier VIP actualisé.')
    } catch (err) {
      console.error('Error toggling VIP:', err)
    }
  }

  const handleUpdatePaymentNumber = async (network: string, phone: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('payment_accounts').update({
        phone_number: phone,
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null
      }).eq('network', network)

      const { data: paData } = await supabase.from('payment_accounts').select('*')
      setPaymentAccounts(paData || [])

      const { data: pahData } = await supabase.from('payment_account_history').select('*').order('created_at', { ascending: false }).limit(20)
      setPaymentAccountHistory(pahData || [])

      toast.success('Numéro Mobile Money mis à jour et archivé dans l\'historique.')
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

  if (!isAdmin) {
    return null
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
          {['dashboard', 'users', 'deposits', 'withdrawals', 'products', 'vip', 'tasks', 'payments', 'logs'].map((tab) => (
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h3 className="font-bold text-gray-800 text-sm">Gestion des Utilisateurs ({users.length})</h3>
              <button
                onClick={() => exportCsv('users')}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center space-x-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter CSV</span>
              </button>
            </div>
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
                  {users.slice((pageUsers - 1) * PAGE_SIZE, pageUsers * PAGE_SIZE).map((u) => (
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

            {/* Pagination Controls */}
            {users.length > PAGE_SIZE && (
              <div className="flex justify-between items-center pt-3 border-t border-gray-100 text-xs text-gray-500">
                <span>Page {pageUsers} sur {Math.ceil(users.length / PAGE_SIZE)} ({users.length} utilisateurs)</span>
                <div className="flex space-x-1">
                  <button
                    onClick={() => setPageUsers(p => Math.max(1, p - 1))}
                    disabled={pageUsers === 1}
                    className="p-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPageUsers(p => Math.min(Math.ceil(users.length / PAGE_SIZE), p + 1))}
                    disabled={pageUsers >= Math.ceil(users.length / PAGE_SIZE)}
                    className="p-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'deposits' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h3 className="font-bold text-gray-800 text-sm">Gestion des Recharges ({deposits.length})</h3>
              <button
                onClick={() => exportCsv('deposits')}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center space-x-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter CSV</span>
              </button>
            </div>
            <div className="space-y-3">
              {deposits.slice((pageDeposits - 1) * PAGE_SIZE, pageDeposits * PAGE_SIZE).map((dep) => (
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
              {deposits.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">Aucune recharge trouvée.</p>
              )}
            </div>

            {/* Pagination Controls */}
            {deposits.length > PAGE_SIZE && (
              <div className="flex justify-between items-center pt-3 border-t border-gray-100 text-xs text-gray-500">
                <span>Page {pageDeposits} sur {Math.ceil(deposits.length / PAGE_SIZE)} ({deposits.length} dépôts)</span>
                <div className="flex space-x-1">
                  <button
                    onClick={() => setPageDeposits(p => Math.max(1, p - 1))}
                    disabled={pageDeposits === 1}
                    className="p-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPageDeposits(p => Math.min(Math.ceil(deposits.length / PAGE_SIZE), p + 1))}
                    disabled={pageDeposits >= Math.ceil(deposits.length / PAGE_SIZE)}
                    className="p-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-gray-800 text-sm">Gestion des Retraits ({withdrawals.length})</h3>
                <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2.5 py-1 rounded-full">
                  {pendingWithdrawals.length} en attente
                </span>
              </div>
              <button
                onClick={() => exportCsv('withdrawals')}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center space-x-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter CSV</span>
              </button>
            </div>
            <div className="space-y-4">
              {withdrawals.slice((pageWithdrawals - 1) * PAGE_SIZE, pageWithdrawals * PAGE_SIZE).map((wit) => {
                const fee = wit.fee ?? Math.round(wit.amount * 0.15 * 100) / 100
                const netAmount = wit.net_amount ?? (wit.amount - fee)
                const isPending = wit.status === 'EN_ATTENTE' || wit.status === 'EN_TRAITEMENT'
                return (
                  <div key={wit.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-black text-gray-900">
                          {(wit as any).profile?.phone || 'Utilisateur'} • {wit.network}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          Compte : {wit.phone_number} • {new Date(wit.created_at).toLocaleString('fr-FR')}
                        </p>
                        {wit.payment_reference && (
                          <p className="text-[10px] text-biso-700 font-mono mt-0.5">Réf : {wit.payment_reference}</p>
                        )}
                      </div>
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                        wit.status === 'PAYE' ? 'bg-emerald-50 text-emerald-700' :
                        wit.status === 'REFUSE' ? 'bg-red-50 text-red-700' :
                        'bg-amber-50 text-amber-700'
                      }`}>
                        {wit.status}
                      </span>
                    </div>

                    {/* Montants brut / frais / net */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white rounded-xl p-2 border border-gray-100">
                        <p className="text-[9px] text-gray-400 uppercase tracking-wider">Brut</p>
                        <p className="text-xs font-black text-gray-900 tabular-nums">{wit.amount.toLocaleString('fr-FR')} FC</p>
                      </div>
                      <div className="bg-white rounded-xl p-2 border border-gray-100">
                        <p className="text-[9px] text-rose-400 uppercase tracking-wider">Frais 15%</p>
                        <p className="text-xs font-black text-rose-600 tabular-nums">{fee.toLocaleString('fr-FR')} FC</p>
                      </div>
                      <div className="bg-biso-50 rounded-xl p-2 border border-biso-100">
                        <p className="text-[9px] text-biso-600 uppercase tracking-wider">Net versé</p>
                        <p className="text-xs font-black text-biso-800 tabular-nums">{netAmount.toLocaleString('fr-FR')} FC</p>
                      </div>
                    </div>

                    {/* Boutons d'action (seulement si en attente) */}
                    {isPending && targetWithdrawalId !== wit.id && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => { setTargetWithdrawalId(wit.id); setWithdrawalAction('approve'); setWithdrawalPaymentRef(''); }}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-xl transition-colors"
                        >
                          ✓ Valider le paiement
                        </button>
                        <button
                          onClick={() => { setTargetWithdrawalId(wit.id); setWithdrawalAction('reject'); setWithdrawalRejectReason(''); }}
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2 rounded-xl transition-colors"
                        >
                          ✕ Refuser
                        </button>
                      </div>
                    )}

                    {/* Modale inline : Valider avec référence */}
                    {targetWithdrawalId === wit.id && withdrawalAction === 'approve' && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                        <p className="text-xs font-bold text-emerald-800">Référence Mobile Money du paiement effectué :</p>
                        <input
                          type="text"
                          placeholder="Ex: PP260315.1432.B78921"
                          value={withdrawalPaymentRef}
                          onChange={(e) => setWithdrawalPaymentRef(e.target.value)}
                          className="w-full p-2.5 border border-emerald-200 rounded-xl text-xs font-mono bg-white focus:outline-none focus:border-emerald-500"
                        />
                        <div className="flex space-x-2">
                          <button onClick={() => { setTargetWithdrawalId(null); setWithdrawalAction(null); }} className="flex-1 bg-gray-100 py-2 rounded-xl text-xs font-semibold">
                            Annuler
                          </button>
                          <button onClick={() => handleApproveWithdrawal(wit.id)} className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-xs font-black">
                            Confirmer le paiement
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Modale inline : Refuser avec motif */}
                    {targetWithdrawalId === wit.id && withdrawalAction === 'reject' && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                        <p className="text-xs font-bold text-red-800">Motif de refus (obligatoire — sera conservé dans le journal) :</p>
                        <textarea
                          rows={2}
                          placeholder="Ex: Numéro invalide, fraude suspectée..."
                          value={withdrawalRejectReason}
                          onChange={(e) => setWithdrawalRejectReason(e.target.value)}
                          className="w-full p-2.5 border border-red-200 rounded-xl text-xs bg-white focus:outline-none focus:border-red-500 resize-none"
                        />
                        <p className="text-[10px] text-red-600">Le montant brut ({wit.amount.toLocaleString('fr-FR')} FC) sera automatiquement remboursé sur le wallet.</p>
                        <div className="flex space-x-2">
                          <button onClick={() => { setTargetWithdrawalId(null); setWithdrawalAction(null); }} className="flex-1 bg-gray-100 py-2 rounded-xl text-xs font-semibold">
                            Annuler
                          </button>
                          <button onClick={() => handleRejectWithdrawal(wit.id)} className="flex-1 bg-red-500 text-white py-2 rounded-xl text-xs font-black">
                            Confirmer le refus
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {withdrawals.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">Aucune demande de retrait.</p>
              )}
            </div>

            {/* Pagination Controls */}
            {withdrawals.length > PAGE_SIZE && (
              <div className="flex justify-between items-center pt-3 border-t border-gray-100 text-xs text-gray-500">
                <span>Page {pageWithdrawals} sur {Math.ceil(withdrawals.length / PAGE_SIZE)} ({withdrawals.length} retraits)</span>
                <div className="flex space-x-1">
                  <button
                    onClick={() => setPageWithdrawals(p => Math.max(1, p - 1))}
                    disabled={pageWithdrawals === 1}
                    className="p-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPageWithdrawals(p => Math.min(Math.ceil(withdrawals.length / PAGE_SIZE), p + 1))}
                    disabled={pageWithdrawals >= Math.ceil(withdrawals.length / PAGE_SIZE)}
                    className="p-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="font-bold text-gray-800 text-sm">Tâches d&apos;invitation</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Invitations valides (filleul + investissement validé), récompenses réclamées et disponibles.
                </p>
              </div>
              <button
                onClick={() => exportCsv('tasks')}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center space-x-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                    <th className="py-2.5 pr-3">Utilisateur</th>
                    <th className="py-2.5 pr-3">Code de parrainage</th>
                    <th className="py-2.5 pr-3">Mon équipe</th>
                    <th className="py-2.5 pr-3">Filleuls valides</th>
                    <th className="py-2.5 pr-3">Récompenses réclamées (FC)</th>
                    <th className="py-2.5 pr-3">Récompenses disponibles</th>
                    <th className="py-2.5">Historique</th>
                  </tr>
                </thead>
                <tbody>
                  {taskOverview.map((row) => {
                    const claimed = new Set(row.history.map((h) => h.required_invites))
                    const available = [1, 5, 10, 20, 50, 100]
                      .filter((t) => row.valid_invites >= t && !claimed.has(t))
                    return (
                      <tr key={row.user_id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2.5 pr-3 font-semibold text-gray-800">{row.phone}</td>
                        <td className="py-2.5 pr-3 font-mono text-biso-700">{row.referral_code}</td>
                        <td className="py-2.5 pr-3 tabular-nums">{row.total_team}</td>
                        <td className="py-2.5 pr-3 tabular-nums text-emerald-600 font-bold">{row.valid_invites}</td>
                        <td className="py-2.5 pr-3 tabular-nums font-bold">{row.total_rewards.toLocaleString('fr-FR')}</td>
                        <td className="py-2.5 pr-3">
                          {available.length > 0 ? (
                            <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                              {available.map((t) => `${t} inv.`).join(', ')}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          {row.history.length === 0 ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <div className="space-y-1">
                              {row.history.map((h, i) => (
                                <div key={i} className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md font-semibold">
                                  {h.required_invites} inv. • +{h.reward_amount.toLocaleString('fr-FR')} FC • {new Date(h.claimed_at).toLocaleDateString('fr-FR')}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {taskOverview.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-gray-400 text-xs">
                        Aucune donnée de tâche d&apos;invitation.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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

            {/* Historique des Changements de Numéros */}
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-biso-600" />
                <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Historique d'Audit des Numéros (payment_account_history)</h4>
              </div>
              {paymentAccountHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase">
                      <tr>
                        <th className="p-2.5">Opérateur</th>
                        <th className="p-2.5">Ancien Numéro</th>
                        <th className="p-2.5">Nouveau Numéro</th>
                        <th className="p-2.5">Date Modification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono">
                      {paymentAccountHistory.map((h: any) => (
                        <tr key={h.id}>
                          <td className="p-2.5 font-bold text-gray-900 font-sans">{h.network}</td>
                          <td className="p-2.5 text-red-600 line-through">{h.old_number}</td>
                          <td className="p-2.5 text-emerald-700 font-bold">{h.new_number}</td>
                          <td className="p-2.5 text-gray-500 font-sans">{new Date(h.created_at).toLocaleString('fr-FR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-gray-400">Aucune modification historique enregistrée.</p>
              )}
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
