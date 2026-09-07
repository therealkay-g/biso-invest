'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Wallet, WalletTransaction, PaymentAccount, WithdrawalAccount, Deposit, Withdrawal } from '@/types'
import Header from '@/components/Header'
import { Wallet as WalletIcon, Plus, ArrowUpRight, History, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react'

export default function WalletPage() {
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'overview'
  const [activeTab, setActiveTab] = useState(defaultTab)

  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([])
  const [withdrawalAccounts, setWithdrawalAccounts] = useState<WithdrawalAccount[]>([])
  const [loading, setLoading] = useState(true)

  // Deposit form state
  const [depositNetwork, setDepositNetwork] = useState<'Airtel Money' | 'Orange Money' | 'M-Pesa'>('Airtel Money')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositRef, setDepositRef] = useState('')
  const [depositSuccess, setDepositSuccess] = useState('')
  const [depositError, setDepositError] = useState('')

  // Withdrawal form state
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [selectedWithdrawAccount, setSelectedWithdrawAccount] = useState('')
  const [withdrawSuccess, setWithdrawSuccess] = useState('')
  const [withdrawError, setWithdrawError] = useState('')

  useEffect(() => {
    async function loadWalletData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          window.location.href = '/auth/login'
          return
        }

        const { data: wData } = await supabase.from('wallets').select('*').eq('user_id', user.id).single()
        setWallet(wData)

        const { data: txData } = await supabase.from('wallet_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
        setTransactions(txData || [])

        const { data: paData } = await supabase.from('payment_accounts').select('*').eq('is_active', true)
        setPaymentAccounts(paData || [])

        const { data: waData } = await supabase.from('withdrawal_accounts').select('*').eq('user_id', user.id)
        setWithdrawalAccounts(waData || [])
        if (waData && waData.length > 0) {
          setSelectedWithdrawAccount(waData[0].id)
        }

      } catch (err) {
        console.error('Error loading wallet:', err)
      } finally {
        setLoading(false)
      }
    }

    loadWalletData()
  }, [])

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    setDepositError('')
    setDepositSuccess('')

    const amountNum = parseFloat(depositAmount)
    if (!amountNum || amountNum <= 0) {
      setDepositError('Veuillez saisir un montant valide.')
      return
    }
    if (!depositRef) {
      setDepositError('Veuillez saisir la référence de transaction Mobile Money.')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      const { error } = await supabase.from('deposits').insert({
        user_id: user.id,
        amount: amountNum,
        network: depositNetwork,
        reference: depositRef,
        status: 'EN_ATTENTE'
      })

      if (error) throw error

      setDepositSuccess('Demande de recharge soumise avec succès. En attente de validation admin.')
      setDepositAmount('')
      setDepositRef('')
    } catch (err: any) {
      setDepositError(err.message || 'Erreur lors de la soumission.')
    }
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    setWithdrawError('')
    setWithdrawSuccess('')

    const amountNum = parseFloat(withdrawAmount)
    if (!amountNum || amountNum < 5000) {
      setWithdrawError('Le montant minimum de retrait est de 5 000 FC.')
      return
    }
    if (wallet && wallet.balance < amountNum) {
      setWithdrawError('Solde insuffisant dans votre wallet.')
      return
    }
    if (!selectedWithdrawAccount) {
      setWithdrawError('Veuillez sélectionner un compte de retrait Mobile Money.')
      return
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('create_withdrawal', {
        p_withdrawal_account_id: selectedWithdrawAccount,
        p_amount: amountNum
      })

      if (rpcError) throw rpcError

      setWithdrawSuccess('Demande de retrait enregistrée avec succès.')
      setWithdrawAmount('')

      // Reload wallet
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: wData } = await supabase.from('wallets').select('*').eq('user_id', user.id).single()
        setWallet(wData)
      }
    } catch (err: any) {
      setWithdrawError(err.message || 'Erreur lors de la demande de retrait.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-biso-600"></div>
      </div>
    )
  }

  const activePaymentAccount = paymentAccounts.find(p => p.network === depositNetwork)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header displayName="Portefeuille & Finances" vipLevel="Wallet Ledger" />

      <div className="p-4 max-w-4xl mx-auto space-y-6">
        {/* Tabs */}
        <div className="flex space-x-2 bg-white p-1 rounded-2xl border border-gray-100 shadow-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'overview' ? 'bg-biso-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Aperçu
          </button>
          <button
            onClick={() => setActiveTab('deposit')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'deposit' ? 'bg-biso-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Recharger
          </button>
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'withdraw' ? 'bg-biso-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Retirer
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'history' ? 'bg-biso-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Historique
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-biso-800 to-biso-950 text-white p-6 rounded-2xl shadow-xl">
              <p className="text-xs uppercase text-biso-300 font-semibold mb-1">Solde Actuel Wallet</p>
              <h2 className="text-3xl font-extrabold mb-4">
                {(wallet?.balance || 0).toLocaleString('fr-FR')} <span className="text-lg font-normal text-biso-300">FC</span>
              </h2>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-biso-700/60 text-xs">
                <div>
                  <span className="text-biso-300">Total Rechargé</span>
                  <p className="text-sm font-bold">{(wallet?.total_deposited || 0).toLocaleString('fr-FR')} FC</p>
                </div>
                <div>
                  <span className="text-biso-300">Total Retiré</span>
                  <p className="text-sm font-bold">{(wallet?.total_withdrawn || 0).toLocaleString('fr-FR')} FC</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs space-y-4">
              <h3 className="font-bold text-gray-800 text-sm">Dernières Transactions</h3>
              <div className="space-y-3">
                {transactions.slice(0, 5).map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-none">
                    <div>
                      <p className="text-xs font-bold text-gray-900">{tx.description}</p>
                      <p className="text-[10px] text-gray-500">{new Date(tx.created_at).toLocaleString('fr-FR')}</p>
                    </div>
                    <span className={`text-xs font-bold ${tx.amount > 0 ? 'text-emerald-600' : 'text-gray-800'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('fr-FR')} FC
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'deposit' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-6">
            <div>
              <h3 className="text-lg font-extrabold text-gray-900">Recharger votre Wallet</h3>
              <p className="text-xs text-gray-500">Effectuez un paiement Mobile Money puis soumettez la référence.</p>
            </div>

            {depositError && (
              <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{depositError}</span>
              </div>
            )}

            {depositSuccess && (
              <div className="bg-emerald-50 text-emerald-600 text-xs p-3 rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{depositSuccess}</span>
              </div>
            )}

            <form onSubmit={handleDeposit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Réseau Mobile Money</label>
                <select
                  value={depositNetwork}
                  onChange={(e) => setDepositNetwork(e.target.value as any)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold"
                >
                  <option value="Airtel Money">Airtel Money</option>
                  <option value="Orange Money">Orange Money</option>
                  <option value="M-Pesa">M-Pesa</option>
                </select>
              </div>

              {activePaymentAccount && (
                <div className="bg-biso-50 border border-biso-200 p-4 rounded-xl space-y-1">
                  <p className="text-xs text-biso-700 font-semibold">Numéro Mobile Money officiel ({activePaymentAccount.network}) :</p>
                  <p className="text-base font-extrabold text-biso-900">{activePaymentAccount.phone_number}</p>
                  <p className="text-[11px] text-gray-600">Titulaire : {activePaymentAccount.account_name}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Montant (FC)</label>
                <input
                  type="number"
                  required
                  min="1000"
                  placeholder="Ex: 50000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Référence de transaction Mobile Money</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: PP230412.1234.A12345"
                  value={depositRef}
                  onChange={(e) => setDepositRef(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-biso-600 hover:bg-biso-700 text-white font-semibold py-3 rounded-xl text-sm shadow-md"
              >
                VALIDER LA DEMANDE DE RECHARGE
              </button>
            </form>
          </div>
        )}

        {activeTab === 'withdraw' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-6">
            <div>
              <h3 className="text-lg font-extrabold text-gray-900">Effectuer un Retrait</h3>
              <p className="text-xs text-gray-500">Minimum 5 000 FC • Frais : 0% • Délai cible : maximum 1 heure.</p>
            </div>

            {withdrawError && (
              <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{withdrawError}</span>
              </div>
            )}

            {withdrawSuccess && (
              <div className="bg-emerald-50 text-emerald-600 text-xs p-3 rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{withdrawSuccess}</span>
              </div>
            )}

            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Compte de retrait</label>
                <select
                  value={selectedWithdrawAccount}
                  onChange={(e) => setSelectedWithdrawAccount(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold"
                >
                  {withdrawalAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.network} - {acc.phone_number}
                    </option>
                  ))}
                </select>
                {withdrawalAccounts.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">Veuillez d'abord ajouter un compte de retrait dans votre profil.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Montant à retirer (FC)</label>
                <input
                  type="number"
                  required
                  min="5000"
                  placeholder="Min 5 000 FC"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Frais de retrait :</span>
                  <span className="font-bold text-gray-900">0 FC (0%)</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <span className="text-gray-700 font-semibold">Montant net reçu :</span>
                  <span className="font-extrabold text-biso-600">{withdrawAmount ? parseFloat(withdrawAmount).toLocaleString('fr-FR') : 0} FC</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={withdrawalAccounts.length === 0}
                className="w-full bg-biso-600 hover:bg-biso-700 text-white font-semibold py-3 rounded-xl text-sm shadow-md"
              >
                CONFIRMER LE RETRAIT
              </button>
            </form>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-4">
            <h3 className="font-bold text-gray-800 text-sm">Historique Financier Complet</h3>
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <div>
                    <span className="text-xs font-bold bg-biso-100 text-biso-800 px-2 py-0.5 rounded-md">{tx.type}</span>
                    <p className="text-xs font-bold text-gray-900 mt-1">{tx.description}</p>
                    <p className="text-[10px] text-gray-500">{new Date(tx.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${tx.amount > 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('fr-FR')} FC
                    </p>
                    <span className="text-[10px] text-gray-500">Ref: {tx.reference}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
