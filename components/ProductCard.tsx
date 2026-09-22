'use client'

import { TrendingUp, Clock, Award } from 'lucide-react'
import { Product } from '@/types'
import { getVipTierForPrice } from '@/utils/constants'
import { RippleLink } from './RippleButton'

interface ProductCardProps {
  product: Product
}

/**
 * Carte pack compacte (~120-160px de haut) :
 * ligne 1 : image 48px + nom + badge VIP
 * ligne 2 : montant investi
 * ligne 3 : revenu mensuel prévu + durée
 * bouton INVESTIR compact.
 * Hover : scale 1.02 — Clic : scale 0.98.
 */
export default function ProductCard({ product }: ProductCardProps) {
  const vipTier = getVipTierForPrice(product.price)

  return (
    <div className="card pressable overflow-hidden flex flex-col justify-between animate-fade-in group">
      <div className="p-3.5 pb-2 flex-1">
        {/* Ligne 1 : image mini + nom + VIP */}
        <div className="flex items-center gap-3">
          <img
            src={product.image_url || '/images/logo.png'}
            alt={product.name}
            className="w-12 h-12 rounded-xl object-cover shrink-0 bg-emerald-50 border border-gray-100 transition-transform duration-250 group-hover:scale-[1.04]"
            loading="lazy"
            onError={(e) => {
              ;(e.target as HTMLImageElement).src = '/images/logo.png'
            }}
          />
          <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
            <h3 className="font-bold text-gray-900 text-[13px] truncate">{product.name}</h3>
            {vipTier && (
              <span className={`${vipTier.colorClass} text-[9px] font-extrabold px-2 py-0.5 rounded-full inline-flex items-center space-x-0.5 tracking-wider shrink-0`}>
                <Award className="w-2.5 h-2.5" aria-hidden="true" />
                <span>{vipTier.level}</span>
              </span>
            )}
          </div>
        </div>

        {/* Ligne 2 : montant investi */}
        <p className="mt-2.5 text-sm font-black text-gray-900 tabular-nums">
          {product.price.toLocaleString('fr-FR')} FC
        </p>

        {/* Ligne 3 : revenu mensuel + durée */}
        <div className="flex items-center justify-between mt-1 gap-2 text-[11px]">
          <span className="text-gray-600 font-semibold inline-flex items-center min-w-0">
            <TrendingUp className="w-3 h-3 mr-1 text-emerald-600 shrink-0" aria-hidden="true" />
            <span className="tabular-nums truncate">{product.monthly_return.toLocaleString('fr-FR')} FC</span>
            <span className="text-gray-400 ml-1 shrink-0">/ mois</span>
          </span>
          <span className="text-gray-600 font-semibold inline-flex items-center shrink-0">
            <Clock className="w-3 h-3 mr-1 text-amber-600" aria-hidden="true" />
            {product.duration_months} mois
          </span>
        </div>
      </div>

      {/* Bouton INVESTIR compact */}
      <div className="px-3.5 pb-3.5">
        <RippleLink
          href={`/invest/${product.id}`}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-2.5 text-xs inline-flex items-center justify-center uppercase tracking-wider transition-all active:scale-95 min-h-[40px]"
        >
          INVESTIR
        </RippleLink>
      </div>
    </div>
  )
}