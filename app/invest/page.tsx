'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { ProductCategory, Product } from '@/types'
import ProductCard from '@/components/ProductCard'
import Header from '@/components/Header'
import PageEnter from '@/components/PageEnter'
import StaggerIn from '@/components/StaggerIn'
import { ProductSkeleton } from '@/components/Skeleton'
import { ALLOWED_PACK_PRICES } from '@/utils/constants'
import { Sprout, Beef, Fish, LayoutGrid } from 'lucide-react'

const SECTOR_META: Record<string, { icon: typeof Sprout; emoji: string; tagline: string }> = {
  Agriculture: { icon: Sprout, emoji: '🌱', tagline: 'Cultures et récoltes durables au cœur de la RDC.' },
  'Élevage': { icon: Beef, emoji: '🐄', tagline: 'Élevages modernes et encadrés pour un rendement stable.' },
  Pisciculture: { icon: Fish, emoji: '🐟', tagline: 'Pisciculture maîtrisée en étangs et bassins contrôlés.' },
}

export default function InvestPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadInvestData() {
      try {
        const { data: catData } = await supabase
          .from('product_categories')
          .select('*')
          .order('order_index')

        const { data: prodData } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .in('price', [...ALLOWED_PACK_PRICES])
          .order('price', { ascending: true })

        // Exclusion de sécurité : aucun pack solaire proposé
        const validProducts = (prodData || []).filter((p: Product) =>
          ALLOWED_PACK_PRICES.includes(p.price as any)
        ).filter((p: Product) => {
          const cat = (catData || []).find((c: ProductCategory) => c.id === p.category_id)
          const lower = (cat?.name || '').toLowerCase()
          return !lower.includes('solaire') && !lower.includes('solar') && !p.name.toLowerCase().includes('solaire')
        })

        setCategories(catData || [])
        setProducts(validProducts)
      } catch (err) {
        console.error('Error loading invest data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadInvestData()
  }, [])

  const filteredProducts = selectedCategoryId
    ? products.filter(p => p.category_id === selectedCategoryId)
    : products

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header displayName="Investir" vipLevel="Opportunités" showBack={false} />
        <div className="p-4 max-w-4xl mx-auto space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[0, 1, 2].map(i => <div key={i} className="h-24 bg-gray-200 rounded-3xl animate-pulse" />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <ProductSkeleton />
            <ProductSkeleton />
          </div>
        </div>
      </div>
    )
  }

  return (
    <PageEnter className="min-h-screen bg-gray-50 pb-24">
      <Header displayName="Investir" vipLevel="Packs VIP1 - VIP4" showBack={false} />

      <main className="p-4 max-w-4xl mx-auto space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-xl font-black text-gray-900">Opportunités d&apos;investissement</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Projets agricoles réels en RDC, dès {ALLOWED_PACK_PRICES[0].toLocaleString('fr-FR')} FC.
          </p>
        </div>

        {/* Cartes secteurs */}
        <section className="space-y-3">
          <h2 className="font-black text-gray-900 text-sm uppercase tracking-wider">Choisissez un secteur</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={`card p-4 text-left transition-all active:scale-[0.98] text-center flex flex-col items-center space-y-1.5 ${
                selectedCategoryId === null ? 'ring-2 ring-emerald-500 border-emerald-300' : ''
              }`}
            >
              <span className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-600 flex items-center justify-center">
                <LayoutGrid className="w-6 h-6" aria-hidden="true" />
              </span>
              <span className="font-black text-gray-900 text-sm">Tous</span>
              <span className="text-[10px] text-gray-500">{products.length} packs</span>
            </button>

            {categories.map((cat) => {
              const meta = SECTOR_META[cat.name]
              const Icon = meta?.icon || Sprout
              const count = products.filter(p => p.category_id === cat.id).length
              const isActive = selectedCategoryId === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(isActive ? null : cat.id)}
                  className={`card p-4 text-left transition-all active:scale-[0.98] ${
                    isActive ? 'ring-2 ring-emerald-500 border-emerald-300' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <span className="text-2xl" aria-hidden="true">{meta?.emoji || cat.icon}</span>
                  </div>
                  <p className="font-black text-gray-900 text-sm mt-3">{cat.name}</p>
                  <p className="text-[10px] text-gray-500 leading-snug mt-0.5">{meta?.tagline || cat.description || "Projets d'économie réelle."}</p>
                  <p className="text-[10px] font-bold text-emerald-600 mt-2">{count} pack{count > 1 ? 's' : ''}</p>
                </button>
              )
            })}
          </div>
        </section>

        {/* Grille de packs */}
        <section className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-black text-gray-900 text-sm uppercase tracking-wider">
              {selectedCategoryId
                ? categories.find(c => c.id === selectedCategoryId)?.name || 'Packs'
                : 'Tous les packs officiels'}
            </h2>
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              {filteredProducts.length} pack{filteredProducts.length > 1 ? 's' : ''}
            </span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="card p-8 text-center space-y-2">
              <p className="text-sm font-bold text-gray-800">Aucun pack disponible</p>
              <p className="text-xs text-gray-500">Revenez bientôt, de nouvelles opportunités arrivent.</p>
            </div>
          ) : (
            <StaggerIn className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </StaggerIn>
          )}
        </section>
      </main>
    </PageEnter>
  )
}