'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ShieldCheck, Clock } from 'lucide-react'
import { Product } from '@/types'

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between">
      <div>
        <div className="relative h-40 w-full bg-gray-100">
          <img
            src={product.image_url || 'https://images.unsplash.com/photo-1551754655-cd9e3fb8c371?auto=format&fit=crop&w=600&q=80'}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 right-3 bg-biso-900/80 backdrop-blur-xs text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
            {product.duration_months} mois
          </div>
        </div>

        <div className="p-4">
          <h3 className="font-bold text-gray-800 text-base mb-1">{product.name}</h3>
          <p className="text-xs text-gray-500 line-clamp-2 mb-3">{product.description}</p>

          <div className="space-y-1.5 bg-gray-50 p-3 rounded-xl mb-3">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Investissement :</span>
              <span className="font-bold text-gray-900">{product.price.toLocaleString('fr-FR')} FC</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Versement mensuel prévu :</span>
              <span className="font-bold text-biso-600">{product.monthly_return.toLocaleString('fr-FR')} FC</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Total prévu :</span>
              <span className="font-bold text-emerald-700">{product.total_returns.toLocaleString('fr-FR')} FC</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 pt-0">
        <Link
          href={`/invest/${product.id}`}
          className="w-full bg-biso-600 hover:bg-biso-700 text-white font-semibold py-2.5 px-4 rounded-xl text-center text-sm flex items-center justify-center space-x-2 transition-all shadow-xs"
        >
          <span>INVESTIR</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
