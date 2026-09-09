'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Product, Wallet } from '@/types'
import { ProductSkeleton } from '@/components/Skeleton'
import { useToast } from '@/components/ToastProvider'
import { ArrowLeft, ShieldCheck, CheckCircle2, AlertCircle, TrendingUp, Calendar, DollarSign, Calculator, Sparkles } from 'lucide-react'
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
          <Link href="/invest" className="p-2 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </Link>
          <h1 className="font-bold text-gray-800 text-sm">Chargement du Pack...</h1>
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
        <p className="text-gray-500 font-semibold mb-4">Pack d'investissement introuvable.</p>
        <Link href="/invest" className="bg-biso-600 text-white text-xs font-bold px-4 py-2 rounded-xl">
          Retour au catalogue
        </Link>
      </div>
    )
  }

  // Calcul avec le nombre réel de jours du mois courant (pas /30 fixe)
  const now = new Date()
  const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const totalCost = product.price * quantity
  const totalMonthlyReturn = product.monthly_return * quantity
  const dailyProfit = totalMonthlyReturn / daysInCurrentMonth
  const totalExpectedReturn = product.total_returns * quantity
  const netProfit = totalExpectedReturn - totalCost
  const roiPercentage = ((totalExpectedReturn / totalCost) * 100).toFixed(0)
  const currentMonthName = now.toLocaleDateString('fr-FR', { month: 'long' })

  // 12 points for the projection curve
  const points = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const accumulated = totalMonthlyReturn * month
    return { month, accumulated }
  })
  const maxVal = totalExpectedReturn || 1

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 p-4 flex items-center justify-between sticky top-0 z-40">
        <Link href="/invest" className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Link>
        <h1 className="font-extrabold text-gray-900 text-sm">{product.name}</h1>
        <div className="w-9"></div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Product Hero Card */}
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-xs">
          <div className="h-64 w-full relative">
            <img
              src={product.image_url || 'https://images.unsplash.com/photo-1551754655-cd9e3fb8c371?auto=format&fit=crop&w=600&q=80'}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 right-3 bg-zinc-900/80 backdrop-blur-md text-amber-300 font-extrabold text-xs px-3 py-1.5 rounded-full border border-amber-500/30 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Contrat 12 Mois Garanti</span>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <div className="flex justify-between items-start">
                <h2 className="text-2xl font-black text-gray-900">{product.name}</h2>
                <span className="text-lg font-black text-biso-700 tabular-nums">
                  {product.price.toLocaleString('fr-FR')} FC
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">{product.description}</p>
            </div>

            {/* Wallet Available Balance Bar */}
            <div className="flex items-center justify-between bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100">
              <div>
                <p className="text-[11px] text-emerald-800 font-bold uppercase tracking-wider">Solde Wallet Disponible</p>
                <p className="text-base font-black text-emerald-950 tabular-nums">
                  {(wallet?.balance || 0).toLocaleString('fr-FR')} FC
                </p>
              </div>
              <Link
                href="/wallet?tab=deposit"
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs"
              >
                Recharger
              </Link>
            </div>
          </div>
        </div>

        {/* Interactive ROI Simulator */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xs space-y-5">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900">Simulateur de Rendement & ROI</h3>
              <p className="text-[11px] text-gray-500">Ajustez le curseur pour simuler vos gains instantanément.</p>
            </div>
          </div>

          {/* Quantity Slider */}
          <div className="space-y-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-gray-700">Nombre de packs :</span>
              <span className="font-black text-base text-biso-700 bg-white px-3 py-1 rounded-xl shadow-sm border border-gray-200">
                {quantity} pack{quantity > 1 ? 's' : ''}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max={product.purchase_limit || 10}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-biso-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 font-semibold">
              <span>1 pack</span>
              <span>Limite max : {product.purchase_limit} packs</span>
            </div>
          </div>

          {/* Dynamic ROI Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-biso-50/50 p-3.5 rounded-2xl border border-biso-100">
              <span className="text-[10px] uppercase font-bold text-biso-800">Gain / Jour</span>
              <p className="text-sm font-black text-biso-900 mt-1 tabular-nums">
                +{dailyProfit.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FC
              </p>
              <p className="text-[9px] text-biso-500 mt-0.5">{daysInCurrentMonth} j. en {currentMonthName}</p>
            </div>
            <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100">
              <span className="text-[10px] uppercase font-bold text-emerald-800">Versement / Mois</span>
              <p className="text-sm font-black text-emerald-900 mt-1 tabular-nums">
                +{totalMonthlyReturn.toLocaleString('fr-FR')} FC
              </p>
            </div>
            <div className="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-100">
              <span className="text-[10px] uppercase font-bold text-amber-800">Rendement Total</span>
              <p className="text-sm font-black text-amber-900 mt-1 tabular-nums">
                {totalExpectedReturn.toLocaleString('fr-FR')} FC
              </p>
            </div>
            <div className="bg-zinc-900 p-3.5 rounded-2xl text-white">
              <span className="text-[10px] uppercase font-bold text-amber-400 flex items-center">
                <Sparkles className="w-3 h-3 mr-1" /> ROI Brut
              </span>
              <p className="text-sm font-black text-white mt-1 tabular-nums">
                {roiPercentage} %
              </p>
            </div>
          </div>

          {/* SVG Visual 12-Month Projection Chart */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
              Courbe Prévisionnelle des Gains (12 Mois)
            </span>
            <div className="h-32 w-full bg-gradient-to-b from-emerald-50/40 to-transparent rounded-2xl p-2 flex items-end justify-between border border-emerald-100/60">
              {points.map((pt) => {
                const heightPercent = Math.max(10, Math.round((pt.accumulated / maxVal) * 100))
                return (
                  <div key={pt.month} className="flex-1 flex flex-col items-center justify-end h-full px-0.5 group relative">
                    {/* Tooltip */}
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 bg-zinc-900 text-white text-[9px] font-bold py-0.5 px-1.5 rounded-md pointer-events-none transition-opacity whitespace-nowrap z-20">
                      M{pt.month}: {pt.accumulated.toLocaleString('fr-FR')} FC
                    </div>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full bg-gradient-to-t from-biso-600 to-emerald-400 rounded-t-md transition-all duration-300 group-hover:from-biso-700 group-hover:to-emerald-500"
                    />
                    <span className="text-[9px] text-gray-400 font-bold mt-1">M{pt.month}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Purchase Action Bar */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 max-w-md mx-auto md:max-w-4xl lg:max-w-6xl bg-white border-t border-gray-100 p-4 z-40 flex items-center justify-between shadow-lg">
        <div>
          <span className="text-[11px] text-gray-400 font-semibold uppercase">Total Investissement :</span>
          <p className="text-xl font-black text-gray-900 tabular-nums">
            {totalCost.toLocaleString('fr-FR')} FC
          </p>
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          className="bg-gradient-to-r from-biso-600 to-biso-500 hover:from-biso-700 hover:to-biso-600 text-white font-black py-3.5 px-7 rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"
        >
          SOUSCRIRE MAINTENANT
        </button>
      </div>

      {/* Purchase Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-5 shadow-2xl border border-gray-100 text-center animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-biso-100 text-biso-700 flex items-center justify-center mx-auto shadow-sm">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-black text-gray-900">Confirmer l'Investissement</h4>
              <p className="text-xs text-gray-500 mt-1">
                Vous vous apprêtez à souscrire à <strong>{quantity}x {product.name}</strong> pour un montant total de{' '}
                <strong className="text-biso-700">{totalCost.toLocaleString('fr-FR')} FC</strong>.
              </p>
            </div>

            <div className="bg-gray-50 p-3.5 rounded-2xl text-xs space-y-1.5 text-left border border-gray-100">
              <div className="flex justify-between">
                <span className="text-gray-500">Rente Mensuelle :</span>
                <span className="font-bold text-emerald-700 tabular-nums">+{totalMonthlyReturn.toLocaleString('fr-FR')} FC / mois</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Durée du contrat :</span>
                <span className="font-bold text-gray-800">12 mois</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1.5">
                <span className="text-gray-800 font-bold">Total des gains :</span>
                <span className="font-black text-biso-700 tabular-nums">{totalExpectedReturn.toLocaleString('fr-FR')} FC</span>
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-xs"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handlePurchase}
                disabled={purchasing}
                className="flex-1 py-3 bg-biso-600 hover:bg-biso-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-md active:scale-95 disabled:opacity-40"
              >
                {purchasing ? 'Achat...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
