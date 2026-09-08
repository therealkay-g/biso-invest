'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { ProductCategory, Product } from '@/types'
import ProductCard from '@/components/ProductCard'
import Header from '@/components/Header'

export default function InvestPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
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

        setCategories(catData || [])
        setProducts(prodData || [])
      } catch (err) {
        console.error('Error loading invest data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadInvestData()
  }, [])

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter(p => p.category_id === selectedCategory)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-biso-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header displayName="Investissements" vipLevel="Catalogue 42 Packs" showBack={true} />

      <div className="p-4 max-w-6xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Opportunités d'Investissement</h2>
          <p className="text-xs text-gray-500">7 secteurs économiques majeurs pour construire demain.</p>
        </div>

        {/* Categories Tabs */}
        <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-biso-600 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Tous (42)
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-biso-600 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((prod) => (
            <ProductCard key={prod.id} product={prod} />
          ))}
        </div>
      </div>
    </div>
  )
}
