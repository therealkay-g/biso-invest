'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ShieldCheck, Clock, Award } from 'lucide-react'
import { Product } from '@/types'
import { getVipTierForPrice } from '@/utils/constants'

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  const vipTier = getVipTierForPrice(product.price)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between">
      <div>
        <div className="relative h-40 w-full bg-gray-100">
          <img
            src={product.image_url || '/images/logo.png'}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/logo.png'
            }}
          />
          {vipTier && (
            <div className={`absolute top-3 left-3 ${vipTier.colorClass} shadow-md text-[11px] font-extrabold px-2.5 py-1 rounded-full flex items-center space-x-1 tracking-wider`}>
              <Award className="w-3.5 h-3.5" />
              <span>{vipTier.level}</span>
            </div>
          )}
          <div className="absolute top-3 right-3 bg-biso-900/80 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
            {product.duration_months} mois
          </div>
        </div>

        <div className="p-4">
          {vipTier && (
            <span className="text-[11px] font-bold text-biso-600 uppercase tracking-wide block mb-1">
              {vipTier.name}
            </span>
          )}
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
          className="w-full bg-biso-600 hover:bg-biso-700 text-white font-semibold py-2.5 px-4 rounded-xl text-center text-sm flex items-center justify-center space-x-2 transition-all shadow-sm"
        >
          <span>INVESTIR</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
