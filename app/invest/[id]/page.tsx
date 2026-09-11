'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Product, Wallet } from '@/types'
import { ProductSkeleton } from '@/components/Skeleton'
import { useToast } from '@/components/ToastProvider'
import Parallax from '@/components/Parallax'
import { RippleButton } from '@/components/RippleButton'
import { ArrowLeft, ShieldCheck, CheckCircle2, TrendingUp, Clock, Award, Wallet as WalletIcon, Minus, Plus, Lock, HandCoins } from 'lucide-react'
import { getVipTierForPrice } from '@/utils/constants'
import Link from 'next/link'

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string
  const toast = useToast()

  const [product, setProduct] = useState<Product | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    async function loadDetail() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/auth/login')
          return
        }

        const { data: prodData } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .single()

        const { data: walletData } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', user.id)
          .single()

        setProduct(prodData)
        setWallet(walletData)
      } catch (err) {
        console.error('Error loading product detail:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDetail()
  }, [productId, router])

  const handlePurchase = async () => {
    if (!product || !wallet) return
    setPurchasing(true)

    const totalCost = product.price * quantity

    if (wallet.balance < totalCost) {
      toast.error('Solde insuffisant dans votre portefeuille. Veuillez recharger.')
      setPurchasing(false)
      setShowConfirm(false)
      return
    }

    try {
      const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `INV-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

      const { data, error: rpcError } = await supabase.rpc('purchase_investment', {
        p_product_id: product.id,
        p_quantity: quantity,
        p_idempotency_key: idempotencyKey
      })

      if (rpcError) throw rpcError

      toast.success(`Félicitations ! Votre souscription au ${product.name} (x${quantity}) est confirmée.`)
      setTimeout(() => {
        router.push('/investments')
      }, 1500)

    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'achat du pack.")
    } finally {
      setPurchasing(false)
      setShowConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <div className="bg-white border-b border-gray-100 p-4 flex items-center justify-between sticky top-0 z-40">
          <Link href="/invest" className="p-2 rounded-full hover:bg-gray-100" aria-label="Retour">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </Link>
          <h1 className="font-bold text-gray-800 text-sm">Chargement du pack...</h1>
          <div className="w-9"></div>
        </div>
        <div className="max-w-2xl mx-auto p-4 space-y-6">
          <ProductSkeleton />
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-gray-500 font-semibold mb-4">Pack d&apos;investissement introuvable.</p>
        <Link href="/invest" className="btn-primary px-5 text-xs">
          Retour au catalogue
        </Link>
      </div>
    )
  }

  const now = new Date()
  const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const totalCost = product.price * quantity
  const totalMonthlyReturn = product.monthly_return * quantity
  const dailyProfit = totalMonthlyReturn / daysInCurrentMonth
  const totalExpectedReturn = product.total_returns * quantity
  const vipTier = getVipTierForPrice(product.price)

  return (
    <div className="min-h-screen bg-gray-50 pb-32 page-enter">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 p-4 flex items-center justify-between sticky top-0 z-40">
        <Link href="/invest" className="p-2 rounded-full hover:bg-gray-100" aria-label="Retour">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Link>
        <h1 className="font-extrabold text-gray-900 text-sm">{product.name}</h1>
        <div className="w-9"></div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-5">
        {/* Héro du pack */}
        <div className="card overflow-hidden animate-fade-in">
          <div className="h-40 w-full relative overflow-hidden">
            <Parallax max={5} className="absolute inset-0">
              <img
                src={product.image_url || 'https://images.unsplash.com/photo-1551754655-cd9e3fb8c371?auto=format&fit=crop&w=600&q=80'}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </Parallax>
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/70 via-transparent to-transparent" />
            {vipTier && (
              <span className={`absolute top-3 left-3 ${vipTier.colorClass} font-extrabold text-xs px-3 py-1.5 rounded-full shadow-md inline-flex items-center space-x-1.5`}>
                <Award className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{vipTier.level}</span>
              </span>
            )}
            <span className="absolute top-3 right-3 bg-white/90 backdrop-blur-md text-emerald-900 font-extrabold text-xs px-3 py-1.5 rounded-full border border-emerald-200 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span>Contrat {product.duration_months} mois</span>
            </span>
          </div>

          <div className="p-5 space-y-4">
            <div>
              {vipTier && (
                <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider block mb-1">
                  {vipTier.name} — Plafond : {vipTier.maxPacks} packs max
                </span>
              )}
              <h2 className="text-2xl font-black text-gray-900">{product.name}</h2>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">{product.description}</p>
            </div>

            {/* Chiffres clés */}
            <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-2xl p-3.5 text-center">
              <div>
                <p className="text-[9px] uppercase text-gray-400 font-bold">Montant</p>
                <p className="font-black text-gray-900 text-sm tabular-nums mt-0.5">{product.price.toLocaleString('fr-FR')} FC</p>
              </div>
              <div className="border-x border-gray-200">
                <p className="text-[9px] uppercase text-gray-400 font-bold">Revenu mensuel prévu</p>
                <p className="font-black text-emerald-700 text-sm tabular-nums mt-0.5 inline-flex items-center">
                  <TrendingUp className="w-3.5 h-3.5 mr-0.5" aria-hidden="true" />
                  {product.monthly_return.toLocaleString('fr-FR')} FC
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase text-gray-400 font-bold">Durée</p>
                <p className="font-black text-gray-900 text-sm tabular-nums mt-0.5 inline-flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-0.5 text-amber-600" aria-hidden="true" />
                  {product.duration_months} mois
                </p>
              </div>
            </div>

            {/* Solde wallet */}
            <Link
              href="/wallet?tab=deposit"
              className="flex items-center justify-between bg-emerald-50/70 p-4 rounded-2xl border border-emerald-100 transition-colors hover:bg-emerald-50"
            >
              <div className="flex items-center space-x-3">
                <span className="w-9 h-9 rounded-xl bg-white border border-emerald-200 text-emerald-700 flex items-center justify-center">
                  <WalletIcon className="w-4 h-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[10px] uppercase text-emerald-700 font-bold tracking-wider">Solde wallet disponible</p>
                  <p className="font-black text-emerald-950 tabular-nums text-sm">{(wallet?.balance || 0).toLocaleString('fr-FR')} FC</p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-white border border-emerald-200 px-3 py-2 rounded-xl">
                Recharger
              </span>
            </Link>

            {/* Quantité */}
            <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
              <div>
                <p className="text-[10px] uppercase text-gray-400 font-bold">Nombre de packs</p>
                <p className="font-black text-gray-900 text-sm tabular-nums mt-0.5">
                  {quantity} pack{quantity > 1 ? 's' : ''} — <span className="text-emerald-700">{totalCost.toLocaleString('fr-FR')} FC</span>
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  aria-label="Diminuer la quantité"
                  className="w-11 h-11 rounded-2xl bg-white border border-gray-200 text-gray-700 flex items-center justify-center shadow-sm transition-all active:scale-90 disabled:opacity-40"
                  disabled={quantity <= 1}
                >
                  <Minus className="w-4 h-4" aria-hidden="true" />
                </button>
                <span className="w-10 text-center font-black text-gray-900 tabular-nums">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.min(product.purchase_limit || 10, q + 1))}
                  aria-label="Augmenter la quantité"
                  className="w-11 h-11 rounded-2xl bg-white border border-gray-200 text-gray-700 flex items-center justify-center shadow-sm transition-all active:scale-90"
                  disabled={quantity >= (product.purchase_limit || 10)}
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Résumé des gains */}
        <div className="card p-5 space-y-3 animate-fade-in">
          <h3 className="font-black text-gray-900 text-sm flex items-center">
            <HandCoins className="w-4 h-4 mr-1.5 text-emerald-600" aria-hidden="true" />
            Résumé de votre investissement
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-50 rounded-2xl p-3.5">
              <span className="block text-gray-500 text-[10px] uppercase font-bold">Revenu mensuel prévu</span>
              <span className="font-black text-emerald-700 tabular-nums block mt-0.5">+{totalMonthlyReturn.toLocaleString('fr-FR')} FC</span>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3.5">
              <span className="block text-gray-500 text-[10px] uppercase font-bold">Bénéfice quotidien</span>
              <span className="font-black text-amber-700 tabular-nums block mt-0.5">+{dailyProfit.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FC / j</span>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3.5">
              <span className="block text-gray-500 text-[10px] uppercase font-bold">Total attendu ({product.duration_months} mois)</span>
              <span className="font-black text-gray-900 tabular-nums block mt-0.5">{totalExpectedReturn.toLocaleString('fr-FR')} FC</span>
            </div>
            <div className="bg-emerald-700 rounded-2xl p-3.5 text-white">
              <span className="block text-emerald-200 text-[10px] uppercase font-bold">Revenu net estimé</span>
              <span className="font-black text-white tabular-nums block mt-0.5">+{(totalExpectedReturn - totalCost).toLocaleString('fr-FR')} FC</span>
            </div>
          </div>
        </div>

        {/* Comment ça fonctionne */}
        <div className="card p-5 space-y-4 animate-fade-in">
          <h3 className="font-black text-gray-900 text-sm">Comment ça fonctionne ?</h3>
          <ol className="space-y-3">
            {[
              { title: '1. Souscrivez votre pack', text: `Investissez ${product.price.toLocaleString('fr-FR')} FC (× quantité) depuis votre portefeuille.` },
              { title: '2. Gagnez chaque jour', text: `Un bénéfice de +${dailyProfit.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FC/jour se génère automatiquement.` },
              { title: '3. Vendez votre bénéfice quotidien', text: 'Cliquez sur VENDRE chaque jour depuis « Mes investissements » pour créditer votre solde.' },
              { title: '4. Bénéfice non réclamé', text: 'Un bénéfice non vendu le jour même est perdu et ne sera jamais reporté.' },
              { title: '5. Cycle de 12 mois', text: `Au terme des ${product.duration_months} mois, votre contrat est complété.` },
            ].map((step) => (
              <li key={step.title} className="flex space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-xs font-bold text-gray-900">{step.title}</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Barre d'action fixe */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 max-w-md mx-auto md:max-w-4xl lg:max-w-6xl bg-white border-t border-gray-100 p-4 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] text-gray-400 font-semibold uppercase">Total investissement</span>
            <p className="text-lg font-black text-gray-900 tabular-nums truncate">{totalCost.toLocaleString('fr-FR')} FC</p>
          </div>
          <RippleButton
            onClick={() => setShowConfirm(true)}
            className="btn-primary px-6 text-xs uppercase tracking-widest shrink-0 w-auto"
          >
            INVESTIR
          </RippleButton>
        </div>
      </div>

      {/* Modale de confirmation */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm modal-overlay">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-5 shadow-2xl border border-gray-100 text-center modal-panel">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm tap-icon">
              <ShieldCheck className="w-7 h-7" aria-hidden="true" />
            </div>
            <div>
              <h4 className="text-base font-black text-gray-900">Confirmer l&apos;investissement</h4>
              <p className="text-xs text-gray-500 mt-1">
                Vous vous apprêtez à souscrire <strong>{quantity}x {product.name}</strong> pour un total de{' '}
                <strong className="text-emerald-700">{totalCost.toLocaleString('fr-FR')} FC</strong>.
              </p>
            </div>

            <div className="bg-gray-50 p-3.5 rounded-2xl text-xs space-y-1.5 text-left border border-gray-100">
              <div className="flex justify-between">
                <span className="text-gray-500">Revenu mensuel prévu :</span>
                <span className="font-bold text-emerald-700 tabular-nums">+{totalMonthlyReturn.toLocaleString('fr-FR')} FC / mois</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Durée du contrat :</span>
                <span className="font-bold text-gray-800">{product.duration_months} mois</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1.5">
                <span className="text-gray-800 font-bold">Total des gains attendus :</span>
                <span className="font-black text-emerald-700 tabular-nums">{totalExpectedReturn.toLocaleString('fr-FR')} FC</span>
              </div>
            </div>

            {wallet && wallet.balance < totalCost && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-[11px] text-red-700 flex items-center space-x-2">
                <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Solde insuffisant ({wallet.balance.toLocaleString('fr-FR')} FC). Rechargez votre portefeuille.</span>
              </div>
            )}

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-xs min-h-[44px]"
              >
                Annuler
              </button>
              <RippleButton
                type="button"
                onClick={handlePurchase}
                disabled={purchasing || (wallet ? wallet.balance < totalCost : false)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-md active:scale-95 disabled:opacity-40 min-h-[44px]"
              >
                {purchasing ? 'Achat...' : 'Confirmer'}
              </RippleButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}