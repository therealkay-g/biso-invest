'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Product, Wallet } from '@/types'
import { ArrowLeft, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string

  const [product, setProduct] = useState<Product | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
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
    setError('')
    setPurchasing(true)

    const totalCost = product.price * quantity

    if (wallet.balance < totalCost) {
      setError('Solde insuffisant dans votre wallet. Veuillez recharger.')
      setPurchasing(false)
      setShowConfirm(false)
      return
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('purchase_investment', {
        p_product_id: product.id,
        p_quantity: quantity
      })

      if (rpcError) throw rpcError

      setSuccess('Investissement réussi avec succès !')
      setTimeout(() => {
        router.push('/investments')
      }, 2000)

    } catch (err: any) {
      setError(err.message || "Erreur lors de l'achat.")
    } finally {
      setPurchasing(false)
      setShowConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-biso-600"></div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-gray-500">Pack introuvable.</p>
      </div>
    )
  }

  const totalCost = product.price * quantity

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 p-4 flex items-center justify-between sticky top-0 z-40">
        <Link href="/invest" className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Link>
        <h1 className="font-bold text-gray-800 text-sm">Détail du Pack</h1>
        <div className="w-9"></div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
          <div className="h-60 w-full relative">
            <img
              src={product.image_url || 'https://images.unsplash.com/photo-1551754655-cd9e3fb8c371?auto=format&fit=crop&w=600&q=80'}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 mb-1">{product.name}</h2>
              <p className="text-sm text-gray-600">{product.description}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Prix unitaire :</span>
                <span className="font-bold text-gray-900">{product.price.toLocaleString('fr-FR')} FC</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Versement mensuel prévu :</span>
                <span className="font-bold text-biso-600">{product.monthly_return.toLocaleString('fr-FR')} FC</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Durée :</span>
                <span className="font-bold text-gray-900">{product.duration_months} mois</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total prévu :</span>
                <span className="font-bold text-emerald-700">{product.total_returns.toLocaleString('fr-FR')} FC</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Limite d'achat :</span>
                <span className="font-bold text-gray-900">{product.purchase_limit} packs max</span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-biso-50 p-4 rounded-2xl border border-biso-100">
              <div>
                <p className="text-xs text-biso-700 font-semibold">Solde Wallet Disponible</p>
                <p className="text-lg font-bold text-biso-900">{(wallet?.balance || 0).toLocaleString('fr-FR')} FC</p>
              </div>
              <Link href="/wallet?tab=deposit" className="text-xs bg-biso-600 text-white px-3 py-2 rounded-xl font-semibold hover:bg-biso-700">
                Recharger
              </Link>
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-semibold text-gray-700">Quantité :</span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-xl bg-gray-100 text-gray-800 font-bold flex items-center justify-center hover:bg-gray-200"
                >
                  -
                </button>
                <span className="text-lg font-bold w-8 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(product.purchase_limit, quantity + 1))}
                  className="w-10 h-10 rounded-xl bg-gray-100 text-gray-800 font-bold flex items-center justify-center hover:bg-gray-200"
                >
                  +
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
              <div>
                <span className="text-xs text-gray-500">Total à payer :</span>
                <p className="text-xl font-extrabold text-gray-900">{totalCost.toLocaleString('fr-FR')} FC</p>
              </div>
              <button
                onClick={() => setShowConfirm(true)}
                className="bg-biso-600 hover:bg-biso-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md transition-all text-sm"
              >
                INVESTIR MAINTENANT
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-gray-900">Confirmer l'investissement</h3>
            <p className="text-sm text-gray-600">
              Vous êtes sur le point d'investir <strong className="text-gray-900">{totalCost.toLocaleString('fr-FR')} FC</strong> pour <strong className="text-gray-900">{quantity}x {product.name}</strong>.
            </p>

            {error && (
              <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-emerald-50 text-emerald-600 text-xs p-3 rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={purchasing}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handlePurchase}
                disabled={purchasing}
                className="flex-1 bg-biso-600 hover:bg-biso-700 text-white font-semibold py-2.5 rounded-xl text-sm shadow-md"
              >
                {purchasing ? 'Traitement...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
