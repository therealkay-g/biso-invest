'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import WalletCard from '@/components/WalletCard'
import ProductCard from '@/components/ProductCard'
import Reveal from '@/components/Reveal'
import PullToRefresh from '@/components/PullToRefresh'
import { RippleButton } from '@/components/RippleButton'
import { WalletSkeleton, ProductSkeleton } from '@/components/Skeleton'
import { supabase } from '@/lib/supabase/client'
import { Product, Profile, Wallet, Investment, Announcement, ProfitClaim, ProductCategory } from '@/types'
import { ALLOWED_PACK_PRICES } from '@/utils/constants'
import { Plus, ArrowUpRight, Package, Users, TrendingUp, Shield, Bell, ChevronRight, HandCoins, CheckCircle2, AlertCircle, Sprout, Beef, Fish, CalendarCheck } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ToastProvider'

const SECTOR_ICONS: Record<string, { label: string; icon: typeof Sprout }> = {
  Agriculture: { label: 'Agriculture', icon: Sprout },
  'Élevage': { label: 'Élevage', icon: Beef },
  Pisciculture: { label: 'Pisciculture', icon: Fish },
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [popularProducts, setPopularProducts] = useState<Product[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [activeInvestments, setActiveInvestments] = useState<(Investment & { product?: Product })[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [claims, setClaims] = useState<ProfitClaim[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminRole, setAdminRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sellLoading, setSellLoading] = useState<string | null>(null)
  const [sellSuccess, setSellSuccess] = useState<Record<string, boolean>>({})
  const toast = useToast()

  const loadDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth/login'
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(profileData)

      try {
        const { data: adminRow } = await supabase
          .from('admin_users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        if (adminRow) {
          setIsAdmin(true)
          setAdminRole(adminRow.role)
        } else {
          const { data: isAdminRpc } = await supabase.rpc('is_admin')
          if (isAdminRpc) {
            setIsAdmin(true)
            setAdminRole('ADMIN')
          }
        }
      } catch (adminErr) {
        console.warn('Erreur check admin dashboard:', adminErr)
      }

      const { data: walletData } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single()
      setWallet(walletData)

      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .in('price', [...ALLOWED_PACK_PRICES])
        .order('price', { ascending: true })
      const validPopular = (prodData || []).filter((p: Product) =>
        ALLOWED_PACK_PRICES.includes(p.price as any)
      )
      setPopularProducts(validPopular)

      const { data: annData } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_published', true)
        .limit(2)
      setAnnouncements(annData || [])

      const { data: catData } = await supabase
        .from('product_categories')
        .select('*')
        .order('order_index')
      setCategories(catData || [])

      const { data: invData } = await supabase
        .from('investments')
        .select('*, product:products(*)')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .limit(5)
      setActiveInvestments(invData || [])

      const { data: claimData } = await supabase
        .from('profit_claims')
        .select('*')
        .eq('user_id', user.id)
        .order('profit_date', { ascending: false })
        .limit(100)
      setClaims(claimData || [])

    } catch (err) {
      console.error('Error loading dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Supabase Realtime synchronization on wallet
  useEffect(() => {
    let channel: any
    async function setupRealtime() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase
        .channel(`dashboard-wallet-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'wallets',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            if (payload.new) {
              setWallet(payload.new as Wallet)
            }
          }
        )
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  const todayKey = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const isInvestmentFinished = (inv: Investment) => {
    if (inv.status !== 'ACTIVE') return true
    const end = new Date(inv.created_at)
    end.setMonth(end.getMonth() + (inv.duration_months || 12))
    return new Date() >= end
  }

  const hasClaimedToday = (invId: string) => {
    const today = todayKey()
    return claims.some(c => c.investment_id === invId && c.profit_date === today)
  }

  const handleSell = async (invId: string) => {
    if (sellLoading) return
    setSellLoading(invId)
    try {
      const { data, error } = await supabase.rpc('claim_daily_profit')
      if (error) throw error

      if (data?.claimed_amount > 0) {
        toast.success(`Vente effectuée avec succès — Vous avez reçu : ${data.claimed_amount.toLocaleString('fr-FR')} FC`)
      } else {
        toast.info('Bénéfice du jour déjà réclamé. Revenez demain !')
      }
      await loadDashboard()
      if (data?.claimed_amount > 0) {
        setSellSuccess((s) => ({ ...s, [invId]: true }))
        setTimeout(() => {
          setSellSuccess((s) => {
            const next = { ...s }
            delete next[invId]
            return next
          })
        }, 1400)
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la vente du bénéfice du jour.")
    } finally {
      setSellLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Header displayName="Investisseur" vipLevel="VIP0" showBack={false} />
        <div className="p-4 space-y-6 max-w-4xl mx-auto">
          <WalletSkeleton />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-gray-200 rounded-2xl animate-pulse" />
            <div className="h-20 bg-gray-200 rounded-2xl animate-pulse" />
          </div>
          <div className="space-y-3">
            <div className="h-5 w-40 bg-gray-200 rounded-md animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ProductSkeleton />
              <ProductSkeleton />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const greetingName = profile?.display_name || profile?.phone || 'Investisseur'
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="min-h-screen bg-gray-50 pb-8 page-enter">
      <Header
        displayName={greetingName}
        vipLevel={profile?.current_vip || 'VIP0'}
        showBack={false}
        isAdmin={isAdmin}
        adminRole={adminRole || 'ADMIN'}
      />

      <PullToRefresh onRefresh={() => window.location.reload()}>
        <main className="max-w-4xl mx-auto px-4 pt-5 space-y-6 pb-24">
        {/* Salutation */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-black text-gray-900">
            Bonjour <span aria-hidden="true">👋</span>
          </h1>
          <p className="text-sm text-gray-500 capitalize">{today}</p>
        </div>

        {/* Official Announcements Banner */}
        {announcements.length > 0 && (
          <div className="card-sm p-4 flex items-center justify-between animate-fade-in">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-emerald-50 shrink-0">
                <Bell className="w-5 h-5 text-emerald-600" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">{announcements[0].title}</p>
                <p className="text-[11px] text-gray-500 line-clamp-1">{announcements[0].content}</p>
              </div>
            </div>
            <Link href="/service" className="text-xs text-emerald-600 hover:text-emerald-800 font-bold shrink-0 ml-3">
              Lire
            </Link>
          </div>
        )}

        {/* Admin welcome banner */}
        {isAdmin && (
          <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-950 text-white p-5 rounded-3xl border border-amber-400/30 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-amber-500/20 text-amber-300 rounded-2xl border border-amber-500/30 shrink-0">
                <Shield className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider bg-amber-400 text-emerald-950 px-2 py-0.5 rounded-md">
                  {adminRole || 'ADMIN'}
                </span>
                <p className="text-xs text-emerald-100 mt-1">Accès administrateur détecté — gestion des utilisateurs, dépôts et retraits.</p>
              </div>
            </div>
            <Link
              href="/admin"
              className="bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black text-xs px-5 py-3 rounded-2xl shadow-lg flex items-center space-x-2 transition-all active:scale-95 shrink-0 uppercase tracking-wide"
            >
              <Shield className="w-4 h-4" aria-hidden="true" />
              <span>Panel Admin</span>
            </Link>
          </div>
        )}

        {/* Carte solde premium */}
        <WalletCard
          balance={wallet?.balance || 0}
          totalInvested={wallet?.total_invested || 0}
          totalEarned={wallet?.total_earned || 0}
          todayEarned={wallet?.today_earned || 0}
          totalWithdrawn={wallet?.total_withdrawn || 0}
          userName={greetingName}
          vipLevel={profile?.current_vip || 'VIP0'}
        />

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { href: '/invest', label: 'Investir', icon: Package, bg: 'bg-emerald-50 text-emerald-600' },
            { href: '/task', label: 'Tâches', icon: Users, bg: 'bg-amber-50 text-amber-600' },
            { href: '/investments', label: 'Mes gains', icon: TrendingUp, bg: 'bg-emerald-50 text-emerald-700' },
            { href: '/vip', label: 'VIP', icon: Shield, bg: 'bg-gray-100 text-gray-700' },
          ].map(({ href, label, icon: Icon, bg }, qi) => (
            <Reveal key={href} delay={qi * 60}>
              <Link
                href={href}
                className="card-sm p-3 flex flex-col items-center justify-center text-center space-y-1.5 hover:border-emerald-300 transition-all active:scale-95"
              >
                <span className={`w-10 h-10 rounded-2xl ${bg} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 tap-icon" aria-hidden="true" />
                </span>
                <span className="text-[10px] font-bold text-gray-700">{label}</span>
              </Link>
            </Reveal>
          ))}
        </div>

        {/* Mes investissements */}
        <section className="space-y-3 animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-black text-gray-900 text-base">Mes investissements</h2>
              <p className="text-xs text-gray-500">Vendez chaque jour votre bénéfice disponible.</p>
            </div>
            <Link href="/investments" className="text-xs text-emerald-600 font-bold hover:underline inline-flex items-center shrink-0">
              <span>Voir tout</span>
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" aria-hidden="true" />
            </Link>
          </div>

          {activeInvestments.length === 0 ? (
            <div className="card p-6 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <Package className="w-7 h-7" aria-hidden="true" />
              </div>
              <p className="text-sm font-bold text-gray-800">Aucun investissement en cours</p>
              <p className="text-xs text-gray-500">Découvrez nos packs et commencez dès 20 000 FC.</p>
              <Link href="/invest" className="inline-flex items-center space-x-2 btn-primary px-6 text-xs">
                <span>Découvrir les packs</span>
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            activeInvestments.map((inv, index) => {
              const monthlyReturn = (inv.product?.monthly_return || 0) * inv.quantity
              const now = new Date()
              const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
              const dailyProfit = monthlyReturn / daysInCurrentMonth
              const finished = isInvestmentFinished(inv)
              const claimedToday = hasClaimedToday(inv.id)
              const category = categories.find(c => c.id === inv.product?.category_id)
              const SectorIcon = (category && SECTOR_ICONS[category.name])?.icon || Sprout

              return (
                <Reveal key={inv.id} delay={index * 60}>
                  <div className="card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <span className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <SectorIcon className="w-5 h-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 text-sm truncate">{inv.product?.name || 'Pack Investissement'}</h3>
                        <p className="text-[11px] text-gray-500 capitalize">{category?.name || 'Secteur'} • {inv.duration_months} mois</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                      finished
                        ? 'bg-gray-100 text-gray-500 border-gray-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {finished ? 'Terminé' : 'Actif'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-xl p-3 text-center">
                    <div>
                      <p className="text-[9px] uppercase text-gray-400 font-semibold">Investi</p>
                      <p className="text-xs font-black text-gray-900 tabular-nums">{inv.total_amount.toLocaleString('fr-FR')} FC</p>
                    </div>
                    <div className="border-x border-gray-200">
                      <p className="text-[9px] uppercase text-gray-400 font-semibold">Revenu mensuel prévu</p>
                      <p className="text-xs font-black text-emerald-700 tabular-nums">+{monthlyReturn.toLocaleString('fr-FR')} FC</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase text-gray-400 font-semibold">Bénéfice du jour</p>
                      <p className="text-xs font-black text-amber-600 tabular-nums">+{dailyProfit.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FC</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    {finished ? (
                      <span className="inline-flex items-center space-x-1.5 text-xs font-black text-gray-500 bg-gray-100 px-4 py-3 rounded-2xl">
                        <AlertCircle className="w-4 h-4" aria-hidden="true" />
                        <span>Investissement terminé</span>
                      </span>
                    ) : (claimedToday || sellSuccess[inv.id]) ? (
                      <span className="inline-flex items-center space-x-1.5 text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-2xl check-pop">
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        <span>{sellSuccess[inv.id] ? 'Bénéfice vendu' : 'Déjà vendu aujourd\u2019hui'}</span>
                      </span>
                    ) : (
                      <>
                        <span className="text-[10px] text-gray-500 font-semibold hidden sm:block">
                          Votre bénéfice du jour est disponible
                        </span>
                        <RippleButton
                          onClick={() => handleSell(inv.id)}
                          disabled={!!sellLoading}
                          className="inline-flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3 min-h-[44px] rounded-2xl text-xs uppercase tracking-widest shadow-md shadow-emerald-950/10 active:scale-95 transition-all disabled:opacity-50 flex-1 sm:flex-none"
                        >
                          {sellLoading === inv.id ? (
                            <>
                              <span className="spinner" aria-hidden="true" />
                              <span>Traitement...</span>
                            </>
                          ) : (
                            <>
                              <HandCoins className="w-4 h-4" aria-hidden="true" />
                              <span>VENDRE</span>
                            </>
                          )}
                        </RippleButton>
                      </>
                    )}
                  </div>

                  <Link
                    href="/investments"
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 inline-flex items-center"
                  >
                    <CalendarCheck className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                    Voir l&apos;historique de mes bénéfices
                  </Link>
                  </div>
                </Reveal>
              )
            })
          )}
        </section>

        {/* Popular packs */}
        <section className="space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-black text-gray-900 text-base">Packs les plus prisés</h2>
              <p className="text-xs text-gray-500">Financez des projets réels en RDC.</p>
            </div>
            <Link href="/invest" className="text-xs text-emerald-600 font-bold hover:underline inline-flex items-center shrink-0">
              <span>Voir tout</span>
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {popularProducts.map((product, pIdx) => (
              <Reveal key={product.id} delay={pIdx * 60}>
                <ProductCard product={product} />
              </Reveal>
            ))}
          </div>
        </section>
      </main>
      </PullToRefresh>
    </div>
  )
}