import { getVipTierForPrice } from '@/utils/constants'

// Clé de session pour afficher le pop-up UNE SEULE FOIS par connexion.
// La clé est effacée à la déconnexion : une nouvelle connexion réaffiche le pop-up.
export const WELCOME_SHOWN_KEY = 'biso_welcome_shown_for_user'

// Catégories jamais affichées dans le pop-up (historique / désactivées).
// 'energie-solaire' doit absolument rester ici.
export const EXCLUDED_CATEGORY_SLUGS = [
  'energie-solaire',
  'commerce',
  'industrie-transformation',
  'transport-logistique',
  'restauration',
]

// Contrat de design du pop-up (vérifié par les tests responsive).
export const WELCOME_MODAL_CONTAINER_CLASSES =
  'fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-6'
export const WELCOME_CARD_CLASSES =
  'w-full max-w-lg mx-auto max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-gray-100'

export interface WelcomeCategoryRow {
  id: string
  name: string
  slug: string
  icon?: string | null
  order_index?: number | null
}

export interface WelcomeProductRow {
  id: string
  category_id: string
  name: string
  price: number
  monthly_return: number
  duration_months: number
  is_active?: boolean | null
}

export interface WelcomePack {
  id: string
  name: string
  price: number
  monthlyReturn: number
  durationMonths: number
  vipLevel: string
  vipName: string
  dailyRevenue: number
}

export interface WelcomeSector {
  id: string
  name: string
  slug: string
  icon: string
  orderIndex: number
  packs: WelcomePack[]
}

// Nombre réel de jours du mois (28/29/30/31).
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

// Revenu quotidien = revenu mensuel ÷ jours réels du mois.
export function calculateDailyRevenue(monthlyReturn: number, year: number, month: number): number {
  const days = getDaysInMonth(year, month)
  return monthlyReturn / days
}

export function markWelcomeShown(storage: Storage, userId: string): void {
  storage.setItem(WELCOME_SHOWN_KEY, userId)
}

export function isWelcomeShown(storage: Storage, userId: string): boolean {
  return storage.getItem(WELCOME_SHOWN_KEY) === userId
}

export function clearWelcomeShown(storage: Storage): void {
  storage.removeItem(WELCOME_SHOWN_KEY)
}

// Construit les secteurs + packs actifs pour le pop-up à partir des données Supabase.
export function buildActiveSectors(
  categories: WelcomeCategoryRow[],
  products: WelcomeProductRow[],
  year: number,
  month: number,
): WelcomeSector[] {
  const active = products.filter((p) => p.is_active !== false)
  const byId = new Map(categories.map((c) => [c.id, c]))

  return categories
    .filter((c) => !EXCLUDED_CATEGORY_SLUGS.includes(c.slug))
    .map((cat) => {
      const packs = active
        .filter((p) => p.category_id === cat.id)
        .map((p): WelcomePack => {
          const tier = getVipTierForPrice(p.price)
          return {
            id: p.id,
            name: p.name,
            price: p.price,
            monthlyReturn: p.monthly_return,
            durationMonths: p.duration_months,
            vipLevel: tier ? tier.level : 'VIP0',
            vipName: tier ? tier.name : `Pack ${p.price.toLocaleString('fr-FR')} FC`,
            dailyRevenue: calculateDailyRevenue(p.monthly_return, year, month),
          }
        })
        .sort((a, b) => a.price - b.price)
      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon || '',
        orderIndex: cat.order_index ?? 0,
        packs,
      }
    })
    .filter((s) => s.packs.length > 0)
    .sort((a, b) => {
      const ao = byId.get(a.id)?.order_index ?? 0
      const bo = byId.get(b.id)?.order_index ?? 0
      return ao - bo
    })
}