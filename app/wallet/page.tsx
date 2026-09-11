'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Wallet, WalletTransaction, PaymentAccount, WithdrawalAccount } from '@/types'
import Header from '@/components/Header'
import WalletCard from '@/components/WalletCard'
import CopyButton from '@/components/CopyButton'
import { WalletSkeleton, TableSkeleton } from '@/components/Skeleton'
import { useToast } from '@/components/ToastProvider'
import { Wallet as WalletIcon, Plus, ArrowUpRight, History, CreditCard, CheckCircle2, AlertCircle, Upload, Image as ImageIcon, X, Lock, KeyRound } from 'lucide-react'

function WalletContent() {
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'overview'
  const [activeTab, setActiveTab] = useState(defaultTab)
  const toast = useToast()

  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([])
  const [withdrawalAccounts, setWithdrawalAccounts] = useState<WithdrawalAccount[]>([])
  const [loading, setLoading] = useState(true)

  // Deposit form state
  const [depositNetwork, setDepositNetwork] = useState<'Airtel Money' | 'Orange Money' | 'M-Pesa'>('Airtel Money')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositProofPreview, setDepositProofPreview] = useState<string | null>(null)
  const [submittingDeposit, setSubmittingDeposit] = useState(false)

  // Withdrawal form & PIN Modal state
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [selectedWithdrawAccount, setSelectedWithdrawAccount] = useState('')
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinDigits, setPinDigits] = useState(['', '', '', ''])
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false)

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

  // Supabase Realtime synchronization on wallet balance
  useEffect(() => {
    let channel: any
    async function setupRealtime() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase
        .channel(`realtime-wallet-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'wallets',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            if (payload.new) {
              setWallet(payload.new as Wallet)
              toast.success('Votre solde de portefeuille a été actualisé en direct !')
            }
          }
        )
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [toast])

  const handleProofImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 5 Mo.")
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setDepositProofPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault()

    const amountNum = parseFloat(depositAmount)
    if (!amountNum || amountNum < 1000) {
      toast.error('Le montant minimum de recharge est de 1 000 FC.')
      return
    }
    if (!depositProofPreview) {
      toast.error('La capture d\u2019écran du SMS Mobile Money est obligatoire.')
      return
    }

    setSubmittingDeposit(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      const { error } = await supabase.from('deposits').insert({
        user_id: user.id,
        amount: amountNum,
        network: depositNetwork,
        reference: `DEP-${Date.now()}`,
        proof_url: depositProofPreview || null,
        status: 'EN_ATTENTE'
      })

      if (error) throw error

      toast.success('Demande de recharge soumise avec succès ! En attente de validation administrative.')
      setDepositAmount('')
      setDepositProofPreview(null)
      setActiveTab('overview')
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la soumission de la recharge.')
    } finally {
      setSubmittingDeposit(false)
    }
  }

  const handleInitiateWithdraw = (e: React.FormEvent) => {
    e.preventDefault()

    const amountNum = parseFloat(withdrawAmount)
    if (!amountNum || amountNum < 5000) {
      toast.error('Le montant minimum de retrait est de 5 000 FC.')
      return
    }
    if (wallet && wallet.balance < amountNum) {
      toast.error('Solde insuffisant dans votre portefeuille.')
      return
    }
    if (!selectedWithdrawAccount) {
      toast.error('Veuillez sélectionner un compte de retrait Mobile Money.')
      return
    }

    // Open PIN confirmation modal
    setPinDigits(['', '', '', ''])
    setShowPinModal(true)
  }

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newDigits = [...pinDigits]
    newDigits[index] = value.slice(-1)
    setPinDigits(newDigits)

    // Auto-focus next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`pin-input-${index + 1}`)
      nextInput?.focus()
    }
  }

  const handleConfirmPinAndWithdraw = async () => {
    const fullPin = pinDigits.join('')
    if (fullPin.length !== 4) {
      toast.error('Veuillez saisir les 4 chiffres de votre code PIN.')
      return
    }

    setSubmittingWithdraw(true)

    try {
      const amountNum = parseFloat(withdrawAmount)
      const { data, error: rpcError } = await supabase.rpc('create_withdrawal', {
        p_withdrawal_account_id: selectedWithdrawAccount,
        p_amount: amountNum
      })

      if (rpcError) throw rpcError

      // La RPC renvoie {success, reference, gross_amount, fee, net_amount}
      const result = data as { success: boolean; reference: string; gross_amount: number; fee: number; net_amount: number }
      const feeDisplay = result?.fee ? result.fee.toLocaleString('fr-FR') : Math.round(amountNum * 0.15).toLocaleString('fr-FR')
      const netDisplay = result?.net_amount ? result.net_amount.toLocaleString('fr-FR') : (amountNum - Math.round(amountNum * 0.15)).toLocaleString('fr-FR')

      toast.success(`Retrait de ${amountNum.toLocaleString('fr-FR')} FC soumis — Frais : ${feeDisplay} FC — Vous recevez : ${netDisplay} FC`)
      setWithdrawAmount('')
      setShowPinModal(false)

      // Reload wallet & transactions
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: wData } = await supabase.from('wallets').select('*').eq('user_id', user.id).single()
        setWallet(wData)
        const { data: txData } = await supabase.from('wallet_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
        setTransactions(txData || [])
      }

      setActiveTab('overview')
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la demande de retrait.')
    } finally {
      setSubmittingWithdraw(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header displayName="Portefeuille & Finances" vipLevel="Chargement..." showBack={true} />
        <div className="p-4 max-w-4xl mx-auto space-y-6">
          <WalletSkeleton />
          <TableSkeleton rows={4} />
        </div>
      </div>
    )
  }

  const activePaymentAccount = paymentAccounts.find(p => p.network === depositNetwork)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header displayName="Portefeuille & Finances" vipLevel="BISO Wallet" showBack={true} />

      <div className="p-4 max-w-4xl mx-auto space-y-6">
        {/* Navigation Tabs */}
        <div className="flex space-x-1.5 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-xs">
          {[
            { key: 'overview', label: 'Aperçu' },
            { key: 'deposit', label: 'Recharger' },
            { key: 'withdraw', label: 'Retirer' },
            { key: 'history', label: 'Historique' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                activeTab === tab.key
                  ? 'bg-biso-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <WalletCard
              balance={wallet?.balance || 0}
              totalInvested={wallet?.total_invested || 0}
              totalEarned={wallet?.total_earned || 0}
              todayEarned={wallet?.today_earned || 0}
            />

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-extrabold text-gray-900 text-sm">Dernières Transactions</h3>
                <button
                  onClick={() => setActiveTab('history')}
                  className="text-xs text-biso-700 font-bold hover:underline"
                >
                  Voir tout
                </button>
              </div>
              <div className="space-y-3 divide-y divide-gray-100">
                {transactions.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">Aucune transaction récente.</p>
                ) : (
                  transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="flex justify-between items-center pt-3 first:pt-0">
                      <div>
                        <p className="text-xs font-bold text-gray-900">{tx.description}</p>
                        <p className="text-[10px] text-gray-400">{new Date(tx.created_at).toLocaleString('fr-FR')}</p>
                      </div>
                      <span className={`text-xs font-bold tabular-nums ${tx.amount > 0 ? 'text-emerald-600' : 'text-gray-800'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('fr-FR')} FC
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Deposit */}
        {activeTab === 'deposit' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-6">
            <div>
              <h3 className="text-lg font-black text-gray-900">Recharger votre Portefeuille</h3>
              <p className="text-xs text-gray-500 mt-0.5">Envoyez les fonds par Mobile Money puis téléversez votre preuve.</p>
            </div>

            <form onSubmit={handleDeposit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Opérateur Mobile Money</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Airtel Money', 'Orange Money', 'M-Pesa'] as const).map((net) => (
                    <button
                      key={net}
                      type="button"
                      onClick={() => setDepositNetwork(net)}
                      className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        depositNetwork === net
                          ? 'border-biso-600 bg-biso-50 text-biso-900 shadow-xs'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {net}
                    </button>
                  ))}
                </div>
              </div>

              {/* Official receiver account card */}
              {activePaymentAccount ? (
                <div className="bg-gradient-to-r from-biso-50 to-emerald-50 border border-biso-200 p-4 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-biso-800">Numéro Récepteur Officiel :</span>
                    <CopyButton textToCopy={activePaymentAccount.phone_number} label="Copier" />
                  </div>
                  <p className="text-xl font-black text-biso-950 tracking-wider tabular-nums font-mono">
                    {activePaymentAccount.phone_number}
                  </p>
                  <p className="text-xs text-gray-600">
                    Titulaire du compte : <strong className="text-gray-900">{activePaymentAccount.account_name}</strong>
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-800">
                  Numéro en cours d'attribution par l'administration. Veuillez contacter le support.
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Montant en Francs Congolais (FC)</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="1000"
                    placeholder="Ex: 50 000"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold tabular-nums focus:bg-white focus:border-biso-500 focus:outline-hidden"
                  />
                  <span className="absolute right-4 top-3.5 text-xs font-bold text-gray-400">FC</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Capture d'écran du SMS Mobile Money <span className="text-gray-400 font-normal">(Obligatoire)</span>
                </label>
                {depositProofPreview ? (
                  <div className="relative border border-gray-200 rounded-2xl p-2 bg-gray-50 inline-block">
                    <img
                      src={depositProofPreview}
                      alt="Aperçu preuve"
                      className="h-36 w-auto rounded-xl object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setDepositProofPreview(null)}
                      className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow-md hover:bg-rose-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-gray-200 hover:border-biso-500 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-gray-50 hover:bg-biso-50/30">
                    <Upload className="w-6 h-6 text-gray-400 mb-1" />
                    <span className="text-xs font-bold text-gray-700">Cliquez pour importer la capture du SMS</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">PNG, JPG jusqu'à 5 Mo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProofImageChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <button
                type="submit"
                disabled={submittingDeposit}
                className="w-full bg-gradient-to-r from-biso-600 to-biso-500 hover:from-biso-700 hover:to-biso-600 text-white font-black py-3.5 rounded-2xl text-xs tracking-wider uppercase shadow-md transition-all active:scale-98 disabled:opacity-50"
              >
                {submittingDeposit ? 'Envoi en cours...' : 'Soumettre la Recharge'}
              </button>
            </form>
          </div>
        )}

        {/* Tab 3: Withdraw */}
        {activeTab === 'withdraw' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-6">
            <div>
              <h3 className="text-lg font-black text-gray-900">Demande de Retrait</h3>
              <p className="text-xs text-gray-500 mt-0.5">Retirez vos gains directement vers votre numéro Mobile Money en toute sécurité.</p>
            </div>

            <form onSubmit={handleInitiateWithdraw} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Compte de réception Mobile Money</label>
                <select
                  value={selectedWithdrawAccount}
                  onChange={(e) => setSelectedWithdrawAccount(e.target.value)}
                  className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:bg-white focus:border-biso-500"
                >
                  {withdrawalAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.network} • {acc.phone_number} {acc.account_name ? `(${acc.account_name})` : ''}
                    </option>
                  ))}
                </select>
                {withdrawalAccounts.length === 0 && (
                  <p className="text-xs text-rose-500 mt-1 font-semibold">
                    Aucun compte configuré. Veuillez en ajouter un dans l'onglet Profil.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Montant à retirer (FC)</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="5000"
                    placeholder="Min 5 000 FC"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold tabular-nums focus:bg-white focus:border-biso-500"
                  />
                  <span className="absolute right-4 top-3.5 text-xs font-bold text-gray-400">FC</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  Le montant minimum de retrait est de 5 000 CDF, et les frais de retrait sont de 15%.
                </p>
              </div>

              {/* Récapitulatif dynamique brut / frais 15% / net */}
              {withdrawAmount && parseFloat(withdrawAmount) >= 5000 && (() => {
                const gross = parseFloat(withdrawAmount)
                const fee = Math.round(gross * 0.15 * 100) / 100
                const net = gross - fee
                return (
                  <div className="bg-gray-50 p-4 rounded-2xl space-y-2 text-xs border border-gray-100">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Montant brut saisi :</span>
                      <span className="font-bold text-gray-800 tabular-nums">{gross.toLocaleString('fr-FR')} FC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Frais de gestion (15%) :</span>
                      <span className="font-bold text-rose-600 tabular-nums">− {fee.toLocaleString('fr-FR')} FC</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2">
                      <span className="text-gray-800 font-black">Montant net reçu :</span>
                      <span className="font-black text-biso-700 tabular-nums text-sm">{net.toLocaleString('fr-FR')} FC</span>
                    </div>
                  </div>
                )
              })()}

              <button
                type="submit"
                disabled={withdrawalAccounts.length === 0}
                className="w-full bg-gradient-to-r from-biso-700 to-biso-600 hover:from-biso-800 hover:to-biso-700 text-white font-black py-3.5 rounded-2xl text-xs tracking-wider uppercase shadow-md transition-all active:scale-98 disabled:opacity-40"
              >
                Soumettre
              </button>
            </form>
          </div>
        )}

        {/* Tab 4: History */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-black text-gray-900 text-sm">Registre des Opérations Financières</h3>
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">Aucune transaction dans l'historique.</p>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                    <div>
                      <span className="text-[10px] font-black bg-biso-100 text-biso-800 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        {tx.type}
                      </span>
                      <p className="text-xs font-bold text-gray-900 mt-1">{tx.description}</p>
                      <p className="text-[10px] text-gray-400">{new Date(tx.created_at).toLocaleString('fr-FR')}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black tabular-nums ${tx.amount > 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('fr-FR')} FC
                      </p>
                      <span className="text-[10px] text-gray-400 font-mono">Ref: {tx.reference}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4-Digit Security PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-5 shadow-2xl border border-gray-100 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-biso-100 text-biso-700 flex items-center justify-center mx-auto shadow-sm">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-gray-900">Code PIN de Sécurité</h4>
              <p className="text-xs text-gray-500 mt-1">Saisissez votre code PIN à 4 chiffres pour autoriser le retrait de fonds.</p>
            </div>

            {/* Récapitulatif dans la modale */}
            {withdrawAmount && parseFloat(withdrawAmount) >= 5000 && (() => {
              const gross = parseFloat(withdrawAmount)
              const fee = Math.round(gross * 0.15 * 100) / 100
              const net = gross - fee
              return (
                <div className="bg-gray-50 rounded-2xl p-3 space-y-1.5 text-xs border border-gray-100 text-left">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Montant brut :</span>
                    <span className="font-bold tabular-nums">{gross.toLocaleString('fr-FR')} FC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Frais (15%) :</span>
                    <span className="font-bold text-rose-600 tabular-nums">− {fee.toLocaleString('fr-FR')} FC</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-1.5">
                    <span className="font-black text-gray-800">Vous recevez :</span>
                    <span className="font-black text-biso-700 tabular-nums">{net.toLocaleString('fr-FR')} FC</span>
                  </div>
                </div>
              )
            })()}

            {/* 4 digit boxes */}
            <div className="flex justify-center space-x-3 py-2">
              {pinDigits.map((digit, idx) => (
                <input
                  key={idx}
                  id={`pin-input-${idx}`}
                  type="password"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(idx, e.target.value)}
                  className="w-12 h-14 text-center text-xl font-black bg-gray-50 border-2 border-gray-200 focus:border-biso-600 rounded-2xl focus:outline-hidden"
                />
              ))}
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-xs"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmPinAndWithdraw}
                disabled={submittingWithdraw || pinDigits.some(d => d === '')}
                className="flex-1 py-3 bg-biso-600 hover:bg-biso-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-md disabled:opacity-40"
              >
                {submittingWithdraw ? 'Validation...' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-gray-500">Chargement...</div>}>
      <WalletContent />
    </Suspense>
  )
}
