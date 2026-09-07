'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import WalletCard from '@/components/WalletCard'
import StatCard from '@/components/StatCard'
import ProductCard from '@/components/ProductCard'
import { supabase } from '@/lib/supabase/client'
import { Product, Profile, Wallet, Investment, Announcement } from '@/types'
import { Plus, ArrowUpRight, Package, Users, TrendingUp, DollarSign, Shield, Bell } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [popularProducts, setPopularProducts] = useState<Product[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [activeInvestments, setActiveInvestments] = useState<Investment[]>([])
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

        // Fetch wallet
        const { data: walletData } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', user.id)
          .single()
        setWallet(walletData)

        // Fetch popular products
        const { data: prodData } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .limit(4)
        setPopularProducts(prodData || [])

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-biso-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header
        displayName={profile?.display_name || profile?.phone || 'Investisseur'}
        vipLevel={profile?.current_vip || 'VIP0'}
      />

      <div className="p-4 space-y-6 max-w-4xl mx-auto">
        {/* Announcements Banner */}
        {announcements.length > 0 && (
          <div className="bg-gradient-to-r from-biso-600 to-emerald-700 text-white p-4 rounded-2xl shadow-md flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-white/20 px-2 py-0.5 rounded-full">Annonce</span>
              <h3 className="text-sm font-bold mt-1">{announcements[0].title}</h3>
              <p className="text-xs text-biso-100 mt-0.5 line-clamp-1">{announcements[0].content}</p>
            </div>
          </div>
        )}

        {/* Wallet Card */}
        <WalletCard
          balance={wallet?.balance || 0}
          totalInvested={wallet?.total_invested || 0}
          totalEarned={wallet?.total_earned || 0}
          todayEarned={wallet?.today_earned || 0}
        />

        {/* Shortcuts */}
        <div className="grid grid-cols-4 gap-3">
          <Link href="/wallet?tab=deposit" className="bg-white p-3 rounded-2xl border border-gray-100 shadow-xs flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-biso-50 text-biso-600 flex items-center justify-center mb-1.5">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-gray-700">Recharge</span>
          </Link>

          <Link href="/wallet?tab=withdraw" className="bg-white p-3 rounded-2xl border border-gray-100 shadow-xs flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-gray-700">Retrait</span>
          </Link>

          <Link href="/invest" className="bg-white p-3 rounded-2xl border border-gray-100 shadow-xs flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1.5">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-gray-700">Investir</span>
          </Link>

          <Link href="/team" className="bg-white p-3 rounded-2xl border border-gray-100 shadow-xs flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-1.5">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-gray-700">Équipe</span>
          </Link>
        </div>

        {/* Statistics Grid */}
        <div>
          <h3 className="text-sm font-bold text-gray-800 mb-3">Statistiques Globales</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard
              title="Total Rechargé"
              value={`${(wallet?.total_deposited || 0).toLocaleString('fr-FR')} FC`}
              icon={<DollarSign className="w-6 h-6" />}
              color="bg-biso-50 text-biso-600"
            />
            <StatCard
              title="Total Retiré"
              value={`${(wallet?.total_withdrawn || 0).toLocaleString('fr-FR')} FC`}
              icon={<TrendingUp className="w-6 h-6" />}
              color="bg-amber-50 text-amber-600"
            />
            <StatCard
              title="Revenus Équipe"
              value={`${(wallet?.team_earned || 0).toLocaleString('fr-FR')} FC`}
              icon={<Users className="w-6 h-6" />}
              color="bg-blue-50 text-blue-600"
            />
          </div>
        </div>

        {/* Active Investments Preview */}
        {activeInvestments.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-gray-800">Investissements Actifs</h3>
              <Link href="/investments" className="text-xs text-biso-600 font-bold hover:underline">
                Voir tout
              </Link>
            </div>
            <div className="space-y-3">
              {activeInvestments.map((inv) => (
                <div key={inv.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{inv.product?.name || 'Pack Investissement'}</h4>
                    <p className="text-xs text-gray-500">{inv.quantity} pack(s) • {inv.monthly_return.toLocaleString('fr-FR')} FC / mois</p>
                    <div className="mt-2 flex items-center space-x-2">
                      <div className="w-32 bg-gray-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-biso-600 h-full rounded-full"
                          style={{ width: `${(inv.paid_installments / inv.duration_months) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-[11px] text-gray-600 font-semibold">{inv.paid_installments} / {inv.duration_months} versements</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-biso-700 bg-biso-50 px-2.5 py-1 rounded-full">
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Popular Packs */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-gray-800">Packs Populaires</h3>
            <Link href="/invest" className="text-xs text-biso-600 font-bold hover:underline">
              Explorer tous les packs (42)
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {popularProducts.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
