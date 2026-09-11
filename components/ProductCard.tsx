'use client'

import Link from 'next/link'
import { ArrowRight, Clock, Award, CalendarDays, TrendingUp } from 'lucide-react'
import { Product } from '@/types'
import { getVipTierForPrice } from '@/utils/constants'

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  const vipTier = getVipTierForPrice(product.price)

  return (
    <div className="card overflow-hidden flex flex-col justify-between transition-all hover:shadow-md hover:-translate-y-0.5 duration-300 animate-fade-in">
      <div>
        <div className="relative h-36 w-full bg-emerald-50">
          <img
            src={product.image_url || '/images/logo.png'}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/logo.png'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/60 via-transparent to-transparent pointer-events-none" />
          {vipTier && (
            <span className={`absolute top-3 left-3 ${vipTier.colorClass} text-[11px] font-extrabold px-2.5 py-1 rounded-full inline-flex items-center space-x-1 tracking-wider shadow-sm`}>
              <Award className="w-3 h-3" aria-hidden="true" />
              <span>{vipTier.level}</span>
            </span>
          )}
          <span className="absolute top-3 right-3 bg-emerald-950/80 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center space-x-1">
            <Clock className="w-3 h-3" aria-hidden="true" />
            <span>{product.duration_months} mois</span>
          </span>
        </div>

        <div className="p-4">
          {vipTier && (
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide block mb-1">
              {vipTier.name}
            </span>
          )}
          <h3 className="font-bold text-gray-900 text-base mb-0.5">{product.name}</h3>
          <p className="text-xs text-gray-500 line-clamp-2 mb-3 min-h-[2rem]">{product.description}</p>

          <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl">
            <div>
              <span className="block text-[10px] text-gray-500">Montant</span>
              <span className="font-black text-gray-900 text-sm tabular-nums">{product.price.toLocaleString('fr-FR')} FC</span>
            </div>
            <div className="text-right">
              <span className="block text-[10px] text-gray-500">Revenu mensuel prévu</span>
              <span className="font-black text-emerald-700 text-sm tabular-nums inline-flex items-center justify-end">
                <TrendingUp className="w-3.5 h-3.5 mr-0.5" aria-hidden="true" />
                {product.monthly_return.toLocaleString('fr-FR')} FC
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 pt-0">
        <Link
          href={`/invest/${product.id}`}
          className="w-full btn-primary inline-flex items-center justify-center space-x-2 text-sm"
        >
          <span>INVESTIR</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}