'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, CheckCircle2, Sprout, Tractor, Fish, Clock, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { getVipTierForPrice } from '@/utils/constants'
import {
  WELCOME_MODAL_CONTAINER_CLASSES,
  WELCOME_CARD_CLASSES,
  buildActiveSectors,
  clearWelcomeShown,
  isWelcomeShown,
  markWelcomeShown,
  type WelcomeSector,
} from '@/lib/welcome-popup'

const SECTOR_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  agriculture: Sprout,
  elevage: Tractor,
  pisciculture: Fish,
}

export default function WelcomePopup() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [sectors, setSectors] = useState<WelcomeSector[]>([])

  useEffect(() => {
    let cancelled = false

    const { data: sub } = supabase.auth.onAuthStateChange(
      (event: string, session: { user?: { id: string } | null } | null) => {
      const user = session?.user ?? null

      if (event === 'SIGNED_OUT') {
        if (typeof window !== 'undefined') clearWelcomeShown(window.sessionStorage)
        setSectors([])
        setOpen(false)
        return
      }

      if (!user) {
        setOpen(false)
        return
      }

      const storage = typeof window !== 'undefined' ? window.sessionStorage : null
      if (!storage) return

      // SIGNED_IN : nouvelle connexion → toujours afficher, quelle que soit la clé précédente.
      if (event === 'SIGNED_IN') {
        clearWelcomeShown(storage)
        openPopup(user.id)
        markWelcomeShown(storage, user.id)
        return
      }

      // INITIAL_SESSION (rechargement de page pendant une session active) :
      // n'affiche qu'en l'absence de clé (jamais à chaque navigation, jamais 2 fois/session).
      if (!isWelcomeShown(storage, user.id)) {
        openPopup(user.id)
        markWelcomeShown(storage, user.id)
      }
    })

    async function openPopup(userId: string) {
      if (cancelled) return
      setOpen(true)
      const now = new Date()
      const [{ data: categories }, { data: products }] = await Promise.all([
        supabase
          .from('product_categories')
          .select('id, name, slug, icon, order_index')
          .order('order_index', { ascending: true }),
        supabase
          .from('products')
          .select('id, category_id, name, price, monthly_return, duration_months')
          .eq('is_active', true),
      ])
      if (cancelled) return
      const built = buildActiveSectors(
        categories ?? [],
        products ?? [],
        now.getFullYear(),
        now.getMonth(),
      )
      setSectors(built)
    }

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const handleClose = useCallback(() => setOpen(false), [])

  const handleUnderstand = useCallback(() => {
    setOpen(false)
    router.push('/guide')
  }, [router])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) handleClose()
    },
    [handleClose],
  )

  if (!open) return null

  return (
    <div
      className={WELCOME_MODAL_CONTAINER_CLASSES}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenue chez BISO INVEST"
    >
      <div className={WELCOME_CARD_CLASSES}>
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-5 pt-4 pb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-md">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-gray-900 leading-tight">
                Bienvenue chez BISO INVEST
              </h2>
              <p className="text-xs text-gray-500">« Ensemble, construisons demain. »</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fermer"
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Découvrez nos secteurs d&apos;investissement et leurs packs officiels. Chaque pack vous
            verse un revenu mensuel prévu, réparti quotidiennement.
          </p>

          {sectors.length === 0 ? (
            <div className="mt-4 flex items-center justify-center py-6 text-sm text-gray-400 animate-pulse">
              Chargement des packs…
            </div>
          ) : (
            <div className="mt-4 space-y-6">
              {sectors.map((sector) => {
                const Icon = SECTOR_ICONS[sector.slug] ?? Sprout
                return (
                  <section key={sector.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-emerald-700" />
                      </span>
                      <h3 className="text-sm font-bold text-gray-900">{sector.name}</h3>
                    </div>
                    <ul className="space-y-2">
                      {sector.packs.map((pack) => {
                        const tier = getVipTierForPrice(pack.price)
                        return (
                          <li
                            key={pack.id}
                            className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-bold text-gray-900">{pack.name}</p>
                                {tier && (
                                  <span
                                    className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-black ${tier.colorClass}`}
                                  >
                                    {tier.badge}
                                  </span>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-extrabold text-emerald-700">
                                  {pack.price.toLocaleString('fr-FR')} FC
                                </p>
                                <p className="text-[10px] text-gray-500">Capital</p>
                              </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-3 gap-2">
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase font-semibold">
                                  Revenu / mois
                                </p>
                                <p className="text-xs font-bold text-gray-900">
                                  {pack.monthlyReturn.toLocaleString('fr-FR')} FC
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase font-semibold">
                                  Revenu / jour
                                </p>
                                <p className="text-xs font-bold text-gray-900">
                                  +{Math.round(pack.dailyRevenue).toLocaleString('fr-FR')} FC
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase font-semibold">
                                  Durée
                                </p>
                                <p className="text-xs font-bold text-gray-900 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-gray-400" />
                                  {pack.durationMonths} mois
                                </p>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
            </div>
          )}

          <div className="mt-5 rounded-2xl bg-amber-50 border border-amber-200 p-3">
            <p className="text-[11px] text-amber-900 leading-relaxed">
              <span className="font-bold">Information :</span> ce pop-up est informatif. Les
              montants exacts, conditions d&apos;éligibilité et le revenu quotidien réel de votre
              investissement sont toujours ceux affichés sur les pages d&apos;investissement.
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-100 px-5 py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50 transition-colors"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={handleUnderstand}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-sm font-bold shadow-sm hover:from-emerald-700 hover:to-emerald-800 transition-colors active:scale-[0.98]"
          >
            Comprendre
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}