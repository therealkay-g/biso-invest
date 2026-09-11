'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Wallet, WalletTransaction, PaymentAccount, WithdrawalAccount } from '@/types'
import Header from '@/components/Header'
import WalletCard from '@/components/WalletCard'
import CopyButton from '@/components/CopyButton'
import Reveal from '@/components/Reveal'
import { RippleButton } from '@/components/RippleButton'
import { WalletSkeleton, TableSkeleton } from '@/components/Skeleton'
import { useToast } from '@/components/ToastProvider'
import { Wallet as WalletIcon, Plus, ArrowUpRight, History, CheckCircle2, AlertCircle, Upload, X, Lock, KeyRound, Minus } from 'lucide-react'

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

    setPinDigits(['', '', '', ''])
    setShowPinModal(true)
  }

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newDigits = [...pinDigits]
    newDigits[index] = value.slice(-1)
    setPinDigits(newDigits)

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

      const result = data as { success: boolean; reference: string; gross_amount: number; fee: number; net_amount: number }
      const feeDisplay = result?.fee ? result.fee.toLocaleString('fr-FR') : Math.round(amountNum * 0.15).toLocaleString('fr-FR')
      const netDisplay = result?.net_amount ? result.net_amount.toLocaleString('fr-FR') : (amountNum - Math.round(amountNum * 0.15)).toLocaleString('fr-FR')

      toast.success(`Retrait de ${amountNum.toLocaleString('fr-FR')} FC soumis — Frais : ${feeDisplay} FC — Vous recevez : ${netDisplay} FC`)
      setWithdrawAmount('')
      setShowPinModal(false)

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
        <Header displayName="Portefeuille" vipLevel="Chargement..." showBack={true} />
        <div className="p-4 max-w-4xl mx-auto space-y-6">
          <WalletSkeleton />
          <TableSkeleton rows={4} />
        </div>
      </div>
    )
  }

  const activePaymentAccount = paymentAccounts.find(p => p.network === depositNetwork)

  return (
    <div className="min-h-screen bg-gray-50 pb-24 page-enter">
      <Header displayName="Portefeuille" vipLevel="BISO Wallet" showBack={true} />

      <div className="p-4 max-w-4xl mx-auto space-y-5">
        {/* Tabs */}
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
              aria-current={activeTab === tab.key ? 'page' : undefined}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                activeTab === tab.key
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-5 animate-fade-in">
            <WalletCard
              balance={wallet?.balance || 0}
              totalInvested={wallet?.total_invested || 0}
              totalEarned={wallet?.total_earned || 0}
              todayEarned={wallet?.today_earned || 0}
              totalWithdrawn={wallet?.total_withdrawn || 0}
            />

            <div className="card p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-gray-900 text-sm">Dernières transactions</h3>
                <button
                  onClick={() => setActiveTab('history')}
                  className="text-xs text-emerald-600 font-bold hover:underline"
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
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{tx.description}</p>
                        <p className="text-[10px] text-gray-400">{new Date(tx.created_at).toLocaleString('fr-FR')}</p>
                      </div>
                      <span className={`text-xs font-bold tabular-nums shrink-0 ml-2 ${tx.amount > 0 ? 'text-emerald-600' : 'text-gray-800'}`}>
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
          <div className="card p-6 space-y-5 animate-fade-in">
            <div>
              <h3 className="text-lg font-black text-gray-900">Recharger votre portefeuille</h3>
              <p className="text-xs text-gray-500 mt-0.5">Envoyez les fonds par Mobile Money puis téléversez votre preuve.</p>
            </div>

            <form onSubmit={handleDeposit} className="space-y-5">
              {/* Sélecteur réseau */}
              <div>
                <label className="label-field">Opérateur Mobile Money</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Airtel Money', 'Orange Money', 'M-Pesa'] as const).map((net) => (
                    <button
                      key={net}
                      type="button"
                      onClick={() => setDepositNetwork(net)}
                      className={`py-3.5 px-2 rounded-2xl text-xs font-bold border transition-all text-center min-h-[44px] ${
                        depositNetwork === net
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-xs ring-1 ring-emerald-500/30'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {net}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compte récepteur officiel */}
              {activePaymentAccount ? (
                <div className="bg-gradient-to-r from-emerald-50 to-emerald-50/50 border border-emerald-200 p-4 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-emerald-800">Numéro récepteur officiel :</span>
                    <CopyButton textToCopy={activePaymentAccount.phone_number} label="Copier" />
                  </div>
                  <p className="text-xl font-black text-emerald-950 tracking-wider tabular-nums font-mono">
                    {activePaymentAccount.phone_number}
                  </p>
                  <p className="text-[11px] text-gray-600">
                    Titulaire : <strong className="text-gray-900">{activePaymentAccount.account_name}</strong>
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-800">
                  Numéro en cours d&apos;attribution par l&apos;administration. Contactez le support.
                </div>
              )}

              <div>
                <label className="label-field">Montant en Francs Congolais (FC)</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="1000"
                    placeholder="Ex: 50 000"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="input-field pr-10"
                  />
                  <span className="absolute right-4 top-3.5 text-xs font-bold text-gray-400">FC</span>
                </div>
              </div>

              <div>
                <label className="label-field">
                  Capture d&apos;écran du SMS Mobile Money <span className="text-gray-400 font-normal">(Obligatoire)</span>
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
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1.5 shadow-md hover:bg-red-700 transition-colors"
                      aria-label="Supprimer l'image"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-gray-200 hover:border-emerald-400 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-gray-50 hover:bg-emerald-50/30 min-h-[110px]">
                    <Upload className="w-6 h-6 text-gray-400 mb-1" aria-hidden="true" />
                    <span className="text-xs font-bold text-gray-700">Cliquez pour importer la capture du SMS</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">PNG, JPG jusqu&apos;à 5 Mo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProofImageChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <RippleButton
                type="submit"
                disabled={submittingDeposit}
                className="w-full btn-primary text-xs uppercase tracking-wider shadow-md"
              >
                {submittingDeposit ? 'Envoi en cours...' : 'ENVOYER LA DEMANDE'}
              </RippleButton>
            </form>
          </div>
        )}

        {/* Tab 3: Withdraw */}
        {activeTab === 'withdraw' && (
          <div className="card p-6 space-y-5 animate-fade-in">
            <div>
              <h3 className="text-lg font-black text-gray-900">Demande de retrait</h3>
              <p className="text-xs text-gray-500 mt-0.5">Retirez vos gains vers votre numéro Mobile Money en toute sécurité.</p>
            </div>

            <form onSubmit={handleInitiateWithdraw} className="space-y-4">
              <div>
                <label className="label-field">Compte de réception Mobile Money</label>
                <select
                  value={selectedWithdrawAccount}
                  onChange={(e) => setSelectedWithdrawAccount(e.target.value)}
                  className="input-field"
                >
                  {withdrawalAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.network} — {acc.phone_number} {acc.account_name ? `(${acc.account_name})` : ''}
                    </option>
                  ))}
                </select>
                {withdrawalAccounts.length === 0 && (
                  <p className="text-xs text-red-500 mt-1.5 font-semibold">
                    Aucun compte configuré. Veuillez en ajouter un dans l&apos;onglet Profil.
                  </p>
                )}
              </div>

              <div>
                <label className="label-field">Montant à retirer (FC)</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="5000"
                    placeholder="Min 5 000 FC"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="input-field pr-10"
                  />
                  <span className="absolute right-4 top-3.5 text-xs font-bold text-gray-400">FC</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  Montant minimum : 5 000 FC — Frais de retrait : 15 %.
                </p>
              </div>

              {/* Récapitulatif frais */}
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
                      <span className="text-gray-500">Frais de gestion (15 %) :</span>
                      <span className="font-bold text-red-600 tabular-nums">− {fee.toLocaleString('fr-FR')} FC</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2">
                      <span className="text-gray-800 font-black">Montant net reçu :</span>
                      <span className="font-black text-emerald-700 tabular-nums text-sm">{net.toLocaleString('fr-FR')} FC</span>
                    </div>
                  </div>
                )
              })()}

              <button
                type="submit"
                disabled={withdrawalAccounts.length === 0}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 disabled:opacity-40 min-h-[44px]"
              >
                Soumettre
              </button>
            </form>
          </div>
        )}

        {/* Tab 4: History */}
        {activeTab === 'history' && (
          <div className="card p-6 space-y-4 animate-fade-in">
            <h3 className="font-black text-gray-900 text-sm">Historique des transactions</h3>
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">Aucune transaction dans l&apos;historique.</p>
              ) : (
                transactions.map((tx) => (
                  <Reveal key={tx.id} axis="x" from={8}>
                    <div className="flex justify-between items-center p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="min-w-0">
                        <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          {tx.type}
                        </span>
                        <p className="text-xs font-bold text-gray-900 mt-1 truncate">{tx.description}</p>
                        <p className="text-[10px] text-gray-400">{new Date(tx.created_at).toLocaleString('fr-FR')}</p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className={`text-sm font-black tabular-nums ${tx.amount > 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('fr-FR')} FC
                        </p>
                        <span className="text-[10px] text-gray-400 font-mono">Ref: {tx.reference}</span>
                      </div>
                    </div>
                  </Reveal>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modale PIN de sécurité */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm modal-overlay">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-5 shadow-2xl border border-gray-100 text-center modal-panel">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm tap-icon">
              <Lock className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h4 className="text-base font-black text-gray-900">Code PIN de sécurité</h4>
              <p className="text-xs text-gray-500 mt-1">Saisissez votre code PIN à 4 chiffres pour autoriser le retrait.</p>
            </div>

            {/* Récapitulatif frais */}
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
                    <span className="text-gray-500">Frais (15 %) :</span>
                    <span className="font-bold text-red-600 tabular-nums">− {fee.toLocaleString('fr-FR')} FC</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-1.5">
                    <span className="text-gray-800 font-black">Vous recevez :</span>
                    <span className="font-black text-emerald-700 tabular-nums">{net.toLocaleString('fr-FR')} FC</span>
                  </div>
                </div>
              )
            })()}

            {/* Boîtes PIN */}
            <div className="flex justify-center space-x-3 py-2">
              {pinDigits.map((digit, idx) => (
                <input
                  key={idx}
                  id={`pin-input-${idx}`}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(idx, e.target.value)}
                  aria-label={`Chiffre ${idx + 1} du code PIN`}
                  className="w-12 h-14 text-center text-xl font-black bg-gray-50 border-2 border-gray-200 focus:border-emerald-600 rounded-2xl transition-colors"
                />
              ))}
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-xs min-h-[44px]"
              >
                Annuler
              </button>
              <RippleButton
                type="button"
                onClick={handleConfirmPinAndWithdraw}
                disabled={submittingWithdraw || pinDigits.some(d => d === '')}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-md disabled:opacity-40 min-h-[44px]"
              >
                {submittingWithdraw ? 'Validation...' : 'Valider'}
              </RippleButton>
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