'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import WalletCard from '@/components/WalletCard'
import StatCard from '@/components/StatCard'
import ProductCard from '@/components/ProductCard'
import { WalletSkeleton, ProductSkeleton } from '@/components/Skeleton'
import { supabase } from '@/lib/supabase/client'
import { Product, Profile, Wallet, Investment, Announcement } from '@/types'
import { ALLOWED_PACK_PRICES } from '@/utils/constants'
import { Plus, ArrowUpRight, Package, Users, TrendingUp, DollarSign, Shield, Bell, Sparkles, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [popularProducts, setPopularProducts] = useState<Product[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [activeInvestments, setActiveInvestments] = useState<Investment[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminRole, setAdminRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          window.location.href = '/auth/login'
          return
        }

        // Fetch profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setProfile(profileData)

        // Check admin role
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

        // Fetch wallet
        const { data: walletData } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', user.id)
          .single()
        setWallet(walletData)

        // Fetch popular products (only allowed VIP1 to VIP4 packs)
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

        // Fetch announcements
        const { data: annData } = await supabase
          .from('announcements')
          .select('*')
          .eq('is_published', true)
          .limit(2)
        setAnnouncements(annData || [])

        // Fetch active investments
        const { data: invData } = await supabase
          .from('investments')
          .select('*, product:products(*)')
          .eq('user_id', user.id)
          .eq('status', 'ACTIVE')
          .limit(3)
        setActiveInvestments(invData || [])

      } catch (err) {
        console.error('Error loading dashboard:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header
        displayName={profile?.display_name || profile?.phone || 'Investisseur'}
        vipLevel={profile?.current_vip || 'VIP0'}
        showBack={false}
        isAdmin={isAdmin}
        adminRole={adminRole || 'ADMIN'}
      />

      <div className="p-4 space-y-6 max-w-4xl mx-auto">
        {/* Super Admin Welcome Banner */}
        {isAdmin && (
          <div className="bg-gradient-to-r from-[#0b1e36] via-zinc-900 to-emerald-950 text-white p-5 rounded-3xl border border-amber-500/30 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-amber-500/20 text-amber-300 rounded-2xl border border-amber-500/30 shrink-0">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black uppercase tracking-wider bg-amber-400 text-zinc-950 px-2 py-0.5 rounded-md">
                    {adminRole || 'ADMIN'}
                  </span>
                  <span className="text-xs text-zinc-300 font-semibold">Accès Administrateur Détecté</span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Vous disposez des droits de gestion (utilisateurs, validation des dépôts/retraits, packs, audits).
                </p>
              </div>
            </div>
            <Link
              href="/admin"
              className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs px-5 py-3 rounded-2xl shadow-lg flex items-center space-x-2 transition-all active:scale-95 shrink-0 uppercase tracking-wide"
            >
              <Shield className="w-4 h-4" />
              <span>Accéder au Panel Admin</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Official Announcements Banner */}
        {announcements.length > 0 && (
          <div className="bg-gradient-to-r from-biso-700 to-emerald-800 text-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-white/10 backdrop-blur-sm shrink-0">
                <Bell className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">{announcements[0].title}</p>
                <p className="text-[11px] text-emerald-100 line-clamp-1">{announcements[0].content}</p>
              </div>
            </div>
            <Link href="/service" className="text-xs text-amber-300 hover:text-white font-bold shrink-0 ml-3">
              Lire
            </Link>
          </div>
        )}

        {/* Ultra-Luxury Black Card Wallet */}
        <WalletCard
          balance={wallet?.balance || 0}
          totalInvested={wallet?.total_invested || 0}
          totalEarned={wallet?.total_earned || 0}
          todayEarned={wallet?.today_earned || 0}
          userName={profile?.display_name || profile?.phone}
          vipLevel={profile?.current_vip || 'VIP0'}
        />

        {/* Quick Shortcut Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/invest"
            className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center space-y-1.5 hover:border-biso-300 transition-all active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-biso-50 text-biso-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-gray-800">Nos Packs</span>
          </Link>

          <Link
            href="/task"
            className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center space-y-1.5 hover:border-biso-300 transition-all active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-gray-800">Mes Tâches</span>
          </Link>

          <Link
            href="/investments"
            className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center space-y-1.5 hover:border-biso-300 transition-all active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-gray-800">Mes Gains</span>
          </Link>

          <Link
            href="/vip"
            className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center space-y-1.5 hover:border-biso-300 transition-all active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-gray-800">Paliers VIP</span>
          </Link>
        </div>

        {/* Active Investments Overview */}
        {activeInvestments.length > 0 && (
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-gray-900 text-sm">Investissements en cours ({activeInvestments.length})</h3>
              <Link href="/investments" className="text-xs text-biso-700 font-bold hover:underline flex items-center">
                <span>Détails</span>
                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </Link>
            </div>
            <div className="space-y-3">
              {activeInvestments.map((inv) => (
                <div key={inv.id} className="p-3.5 bg-gray-50 rounded-2xl flex justify-between items-center border border-gray-100">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{inv.product?.name || 'Pack Investissement'}</h4>
                    <p className="text-[11px] text-gray-500">
                      Rendement : +{(inv.monthly_return * inv.quantity).toLocaleString('fr-FR')} FC / mois
                    </p>
                  </div>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                    Actif
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Popular Investment Packs */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-black text-gray-900 text-sm">Packs les Plus Prisés</h3>
              <p className="text-xs text-gray-500">Financez des projets à haut potentiel en RDC.</p>
            </div>
            <Link href="/invest" className="text-xs text-biso-700 font-bold hover:underline flex items-center">
              <span>Voir tout</span>
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {popularProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
